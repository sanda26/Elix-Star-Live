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
  const [toast, setToast] = React.useState('');
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2000); };
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
      const body = await response.text();

      if (response.ok) {
        await signOut();
        navigate('/login');
      } else {
        showToast('Failed to delete account.');
      }
    } catch (err: any) {
      showToast('Something went wrong. Please try again.');
    }
  };

  const R = ({ ic, t, v, fn }: { ic?: React.ReactNode; t: string; v?: string; fn: () => void }) => (
    <button onClick={fn} className="w-full flex items-center gap-1.5 px-1 py-[5px] active:bg-white/5 text-left">
      {ic && <span className="text-[#C9A96E]/60 shrink-0">{ic}</span>}
      <span className="flex-1 text-[11px] text-white/80">{t}</span>
      {v && <span className="text-[9px] text-white/35">{v}</span>}
      <ChevronRight size={10} className="text-white/20 shrink-0" />
    </button>
  );
  const S = ({ t }: { t: string }) => <p className="text-[8px] text-white/25 uppercase tracking-[0.15em] mt-2 mb-0 px-1">{t}</p>;

  return (
    <div className="bg-[#13151A] text-white min-h-screen flex flex-col items-center pb-[40px]">
      {toast && <div className="fixed top-10 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur text-white text-[10px] px-3 py-1 rounded-lg z-[9999]">{toast}</div>}

      <div className="w-full max-w-[480px] px-3">
        <div className="py-2 flex items-center">
          <div className="w-4" />
          <span className="flex-1 text-center text-[12px] font-bold text-[#C9A96E]">Settings</span>
          <img
            src="/Icons/Gold power buton.png"
            alt=""
            className="w-4 h-4 opacity-70 cursor-pointer"
            onClick={() => navigate(-1)}
          />
        </div>

        <S t="Account" />
        <R ic={<User size={13} />} t="Edit Profile" fn={() => navigate('/edit-profile')} />
        <R ic={<Lock size={13} />} t="Privacy" fn={() => navigate('/settings/safety')} />
        <R ic={<Shield size={13} />} t="Security" fn={() => navigate('/settings/safety')} />
        <S t="Preferences" />
        <R ic={<Bell size={13} />} t="Notifications" fn={() => navigate('/settings/safety')} />
        <R ic={<Moon size={13} />} t="Dark Mode" v="On" fn={() => showToast('Always on')} />
        <R ic={<Globe size={13} />} t="Language" v="EN" fn={() => showToast('English only')} />
        <S t="Content" />
        <R ic={<Video size={13} />} t="Video Quality" v="Auto" fn={() => showToast('Auto')} />
        <R ic={<Heart size={13} />} t="Liked Videos" fn={() => navigate('/profile?tab=liked')} />
        <S t="Safety" />
        <R ic={<Ban size={13} />} t="Blocked Accounts" fn={() => navigate('/settings/blocked')} />
        <R ic={<Shield size={13} />} t="Safety Center" fn={() => navigate('/settings/safety')} />
        <S t="Support" />
        <R ic={<HelpCircle size={13} />} t="Help & Support" fn={() => navigate('/support')} />
        <R t="Terms" fn={() => navigate('/terms')} />
        <R t="Privacy Policy" fn={() => navigate('/privacy')} />
        <R t="Guidelines" fn={() => navigate('/guidelines')} />

        <div className="mt-2 flex items-center justify-center gap-4">
          <button onClick={handleLogout} className="flex items-center gap-1 py-1 text-white/50 text-[10px] active:bg-white/5 px-3 rounded">
            <LogOut size={11} /> Log Out
          </button>
          <button onClick={handleDeleteAccount} className="flex items-center gap-1 py-1 text-red-400/70 text-[10px] active:bg-red-500/10 px-3 rounded">
            <Trash2 size={11} /> Delete
          </button>
        </div>
        <p className="text-center text-[8px] text-white/20 mt-1">v1.0.0</p>
      </div>
    </div>
  );
}
