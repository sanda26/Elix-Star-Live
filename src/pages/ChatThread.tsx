import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Send, ArrowLeft, Video } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { LevelBadge } from '../components/LevelBadge';
import { initiateCall } from '../lib/callService';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

interface Participant {
  user_id: string;
  username: string;
  avatar_url: string | null;
  level?: number;
}

export default function ChatThread() {
  const navigate = useNavigate();
  const { threadId } = useParams<{ threadId: string }>();
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [otherUser, setOtherUser] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isSystemThread = useMemo(() => {
    return ['new', 'followers', 'likes', 'comments', 'mentions'].includes(threadId || '');
  }, [threadId]);

  // Load Conversation & Participant
  useEffect(() => {
    if (!threadId || isSystemThread || !user?.id) return;

    const loadConversation = async () => {
      try {
        // 1. Get conversation to find other participant
        const { data: conv, error } = await supabase
          .from('conversations')
          .select('participant_1, participant_2')
          .eq('id', threadId)
          .single();
        
        if (error) throw error;

        const otherId = conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1;
        
        // 2. Get other user profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id, username, avatar_url, display_name, level')
          .eq('user_id', otherId)
          .single();
          
        if (profile) {
            setOtherUser({
                user_id: profile.user_id,
                username: profile.display_name || profile.username || 'User',
                avatar_url: profile.avatar_url,
                level: profile.level || 1
            });
        }
      } catch (err) {
        console.error('Error loading conversation details:', err);
      }
    };

    loadConversation();
  }, [threadId, user?.id, isSystemThread]);

  // Load Messages & Subscribe
  useEffect(() => {
    if (!threadId || isSystemThread) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', threadId)
        .order('created_at', { ascending: true });
      
      if (data) setMessages(data);
      setLoading(false);
      scrollToBottom();
    };

    fetchMessages();

    // Realtime subscription
    const channel = supabase
      .channel(`chat:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${threadId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, isSystemThread]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 100);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !user?.id || !threadId) return;

    const text = draft.trim();
    setDraft(''); // Optimistic clear

    try {
        // Optimistic update (optional, but Realtime is usually fast enough)
        // const tempId = Date.now().toString();
        // setMessages(prev => [...prev, { id: tempId, sender_id: user.id, content: text, created_at: new Date().toISOString(), is_read: false }]);

        const { error } = await supabase.from('messages').insert({
            conversation_id: threadId,
            sender_id: user.id,
            content: text
        });

        if (error) throw error;

        // Update conversation last_message
        await supabase
            .from('conversations')
            .update({
                last_message: text,
                last_message_at: new Date().toISOString()
            })
            .eq('id', threadId);

    } catch (err) {
        console.error('Failed to send message:', err);
        setDraft(text); // Restore draft on error
    }
  };

  // Render System/Placeholder Views
  if (isSystemThread) {
     return (
        <div className="min-h-[100dvh] bg-[#121212] text-[#00f2ea] p-4">
             <header className="flex items-center gap-4 mb-4">
                <button onClick={() => navigate('/inbox')}><ArrowLeft /></button>
                <h1 className="font-bold text-lg capitalize">{threadId}</h1>
             </header>
             <div className="text-center text-[#00f2ea]/50 mt-20">
                 No {threadId} yet.
             </div>
        </div>
     );
  }

  return (
    <div className="min-h-[100dvh] bg-[#121212] text-[#00f2ea] flex justify-center px-2">
      <div className="w-full max-w-[480px] flex flex-col h-[100dvh] rounded-3xl overflow-hidden bg-[#121212] pt-[var(--safe-top)] pb-[calc(var(--safe-bottom)+12mm)]">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#121212]">
          <button onClick={() => navigate('/inbox')} className="p-1">
             <img src="/Icons/power-button.png" alt="Back" className="w-5 h-5" />
          </button>
          
          {otherUser ? (
              <div className="flex items-center gap-3 flex-1">
                  <div className="flex-shrink-0">
                      <LevelBadge 
                        level={otherUser.level || 1} 
                        avatar={otherUser.avatar_url || ''} 
                        size={36} 
                        layout="fixed" 
                      />
                  </div>
                  <span className="font-bold text-sm">{otherUser.username}</span>
              </div>
          ) : (
              <span className="font-bold text-lg flex-1">Chat</span>
          )}
          {otherUser && (
            <button
              onClick={async () => {
                const callId = await initiateCall({
                  id: otherUser.user_id,
                  username: otherUser.username,
                  avatar: otherUser.avatar_url || '',
                });
                if (callId) navigate('/call');
              }}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <Video className="w-5 h-5 text-[#00f2ea]" />
            </button>
          )}
        </header>

        {/* Messages Area */}
        <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth"
        >
          {loading && <div className="text-center text-[#00f2ea]/40 text-sm">Loading messages...</div>}
          
          {!loading && messages.length === 0 && (
              <div className="text-center text-[#00f2ea]/40 text-sm mt-10">
                  Start the conversation!
              </div>
          )}

          {messages.map((m) => {
            const isMe = m.sender_id === user?.id;
            return (
                <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-snug break-words ${
                    isMe
                        ? 'bg-[#00f2ea] text-black rounded-tr-none'
                        : 'bg-[#222] text-[#00f2ea] rounded-tl-none'
                    }`}
                >
                    {m.content}
                </div>
                </div>
            );
          })}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-[#121212] border-t border-white/10 pb-safe">
            <form
                className="flex items-center gap-2 bg-[#222] rounded-full px-4 py-2"
                onSubmit={handleSend}
            >
                <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-sm text-[#00f2ea] placeholder-[#00f2ea]/40"
                    placeholder="Type a message..."
                />
                <button
                    type="submit"
                    disabled={!draft.trim()}
                    className="p-2 bg-[#00f2ea] rounded-full text-black disabled:opacity-50 disabled:bg-gray-600"
                >
                    <Send size={16} />
                </button>
            </form>
        </div>
      </div>
    </div>
  );
}