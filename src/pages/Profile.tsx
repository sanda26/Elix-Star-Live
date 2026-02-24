import React, { useState, useEffect, useRef } from 'react';
import { Share2, Menu, Lock, Play, Heart, Camera, Sparkles, LogOut, UserPlus, X, Bookmark, Grid3X3, Coins, ShoppingBag, Repeat2, ChevronDown, ChevronRight, Store, Search, Copy, MessageCircle, Check, TrendingUp, Flag, Download, Plus } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';
import { uploadAvatar } from '../lib/avatarUpload';
import { AvatarRing } from '../components/AvatarRing';
import { trackEvent } from '../lib/analytics';
import ReportModal from '../components/ReportModal';
import PromotePanel from '../components/PromotePanel';
import { useVideoStore } from '../store/useVideoStore';

interface Video {
  id: string;
  thumbnail_url: string;
  views: number;
  is_public: boolean;
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
  const [videosLoading, setVideosLoading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [shopItems, setShopItems] = useState<{ id: string; title: string; price: number; image_url: string | null }[]>([]);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [showPromotePanel, setShowPromotePanel] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [shareFollowers, setShareFollowers] = useState<{ user_id: string; username: string; avatar_url: string | null }[]>([]);
  const [shareSent, setShareSent] = useState<Set<string>>(new Set());
  const [ranking, setRanking] = useState<number | null>(null);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
  const isOwnProfile = !routeUserId || routeUserId === user?.id;
  const displayUserId = routeUserId || user?.id;
  const effectiveUserId = resolvedUserId ?? displayUserId;

  const openSharePanel = async () => {
    setShowSharePanel(true);
    setShareSent(new Set());
    if (!user?.id) return;
    try {
      const { data: followData } = await supabase
        .from('followers')
        .select('follower_id')
        .eq('following_id', user.id)
        .limit(50);
      const { data: followingData } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', user.id)
        .limit(50);
      const ids = new Set<string>();
      (followData || []).forEach((f: any) => ids.add(f.follower_id));
      (followingData || []).forEach((f: any) => ids.add(f.following_id));
      ids.delete(user.id);
      if (ids.size === 0) { setShareFollowers([]); return; }
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .in('user_id', Array.from(ids));
      setShareFollowers(profiles || []);
    } catch { setShareFollowers([]); }
  };

  const sendShareTo = async (targetUserId: string) => {
    if (!user?.id || shareSent.has(targetUserId)) return;
    const profileUrl = `${window.location.origin}/profile/${effectiveUserId}`;
    const msgText = `Check out this profile: ${displayName} ${profileUrl}`;
    try {
      const { data: existing } = await supabase
        .from('chat_threads')
        .select('id')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${targetUserId}),and(user1_id.eq.${targetUserId},user2_id.eq.${user.id})`)
        .limit(1)
        .single();
      let threadId = existing?.id;
      if (!threadId) {
        const { data: newThread } = await supabase
          .from('chat_threads')
          .insert({ user1_id: user.id, user2_id: targetUserId })
          .select('id')
          .single();
        threadId = newThread?.id;
      }
      if (threadId) {
        await supabase.from('messages').insert({ thread_id: threadId, sender_id: user.id, text: msgText });
        await supabase.from('chat_threads').update({ last_message: msgText, last_at: new Date().toISOString() }).eq('id', threadId);
      }
      setShareSent(prev => new Set(prev).add(targetUserId));
    } catch {}
  };
  
  const displayName = isOwnProfile
    ? (profileData?.display_name || profileData?.username || user?.name || user?.email?.split('@')[0] || 'User')
    : (profileData?.display_name || profileData?.username || 'User');
  const rawUsername = isOwnProfile
    ? (profileData?.username || user?.email?.split('@')[0] || 'user')
    : (profileData?.username || 'user');
  const displayUsername = (rawUsername || '').replace(/^@+/, '');
  const localAvatar = isOwnProfile && user?.id ? localStorage.getItem('elix_avatar_' + user.id) : null;
  const displayAvatar = isOwnProfile
    ? (localAvatar || profileData?.avatar_url || user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`)
    : (profileData?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`);

  useEffect(() => {
    if (!displayUserId) {
      setLoading(false);
      setResolvedUserId(null);
      return;
    }
    if (isUuid(displayUserId)) {
      setResolvedUserId(displayUserId);
      return;
    }
    const usernameClean = (displayUserId || '').replace(/^@+/, '');
    supabase
      .from('profiles')
      .select('user_id')
      .eq('username', usernameClean)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.user_id) setResolvedUserId(data.user_id);
        else {
          setResolvedUserId(null);
          setProfileData(null);
          setLoading(false);
        }
      })
      .catch(() => {
        setResolvedUserId(null);
        setProfileData(null);
        setLoading(false);
      });
  }, [displayUserId]);

  useEffect(() => {
    if (!effectiveUserId) return;
    setLoading(true);
    loadProfile();
    loadVideos();
    if (!isOwnProfile && user?.id) checkFollowing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId, activeTab]);

  const loadProfile = async () => {
    if (!effectiveUserId) { setLoading(false); return; }

    try {
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
      
      const fetchProfile = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', effectiveUserId)
          .single();

        if (error || !data) {
          if (effectiveUserId !== user?.id) {
            return null;
          }
          return {
            user_id: effectiveUserId,
            username: user?.username || user?.email?.split('@')[0] || 'user',
            display_name: user?.name || user?.email?.split('@')[0] || 'User',
            avatar_url: user?.avatar || null,
            bio: null,
            followers_count: 0,
            following_count: 0,
            likes_count: 0,
            is_creator: false,
          } as ProfileData;
        }

        data.followers_count = 0;
        data.following_count = 0;
        try {
          const [{ count: followersCount }, { count: followingCount }] = await Promise.all([
            supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', effectiveUserId),
            supabase.from('followers').select('*', { count: 'exact', head: true }).eq('follower_id', effectiveUserId),
          ]);
          data.followers_count = followersCount ?? 0;
          data.following_count = followingCount ?? 0;
        } catch (_) {}

        data.likes_count = 0;
        try {
          const { data: userVideos } = await supabase
            .from('videos')
            .select('id')
            .eq('user_id', effectiveUserId);
          if (userVideos && userVideos.length > 0) {
            const videoIds = userVideos.map(v => v.id);
            const { count: totalLikes } = await supabase
              .from('likes')
              .select('*', { count: 'exact', head: true })
              .in('video_id', videoIds);
            data.likes_count = totalLikes ?? 0;
          }
        } catch (_) {}

        return data as ProfileData;
      };

      const data = await Promise.race([fetchProfile(), timeout]);
      setProfileData(data ?? null);
      trackEvent('profile_view', { user_id: effectiveUserId, is_own: isOwnProfile });

      if (data?.is_creator) {
        supabase.rpc('get_weekly_creator_ranking', { p_limit: 99 }).then(({ data: rankingData }) => {
          if (rankingData) {
            const myRank = rankingData.find((r: any) => r.user_id === effectiveUserId);
            if (myRank) setRanking(myRank.rank);
          }
        }).catch(() => {});
      }
    } catch (_) {
      if (effectiveUserId === user?.id) {
        setProfileData({
          user_id: effectiveUserId,
          username: user?.username || user?.email?.split('@')[0] || 'user',
          display_name: user?.name || user?.email?.split('@')[0] || 'User',
          avatar_url: user?.avatar || null,
          bio: null,
          followers_count: 0,
          following_count: 0,
          likes_count: 0,
          is_creator: false,
        } as ProfileData);
      } else {
        setProfileData(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadVideos = async () => {
    if (!effectiveUserId) return;
    setVideosLoading(true);
    try {
      let query = supabase.from('videos').select('id, thumbnail_url, views, is_public');

      if (activeTab === 'videos') {
        query = query.eq('user_id', effectiveUserId).eq('is_public', true);
      } else if (activeTab === 'private' && isOwnProfile) {
        query = query.eq('user_id', effectiveUserId).eq('is_public', false);
      } else if (activeTab === 'liked') {
        const { data: likes } = await supabase
          .from('likes')
          .select('video_id')
          .eq('user_id', effectiveUserId);
        const videoIds = likes?.map(l => l.video_id) || [];
        if (videoIds.length === 0) { setVideos([]); setVideosLoading(false); return; }
        query = query.in('id', videoIds);
      } else if (activeTab === 'saved') {
        const { data: saved } = await supabase
          .from('saved_videos')
          .select('video_id')
          .eq('user_id', effectiveUserId);
        const videoIds = saved?.map(s => s.video_id) || [];
        if (videoIds.length === 0) { setVideos([]); setVideosLoading(false); return; }
        query = query.in('id', videoIds);
      } else if (activeTab === 'reposts') {
        const { data: shares } = await supabase
          .from('shares')
          .select('video_id')
          .eq('user_id', effectiveUserId);
        const videoIds = shares?.map(s => s.video_id) || [];
        if (videoIds.length === 0) { setVideos([]); setVideosLoading(false); return; }
        query = query.in('id', videoIds);
      } else if (activeTab === 'shop') {
        try {
          const { data: shopData } = await supabase
            .from('shop_items')
            .select('id, title, price, image_url')
            .eq('user_id', effectiveUserId)
            .eq('is_active', true)
            .order('created_at', { ascending: false });
          setShopItems(shopData || []);
        } catch { setShopItems([]); }
        setVideos([]);
        setVideosLoading(false);
        return;
      }

      const { data, error } = await query.order('created_at', { ascending: false }).limit(50);

      if (error) throw error;
      setVideos(data || []);
    } catch {
      setVideos([]);
    } finally {
      setVideosLoading(false);
    }
  };

  const checkFollowing = async () => {
    if (!user?.id || !effectiveUserId || isOwnProfile) return;

    const { data } = await supabase
      .from('followers')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', effectiveUserId)
      .single();

    setIsFollowing(!!data);
  };

  const toggleFollow = async () => {
    if (!user?.id || !effectiveUserId || isOwnProfile) return;

    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    try {
      if (wasFollowing) {
        const { error } = await supabase
          .from('followers')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', effectiveUserId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('followers')
          .insert({ follower_id: user.id, following_id: effectiveUserId });
        if (error && error.code !== '23505') throw error;
        trackEvent('user_follow', { target_user_id: effectiveUserId });
      }

      // Sync video store so feed reflects the change without refresh
      const videoStore = useVideoStore.getState();
      const currentFollowing = videoStore.followingUsers;
      const updatedFollowing = wasFollowing
        ? currentFollowing.filter((id: string) => id !== effectiveUserId)
        : [...currentFollowing, effectiveUserId];
      useVideoStore.setState({
        followingUsers: updatedFollowing,
        videos: videoStore.videos.map(v =>
          v.user.id === effectiveUserId ? { ...v, isFollowing: !wasFollowing } : v
        ),
      });
      loadProfile();
    } catch {
      setIsFollowing(wasFollowing);
    }
  };

  const handleAvatarFile = async (file: File | undefined) => {
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) { setAvatarError('Please select an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { setAvatarError('Image too large (max 5MB).'); return; }

    setAvatarError(null);
    setIsUploadingAvatar(true);

    try {
      const compressed = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const max = 300;
          let w = img.width, h = img.height;
          if (w > h) { if (w > max) { h = h * max / w; w = max; } }
          else { if (h > max) { w = w * max / h; h = max; } }
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(file);
      });

      localStorage.setItem('elix_avatar_' + user.id, compressed);

      updateUser({ avatar: compressed });
      setProfileData(prev => prev ? { ...prev, avatar_url: compressed } : prev);
      setIsUploadingAvatar(false);

      const { data: { user: supaUser } } = await supabase.auth.getUser();
      if (!supaUser) return;

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const filePath = `${supaUser.id}/${Date.now()}.${fileExt}`;

      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { cacheControl: '3600', upsert: true, contentType: file.type });

      let savedUrl = compressed;
      if (!upErr) {
        const pub = supabase.storage.from('avatars').getPublicUrl(filePath).data?.publicUrl;
        if (pub) {
          savedUrl = pub;
          localStorage.setItem('elix_avatar_' + user.id, savedUrl);
        }
      }

      supabase.auth.updateUser({ data: { avatar_url: savedUrl } }).catch(() => {});
      supabase.from('profiles').update({ avatar_url: savedUrl }).eq('user_id', supaUser.id).then(() => {});
      supabase.from('profiles').upsert({ user_id: supaUser.id, avatar_url: savedUrl, username: supaUser.email?.split('@')[0] || 'user' }, { onConflict: 'user_id' }).then(() => {});

      updateUser({ avatar: savedUrl });
      setProfileData(prev => prev ? { ...prev, avatar_url: savedUrl } : prev);
    } catch (err: any) {
      setAvatarError(err?.message || 'Failed');
      setIsUploadingAvatar(false);
    }
  };

  if (!displayUserId) {
     return <div className="bg-[#13151A] text-white flex items-center justify-center min-h-[50vh]">Loading...</div>;
  }

  if (routeUserId && resolvedUserId === null && !loading) {
    return (
      <div className="bg-[#13151A] text-white flex flex-col items-center justify-center min-h-[50vh] px-4">
        <button onClick={() => navigate(-1)} className="absolute top-4 right-4 p-1">
          <img src="/Icons/Gold power buton.png" alt="Back" className="w-5 h-5" />
        </button>
        <p className="text-white/70 text-center">Profile not found.</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-gold-metallic font-semibold text-sm">Go back</button>
      </div>
    );
  }

  if (!loading && !profileData && !isOwnProfile) {
    return (
      <div className="bg-[#13151A] text-white flex flex-col items-center justify-center min-h-[50vh] px-4">
        <button onClick={() => navigate(-1)} className="absolute top-4 right-4 p-1">
          <img src="/Icons/Gold power buton.png" alt="Back" className="w-5 h-5" />
        </button>
        <p className="text-white/70 text-center">Profile not found or couldn&apos;t load.</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-gold-metallic font-semibold text-sm">Go back</button>
      </div>
    );
  }

  return (
    <div className="bg-[#13151A] text-white flex justify-center px-2 min-h-[100dvh]">
      <div className="w-full max-w-[480px] flex flex-col bg-[#13151A] rounded-3xl overflow-hidden overflow-y-auto flex-1">

        {/* ═══ TOP BAR ═══ */}
        <header className="flex items-center justify-between pl-4 pr-4 pt-2 pb-2 relative z-20">
          <div className="flex items-center gap-4">
            <button type="button" onClick={openSharePanel} title="Share profile" className="p-1 relative z-50">
              <img src="/Icons/Share Icon.png" alt="Share" className="w-6 h-6 object-contain" />
            </button>
            <button type="button" onClick={() => setShowAccountMenu(true)} title="Menu" className="p-1">
              <Menu size={22} className="text-white" />
            </button>
          </div>
          <div className="flex-1" />
          <button onClick={() => navigate(-1)} className="p-1" title="Back">
            <img src="/Icons/Gold power buton.png" alt="Back" className="w-5 h-5" />
          </button>
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
                <AvatarRing src={displayAvatar} alt="Avatar" size={40} />
                <div>
                  <p className="text-gold-metallic font-semibold text-sm">{displayName}</p>
                  <p className="text-white text-xs">{user?.email || '@' + displayUsername}</p>
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

        {/* ═══ Share Panel ═══ */}
        {showSharePanel && (
          <div className="fixed inset-0 z-[9999] bg-black/60 flex items-end justify-center" onClick={() => setShowSharePanel(false)}>
            <div
              className="w-full max-w-[480px] bg-[#1C1E24]/95 rounded-t-2xl border-2 border-b-0 border-[#C9A96E] max-h-[40dvh] flex flex-col overflow-hidden"
              style={{ marginBottom: '90px', boxShadow: '0 -4px 30px rgba(201,169,110,0.25)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-white/20 rounded-full" />
              </div>
              <div className="flex items-center justify-between gap-2 px-4 pb-2">
                <h3 className="text-gold-metallic font-bold text-sm">Share to</h3>
                <div className="flex-none w-[120px] bg-white/5 rounded-lg px-2 py-1.5 flex items-center gap-2 border border-[#C9A96E]/20">
                  <Search className="w-3.5 h-3.5 text-[#C9A96E]/40" />
                  <input placeholder="Search..." className="bg-transparent text-white text-xs outline-none w-full placeholder:text-white/20" />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4">
                {/* Create + Followers row — same as LiveStream share panel */}
                <div className="w-full overflow-hidden shrink-0 mb-3">
                  <div className="flex gap-3 overflow-x-auto pb-3 no-scrollbar items-center px-4" style={{ marginLeft: '-2mm' }}>
                    <button type="button" onClick={() => { setShowSharePanel(false); navigate('/create'); }} className="flex-shrink-0 flex flex-col items-center gap-1.5 min-w-[80px] active:scale-95 transition-transform">
                      <div className="relative w-20 h-20 flex items-center justify-center">
                        <img src="/Icons/Profile icon.png" alt="" className="w-full h-full object-contain" />
                        <Plus size={28} className="text-[#C9A96E] absolute" strokeWidth={2.5} />
                      </div>
                      <span className="text-white/80 text-[11px] font-medium">Create</span>
                    </button>
                    {shareFollowers.map((f) => (
                      <button key={f.user_id} className="flex flex-col items-center gap-1 min-w-[64px] active:scale-95 transition-transform" style={{ marginTop: '6mm' }} onClick={() => sendShareTo(f.user_id)}>
                        <div className="relative">
                          <AvatarRing
                            src={f.avatar_url || '/Icons/Profile icon.png'}
                            alt={f.username || 'User'}
                            size={56}
                          />
                          {shareSent.has(f.user_id) && (
                            <div className="absolute bottom-0 right-0 w-4 h-4 bg-[#C9A96E] rounded-full flex items-center justify-center border-2 border-[#1C1E24]">
                              <Check size={8} className="text-black" />
                            </div>
                          )}
                        </div>
                        <span className="text-white/60 text-[10px] font-medium truncate w-16 text-center">{shareSent.has(f.user_id) ? 'Sent' : f.username || 'User'}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Share options — same layout as ShareModal */}
                <div className="flex-1 overflow-y-scroll overflow-x-hidden min-h-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-white/5 [&::-webkit-scrollbar-thumb]:bg-[#C9A96E]/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                  <div className="grid grid-cols-5 gap-y-3 gap-x-1.5 pt-1">
                    {[
                      { name: 'WhatsApp', icon: <MessageCircle size={22} className="text-white" />, action: () => window.open(`https://wa.me/?text=${encodeURIComponent(`Check out ${displayName}'s profile on Elix! ${window.location.origin}/profile/${displayUserId}`)}`) },
                      { name: 'Facebook', icon: <Share2 size={22} className="text-white" />, action: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/profile/${displayUserId}`)}`) },
                      { name: 'Twitter', icon: <Share2 size={22} className="text-white" />, action: () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out ${displayName} on Elix!`)}&url=${encodeURIComponent(`${window.location.origin}/profile/${displayUserId}`)}`) },
                      { name: 'Copy Link', icon: <Copy size={22} className="text-white" />, action: () => { navigator.clipboard.writeText(`${window.location.origin}/profile/${displayUserId}`).then(() => alert('Profile link copied!')).catch(() => {}); } },
                      { name: 'Promote', icon: <TrendingUp size={22} className="text-white" />, action: () => { setShowSharePanel(false); setShowPromotePanel(true); } },
                      { name: 'Report', icon: <Flag size={22} className="text-red-400" />, isRed: true, action: () => { setShowSharePanel(false); setShowReportModal(true); } },
                    ].map((item) => (
                      <button key={item.name} onClick={item.action} className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
                        <div className="relative w-9 h-9 rounded-full bg-[#13151A] overflow-hidden flex items-center justify-center flex-shrink-0">
                          <div className={`relative z-[2] ${item.name === 'Report' ? 'translate-y-0.5' : ''}`}>{React.cloneElement((item.icon as React.ReactElement), { className: `w-3.5 h-3.5 ${(item as { isRed?: boolean }).isRed ? 'text-red-400' : 'text-white'}`, strokeWidth: 1.8 })}</div>
                          <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[3] scale-125 translate-y-0.5" />
                        </div>
                        <span className={`text-[8px] font-semibold truncate w-full text-center ${(item as { isRed?: boolean }).isRed ? 'text-red-400/70' : 'text-white/70'}`}>{item.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <PromotePanel
          isOpen={showPromotePanel}
          onClose={() => setShowPromotePanel(false)}
          contentType="profile"
          content={{
            id: effectiveUserId,
            title: `${displayName} on Elix`,
            thumbnail: displayAvatar,
            username: displayName,
            avatar: displayAvatar,
            postedAt: new Date().toLocaleDateString(),
          }}
        />

        {/* ═══ AVATAR ═══ */}
        <div className="flex flex-col items-center mt-2 mb-3">
          <div
            className={`relative ${isOwnProfile ? 'cursor-pointer' : ''}`}
            onClick={() => { if (isOwnProfile) fileInputRef.current?.click(); }}
          >
            <AvatarRing src={displayAvatar} alt="Profile" size={130} />
          </div>
          <input 
            ref={fileInputRef}
            type="file" 
            className="hidden" 
            accept="image/*"
            aria-label="Upload profile photo"
            onChange={(e) => { handleAvatarFile(e.target.files?.[0]); if (e.target) e.target.value = ''; }} 
          />
          {isUploadingAvatar && <div className="text-xs text-white/70 mt-1">Uploading...</div>}
          {avatarError && <div className="text-xs text-rose-300 mt-1">{avatarError}</div>}
        </div>

        {/* ═══ NAME + EDIT ═══ */}
        <div className="flex flex-col items-center px-4" style={{ marginTop: '-6px' }}>
          <div className="flex items-center gap-2">
            <h1 className="text-[17px] font-extrabold text-gold-metallic tracking-tight">{displayName}</h1>
            {profileData?.is_creator && (
              <span className="w-4 h-4 rounded-full bg-[#C9A96E] flex items-center justify-center">
                <Sparkles size={10} className="text-black" />
              </span>
            )}
          </div>
          <span className="text-[13px] text-white font-medium">@{displayUsername}</span>
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
            <button type="button" onClick={openSharePanel} className="w-10 h-10 bg-white/10 border border-white/10 rounded-md flex items-center justify-center" title="Share profile">
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
            <button onClick={() => navigate('/shop')} className="flex items-center gap-2 px-4 py-3 whitespace-nowrap">
              <ShoppingBag size={16} className="text-[#C9A96E]" />
              <span className="text-[13px] font-bold text-white">Shop</span>
            </button>
            <button onClick={() => setActiveTab('shop')} className="flex items-center gap-2 px-4 py-3 whitespace-nowrap">
              <ShoppingBag size={16} className="text-[#ff2d55]" />
              <span className="text-[13px] font-bold text-white">Showcase</span>
            </button>
            <button onClick={() => navigate('/edit-profile')} className="flex items-center gap-2 px-4 py-3 whitespace-nowrap">
              <AvatarRing src={displayAvatar} alt="" size={16} />
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
        {activeTab !== 'shop' && (
          <div className="grid grid-cols-3 gap-[1px] flex-1">
            {videosLoading && videos.length === 0 ? (
              <div className="col-span-3 flex items-center justify-center py-16">
                <div className="w-8 h-8 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              videos.map((video) => (
                <button
                  key={video.id}
                  onClick={() => navigate(`/video/${video.id}`)}
                  className="aspect-[3/4] bg-[#1C1E24] relative group text-left"
                >
                  <img 
                    src={video.thumbnail_url || `https://ui-avatars.com/api/?name=Video&background=1C1E24&color=C9A96E&size=200`} 
                    alt="Video" 
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition" 
                  />
                  {!video.is_public && (
                    <div className="absolute top-2 right-2">
                      <Lock size={14} className="text-white drop-shadow" />
                    </div>
                  )}
                  <span className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 text-[11px] font-bold text-white drop-shadow-md">
                    <Play size={10} fill="white" /> {formatNumber(video.views)}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {/* ═══ SHOP ITEMS GRID ═══ */}
        {activeTab === 'shop' && shopItems.length > 0 && (
          <div className="grid grid-cols-2 gap-3 px-3 py-3 flex-1">
            {shopItems.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(`/shop/${item.id}`)}
                className="bg-white/5 rounded-2xl overflow-hidden border border-white/5 text-left"
              >
                {item.image_url ? (
                  <img src={item.image_url} alt={item.title} className="w-full aspect-square object-cover" />
                ) : (
                  <div className="w-full aspect-square bg-white/5 flex items-center justify-center">
                    <ShoppingBag size={28} className="text-white/20" />
                  </div>
                )}
                <div className="p-2.5">
                  <h3 className="text-xs font-bold text-gold-metallic truncate">{item.title}</h3>
                  <p className="text-sm font-extrabold text-white mt-0.5">${item.price.toFixed(2)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
        
        {!videosLoading && activeTab !== 'shop' && videos.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-16 text-white/30 text-sm">
            {activeTab === 'videos' && 'No videos yet'}
            {activeTab === 'private' && 'No private videos'}
            {activeTab === 'reposts' && 'No reposts yet'}
            {activeTab === 'saved' && 'No saved videos'}
            {activeTab === 'liked' && 'No liked videos'}
          </div>
        )}
        {!loading && activeTab === 'shop' && shopItems.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-16 gap-2">
            <ShoppingBag size={32} className="text-white/20" />
            <span className="text-white/30 text-sm">No items for sale</span>
            {isOwnProfile && (
              <button onClick={() => navigate('/shop')} className="mt-2 px-4 py-2 rounded-xl bg-[#C9A96E] text-black font-bold text-xs">
                Start Selling
              </button>
            )}
          </div>
        )}


      </div>

      {showReportModal && effectiveUserId && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          videoId=""
          contentType="user"
          contentId={effectiveUserId}
        />
      )}
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(num);
}
