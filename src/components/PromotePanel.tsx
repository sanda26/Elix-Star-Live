import React, { useState } from 'react';
import { TrendingUp, Play, UserPlus, FileText, Heart, Info, X } from 'lucide-react';
import { showToast } from '../lib/toast';
import { useAuthStore } from '../store/useAuthStore';
import { isStripeAllowed } from '../lib/platform';

export type PromoteContentType = 'video' | 'profile' | 'live';

interface PromotePanelProps {
  isOpen: boolean;
  onClose: () => void;
  contentType: PromoteContentType;
  content?: {
    id?: string;
    title?: string;
    description?: string;
    thumbnail?: string;
    username?: string;
    avatar?: string;
    postedAt?: string;
  };
}

const goals = [
  { id: 'likes', label: 'More likes & comments', icon: Heart, badge: 'New' },
  { id: 'views', label: 'More video views', icon: Play },
  { id: 'followers', label: 'More followers', icon: UserPlus },
  { id: 'profile', label: 'More profile views', icon: FileText },
];

export default function PromotePanel({ isOpen, onClose, contentType, content }: PromotePanelProps) {
  const user = useAuthStore((s) => s.user);
  const session = useAuthStore((s) => s.session);
  const [boostType, setBoostType] = useState<'account' | 'live'>(
    contentType === 'live' ? 'live' : 'account'
  );
  const [selectedGoal, setSelectedGoal] = useState('likes');
  const [audience, setAudience] = useState<'default'>('default');
  const [isPaying, setIsPaying] = useState(false);

  if (!isOpen) return null;

  const fmt = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
  const priceByGoal: Record<string, string> = {
    likes: fmt(10),
    views: fmt(5),
    followers: fmt(30),
    profile: fmt(20),
  };
  const priceDisplay = priceByGoal[selectedGoal] || '£5 - £10';
  const estimates: Record<string, string> = {
    likes: '10 - 10K',
    views: '5K - 500K',
    followers: '5K',
    profile: '300 - 30K',
  };

  const handlePay = async () => {
    if (!isStripeAllowed()) {
      showToast('Promote is available on web. Coming soon to app stores.');
      return;
    }
    if (!user?.id) {
      showToast('Please sign in to promote');
      return;
    }
    setIsPaying(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiBase}/api/create-promote-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          userId: user.id,
          contentType,
          contentId: content?.id ?? '',
          goal: selectedGoal,
        }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        onClose();
        window.location.href = data.url;
        return;
      }
      showToast(data.error || 'Failed to start checkout. Please try again.');
    } catch {
      showToast('Failed to start checkout. Please try again.');
    } finally {
      setIsPaying(false);
    }
  };

  const previewTitle = content?.title || content?.description || `#${content?.username || 'content'}`;
  const postedText = content?.postedAt ? `Posted on ${content.postedAt}` : 'Posted recently';

  return (
    <div className="fixed inset-0 z-[100000] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-[480px] bg-[#1C1E24]/95 backdrop-blur-md rounded-t-2xl h-[38vh] max-h-[320px] overflow-hidden flex flex-col border-t border-[#C9A96E]/20 shadow-2xl mb-[90px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - compact */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 flex-shrink-0">
          <button onClick={onClose} className="p-1 -ml-1" title="Close" aria-label="Close">
            <X size={20} className="text-white/80" />
          </button>
          <h2 className="text-white font-bold text-sm">Promote</h2>
          <div className="w-6" />
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 min-h-0 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-[#C9A96E]/50 [&::-webkit-scrollbar-thumb]:rounded-full">
          {/* Goal buttons + selected goal row */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setBoostType('account')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                boostType === 'account' ? 'bg-[#C9A96E] text-black' : 'bg-white/5 text-white/70'
              }`}
            >
              Boost account
            </button>
            {contentType === 'live' && (
              <button
                type="button"
                onClick={() => setBoostType('live')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  boostType === 'live' ? 'bg-[#C9A96E] text-black' : 'bg-white/5 text-white/70'
                }`}
              >
                Boost LIVE
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {goals.map((g) => (
              <label
                key={g.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                  selectedGoal === g.id ? 'bg-[#C9A96E]/20 border border-[#C9A96E]/40' : 'bg-white/5'
                }`}
              >
                <input type="radio" name="goal" checked={selectedGoal === g.id} onChange={() => setSelectedGoal(g.id)} className="sr-only" />
                <g.icon size={16} className="text-[#C9A96E] flex-shrink-0" />
                <span className="text-white text-xs font-medium flex-1 truncate">{g.label}</span>
                {g.badge && <span className="text-[8px] font-bold text-[#C9A96E] bg-[#C9A96E]/20 px-1.5 py-0.5 rounded">New</span>}
              </label>
            ))}
          </div>

          {/* Content preview - compact */}
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/5">
            <div className="w-9 h-9 rounded-lg overflow-hidden bg-[#13151A] flex-shrink-0">
              {content?.thumbnail ? (
                <img src={content.thumbnail} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Play size={14} className="text-white/40" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{previewTitle}</p>
              <p className="text-white/50 text-[10px]">{postedText}</p>
            </div>
          </div>

          {/* Estimates + audience - compact */}
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[#C9A96E] text-lg font-bold">{estimates[selectedGoal] || estimates.likes}</p>
              <p className="text-white/50 text-[10px]">
                {selectedGoal === 'likes' && 'likes & comments'}
                {selectedGoal === 'views' && 'video views'}
                {selectedGoal === 'followers' && 'followers'}
                {selectedGoal === 'profile' && 'profile views'}
              </p>
            </div>
            <label className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/5 cursor-pointer shrink-0">
              <span className="text-white text-[10px]">Default audience</span>
              <input type="radio" name="audience" checked={audience === 'default'} onChange={() => setAudience('default')} className="w-4 h-4 accent-[#C9A96E]" />
            </label>
          </div>
        </div>

        {/* Bottom payment bar - compact */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-white/10 bg-[#13151A] flex-shrink-0">
          <div>
            <p className="text-white font-bold text-base">{priceDisplay}</p>
            <button type="button" className="text-white/50 text-[10px] underline">See price details</button>
          </div>
          <button
            type="button"
            onClick={handlePay}
            disabled={isPaying}
            className="px-5 py-2 rounded-lg bg-[#C9A96E] text-black font-bold text-xs hover:bg-[#C9A96E]/90 active:scale-95 transition-all disabled:opacity-70"
          >
            {isPaying ? '...' : 'Pay'}
          </button>
        </div>
      </div>
    </div>
  );
}
