import React, { useEffect, useState } from 'react';
import { AlertTriangle, Flag, Ban, EyeOff, MessageSquare, UserMinus } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useVideoStore } from '../store/useVideoStore';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/toast';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string;
  contentType: 'video' | 'comment' | 'user' | 'live';
  contentId?: string;
}

const reportReasons = [
  {
    id: 'spam',
    title: 'Spam or misleading',
    description: 'Promotes scams, fake engagement, or misleading content',
    icon: AlertTriangle,
    color: 'text-white'
  },
  {
    id: 'hate',
    title: 'Hate speech or symbols',
    description: 'Promotes hatred or violence against individuals or groups',
    icon: Ban,
    color: 'text-red-400'
  },
  {
    id: 'harassment',
    title: 'Harassment or bullying',
    description: 'Targets individuals with repeated unwanted contact or abuse',
    icon: MessageSquare,
    color: 'text-white'
  },
  {
    id: 'violence',
    title: 'Violent or dangerous acts',
    description: 'Promotes or glorifies violence, self-harm, or dangerous activities',
    icon: AlertTriangle,
    color: 'text-red-500'
  },
  {
    id: 'nudity',
    title: 'Nudity or sexual content',
    description: 'Contains explicit sexual content or nudity',
    icon: EyeOff,
    color: 'text-white'
  },
  {
    id: 'copyright',
    title: 'Copyright infringement',
    description: 'Uses copyrighted material without permission',
    icon: Flag,
    color: 'text-white'
  },
  {
    id: 'impersonation',
    title: 'Impersonation',
    description: 'Pretends to be someone else or misrepresents identity',
    icon: UserMinus,
    color: 'text-indigo-400'
  },
  {
    id: 'other',
    title: 'Other issue',
    description: 'Something else that violates community guidelines',
    icon: Flag,
    color: 'text-white'
  }
];

