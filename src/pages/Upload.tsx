import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setCachedCameraStream } from '../lib/cameraStream';
import { RefreshCw, Zap, Clock, Music, Check, Play, Square, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useVideoStore } from '../store/useVideoStore';
import { type SoundTrack, fetchSoundTracksFromDatabase } from '../lib/soundLibrary';
import { trackEvent } from '../lib/analytics';
import { useSettingsStore } from '../store/useSettingsStore';
import { videoUploadService } from '../lib/videoUpload';
import { supabase } from '../lib/supabase';

export default function Upload() {
  const navigate = useNavigate();
  const { muteAllSounds } = useSettingsStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [chunks, setChunks] = useState<Blob[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraRetry, setCameraRetry] = useState(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [showMusicModal, setShowMusicModal] = useState(false);
  const [selectedAudioId, setSelectedAudioId] = useState<string>('original');
  const [postWithoutAudio, setPostWithoutAudio] = useState(false);
  const [caption, setCaption] = useState('');
  const [hashtagsText, setHashtagsText] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [postProgress, setPostProgress] = useState(0);
  const [postError, setPostError] = useState<string | null>(null);
  const [playingTrackId, setPlayingTrackId] = useState<number | null>(null); // Track currently playing preview
  const previewAudioRef = useRef<HTMLAudioElement | null>(null); // For list preview
  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null); // For video background
  const [customTracks, setCustomTracks] = useState<SoundTrack[]>([]);
  const [builtInTracks, setBuiltInTracks] = useState<SoundTrack[]>([]);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    fetchSoundTracksFromDatabase().then(setBuiltInTracks);
  }, []);

  const { addVideo, fetchVideos } = useVideoStore();

  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 3;
  const ZOOM_STEP = 0.25;
  const handleZoomIn = () => setZoomLevel((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP));

  const mapRowToVideo = (row: any, profile: any) => ({
    id: row.id,
    url: row.url,
    thumbnail: row.thumbnail_url || 'https://picsum.photos/400/600',
    duration: '0:15',
    user: {
      id: profile?.user_id ?? profile?.id ?? row.user_id ?? 'unknown',
      username: profile?.username ?? 'user',
      name: profile?.display_name ?? profile?.username ?? 'User',
      avatar: profile?.avatar_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.username ?? 'U')}`,
      level: 1,
      isVerified: !!profile?.is_creator,
      followers: 0,
      following: 0
    },
    description: row.caption ?? '',
    hashtags: [],
    music: { id: 'original', title: 'Original Sound', artist: profile?.display_name ?? 'User', duration: '0:15' },
    stats: { views: row.views ?? 0, likes: row.likes ?? 0, comments: 0, shares: 0, saves: 0 },
    createdAt: row.created_at,
    location: 'For You',
    isLiked: false,
    isSaved: false,
    isFollowing: false,
    comments: [],
    quality: 'auto' as const,
    privacy: 'public' as const
  });

  type UploadMusic = {
    id: string;
    title: string;
    artist: string;
    duration: string;
    previewUrl?: string;
  };

  const formatClip = (start: number, end: number) => {
    const total = Math.max(0, Math.floor(end - start));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const musicTracks = React.useMemo(() => [...customTracks, ...builtInTracks], [customTracks, builtInTracks]);

  const getSelectedLabel = () => {
    if (postWithoutAudio || selectedAudioId === 'none') return 'No audio';
    if (selectedAudioId === 'original') return 'Original Sound';
    if (selectedAudioId.startsWith('track_')) {
      const raw = selectedAudioId.slice('track_'.length);
      const id = Number(raw);
      const t = musicTracks.find((x) => x.id === id);
      return t ? t.title : 'Add Sound';
    }
    return 'Add Sound';
  };

   const handleSelectMusic = (track: SoundTrack) => {
       setSelectedAudioId(`track_${track.id}`);
       setPostWithoutAudio(false);
       setShowMusicModal(false);
       trackEvent('upload_select_audio', { type: 'library', trackId: track.id, title: track.title });
       if (previewAudioRef.current) {
           previewAudioRef.current.pause();
           setPlayingTrackId(null);
       }
   };
 
   const togglePreview = (e: React.MouseEvent, track: SoundTrack) => {
       e.stopPropagation(); // Don't select, just play

       if (muteAllSounds) {
           trackEvent('upload_preview_audio_blocked_global_mute', { trackId: track.id });
           return;
       }
       
       if (playingTrackId === track.id) {
           // Stop
           if (previewAudioRef.current) {
               previewAudioRef.current.pause();
               setPlayingTrackId(null);
           }
       } else {
           // Play new
           if (previewAudioRef.current) {
               previewAudioRef.current.pause();
           }
           // Create new audio or reuse
           if (track.url) {
               previewAudioRef.current = new Audio(track.url);
               const start = Math.max(0, track.clipStartSeconds);
               const end = Math.max(start, track.clipEndSeconds);
               previewAudioRef.current.volume = 1.0;
               previewAudioRef.current.currentTime = start;
               previewAudioRef.current.play()
                   .then(() => console.log("Audio playing:", track.title))
                   .catch(e => {
                       console.error("Audio play failed", e);
                       alert("Could not play audio. Check console for details.");
                   });
               setPlayingTrackId(track.id);
               
               // Auto stop at end
               previewAudioRef.current.onended = () => setPlayingTrackId(null);
               previewAudioRef.current.ontimeupdate = () => {
                 const a = previewAudioRef.current;
                 if (!a) return;
                 if (end > start && a.currentTime >= end) {
                   a.pause();
                   a.currentTime = start;
                   setPlayingTrackId(null);
                 }
               };
           } else {
               // No URL (No Music)
               setPlayingTrackId(null);
           }
       }
   };

  useEffect(() => {
    if (!recordedVideoUrl) {
      setCaption('');
      setHashtagsText('');
      setPostWithoutAudio(false);
      setSelectedAudioId('original');
      setIsPosting(false);
      setPostProgress(0);
    }
  }, [recordedVideoUrl]);

   // Start Camera
  useEffect(() => {
    let cancelled = false;
    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraError('Camera not supported on this device.');
          return;
        }

        // Check permission status before requesting
        try {
          const permStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
          if (permStatus.state === 'denied') {
            setCameraError('Camera is blocked. Go to your browser settings → Site Settings → Camera → Allow for this site, then tap Try Again.');
            return;
          }
        } catch {
          // permissions.query not supported — proceed directly
        }

        // Try video + audio first, fall back to video-only
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        }
        if (!cancelled && videoRef.current) {
          videoRef.current.srcObject = stream;
          setCachedCameraStream(stream);
        }
        setCameraError(null);
      } catch (err: unknown) {
        console.error("Error accessing camera:", err);
        const error = err as { name?: string };
        if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
          setCameraError('Camera permission denied. Please allow camera access in your browser and tap Try Again.');
        } else if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
          setCameraError('No camera found on this device.');
        } else if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') {
          setCameraError('Camera is in use by another app. Close other apps using the camera and tap Try Again.');
        } else {
          setCameraError(`Camera error: ${(err as Error)?.message || 'Unknown error'}. Tap Try Again.`);
        }
      }
    }
    
    // Only start camera if not previewing
    if (!recordedVideoUrl) {
        startCamera();
    }

    const videoEl = videoRef.current;
    return () => {
      cancelled = true;
      if (videoEl && videoEl.srcObject) {
        const stream = videoEl.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [recordedVideoUrl, cameraRetry]);

  const startRecording = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const mediaRecorder = new MediaRecorder(stream);
      
      setChunks([]); // Clear previous chunks
      setIsPaused(false);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          setChunks((prev) => [...prev, e.data]);
        }
      };

      mediaRecorder.onstop = () => {
        // Blob creation happens in useEffect when chunks update and recording is stopped fully
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsRecording(false);
      setIsPaused(true);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsRecording(true);
      setIsPaused(false);
    }
  };

  const stopRecordingFinal = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      // This will trigger the useEffect to create the blob URL
    }
  };

  // Watch for recording stop to create URL
  useEffect(() => {
    // Only create URL if we fully stopped (not just paused) and have chunks
    if (!isRecording && !isPaused && chunks.length > 0) {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
    }
  }, [isRecording, isPaused, chunks]);

  const toggleRecording = () => {
    if (!isRecording && !isPaused) {
      startRecording();
    } else if (isRecording) {
      pauseRecording();
    } else if (isPaused) {
      resumeRecording();
    }
  };

  // Audio Preview Logic for Recorded Video
  useEffect(() => {
      const shouldPlayTrack =
        !!recordedVideoUrl &&
        !muteAllSounds &&
        !postWithoutAudio &&
        selectedAudioId.startsWith('track_');

      if (!shouldPlayTrack) {
        if (backgroundAudioRef.current) backgroundAudioRef.current.pause();
        return;
      }

      const raw = selectedAudioId.slice('track_'.length);
      const id = Number(raw);
      const track = musicTracks.find((t) => t.id === id);
      if (!track?.url) {
        if (backgroundAudioRef.current) backgroundAudioRef.current.pause();
        return;
      }

      if (backgroundAudioRef.current) {
        backgroundAudioRef.current.pause();
      }

      backgroundAudioRef.current = new Audio(track.url);
      const start = Math.max(0, track.clipStartSeconds);
      const end = Math.max(start, track.clipEndSeconds);
      backgroundAudioRef.current.loop = false;
      backgroundAudioRef.current.volume = 0.5;
      backgroundAudioRef.current.currentTime = start;
      backgroundAudioRef.current.ontimeupdate = () => {
        const a = backgroundAudioRef.current;
        if (!a) return;
        if (end > start && a.currentTime >= end) {
          a.currentTime = start;
          a.play().catch(() => {});
        }
      };
      backgroundAudioRef.current.play().catch(() => {});

      return () => {
        if (backgroundAudioRef.current) backgroundAudioRef.current.pause();
      };
  }, [muteAllSounds, postWithoutAudio, recordedVideoUrl, selectedAudioId, musicTracks]);

  const handlePost = async () => {
      if (!recordedVideoUrl || isPosting) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login', { state: { from: '/upload' } });
        return;
      }

      // Must have video data to upload
      if (!chunks.length) {
        alert("No video to upload. Record or choose a video first.");
        return;
      }

      // Use the MIME type from the first chunk (which we set correctly in handleFileUpload or recording)
      const mimeType = chunks[0].type || 'video/webm';
      const blob = new Blob(chunks, { type: mimeType });

      if (blob.size === 0) {
        alert("Video is empty. Record or choose a valid video.");
        return;
      }

      // Use correct extension based on MIME type
      let ext = 'webm';
      if (mimeType.includes('mp4')) ext = 'mp4';
      if (mimeType.includes('quicktime')) ext = 'mov';

      const file = new File([blob], `upload-${Date.now()}.${ext}`, { type: mimeType });

      videoUploadService.onProgress(({ progress }) => setPostProgress(progress));
      setPostProgress(0);
      setPostError(null);
      setIsPosting(true);

      try {
        const normalizedCaption = caption.trim();
        const captionHashtags = Array.from(normalizedCaption.matchAll(/#([\p{L}0-9_]+)/gu)).map((m) => m[1]);
        const manualHashtags = hashtagsText
          .split(/[\s,]+/)
          .map((t) => t.trim())
          .filter(Boolean)
          .map((t) => (t.startsWith('#') ? t.slice(1) : t));

        const hashtags = Array.from(new Set([...captionHashtags, ...manualHashtags].map((h) => h.toLowerCase()))).slice(0, 20);

        let musicMeta;
        if (selectedAudioId.startsWith('track_')) {
            const id = Number(selectedAudioId.replace('track_', ''));
            const track = musicTracks.find(t => t.id === id);
            if (track) {
                musicMeta = {
                    id: String(track.id),
                    title: track.title,
                    artist: track.artist,
                    duration: formatClip(track.clipStartSeconds, track.clipEndSeconds),
                    url: track.url
                };
            }
        }

        const videoId = await videoUploadService.uploadVideo(file, user.id, {
          description: normalizedCaption,
          hashtags: hashtags,
          isPrivate: false,
          music: musicMeta
        });

        // Put new video directly at top of For You so it shows immediately (video already in DB = stays forever)
        const { data: row } = await supabase
          .from('videos')
          .select('id, url, thumbnail_url, caption, created_at, views, likes, user_id')
          .eq('id', videoId)
          .single();
        if (row) {
          let profile: any = null;
          try {
            const res = await supabase.from('profiles').select('user_id, username, display_name, avatar_url, is_creator').eq('user_id', row.user_id).single();
            profile = res.data;
          } catch {
            profile = { user_id: user.id, username: user.user_metadata?.username ?? user.email?.split('@')[0], display_name: user.user_metadata?.full_name ?? user.email?.split('@')[0], avatar_url: user.user_metadata?.avatar_url, is_creator: false };
          }
          
          const newVideo = mapRowToVideo(row, profile);
          if (musicMeta) {
             newVideo.music = musicMeta;
          }
          addVideo(newVideo);
        } else {
          await fetchVideos();
        }

        trackEvent('upload_post_success', { videoId });
        setRecordedVideoUrl(null);
        setChunks([]);
        setIsPosting(false);
        setPostProgress(0);
        alert("Video Posted to For You Feed! ✅");
        navigate('/feed');
        
      } catch (error: any) {
        const msg = error?.message || error?.error_description || String(error) || 'Unknown error';
        console.error('Post failed:', error);
        setPostError(msg);
        setIsPosting(false);
        setPostProgress(0);
      }
  };

  const handleDiscard = () => {
      setRecordedVideoUrl(null);
      setChunks([]);
  };

  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);
        setRecordedVideoUrl(url);
        // Also set chunks so we can upload this file
        // NOTE: For file upload, we might need to handle it differently in handlePost
        // Currently handlePost assumes 'chunks' has the data. 
        // Let's populate chunks with the file blob to reuse logic
        const blob = file.slice(0, file.size, file.type);
        setChunks([blob]);
      }
    };
    input.click();
  };

  return (
    <div className="fixed inset-0 h-[100dvh] w-full bg-black overflow-hidden flex items-end justify-center">
      
      {/* PREVIEW MODE */}
       {recordedVideoUrl ? (
         <>
           <div className="relative z-10 w-full mx-auto h-[100dvh] bg-black flex flex-col items-center justify-center">
               <video 
                   src={recordedVideoUrl} 
                   className="w-full h-full object-cover z-0" 
                   controls={false}
                   autoPlay 
                   loop 
               />
               
               {/* Overlay Image in Preview too */}
               <div className="absolute inset-0 z-10 w-full h-full pointer-events-none">
                    <img 
                        src="/Icons/Camera.png" 
                        className="absolute inset-0 w-full h-full object-fill object-bottom opacity-50" // Semi-transparent or full?
                        alt="Camera Interface"
                    />
               </div>

               {/* Preview Top Controls */}
               <div className="absolute top-[2%] left-0 right-0 z-20 flex items-center justify-between pointer-events-auto px-4">
                    <button onClick={() => navigate('/feed')} className="p-1" title="Back to For You">
                      <img src="/Icons/power-button.png" alt="Close" className="w-5 h-5" />
                    </button>
                    <button 
                        className="w-40 h-8 rounded-full flex items-center justify-center gap-1 bg-black border border-transparent"
                        onClick={() => setShowMusicModal(true)}
                    >
                        <Music size={14} className="text-white" />
                        <span className="text-white text-xs font-bold truncate max-w-[120px]">
                            {getSelectedLabel()}
                        </span>
                    </button>
               </div>

               <div className="absolute bottom-[22%] left-0 right-0 z-20 px-4 pointer-events-auto flex justify-center">
                 <div className="bg-black border border-transparent rounded-xl p-1.5 space-y-1.5 w-[60%] max-w-[200px]">
                   <textarea
                     value={caption}
                     onChange={(e) => setCaption(e.target.value)}
                     placeholder="Write a caption…"
                     className="w-full bg-black/50 text-white placeholder-white/50 border border-white/20 rounded-md px-2 py-1.5 text-sm outline-none resize-none h-8 focus:h-24 transition-all duration-300"
                     aria-label="Caption"
                   />
                   <input
                     value={hashtagsText}
                     onChange={(e) => setHashtagsText(e.target.value)}
                     placeholder="Hashtags..."
                     className="w-full bg-black/50 text-white placeholder-white/50 border border-white/20 rounded-md px-2 py-1.5 text-sm outline-none h-8 focus:h-10 transition-all duration-300"
                     aria-label="Hashtags"
                   />
                   <div className="flex items-center justify-between">
                     <div className="text-xs text-white/70 font-semibold">Post without audio</div>
                     <button
                       type="button"
                       className={`w-12 h-7 rounded-full border transition-colors ${
                         postWithoutAudio ? 'bg-[#E6B36A] border-[#E6B36A]' : 'bg-white border-transparent'
                       }`}
                       onClick={() => {
                         const next = !postWithoutAudio;
                         setPostWithoutAudio(next);
                         if (next) setSelectedAudioId('none');
                         trackEvent('upload_toggle_no_audio', { value: next });
                       }}
                       aria-label="Toggle post without audio"
                     >
                       <div
                         className={`w-6 h-6 rounded-full bg-black transition-transform ${
                           postWithoutAudio ? 'translate-x-5' : 'translate-x-1'
                         }`}
                       />
                     </button>
                   </div>
                   {/* Removed the 'Post' button from inside here to avoid confusion. It is at the bottom. */}
                   {postError ? (
                     <div className="w-full mb-2 px-3 py-2 rounded bg-red-900/80 text-white text-sm">
                       {postError}
                       <button type="button" onClick={() => setPostError(null)} className="ml-2 underline">Dismiss</button>
                     </div>
                   ) : null}
                   {isPosting ? (
                     <div className="w-full">
                       <div className="flex items-center justify-between text-xs text-white/70 mb-1">
                         <span>{postProgress < 100 ? 'Posting…' : 'Finalizing…'}</span>
                         <span>{postProgress}%</span>
                       </div>
                       <div className="h-2 bg-white rounded-full overflow-hidden">
                         <div className="h-full bg-[#E6B36A]" style={{ width: `${postProgress}%` }} />
                       </div>
                     </div>
                   ) : null}
                 </div>
               </div>

                   {/* 10. Upload (Inside Post - Restored) */}
                   <button 
                       onClick={handleFileUpload}
                       className="absolute bottom-[10%] left-[5%] flex flex-col items-center gap-1 group z-30 pointer-events-auto"
                       title="Upload"
                   >
                       <div className="w-10 h-10 bg-gray-800/80 rounded-full flex items-center justify-center text-white border-2 border-white group-hover:bg-gray-700">
                           {/* Simple Upload Icon */}
                           <div className="w-4 h-4 border-2 border-white rounded-sm relative overflow-hidden">
                               <div className="absolute top-0.5 right-0.5 w-1 h-1 bg-white rounded-full"></div>
                           </div>
                       </div>
                       <span className="text-white font-bold text-[10px] shadow-black drop-shadow-md">Upload</span>
                   </button>
                   
                   {/* Preview Controls - Custom Buttons Over Overlay */}
                   <div className="absolute bottom-[10%] left-0 right-0 flex justify-center gap-20 z-20 pointer-events-auto">
                       <button 
                           onClick={handleDiscard}
                           className="flex flex-col items-center gap-1 group"
                           title="Retake"
                       >
                           <div className="w-10 h-10 bg-gray-800/80 rounded-full flex items-center justify-center text-white border-2 border-white group-hover:bg-gray-700">
                               <RotateCcw size={18} />
                           </div>
                           <span className="text-white font-bold text-[10px] shadow-black drop-shadow-md">Retake</span>
                       </button>

                       <button 
                           onClick={handlePost}
                           className="flex flex-col items-center gap-1 group disabled:opacity-60"
                           title="Post"
                           disabled={isPosting}
                       >
                           <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg border-2 border-white group-hover:scale-110 transition-transform">
                               <Check size={18} />
                           </div>
                           <span className="text-white font-bold text-[10px] shadow-black drop-shadow-md">{isPosting ? 'Posting' : 'Post'}</span>
                       </button>
                   </div>
               </div>
         </>
       ) : (
        /* CAMERA MODE */
        <>
          {/* Container Principal - Limitat la mărimea unui telefon (500px) */}
          <div className="relative z-10 w-full h-[100dvh] mb-0 pointer-events-none bg-black shadow-2xl overflow-hidden">
              
              {/* Camera Preview Layer */}
              <video 
                ref={videoRef}
                autoPlay 
                playsInline 
                muted
                className={`absolute inset-0 w-full h-full object-cover z-0 ${cameraError ? 'hidden' : ''}`}
                style={{ transform: `scale(${zoomLevel}) scaleX(-1)`, transformOrigin: 'center center' }}
              />

              {cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-[5] bg-black text-white p-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-[#E6B36A]/20 flex items-center justify-center mb-3">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E6B36A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h6l2 3h3a2 2 0 0 1 2 2v9.34"/><path d="M14.12 14.12A3 3 0 1 1 9.88 9.88"/></svg>
                  </div>
                  <p className="text-[#E6B36A] text-sm font-medium mb-1">Camera Access Needed</p>
                  <p className="text-white/50 text-xs mb-4 max-w-[260px] leading-relaxed">
                    {cameraError}
                  </p>
                  <button
                    onClick={() => {
                      setCameraError(null);
                      // Stop any existing stream
                      if (videoRef.current && videoRef.current.srcObject) {
                        const stream = videoRef.current.srcObject as MediaStream;
                        stream.getTracks().forEach(track => track.stop());
                        videoRef.current.srcObject = null;
                      }
                      setRecordedVideoUrl(null);
                      // Increment retry counter to force useEffect re-run
                      setCameraRetry(prev => prev + 1);
                    }}
                    className="px-5 py-2.5 rounded-full bg-[#E6B36A] text-black text-sm font-semibold active:scale-95 transition-transform pointer-events-auto"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Imaginea de fundal a interfeței - PESTE VIDEO cu SCREEN blend */}
              <img 
                src="/Icons/Camera.png" 
                className="absolute inset-0 w-full h-full object-fill object-bottom z-10 mix-blend-screen" 
                alt="Camera Interface"
              />

              {/* Interactive Hitboxes Layer */}
              <div className="absolute inset-0 z-20 w-full h-full pointer-events-auto">
                  {/* 1. Close Button */}
                  <button 
                    onClick={() => navigate('/feed')} 
                    className="absolute top-[2%] left-[5%] w-10 h-10 flex items-center justify-center"
                    title="Close"
                  >
                    <img src="/Icons/power-button.png" alt="Close" className="w-6 h-6" />
                  </button>

                  {/* 2. Sound/Music */}
                  <button 
                    className="absolute top-[2%] left-1/2 -translate-x-1/2 w-40 h-8 rounded-full flex items-center justify-center gap-1 bg-black border border-transparent z-[150]"
                    onClick={() => setShowMusicModal(true)}
                  >
                    <Music size={14} className="text-white" />
                    <span className="text-white text-xs font-bold truncate max-w-[120px]">
                        {getSelectedLabel()}
                    </span>
                  </button>

                  {/* Zoom Out */}
                  <button 
                    className="absolute top-[18%] right-[5%] w-8 h-8 flex items-center justify-center rounded-full bg-black/40 text-white"
                    onClick={handleZoomOut}
                    title="Zoom out"
                    aria-label="Zoom out"
                  >
                    <ZoomOut size={20} />
                  </button>
                  {/* Zoom In */}
                  <button 
                    className="absolute top-[26%] right-[5%] w-8 h-8 flex items-center justify-center rounded-full bg-black/40 text-white"
                    onClick={handleZoomIn}
                    title="Zoom in"
                    aria-label="Zoom in"
                  >
                    <ZoomIn size={20} />
                  </button>
                  {/* 3. Flip Camera */}
                  <button 
                    className="absolute top-[34%] right-[5%] w-8 h-8 flex items-center justify-center opacity-0 hover:opacity-100 hover:brightness-125 rounded-full"
                    onClick={() => alert('Flip Camera')}
                    title="Flip Camera"
                  >
                    <RefreshCw size={20} className="text-white" />
                  </button>

                  {/* 4. Speed */}
                  <button 
                    className="absolute top-[42%] right-[5%] w-8 h-8 flex items-center justify-center opacity-0 hover:opacity-100 hover:brightness-125 rounded-full"
                    onClick={() => alert('Speed')}
                    title="Speed"
                  >
                    <span className="text-white font-bold text-xs">1x</span>
                  </button>

                  {/* 5. Beauty */}
                  <button 
                    className="absolute top-[50%] right-[5%] w-8 h-8 flex items-center justify-center opacity-0 hover:opacity-100 hover:brightness-125 rounded-full"
                    onClick={() => alert('Beauty')}
                    title="Beauty"
                  >
                    <span className="text-white text-xs">✨</span>
                  </button>

                  {/* 6. Timer */}
                  <button 
                    className="absolute top-[58%] right-[5%] w-8 h-8 flex items-center justify-center opacity-0 hover:opacity-100 hover:brightness-125 rounded-full"
                    onClick={() => alert('Timer')}
                    title="Timer"
                  >
                    <Clock size={20} className="text-white" />
                  </button>

                  {/* 7. Flash */}
                  <button 
                    className="absolute top-[66%] right-[5%] w-8 h-8 flex items-center justify-center opacity-0 hover:opacity-100 hover:brightness-125 rounded-full"
                    onClick={() => alert('Flash')}
                    title="Flash"
                  >
                    <Zap size={20} className="text-white" />
                  </button>

                  {/* --- Bottom Controls --- */}

                  {/* 8. Effects */}
                  <button 
                    className="absolute bottom-[15%] left-[15%] w-10 h-10 bg-cyan-500/50 rounded-lg"
                    onClick={() => alert('Effects')}
                  >
                    Ef
                  </button>

                  {/* 9. Record Button (Play / Stop Logic) */}
                  <div className="absolute bottom-[10.5%] left-1/2 -translate-x-1/2 flex items-center gap-4">
                      {/* Done Button (Visible only if we have chunks and are paused or recording) */}
                      {(chunks.length > 0 || isPaused) && (
                          <button 
                            className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-white border-2 border-white animate-in fade-in zoom-in duration-300 absolute -right-20"
                            onClick={stopRecordingFinal}
                            title="Done"
                          >
                              <Check size={24} />
                          </button>
                      )}

                      <button 
                        className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-600 border-4 border-white' : 'bg-white border-4 border-white hover:bg-red-600/50'}`}
                        onClick={toggleRecording}
                      >
                        {isRecording ? (
                            <Square className="text-white fill-white w-8 h-8" />
                        ) : (
                            <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center">
                                {/* Inner Circle */}
                            </div>
                        )}
                      </button>
                  </div>

                  {/* 10. Upload (Left Side - VISIBLE NOW) */}
                  <button 
                    className="absolute bottom-8 left-6 flex flex-col items-center gap-1 z-[1000] pointer-events-auto group"
                    onClick={handleFileUpload}
                    title="Upload from Gallery"
                  >
                    <div className="w-10 h-10 bg-[#1a1a1a] rounded-full flex items-center justify-center text-white border-2 border-white group-hover:bg-gray-700">
                        {/* Gallery Icon */}
                        <div className="w-4 h-4 border-2 border-white rounded-sm relative overflow-hidden">
                            <div className="absolute top-0.5 right-0.5 w-1 h-1 bg-white rounded-full"></div>
                        </div>
                    </div>
                    <span className="text-white text-[10px] font-bold shadow-black drop-shadow-md">Upload</span>
                  </button>

              </div>
          </div>

          {/* Music Selection Modal */}
          {showMusicModal && (
              <div className="absolute inset-0 z-[200] bg-black flex flex-col pt-10 px-4 animate-in slide-in-from-bottom duration-300">
                  <div className="flex items-center justify-between mb-6">
                      <h2 className="text-white text-xl font-bold">Select Sound</h2>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const url = window.prompt('Paste audio URL (mp3/ogg):');
                            if (!url) return;
                            const title = window.prompt('Sound name:') ?? 'Custom sound';
                            const next: SoundTrack = {
                              id: Date.now(),
                              title: title.trim() || 'Custom sound',
                              artist: 'You',
                              duration: 'custom',
                              url: url.trim(),
                              license: 'Custom (you must own rights)',
                              source: 'Custom URL',
                              clipStartSeconds: 0,
                              clipEndSeconds: 180,
                            };
                            setCustomTracks((prev) => [next, ...prev]);
                          }}
                          className="px-3 py-1.5 rounded-full border border-transparent text-white/80 text-xs font-semibold hover:brightness-125"
                        >
                          Add URL
                        </button>
                        <button 
                          onClick={() => setShowMusicModal(false)}
                          className="p-2"
                        >
                            <img src="/Icons/power-button.png" alt="Close" className="w-5 h-5" />
                        </button>
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pb-10">
                      <div className="grid grid-cols-2 gap-2 pb-2">
                        <button
                          type="button"
                          className={`px-3 py-3 rounded-xl border text-left ${
                            selectedAudioId === 'original' && !postWithoutAudio
                              ? 'bg-[#E6B36A] border-[#E6B36A] text-black'
                              : 'bg-white border-transparent text-white'
                          }`}
                          onClick={() => {
                            setSelectedAudioId('original');
                            setPostWithoutAudio(false);
                            trackEvent('upload_select_audio', { type: 'original' });
                            setShowMusicModal(false);
                          }}
                        >
                          <div className="text-sm font-bold">Original Sound</div>
                          <div className={`text-[11px] ${selectedAudioId === 'original' && !postWithoutAudio ? 'text-black/70' : 'text-white/60'}`}>
                            Use the captured audio
                          </div>
                        </button>
                        <button
                          type="button"
                          className={`px-3 py-3 rounded-xl border text-left ${
                            postWithoutAudio || selectedAudioId === 'none'
                              ? 'bg-[#E6B36A] border-[#E6B36A] text-black'
                              : 'bg-white border-transparent text-white'
                          }`}
                          onClick={() => {
                            setSelectedAudioId('none');
                            setPostWithoutAudio(true);
                            trackEvent('upload_select_audio', { type: 'none' });
                            setShowMusicModal(false);
                          }}
                        >
                          <div className="text-sm font-bold">No audio</div>
                          <div className={`text-[11px] ${postWithoutAudio || selectedAudioId === 'none' ? 'text-black/70' : 'text-white/60'}`}>
                            Publish muted audio
                          </div>
                        </button>
                      </div>

                      {musicTracks.map((track) => (
                          <div 
                            key={track.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-white hover:brightness-125 cursor-pointer border border-transparent"
                            onClick={() => handleSelectMusic(track)}
                          >
                              <div className="flex items-center gap-3">
                                  <button 
                                    className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-500 rounded flex items-center justify-center hover:scale-105 transition-transform"
                                    onClick={(e) => togglePreview(e, track)}
                                  >
                                      {playingTrackId === track.id ? (
                                          <Square size={16} className="text-white fill-white" />
                                      ) : (
                                          <Play size={16} className="text-white fill-white" />
                                      )}
                                  </button>
                                  <div>
                                      <h3 className="text-white font-bold text-sm">{track.title}</h3>
                                      <p className="text-white/60 text-xs">{track.artist} • {formatClip(track.clipStartSeconds, track.clipEndSeconds)}</p>
                                      <p className="text-white/40 text-[11px]">{track.license}</p>
                                  </div>
                              </div>
                              {selectedAudioId === `track_${track.id}` && !postWithoutAudio && (
                                <Check className="text-green-400" size={20} />
                              )}
                          </div>
                      ))}
                  </div>
              </div>
          )}
        </>
      )}
    </div>
  );
}
