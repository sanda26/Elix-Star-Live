-- Allow participants to delete their chat thread (removes thread and messages via CASCADE)
DROP POLICY IF EXISTS "chat_threads_delete_own" ON chat_threads;
CREATE POLICY "chat_threads_delete_own" ON chat_threads FOR DELETE USING (auth.uid() = user1_id OR auth.uid() = user2_id);
