import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { trackEvent } from '../lib/analytics';
import { avatarUploadService } from '../lib/avatarUploadService';
import { showToast } from '../lib/toast';

interface Profile {
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  website: string | null;
  instagram_handle: string | null;
  youtube_handle: string | null;
  tiktok_handle: string | null;
}

export default function EditProfile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile>({
    username: '',
    display_name: '',
    bio: '',
    avatar_url: '',
    website: '',
    instagram_handle: '',
    youtube_handle: '',
    tiktok_handle: '',
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      setCurrentUserId(userData.user.id);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userData.user.id)
        .single();

      if (error) throw error;
      if (data) {
        setProfile({
          username: data.username || '',
          display_name: data.display_name || '',
          bio: data.bio || '',
          avatar_url: data.avatar_url || '',
          website: data.website || '',
          instagram_handle: data.instagram_handle || '',
          youtube_handle: data.youtube_handle || '',
          tiktok_handle: data.tiktok_handle || '',
        });
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserId) return;

    setUploading(true);
    try {
      const result = await avatarUploadService.uploadAvatar(file, currentUserId);
      
      if (result.success && result.publicUrl) {
        setProfile(prev => ({ ...prev, avatar_url: result.publicUrl }));
        trackEvent('profile_avatar_change', {});
        
        // Optional: Force a refresh of the user metadata if needed by other components
        await supabase.auth.refreshSession();
      } else {
        showToast(result.error || 'Failed to upload avatar');
      }
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      showToast('Failed to upload avatar');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!currentUserId) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: profile.display_name,
          bio: profile.bio,
          avatar_url: profile.avatar_url,
          website: profile.website,
          instagram_handle: profile.instagram_handle,
          youtube_handle: profile.youtube_handle,
          tiktok_handle: profile.tiktok_handle,
        })
        .eq('user_id', currentUserId);

      if (error) throw error;

      trackEvent('profile_update', {});
      navigate(-1); // Go back
    } catch (error) {
      console.error('Failed to save profile:', error);
      showToast('Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#13151A] text-white flex justify-center px-2">
      <div className="w-full max-w-[480px] h-[100dvh] rounded-3xl overflow-hidden bg-[#13151A] flex flex-col pt-[var(--safe-top)] pb-[calc(var(--safe-bottom)+12mm)]">
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-4 flex items-center justify-between bg-[#13151A]">
        <button onClick={() => navigate(-1)} className="p-2 hover:brightness-125 rounded-full transition">
          <img src="/Icons/power-button.png" alt="Back" className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">Edit Profile</h1>
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-4 py-2 bg-[#C9A96E] text-black rounded-full font-semibold disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="px-4 py-6 space-y-6 flex-1 overflow-y-auto">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative group cursor-pointer">
            <img
              src={profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.username}`}
              alt="Avatar"
              className="w-24 h-24 object-cover rounded-full border-2 border-[#C9A96E]"
              onClick={() => document.getElementById('avatar-upload')?.click()}
            />
            <label
              htmlFor="avatar-upload"
              className="absolute bottom-0 right-0 w-8 h-8 bg-[#C9A96E] rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition shadow-lg"
            >
              <Camera className="w-4 h-4 text-black" />
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
          <button 
            type="button"
            onClick={() => document.getElementById('avatar-upload')?.click()}
            className="text-sm font-semibold text-white hover:text-white/80 transition"
          >
            Change Photo
          </button>
          {uploading && <p className="text-sm text-white/60">Uploading...</p>}
          <p className="text-sm text-white/60">@{profile.username}</p>
        </div>

        {/* Form Fields */}
        <div className="space-y-4">
          <InputField
            label="Display Name"
            value={profile.display_name || ''}
            onChange={val => setProfile(prev => ({ ...prev, display_name: val }))}
            placeholder="Your display name"
            maxLength={50}
          />

          <TextAreaField
            label="Bio"
            value={profile.bio || ''}
            onChange={val => setProfile(prev => ({ ...prev, bio: val }))}
            placeholder="Tell us about yourself..."
            maxLength={150}
          />

          <InputField
            label="Website"
            value={profile.website || ''}
            onChange={val => setProfile(prev => ({ ...prev, website: val }))}
            placeholder="https://yoursite.com"
            maxLength={100}
          />

          <Divider label="Social Links" />

          <InputField
            label="Instagram"
            value={profile.instagram_handle || ''}
            onChange={val => setProfile(prev => ({ ...prev, instagram_handle: val }))}
            placeholder="@username"
            maxLength={50}
          />

          <InputField
            label="YouTube"
            value={profile.youtube_handle || ''}
            onChange={val => setProfile(prev => ({ ...prev, youtube_handle: val }))}
            placeholder="@channelname"
            maxLength={50}
          />

          <InputField
            label="TikTok"
            value={profile.tiktok_handle || ''}
            onChange={val => setProfile(prev => ({ ...prev, tiktok_handle: val }))}
            placeholder="@username"
            maxLength={50}
          />
        </div>
      </div>
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-white/80 mb-2">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full bg-[#13151A] rounded-lg px-4 py-3 outline-none text-white placeholder-white/40/40 border border-transparent focus:border-[#C9A96E] transition"
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-white/80 mb-2">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={4}
        className="w-full bg-[#13151A] rounded-lg px-4 py-3 outline-none text-white placeholder-white/40/40 border border-transparent focus:border-[#C9A96E] transition resize-none"
      />
      {maxLength && (
        <p className="text-xs text-white/40 mt-1 text-right">
          {value.length}/{maxLength}
        </p>
      )}
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 h-px bg-[#13151A]"></div>
      <span className="text-xs text-white/40 font-semibold">{label}</span>
      <div className="flex-1 h-px bg-[#13151A]"></div>
    </div>
  );
}


