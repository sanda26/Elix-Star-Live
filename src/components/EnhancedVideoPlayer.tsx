import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Heart,
  Music,
  Settings2,
  Share2,
  Bookmark,
  Flag,
  UserPlus,
  UserMinus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useVideoStore } from '../store/useVideoStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { trackEvent } from '../lib/analytics';
import EnhancedCommentsModal from './EnhancedCommentsModal';
import EnhancedLikesModal from './EnhancedLikesModal';
import ShareModal from './ShareModal';
import UserProfileModal from './UserProfileModal';
import ReportModal from './ReportModal';
import { LevelBadge } from './LevelBadge';

interface EnhancedVideoPlayerProps {
  videoId: string;
  isActive: boolean;
  onVideoEnd?: () => void;
  onProgress?: (progress: number) => void;
}

// Premium Sidebar Button Component with Metallic Rose Gold Design
export const PremiumSidebarButton = ({ 
  onClick, 
  isActive = false, 
  iconSrc,
  icon: Icon,
  label, 
  className = ""
}: { 
  onClick: () => void; 
  isActive?: boolean; 
  iconSrc?: string;
  icon?: React.ElementType;
  label?: string;
  className?: string;
}) => (
  <div className={`flex flex-col items-center ${className}`}>
    <button 
      onClick={onClick}
      className="relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90"
      style={{
        background: 'linear-gradient(145deg, rgba(30,30,30,0.95) 0%, rgba(10,10,10,0.98) 100%)',
        boxShadow: isActive 
          ? '0 0 20px rgba(0, 242, 234, 0.5), inset 0 1px 1px rgba(255,255,255,0.1)' 
          : '0 4px 15px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.05)',
        border: '2px solid',
        borderColor: isActive ? '#00f2ea' : 'rgba(0, 242, 234, 0.4)',
      }}
    >
      {/* Inner glow */}
      <div 
        className="absolute inset-[2px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.08) 0%, transparent 60%)',
        }}
      />
      
      {/* Light reflection */}
      <div className="absolute top-1 left-1/2 -translate-x-1/2 w-6 h-1 bg-gradient-to-r from-transparent via-[#00f2ea]/30 to-transparent rounded-full" />
      
      {iconSrc ? (
        <img 
          src={iconSrc} 
          alt="" 
          className={`w-7 h-7 object-contain transition-all duration-200 ${isActive ? 'brightness-125' : 'opacity-80'}`}
          style={{ filter: isActive ? 'drop-shadow(0 0 8px rgba(0, 242, 234, 0.6))' : 'none' }}
        />
      ) : Icon && (
        <Icon 
          className={`w-7 h-7 stroke-[1.5px] transition-all duration-200 ${
            isActive 
              ? 'text-[#00f2ea] drop-shadow-[0_0_8px_rgba(0, 242, 234, 0.6)]' 
              : 'text-[#00f2ea]/70'
          }`}
          style={isActive ? { fill: '#00f2ea' } : { fill: 'transparent' }}
        />
      )}
    </button>
    {label && (
      <span 
        className={`text-xs font-semibold mt-1.5 cursor-pointer hover:underline transition-colors ${
          isActive ? 'text-[#00f2ea]' : 'text-[#00f2ea]/70'
        }`}
        style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
        onClick={onClick}
      >
        {label}
      </span>
    )}
  </div>
);

// Legacy wrapper for compatibility
// const SidebarButton = PremiumSidebarButton;

