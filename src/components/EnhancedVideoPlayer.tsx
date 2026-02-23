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
  Download,
  QrCode,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useVideoStore } from '../store/useVideoStore';
import { useAuthStore } from '../store/useAuthStore';
import { showToast } from '../lib/toast';
import { useSettingsStore } from '../store/useSettingsStore';
import { trackEvent } from '../lib/analytics';
import EnhancedCommentsModal from './EnhancedCommentsModal';
import EnhancedLikesModal from './EnhancedLikesModal';
import ShareModal from './ShareModal';
import UserProfileModal from './UserProfileModal';
import ReportModal from './ReportModal';
import PromotePanel from './PromotePanel';
import { LevelBadge } from './LevelBadge';

interface EnhancedVideoPlayerProps {
  videoId: string;
  isActive: boolean;
  onVideoEnd?: () => void;
  onProgress?: (progress: number) => void;
}

// Premium Sidebar Button Component
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
          ? '0 0 20px rgba(201, 169, 110, 0.5), inset 0 1px 1px rgba(255,255,255,0.1)' 
          : '0 4px 15px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.05)',
        border: '2px solid',
        borderColor: isActive ? '#C9A96E' : 'rgba(201, 169, 110, 0.4)',
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
      <div className="absolute top-1 left-1/2 -translate-x-1/2 w-6 h-1 bg-gradient-to-r from-transparent via-[#C9A96E]/30 to-transparent rounded-full" />
      
      {iconSrc ? (
        <img 
          src={iconSrc} 
          alt="" 
          className={`w-7 h-7 object-contain transition-all duration-200 ${isActive ? 'brightness-125' : 'opacity-80'}`}
          style={{ filter: isActive ? 'drop-shadow(0 0 8px rgba(201, 169, 110, 0.6))' : 'none' }}
        />
      ) : Icon && (
        <Icon 
          className={`w-7 h-7 stroke-[1.5px] transition-all duration-200 ${
            isActive 
              ? 'text-white drop-shadow-[0_0_8px_rgba(201, 169, 110, 0.6)]' 
              : 'text-white/70'
          }`}
          style={isActive ? { fill: '#C9A96E' } : { fill: 'transparent' }}
        />
      )}
    </button>
    {label && (
      <span 
        className={`text-xs font-semibold mt-1.5 cursor-pointer hover:underline transition-colors ${
          isActive ? 'text-white' : 'text-white/70'
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
  const [showPromotePanel, setShowPromotePanel] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isDoubleClick, setIsDoubleClick] = useState(false);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  
  const navigate = useNavigate();
  const { muteAllSounds } = useSettingsStore();
  const { 
    videos, 
    toggleLike, 
    toggleSave, 
    toggleFollow, 
    incrementViews,
    deleteVideo,
  } = useVideoStore();
  const authUserId = useAuthStore((s) => s.user?.id ?? null);
  
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
      if (!el) return;
      setVideoError(false);

      // Try unmuted first (works after user interaction)
      el.muted = muteAllSounds;
      el.volume = volume;
      const playResult = el.play();
      if (playResult && typeof playResult.catch === 'function') {
        playResult.catch(() => {
          // Browser blocked unmuted autoplay — retry muted
          el.muted = true;
          setIsMuted(true);
          el.play().catch(() => {});
        });
      }

      setIsPlaying(true);
      if (!muteAllSounds) setIsMuted(false);
      incrementViews(videoId);
      trackEvent('video_view', { videoId });

      const audio = audioRef.current;
      if (audio && video?.music?.previewUrl) {
        if (audio.src !== video.music.previewUrl) {
          audio.src = video.music.previewUrl;
        }
        audio.currentTime = 0;
        audio.muted = muteAllSounds;
        audio.volume = volume;
        if (!muteAllSounds) {
          audio.play().catch(() => {});
        }
      }
    } else {
      const v = videoRef.current;
      if (v?.pause) {
        try { v.pause(); } catch { void 0; }
      }
      setIsPlaying(false);
      const a = audioRef.current;
      if (a?.pause) {
        try { a.pause(); } catch { void 0; }
      }
    }
  }, [incrementViews, isActive, muteAllSounds, video?.music?.previewUrl, videoId, volume]);

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
    // If video is muted (browser blocked sound), unmute on first tap
    if (isMuted && !muteAllSounds && videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.volume = volume;
      setIsMuted(false);
    }

    // Double click detection
    if (isDoubleClick) {
      handleLike();
      setShowHeartAnimation(true);
      setTimeout(() => setShowHeartAnimation(false), 1000);
      return;
    }

    setIsDoubleClick(true);
    setTimeout(() => setIsDoubleClick(false), 300);

    // Single click - play/pause
    togglePlay();
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

  const handleDownload = () => {
    if (!video?.url) return;
    const a = document.createElement('a');
    a.href = video.url;
    a.download = `video_${videoId}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Download started');
  };

  const handleQRCode = async () => {
    const url = `${window.location.origin}/video/${videoId}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copied!');
    } catch {}
  };

  const isOwnVideo = !!authUserId && !!video?.user?.id && authUserId === video.user.id;
  const handleDeleteVideo = async () => {
    if (!isOwnVideo) return;
    if (!window.confirm('Delete this video? This cannot be undone.')) return;
    try {
      await deleteVideo(videoId);
      setIsMoreMenuOpen(false);
      showToast('Video deleted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete');
    }
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
        className="absolute inset-0 flex items-center justify-center bg-[#13151A]"
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
          onError={() => {
            setIsPlaying(false);
            setVideoError(true);
          }}
        />



        {videoError && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#13151A] z-10">
            <span className="text-white/50 text-sm">Video unavailable</span>
          </div>
        )}

        <div className="absolute bottom-3 left-3 right-3 h-1.5 rounded-full overflow-hidden shadow-lg">
          <div
            className="h-full bg-gradient-to-r from-[#C9A96E] via-[#00c2be] to-[#C9A96E] relative overflow-hidden"
            style={{
              width: `${duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0}%`,
              boxShadow: '0 0 10px rgba(201, 169, 110, 0.6)',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          </div>
        </div>

        {/* Heart animation for double click */}
        {showHeartAnimation && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
            <div className="animate-ping">
              <Heart className="w-24 h-24 text-white fill-current" />
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
        
        {/* Profile Avatar */}
        <div className="relative mb-1">
          <div 
            className="cursor-pointer hover:scale-105 transition-transform relative"
            style={{width:'48px',height:'48px'}}
            onClick={handleProfileClick}
          >
            <img 
              src={video.user.avatar} 
              alt={video.user.username} 
              className="absolute rounded-full object-cover"
              style={{width:'32px',height:'32px',top:'50%',left:'50%',transform:'translate(-50%,-55%)'}}
            />
            <img 
              src="/Icons/Profile icon.png" 
              alt="" 
              className="relative z-10 w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Like Button */}
        <button 
          onClick={handleLike}
          className="hover:scale-105 active:scale-95 transition-transform relative"
          style={{width:'48px',height:'48px'}}
          title="Like"
        >
          <img 
            src="/Icons/Like Icon.png" 
            alt="Like" 
            className="absolute inset-0 w-full h-full object-contain transition-all duration-300 z-[2]"
            style={video.isLiked ? {filter:'brightness(0.5) sepia(1) hue-rotate(-30deg) saturate(10)'} : {}}
          />
        </button>
        <span className={`text-[10px] font-semibold -mt-1 ${video.isLiked ? 'text-red-500' : 'text-white'}`}>{formatNumber(video.stats.likes)}</span>

        {/* Comment Button */}
        <button 
          onClick={handleComment}
          className="hover:scale-105 active:scale-95 transition-transform relative"
          style={{width:'48px',height:'48px'}}
          title="Comments"
        >
          <img src="/Icons/Coment Icon.png" alt="Comments" className="absolute inset-0 w-full h-full object-contain z-[2]" />
        </button>
        <span className="text-white text-[10px] font-semibold -mt-1">{formatNumber(video.stats.comments)}</span>

        {/* Save Button */}
        <button 
          onClick={handleSave}
          className="hover:scale-105 active:scale-95 transition-transform relative"
          style={{width:'48px',height:'48px'}}
          title="Save"
        >
          <img 
            src="/Icons/Save Icon.png" 
            alt="Save" 
            className={`absolute inset-0 w-full h-full object-contain z-[2] ${video.isSaved ? 'brightness-125 drop-shadow-[0_0_8px_rgba(201,169,110,0.6)]' : ''}`}
          />
        </button>
        <span className="text-white text-[10px] font-semibold -mt-1">{formatNumber(video.stats.saves || 0)}</span>

        {/* Share Button */}
        <button 
          onClick={handleShare}
          className="hover:scale-105 active:scale-95 transition-transform relative"
          style={{width:'48px',height:'48px'}}
          title="Share"
        >
          <img src="/Icons/Share Icon.png" alt="Share" className="absolute inset-0 w-full h-full object-contain z-[2]" />
        </button>
        <span className="text-white text-[10px] font-semibold -mt-1">{formatNumber(video.stats.shares)}</span>

        {/* Music Button */}
        <button 
          onClick={handleMusicClick}
          className="hover:scale-105 active:scale-95 transition-transform animate-spin relative"
          style={{width:'48px',height:'48px',animationDuration:'8s'}}
          title="Music"
        >
          <img src="/Icons/Music Icon.png" alt="Music" className="absolute inset-0 w-full h-full object-contain z-[2]" />
        </button>

        {/* 3 Dots Button */}
        <button 
          onClick={handleReport}
          className="hover:scale-105 active:scale-95 transition-transform relative"
          style={{width:'48px',height:'48px'}}
          title="More"
        >
          <img src="/Icons/3 Dots Buton.png" alt="More" className="absolute inset-0 w-full h-full object-contain z-[2]" />
        </button>
      </div>

      {/* Bottom Info Area - Same Layout with Subtle Luxury */}
      <div className="absolute z-[10] left-4 bottom-[120px] md:bottom-[150px] w-[70%] pb-4 pointer-events-none">
        <div className="flex items-center gap-2 mb-2">
          <LevelBadge level={video.user.level ?? 1} size={10} layout="fixed" avatar={video.user.avatar} />
          <h3 className="text-white font-bold text-shadow-md">{video.user.username}</h3>
          {video.user.isVerified && (
            <div className="w-4 h-4 bg-[#C9A96E] rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>
          )}
          <span className="text-white/60 text-sm">Ã¢â‚¬Â¢</span>
          <span className="text-white/60 text-sm">{formatNumber(video.user.followers)} followers</span>
        </div>
        
        <p className="text-white/90 text-sm mb-2 text-shadow-md line-clamp-2">
          {video.description}
        </p>
        
        <div className="flex flex-wrap gap-1 mb-2">
          {video.hashtags.map((hashtag) => (
            <button
              key={hashtag}
              onClick={() => navigate(`/hashtag/${hashtag}`)}
              className="text-white text-xs font-medium hover:underline"
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
          <Music size={14} className="text-white" />
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
        onDeleteVideo={isOwnVideo ? handleDeleteVideo : undefined}
      />
      
      <UserProfileModal
        isOpen={showUserProfile}
        onClose={() => setShowUserProfile(false)}
        user={video.user}
        onFollow={handleFollow}
      />
      
            {isMoreMenuOpen && (
        <div className="fixed inset-0 z-modals flex items-end justify-center">
          <div className="absolute inset-0 pointer-events-auto" onClick={() => setIsMoreMenuOpen(false)} />
          <div
            className="bg-[#1C1E24]/95 rounded-t-2xl max-h-[40dvh] flex flex-col shadow-2xl border-2 border-b-0 border-[#C9A96E] pointer-events-auto w-full max-w-[480px] relative z-10"
            style={{ marginBottom: '90px', boxShadow: '0 -4px 30px rgba(201,169,110,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-white" />
                <span className="text-white font-bold text-sm">More Options</span>
              </div>
            </div>
            <div className="p-4 overflow-y-auto overflow-x-hidden min-h-0 flex-1">
              <div className="grid grid-cols-4 gap-y-4 gap-x-2">
                <button
                  type="button"
                  onClick={() => { setIsMoreMenuOpen(false); handleShare(); }}
                  className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
                >
                  <div className="relative w-11 h-11 rounded-full bg-[#13151A] overflow-hidden flex items-center justify-center">
                    <Share2 className="relative z-[2] w-[18px] h-[18px] text-white" strokeWidth={1.8} />
                    <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[3] scale-125 translate-y-0.5" />
                  </div>
                  <span className="text-[10px] font-semibold text-white/70">Share</span>
                </button>
                <button
                  type="button"
                  onClick={() => { handleSave(); setIsMoreMenuOpen(false); }}
                  className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
                >
                  <div className="relative w-11 h-11 rounded-full bg-[#13151A] overflow-hidden flex items-center justify-center">
                    <Bookmark className="relative z-[2] w-[18px] h-[18px] text-white" strokeWidth={1.8} />
                    <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[3] scale-125 translate-y-0.5" />
                  </div>
                  <span className="text-[10px] font-semibold text-white/70">{video.isSaved ? 'Unsave' : 'Save'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { handleFollow(); setIsMoreMenuOpen(false); }}
                  className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
                >
                  <div className="relative w-11 h-11 rounded-full bg-[#13151A] overflow-hidden flex items-center justify-center">
                    {video.isFollowing ? <UserMinus className="relative z-[2] w-[18px] h-[18px] text-white" strokeWidth={1.8} /> : <UserPlus className="relative z-[2] w-[18px] h-[18px] text-white" strokeWidth={1.8} />}
                    <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[3] scale-125 translate-y-0.5" />
                  </div>
                  <span className="text-[10px] font-semibold text-white/70">{video.isFollowing ? 'Unfollow' : 'Follow'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setIsMoreMenuOpen(false); setShowPromotePanel(true); }}
                  className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
                >
                  <div className="relative w-11 h-11 rounded-full bg-[#13151A] overflow-hidden flex items-center justify-center">
                    <TrendingUp className="relative z-[2] w-[18px] h-[18px] text-white" strokeWidth={1.8} />
                    <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[3] scale-125 translate-y-0.5" />
                  </div>
                  <span className="text-[10px] font-semibold text-white/70">Promote</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setIsMoreMenuOpen(false); setShowReportModal(true); trackEvent('video_report_open', { videoId }); }}
                  className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
                >
                  <div className="relative w-11 h-11 rounded-full bg-[#13151A] overflow-hidden flex items-center justify-center">
                    <Flag className="relative z-[2] w-[18px] h-[18px] text-red-400" strokeWidth={1.8} />
                    <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[3] scale-125 translate-y-0.5" />
                  </div>
                  <span className="text-[10px] font-semibold text-red-400/70">Report</span>
                </button>
              </div>
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
      {video && (
        <PromotePanel
          isOpen={showPromotePanel}
          onClose={() => setShowPromotePanel(false)}
          contentType="video"
          content={{
            id: video.id,
            title: video.description,
            thumbnail: video.thumbnail,
            username: video.user?.username,
            postedAt: new Date().toISOString().split('T')[0],
          }}
        />
      )}
    </div>
  );
}
