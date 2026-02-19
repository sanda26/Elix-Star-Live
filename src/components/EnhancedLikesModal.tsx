import React, { useState, useEffect } from 'react';
import { X, UserPlus, UserMinus, MessageCircle, MoreHorizontal, Flag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useVideoStore } from '../store/useVideoStore';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';

interface LikeUser {
  id: string;
  username: string;
  name: string;
  avatar: string;
  isFollowing: boolean;
  isVerified?: boolean;
  followers: number;
  following: number;
  bio?: string;
}

interface LikesModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string;
  likes: number;
}

export default function EnhancedLikesModal({ isOpen, onClose, videoId, likes }: LikesModalProps) {
  const navigate = useNavigate();
  const [likesData, setLikesData] = useState<LikeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUserOptions, setShowUserOptions] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'following' | 'followers'>('all');
  
  const { toggleFollow } = useVideoStore();
  const { user: currentUser } = useAuthStore();

  useEffect(() => {
    if (isOpen && videoId) {
      loadLikes();
    }
  }, [isOpen, videoId]);

  const loadLikes = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('likes')
        .select('user_id, profiles(user_id, username, display_name, avatar_url, bio)')
        .eq('video_id', videoId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (data) {
        const currentUserId = currentUser?.id;
        let followingIds: Set<string> = new Set();
        if (currentUserId) {
          const { data: follows } = await supabase
            .from('followers')
            .select('following_id')
            .eq('follower_id', currentUserId);
          if (follows) followingIds = new Set(follows.map((f: any) => f.following_id));
        }

        const mapped: LikeUser[] = data
          .filter((d: any) => d.profiles)
          .map((d: any) => ({
            id: d.profiles.user_id,
            username: d.profiles.username || 'user',
            name: d.profiles.display_name || d.profiles.username || 'User',
            avatar: d.profiles.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(d.profiles.username || 'U')}&background=1C1E24&color=C9A96E`,
            isFollowing: followingIds.has(d.profiles.user_id),
            followers: 0,
            following: 0,
            bio: d.profiles.bio || '',
          }));
        setLikesData(mapped);
      }
    } catch {
      // Table may not exist — show empty
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleFollowToggle = async (userId: string) => {
    setLikesData(prev => 
      prev.map(user => 
        user.id === userId 
          ? { ...user, isFollowing: !user.isFollowing }
          : user
      )
    );
    toggleFollow(userId);
  };

  const handleMessage = (user: LikeUser) => {
    onClose();
    navigate(`/inbox/${user.id}`);
  };

  const handleReportUser = (user: LikeUser) => {
    onClose();
    navigate(`/report?type=user&id=${user.id}`);
  };

  const handleBlockUser = (user: LikeUser) => {
    if (window.confirm(`Are you sure you want to block @${user.username}?`)) {
      onClose();
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const filteredLikes = likesData.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.username.toLowerCase().includes(searchTerm.toLowerCase());
    
    switch (filter) {
      case 'following':
        return matchesSearch && user.isFollowing;
      default:
        return matchesSearch;
    }
  });

  return (
    <div className="fixed inset-0 z-modals bg-[#13151A] flex items-end">
      <div className="w-full h-[80vh] bg-[#13151A] rounded-t-2xl flex flex-col border-t border-transparent" style={{animation: 'slide-up 0.3s ease-out'}}>
        <div className="flex items-center justify-between p-4 border-b border-transparent">
          <div>
            <h3 className="text-white font-semibold">Liked by</h3>
            <p className="text-white/60 text-sm">{likes.toLocaleString()} likes</p>
          </div>
          <button onClick={onClose} className="p-1 text-white/70 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-transparent space-y-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#1C1E24] text-white rounded-lg px-4 py-2 text-sm focus:outline-none border border-white/10"
              title="Search users"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white"
              >
                <X size={16} />
              </button>
            )}
          </div>
          
          <div className="flex gap-2">
            {['all', 'following'].map((filterType) => (
              <button
                key={filterType}
                onClick={() => setFilter(filterType as 'all' | 'following')}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  filter === filterType
                    ? 'bg-[#C9A96E] text-black'
                    : 'bg-[#1C1E24] text-white/80 hover:brightness-125'
                }`}
              >
                {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-[#C9A96E]/30 border-t-[#C9A96E] rounded-full animate-spin" />
            </div>
          ) : filteredLikes.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-[#1C1E24] rounded-full flex items-center justify-center mx-auto mb-3">
                <UserPlus className="w-6 h-6 text-white/60" />
              </div>
              <p className="text-white/60">No users found</p>
              <p className="text-white/40 text-sm">Try adjusting your search or filter</p>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {filteredLikes.map((user) => (
                <div key={user.id} className="p-4 hover:bg-transparent transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-medium truncate">{user.name}</h4>
                      <p className="text-white/60 text-sm truncate">@{user.username}</p>
                      {user.bio && <p className="text-white/40 text-xs truncate">{user.bio}</p>}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {currentUser?.id !== user.id && (
                        <>
                          {user.isFollowing ? (
                            <button
                              onClick={() => handleFollowToggle(user.id)}
                              className="px-3 py-1.5 bg-[#1C1E24] text-white rounded-lg hover:brightness-125 transition-colors text-sm"
                            >
                              <UserMinus size={14} className="inline mr-1" />
                              Following
                            </button>
                          ) : (
                            <button
                              onClick={() => handleFollowToggle(user.id)}
                              className="px-3 py-1.5 bg-[#C9A96E] text-black rounded-lg hover:bg-[#C9A96E]/80 transition-colors text-sm"
                            >
                              <UserPlus size={14} className="inline mr-1" />
                              Follow
                            </button>
                          )}
                          
                          <button
                            onClick={() => handleMessage(user)}
                            className="p-2 bg-[#1C1E24] text-white rounded-lg hover:brightness-125 transition-colors"
                            title="Message"
                          >
                            <MessageCircle size={14} />
                          </button>
                        </>
                      )}
                      
                      <div className="relative">
                        <button
                          onClick={() => setShowUserOptions(showUserOptions === user.id ? null : user.id)}
                          className="p-2 text-white/60 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                          title="More options"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                        
                        {showUserOptions === user.id && (
                          <div className="absolute top-full right-0 mt-1 bg-[#1C1E24] rounded-lg shadow-xl border border-white/10 z-10 min-w-[160px]">
                            <button
                              onClick={() => handleMessage(user)}
                              className="w-full flex items-center gap-3 px-3 py-2 text-white hover:bg-white/5 transition-colors text-left text-sm"
                            >
                              <MessageCircle size={14} />
                              <span>Message</span>
                            </button>
                            <button
                              onClick={() => handleReportUser(user)}
                              className="w-full flex items-center gap-3 px-3 py-2 text-white hover:bg-white/5 transition-colors text-left text-sm"
                            >
                              <Flag size={14} />
                              <span>Report</span>
                            </button>
                            <button
                              onClick={() => handleBlockUser(user)}
                              className="w-full flex items-center gap-3 px-3 py-2 text-red-400 hover:bg-white/5 transition-colors text-left text-sm"
                            >
                              <div className="w-3 h-3 bg-red-400 rounded-full" />
                              <span>Block</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
