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
    <div className="bg-[#13151A] text-white flex justify-center px-2">
      {toast && <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md text-white text-sm px-4 py-2 rounded-xl z-[9999] animate-pulse">{toast}</div>}
      <div className="w-full max-w-[420px] rounded-3xl overflow-hidden bg-[#13151A] flex flex-col shadow-[0_0_20px_rgba(0,0,0,0.7)]">
      {/* Header */}
      <div className="sticky top-0 z-10 px-3 py-3 flex items-center gap-2 bg-[#13151A]/98 backdrop-blur">
        <button onClick={() => navigate('/feed')} className="p-1 hover:brightness-125 transition" title="Back to For You">
          <img src="/Icons/Gold power buton.png" alt="Back" className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">Settings</h1>
      </div>

      <div className="px-3 py-4 space-y-4 flex-1 overflow-y-auto">
        {/* Account Section */}
        <Section title="Account">
          <SettingItem
            icon={<User className="w-5 h-5" />}
            label="Edit Profile"
            onClick={() => navigate('/edit-profile')}
          />
          <SettingItem
            icon={<Lock className="w-5 h-5" />}
            label="Privacy"
            onClick={() => navigate('/settings/safety')}
          />
          <SettingItem
            icon={<Shield className="w-5 h-5" />}
            label="Security"
            onClick={() => navigate('/settings/safety')}
          />
        </Section>

        {/* Preferences Section */}
        <Section title="Preferences">
          <SettingItem
            icon={<Bell className="w-5 h-5" />}
            label="Notifications"
            onClick={() => navigate('/settings/safety')}
          />
          <SettingItem
            icon={<Moon className="w-5 h-5" />}
            label="Dark Mode"
            value="Always On"
            onClick={() => showToast('Dark mode is always on. This app uses dark theme by default.')}
          />
          <SettingItem
            icon={<Globe className="w-5 h-5" />}
            label="Language"
            value="English"
            onClick={() => showToast('English is the only supported language for now.')}
          />
        </Section>

        {/* Content Section */}
        <Section title="Content">
          <SettingItem
            icon={<Video className="w-5 h-5" />}
            label="Video Quality"
            value="Auto"
            onClick={() => showToast('Video quality adjusts automatically based on your connection.')}
          />
          <SettingItem
            icon={<Heart className="w-5 h-5" />}
            label="Liked Videos"
            onClick={() => navigate('/profile?tab=liked')}
          />
        </Section>

        {/* Safety Section */}
        <Section title="Safety & Privacy">
          <SettingItem
            icon={<Ban className="w-5 h-5" />}
            label="Blocked Accounts"
            onClick={() => navigate('/settings/blocked')}
          />
          <SettingItem
            icon={<Shield className="w-5 h-5" />}
            label="Safety Center"
            onClick={() => navigate('/settings/safety')}
          />
        </Section>

        {/* Support Section */}
        <Section title="Support">
          <SettingItem
            icon={<HelpCircle className="w-5 h-5" />}
            label="Help & Support"
            onClick={() => navigate('/support')}
          />
          <SettingItem label="Terms of Service" onClick={() => navigate('/terms')} />
          <SettingItem label="Privacy Policy" onClick={() => navigate('/privacy')} />
          <SettingItem label="Community Guidelines" onClick={() => navigate('/guidelines')} />
        </Section>

        {/* Actions */}
        <div className="space-y-2 pt-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl hover:brightness-125 transition text-sm"
          >
            <LogOut className="w-5 h-5" />
            Log Out
          </button>
          <button
            onClick={handleDeleteAccount}
            className="w-full flex items-center justify-center gap-2 py-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition text-sm"
          >
            <Trash2 className="w-5 h-5" />
            Delete Account
          </button>
        </div>

        {/* Version */}
        <div className="text-center text-[10px] text-white/40 pt-4 pb-2">Version 1.0.0</div>
      </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <h2 className="text-[10px] font-semibold text-white/40 px-1 tracking-[0.15em] uppercase">
        {title}
      </h2>
      <div>
        {children}
      </div>
    </div>
  );
}

function SettingItem({
  icon,
  label,
  value,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  value?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-3 hover:bg-white/5 transition text-left text-sm"
    >
      {icon && <div className="text-white/60 shrink-0">{icon}</div>}
      <span className="flex-1">{label}</span>
      {value && <span className="text-white/40 text-[11px]">{value}</span>}
      <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />
    </button>
  );
}