export default function ReportModal({ isOpen, onClose, videoId, contentType, contentId }: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isDeletingVideo, setIsDeletingVideo] = useState(false);
  const [videoOwnerIdFromDb, setVideoOwnerIdFromDb] = useState<string | null>(null);
  const authToken = useAuthStore((s) => s.session?.access_token ?? null);
  const authUserId = useAuthStore((s) => s.user?.id ?? null);
  const videoOwnerId = useVideoStore((s) => s.videos.find((v) => v.id === videoId)?.user.id ?? null);
  const deleteVideo = useVideoStore((s) => s.deleteVideo);

  useEffect(() => {
    let cancelled = false;
    if (!isOpen || contentType !== 'video') return;
    setVideoOwnerIdFromDb(null);
    void (async () => {
    try {
      const { data } = await supabase
        .from('videos')
        .select('user_id')
        .eq('id', videoId)
        .single();
      if (cancelled) return;
      setVideoOwnerIdFromDb(data?.user_id ?? null);
    } catch {
    }
  })();return () => {
      cancelled = true;
    };
  }, [contentType, isOpen, videoId]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!selectedReason) {
      showToast('Please select a reason for reporting');
      return;
    }
    if (!authToken) {
      showToast('Please sign in to submit a report.');
      return;
    }

    setIsSubmitting(true);

    try {
      const targetId = (contentType === 'video' ? videoId : contentId || videoId).trim();
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          targetType: contentType,
          targetId,
          reason: selectedReason,
          details: additionalDetails,
          contextVideoId: videoId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = data?.error || 'Failed to submit report. Please try again.';
        throw new Error(message);
      }

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
        // Reset form
        setSelectedReason('');
        setAdditionalDetails('');
      }, 2000);
    } catch (error) {

      showToast('Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resolvedOwnerId = videoOwnerIdFromDb ?? videoOwnerId;
  const canDeleteByAdmin = false;
  const canDeleteOwned = contentType === 'video' && !!authUserId && !!resolvedOwnerId && authUserId === resolvedOwnerId;
  const canDelete = canDeleteByAdmin || canDeleteOwned;

  const handleDelete = async () => {
    if (!canDelete) return;
    if (isDeletingVideo) return;
    setIsDeletingVideo(true);
    try {
      await deleteVideo(videoId);
      onClose();
      setSelectedReason('');
      setAdditionalDetails('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete video.';
      showToast(message);
    } finally {
      setIsDeletingVideo(false);
    }
  };

  const getContentTypeLabel = () => {
    switch (contentType) {
      case 'video': return 'video';
      case 'comment': return 'comment';
      case 'user': return 'user';
      case 'live': return 'live stream';
      default: return 'content';
    }
  };

  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-modals bg-[#13151A] flex items-center justify-center p-4">
        <div className="bg-[#13151A] rounded-2xl p-6 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-[#C9A96E]/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 bg-[#C9A96E] rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h3 className="text-white font-semibold mb-2">Report Submitted</h3>
          <p className="text-white/60 text-sm">
            Thank you for helping keep our community safe. We'll review your report and take appropriate action.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-modals flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 pointer-events-auto" onClick={onClose} />

      <div className="relative w-full max-w-[480px] z-10 bg-[#1C1E24]/95 backdrop-blur-md rounded-t-2xl p-4 pb-safe flex flex-col gap-1 shadow-2xl border-t border-[#C9A96E]/20 pointer-events-auto h-[40vh] max-h-[40vh] overflow-y-auto no-scrollbar">
        <div className="flex justify-center mb-2">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        <div className="flex items-center gap-1.5 mb-1">
          <Flag className="w-3.5 h-3.5 text-red-400" strokeWidth={1.8} />
          <h3 className="text-white font-bold text-[13px] whitespace-nowrap">Report {getContentTypeLabel()}</h3>
        </div>

        {contentType === 'video' && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeletingVideo || !canDelete}
            className="w-full px-3 py-2 flex items-center gap-2.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-40"
          >
            <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.8} />
            <span className="text-xs font-semibold">
              {isDeletingVideo ? 'Deleting...' : canDelete ? 'Delete' : 'Delete (owner only)'}
            </span>
          </button>
        )}

        <p className="text-white/35 text-[10px] leading-snug px-0.5 mb-1">Select a reason below.</p>

        <div className="flex flex-col gap-0.5">
          {reportReasons.map((reason) => {
            const IconComponent = reason.icon;
            const selected = selectedReason === reason.id;
            return (
              <button
                key={reason.id}
                type="button"
                onClick={() => setSelectedReason(reason.id)}
                className={`w-full px-3 py-2 flex items-center justify-between rounded-lg transition-colors ${selected ? 'bg-[#C9A96E]/10' : 'hover:bg-white/[0.03]'}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-7 h-7 rounded-full bg-[#13151A] border flex items-center justify-center flex-shrink-0 ${selected ? 'border-[#C9A96E]/50' : 'border-white/10'}`}>
                    <IconComponent className="w-3.5 h-3.5" strokeWidth={1.8} />
                  </div>
                  <span className="text-white/80 text-xs font-medium truncate">{reason.title}</span>
                </div>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${selected ? 'border-[#C9A96E] bg-[#C9A96E]' : 'border-white/20'}`}>
                  {selected && (
                    <svg className="w-2.5 h-2.5 text-black" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <textarea
          value={additionalDetails}
          onChange={(e) => setAdditionalDetails(e.target.value)}
          placeholder="Additional details (optional)..."
          className="w-full bg-[#13151A]/40 border border-white/10 text-white rounded-lg p-2.5 text-xs focus:outline-none focus:border-white/20 resize-none leading-snug mt-2"
          rows={2}
          maxLength={500}
        />

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-white/5 text-white/70 font-semibold text-xs rounded-lg hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedReason}
            className="flex-1 py-2.5 bg-[#C9A96E] text-black font-bold text-xs rounded-lg hover:brightness-110 disabled:opacity-40 transition"
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
