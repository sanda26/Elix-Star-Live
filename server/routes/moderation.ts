/**
 * Live AI moderation: flag dangerous behavior only; enforce warning → pause → suspend.
 * All actions logged for review. Do NOT flag: smoking, drinking, sitting in car, normal adult content.
 */

import { Request, Response } from 'express';
import { getDbAdmin } from '../lib/backend';

const DANGEROUS_CATEGORIES = [
  'driving_while_live',
  'drunk_driving_encouragement',
  'dangerous_stunt',
  'illegal_activity_promotion',
  'self_harm_encouragement',
  'violent_challenge',
] as const;

const WINDOW_MS = 24 * 60 * 60 * 1000; // 24h for "repeated"
const WARNING_MESSAGE = 'Your stream may violate our safety guidelines. Please avoid dangerous or illegal activity.';
const PAUSE_MESSAGE = 'Stream paused for safety. Please review our community guidelines.';
const SUSPEND_MESSAGE = 'Your account is under review. Contact support if you have questions.';

type Severity = 'low' | 'medium' | 'high' | 'critical';

interface AIModerationResult {
  flagged: boolean;
  category?: string | null;
  severity?: Severity | null;
}

async function classifyImageWithAI(imageBase64: string): Promise<AIModerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { flagged: false };

  const prompt = `You are a safety classifier for live streaming. Output ONLY a JSON object with keys: "flagged" (boolean), "category" (string or null), "severity" ("low"|"medium"|"high"|"critical" or null).

Do NOT flag (treat as safe): smoking, drinking alcohol, sitting in a car as passenger, normal adult lifestyle, casual driving discussion off-camera.

DO flag only these dangerous behaviors if clearly present in the image:
- driving_while_live: person is clearly driving a vehicle while broadcasting
- drunk_driving_encouragement: promoting or encouraging driving under the influence
- dangerous_stunt: dangerous stunts or reckless physical challenges
- illegal_activity_promotion: promoting illegal activity
- self_harm_encouragement: encouraging self-harm
- violent_challenge: violent challenges or encouragement of violence

If the image shows only safe/neutral content (including smoking, drinking, or person in car as passenger), set "flagged": false and "category": null, "severity": null.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error('OpenAI moderation API error:', res.status, await res.text());
      return { flagged: false };
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return { flagged: false };

    const parsed = JSON.parse(content) as AIModerationResult;
    if (typeof parsed.flagged !== 'boolean') return { flagged: false };
    if (!parsed.flagged) return { flagged: false };
    if (parsed.category && !DANGEROUS_CATEGORIES.includes(parsed.category as any)) return { flagged: false };
    return {
      flagged: true,
      category: parsed.category ?? 'unspecified',
      severity: parsed.severity ?? 'medium',
    };
  } catch (e) {
    console.error('AI moderation classification error:', e);
    return { flagged: false };
  }
}

export async function handleLiveModerationCheck(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!getDbAdmin()) return res.status(501).json({ error: 'Live moderation not available.' });

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  const { data: userData, error: authError } = await getDbAdmin()!.auth.getUser(token);
  if (authError || !userData?.user) return res.status(401).json({ error: 'Invalid auth token' });

  const userId = userData.user.id;
  const { stream_key: streamKey, image_base64: imageBase64 } = req.body || {};

  if (!streamKey || typeof streamKey !== 'string') {
    return res.status(400).json({ error: 'Missing stream_key' });
  }

  const db = getDbAdmin()!;

  const logEntry = (kind: string, category: string | null, severity: string | null, action_taken: string, details: Record<string, unknown>) => {
    return db.from('live_moderation_log').insert({
      stream_key: streamKey,
      user_id: userId,
      kind,
      category,
      severity,
      action_taken,
      details,
    });
  };

  // No image: log check only, no flag
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    await logEntry('check', null, null, 'none', { note: 'no_image' });
    return res.json({ action: 'none' });
  }

  const result = await classifyImageWithAI(imageBase64);

  if (!result.flagged) {
    await logEntry('check', null, null, 'none', { note: 'ai_no_flag' });
    return res.json({ action: 'none' });
  }

  const category = result.category ?? 'unspecified';
  const severity = (result.severity ?? 'medium') as Severity;

  // Count recent flags (warning/pause/suspend) for this user in the last 24h
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { data: recentRows } = await db
    .from('live_moderation_log')
    .select('id')
    .eq('user_id', userId)
    .in('kind', ['flag', 'warning', 'pause', 'suspend'])
    .gte('created_at', since);

  const recentCount = recentRows?.length ?? 0;
  const isCritical = severity === 'critical';
  const shouldSuspend = isCritical || recentCount >= 2;

  if (shouldSuspend) {
    await logEntry('flag', category, severity, 'suspend', { recent_count: recentCount, reason: isCritical ? 'critical' : 'repeated' });
    await db.rpc('freeze_account_moderation', {
      p_user_id: userId,
      p_reason: `Live moderation: ${category} (${severity})`,
    });
    return res.json({ action: 'suspend', message: SUSPEND_MESSAGE });
  }

  if (recentCount >= 1) {
    await logEntry('flag', category, severity, 'pause', { recent_count: recentCount });
    return res.json({ action: 'pause', message: PAUSE_MESSAGE });
  }

  await logEntry('warning', category, severity, 'warning', {});
  return res.json({ action: 'warning', message: WARNING_MESSAGE });
}
