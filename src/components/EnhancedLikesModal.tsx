import React, { useState } from 'react';
import { X, UserPlus, UserMinus, MessageCircle, MoreHorizontal, Flag } from 'lucide-react';
import { useVideoStore } from '../store/useVideoStore';
import { useAuthStore } from '../store/useAuthStore';

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

// Dummy data - in a real app, this would come from the API
const DUMMY_LIKES: LikeUser[] = [
  { 
    id: '1', 
    username: 'dance_queen', 
    name: 'Sarah J.', 
    avatar: 'https://i.pravatar.cc/150?img=5', 
    isFollowing: false,
    isVerified: true,
    followers: 12500,
    following: 890,
    bio: 'Professional dancer 💃 | Choreographer | Dance instructor'
  },
  { 
    id: '2', 
    username: 'mike_moves', 
    name: 'Mike T.', 
    avatar: 'https://i.pravatar.cc/150?img=6', 
    isFollowing: true,
    isVerified: false,
    followers: 3400,
    following: 1200,
    bio: 'Dance enthusiast | Content creator | Always moving 🕺'
  },
  { 
    id: '3', 
    username: 'elix_fan', 
    name: 'Elix Fan', 
    avatar: 'https://i.pravatar.cc/150?img=7', 
    isFollowing: false,
    isVerified: false,
    followers: 890,
    following: 340,
    bio: 'Huge fan of Elix Star! 🌟'
  },
  { 
    id: '4', 
    username: 'beat_master', 
    name: 'Beat Master', 
    avatar: 'https://i.pravatar.cc/150?img=8', 
    isFollowing: true,
    isVerified: true,
    followers: 89000,
    following: 450,
    bio: 'Music producer | Beat maker | Sound engineer 🎵'
  },
  { 
    id: '5', 
    username: 'new_user_123', 
    name: 'New User', 
    avatar: 'https://i.pravatar.cc/150?img=9', 
    isFollowing: false,
    isVerified: false,
    followers: 45,
    following: 23,
    bio: 'Just getting started! 👋'
  },
  { 
    id: '6', 
    username: 'dance_pro', 
    name: 'Dance Pro', 
    avatar: 'https://i.pravatar.cc/150?img=10', 
    isFollowing: false,
    isVerified: true,
    followers: 25000,
    following: 1200,
    bio: 'Professional dancer for 10+ years | Studio owner | Teacher'
  },
  { 
    id: '7', 
    username: 'music_lover', 
    name: 'Music Lover', 
    avatar: 'https://i.pravatar.cc/150?img=11', 
    isFollowing: true,
    isVerified: false,
    followers: 5670,
    following: 890,
    bio: 'Music is life 🎶 | Always discovering new sounds'
  },
  { 
    id: '8', 
    username: 'content_creator', 
    name: 'Content Creator', 
    avatar: 'https://i.pravatar.cc/150?img=12', 
    isFollowing: false,
    isVerified: false,
    followers: 1200,
    following: 567,
    bio: 'Creating content that inspires ✨'
  }
];

