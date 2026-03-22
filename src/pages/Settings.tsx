import React from 'react';
import { nativeConfirm } from '../components/NativeDialog';
import { apiUrl } from '../lib/api';
import {
  ChevronRight,
  User,
  Lock,
  Bell,
  Shield,
  HelpCircle,
  LogOut,
  Moon,
  Globe,
  Heart,
  Video,
  Ban,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../lib/toast';
import { useAuthStore } from '../store/useAuthStore';

export default function Settings() {
  const navigate = useNavigate();
  const signOut = useAuthStore((s) => s.signOut);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleDeleteAccount = async () => {
    const confirmed = await nativeConfirm(
      'Are you sure you want to delete your account?',
      'Delete Account'
    );
    if (!confirmed) return;

    try {
      const session = useAuthStore.getState().session;
      const tkn = session?.access_token || '';
      const url = apiUrl('/api/auth/delete');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (tkn) headers['Authorization'] = `Bearer ${tkn}`;
      const response = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include',
      });

      if (response.ok) {
        await signOut();
        navigate('/login');
      } else {
        showToast('Failed to delete account.');
      }
    } catch {
      showToast('Something went wrong. Please try again.');
    }
  };

  const R = ({ ic, t, v, fn }: { ic?: React.ReactNode; t: string; v?: string; fn: () => void }) => (
    <button
      type="button"
      onClick={fn}
      className="w-full flex items-center gap-1.5 px-1 py-[3px] active:bg-white/5 text-left rounded-md"
    >
      {ic && <span className="text-[#C9A96E]/60 shrink-0 [&_svg]:size-[12px]">{ic}</span>}
      <span className="flex-1 text-[10px] leading-tight text-white/80">{t}</span>
      {v && <span className="text-[8px] text-white/35 tabular-nums">{v}</span>}
      <ChevronRight size={10} className="text-white/20 shrink-0" />
    </button>
  );

  const S = ({ t }: { t: string }) => (
    <p className="text-[7px] text-white/25 uppercase tracking-[0.12em] mt-1.5 mb-0 px-1 leading-none">{t}</p>
  );

  return (
    <div className="h-full min-h-0 flex flex-col bg-[#13151A] text-white w-full max-w-[480px] mx-auto">
      <div className="flex-shrink-0 px-3 pt-0.5 pb-1">
        <div className="flex items-center">
          <div className="w-4" />
          <span className="flex-1 text-center text-[12px] font-bold text-[#C9A96E]">Settings</span>
          <button type="button" className="p-0.5 rounded-md active:bg-white/10" onClick={() => navigate(-1)} aria-label="Back">
            <img src="/Icons/Gold power buton.png" alt="" className="w-4 h-4 opacity-70" />
          </button>
        </div>
      </div>

      {/* One-screen layout: fills space between top bar and bottom nav; scrolls only if needed */}
      <div
        className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-3
          pb-[max(1.25rem,calc(var(--safe-bottom)+12px))]"
      >
        <div className="flex flex-col gap-0 max-w-full">
          <S t="Account" />
          <R ic={<User size={12} />} t="Edit Profile" fn={() => navigate('/edit-profile')} />
          <R ic={<Lock size={12} />} t="Privacy" fn={() => navigate('/settings/safety')} />
          <R ic={<Shield size={12} />} t="Security" fn={() => navigate('/settings/safety')} />

          <S t="Preferences" />
          <R ic={<Bell size={12} />} t="Notifications" fn={() => navigate('/settings/safety')} />
          <R ic={<Moon size={12} />} t="Dark Mode" v="On" fn={() => showToast('Always on')} />
          <R ic={<Globe size={12} />} t="Language" v="EN" fn={() => showToast('English only')} />

          <S t="Content" />
          <R ic={<Video size={12} />} t="Video Quality" v="Auto" fn={() => showToast('Auto')} />
          <R ic={<Heart size={12} />} t="Liked Videos" fn={() => navigate('/profile?tab=liked')} />

          <S t="Safety" />
          <R ic={<Ban size={12} />} t="Blocked Accounts" fn={() => navigate('/settings/blocked')} />
          <R ic={<Shield size={12} />} t="Safety Center" fn={() => navigate('/settings/safety')} />

          <S t="Support" />
          <R ic={<HelpCircle size={12} />} t="Help & Support" fn={() => navigate('/support')} />

          <div className="grid grid-cols-3 gap-1 mt-0.5 px-0.5">
            <button
              type="button"
              onClick={() => navigate('/terms')}
              className="text-[9px] text-white/55 py-1 rounded-md active:bg-white/5 text-center leading-tight"
            >
              Terms
            </button>
            <button
              type="button"
              onClick={() => navigate('/privacy')}
              className="text-[9px] text-white/55 py-1 rounded-md active:bg-white/5 text-center leading-tight"
            >
              Privacy
            </button>
            <button
              type="button"
              onClick={() => navigate('/guidelines')}
              className="text-[9px] text-white/55 py-1 rounded-md active:bg-white/5 text-center leading-tight"
            >
              Guidelines
            </button>
          </div>

          <div className="mt-2 pt-1 flex items-center justify-center gap-5 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1 py-1 text-white/50 text-[10px] active:bg-white/5 px-2 rounded-md"
            >
              <LogOut size={11} /> Log Out
            </button>
            <button
              type="button"
              onClick={handleDeleteAccount}
              className="flex items-center gap-1 py-1 text-red-400/70 text-[10px] active:bg-red-500/10 px-2 rounded-md"
            >
              <Trash2 size={11} /> Delete
            </button>
          </div>
          <p className="text-center text-[8px] text-white/20 pt-1 pb-0.5">v1.0.0</p>
        </div>
      </div>
    </div>
  );
}
