-- BATTLE SYSTEM SCHEMA
-- Run this in Supabase Dashboard -> SQL Editor

-- 1. BATTLE SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.battle_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text DEFAULT 'pending', -- pending, active, ended
  winner_id uuid REFERENCES auth.users(id),
  duration_seconds integer DEFAULT 300,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.battle_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view battles" ON public.battle_sessions FOR SELECT USING (true);
CREATE POLICY "Users can create battles" ON public.battle_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Users can update own battles" ON public.battle_sessions FOR UPDATE TO authenticated USING (auth.uid() = host_id OR auth.uid() IN (SELECT user_id FROM public.battle_participants WHERE battle_id = id));

-- 2. BATTLE PARTICIPANTS TABLE
CREATE TABLE IF NOT EXISTS public.battle_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id uuid NOT NULL REFERENCES public.battle_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'challenger', -- host, challenger
  score integer DEFAULT 0,
  status text DEFAULT 'invited', -- invited, accepted, declined, ready
  created_at timestamptz DEFAULT now(),
  UNIQUE(battle_id, user_id)
);

ALTER TABLE public.battle_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view participants" ON public.battle_participants FOR SELECT USING (true);
CREATE POLICY "Authenticated can join/leave" ON public.battle_participants FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. ENABLE REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_streams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_participants;