export default function EnhancedLikesModal({ isOpen, onClose, likes }: LikesModalProps) {
  const [likesData, setLikesData] = useState(DUMMY_LIKES);
  const [showUserOptions, setShowUserOptions] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'following' | 'followers'>('all');
  
  const { toggleFollow } = useVideoStore();
  const { user: currentUser } = useAuthStore();
  
  const isOwnProfile = currentUser?.id === 'current_user'; // Adjust as needed

  if (!isOpen) return null;

  const handleFollowToggle = async (userId: string) => {
    // Update local state for immediate UI feedback
    setLikesData(prev => 
      prev.map(user => 
        user.id === userId 
          ? { 
              ...user, 
              isFollowing: !user.isFollowing,
              followers: user.isFollowing ? user.followers - 1 : user.followers + 1
            }
          : user
      )
    );
    
    // Call the store function
    toggleFollow(userId);
  };

  const handleMessage = (user: LikeUser) => {
    console.log('Opening chat with', user.username);
    // Navigate to chat or open messaging interface
  };

  const handleReportUser = (user: LikeUser) => {
    console.log('Reporting user:', user.username);
    // Open report modal for user
  };

  const handleBlockUser = (user: LikeUser) => {
    if (window.confirm(`Are you sure you want to block @${user.username}?`)) {
      console.log('Blocking user:', user.username);
      // Implement block functionality
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
      case 'followers':
        return matchesSearch && user.followers > 1000; // Example threshold
      default:
        return matchesSearch;
    }
  });

  return (
    <div className="fixed inset-0 z-modals bg-black flex items-end">
      <div className="w-full h-[80vh] bg-[#121212] rounded-t-2xl flex flex-col border-t border-transparent" style={{animation: 'slide-up 0.3s ease-out'}}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-transparent">
          <div>
            <h3 className="text-white font-semibold">Liked by</h3>
            <p className="text-white/60 text-sm">{likes.toLocaleString()} likes</p>
          </div>
          <button onClick={onClose} className="p-1 text-white/70 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Search and Filter */}
        <div className="p-4 border-b border-transparent space-y-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:bg-white border-none"
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
            {['all', 'following', 'followers'].map((filterType) => (
              <button
                key={filterType}
                onClick={() => setFilter(filterType as 'all' | 'following' | 'followers')}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  filter === filterType
                    ? 'bg-[#FE2C55] text-white'
                    : 'bg-black text-white/80 hover:brightness-125'
                }`}
              >
                {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto">
          {filteredLikes.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mx-auto mb-3">
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
                      {user.isVerified && (
                        <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-0.5">
                          <div className="w-3 h-3 bg-white rounded-full flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-white font-medium truncate">{user.name}</h4>
                        {user.isVerified && (
                          <div className="w-4 h-4 bg-blue-500 rounded-full flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-white/60 text-sm truncate">@{user.username}</p>
                      <p className="text-white/40 text-xs truncate">{user.bio}</p>
                      <div className="flex items-center gap-3 text-white/40 text-xs mt-1">
                        <span>{formatNumber(user.followers)} followers</span>
                        <span>•</span>
                        <span>{formatNumber(user.following)} following</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {!isOwnProfile && (
                        <>
                          {user.isFollowing ? (
                            <button
                              onClick={() => handleFollowToggle(user.id)}
                              className="px-3 py-1.5 bg-black text-white rounded-lg hover:brightness-125 transition-colors text-sm"
                            >
                              <UserMinus size={14} className="inline mr-1" />
                              Following
                            </button>
                          ) : (
                            <button
                              onClick={() => handleFollowToggle(user.id)}
                              className="px-3 py-1.5 bg-[#FE2C55] text-white rounded-lg hover:bg-[#FE2C55]/80 transition-colors text-sm"
                            >
                              <UserPlus size={14} className="inline mr-1" />
                              Follow
                            </button>
                          )}
                          
                          <button
                            onClick={() => handleMessage(user)}
                            className="p-2 bg-black text-white rounded-lg hover:brightness-125 transition-colors"
                          >
                            <MessageCircle size={14} />
                          </button>
                        </>
                      )}
                      
                      <div className="relative">
                        <button
                          onClick={() => setShowUserOptions(showUserOptions === user.id ? null : user.id)}
                          className="p-2 text-white/60 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                        
                        {showUserOptions === user.id && (
                          <div className="absolute top-full right-0 mt-1 bg-[#1a1a1a] rounded-lg shadow-xl border border-transparent z-10 min-w-[160px]">
                            <button
                              onClick={() => handleMessage(user)}
                              className="w-full flex items-center gap-3 px-3 py-2 text-white hover:bg-transparent transition-colors text-left text-sm"
                            >
                              <MessageCircle size={14} />
                              <span>Message</span>
                            </button>
                            
                            <button
                              onClick={() => handleReportUser(user)}
                              className="w-full flex items-center gap-3 px-3 py-2 text-orange-400 hover:bg-transparent transition-colors text-left text-sm"
                            >
                              <Flag size={14} />
                              <span>Report</span>
                            </button>
                            
                            <button
                              onClick={() => handleBlockUser(user)}
                              className="w-full flex items-center gap-3 px-3 py-2 text-red-400 hover:bg-transparent transition-colors text-left text-sm"
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
