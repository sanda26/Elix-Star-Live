-- Chat System Schema (Idempotent Version) 
 -- Run this in Supabase Dashboard -> SQL Editor 
 
 -- 1. Conversations Table 
 CREATE TABLE IF NOT EXISTS public.conversations ( 
   id uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
   participant_1 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, 
   participant_2 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, 
   last_message text, 
   last_message_at timestamptz DEFAULT now(), 
   created_at timestamptz DEFAULT now(), 
   CONSTRAINT unique_participants UNIQUE (participant_1, participant_2) 
 ); 
 
 ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY; 
 
 -- Drop existing policies to avoid "already exists" errors 
 DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations; 
 DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations; 
 DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations; 
 
 CREATE POLICY "Users can view own conversations" ON public.conversations 
   FOR SELECT USING (auth.uid() = participant_1 OR auth.uid() = participant_2); 
 
 CREATE POLICY "Users can create conversations" ON public.conversations 
   FOR INSERT WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2); 
 
 CREATE POLICY "Users can update own conversations" ON public.conversations 
   FOR UPDATE USING (auth.uid() = participant_1 OR auth.uid() = participant_2); 
 
 -- 2. Messages Table 
 CREATE TABLE IF NOT EXISTS public.messages ( 
   id uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
   conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE, 
   sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, 
   content text NOT NULL, 
   is_read boolean DEFAULT false, 
   created_at timestamptz DEFAULT now() 
 ); 
 
 ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY; 
 
 DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages; 
 DROP POLICY IF EXISTS "Users can send messages" ON public.messages; 
 
 CREATE POLICY "Users can view messages in their conversations" ON public.messages 
   FOR SELECT USING ( 
     EXISTS ( 
       SELECT 1 FROM public.conversations 
       WHERE id = messages.conversation_id 
       AND (participant_1 = auth.uid() OR participant_2 = auth.uid()) 
     ) 
   ); 
 
 CREATE POLICY "Users can send messages" ON public.messages 
   FOR INSERT WITH CHECK (auth.uid() = sender_id); 
 
 -- 3. Indexes for performance 
 CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON public.messages(conversation_id); 
 CREATE INDEX IF NOT EXISTS conversations_p1_idx ON public.conversations(participant_1); 
 CREATE INDEX IF NOT EXISTS conversations_p2_idx ON public.conversations(participant_2); 
 
 -- 4. Enable Realtime (safely) 
 DO $$ 
 BEGIN 
   IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages') THEN 
     ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; 
   END IF; 
   
   IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'conversations') THEN 
     ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations; 
   END IF; 
 END $$;