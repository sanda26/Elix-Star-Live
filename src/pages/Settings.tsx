import { supabase, checkSupabaseConnection } from '../lib/supabase';
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

export default function Settings() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out?')) {
      await supabase.auth.signOut();
      navigate('/login');
    }
  };

  const handleDeleteAccount = async () => {
    if (
      confirm(
        'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.'
      )
    ) {
      // Call delete account API
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (token) {
        const response = await fetch('/api/delete-account', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          await supabase.auth.signOut();
          navigate('/login');
        } else {
          alert('Failed to delete account. Please contact support.');
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/feed')} className="p-1 hover:brightness-125 transition" title="Back to For You">
          <img src="/Icons/power-button.png" alt="Back" className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <div className="px-4 py-6 space-y-6">
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
            onClick={() => alert('Coming soon')}
          />
          <SettingItem
            icon={<Shield className="w-5 h-5" />}
            label="Security"
            onClick={() => alert('Coming soon')}
          />
        </Section>

        {/* Preferences Section */}
        <Section title="Preferences">
          <SettingItem
            icon={<Bell className="w-5 h-5" />}
            label="Notifications"
            onClick={() => alert('Coming soon')}
          />
          <SettingItem
            icon={<Moon className="w-5 h-5" />}
            label="Dark Mode"
            value="Always On"
            onClick={() => {}}
          />
          <SettingItem
            icon={<Globe className="w-5 h-5" />}
            label="Language"
            value="English"
            onClick={() => alert('Coming soon')}
          />
        </Section>

        {/* Content Section */}
        <Section title="Content">
          <SettingItem
            icon={<Video className="w-5 h-5" />}
            label="Video Quality"
            value="Auto"
            onClick={() => alert('Coming soon')}
          />
          <SettingItem
            icon={<Heart className="w-5 h-5" />}
            label="Liked Videos"
            onClick={() => navigate('/profile/me?tab=liked')}
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

        {/* Developer */}
        <Section title="Developer">
          <SettingItem
            label="Check Supabase connection"
            onClick={async () => {
              const result = await checkSupabaseConnection();
              alert(result.ok ? 'Supabase connection OK.' : 'Supabase: ' + ('message' in result ? result.message : 'Error'));
            }}
          />
        </Section>

        {/* Actions */}
        <div className="space-y-3 pt-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl hover:brightness-125 transition"
          >
            <LogOut className="w-5 h-5" />
            Log Out
          </button>
          <button
            onClick={handleDeleteAccount}
            className="w-full flex items-center justify-center gap-2 py-4 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition"
          >
            <Trash2 className="w-5 h-5" />
            Delete Account
          </button>
        </div>

        {/* Version */}
        <div className="text-center text-xs text-white/40 pt-6">Version 1.0.0</div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-white/60 mb-3 px-2">{title}</h2>
      <div className="rounded-xl overflow-hidden">
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
      className="w-full flex items-center gap-3 px-4 py-4 hover:brightness-125 transition text-left"
    >
      {icon && <div className="text-white/60">{icon}</div>}
      <span className="flex-1">{label}</span>
      {value && <span className="text-white/40 text-sm">{value}</span>}
      <ChevronRight className="w-5 h-5 text-white/40" />
    </button>
  );
}
