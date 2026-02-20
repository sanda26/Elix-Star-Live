import React, { useEffect, useState } from 'react';
import { AlertTriangle, Flag, Ban, EyeOff, MessageSquare, UserMinus } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useVideoStore } from '../store/useVideoStore';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/toast';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string;
  contentType: 'video' | 'comment' | 'user' | 'live';
  contentId?: string;
}

const reportReasons = [
  {
    id: 'spam',
    title: 'Spam or misleading',
    description: 'Promotes scams, fake engagement, or misleading content',
    icon: AlertTriangle,
    color: 'text-white'
  },
  {
    id: 'hate',
    title: 'Hate speech or symbols',
    description: 'Promotes hatred or violence against individuals or groups',
    icon: Ban,
    color: 'text-red-400'
  },
  {
    id: 'harassment',
    title: 'Harassment or bullying',
    description: 'Targets individuals with repeated unwanted contact or abuse',
    icon: MessageSquare,
    color: 'text-white'
  },
  {
    id: 'violence',
    title: 'Violent or dangerous acts',
    description: 'Promotes or glorifies violence, self-harm, or dangerous activities',
    icon: AlertTriangle,
    color: 'text-red-500'
  },
  {
    id: 'nudity',
    title: 'Nudity or sexual content',
    description: 'Contains explicit sexual content or nudity',
    icon: EyeOff,
    color: 'text-white'
  },
  {
    id: 'copyright',
    title: 'Copyright infringement',
    description: 'Uses copyrighted material without permission',
    icon: Flag,
    color: 'text-white'
  },
  {
    id: 'impersonation',
    title: 'Impersonation',
    description: 'Pretends to be someone else or misrepresents identity',
    icon: UserMinus,
    color: 'text-indigo-400'
  },
  {
    id: 'other',
    title: 'Other issue',
    description: 'Something else that violates community guidelines',
    icon: Flag,
    color: 'text-white'
  }
];

