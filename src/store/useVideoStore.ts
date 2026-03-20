import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAuthStore } from './useAuthStore';
import { apiUrl } from '../lib/api';
import {
  calculateEngagementScore,
  isEligibleForFyp,
  refreshVideoFypStatus,
} from '../lib/fypEligibility';
import {
  fetchForYouFeed,
  trackLike,
  trackComment,
  trackShare,
  trackFollow,
} from '../lib/interactionTracker';
import { showToast } from '../lib/toast';
import { getVideoPosterUrl } from '../lib/bunnyStorage';

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); }
    catch (err) {
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, delay * (i + 1)));
    }
  }
  throw new Error('Retry exhausted');
}

let _feedFetchPromise: Promise<void> | null = null;

interface User {
  id: string;
  username: string;
  name: string;
  avatar: string;
  level?: number;
  isVerified?: boolean;
  followers: number;
  following: number;
  isFollowing?: boolean;
}

interface Comment {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  text: string;
  likes: number;
  time: string;
  isLiked?: boolean;
  replies?: Comment[];
}

interface Music {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: string;
  coverUrl?: string;
  previewUrl?: string;
}

interface VideoStats {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}

export interface Video {
  id: string;
  url: string;
  thumbnail?: string;
  duration: string;
  user: User;
  description: string;
  hashtags: string[];
  music: Music;
  stats: VideoStats;
  createdAt: string;
  location?: string;
  isLiked: boolean;
  isSaved: boolean;
  isFollowing: boolean;
  comments: Comment[];
  quality?: 'auto' | '720p' | '1080p';
  privacy?: 'public' | 'friends' | 'private';
  duetWithVideoId?: string;
}

interface VideoStore {
  videos: Video[];
  friendVideos: Video[];
  stemVideos: Video[];
  likedVideos: string[];
  savedVideos: string[];
  followingUsers: string[];
  loading: boolean;
  friendsLoading: boolean;
  stemLoading: boolean;
  
  // Video actions
  fetchVideos: () => Promise<void>;
  fetchFriendVideos: () => Promise<void>;
  fetchStemVideos: () => Promise<void>;
  getVideoById: (videoId: string) => Video | undefined;
  addVideo: (video: Video) => void;
  removeVideo: (videoId: string) => void;
  updateVideo: (videoId: string, updates: Partial<Video>) => void;
  deleteVideo: (videoId: string) => Promise<void>;
  
  // Like actions
  toggleLike: (videoId: string) => void | Promise<void>;
  getLikedVideos: () => Video[];
  
  // Save actions
  toggleSave: (videoId: string) => void;
  getSavedVideos: () => Video[];
  
  // Follow actions
  toggleFollow: (userId: string) => void;
  getFollowingUsers: () => User[];
  
  // Share actions
  shareVideo: (videoId: string) => void | Promise<void>;

  // Comment actions
  addComment: (videoId: string, comment: Omit<Comment, 'id' | 'time'>) => void | Promise<void>;
  deleteComment: (videoId: string, commentId: string) => void;
  toggleCommentLike: (videoId: string, commentId: string) => void;
  
  // Analytics
  incrementViews: (videoId: string) => void | Promise<void>;
  getTrendingVideos: () => Video[];
  getRecommendedVideos: (userId: string) => Video[];
}

