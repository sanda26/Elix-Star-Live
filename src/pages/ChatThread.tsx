import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Send, ArrowLeft, Video } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { apiUrl } from '../lib/api';
import { LevelBadge } from '../components/LevelBadge';
import { initiateCall } from '../lib/callService';

interface Message {
  id: string;
  sender_id: string;
  text: string;
  created_at: string;
  read: boolean;
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
  const { user, session } = useAuthStore();
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
        const token = session?.access_token;
        const res = await fetch(apiUrl(`/api/chat/threads/${threadId}`), {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const body = (await res.json().catch(() => ({}))) as {
          otherUser?: {
            user_id: string;
            username: string;
            display_name: string | null;
            avatar_url: string | null;
            level?: number;
          };
        };
        const p = body.otherUser;
        if (p) {
          setOtherUser({
            user_id: p.user_id,
            username: p.display_name || p.username || 'User',
            avatar_url: p.avatar_url,
            level: p.level ?? 1,
          });
        }
      } catch {
        /* ignore */
      }
    };

    loadConversation();
  }, [threadId, user?.id, isSystemThread, session?.access_token]);

  // Load Messages & Subscribe
  useEffect(() => {
    if (!threadId || isSystemThread) return;

    const fetchMessages = async () => {
      try {
        const token = session?.access_token;
        const res = await fetch(apiUrl(`/api/chat/threads/${threadId}/messages`), {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const body = (await res.json().catch(() => ({}))) as { messages?: Message[] };
        if (body.messages) setMessages(body.messages);
      } catch {
        // Network error — keep empty messages
      } finally {
        setLoading(false);
        scrollToBottom();
      }
    };

    fetchMessages();

    // Realtime message subscription removed; thread will update on page reload.
    return () => {};
  }, [threadId, isSystemThread, session?.access_token]);

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

    const msgText = draft.trim();
    setDraft('');

    try {
        const token = session?.access_token;
        const res = await fetch(apiUrl(`/api/chat/threads/${threadId}/messages`), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({ text: msgText }),
        });
        if (!res.ok) throw new Error('send failed');
        const body = (await res.json().catch(() => ({}))) as { message?: Message };
        if (body.message) {
          setMessages((prev) => [...prev, body.message!]);
          scrollToBottom();
        }
    } catch {
        setDraft(msgText);
    }
  };

  // Render System/Placeholder Views
  if (isSystemThread) {
     return (
        <div className="bg-[#13151A] text-white p-4">
             <header className="flex items-center gap-4 mb-4">
                <button onClick={() => navigate('/inbox')}><ArrowLeft /></button>
                <h1 className="font-bold text-lg capitalize">{threadId}</h1>
             </header>
             <div className="text-center text-white/50 mt-20">
                 No {threadId} yet.
             </div>
        </div>
     );
  }

  return (
    <div className="bg-[#13151A] text-white flex justify-center px-2">
      <div className="w-full max-w-[480px] flex flex-col rounded-3xl overflow-hidden bg-[#13151A]">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#13151A]">
          <button onClick={() => navigate('/inbox')} className="p-1">
             <img src="/Icons/Gold power buton.png" alt="Back" className="w-5 h-5" />
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
              className="p-2 rounded-full bg-[#13151A] border border-[#C9A96E]/40 hover:bg-[#C9A96E]/10 transition-colors"
            >
              <Video className="w-5 h-5 text-white" />
            </button>
          )}
        </header>

        {/* Messages Area */}
        <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth"
        >
          {loading && <div className="text-center text-white/40 text-sm">Loading messages...</div>}
          
          {!loading && messages.length === 0 && (
              <div className="text-center text-white/40 text-sm mt-10">
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
                        ? 'bg-[#C9A96E] text-black rounded-tr-none'
                        : 'bg-[#222] text-white rounded-tl-none'
                    }`}
                >
                    {m.text}
                </div>
                </div>
            );
          })}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-[#13151A] border-t border-white/10 pb-safe">
            <form
                className="flex items-center gap-2 bg-[#222] rounded-full px-4 py-2"
                onSubmit={handleSend}
            >
                <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-sm text-white placeholder-white/40/40"
                    placeholder="Type a message..."
                />
                <button
                    type="submit"
                    disabled={!draft.trim()}
                    className="p-2 bg-[#C9A96E] rounded-full text-black disabled:opacity-50 disabled:bg-gray-600"
                >
                    <Send size={16} />
                </button>
            </form>
        </div>
      </div>
    </div>
  );
}