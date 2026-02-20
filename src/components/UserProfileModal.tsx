import React, { useState } from 'react';
import { UserPlus, UserMinus, MessageCircle, Share2, MoreHorizontal, Flag, Ban, Bell, BellOff, X, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useVideoStore } from '../store/useVideoStore';
import { useAuthStore } from '../store/useAuthStore';
import { AvatarRing } from './AvatarRing';
import { useSafetyStore } from '../store/useSafetyStore';
import ReportModal from './ReportModal';
import { showToast } from '../lib/toast';

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
      <div className="fixed inset-0 z-modals bg-[#13151A] flex items-center justify-center p-4">
        <div className="bg-[#13151A] rounded-2xl p-6 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Ban className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-white font-semibold mb-2">User Blocked</h3>
          <p className="text-white/60 text-sm mb-4">
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
            className="px-4 py-2 bg-white text-white rounded-lg hover:bg-white transition-colors"
          >
            Unblock User
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="w-full max-w-[480px] bg-[#1C1E24]/95 rounded-t-2xl overflow-y-auto animate-in slide-in-from-bottom duration-300 relative border-2 border-b-0 border-[#C9A96E]"
        style={{ marginBottom: '90px', maxHeight: 'calc(100dvh - 90px - 50px)', boxShadow: '0 -4px 30px rgba(201,169,110,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-[#1C1E24]/95 backdrop-blur-sm border-b border-[#C9A96E]/20">
          <button
            onClick={handleShareProfile}
            className="p-1.5"
            aria-label="Share profile"
          >
            <img src="/Icons/Share Icon.png" alt="Share" className="w-5 h-5 object-contain" />
          </button>
          <h3 className="text-gold-metallic font-bold text-base absolute left-1/2 transform -translate-x-1/2">{user.username}</h3>
          <button 
            onClick={onClose} 
            className="p-1.5"
            aria-label="Close profile"
          >
            <img src="/Icons/Gold power buton.png" alt="Close" className="w-5 h-5 object-contain" />
          </button>
        </div>

        <div className="p-4 pb-safe">
          {/* Profile Header */}
          <div className="flex flex-col items-center mb-3">
            <div className="mb-2">
              <AvatarRing src={user.avatar} alt={user.name} size={72} />
            </div>
            
            <h2 className="text-xl font-bold text-white flex items-center gap-1">
              @{user.username}
              {user.isVerified && (
                <div className="bg-[#C9A96E] rounded-full p-[2px]">
                   <div className="w-2 h-2 bg-white rounded-full"></div> 
                </div>
              )}
            </h2>
            
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm text-white/90 font-medium">{user.name}</span>
              {user.level && (
                <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-bold text-white border border-[#C9A96E]/30">
                  LV {user.level}
                </span>
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-8 mt-3 w-full justify-center border-b border-white/5 pb-3">
              <div className="flex flex-col items-center">
                <span className="font-bold text-lg text-white">{formatNumber(user.following)}</span>
                <span className="text-xs text-white/50">Following</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-bold text-lg text-white">{formatNumber(user.followers)}</span>
                <span className="text-xs text-white/50">Followers</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-bold text-lg text-white">{userVideos.length}</span>
                <span className="text-xs text-white/50">Videos</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 mt-3 mx-auto max-w-[280px]">
              {!isOwnProfile && (
                <>
                  {user.isFollowing ? (
                     <button
                       onClick={onFollow}
                       className="flex-1 h-8 flex items-center justify-center bg-white/10 text-white rounded-lg font-semibold text-xs hover:bg-white/20 transition-colors"
                     >
                       Following
                     </button>
                  ) : (
                    <button
                      onClick={onFollow}
                      className="flex-1 h-8 flex items-center justify-center bg-[#C9A96E] text-black rounded-lg font-semibold text-xs hover:bg-[#C9A96E]/90 transition-colors"
                    >
                      Follow
                    </button>
                  )}
                  
                  <button
                    onClick={handleMessage}
                    className="flex-1 h-8 flex items-center justify-center bg-white/10 text-white rounded-lg font-semibold text-xs hover:bg-white/20 transition-colors"
                  >
                    Message
                  </button>

                  <button
                    onClick={() => setShowMoreOptions(!showMoreOptions)}
                    className="w-8 h-8 flex items-center justify-center bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors relative"
                  >
                    <MoreHorizontal size={16} />
                    
                    {showMoreOptions && (
                      <div className="absolute top-full right-0 mt-2 w-44 bg-[#252525] rounded-xl shadow-xl border border-white/10 z-50 overflow-hidden">
                        <button
                          onClick={handleReportUser}
                          className="w-full px-3 py-2.5 text-left text-xs text-white hover:bg-white/5 flex items-center gap-2"
                        >
                          <Flag size={14} /> Report
                        </button>
                        <button
                          onClick={handleBlockUser}
                          className="w-full px-3 py-2.5 text-left text-xs text-red-400 hover:bg-white/5 flex items-center gap-2 border-t border-white/5"
                        >
                          <Ban size={14} /> Block
                        </button>
                      </div>
                    )}
                  </button>
                </>
              )}
            </div>

            {/* Bio */}
            {user.bio && (
              <p className="mt-3 text-xs text-white/80 text-center px-4 leading-relaxed max-w-md">
                {user.bio}
              </p>
            )}
            
            {(user.location || user.website || user.joinedDate) && (
               <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs text-white/50">
                  {user.location && <span>📍 {user.location}</span>}
                  {user.joinedDate && <span>📅 Joined {formatDate(user.joinedDate)}</span>}
                  {user.website && (
                    <a
                      href={user.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white text-sm hover:underline"
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
               <div className="flex items-center gap-2 text-white font-semibold">
                 <div className="w-0.5 h-4 bg-[#C9A96E]"></div>
                 <span>Videos</span>
               </div>
            </div>
            
            {userVideos.length > 0 ? (
              <div className="grid grid-cols-3 gap-0.5 mt-0.5">
                {userVideos.map((video) => (
                  <button key={video.id} onClick={() => { onClose(); navigate(`/video/${video.id}`); }} className="aspect-[3/4] bg-[#13151A] relative">
                    <img 
                      src={video.thumbnail || video.url} 
                      alt={video.description} 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-1 left-1 text-xs font-bold text-white drop-shadow-md flex items-center gap-1">
                      <Play size={10} fill="white" />
                      {formatNumber(video.stats?.views || 0)}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-white/40 text-sm">
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
      showToast('Profile link copied to clipboard!');
    }
  }
}