export const useVideoStore = create<VideoStore>()(
  persist(
    (set, get) => ({
      videos: [],
      friendVideos: [],
      stemVideos: [],
      likedVideos: [],
      savedVideos: [],
      followingUsers: [],
      loading: false,
      friendsLoading: false,
      stemLoading: false,

      getVideoById: (videoId: string) => {
        const { friendVideos, videos } = get();
        return friendVideos.find((v) => v.id === videoId) ?? videos.find((v) => v.id === videoId);
      },

      fetchVideos: async () => {
        if (_feedFetchPromise) return _feedFetchPromise;
        const doFetch = async () => {
        set({ loading: true });
        try {
          const { videos: apiVideos } = await withRetry(() => fetchForYouFeed(1, 50));
          const { likedVideos, savedVideos, followingUsers } = get();
          const likedSet = new Set(likedVideos);
          const savedSet = new Set(savedVideos);
          const followingSet = new Set(followingUsers);

          // Use all real backend videos. If backend is empty, show empty state.
          const hasApiVideos = Array.isArray(apiVideos) && apiVideos.length > 0;
          const sourceVideos = hasApiVideos ? apiVideos! : [];

          const mappedVideos: Video[] = sourceVideos.map((v: any) => {
            const u = v.user || {};
            const stats = v.stats || {};
            const music = v.music || { id: 'original', title: 'Original Sound', artist: u.name || 'Creator', duration: '0:15' };
            const durationStr = typeof v.duration === 'number' ? `0:${String(v.duration).padStart(2, '0')}` : (v.duration || '0:15');
            const id = String(v.id || '');
            const locallySaved = savedSet.has(id);
            return {
              id,
              url: v.url,
              thumbnail: v.thumbnail || getVideoPosterUrl(v.url || ''),
              duration: durationStr,
              user: {
                id: u.id || 'unknown',
                username: u.username || u.name || 'creator',
                name: u.name || u.username || 'Creator',
                avatar: u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent((u.name || u.username || 'C').slice(0, 1))}`,
                level: 1,
                isVerified: !!u.isVerified,
                followers: u.followers ?? 0,
                following: u.following ?? 0,
                isFollowing: followingSet.has(String(u.id || '')),
              },
              description: v.description || '',
              hashtags: Array.isArray(v.hashtags) ? v.hashtags : [],
              music: {
                id: music.id || 'original',
                title: music.title || 'Original Sound',
                artist: music.artist || 'Creator',
                duration: typeof music.duration === 'string' ? music.duration : '0:15',
              },
              stats: {
                views: stats.views ?? 0,
                likes: stats.likes ?? 0,
                comments: stats.comments ?? 0,
                shares: stats.shares ?? 0,
                // If backend doesn't return save counts yet, keep UI stable after refresh.
                saves: Math.max(0, Number(stats.saves ?? 0) || 0) + (locallySaved ? 1 : 0),
              },
              createdAt: v.createdAt || v.created_at || new Date().toISOString(),
              // Persist like/save/follow UI across refresh using local store.
              // Backend may not return these flags yet.
              isLiked: likedSet.has(id) || !!v.isLiked,
              isSaved: savedSet.has(id) || !!v.isSaved,
              isFollowing: followingSet.has(String(u.id || '')) || !!u.isFollowing,
              comments: [],
              quality: 'auto',
              privacy: 'public',
            };
          });

          set({ videos: mappedVideos, loading: false });
        } catch (err) {
          set({ loading: false });
          if (!navigator.onLine) showToast('No internet connection');
          else showToast('Failed to load feed. Pull down to retry.');
        }
        };
        _feedFetchPromise = doFetch().finally(() => { _feedFetchPromise = null; });
        return _feedFetchPromise;
      },

      fetchStemVideos: async () => {
        set({ stemLoading: true });
        try {
          // STEM is a "most viewed" slice of For You.
          // Keep videos on For You; also show any video with >= 5k views here.
          const state = get();
          const source = (state.videos || []).filter((v) => (v.stats?.views ?? 0) >= 5000);
          const sorted = [...source].sort((a, b) => (b.stats?.views ?? 0) - (a.stats?.views ?? 0));
          set({ stemVideos: sorted.slice(0, 50), stemLoading: false });
        } catch (err) {
          set({ stemLoading: false });
        }
      },

      fetchFriendVideos: async () => {
        set({ friendsLoading: true });
        try {
          const authUser = useAuthStore.getState().user;
          const session = useAuthStore.getState().session;
          if (!authUser?.id) {
            set({ friendsLoading: false });
            return;
          }
          const headers: Record<string, string> = {};
          if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

          // First load who we follow so followingUsers is up to date
          const followRes = await fetch(apiUrl(`/api/profiles/${authUser.id}/following`), { credentials: 'include', headers });
          if (followRes.ok) {
            const followBody = await followRes.json().catch(() => ({ following: [] }));
            const ids: string[] = Array.isArray(followBody?.following) ? followBody.following : [];
            if (ids.length > 0) {
              set({ followingUsers: ids });
            }
          }

          const { followingUsers } = get();
          if (followingUsers.length === 0) {
            set({ friendsLoading: false });
            return;
          }

          // Fetch friend videos from server
          const res = await fetch(apiUrl('/api/feed/friends'), { credentials: 'include', headers });
          if (!res.ok) {
            set({ friendsLoading: false });
            return;
          }
          const body = await res.json().catch(() => ({ videos: [] }));
          const apiVideos = Array.isArray(body?.videos) ? body.videos : [];
          if (apiVideos.length === 0) {
            set({ friendVideos: [], friendsLoading: false });
            return;
          }

          const { likedVideos, savedVideos } = get();
          const likedSet = new Set(likedVideos);
          const savedSet = new Set(savedVideos);
          const followingSet = new Set(followingUsers);

          const mappedVideos: Video[] = apiVideos.map((v: any) => {
            const u = v.user || {};
            const id = String(v.id || '');
            return {
              id,
              url: v.url || '',
              thumbnail: v.thumbnail || getVideoPosterUrl(v.url || ''),
              duration: v.duration || '0:15',
              user: {
                id: u.id || v.user_id || 'unknown',
                username: u.username || 'creator',
                name: u.name || u.username || 'Creator',
                avatar: u.avatar || '',
                level: u.level || 1,
                isVerified: !!u.isVerified,
                followers: u.followers ?? 0,
                following: u.following ?? 0,
                isFollowing: followingSet.has(String(u.id || '')),
              },
              description: v.description || '',
              hashtags: Array.isArray(v.hashtags) ? v.hashtags : [],
              music: v.music || { id: 'original', title: 'Original Sound', artist: u.name || 'Creator', duration: '0:15' },
              stats: v.stats || { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 },
              createdAt: v.createdAt || new Date().toISOString(),
              location: v.location,
              isLiked: likedSet.has(id) || !!v.isLiked,
              isSaved: savedSet.has(id) || !!v.isSaved,
              isFollowing: followingSet.has(String(u.id || '')) || !!v.isFollowing,
              comments: [],
              quality: 'auto',
              privacy: v.privacy || 'public',
              duetWithVideoId: v.duetWithVideoId,
            };
          });
          set({ friendVideos: mappedVideos, friendsLoading: false });
        } catch {
          set({ friendsLoading: false });
          if (!navigator.onLine) showToast('No internet connection');
        }
      },

      // Video actions
      addVideo: (video) => set((state) => ({ 
        videos: [video, ...state.videos] 
      })),
      
      removeVideo: (videoId) => set((state) => ({
        videos: state.videos.filter(video => video.id !== videoId)
      })),
      
      updateVideo: (videoId, updates) => set((state) => {
        const upd = (video: Video) => video.id === videoId ? { ...video, ...updates } : video;
        return {
          videos: state.videos.map(upd),
          friendVideos: state.friendVideos.map(upd),
        };
      }),

      deleteVideo: async (videoId) => {
        const snapshot = get();
        try {
          const authUser = useAuthStore.getState().user;
          if (!authUser?.id) {
            throw new Error('Please sign in to delete videos.');
          }

          const token = useAuthStore.getState().session?.access_token;
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (token) headers['Authorization'] = `Bearer ${token}`;

          const res = await fetch(apiUrl(`/api/videos/${videoId}`), {
            method: 'DELETE',
            headers,
            credentials: 'include',
          });
          // #region agent log
          fetch("http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              runId: "pre-fix",
              hypothesisId: "H3",
              location: "src/store/useVideoStore.ts:deleteVideo",
              message: "DELETE /api/videos response",
              data: { videoId, status: res.status, ok: res.ok },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `Failed to delete video (${res.status})`);
          }

          set({ videos: get().videos.filter((v) => v.id !== videoId), friendVideos: get().friendVideos.filter((v) => v.id !== videoId) });
        } catch (err) {
          set({ videos: snapshot.videos, friendVideos: snapshot.friendVideos });
          throw err instanceof Error ? err : new Error('Failed to delete video.');
        }
      },

      // Like actions (persist to server + update video engagement / FYP eligibility)
      toggleLike: async (videoId) => {
        const state = get();
        const video = state.getVideoById(videoId);
        if (!video) return;

        const wasLiked = video.isLiked;
        const newLikes = Math.max(0, wasLiked ? video.stats.likes - 1 : video.stats.likes + 1);
        const updatedStats = { ...video.stats, likes: newLikes };

        const newLikedVideos = wasLiked
          ? state.likedVideos.filter(id => id !== videoId)
          : [...state.likedVideos, videoId];

        const likeUpdate = (v: Video) => v.id === videoId ? { ...v, isLiked: !wasLiked, stats: updatedStats } : v;
        set({
          videos: state.videos.map(likeUpdate),
          friendVideos: state.friendVideos.map(likeUpdate),
          likedVideos: newLikedVideos
        });

        try {
          const authUser = useAuthStore.getState().user;
          const session = useAuthStore.getState().session;
          if (!authUser?.id) return;
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

          const endpoint = wasLiked
            ? apiUrl(`/api/videos/${videoId}/unlike`)
            : apiUrl(`/api/videos/${videoId}/like`);

          const res = await fetch(endpoint, { method: 'POST', credentials: 'include', headers });
          if (!res.ok) throw new Error('Like failed');

          if (!wasLiked) trackLike(videoId).catch(() => {});
          await refreshVideoFypStatus(videoId, updatedStats);
        } catch (err) {
          set({ videos: state.videos, friendVideos: state.friendVideos, likedVideos: state.likedVideos });
        }
      },

      getLikedVideos: () => {
        const { videos, likedVideos } = get();
        return videos.filter(video => likedVideos.includes(video.id));
      },

      // Save actions — persist to server
      toggleSave: async (videoId) => {
        const state = get();
        const video = state.getVideoById(videoId);
        if (!video) return;

        const wasSaved = video.isSaved;
        const newSavedVideos = wasSaved
          ? state.savedVideos.filter(id => id !== videoId)
          : [...state.savedVideos, videoId];

        const newSaves = Math.max(0, wasSaved ? (video.stats.saves || 0) - 1 : (video.stats.saves || 0) + 1);
        const saveUpdate = (v: Video) => v.id === videoId
          ? { ...v, isSaved: !wasSaved, stats: { ...v.stats, saves: newSaves } }
          : v;
        set({
          videos: state.videos.map(saveUpdate),
          friendVideos: state.friendVideos.map(saveUpdate),
          savedVideos: newSavedVideos,
        });

        try {
          const authUser = useAuthStore.getState().user;
          const session = useAuthStore.getState().session;
          if (!authUser?.id) return;
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

          const endpoint = wasSaved
            ? apiUrl(`/api/videos/${videoId}/unsave`)
            : apiUrl(`/api/videos/${videoId}/save`);

          const res = await fetch(endpoint, { method: 'POST', credentials: 'include', headers });
          if (!res.ok) throw new Error('Save failed');
        } catch {
          const s = get();
          const revertSaves = Math.max(0, wasSaved ? (video.stats.saves || 0) + 1 : (video.stats.saves || 0) - 1);
          const revert = (v: Video) => v.id === videoId
            ? { ...v, isSaved: wasSaved, stats: { ...v.stats, saves: revertSaves } }
            : v;
          set({
            videos: s.videos.map(revert),
            friendVideos: s.friendVideos.map(revert),
            savedVideos: wasSaved ? [...s.savedVideos, videoId] : s.savedVideos.filter(id => id !== videoId),
          });
        }
      },

      getSavedVideos: () => {
        const { videos, savedVideos } = get();
        return videos.filter(video => savedVideos.includes(video.id));
      },

      // Follow actions
      toggleFollow: async (userId) => {
        const state = get();
        const wasFollowing = state.followingUsers.includes(userId);

        const revert = () => {
          set((s) => {
            const followUpdate = (video: Video) => video.user.id === userId
              ? { ...video, isFollowing: wasFollowing, user: { ...video.user, followers: video.user.followers } }
              : video;
            const followingUsers = wasFollowing ? [...s.followingUsers, userId] : s.followingUsers.filter(id => id !== userId);
            return {
              videos: s.videos.map(followUpdate),
              friendVideos: s.friendVideos.map(followUpdate),
              followingUsers
            };
          });
        };

        const authUser = useAuthStore.getState().user;
        if (!authUser?.id) {
          showToast('Please sign in to follow');
          return;
        }
        if (authUser.id === userId) return;

        // Optimistic update
        set((s) => {
          const newFollowingUsers = s.followingUsers.includes(userId)
            ? s.followingUsers.filter(id => id !== userId)
            : [...s.followingUsers, userId];
          const followUpdate = (video: Video) => video.user.id === userId
            ? {
                ...video,
                isFollowing: !video.isFollowing,
                user: {
                  ...video.user,
                  followers: video.isFollowing ? video.user.followers - 1 : video.user.followers + 1
                }
              }
            : video;
          return {
            videos: s.videos.map(followUpdate),
            friendVideos: s.friendVideos.map(followUpdate),
            followingUsers: newFollowingUsers
          };
        });

        try {
          const session = useAuthStore.getState().session;
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
          const endpoint = wasFollowing
            ? apiUrl(`/api/profiles/${userId}/unfollow`)
            : apiUrl(`/api/profiles/${userId}/follow`);
          const res = await fetch(endpoint, { method: 'POST', credentials: 'include', headers });
          if (!res.ok) throw new Error('Follow request failed');
          if (!wasFollowing) trackFollow(userId).catch(() => {});
        } catch {
          revert();
          showToast('Couldn’t follow. Please try again.');
        }
      },

      getFollowingUsers: () => {
        const { videos, followingUsers } = get();
        return videos
          .map(video => video.user)
          .filter(user => followingUsers.includes(user.id));
      },

      // Share actions – increment share count + refresh FYP eligibility
      shareVideo: async (videoId) => {
        const state = get();
        const video = state.getVideoById(videoId);
        if (!video) return;

        const newShares = video.stats.shares + 1;
        const updatedStats = { ...video.stats, shares: newShares };
        const shareUpdate = (v: Video) => v.id === videoId ? { ...v, stats: updatedStats } : v;
        set({
          videos: state.videos.map(shareUpdate),
          friendVideos: state.friendVideos.map(shareUpdate),
        });

        try {
          trackShare(videoId).catch(() => {});
          await refreshVideoFypStatus(videoId, updatedStats);
        } catch (err) {
          /* ignored */
        }
      },

      // Comment actions – persist to server, refresh FYP eligibility
      addComment: async (videoId, commentData) => {
        const state = get();
        const video = state.getVideoById(videoId);
        if (!video) return;

        const authUser = useAuthStore.getState().user;
        const session = useAuthStore.getState().session;
        if (!authUser?.id) return;

        // Optimistic update
        const tempId = `comment_${Date.now()}`;
        const newComment: Comment = {
          ...commentData,
          id: tempId,
          userId: authUser.id,
          username: authUser.username || authUser.email?.split('@')[0] || 'user',
          avatar: authUser.avatar || `https://ui-avatars.com/api/?name=${authUser.name || 'User'}`,
          time: 'just now',
          likes: 0,
          isLiked: false
        };
        
        const newCommentsCount = video.stats.comments + 1;
        const updatedStats = { ...video.stats, comments: newCommentsCount };
        const commentUpdate = (v: Video) => v.id === videoId
          ? { ...v, comments: [...v.comments, newComment], stats: updatedStats }
          : v;
        set({
          videos: state.videos.map(commentUpdate),
          friendVideos: state.friendVideos.map(commentUpdate),
        });

        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

          const res = await fetch(apiUrl(`/api/videos/${videoId}/comments`), {
            method: 'POST',
            credentials: 'include',
            headers,
            body: JSON.stringify({ text: commentData.text, parentId: (commentData as any).parentId || null }),
          });

          if (!res.ok) throw new Error('Comment failed');

          const body = await res.json();
          if (body?.comment?.id) {
            const realId = body.comment.id;
            const commentIdUpdate = (v: Video) => v.id === videoId
              ? { ...v, comments: v.comments.map(c => c.id === tempId ? { ...c, id: realId } : c) }
              : v;
            set(s => ({
              videos: s.videos.map(commentIdUpdate),
              friendVideos: s.friendVideos.map(commentIdUpdate),
            }));
          }

          trackComment(videoId, commentData.text).catch(() => {});
          await refreshVideoFypStatus(videoId, updatedStats);
        } catch (err) {
          /* revert optimistic update on failure */
          set(s => ({
            videos: s.videos.map(v => v.id === videoId
              ? { ...v, comments: v.comments.filter(c => c.id !== tempId), stats: { ...v.stats, comments: Math.max(0, v.stats.comments - 1) } }
              : v),
            friendVideos: s.friendVideos.map(v => v.id === videoId
              ? { ...v, comments: v.comments.filter(c => c.id !== tempId), stats: { ...v.stats, comments: Math.max(0, v.stats.comments - 1) } }
              : v),
          }));
        }
      },

      deleteComment: async (videoId, commentId) => {
        const commentDelUpdate = (video: Video) => video.id === videoId
          ? {
              ...video,
              comments: video.comments.filter(c => c.id !== commentId),
              stats: { ...video.stats, comments: Math.max(0, video.stats.comments - 1) }
            }
          : video;
        set((state) => ({
          videos: state.videos.map(commentDelUpdate),
          friendVideos: state.friendVideos.map(commentDelUpdate),
        }));
        try {
          const session = useAuthStore.getState().session;
          const headers: Record<string, string> = {};
          if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
          await fetch(apiUrl(`/api/videos/${videoId}/comments/${commentId}`), {
            method: 'DELETE',
            credentials: 'include',
            headers,
          });
        } catch (err) {
          /* ignored */
        }
      },

      toggleCommentLike: async (videoId, commentId) => {
        const state = get();
        const video = state.getVideoById(videoId);
        if (!video) return;
        
        const comment = video.comments.find(c => c.id === commentId);
        if (!comment) return;

        const wasLiked = comment.isLiked;
        const commentLikeUpdate = (v: Video) => v.id === videoId
          ? {
              ...v,
              comments: v.comments.map(c =>
                c.id === commentId
                  ? { ...c, isLiked: !wasLiked, likes: wasLiked ? c.likes - 1 : c.likes + 1 }
                  : c
              )
            }
          : v;
        set((s) => ({
          videos: s.videos.map(commentLikeUpdate),
          friendVideos: s.friendVideos.map(commentLikeUpdate),
        }));

        // Comment likes are UI-only for now (no dedicated server endpoint)
      },

      // Analytics
      incrementViews: async (videoId) => {
        const state = get();
        const video = state.getVideoById(videoId);
        if (!video) return;

        const newViews = video.stats.views + 1;
        const updatedStats = { ...video.stats, views: newViews };
        const viewsUpdate = (v: Video) => v.id === videoId ? { ...v, stats: updatedStats } : v;
        set({
          videos: state.videos.map(viewsUpdate),
          friendVideos: state.friendVideos.map(viewsUpdate),
        });

        try {
          const session = useAuthStore.getState().session;
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
          await fetch(apiUrl('/api/feed/track-view'), {
            method: 'POST',
            credentials: 'include',
            headers,
            body: JSON.stringify({ videoId }),
          }).catch(() => {});
          await refreshVideoFypStatus(videoId, updatedStats);
        } catch (err) {
          /* ignored */
        }
      },

      getTrendingVideos: () => {
        const { videos } = get();
        return [...videos].sort((a, b) => {
          const engagementA = (a.stats.likes + a.stats.comments + a.stats.shares) / (a.stats.views || 1);
          const engagementB = (b.stats.likes + b.stats.comments + b.stats.shares) / (b.stats.views || 1);
          return engagementB - engagementA;
        });
      },

      getRecommendedVideos: () => {
        const { videos, likedVideos, followingUsers: _followingUsers } = get();
        // Simple recommendation: show recent videos not seen/liked yet
        return videos
          .filter(video => !likedVideos.includes(video.id))
          .slice(0, 10);
      }
    }),
    {
      name: 'video-store-v6',
      partialize: (state) => ({
        videos: state.videos,
        friendVideos: state.friendVideos,
        likedVideos: state.likedVideos,
        savedVideos: state.savedVideos,
        followingUsers: state.followingUsers
      })
    }
  )
);
