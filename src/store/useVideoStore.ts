import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiStub } from '../lib/apiStub';
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
        set({ loading: true });
        try {
          const { videos: apiVideos } = await fetchForYouFeed(1, 50);

          // If backend has only the onboarding "upload your first video" clip
          // or no videos at all, replace feed with two local demo videos:
          // Big Buck Bunny + Sintel.
          const hasApiVideos = Array.isArray(apiVideos) && apiVideos.length > 0;
          // If there are 0 or only 1 videos from backend, treat it as "empty"
          // and show our 3 demo clips instead.
          const looksLikeOnboarding = !hasApiVideos || apiVideos!.length <= 1;

          const sourceVideos =
            !hasApiVideos || looksLikeOnboarding
              ? [
                  {
                    id: "demo-big-buck-bunny",
                    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                    thumbnail: "",
                    description: "Big Buck Bunny • demo video",
                    user: {
                      id: "demo-user-1",
                      username: "bigbunny",
                      name: "Big Buck Bunny",
                      avatar: "",
                      followers: 120,
                      following: 0,
                      isVerified: true,
                      level: 1,
                    },
                    hashtags: ["bigbuckbunny", "demo", "elixstar"],
                    music: {
                      id: "original",
                      title: "Original Sound",
                      artist: "Big Buck Bunny",
                      duration: "0:30",
                    },
                    stats: {
                      views: 120,
                      likes: 10,
                      comments: 0,
                      shares: 0,
                      saves: 0,
                    },
                    createdAt: new Date().toISOString(),
                  },
                  {
                    id: "demo-sintel",
                    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
                    thumbnail: "",
                    description: "Sintel • demo video",
                    user: {
                      id: "demo-user-2",
                      username: "sintel",
                      name: "Sintel",
                      avatar: "",
                      followers: 95,
                      following: 0,
                      isVerified: true,
                      level: 1,
                    },
                    hashtags: ["sintel", "demo", "elixstar"],
                    music: {
                      id: "original",
                      title: "Original Sound",
                      artist: "Sintel",
                      duration: "0:30",
                    },
                    stats: {
                      views: 95,
                      likes: 8,
                      comments: 0,
                      shares: 0,
                      saves: 0,
                    },
                    createdAt: new Date().toISOString(),
                  },
                  {
                    id: "demo-tears-of-steel",
                    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
                    thumbnail: "",
                    description: "Tears of Steel • demo video",
                    user: {
                      id: "demo-user-3",
                      username: "tearsofsteel",
                      name: "Tears of Steel",
                      avatar: "",
                      followers: 80,
                      following: 0,
                      isVerified: true,
                      level: 1,
                    },
                    hashtags: ["tearsofsteel", "demo", "elixstar"],
                    music: {
                      id: "original",
                      title: "Original Sound",
                      artist: "Tears of Steel",
                      duration: "0:30",
                    },
                    stats: {
                      views: 80,
                      likes: 6,
                      comments: 0,
                      shares: 0,
                      saves: 0,
                    },
                    createdAt: new Date().toISOString(),
                  },
                ]
              : apiVideos;

          const mappedVideos: Video[] = sourceVideos.map((v: any) => {
            const u = v.user || {};
            const stats = v.stats || {};
            const music = v.music || { id: 'original', title: 'Original Sound', artist: u.name || 'Creator', duration: '0:15' };
            const durationStr = typeof v.duration === 'number' ? `0:${String(v.duration).padStart(2, '0')}` : (v.duration || '0:15');
            return {
              id: v.id,
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
                isFollowing: !!u.isFollowing,
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
                saves: stats.saves ?? 0,
              },
              createdAt: v.createdAt || v.created_at || new Date().toISOString(),
              isLiked: !!v.isLiked,
              isSaved: !!v.isSaved,
              isFollowing: !!u.isFollowing,
              comments: [],
              quality: 'auto',
              privacy: 'public',
            };
          });

          set({ videos: mappedVideos, loading: false });
        } catch (err) {
          set({ videos: [], loading: false });
        }
      },

      fetchStemVideos: async () => {
        set({ stemLoading: true });
        try {
          const { data, error } = await apiStub
            .from('videos')
            .select('*')
            .eq('is_public', true)
            .gte('views', 10000)
            .order('views', { ascending: false })
            .limit(50);

          if (error || !data || data.length === 0) {
            set({ stemVideos: [], stemLoading: false });
            return;
          }

          const userIds = [...new Set(data.map((v: any) => v.user_id).filter(Boolean))];
          const profilesMap: Record<string, any> = {};
          if (userIds.length > 0) {
            const { data: profiles } = await apiStub
              .from('profiles')
              .select('user_id, username, display_name, avatar_url, is_creator, followers_count, following_count')
              .in('user_id', userIds);
            if (profiles) {
              profiles.forEach((p: any) => { profilesMap[p.user_id] = p; });
            }
          }

          let likedIds: string[] = [];
          let followedUserIds: string[] = [];
          let savedIds: string[] = [];
          let blockedUserIds: string[] = [];
          try {
            const { data: { user } } = await apiStub.auth.getUser();
            if (user) {
              const [{ data: likes }, { data: follows }, { data: saves }, { data: blocks }] = await Promise.all([
                apiStub.from('likes').select('video_id').eq('user_id', user.id),
                apiStub.from('followers').select('following_id').eq('follower_id', user.id),
                apiStub.from('saved_videos').select('video_id').eq('user_id', user.id),
                apiStub.from('blocked_users').select('blocked_id').eq('blocker_id', user.id),
              ]);
              likedIds = likes?.map((r: { video_id: string }) => r.video_id) ?? [];
              followedUserIds = follows?.map((r: { following_id: string }) => r.following_id) ?? [];
              savedIds = saves?.map((r: { video_id: string }) => r.video_id) ?? [];
              blockedUserIds = blocks?.map((r: { blocked_id: string }) => r.blocked_id) ?? [];
            }
          } catch {}
          const likedSet = new Set(likedIds);
          const followedSet = new Set(followedUserIds);
          const savedSet = new Set(savedIds);
          const blockedSet = new Set(blockedUserIds);

          const mappedVideos: Video[] = data
            .filter((v: any) => !blockedSet.has(v.user_id))
            .map((v: any) => {
              const p = profilesMap[v.user_id] || {};
              const displayName = p.display_name || p.username || 'Creator';
              const uname = p.username || p.display_name || 'creator';
              return {
                id: v.id,
                url: v.url,
                thumbnail: v.thumbnail_url || getVideoPosterUrl(v.url || ''),
                duration: '0:15',
                user: {
                  id: v.user_id || 'unknown',
                  username: uname,
                  name: displayName,
                  avatar: p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}`,
                  level: 1,
                  isVerified: !!p.is_creator,
                  followers: p.followers_count || 0,
                  following: p.following_count || 0
                },
                description: v.description || v.caption || '',
                hashtags: (() => {
                  if (v.hashtags && Array.isArray(v.hashtags) && v.hashtags.length > 0) return v.hashtags;
                  const text = v.description || v.caption || '';
                  const matches = text.match(/#[\w\u00C0-\u024F]+/g);
                  return matches ? matches.map((t: string) => t.slice(1)) : [];
                })(),
                music: { id: 'original', title: 'Original Sound', artist: displayName, duration: '0:15' },
                stats: {
                  views: v.views || 0,
                  likes: v.likes || 0,
                  comments: v.comments || 0,
                  shares: v.shares || 0,
                  saves: 0
                },
                createdAt: v.created_at,
                location: v.location || undefined,
                isLiked: likedSet.has(v.id),
                isSaved: savedSet.has(v.id),
                isFollowing: followedSet.has(v.user_id),
                comments: [],
                quality: 'auto',
                privacy: v.is_public ? 'public' : 'private',
                duetWithVideoId: v.duet_with_video_id || undefined
              };
            });

          set({ stemVideos: mappedVideos, stemLoading: false });
        } catch (err) {
          set({ stemLoading: false });
        }
      },

      fetchFriendVideos: async () => {
        set({ friendsLoading: true });
        try {
          const { data: { user: authUser } } = await apiStub.auth.getUser();
          if (!authUser?.id) {
            set({ friendVideos: [], friendsLoading: false });
            return;
          }
          const { data: followData } = await apiStub
            .from('followers')
            .select('following_id')
            .eq('follower_id', authUser.id);
          const followingIds = (followData ?? []).map((f: { following_id: string }) => f.following_id).filter(Boolean);
          if (followingIds.length === 0) {
            set({ friendVideos: [], friendsLoading: false });
            return;
          }
          const { data, error } = await apiStub
            .from('videos')
            .select('*')
            .eq('is_public', true)
            .in('user_id', followingIds)
            .order('created_at', { ascending: false })
            .limit(50);
          if (error || !data || data.length === 0) {
            set({ friendVideos: [], friendsLoading: false });
            return;
          }
          const userIds = [...new Set(data.map((v: any) => v.user_id).filter(Boolean))];
          const profilesMap: Record<string, any> = {};
          if (userIds.length > 0) {
            const { data: profiles } = await apiStub
              .from('profiles')
              .select('user_id, username, display_name, avatar_url, is_creator, followers_count, following_count')
              .in('user_id', userIds);
            if (profiles) {
              profiles.forEach((p: any) => { profilesMap[p.user_id] = p; });
            }
          }
          let likedIds: string[] = [];
          let followedUserIds: string[] = [];
          let savedIds: string[] = [];
          let blockedUserIds: string[] = [];
          try {
            const [{ data: likes }, { data: follows }, { data: saves }, { data: blocks }] = await Promise.all([
              apiStub.from('likes').select('video_id').eq('user_id', authUser.id),
              apiStub.from('followers').select('following_id').eq('follower_id', authUser.id),
              apiStub.from('saved_videos').select('video_id').eq('user_id', authUser.id),
              apiStub.from('blocked_users').select('blocked_id').eq('blocker_id', authUser.id),
            ]);
            likedIds = likes?.map((r: { video_id: string }) => r.video_id) ?? [];
            followedUserIds = follows?.map((r: { following_id: string }) => r.following_id) ?? [];
            savedIds = saves?.map((r: { video_id: string }) => r.video_id) ?? [];
            blockedUserIds = blocks?.map((r: { blocked_id: string }) => r.blocked_id) ?? [];
          } catch {}
          const likedSet = new Set(likedIds);
          const followedSet = new Set(followedUserIds);
          const savedSet = new Set(savedIds);
          const blockedSet = new Set(blockedUserIds);
          const mappedVideos: Video[] = data
            .filter((v: any) => !blockedSet.has(v.user_id))
            .map((v: any) => {
              const p = profilesMap[v.user_id] || {};
              const displayName = p.display_name || p.username || 'Creator';
              const uname = p.username || p.display_name || 'creator';
              return {
                id: v.id,
                url: v.url,
                thumbnail: v.thumbnail_url || getVideoPosterUrl(v.url || ''),
                duration: '0:15',
                user: {
                  id: v.user_id || 'unknown',
                  username: uname,
                  name: displayName,
                  avatar: p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}`,
                  level: 1,
                  isVerified: !!p.is_creator,
                  followers: p.followers_count || 0,
                  following: p.following_count || 0
                },
                description: v.description || v.caption || '',
                hashtags: (() => {
                  if (v.hashtags && Array.isArray(v.hashtags) && v.hashtags.length > 0) return v.hashtags;
                  const text = v.description || v.caption || '';
                  const matches = text.match(/#[\w\u00C0-\u024F]+/g);
                  return matches ? matches.map((t: string) => t.slice(1)) : [];
                })(),
                music: { id: 'original', title: 'Original Sound', artist: displayName, duration: '0:15' },
                stats: { views: v.views || 0, likes: v.likes || 0, comments: v.comments || 0, shares: v.shares || 0, saves: 0 },
                createdAt: v.created_at,
                location: v.location || undefined,
                isLiked: likedSet.has(v.id),
                isSaved: savedSet.has(v.id),
                isFollowing: followedSet.has(v.user_id),
                comments: [],
                quality: 'auto',
                privacy: v.is_public ? 'public' : 'private',
                duetWithVideoId: v.duet_with_video_id || undefined
              };
            });
          set({ friendVideos: mappedVideos, friendsLoading: false });
        } catch (err) {
          set({ friendVideos: [], friendsLoading: false });
        } finally {
          set((s) => (s.friendsLoading ? { friendsLoading: false } : {}));
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
          const { data: auth } = await apiStub.auth.getUser();
          const user = auth.user;
          if (!user) {
            throw new Error('Please sign in to delete videos.');
          }

          const { data: row, error: rowError } = await apiStub
            .from('videos')
            .select('id,user_id,url,thumbnail_url')
            .eq('id', videoId)
            .single();

          if (rowError || !row) {
            throw new Error('Video not found.');
          }
          if (row.user_id !== user.id) {
            throw new Error('You can only delete your own videos.');
          }

          const extractObjectKey = (rawUrl: string | null | undefined) => {
            if (!rawUrl) return null;
            try {
              const u = new URL(rawUrl);
              const p = u.pathname;
              const marker = '/user-content/';
              const idx = p.indexOf(marker);
              if (idx === -1) return null;
              return decodeURIComponent(p.slice(idx + marker.length));
            } catch {
              const marker = 'user-content/';
              const idx = rawUrl.indexOf(marker);
              if (idx === -1) return null;
              return rawUrl.slice(idx + marker.length);
            }
          };

          const keys = [extractObjectKey(row.url), extractObjectKey(row.thumbnail_url)].filter(
            (k): k is string => !!k
          );
          if (keys.length) {
            await apiStub.storage.from('user-content').remove(keys).catch(() => {});
          }

          const { error: deleteError } = await apiStub.from('videos').delete().eq('id', videoId).eq('user_id', user.id);
          if (deleteError) {
            throw new Error(deleteError.message || 'Failed to delete video.');
          }

          set({ videos: get().videos.filter((v) => v.id !== videoId), friendVideos: get().friendVideos.filter((v) => v.id !== videoId) });
        } catch (err) {
          set({ videos: snapshot.videos, friendVideos: snapshot.friendVideos });
          throw err instanceof Error ? err : new Error('Failed to delete video.');
        }
      },

      // Like actions (persist to likes table + update video engagement / FYP eligibility)
      toggleLike: async (videoId) => {
        const state = get();
        const video = state.getVideoById(videoId);
        if (!video) return;

        const wasLiked = video.isLiked;
        const newLikes = Math.max(0, wasLiked ? video.stats.likes - 1 : video.stats.likes + 1);
        const updatedStats = { ...video.stats, likes: newLikes };
        const score = calculateEngagementScore(updatedStats);
        const eligible = isEligibleForFyp(score);

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
          const { data: { user } } = await apiStub.auth.getUser();
          if (!user) return;
          if (wasLiked) {
            await apiStub.from('likes').delete().eq('video_id', videoId).eq('user_id', user.id);
          } else {
            await apiStub.from('likes').insert({ video_id: videoId, user_id: user.id });
            trackLike(videoId).catch(() => {});
          }
          await apiStub
            .from('videos')
            .update({
              likes: newLikes,
              engagement_score: score,
              is_eligible_for_fyp: eligible
            })
            .eq('id', videoId);
        } catch (err) {
          set({ videos: state.videos, friendVideos: state.friendVideos, likedVideos: state.likedVideos });
        }
      },

      getLikedVideos: () => {
        const { videos, likedVideos } = get();
        return videos.filter(video => likedVideos.includes(video.id));
      },

      // Save actions — persist (feature disabled)
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
          const { data: { user } } = await apiStub.auth.getUser();
          if (!user) return;
          if (wasSaved) {
            await apiStub.from('saved_videos').delete().eq('user_id', user.id).eq('video_id', videoId);
          } else {
            await apiStub.from('saved_videos').insert({ user_id: user.id, video_id: videoId });
          }
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

        const { data: { user } } = await apiStub.auth.getUser();
        if (!user) {
          showToast('Please sign in to follow');
          return;
        }
        if (user.id === userId) return; // can't follow self

        // Update local state immediately (optimistic)
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
          if (wasFollowing) {
            const { error } = await apiStub.from('followers').delete().eq('follower_id', user.id).eq('following_id', userId);
            if (error) throw error;
          } else {
            const { error } = await apiStub.from('followers').insert({ follower_id: user.id, following_id: userId });
            if (error && error.code !== '23505') throw error; // 23505 = unique, already following
            if (!error) trackFollow(userId).catch(() => {});
          }
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

      // Comment actions – also refresh FYP eligibility
      addComment: async (videoId, commentData) => {
        const state = get();
        const video = state.getVideoById(videoId);
        if (!video) return;

        // Get current user for optimistic UI
        const { data: { user } } = await apiStub.auth.getUser();
        if (!user) return; // Must be logged in

        // Optimistic update
        const tempId = `comment_${Date.now()}`;
        const newComment: Comment = {
          ...commentData,
          id: tempId,
          userId: user.id,
          username: user.user_metadata.username || 'user',
          avatar: user.user_metadata.avatar_url || `https://ui-avatars.com/api/?name=${user.email}`,
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
          // Persist to DB
          const { data: insertedComment, error } = await apiStub
            .from('comments')
            .insert({
              video_id: videoId,
              user_id: user.id,
              text: commentData.text
            })
            .select()
            .single();

          if (error) throw error;

          // Update the optimistic comment with real ID
          if (insertedComment) {
             const commentIdUpdate = (v: Video) => v.id === videoId
               ? { ...v, comments: v.comments.map(c => c.id === tempId ? { ...c, id: insertedComment.id } : c) }
               : v;
             set(s => ({
               videos: s.videos.map(commentIdUpdate),
               friendVideos: s.friendVideos.map(commentIdUpdate),
             }));
          }

          trackComment(videoId, commentData.text).catch(() => {});
          await refreshVideoFypStatus(videoId, updatedStats);
        } catch (err) {
          /* ignored */
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
          await apiStub.from('comments').delete().eq('id', commentId);
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

        try {
          const { data: { user } } = await apiStub.auth.getUser();
          if (!user) return;

          if (wasLiked) {
             await apiStub.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', user.id);
          } else {
             await apiStub.from('comment_likes').insert({ comment_id: commentId, user_id: user.id });
          }
        } catch (err) {
          /* ignored */
        }
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
          // Persist view count to DB
          await apiStub
            .from('videos')
            .update({ views: newViews })
            .eq('id', videoId);
          // Refresh FYP eligibility with new view count
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
      name: 'video-store-v4',
      partialize: (state) => ({
        likedVideos: state.likedVideos,
        savedVideos: state.savedVideos,
        followingUsers: state.followingUsers
      })
    }
  )
);
