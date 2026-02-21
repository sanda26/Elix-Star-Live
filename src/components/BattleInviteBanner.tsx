import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sword, Crown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { showToast } from '../lib/toast';

interface PendingInvite {
  notifId: string;
  hostName: string;
  hostAvatar: string;
  streamKey: string;
  hostUserId: string;
  type: 'battle' | 'cohost';
}

export function BattleInviteBanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore(s => s.user);
  const [pendingInvite, setPendingInvite] = useState<PendingInvite | null>(null);

  const isOnLiveStream = location.pathname.startsWith('/live/') && location.pathname !== '/live';

  useEffect(() => {
    if (!user?.id) return;

    const chan = supabase
      .channel(`global_battle_invite_${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          const row = payload.new;
          if (row?.type === 'battle_invite' && !isOnLiveStream) {
            setPendingInvite({
              notifId: row.id,
              hostName: row.data?.host_name || 'Someone',
              hostAvatar: row.data?.host_avatar || '',
              streamKey: row.data?.stream_key || '',
              hostUserId: row.data?.actor_id || '',
              type: 'battle',
            });
          }
          if (row?.type === 'cohost_invite' && !isOnLiveStream) {
            setPendingInvite({
              notifId: row.id,
              hostName: row.data?.host_name || 'Someone',
              hostAvatar: row.data?.host_avatar || '',
              streamKey: row.data?.stream_key || '',
              hostUserId: row.data?.actor_id || '',
              type: 'cohost',
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(chan); };
  }, [user?.id, isOnLiveStream]);

  const acceptInvite = () => {
    if (!pendingInvite || !user?.id) return;
    const invite = pendingInvite;
    setPendingInvite(null);

    if (!invite.streamKey) {
      showToast('Invalid invite — missing stream key');
      return;
    }

    const myUsername = user?.username || user?.name || 'User';

    try {
      supabase.from('notifications').update({ is_read: true }).eq('id', invite.notifId).then(() => {});

      const acceptType = invite.type === 'cohost' ? 'cohost_accepted' : 'battle_accepted';
      const acceptTitle = invite.type === 'cohost' ? 'Co-Host Accepted' : 'Battle Accepted';
      const acceptBody = invite.type === 'cohost'
        ? `@${myUsername} accepted your co-host invite!`
        : `@${myUsername} accepted your battle invite!`;

      supabase.from('notifications').insert({
        user_id: invite.hostUserId,
        type: acceptType,
        title: acceptTitle,
        body: acceptBody,
        data: {
          actor_id: user.id,
          accepted_name: myUsername,
          accepted_avatar: '',
          stream_key: invite.streamKey,
        },
      }).then(() => {});
    } catch { /* fire-and-forget */ }

    showToast(`Joining @${invite.hostName}'s stream...`);
    window.location.href = `/live/${invite.streamKey}`;
  };

  const declineInvite = async () => {
    if (!pendingInvite) return;
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', pendingInvite.notifId);
    } catch { /* ignore */ }
    setPendingInvite(null);
  };

  if (!pendingInvite || isOnLiveStream) return null;

  const isBattle = pendingInvite.type === 'battle';

  return (
    <div className="fixed top-[calc(env(safe-area-inset-top,0px)+12px)] left-3 right-3 z-[9999] max-w-[480px] mx-auto animate-in slide-in-from-top">
      <div className="bg-[#1C1E24]/95 backdrop-blur-md rounded-2xl border border-[#C9A96E]/30 shadow-2xl shadow-black/50 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full border-2 border-[#C9A96E]/50 overflow-hidden bg-[#13151A] flex-shrink-0">
            {pendingInvite.hostAvatar ? (
              <img src={pendingInvite.hostAvatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#C9A96E] font-bold text-lg">
                {pendingInvite.hostName.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm">{isBattle ? 'Battle Invite' : 'Co-Host Invite'}</p>
            <p className="text-white/60 text-xs truncate">
              <span className="text-[#C9A96E]">@{pendingInvite.hostName}</span> {isBattle ? 'wants to battle you!' : 'wants you to co-host!'}
            </p>
          </div>
          <div className={`w-8 h-8 rounded-full ${isBattle ? 'bg-red-500/20' : 'bg-[#C9A96E]/20'} flex items-center justify-center flex-shrink-0`}>
            {isBattle ? (
              <Sword className="w-4 h-4 text-red-400" />
            ) : (
              <Crown className="w-4 h-4 text-[#C9A96E]" />
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={declineInvite}
            className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-xs font-bold active:scale-95 transition-all"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={acceptInvite}
            className="flex-1 py-2.5 rounded-xl bg-[#C9A96E] text-black text-xs font-bold active:scale-95 transition-all shadow-lg shadow-[#C9A96E]/20"
          >
            Accept & Join
          </button>
        </div>
      </div>
    </div>
  );
}
