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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Settings.tsx:handleDeleteAccount',message:'Delete button tapped',data:{},timestamp:Date.now(),hypothesisId:'D1'})}).catch(()=>{});
    // #endregion
    const confirmed = await nativeConfirm(
      'Are you sure you want to delete your account?',
      'Delete Account'
    );
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Settings.tsx:confirm1',message:'First confirm result',data:{confirmed},timestamp:Date.now(),hypothesisId:'D2'})}).catch(()=>{});
    // #endregion
    if (!confirmed) return;

    try {
      const session = useAuthStore.getState().session;
      const tkn = session?.access_token || '';
      const url = apiUrl('/api/auth/delete');
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Settings.tsx:beforeFetch',message:'About to call delete API',data:{url,hasToken:!!tkn,tokenLen:tkn.length},timestamp:Date.now(),hypothesisId:'D3'})}).catch(()=>{});
      // #endregion
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (tkn) headers['Authorization'] = `Bearer ${tkn}`;
      const response = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include',
      });
      const body = await response.text();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Settings.tsx:afterFetch',message:'Delete API response',data:{ok:response.ok,status:response.status,body:body.slice(0,200)},timestamp:Date.now(),hypothesisId:'D4'})}).catch(()=>{});
      // #endregion

      if (response.ok) {
        await signOut();
        navigate('/login');
      } else {
        showToast('Failed to delete account.');
      }
    } catch (err: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Settings.tsx:catch',message:'Delete threw error',data:{error:String(err?.message||err)},timestamp:Date.now(),hypothesisId:'D5'})}).catch(()=>{});
      // #endregion
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
