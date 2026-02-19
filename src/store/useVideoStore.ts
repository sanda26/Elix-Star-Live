import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
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
}

interface VideoStore {
  videos: Video[];
  likedVideos: string[];
  savedVideos: string[];
  followingUsers: string[];
  loading: boolean;
  
  // Video actions
  fetchVideos: () => Promise<void>;
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
      likedVideos: [],
      savedVideos: [],
      followingUsers: [],
      loading: false,

      fetchVideos: async () => {
        set({ loading: true });
        try {
          const feedResult = await fetchForYouFeed(1, 50);

          if (feedResult.videos && feedResult.videos.length > 0) {
            const mappedVideos: Video[] = feedResult.videos;
            const likedIds = mappedVideos.filter(v => v.isLiked).map(v => v.id);

            const fetchedIds = new Set(mappedVideos.map((v) => v.id));
            const existing = get().videos;
            const toPrepend = existing.filter((v) => !fetchedIds.has(v.id));
            const merged = toPrepend.length ? [...toPrepend, ...mappedVideos] : mappedVideos;

            set({ videos: merged, likedVideos: likedIds, loading: false });
            return;
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let data: any[] = [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let err: any = null;
          const baseSelect = `*, user:users ( id, username, display_name, avatar_url, is_creator )`;
          const profileSelect = `*, user:profiles!user_id ( user_id, username, display_name, avatar_url, is_creator )`;

          // 1. Try fetching all public videos sorted by creation time (newest first)
          let res = await supabase
            .from('videos')
            .select(`
              *,
              user:users ( id, username, display_name, avatar_url ),
              likes:likes ( count )
            `)
            .eq('is_public', true)
            .order('created_at', { ascending: false });

          // 2. Fallback for profile relation if different join syntax needed
          if (res.error) {
             console.log('Trying alternate query for videos...');
             res = await supabase
                .from('videos')
                .select(`
                  id, url, thumbnail_url, description, created_at, is_public,
                  user_id,
                  user:profiles!user_id ( id, username, display_name, avatar_url )
                `)
                .eq('is_public', true)
                .order('created_at', { ascending: false });
          }

          data = res.data || [];

          if (data.length === 0) {
            data = [
              {
                id: 'mock-cartoon-1',
                url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                thumbnail_url: 'https://picsum.photos/400/600?random=901',
                caption: 'Demo cartoon 1 🐰',
                views: 0,
                likes: 0,
                comments_count: 0,
                shares_count: 0,
                created_at: new Date().toISOString(),
                user: {
                  id: 'demo',
                  username: 'demo',
                  display_name: 'Demo',
                  avatar_url: 'https://i.pravatar.cc/150?u=demo',
                  is_creator: true
                }
              },
              {
                id: 'mock-cartoon-2',
                url: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
                thumbnail_url: 'https://picsum.photos/400/600?random=902',
                caption: 'Demo cartoon 2 🎬',
                views: 0,
                likes: 0,
                comments_count: 0,
                shares_count: 0,
                created_at: new Date(Date.now() - 60_000).toISOString(),
                user: {
                  id: 'demo',
                  username: 'demo',
                  display_name: 'Demo',
                  avatar_url: 'https://i.pravatar.cc/150?u=demo',
                  is_creator: true
                }
              },
              {
                id: 'mock-cartoon-3',
                url: 'https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4',
                thumbnail_url: 'https://picsum.photos/400/600?random=903',
                caption: 'Demo cartoon 3 ⚔️',
                views: 0,
                likes: 0,
                comments_count: 0,
                shares_count: 0,
                created_at: new Date(Date.now() - 120_000).toISOString(),
                user: {
                  id: 'demo',
                  username: 'demo',
                  display_name: 'Demo',
                  avatar_url: 'https://i.pravatar.cc/150?u=demo',
                  is_creator: true
                }
              },
              {
                id: 'mock-cartoon-4',
                url: 'https://download.blender.org/ED/ed_1024.mp4',
                thumbnail_url: 'https://picsum.photos/400/600?random=904',
                caption: 'Demo cartoon 4 🤖',
                views: 0,
                likes: 0,
                comments_count: 0,
                shares_count: 0,
                created_at: new Date(Date.now() - 180_000).toISOString(),
                user: {
                  id: 'demo',
                  username: 'demo',
                  display_name: 'Demo',
                  avatar_url: 'https://i.pravatar.cc/150?u=demo',
                  is_creator: true
                }
              },
              {
                id: 'mock-cartoon-5',
                url: 'https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_640x360.m4v',
                thumbnail_url: 'https://picsum.photos/400/600?random=905',
                caption: 'Demo cartoon 5 🌸',
                views: 0,
                likes: 0,
                comments_count: 0,
                shares_count: 0,
                created_at: new Date(Date.now() - 240_000).toISOString(),
                user: {
                  id: 'demo',
                  username: 'demo',
                  display_name: 'Demo',
                  avatar_url: 'https://i.pravatar.cc/150?u=demo',
                  is_creator: true
                }
              }
            ];
          }

          err = res.error;

          if (err && data.length === 0) throw err;

          let likedIds: string[] = [];
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: likes } = await supabase.from('likes').select('video_id').eq('user_id', user.id);
              likedIds = likes?.map((r: { video_id: string }) => r.video_id) ?? [];
            }
          } catch {
            // ignore
          }
          const likedSet = new Set(likedIds);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mappedVideos: Video[] = data.map((v: any) => {
            const u = v.user || {};
            const uid = u?.user_id ?? u?.id ?? v.user_id ?? 'unknown';
            const uname = u?.username ?? 'user';
            
            return {
              id: v.id,
              url: v.url, 
              thumbnail: v.thumbnail_url || 'https://picsum.photos/400/600',
              duration: '0:15',
              user: {
                id: uid,
                username: uname,
                name: u?.display_name ?? uname,
                avatar: u?.avatar_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(uname)}`,
                level: 1,
                isVerified: !!u?.is_creator,
                followers: 0,
                following: 0
              },
              description: v.description || '',
              hashtags: [],
              music: { id: 'original', title: 'Original Sound', artist: u?.display_name ?? uname, duration: '0:15' },
              stats: { 
                  views: v.views || 0, 
                  likes: v.likes || 0, 
                  comments: v.comments || 0, 
                  shares: v.shares || 0, 
                  saves: 0 
              },
              createdAt: v.created_at,
              location: 'For You',
              isLiked: likedSet.has(v.id),
              isSaved: false,
              isFollowing: false,
              comments: [],
              quality: 'auto',
              privacy: v.is_public ? 'public' : 'private'
            };
          });

          const fetchedIds = new Set(mappedVideos.map((v) => v.id));
          const existing = get().videos;
          const toPrepend = existing.filter((v) => !fetchedIds.has(v.id));
          const merged = toPrepend.length ? [...toPrepend, ...mappedVideos] : mappedVideos;

          set({ videos: merged, likedVideos: likedIds, loading: false });
        } catch (err) {
          console.error('Error fetching videos:', err);
          set({ loading: false });
        }
      },

      // Video actions
      addVideo: (video) => set((state) => ({ 
        videos: [video, ...state.videos] 
      })),
      
      removeVideo: (videoId) => set((state) => ({
        videos: state.videos.filter(video => video.id !== videoId)
      })),
      
      updateVideo: (videoId, updates) => set((state) => ({
        videos: state.videos.map(video => 
          video.id === videoId ? { ...video, ...updates } : video
        )
      })),

      deleteVideo: async (videoId) => {
        const snapshot = get().videos;
        try {
          if (videoId.startsWith('mock-')) {
            set({ videos: get().videos.filter((v) => v.id !== videoId) });
            return;
          }

          const { data: auth } = await supabase.auth.getUser();
          const user = auth.user;
          if (!user) {
            throw new Error('Please sign in to delete videos.');
          }

          const { data: row, error: rowError } = await supabase
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
            await supabase.storage.from('user-content').remove(keys).catch(() => {});
          }

          const { error: deleteError } = await supabase.from('videos').delete().eq('id', videoId).eq('user_id', user.id);
          if (deleteError) {
            throw new Error(deleteError.message || 'Failed to delete video.');
          }

          set({ videos: get().videos.filter((v) => v.id !== videoId) });
        } catch (err) {
          console.error('deleteVideo failed:', err);
          set({ videos: snapshot });
          throw err instanceof Error ? err : new Error('Failed to delete video.');
        }
      },

      // Like actions (persist to likes table + update video engagement / FYP eligibility)
      toggleLike: async (videoId) => {
        const state = get();
        const video = state.videos.find(v => v.id === videoId);
        if (!video) return;

        const wasLiked = video.isLiked;
        const newLikes = wasLiked ? video.stats.likes - 1 : video.stats.likes + 1;
        const updatedStats = { ...video.stats, likes: newLikes };
        const score = calculateEngagementScore(updatedStats);
        const eligible = isEligibleForFyp(score);

        const newLikedVideos = wasLiked
          ? state.likedVideos.filter(id => id !== videoId)
          : [...state.likedVideos, videoId];

        set({
          videos: state.videos.map(v =>
            v.id === videoId
              ? { ...v, isLiked: !wasLiked, stats: updatedStats }
              : v
          ),
          likedVideos: newLikedVideos
        });

        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          if (wasLiked) {
            await supabase.from('likes').delete().eq('video_id', videoId).eq('user_id', user.id);
          } else {
            await supabase.from('likes').insert({ video_id: videoId, user_id: user.id });
            trackLike(videoId).catch(() => {});
          }
          await supabase
            .from('videos')
            .update({
              likes: newLikes,
              engagement_score: score,
              is_eligible_for_fyp: eligible
            })
            .eq('id', videoId);
        } catch (err) {
          console.error('toggleLike persist failed:', err);
          set({ videos: state.videos, likedVideos: state.likedVideos });
        }
      },

      getLikedVideos: () => {
        const { videos, likedVideos } = get();
        return videos.filter(video => likedVideos.includes(video.id));
      },

      // Save actions
      toggleSave: (videoId) => set((state) => {
        const video = state.videos.find(v => v.id === videoId);
        if (!video) return state;

        const isSaved = video.isSaved;
        const newSavedVideos = isSaved 
          ? state.savedVideos.filter(id => id !== videoId)
          : [...state.savedVideos, videoId];

        return {
          videos: state.videos.map(v => 
            v.id === videoId 
              ? { 
                  ...v, 
                  isSaved: !isSaved,
                  stats: {
                    ...v.stats,
                    saves: isSaved ? v.stats.saves - 1 : v.stats.saves + 1
                  }
                }
              : v
          ),
          savedVideos: newSavedVideos
        };
      }),

      getSavedVideos: () => {
        const { videos, savedVideos } = get();
        return videos.filter(video => savedVideos.includes(video.id));
      },

      // Follow actions
      toggleFollow: async (userId) => {
        const state = get();
        const wasFollowing = state.followingUsers.includes(userId);
        
        // Update local state immediately (optimistic)
        set((s) => {
          const newFollowingUsers = s.followingUsers.includes(userId)
            ? s.followingUsers.filter(id => id !== userId)
            : [...s.followingUsers, userId];

          return {
            videos: s.videos.map(video =>
              video.user.id === userId
                ? {
                    ...video,
                    isFollowing: !video.isFollowing,
                    user: {
                      ...video.user,
                      followers: video.isFollowing
                        ? video.user.followers - 1
                        : video.user.followers + 1
                    }
                  }
                : video
            ),
            followingUsers: newFollowingUsers
          };
        });

        // Persist to DB
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return; // Should be logged in

          if (wasFollowing) {
             // Unfollow
             await supabase.from('followers').delete().eq('follower_id', user.id).eq('following_id', userId);
          } else {
             // Follow
             await supabase.from('followers').insert({ follower_id: user.id, following_id: userId });
             trackFollow(userId).catch(() => {});
          }
        } catch (err) {
          console.error('toggleFollow persist failed:', err);
          // Ideally revert state here, but for now we log error
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
        const video = state.videos.find(v => v.id === videoId);
        if (!video) return;

        const newShares = video.stats.shares + 1;
        const updatedStats = { ...video.stats, shares: newShares };

        set({
          videos: state.videos.map(v =>
            v.id === videoId
              ? { ...v, stats: updatedStats }
              : v
          )
        });

        try {
          trackShare(videoId).catch(() => {});
          await refreshVideoFypStatus(videoId, updatedStats);
        } catch (err) {
          console.error('shareVideo FYP refresh failed:', err);
        }
      },

      // Comment actions – also refresh FYP eligibility
      addComment: async (videoId, commentData) => {
        const state = get();
        const video = state.videos.find(v => v.id === videoId);
        if (!video) return;

        // Get current user for optimistic UI
        const { data: { user } } = await supabase.auth.getUser();
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

        set({
          videos: state.videos.map(v =>
            v.id === videoId
              ? { ...v, comments: [...v.comments, newComment], stats: updatedStats }
              : v
          )
        });

        try {
          // Persist to DB
          const { data: insertedComment, error } = await supabase
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
             set(s => ({
               videos: s.videos.map(v => 
                 v.id === videoId 
                   ? { 
                       ...v, 
                       comments: v.comments.map(c => c.id === tempId ? { ...c, id: insertedComment.id } : c) 
                     } 
                   : v
               )
             }));
          }

          trackComment(videoId, commentData.text).catch(() => {});
          await refreshVideoFypStatus(videoId, updatedStats);
        } catch (err) {
          console.error('addComment persist failed:', err);
          // Revert on error? For now just log.
        }
      },

      deleteComment: async (videoId, commentId) => {
        set((state) => ({
          videos: state.videos.map(video => 
            video.id === videoId 
              ? { 
                  ...video, 
                  comments: video.comments.filter(c => c.id !== commentId),
                  stats: {
                    ...video.stats,
                    comments: Math.max(0, video.stats.comments - 1)
                  }
                }
              : video
          )
        }));
        try {
          await supabase.from('comments').delete().eq('id', commentId);
        } catch (err) {
          console.error('deleteComment failed:', err);
        }
      },

      toggleCommentLike: async (videoId, commentId) => {
        const state = get();
        const video = state.videos.find(v => v.id === videoId);
        if (!video) return;
        
        const comment = video.comments.find(c => c.id === commentId);
        if (!comment) return;

        const wasLiked = comment.isLiked;

        set((state) => ({
          videos: state.videos.map(video => 
            video.id === videoId 
              ? {
                  ...video,
                  comments: video.comments.map(c => 
                    c.id === commentId 
                      ? { 
                          ...c, 
                          isLiked: !wasLiked,
                          likes: wasLiked ? c.likes - 1 : c.likes + 1
                        }
                      : c
                  )
                }
              : video
          )
        }));

        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          if (wasLiked) {
             await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', user.id);
          } else {
             await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: user.id });
          }
        } catch (err) {
          console.error('toggleCommentLike failed:', err);
        }
      },

      // Analytics
      incrementViews: async (videoId) => {
        const state = get();
        const video = state.videos.find(v => v.id === videoId);
        if (!video) return;

        const newViews = video.stats.views + 1;
        const updatedStats = { ...video.stats, views: newViews };

        set({
          videos: state.videos.map(v =>
            v.id === videoId
              ? { ...v, stats: updatedStats }
              : v
          )
        });

        try {
          // Persist view count to DB
          await supabase
            .from('videos')
            .update({ views: newViews })
            .eq('id', videoId);
          // Refresh FYP eligibility with new view count
          await refreshVideoFypStatus(videoId, updatedStats);
        } catch (err) {
          console.error('incrementViews persist failed:', err);
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
      name: 'video-store-v3',
      partialize: (state) => ({
        likedVideos: state.likedVideos,
        savedVideos: state.savedVideos,
        followingUsers: state.followingUsers
      })
    }
  )
);