export default function ReportModal({ isOpen, onClose, videoId, contentType, contentId }: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isDeletingVideo, setIsDeletingVideo] = useState(false);
  const [videoOwnerIdFromDb, setVideoOwnerIdFromDb] = useState<string | null>(null);
  const authToken = useAuthStore((s) => s.session?.access_token ?? null);
  const authUserId = useAuthStore((s) => s.user?.id ?? null);
  const videoOwnerId = useVideoStore((s) => s.videos.find((v) => v.id === videoId)?.user.id ?? null);
  const deleteVideo = useVideoStore((s) => s.deleteVideo);

  useEffect(() => {
    let cancelled = false;
    if (!isOpen || contentType !== 'video') return;
    setVideoOwnerIdFromDb(null);
    void (async () => {
    try {
      const { data } = await supabase
        .from('videos')
        .select('user_id')
        .eq('id', videoId)
        .single();
      if (cancelled) return;
      setVideoOwnerIdFromDb(data?.user_id ?? null);
    } catch {
    }
  })();return () => {
      cancelled = true;
    };
  }, [contentType, isOpen, videoId]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!selectedReason) {
      showToast('Please select a reason for reporting');
      return;
    }
    if (!authToken) {
      showToast('Please sign in to submit a report.');
      return;
    }

    setIsSubmitting(true);

    try {
      const targetId = (contentType === 'video' ? videoId : contentId || videoId).trim();
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          targetType: contentType,
          targetId,
          reason: selectedReason,
          details: additionalDetails,
          contextVideoId: videoId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = data?.error || 'Failed to submit report. Please try again.';
        throw new Error(message);
      }

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
        // Reset form
        setSelectedReason('');
        setAdditionalDetails('');
      }, 2000);
    } catch (error) {

      showToast('Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resolvedOwnerId = videoOwnerIdFromDb ?? videoOwnerId;
  const canDeleteDemo = false;
  const canDeleteOwned = contentType === 'video' && !!authUserId && !!resolvedOwnerId && authUserId === resolvedOwnerId;
  const canDelete = canDeleteDemo || canDeleteOwned;

  const handleDelete = async () => {
    if (!canDelete) return;
    if (isDeletingVideo) return;
    setIsDeletingVideo(true);
    try {
      await deleteVideo(videoId);
      onClose();
      setSelectedReason('');
      setAdditionalDetails('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete video.';
      showToast(message);
    } finally {
      setIsDeletingVideo(false);
    }
  };

  const getContentTypeLabel = () => {
    switch (contentType) {
      case 'video': return 'video';
      case 'comment': return 'comment';
      case 'user': return 'user';
      case 'live': return 'live stream';
      default: return 'content';
    }
  };

  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-modals bg-[#13151A] flex items-center justify-center p-4">
        <div className="bg-[#13151A] rounded-2xl p-6 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-[#C9A96E]/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 bg-[#C9A96E] rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h3 className="text-white font-semibold mb-2">Report Submitted</h3>
          <p className="text-white/60 text-sm">
            Thank you for helping keep our community safe. We'll review your report and take appropriate action.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-modals flex flex-col justify-end">
      <div className="absolute inset-0 bg-[#13151A] pointer-events-auto" onClick={onClose} />

      <div className="relative w-full z-10 bg-[#1C1E24] rounded-t-2xl p-4 pb-safe flex flex-col gap-1 shadow-2xl border-t border-white/10 pointer-events-auto h-[40dvh] max-h-[40dvh] overflow-y-auto no-scrollbar">
        <div className="flex justify-center mb-2">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Flag className="w-4 h-4 text-white" />
            <h3 className="text-white font-bold whitespace-nowrap">Report {getContentTypeLabel()}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-white/70 hover:text-white text-sm font-semibold">
            Close
          </button>
        </div>

        {contentType === 'video' && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeletingVideo || !canDelete}
            className="w-full px-4 py-3 flex items-center justify-between text-[#EF4444] hover:brightness-125 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5" strokeWidth={2} />
              <span className="font-semibold">
                {isDeletingVideo
                  ? 'Delete (deleting...)'
                  : !authUserId
                    ? 'Delete (sign in)'
                    : canDelete
                      ? 'Delete'
                      : 'Delete (owner)'}
              </span>
            </div>
          </button>
        )}

        <div className="mt-1 px-1">
          <div className="text-white text-sm font-semibold mb-1">Why are you reporting this {getContentTypeLabel()}?</div>
          <div className="text-white/40 text-xs leading-snug">
            Your report helps us understand what violates our community guidelines.
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-1">
          {reportReasons.map((reason) => {
            const IconComponent = reason.icon;
            const selected = selectedReason === reason.id;
            return (
              <button
                key={reason.id}
                type="button"
                onClick={() => setSelectedReason(reason.id)}
                className={`w-full px-4 py-3 flex items-center justify-between border rounded-xl transition-colors ${selected ? 'border-[#C9A96E]/60 bg-white/5' : 'border-white/10 hover:bg-white/5'}`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 ${reason.color}`}>
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 text-left">
                    <div className="text-white/90 text-sm font-semibold truncate">{reason.title}</div>
                    <div className="text-white/40 text-xs leading-snug">{reason.description}</div>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${selected ? 'border-[#C9A96E] bg-[#C9A96E]' : 'border-white/30'}`}>
                  {selected && (
                    <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-3">
          <label className="text-white text-xs font-semibold mb-1 block">Additional details (optional)</label>
          <textarea
            value={additionalDetails}
            onChange={(e) => setAdditionalDetails(e.target.value)}
            placeholder="Provide more context..."
            className="w-full bg-[#13151A]/40 border border-white/10 text-white rounded-xl p-3 text-sm focus:outline-none focus:border-white/20 resize-none leading-snug"
            rows={3}
            maxLength={500}
          />
          <div className="text-right text-white/40 text-xs mt-1">
            {additionalDetails.length}/500
          </div>
        </div>

        <div className="mt-2 bg-white/5 rounded-xl p-3 border border-white/10">
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 bg-[#C9A96E]/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <div className="w-2 h-2 bg-[#C9A96E] rounded-full" />
            </div>
            <div className="text-white/60 text-xs leading-snug">
              <span className="text-white font-semibold">Your privacy matters.</span> The person you're reporting won't know who reported them.
            </div>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/15 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedReason}
            className="flex-1 py-3 bg-[#C9A96E] text-black font-extrabold rounded-xl hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>
  );
}
