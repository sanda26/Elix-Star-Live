import { useState, useEffect } from 'react';
import { Share2, Menu, Lock, Play, Heart, Camera, Sparkles, LogOut, UserPlus, X, Bookmark, Grid3X3, Coins, ShoppingBag, Repeat2, ChevronDown, ChevronRight, Store } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';
import { uploadAvatar } from '../lib/avatarUpload';
import { trackEvent } from '../lib/analytics';

interface Video {
  id: string;
  thumbnail_url: string;
  views: number;
  is_private: boolean;
}

interface ProfileData {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  followers_count: number;
  following_count: number;
  likes_count: number;
  level?: number;
  is_creator?: boolean;
}

export default function Profile() {
  const navigate = useNavigate();
  const { userId: routeUserId } = useParams<{ userId?: string }>();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const { user, updateUser, signOut } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState<'videos' | 'shop' | 'private' | 'reposts' | 'saved' | 'liked'>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (tabParam as any) || 'videos'
  );
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [ranking, setRanking] = useState<number | null>(null);

  const isOwnProfile = !routeUserId || routeUserId === user?.id;
  const displayUserId = routeUserId || user?.id;
  
  const displayName = profileData?.display_name || profileData?.username || 'User';
  const displayUsername = profileData?.username || 'user';
  const displayAvatar = profileData?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;

  useEffect(() => {
    if (displayUserId) {
      loadProfile();
      loadVideos();
      if (!isOwnProfile && user?.id) {
        checkFollowing();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayUserId, activeTab]);

  const loadProfile = async () => {
    if (!displayUserId) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', displayUserId)
        .single();

      if (error) throw error;
      setProfileData(data);
      trackEvent('profile_view', { user_id: displayUserId, is_own: isOwnProfile });

      // Load ranking if user is a creator
      if (data.is_creator) {
        const { data: rankingData } = await supabase.rpc('get_weekly_creator_ranking', { p_limit: 99 });
        if (rankingData) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const myRank = rankingData.find((r: any) => r.user_id === displayUserId);
          if (myRank) {
            setRanking(myRank.rank);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVideos = async () => {
    if (!displayUserId) return;

    try {
      let query = supabase.from('videos').select('id, thumbnail_url, views, is_private');

      if (activeTab === 'videos') {
        query = query.eq('user_id', displayUserId).eq('is_private', false);
      } else if (activeTab === 'private' && isOwnProfile) {
        query = query.eq('user_id', displayUserId).eq('is_private', true);
      } else if (activeTab === 'liked') {
        const { data: likes } = await supabase
          .from('likes')
          .select('video_id')
          .eq('user_id', displayUserId);
        const videoIds = likes?.map(l => l.video_id) || [];
        if (videoIds.length === 0) { setVideos([]); return; }
        query = query.in('id', videoIds);
      } else if (activeTab === 'saved') {
        const { data: saved } = await supabase
          .from('saved_videos')
          .select('video_id')
          .eq('user_id', displayUserId);
        const videoIds = saved?.map(s => s.video_id) || [];
        if (videoIds.length === 0) { setVideos([]); return; }
        query = query.in('id', videoIds);
      } else if (activeTab === 'reposts') {
        const { data: shares } = await supabase
          .from('shares')
          .select('video_id')
          .eq('user_id', displayUserId);
        const videoIds = shares?.map(s => s.video_id) || [];
        if (videoIds.length === 0) { setVideos([]); return; }
        query = query.in('id', videoIds);
      } else if (activeTab === 'shop') {
        setVideos([]);
        return;
      }

      const { data, error } = await query.order('created_at', { ascending: false }).limit(50);

      if (error) throw error;
      setVideos(data || []);
    } catch (error) {
      console.error('Failed to load videos:', error);
    }
  };

  const checkFollowing = async () => {
    if (!user?.id || !displayUserId || isOwnProfile) return;

    const { data } = await supabase
      .from('followers')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', displayUserId)
      .single();

    setIsFollowing(!!data);
  };

  const toggleFollow = async () => {
    if (!user?.id || !displayUserId || isOwnProfile) return;

    try {
      if (isFollowing) {
        await supabase
          .from('followers')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', displayUserId);
        setIsFollowing(false);
      } else {
        await supabase
          .from('followers')
          .insert({ follower_id: user.id, following_id: displayUserId });
        setIsFollowing(true);
        trackEvent('user_follow', { target_user_id: displayUserId });
      }
    } catch (error) {
      console.error('Failed to toggle follow:', error);
    }
  };

  const handleAvatarFile = async (file: File | undefined) => {
    if (!file) return;
    if (!user) {
      setAvatarError('You must be logged in to change your avatar.');
      return;
    }

    setAvatarError(null);
    setIsUploadingAvatar(true);

    try {
      const publicUrl = await uploadAvatar(file, user.id);
      
      // 1. Update Auth Metadata
      const { error: authError } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
      if (authError) throw authError;

      // 2. Update Public Profiles Table (CRITICAL for display)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id);
      
      if (profileError) throw profileError;

      // 3. Update Local State
      updateUser({ avatar: publicUrl });
      
      // 4. Update Current View
      if (profileData) {
        setProfileData({ ...profileData, avatar_url: publicUrl });
      }
      
      trackEvent('profile_avatar_change', { from: 'profile_page' });
    } catch (e) {
      setAvatarError(e instanceof Error ? e.message : 'Avatar upload failed.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  if (loading) {
     return <div className="min-h-[100dvh] bg-[#13151A] text-white flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-[100dvh] bg-[#13151A] text-white flex justify-center px-2">
      <div className="w-full max-w-[480px] h-[100dvh] flex flex-col bg-[#13151A] rounded-3xl overflow-hidden overflow-y-auto pt-[var(--safe-top)] pb-[calc(var(--safe-bottom)+12mm)]">

        {/* ═══ TOP BAR ═══ */}
        <header className="flex items-center justify-between pl-[calc(16px+3mm)] pr-4 pt-2 pb-2">
          <button onClick={() => navigate('/feed')} title="Add friends" className="p-1">
            <UserPlus size={22} className="text-white" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <button onClick={() => { if (navigator.share) navigator.share({ title: displayName, url: window.location.href }); else navigator.clipboard.writeText(window.location.href); }} title="Share profile" className="p-1">
              <Share2 size={22} className="text-white" />
            </button>
            <button type="button" onClick={() => setShowAccountMenu(true)} title="Menu" className="p-1">
              <Menu size={22} className="text-white" />
            </button>
          </div>
        </header>

        {/* ═══ Account Menu Modal ═══ */}
        {showAccountMenu && (
          <div className="fixed inset-0 z-[9999] bg-[#13151A]/70 flex items-end justify-center" onClick={() => setShowAccountMenu(false)}>
            <div 
              className="w-full max-w-[480px] bg-[#111] rounded-t-2xl border-t border-white/10 pb-safe"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/10">
                <h3 className="text-white font-bold text-base">Account</h3>
                <button onClick={() => setShowAccountMenu(false)} title="Close">
                  <X size={20} className="text-white/50" />
                </button>
              </div>
              <div className="px-5 py-4 flex items-center gap-3 border-b border-white/5">
                <img src={displayAvatar} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-white/10" />
                <div>
                  <p className="text-white font-semibold text-sm">{displayName}</p>
                  <p className="text-white/50 text-xs">{user?.email || '@' + displayUsername}</p>
                </div>
              </div>
              <div className="py-2">
                <button onClick={() => { setShowAccountMenu(false); navigate('/settings'); }} className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors">
                  <Menu size={20} className="text-white/70" />
                  <span className="text-white text-sm font-medium">Settings</span>
                </button>
                <button onClick={async () => { setShowAccountMenu(false); await signOut(); navigate('/login', { replace: true }); }} className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors">
                  <UserPlus size={20} className="text-white" />
                  <span className="text-white text-sm font-medium">Switch Account</span>
                </button>
                <button onClick={async () => { setShowAccountMenu(false); await signOut(); navigate('/login', { replace: true }); }} className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors">
                  <LogOut size={20} className="text-rose-400" />
                  <span className="text-rose-400 text-sm font-medium">Log Out</span>
                </button>
              </div>
              <div className="px-5 pb-4 pt-1">
                <button onClick={() => setShowAccountMenu(false)} className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm font-semibold">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ AVATAR ═══ */}
        <div className="flex flex-col items-center mt-2 mb-3">
          <div className="relative group cursor-pointer" onClick={() => isOwnProfile && document.getElementById('avatar-upload')?.click()}>
            <div className="w-[96px] h-[96px] rounded-full p-[3px] bg-gradient-to-tr from-[#C9A96E] to-[#C9A96E]">
              <div className="w-full h-full rounded-full border-[3px] border-[#13151A] overflow-hidden">
                <img src={displayAvatar} alt="Profile" className="w-full h-full rounded-full object-cover" />
              </div>
            </div>
            {isOwnProfile && (
              <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-[#C9A96E] border-[3px] border-[#13151A] flex items-center justify-center">
                <span className="text-black font-bold text-sm leading-none">+</span>
              </div>
            )}
            {isOwnProfile && (
              <div className="absolute inset-0 rounded-full bg-[#13151A]/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={24} className="text-white" />
              </div>
            )}
            <input 
              type="file" 
              id="avatar-upload" 
              className="hidden" 
              accept="image/*"
              aria-label="Upload profile photo"
              onChange={(e) => handleAvatarFile(e.target.files?.[0])} 
            />
          </div>
          {isUploadingAvatar && <div className="text-xs text-white/70 mt-1">Uploading...</div>}
          {avatarError && <div className="text-xs text-rose-300 mt-1">{avatarError}</div>}
        </div>

        {/* ═══ NAME + EDIT ═══ */}
        <div className="flex items-center justify-center gap-2 px-4">
          <h1 className="text-[17px] font-extrabold text-white tracking-tight">{displayName}</h1>
          {profileData?.is_creator && (
            <span className="w-4 h-4 rounded-full bg-[#C9A96E] flex items-center justify-center">
              <Sparkles size={10} className="text-black" />
            </span>
          )}
        </div>


        {/* ═══ STATS ROW ═══ */}
        <div className="flex items-center justify-center gap-6 mt-4 px-4">
          <div className="flex flex-col items-center min-w-[60px]">
            <span className="text-[17px] font-extrabold text-white">{formatNumber(profileData?.following_count || 0)}</span>
            <span className="text-[11px] text-white/40 font-medium">Following</span>
          </div>
          <div className="flex flex-col items-center min-w-[60px]">
            <span className="text-[17px] font-extrabold text-white">{formatNumber(profileData?.followers_count || 0)}</span>
            <span className="text-[11px] text-white/40 font-medium">Followers</span>
          </div>
          <div className="flex flex-col items-center min-w-[60px]">
            <span className="text-[17px] font-extrabold text-white">{formatNumber(profileData?.likes_count || 0)}</span>
            <span className="text-[11px] text-white/40 font-medium">Likes</span>
          </div>
        </div>

        {/* ═══ BIO ═══ */}
        {profileData?.bio && (
          <p className="text-center text-[13px] text-white/70 mt-3 px-8 leading-relaxed">{profileData.bio}</p>
        )}

        {/* ═══ FOLLOW / MESSAGE (other user) ═══ */}
        {!isOwnProfile && (
          <div className="flex items-center justify-center gap-2 mt-4 px-6">
            <button
              onClick={toggleFollow}
              className={`flex-1 max-w-[160px] py-2.5 rounded-md text-sm font-bold transition ${
                isFollowing
                  ? 'bg-white/10 text-white border border-white/10'
                  : 'bg-[#C9A96E] text-black'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
            <button
              onClick={() => navigate(`/inbox`)}
              className="flex-1 max-w-[160px] py-2.5 bg-white/10 border border-white/10 rounded-md text-sm font-bold text-white"
            >
              Message
            </button>
            <button type="button" onClick={() => { if (navigator.share) navigator.share({ title: displayName, url: window.location.href }); else navigator.clipboard.writeText(window.location.href); }} className="w-10 h-10 bg-white/10 border border-white/10 rounded-md flex items-center justify-center" title="Share profile">
              <Share2 size={18} className="text-white" />
            </button>
          </div>
        )}

        {/* ═══ ACTION BAR (scrollable) — matches TikTok ═══ */}
        <div className="mt-4 border-b border-white/5">
          <div className="flex overflow-x-auto no-scrollbar">
            <button onClick={() => navigate('/ai-studio')} className="flex items-center gap-2 px-4 py-3 whitespace-nowrap">
              <Sparkles size={16} className="text-[#C9A96E]" />
              <span className="text-[13px] font-bold text-white">AI Studio</span>
            </button>
            <button onClick={() => navigate('/creator/login-details')} className="flex items-center gap-2 px-4 py-3 whitespace-nowrap">
              <Sparkles size={16} className="text-[#ff2d55]" />
              <span className="text-[13px] font-bold text-white">Elix Studio</span>
            </button>
            <button onClick={() => navigate('/purchase-coins')} className="flex items-center gap-2 px-4 py-3 whitespace-nowrap">
              <Coins size={16} className="text-[#ff2d55]" />
              <span className="text-[13px] font-bold text-white">Your orders</span>
            </button>
            <button onClick={() => setActiveTab('shop')} className="flex items-center gap-2 px-4 py-3 whitespace-nowrap">
              <ShoppingBag size={16} className="text-[#ff2d55]" />
              <span className="text-[13px] font-bold text-white">Showcase</span>
            </button>
            <button onClick={() => navigate('/edit-profile')} className="flex items-center gap-2 px-4 py-3 whitespace-nowrap">
              <img src={displayAvatar} alt="" className="w-4 h-4 rounded-full object-cover" />
              <span className="text-[13px] font-bold text-white">{displayName.length > 10 ? displayName.slice(0, 10) + '...' : displayName}</span>
            </button>
          </div>
        </div>

        {/* ═══ CONTENT TABS (6 icons) — matches TikTok ═══ */}
        <div className="border-b border-white/10 flex">
          <button
            type="button"
            onClick={() => setActiveTab('videos')}
            className={`flex-1 pb-2.5 pt-2.5 flex items-center justify-center gap-0.5 border-b-2 transition-colors ${
              activeTab === 'videos' ? 'border-white text-white' : 'border-transparent text-white/30'
            }`}
            aria-label="Videos"
          >
            <Grid3X3 size={20} />
            <ChevronDown size={12} />
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('shop')}
            className={`flex-1 pb-2.5 pt-2.5 flex justify-center border-b-2 transition-colors ${
              activeTab === 'shop' ? 'border-white text-white' : 'border-transparent text-white/30'
            }`}
            aria-label="Shop"
          >
            <ShoppingBag size={20} />
          </button>
          {isOwnProfile && (
            <button
              type="button"
              onClick={() => setActiveTab('private')}
              className={`flex-1 pb-2.5 pt-2.5 flex justify-center border-b-2 transition-colors ${
                activeTab === 'private' ? 'border-white text-white' : 'border-transparent text-white/30'
              }`}
              aria-label="Private"
            >
              <Lock size={20} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('reposts')}
            className={`flex-1 pb-2.5 pt-2.5 flex justify-center border-b-2 transition-colors ${
              activeTab === 'reposts' ? 'border-white text-white' : 'border-transparent text-white/30'
            }`}
            aria-label="Reposts"
          >
            <Repeat2 size={20} />
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('saved')}
            className={`flex-1 pb-2.5 pt-2.5 flex justify-center border-b-2 transition-colors ${
              activeTab === 'saved' ? 'border-white text-white' : 'border-transparent text-white/30'
            }`}
            aria-label="Saved"
          >
            <Bookmark size={20} />
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('liked')}
            className={`flex-1 pb-2.5 pt-2.5 flex justify-center border-b-2 transition-colors ${
              activeTab === 'liked' ? 'border-white text-white' : 'border-transparent text-white/30'
            }`}
            aria-label="Liked"
          >
            <Heart size={20} />
          </button>
        </div>

        {/* ═══ VIDEO GRID ═══ */}
        <div className="grid grid-cols-3 gap-[1px] flex-1">
          {videos.map((video) => (
            <button
              key={video.id}
              onClick={() => navigate(`/video/${video.id}`)}
              className="aspect-[3/4] bg-[#1C1E24] relative group text-left"
            >
              <img 
                src={video.thumbnail_url || '/placeholder-video.png'} 
                alt="Video" 
                className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition" 
              />
              {video.is_private && (
                <div className="absolute top-2 right-2">
                  <Lock size={14} className="text-white drop-shadow" />
                </div>
              )}
              <span className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 text-[11px] font-bold text-white drop-shadow-md">
                <Play size={10} fill="white" /> {formatNumber(video.views)}
              </span>
            </button>
          ))}
        </div>
        
        {!loading && videos.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-16 text-white/30 text-sm">
            {activeTab === 'videos' && 'No videos yet'}
            {activeTab === 'shop' && 'No shop items yet'}
            {activeTab === 'private' && 'No private videos'}
            {activeTab === 'reposts' && 'No reposts yet'}
            {activeTab === 'saved' && 'No saved videos'}
            {activeTab === 'liked' && 'No liked videos'}
          </div>
        )}

        {/* ═══ CREATOR CENTRE BANNER ═══ */}
        {isOwnProfile && (
          <button
            onClick={() => navigate('/creator/login-details')}
            className="mx-3 mt-3 flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/8 rounded-xl"
          >
            <Store size={20} className="text-white/50 shrink-0" />
            <span className="text-[13px] font-bold text-white flex-1 text-left">Elix Creator Centre</span>
            <ChevronRight size={18} className="text-white/30 shrink-0" />
          </button>
        )}

      </div>
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(num);
}
