import React, { useState } from 'react';
import { UserPlus, UserMinus, MessageCircle, Share2, MoreHorizontal, Flag, Ban, Bell, BellOff, X, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useVideoStore } from '../store/useVideoStore';
import { useAuthStore } from '../store/useAuthStore';
import { useSafetyStore } from '../store/useSafetyStore';
import ReportModal from './ReportModal';

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
  bio?: string;
  website?: string;
  location?: string;
  joinedDate?: string;
}

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onFollow: () => void;
}

export default function UserProfileModal({ isOpen, onClose, user, onFollow }: UserProfileModalProps) {
  const navigate = useNavigate();
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);
  
  const { videos } = useVideoStore();
  const { user: currentUser, session } = useAuthStore();
  const blockedUserIds = useSafetyStore((s) => s.blockedUserIds);
  const blockUser = useSafetyStore((s) => s.blockUser);
  const unblockUser = useSafetyStore((s) => s.unblockUser);
  
  const userVideos = videos.filter(video => video.user.id === user.id);
  const isOwnProfile = currentUser?.id === user.id;
  const isBlocked = blockedUserIds.includes(user.id);

  if (!isOpen) return null;

  const handleMessage = () => {
    onClose();
    navigate(`/inbox/${user.id}`);
  };

  const handleBlockUser = async () => {
    if (window.confirm(`Are you sure you want to block @${user.username}?`)) {
      const token = session?.access_token;
      if (token) {
        await fetch('/api/block-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ blockedUserId: user.id, action: 'block' }),
        }).catch(() => null);
      }
      blockUser(user.id);
      onClose();
    }
  };

  const handleReportUser = () => {
    setShowMoreOptions(false);
    setShowReportModal(true);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  };

  if (isBlocked) {
    return (
      <div className="fixed inset-0 z-modals bg-[#121212] flex items-center justify-center p-4">
        <div className="bg-[#121212] rounded-2xl p-6 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Ban className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-[#00f2ea] font-semibold mb-2">User Blocked</h3>
          <p className="text-[#00f2ea]/60 text-sm mb-4">
            You have blocked @{user.username}. You will no longer see their content.
          </p>
          <button
            onClick={async () => {
              const token = session?.access_token;
              if (token) {
                await fetch('/api/block-user', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ blockedUserId: user.id, action: 'unblock' }),
                }).catch(() => null);
              }
              unblockUser(user.id);
            }}
            className="px-4 py-2 bg-white text-[#00f2ea] rounded-lg hover:bg-white transition-colors"
          >
            Unblock User
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#121212]/95 flex items-end justify-center animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="w-full h-[90vh] bg-[#121212] rounded-t-3xl overflow-y-auto animate-in slide-in-from-bottom duration-300 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-[#121212]/95 backdrop-blur-sm border-b border-white/5">
          <h3 className="text-[#00f2ea] font-bold text-lg">{user.username}</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={handleShareProfile}
              className="p-2 text-[#00f2ea]/70 hover:text-[#00f2ea] transition-colors"
              aria-label="Share profile"
            >
              <Share2 size={24} />
            </button>
            <button 
              onClick={onClose} 
              className="p-2 -mr-2 text-[#00f2ea]/70 hover:text-[#00f2ea] transition-colors"
              aria-label="Close profile"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-4 pb-safe">
          {/* Profile Header */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-24 h-24 rounded-full mb-3 p-[2px] bg-gradient-to-tr from-[#00f2ea] to-[#00f2ea]">
              <div className="w-full h-full rounded-full border-2 border-[#121212] overflow-hidden bg-gray-800">
                <img 
                  src={user.avatar} 
                  alt={user.name} 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            
            <h2 className="text-xl font-bold text-[#00f2ea] flex items-center gap-1">
              @{user.username}
              {user.isVerified && (
                <div className="bg-[#00f2ea] rounded-full p-[2px]">
                   <div className="w-2 h-2 bg-white rounded-full"></div> 
                </div>
              )}
            </h2>
            
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm text-[#00f2ea]/90 font-medium">{user.name}</span>
              {user.level && (
                <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-bold text-[#00f2ea] border border-[#00f2ea]/30">
                  LV {user.level}
                </span>
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-8 mt-6 w-full justify-center border-b border-white/5 pb-6">
              <div className="flex flex-col items-center">
                <span className="font-bold text-lg text-[#00f2ea]">{formatNumber(user.following)}</span>
                <span className="text-xs text-[#00f2ea]/50">Following</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-bold text-lg text-[#00f2ea]">{formatNumber(user.followers)}</span>
                <span className="text-xs text-[#00f2ea]/50">Followers</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-bold text-lg text-[#00f2ea]">{userVideos.length}</span>
                <span className="text-xs text-[#00f2ea]/50">Videos</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 w-full mt-6 px-4">
              {!isOwnProfile && (
                <>
                  {user.isFollowing ? (
                     <button
                       onClick={onFollow}
                       className="flex-1 h-9 flex items-center justify-center bg-white/10 text-[#00f2ea] rounded-lg font-semibold text-sm hover:bg-white/20 transition-colors"
                     >
                       Following
                     </button>
                  ) : (
                    <button
                      onClick={onFollow}
                      className="flex-1 h-9 flex items-center justify-center bg-[#00f2ea] text-black rounded-lg font-semibold text-sm hover:bg-[#00f2ea]/90 transition-colors"
                    >
                      Follow
                    </button>
                  )}
                  
                  <button
                    onClick={handleMessage}
                    className="flex-1 h-9 flex items-center justify-center bg-white/10 text-[#00f2ea] rounded-lg font-semibold text-sm hover:bg-white/20 transition-colors"
                  >
                    Message
                  </button>

                  <button
                    onClick={() => setShowMoreOptions(!showMoreOptions)}
                    className="w-9 h-9 flex items-center justify-center bg-white/10 text-[#00f2ea] rounded-lg hover:bg-white/20 transition-colors relative"
                  >
                    <MoreHorizontal size={20} />
                    
                    {showMoreOptions && (
                      <div className="absolute top-full right-0 mt-2 w-48 bg-[#252525] rounded-xl shadow-xl border border-white/10 z-50 overflow-hidden">
                        <button
                          onClick={handleReportUser}
                          className="w-full px-4 py-3 text-left text-sm text-[#00f2ea] hover:bg-white/5 flex items-center gap-2"
                        >
                          <Flag size={16} /> Report
                        </button>
                        <button
                          onClick={handleBlockUser}
                          className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-white/5 flex items-center gap-2 border-t border-white/5"
                        >
                          <Ban size={16} /> Block
                        </button>
                      </div>
                    )}
                  </button>
                </>
              )}
            </div>

            {/* Bio */}
            {user.bio && (
              <p className="mt-6 text-sm text-[#00f2ea]/80 text-center px-4 leading-relaxed max-w-md">
                {user.bio}
              </p>
            )}
            
            {(user.location || user.website || user.joinedDate) && (
               <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs text-[#00f2ea]/50">
                  {user.location && <span>📍 {user.location}</span>}
                  {user.joinedDate && <span>📅 Joined {formatDate(user.joinedDate)}</span>}
                  {user.website && (
                    <a
                      href={user.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#00f2ea] text-sm hover:underline"
                    >
                      {user.website}
                    </a>
                  )}
               </div>
            )}
          </div>

          {/* Video Grid */}
          <div className="mt-2 border-t border-white/10">
            <div className="flex items-center justify-center py-3 border-b border-white/10">
               <div className="flex items-center gap-2 text-[#00f2ea] font-semibold">
                 <div className="w-0.5 h-4 bg-[#00f2ea]"></div>
                 <span>Videos</span>
               </div>
            </div>
            
            {userVideos.length > 0 ? (
              <div className="grid grid-cols-3 gap-0.5 mt-0.5">
                {userVideos.map((video) => (
                  <div key={video.id} className="aspect-[3/4] bg-gray-900 relative">
                    <img 
                      src={video.thumbnail || video.url} 
                      alt={video.description} 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-1 left-1 text-xs font-bold text-[#00f2ea] drop-shadow-md flex items-center gap-1">
                      <Play size={10} fill="white" />
                      {formatNumber(video.stats?.views || 0)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-[#00f2ea]/40 text-sm">
                No videos yet
              </div>
            )}
          </div>
        </div>
      </div>

      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        videoId=""
        contentType="user"
        contentId={user.id}
      />
    </div>
  );

  function handleShareProfile() {
    const profileUrl = `${window.location.origin}/profile/${user.username}`;
    if (navigator.share) {
      navigator.share({
        title: `Check out ${user.name}'s profile`,
        text: `Check out ${user.name} (@${user.username}) on Elix Star${user.bio ? ` - ${user.bio}` : ''}`,
        url: profileUrl,
      });
    } else {
      navigator.clipboard.writeText(profileUrl);
      alert('Profile link copied to clipboard!');
    }
  }
}