export default function EnhancedVideoPlayer({ 
  videoId, 
  isActive, 
  onVideoEnd,
  onProgress 
}: EnhancedVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const volume = 0.5;
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoSize, setVideoSize] = useState<{ w: number; h: number } | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showLikes, setShowLikes] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isDoubleClick, setIsDoubleClick] = useState(false);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  
  const navigate = useNavigate();
  const { muteAllSounds } = useSettingsStore();
  const { 
    videos, 
    toggleLike, 
    toggleSave, 
    toggleFollow, 
    incrementViews
  } = useVideoStore();
  
  const video = videos.find(v => v.id === videoId);
  const effectiveMuted = muteAllSounds || isMuted;
  
  // Video playback controls
  const togglePlay = useCallback(() => {
    if (isPlaying) {
      videoRef.current?.pause();
      audioRef.current?.pause();
    } else {
      videoRef.current?.play().catch(() => {});
      if (!effectiveMuted && audioRef.current) {
        audioRef.current.play().catch(() => {});
      }
    }
    setIsPlaying(prev => !prev);
  }, [effectiveMuted, isPlaying]);

  const toggleMute = () => {
    if (muteAllSounds) {
      trackEvent('video_toggle_mute_blocked_global', { videoId });
      return;
    }
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      if (!newMuted) {
        videoRef.current.volume = volume;
      }
    }

    if (audioRef.current) {
      const newMuted = !isMuted;
      audioRef.current.muted = newMuted;
      audioRef.current.volume = volume;
      if (newMuted) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => {});
      }
    }

    trackEvent('video_toggle_mute', { videoId, muted: !isMuted });
  };

  // Video event handlers
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleTimeUpdate = () => {
      setCurrentTime(videoElement.currentTime);
      onProgress?.(videoElement.currentTime / videoElement.duration);
    };

    const handleLoadedMetadata = () => {
      setDuration(videoElement.duration);
      setVideoSize({ w: videoElement.videoWidth, h: videoElement.videoHeight });
    };

    const handleEnded = () => {
      setIsPlaying(false);
      onVideoEnd?.();
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoElement.addEventListener('ended', handleEnded);
    videoElement.addEventListener('play', handlePlay);
    videoElement.addEventListener('pause', handlePause);

    return () => {
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoElement.removeEventListener('ended', handleEnded);
      videoElement.removeEventListener('play', handlePlay);
      videoElement.removeEventListener('pause', handlePause);
    };
  }, [onProgress, onVideoEnd]);

  // Auto-play/pause based on visibility
  useEffect(() => {
    if (isActive) {
      const el = videoRef.current;
      const playResult = el?.play?.();
      if (playResult && typeof (playResult as Promise<void>).catch === 'function') {
        (playResult as Promise<void>).catch((err) => {
          if (!effectiveMuted) {
            setIsMuted(true);
            if (videoRef.current) videoRef.current.muted = true;
            trackEvent('video_autoplay_sound_blocked', { videoId, name: err?.name });
          }
        });
      }
      setIsPlaying(true);
      incrementViews(videoId);
      trackEvent('video_view', { videoId });

      const audio = audioRef.current;
      if (audio && video?.music?.previewUrl) {
        if (audio.src !== video.music.previewUrl) {
          audio.src = video.music.previewUrl;
        }
        audio.currentTime = 0;
        audio.muted = effectiveMuted;
        audio.volume = volume;
        if (!effectiveMuted) {
          const audioPlayResult = audio.play?.();
          if (audioPlayResult && typeof (audioPlayResult as Promise<void>).catch === 'function') {
            (audioPlayResult as Promise<void>).catch(() => {});
          }
        }
      }
    } else {
      const v = videoRef.current;
      if (v?.pause) {
        try {
          v.pause();
        } catch {
          void 0;
        }
      }
      setIsPlaying(false);
      const a = audioRef.current;
      if (a?.pause) {
        try {
          a.pause();
        } catch {
          void 0;
        }
      }
    }
  }, [effectiveMuted, incrementViews, isActive, video?.music?.previewUrl, videoId, volume]);

  useEffect(() => {
    if (!muteAllSounds) return;
    setIsMuted(true);
    if (videoRef.current) videoRef.current.muted = true;
    if (audioRef.current) {
      audioRef.current.muted = true;
      if (audioRef.current.pause) {
        try {
          audioRef.current.pause();
        } catch {
          void 0;
        }
      }
    }
  }, [muteAllSounds]);

  // Mouse/touch interactions
  const handleVideoClick = (e: React.MouseEvent) => {
    if (isMuted) {
      toggleMute();
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Double click detection
    if (isDoubleClick) {
      // Like on double click
      handleLike();
      setShowHeartAnimation(true);
      setTimeout(() => setShowHeartAnimation(false), 1000);
      return;
    }

    setIsDoubleClick(true);
    setTimeout(() => setIsDoubleClick(false), 300);

    // Single click - play/pause
    if (Math.abs(x - centerX) < rect.width * 0.3 && Math.abs(y - centerY) < rect.height * 0.3) {
      togglePlay();
    }
  };

  // Action handlers
  const handleLike = () => {
    toggleLike(videoId);
    trackEvent('video_like_toggle', { videoId, next: !video.isLiked });
  };

  const handleSave = () => {
    toggleSave(videoId);
    trackEvent('video_save_toggle', { videoId, next: !video.isSaved });
  };

  const handleFollow = () => {
    toggleFollow(video.user.id);
    trackEvent('video_follow_toggle', { videoId, userId: video.user.id, next: !video.isFollowing });
  };

  const handleShare = () => {
    setShowShareModal(true);
    trackEvent('video_share_open', { videoId });
  };

  const handleComment = () => {
    setShowComments(true);
    trackEvent('video_comments_open', { videoId });
  };

  const handleProfileClick = () => {
    setShowUserProfile(true);
    trackEvent('video_profile_open', { videoId, userId: video.user.id });
  };

  const handleMusicClick = () => {
    navigate(`/music/${encodeURIComponent(video.music.id)}`);
    trackEvent('video_music_open', { videoId, musicId: video.music.id });
  };
  const handleReport = () => {
    setIsMoreMenuOpen(true);
  };

  // Format functions
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (!video) return null;

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full overflow-hidden flex justify-center"
      style={{ margin: 0, padding: 0, gap: 0 }}
    >
      {/* Video Element - iPhone 14 Pro Max: 6.7" Super Retina XDR, 2796Ãƒâ€”1290px, 19.5:9, ~460ppi */}
      <div
        className="absolute inset-0 flex items-center justify-center bg-black"
        style={{ margin: 0, padding: 0, gap: 0 }}
      >
        <div className="w-full h-full" style={{ margin: 0, padding: 0 }}>
        <audio ref={audioRef} preload="auto" className="hidden" />
        <video
          ref={videoRef}
          src={video.url}
          className="w-full h-full object-cover"
          loop
          playsInline
          preload="auto"
          muted={effectiveMuted}
          onClick={handleVideoClick}
          onError={(e) => {
            console.warn(`Video ${video.id} failed to load:`, e);
            e.currentTarget.style.display = 'none';
            e.currentTarget.parentElement?.classList.add('bg-black');
            const errorText = document.createElement('div');
            errorText.className = 'absolute inset-0 flex items-center justify-center text-white/50 text-sm';
            errorText.innerText = 'Video unavailable';
            e.currentTarget.parentElement?.appendChild(errorText);
          }}
        />



        <div className="absolute bottom-3 left-3 right-3 h-1.5 rounded-full overflow-hidden shadow-lg">
          <div
            className="h-full bg-gradient-to-r from-[#00f2ea] via-[#00c2be] to-[#00f2ea] relative overflow-hidden"
            style={{
              width: `${duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0}%`,
              boxShadow: '0 0 10px rgba(0, 242, 234, 0.6)',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          </div>
        </div>

        {/* Heart animation for double click */}
        {showHeartAnimation && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
            <div className="animate-ping">
              <Heart className="w-24 h-24 text-[#00f2ea] fill-current" />
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Right Sidebar - Same Buttons with Subtle Luxury Effects */}
      <div
        className="absolute z-[10] flex flex-col items-center gap-2 pointer-events-auto"
        style={{
          right: '12px',
          bottom: 'max(12px, calc(var(--safe-bottom) + 12px + 2cm + 4mm))'
        }}
      >
        
        {/* Profile Avatar - SAME SIZE */}
        <div className="relative -mt-4 mb-2">
          <div 
            className="w-12 h-12 rounded-full cursor-pointer hover:scale-105 transition-transform relative"
            onClick={handleProfileClick}
            style={{
              background: 'linear-gradient(145deg, #00f2ea 0%, #00c2be 50%, #00f2ea 100%)',
              padding: '2px',
              boxShadow: '0 4px 15px rgba(0, 242, 234, 0.4)',
            }}
          >
            <img 
              src={video.user.avatar} 
              alt={video.user.username} 
              className="w-full h-full rounded-full object-cover"
            />
            {video.user.isVerified && (
              <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-0.5 border-2 border-black">
                <div className="w-2.5 h-2.5 bg-white rounded-full flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                </div>
              </div>
            )}
            {!video.isFollowing && (
               <div 
                 className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#FE2C55] rounded-full p-0.5 cursor-pointer shadow-md transform scale-75 hover:scale-90 transition-transform"
                 onClick={(e) => {
                    e.stopPropagation();
                    handleFollow();
                 }}
               >
                 <UserPlus size={16} className="text-white" />
               </div>
            )}
          </div>
        </div>

        {/* Like Button - SAME SIZE */}
        <button 
          onClick={handleLike}
          className="w-16 h-16 hover:scale-105 active:scale-95 transition-transform"
          title="Like"
        >
          <img 
            src="/Icons/side-like.png?v=10" 
            alt="Like" 
            className={`w-full h-full object-contain ${video.isLiked ? 'brightness-125 drop-shadow-[0_0_10px_rgba(0,242,234,0.6)]' : ''}`}
          />
        </button>
        <span className="text-[#00f2ea] text-xs font-semibold -mt-1">{formatNumber(video.stats.likes)}</span>

        {/* Comment Button - SAME SIZE */}
        <button 
          onClick={handleComment}
          className="w-12 h-12 hover:scale-105 active:scale-95 transition-transform"
          title="Comments"
        >
          <img src="/Icons/side-comment.png" alt="Comments" className="w-full h-full object-contain" />
        </button>
        <span className="text-[#00f2ea] text-xs font-semibold -mt-1">{formatNumber(video.stats.comments)}</span>

        {/* Save Button - SAME SIZE */}
        <button 
          onClick={handleSave}
          className="w-12 h-12 hover:scale-105 active:scale-95 transition-transform"
          title="Save"
        >
          <img 
            src="/Icons/side-save.png" 
            alt="Save" 
            className={`w-full h-full object-contain ${video.isSaved ? 'brightness-125 drop-shadow-[0_0_10px_rgba(0,242,234,0.6)]' : ''}`}
          />
        </button>
        <span className="text-white text-xs font-semibold -mt-1">{formatNumber(video.stats.saves || 0)}</span>

        {/* Share Button - SAME SIZE */}
        <button 
          onClick={handleShare}
          className="w-12 h-12 hover:scale-105 active:scale-95 transition-transform"
          title="Share"
        >
          <img src="/Icons/side-share.png" alt="Share" className="w-full h-full object-contain" />
        </button>
        <span className="text-white text-xs font-semibold -mt-1">{formatNumber(video.stats.shares)}</span>

        {/* Music Button - SAME SIZE */}
        <button 
          onClick={handleMusicClick}
          className="w-12 h-12 hover:scale-105 transition-transform animate-spin"
          style={{ animationDuration: '8s' }}
          title="Music"
        >
          <img src="/Icons/side-music.png" alt="Music" className="w-full h-full object-contain" />
        </button>

        {/* Menu Button - SAME SIZE */}
        <button 
          onClick={handleReport}
          className="w-12 h-12 hover:scale-105 active:scale-95 transition-transform"
          title="More"
        >
          <img src="/Icons/side-menu.png" alt="More" className="w-full h-full object-contain" />
        </button>
      </div>

      {/* Bottom Info Area - Same Layout with Subtle Luxury */}
      <div className="absolute z-[10] left-4 bottom-[120px] md:bottom-[150px] w-[70%] pb-4 pointer-events-none">
        <div className="flex items-center gap-2 mb-2">
          <LevelBadge level={video.user.level ?? 1} size={10} layout="fixed" />
          <h3 className="text-[#00f2ea] font-bold text-shadow-md">{video.user.username}</h3>
          {video.user.isVerified && (
            <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>
          )}
          <span className="text-[#00f2ea]/60 text-sm">Ã¢â‚¬Â¢</span>
          <span className="text-[#00f2ea]/60 text-sm">{formatNumber(video.user.followers)} followers</span>
        </div>
        
        <p className="text-white/90 text-sm mb-2 text-shadow-md line-clamp-2">
          {video.description}
        </p>
        
        <div className="flex flex-wrap gap-1 mb-2">
          {video.hashtags.map((hashtag) => (
            <button
              key={hashtag}
              onClick={() => navigate(`/hashtag/${hashtag}`)}
              className="text-[#00f2ea] text-xs font-medium hover:underline"
            >
              #{hashtag}
            </button>
          ))}
        </div>

        {video.location && (
          <div className="flex items-center gap-1 text-white/60 text-xs mb-2">
            <div className="w-3 h-3 rounded-full" />
            <span>{video.location}</span>
          </div>
        )}
        
        <div className="flex items-center gap-2 text-white/90">
          <Music size={14} className="text-[#00f2ea]" />
          <span className="text-xs font-medium animate-marquee whitespace-nowrap overflow-hidden w-32">
            {video.music.title} - {video.music.artist}
          </span>
        </div>

        <div className="flex items-center gap-4 mt-2 text-white/60 text-xs">
          <span>{formatNumber(video.stats.views)} views</span>
          <span>Ã¢â‚¬Â¢</span>
          <span>{new Date(video.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Modals */}
      <EnhancedCommentsModal 
        isOpen={showComments} 
        onClose={() => setShowComments(false)}
        videoId={videoId}
      />
      
      <EnhancedLikesModal 
        isOpen={showLikes} 
        onClose={() => setShowLikes(false)}
        videoId={videoId}
        likes={video.stats.likes}
      />
      
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        video={video}
      />
      
      <UserProfileModal
        isOpen={showUserProfile}
        onClose={() => setShowUserProfile(false)}
        user={video.user}
        onFollow={handleFollow}
      />
      
            {isMoreMenuOpen && (
        <div className="fixed inset-0 z-modals flex flex-col justify-end">
          <div className="absolute inset-0 pointer-events-auto" onClick={() => setIsMoreMenuOpen(false)} />
          <div
            className="bg-[#1a1a1a]/95 rounded-t-2xl max-h-[40dvh] flex flex-col shadow-2xl border-t border-white/10 pointer-events-auto w-full relative z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-white" />
                <span className="text-white font-bold text-sm">More Options</span>
              </div>
            </div>
            <div className="p-2 overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  handleShare();
                }}
                className="w-full px-4 py-3 flex items-center gap-3 text-white hover:bg-white/5 rounded-xl"
              >
                <Share2 className="w-5 h-5" strokeWidth={2} />
                <span className="text-sm font-bold">Share</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSave();
                  setIsMoreMenuOpen(false);
                }}
                className="w-full px-4 py-3 flex items-center gap-3 text-white hover:bg-white/5 rounded-xl"
              >
                <Bookmark className="w-5 h-5" strokeWidth={2} />
                <span className="text-sm font-bold">{video.isSaved ? 'Unsave' : 'Save'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleFollow();
                  setIsMoreMenuOpen(false);
                }}
                className="w-full px-4 py-3 flex items-center gap-3 text-white hover:bg-white/5 rounded-xl"
              >
                {video.isFollowing ? <UserMinus className="w-5 h-5" strokeWidth={2} /> : <UserPlus className="w-5 h-5" strokeWidth={2} />}
                <span className="text-sm font-bold">{video.isFollowing ? 'Unfollow' : 'Follow'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  setShowReportModal(true);
                  trackEvent('video_report_open', { videoId });
                }}
                className="w-full px-4 py-3 flex items-center gap-3 text-red-400 hover:bg-white/5 rounded-xl"
              >
                <Flag className="w-5 h-5" strokeWidth={2} />
                <span className="text-sm font-bold">Report</span>
              </button>
            </div>
          </div>
        </div>
      )}

      
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        videoId={videoId}
        contentType="video"
      />
    </div>
  );
}
