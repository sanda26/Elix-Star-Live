import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Music,
  Square,
  Play,
  Pause,
  CameraOff,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { setCachedCameraStream } from '../lib/cameraStream';
import { type SoundTrack, fetchSoundTracksFromDatabase } from '../lib/soundLibrary';
import ElixCameraLayout from '../components/ElixCameraLayout';

type CreateMode = 'upload' | 'post' | 'create' | 'live';

type Sound = SoundTrack;

function SoundPickerModal({
  isOpen,
  onClose,
  onPick,
}: {
  isOpen: boolean;
  onClose: () => void;
  onPick: (sound: Sound) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clipRef = useRef<{ start: number; end: number } | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [customSounds, setCustomSounds] = useState<Sound[]>([]);
  const [builtInSounds, setBuiltInSounds] = useState<Sound[]>([]);
  const sounds = useMemo<Sound[]>(() => {
    const builtIn = builtInSounds.filter((t) => !!t.url);
    return [...customSounds, ...builtIn];
  }, [customSounds, builtInSounds]);

  useEffect(() => {
    fetchSoundTracksFromDatabase().then(setBuiltInSounds);
  }, []);

  const formatClip = (start: number, end: number) => {
    const total = Math.max(0, Math.floor(end - start));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTimeUpdate = () => {
      const clip = clipRef.current;
      if (!clip) return;
      if (clip.end > clip.start && a.currentTime >= clip.end) {
        a.currentTime = clip.start;
        a.play().catch(() => {});
      }
    };
    a.addEventListener('timeupdate', onTimeUpdate);
    return () => {
      a.removeEventListener('timeupdate', onTimeUpdate);
      a.pause();
    };
  }, []);

  const togglePreview = async (s: Sound) => {
    const a = audioRef.current;
    if (!a) return;

    if (playingId === String(s.id)) {
      a.pause();
      clipRef.current = null;
      setPlayingId(null);
      return;
    }

    a.src = s.url;
    const start = Math.max(0, s.clipStartSeconds);
    const end = Math.max(start, s.clipEndSeconds);
    clipRef.current = { start, end };
    a.currentTime = start;
    try {
      await a.play();
      setPlayingId(String(s.id));
    } catch {
      clipRef.current = null;
      setPlayingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] bg-[#13151A] flex items-end justify-center">
      <div className="w-full bg-[#13151A] border-t border-[#C9A96E]/30 rounded-t-2xl overflow-hidden">
        <audio
          ref={audioRef}
          preload="auto"
          onEnded={() => setPlayingId(null)}
          className="hidden"
        />
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#C9A96E]/20">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-white" strokeWidth={2} />
            <p className="text-white font-semibold">Add sound</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const url = window.prompt('Paste audio URL (mp3/ogg):');
                if (!url) return;
                const title = window.prompt('Sound name:') ?? 'Custom sound';
                const next: Sound = {
                  id: Date.now(),
                  title: title.trim() || 'Custom sound',
                  artist: 'You',
                  duration: 'custom',
                  url: url.trim(),
                  license: 'Custom (you must own rights)',
                  source: 'Custom URL',
                  clipStartSeconds: 0,
                  clipEndSeconds: 120,
                };
                setCustomSounds((prev) => [next, ...prev]);
              }}
              className="px-3 py-1.5 rounded-full border border-[#C9A96E]/35 text-white text-xs font-semibold"
            >
              Add URL
            </button>
            <button onClick={onClose} className="p-2">
              <img src="/Icons/power-button.png" alt="Close" className="w-4 h-4 object-contain" />
            </button>
          </div>
        </div>

        <div className="max-h-[45vh] overflow-y-auto">
          {sounds.map((s) => (
            <div
              key={s.id}
              className="w-full px-3 py-2 flex items-center justify-between hover:brightness-125 transition-colors"
            >
              <div className="text-left flex-1 min-w-0 mr-2">
                <p className="text-white text-sm font-medium leading-4 truncate">{s.title}</p>
                <p className="text-white/50 text-xs leading-4 truncate">{s.artist} • {formatClip(s.clipStartSeconds, s.clipEndSeconds)}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => togglePreview(s)}
                  className="w-8 h-8 rounded-full border border-[#C9A96E]/25 bg-[#13151A] flex items-center justify-center"
                >
                  {playingId === String(s.id) ? (
                    <Pause className="w-3.5 h-3.5 text-white" strokeWidth={2} />
                  ) : (
                    <Play className="w-3.5 h-3.5 text-white" strokeWidth={2} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onPick(s);
                    onClose();
                  }}
                  className="px-2.5 py-1 rounded-full border border-[#C9A96E]/35 text-white text-[10px] font-semibold"
                >
                  Use
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}



export default function Create() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<CreateMode>('create');
  const [isSoundOpen, setIsSoundOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [recordingDelaySeconds, setRecordingDelaySeconds] = useState<0 | 3 | 10>(0);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isLandscapeStream, setIsLandscapeStream] = useState(false);
  const [hwZoomRange, setHwZoomRange] = useState<{ min: number; max: number } | null>(null);
  const [retryCamera, setRetryCamera] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const keepStreamOnUnmountRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1);

  useEffect(() => {
    const stopStream = () => {
      if (keepStreamOnUnmountRef.current) return;
      const current = streamRef.current;
      if (!current) return;
      current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };

    if (previewUrl) {
      stopStream();
      return;
    }

    let cancelled = false;

    const start = async () => {
      try {
        setCameraError(null);

        // Check HTTPS requirement first
        const isInsecure =
          typeof window !== 'undefined' &&
          window.location.protocol !== 'https:' &&
          window.location.hostname !== 'localhost';
        if (isInsecure) {
          setCameraError('Camera requires HTTPS. Open this page with https:// to use the camera.');
          return;
        }

        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraError('Camera not supported on this device.');
          return;
        }

        // Check permission state BEFORE calling getUserMedia
        try {
          const permStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
          if (permStatus.state === 'denied') {
            setCameraError('Camera is blocked by your browser. Click the 🔒 lock icon in your address bar, set Camera to "Allow", then tap Try Again.');
            return;
          }
        } catch {
          // permissions.query not supported on this browser — proceed to getUserMedia
        }

        stopStream();

        // No resolution constraints = camera uses its widest native field of view
        const nextStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: isFrontCamera ? 'user' : 'environment',
          },
          audio: false,
        });

        if (cancelled) {
          nextStream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = nextStream;

        // Detect stream orientation & set hardware zoom to minimum
        const track = nextStream.getVideoTracks()[0];
        if (track) {
          const settings = track.getSettings();
          const w = settings.width || 0;
          const h = settings.height || 0;
          setIsLandscapeStream(w > h);

          // Set camera zoom to minimum for widest view
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const caps = track.getCapabilities?.() as any;
            if (caps?.zoom) {
              setHwZoomRange({ min: caps.zoom.min, max: caps.zoom.max });
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await track.applyConstraints({ advanced: [{ zoom: caps.zoom.min } as any] });
            } else {
              setHwZoomRange(null);
            }
          } catch {
            setHwZoomRange(null);
          }
        }

        if (videoRef.current) {
          videoRef.current.srcObject = nextStream;
        }

        // Reset zoom on new camera stream
        setZoomLevel(1);
      } catch (e: unknown) {
        if (cancelled) return;

        const err = e as { name?: string };

        if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
          setCameraError('Camera is blocked by your browser. Click the 🔒 lock icon in your address bar, set Camera to "Allow", then tap Try Again.');
          return;
        }

        if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
          setCameraError('No camera found on this device.');
          return;
        }

        setCameraError('Camera unavailable. Make sure no other app is using it.');
      }
    };

    start();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [isFrontCamera, previewUrl, retryCamera]);

  const openUploadPicker = () => {
    fileInputRef.current?.click();
  };

  const flipCamera = () => {
    setIsFrontCamera((v) => !v);
    setZoomLevel(1); // Reset zoom when flipping camera
  };

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1800);
  };

  const cycleTimer = () => {
    setRecordingDelaySeconds((v) => (v === 0 ? 3 : v === 3 ? 10 : 0));
  };

  // ── Flash / Torch toggle ──
  const handleFlashToggle = async () => {
    const stream = streamRef.current;
    if (!stream) {
      showToast('Camera not ready');
      return;
    }
    const track = stream.getVideoTracks()[0];
    if (!track) {
      showToast('No camera track');
      return;
    }
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const capabilities = track.getCapabilities?.() as any;
        if (capabilities?.torch) {
          const newTorch = !flashEnabled;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await track.applyConstraints({ advanced: [{ torch: newTorch } as any] });
        setFlashEnabled(newTorch);
        showToast(newTorch ? 'Flash ON' : 'Flash OFF');
      } else {
        showToast('Flash not available on this device');
      }
    } catch {
      showToast('Flash not supported');
    }
  };

  // ── Zoom helpers ──
  const applyZoom = async (newZoom: number) => {
    const stream = streamRef.current;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;

    // Try hardware zoom first (uses actual camera optics)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const caps = track.getCapabilities?.() as any;
      if (caps?.zoom) {
        const clamped = Math.max(caps.zoom.min, Math.min(newZoom, caps.zoom.max));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await track.applyConstraints({ advanced: [{ zoom: clamped } as any] });
        setZoomLevel(clamped);
        return;
      }
    } catch { /* hardware zoom not supported */ }

    // Fallback: CSS zoom (clamped 1-5)
    setZoomLevel(Math.max(1, Math.min(newZoom, 5)));
  };

  const handleZoomIn = async () => {
    await applyZoom(zoomLevel + 0.5);
  };

  const handleZoomOut = async () => {
    const minZoom = hwZoomRange?.min ?? 1;
    await applyZoom(Math.max(zoomLevel - 0.5, minZoom));
  };

  const handleZoomReset = async () => {
    const minZoom = hwZoomRange?.min ?? 1;
    await applyZoom(minZoom);
    showToast('Zoom reset');
  };

  // ── Pinch-to-zoom touch handlers ──
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDistRef.current = Math.sqrt(dx * dx + dy * dy);
      pinchStartZoomRef.current = zoomLevel;
    }
  };

  const handleTouchMove = async (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Calculate zoom ratio from pinch gesture
      const scale = dist / pinchStartDistRef.current;
      const maxZoom = hwZoomRange?.max ?? 5;
      const minZoom = hwZoomRange?.min ?? 1;
      const newZoom = Math.max(minZoom, Math.min(pinchStartZoomRef.current * scale, maxZoom));

      await applyZoom(parseFloat(newZoom.toFixed(1)));
    }
  };

  const handleTouchEnd = () => {
    pinchStartDistRef.current = null;
  };

  // ── Speed change ──
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    showToast(`Speed ${speed}x`);
  };

  const startRecordingNow = () => {
    const stream = streamRef.current;
    if (!stream) return;

    const preferredTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
    ];

    const chosenType = preferredTypes.find((t) => {
      try {
        return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t);
      } catch {
        return false;
      }
    });

    recordedChunksRef.current = [];

    try {
      const recorder = new MediaRecorder(stream, chosenType ? { mimeType: chosenType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: chosenType || 'video/webm' });
        const url = URL.createObjectURL(blob);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setIsPreviewPlaying(true);
        setMode('create');
      };

      recorder.start(250);
      setIsRecording(true);
    } catch {
      setCameraError('Recording not supported on this device.');
    }
  };

  const startRecording = () => {
    if (recordingDelaySeconds === 0) {
      startRecordingNow();
      return;
    }

    setCountdownSeconds(recordingDelaySeconds);
    const startedAt = Date.now();
    const total = recordingDelaySeconds;

    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const left = total - elapsed;
      if (left <= 0) {
        setCountdownSeconds(null);
        startRecordingNow();
        return;
      }
      setCountdownSeconds(left);
      window.setTimeout(tick, 200);
    };

    window.setTimeout(tick, 200);
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    setIsRecording(false);
  };

  const togglePreviewPlayback = async () => {
    const v = previewVideoRef.current;
    if (!v) return;
    if (!v.paused) {
      v.pause();
      v.currentTime = 0;
      setIsPreviewPlaying(false);
      return;
    }
    try {
      await v.play();
      setIsPreviewPlaying(true);
    } catch {
      setIsPreviewPlaying(false);
    }
  };

  const onMode = (m: CreateMode) => {
    setMode(m);
    if (m === 'upload') {
      openUploadPicker();
      return;
    }
    if (m === 'post') {
      navigate('/upload');
      return;
    }
  };

  const startLive = async () => {
    try {
      const current = streamRef.current;
      const hasAudio = (current?.getAudioTracks().length || 0) > 0;

      if (!current || !hasAudio) {
        let nextStream: MediaStream | null = null;
        try {
          nextStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: isFrontCamera ? 'user' : 'environment',
            },
            audio: true,
          });
        } catch {
          try {
            nextStream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: isFrontCamera ? 'user' : 'environment',
              },
              audio: false,
            });
            showToast('Microphone permission denied. Going live without sound.');
          } catch {
            setCameraError('Camera access denied');
            return;
          }
        }

        if (current) {
          current.getTracks().forEach((t) => t.stop());
        }

        streamRef.current = nextStream;
        if (videoRef.current) {
          videoRef.current.srcObject = nextStream;
        }

        setCachedCameraStream(nextStream);
      } else {
        setCachedCameraStream(current);
      }

      keepStreamOnUnmountRef.current = true;
      navigate('/live/broadcast');
    } catch {
      setCameraError('Camera access denied');
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#13151A] text-white flex justify-center">
      <div className="relative w-full min-h-[100dvh] overflow-hidden">
        
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          aria-label="Select video file"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const nextUrl = URL.createObjectURL(file);
            setPreviewUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return nextUrl;
            });
            setIsPreviewPlaying(true);
            setMode('create');
          }}
        />

        <div className="absolute inset-0">
          {previewUrl ? (
            <video
              ref={previewVideoRef}
              src={previewUrl}
              className="w-full h-full object-cover"
              autoPlay
              loop
              muted
              playsInline
              onPlay={() => setIsPreviewPlaying(true)}
              onPause={() => setIsPreviewPlaying(false)}
            />
          ) : (
            <div
              className="w-full h-full bg-[#13151A] relative flex items-center justify-center"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                muted
                playsInline
                style={{
                  // CSS zoom only used when hardware zoom not available
                  transform: isFrontCamera
                    ? (zoomLevel > 1 && !hwZoomRange ? `scaleX(-1) scale(${zoomLevel})` : 'scaleX(-1)')
                    : (zoomLevel > 1 && !hwZoomRange ? `scale(${zoomLevel})` : undefined),
                  transformOrigin: 'center center',
                  transition: 'transform 0.2s ease-out',
                }}
              />

              {cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#13151A] z-[100]">
                  <div className="text-center p-5 max-w-[280px]">
                    <CameraOff className="w-12 h-12 text-white/70 mx-auto mb-4" strokeWidth={1.5} />
                    <p className="text-white text-sm font-semibold mb-2">Camera Access Needed</p>
                    <p className="text-white/60 text-xs mb-5 leading-relaxed">{cameraError}</p>
                    <button
                      onClick={() => {
                        setCameraError(null);
                        setRetryCamera((c) => c + 1);
                      }}
                      className="px-6 py-2.5 rounded-full bg-[#C9A96E] text-black text-sm font-semibold active:scale-95 transition-transform"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              )}


            </div>
          )}
        </div>

        {previewUrl && (
          <div className="absolute right-4 bottom-[132px] z-[25]">
            <button
              onClick={togglePreviewPlayback}
              className="w-11 h-11 rounded-full border border-[#C9A96E]/35 bg-[#13151A] flex items-center justify-center"
            >
              {isPreviewPlaying ? (
                <Square className="w-5 h-5 text-white" strokeWidth={2} />
              ) : (
                <Play className="w-5 h-5 text-white" strokeWidth={2} />
              )}
            </button>
          </div>
        )}

        {countdownSeconds !== null && (
          <div className="absolute inset-0 z-[80] flex items-center justify-center bg-[#13151A]">
            <div className="w-24 h-24 rounded-full bg-[#13151A] border border-[#C9A96E]/35 flex items-center justify-center">
              <div className="text-4xl font-black text-white">{countdownSeconds}</div>
            </div>
          </div>
        )}

        {toast && (
          <div className="absolute left-0 right-0 top-20 z-[90] flex justify-center px-4">
            <div className="px-4 py-2 rounded-full bg-[#13151A] border border-transparent text-sm text-white/80">
              {toast}
            </div>
          </div>
        )}

        {/* ElixCameraLayout - New Camera UI */}
        <ElixCameraLayout
          videoRef={videoRef}
          isRecording={isRecording}
          isPaused={false}
          onRecord={mode === 'live' ? startLive : (isRecording ? stopRecording : startRecording)}
          onClose={() => navigate('/feed')}
          onFlipCamera={flipCamera}
          onSelectMusic={() => setIsSoundOpen(true)}
          onAIMusicGenerator={() => setIsSoundOpen(true)}
          zoomLevel={zoomLevel}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoomReset={handleZoomReset}
          onGalleryOpen={openUploadPicker}
          onPostTab={() => onMode('post')}
          onCreateTab={() => onMode('create')}
          onLiveTab={() => onMode('live')}
          selectedTab={mode === 'live' ? 'live' : mode === 'post' ? 'post' : 'create'}
          onFlashToggle={handleFlashToggle}
          flashActive={flashEnabled}
          timerDelay={recordingDelaySeconds}
          onTimerCycle={cycleTimer}
          onSpeedChange={handleSpeedChange}
          currentSpeed={playbackSpeed}
          hasRecordedVideo={!!previewUrl}
          onRetake={() => {
            setPreviewUrl(null);
            setIsPreviewPlaying(false);
          }}
          onPost={() => {
             navigate('/upload');
          }}
        />

        <SoundPickerModal
          isOpen={isSoundOpen}
          onClose={() => setIsSoundOpen(false)}
          onPick={() => {}}
        />
      </div>
    </div>
  );
}
