import React, { useState, useEffect } from 'react';
import { 
  Link, 
  Download, 
  MessageCircle,
  Share2,
  Check,
  QrCode,
  Code,
  Copy,
  Search,
  Send,
  TrendingUp,
  Flag,
  PlusCircle,
  X,
} from 'lucide-react';
import { showToast } from '../lib/toast';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { AvatarRing } from './AvatarRing';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: {
    id: string;
    url: string;
    thumbnail?: string;
    description: string;
    user: {
      username: string;
    };
    stats: {
      likes: number;
      comments: number;
    };
  };
}

export default function ShareModal({ isOpen, onClose, video }: ShareModalProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const { user } = useAuthStore();
  const [shareQuery, setShareQuery] = useState('');
  const [followers, setFollowers] = useState<{ user_id: string; username: string; avatar_url: string | null }[]>([]);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && user?.id) loadFollowers();
  }, [isOpen, user?.id]);

  const loadFollowers = async () => {
    if (!user?.id) return;
    try {
      const { data: followData } = await supabase.from('followers').select('follower_id').eq('following_id', user.id).limit(50);
      const { data: followingData } = await supabase.from('followers').select('following_id').eq('follower_id', user.id).limit(50);
      const ids = new Set<string>();
      (followData || []).forEach((f: any) => ids.add(f.follower_id));
      (followingData || []).forEach((f: any) => ids.add(f.following_id));
      ids.delete(user.id);
      if (ids.size === 0) { setFollowers([]); return; }
      const { data: profiles } = await supabase.from('profiles').select('user_id, username, avatar_url').in('user_id', Array.from(ids));
      setFollowers(profiles || []);
    } catch { setFollowers([]); }
  };

  const sendShareTo = async (targetUserId: string) => {
    if (!user?.id || sentTo.has(targetUserId)) return;
    const videoUrl = `${window.location.origin}/video/${video.id}`;
    const msgText = `Check out this video by @${video.user.username}: ${videoUrl}`;
    try {
      const { data: existing } = await supabase.from('chat_threads').select('id')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${targetUserId}),and(user1_id.eq.${targetUserId},user2_id.eq.${user.id})`)
        .limit(1).single();
      let threadId = existing?.id;
      if (!threadId) {
        const { data: newThread } = await supabase.from('chat_threads').insert({ user1_id: user.id, user2_id: targetUserId }).select('id').single();
        threadId = newThread?.id;
      }
      if (threadId) {
        await supabase.from('messages').insert({ thread_id: threadId, sender_id: user.id, text: msgText });
        await supabase.from('chat_threads').update({ last_message: msgText, last_at: new Date().toISOString() }).eq('id', threadId);
      }
      setSentTo(prev => new Set(prev).add(targetUserId));
    } catch {}
  };

  if (!isOpen) return null;

  const videoUrl = `${window.location.origin}/video/${video.id}`;
  const shareText = `Check out this amazing video by @${video.user.username}: ${video.description}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(videoUrl);
      setCopiedLink(true);
      showToast('Link copied!');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  const filteredFollowers = followers.filter(f => f.username?.toLowerCase().includes(shareQuery.toLowerCase()));

  const socialPlatforms = [
    { name: 'WhatsApp', color: '#25D366', icon: <MessageCircle size={22} className="text-white" />, action: () => window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + videoUrl)}`) },
    { name: 'Facebook', color: '#1877F2', icon: <Share2 size={22} className="text-white" />, action: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(videoUrl)}`) },
    { name: 'Twitter', color: '#1DA1F2', icon: <Share2 size={22} className="text-white" />, action: () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(videoUrl)}`) },
    { name: 'Copy Link', color: '#C9A96E', icon: copiedLink ? <Check size={22} className="text-white" /> : <Copy size={22} className="text-white" />, action: handleCopyLink },
    { name: 'Email', color: '#EA4335', icon: <Send size={22} className="text-white" />, action: () => window.open(`mailto:?subject=Check out this video&body=${encodeURIComponent(shareText + '\n\n' + videoUrl)}`) },
    { name: 'Messages', color: '#00C853', icon: <MessageCircle size={22} className="text-white" />, action: () => window.open(`sms:?body=${encodeURIComponent(shareText + ' ' + videoUrl)}`) },
  ];

  const actionItems = [
    { name: 'Promote', color: '#C9A96E', icon: <TrendingUp size={22} className="text-white" />, action: () => { if (navigator.share) navigator.share({ title: `Video by @${video.user.username}`, text: shareText, url: videoUrl }); } },
    { name: 'Report', color: '#EF4444', icon: <Flag size={22} className="text-white" />, action: () => {} },
    { name: 'Download', color: '#6B7280', icon: <Download size={22} className="text-white" />, action: () => { const a = document.createElement('a'); a.href = video.url; a.download = `video_${video.id}.mp4`; document.body.appendChild(a); a.click(); document.body.removeChild(a); } },
    { name: 'QR Code', color: '#8B5CF6', icon: <QrCode size={22} className="text-white" />, action: handleCopyLink },
  ];

  return (
    <div className="fixed inset-0 z-modals bg-black/60 flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-[#1C1E24]/95 w-full max-w-[480px] rounded-t-2xl overflow-hidden flex flex-col border-2 border-b-0 border-[#C9A96E] max-h-[40dvh]"
        style={{ marginBottom: '90px', boxShadow: '0 -4px 30px rgba(201,169,110,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        <div className="flex items-center justify-between gap-2 px-4 pb-2">
          <h3 className="text-gold-metallic font-bold text-sm">Share to</h3>
          <div className="flex-none w-[120px] bg-white/5 rounded-lg px-2 py-1.5 flex items-center gap-2 border border-[#C9A96E]/20">
            <Search className="w-3.5 h-3.5 text-[#C9A96E]/40" />
            <input
              value={shareQuery}
              onChange={(e) => setShareQuery(e.target.value)}
              placeholder="Search..."
              className="bg-transparent text-white text-xs outline-none w-full placeholder:text-white/20"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 no-scrollbar">
          {/* Followers Row */}
          <div className="w-full overflow-hidden shrink-0 mb-3">
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar items-center">
              {filteredFollowers.length === 0 ? (
                <p className="text-white/30 text-xs px-1">No followers yet</p>
              ) : (
                filteredFollowers.map((f) => (
                  <button
                    key={f.user_id}
                    className="flex flex-col items-center gap-1 min-w-[56px] active:scale-95 transition-transform"
                    onClick={() => sendShareTo(f.user_id)}
                  >
                    <div className="relative">
                      <AvatarRing src={f.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(f.username || 'U')}&background=C9A96E&color=fff&size=128`} alt={f.username} size={48} />
                      {sentTo.has(f.user_id) ? (
                        <div className="absolute bottom-0 right-0 w-4 h-4 bg-[#C9A96E] rounded-full flex items-center justify-center border-2 border-[#1C1E24]">
                          <Check size={8} className="text-black" />
                        </div>
                      ) : (
                        <div className="absolute bottom-0 right-0 w-4 h-4 bg-[#FF2D55] rounded-full flex items-center justify-center border-2 border-[#1C1E24]">
                          <Send size={7} className="text-white" />
                        </div>
                      )}
                    </div>
                    <span className="text-white text-[9px] font-bold truncate max-w-[56px]">
                      {sentTo.has(f.user_id) ? 'Sent' : f.username || 'User'}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Social Row */}
          <div className="flex items-center gap-2 overflow-x-auto pb-3 no-scrollbar shrink-0">
            {socialPlatforms.map((item) => (
              <button
                key={item.name}
                onClick={() => { item.action(); }}
                className="flex flex-col items-center gap-1 min-w-[60px]"
              >
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: item.color }}>
                  {item.icon}
                </div>
                <span className="text-white/70 text-[10px]">{item.name}</span>
              </button>
            ))}
          </div>

          {/* Actions Row */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar shrink-0">
            {actionItems.map((item) => (
              <button
                key={item.name}
                onClick={() => { item.action(); }}
                className="flex flex-col items-center gap-1 min-w-[60px]"
              >
                <div className="w-12 h-12 rounded-full bg-[#13151A] flex items-center justify-center border border-[#C9A96E]/40">
                  {item.icon}
                </div>
                <span className="text-white/70 text-[10px]">{item.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
