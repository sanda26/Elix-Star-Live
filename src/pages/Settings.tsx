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
      'Are you sure you want to delete your account? This action is permanent and cannot be undone. All your data, videos, and coins will be lost.',
      'Delete Account'
    );
    if (!confirmed) return;

    const doubleConfirm = await nativeConfirm(
      'This is your last chance. Delete your account permanently?',
      'Final Confirmation'
    );
    if (!doubleConfirm) return;

    try {
      const session = useAuthStore.getState().session;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const response = await fetch(apiUrl('/api/auth/delete'), {
        method: 'POST',
        headers,
        credentials: 'include',
      });

      if (response.ok) {
        await signOut();
        navigate('/login');
      } else {
        showToast('Failed to delete account. Please contact support.');
      }
    } catch {
      showToast('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="bg-[#13151A] text-white min-h-screen pb-[100px]">
      {toast && <div className="fixed top-12 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-lg z-[9999] animate-pulse">{toast}</div>}

      <div className="sticky top-0 z-10 px-3 py-2 flex items-center gap-2 bg-[#13151A]">
        <button onClick={() => navigate(-1)} className="p-1" title="Back">
          <ChevronRight className="w-4 h-4 text-white/60 rotate-180" />
        </button>
        <h1 className="text-sm font-bold text-[#C9A96E]">Settings</h1>
      </div>

      <div className="px-2">
        <SectionLabel text="Account" />
        <Row icon={<User size={15} />} label="Edit Profile" onClick={() => navigate('/edit-profile')} />
        <Row icon={<Lock size={15} />} label="Privacy" onClick={() => navigate('/settings/safety')} />
        <Row icon={<Shield size={15} />} label="Security" onClick={() => navigate('/settings/safety')} />

        <SectionLabel text="Preferences" />
        <Row icon={<Bell size={15} />} label="Notifications" onClick={() => navigate('/settings/safety')} />
        <Row icon={<Moon size={15} />} label="Dark Mode" value="On" onClick={() => showToast('Dark mode is always on.')} />
        <Row icon={<Globe size={15} />} label="Language" value="EN" onClick={() => showToast('English only for now.')} />

        <SectionLabel text="Content" />
        <Row icon={<Video size={15} />} label="Video Quality" value="Auto" onClick={() => showToast('Auto quality based on connection.')} />
        <Row icon={<Heart size={15} />} label="Liked Videos" onClick={() => navigate('/profile?tab=liked')} />

        <SectionLabel text="Safety" />
        <Row icon={<Ban size={15} />} label="Blocked Accounts" onClick={() => navigate('/settings/blocked')} />
        <Row icon={<Shield size={15} />} label="Safety Center" onClick={() => navigate('/settings/safety')} />

        <SectionLabel text="Support" />
        <Row icon={<HelpCircle size={15} />} label="Help & Support" onClick={() => navigate('/support')} />
        <Row label="Terms of Service" onClick={() => navigate('/terms')} />
        <Row label="Privacy Policy" onClick={() => navigate('/privacy')} />
        <Row label="Guidelines" onClick={() => navigate('/guidelines')} />

        <div className="mt-4 space-y-1">
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-1.5 py-2 text-white/70 text-xs active:bg-white/5">
            <LogOut size={14} /> Log Out
          </button>
          <button onClick={handleDeleteAccount} className="w-full flex items-center justify-center gap-1.5 py-2 text-red-400 text-xs active:bg-red-500/10">
            <Trash2 size={14} /> Delete Account
          </button>
        </div>

        <div className="text-center text-[9px] text-white/30 pt-3 pb-2">v1.0.0</div>
      </div>
    </div>
  );
}

function SectionLabel({ text }: { text: string }) {
  return <p className="text-[9px] font-semibold text-white/30 uppercase tracking-widest mt-3 mb-0.5 px-1">{text}</p>;
}

function Row({ icon, label, value, onClick }: { icon?: React.ReactNode; label: string; value?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2 px-2 py-2 active:bg-white/5 text-left">
      {icon && <span className="text-[#C9A96E]/70 shrink-0">{icon}</span>}
      <span className="flex-1 text-xs text-white/90">{label}</span>
      {value && <span className="text-[10px] text-white/40">{value}</span>}
      <ChevronRight size={12} className="text-white/30 shrink-0" />
    </button>
  );
}
