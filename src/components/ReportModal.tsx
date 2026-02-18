import React, { useEffect, useState } from 'react';
import { AlertTriangle, Flag, Ban, EyeOff, MessageSquare, UserMinus } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useVideoStore } from '../store/useVideoStore';
import { supabase } from '../lib/supabase';

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
    color: 'text-yellow-400'
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
    color: 'text-orange-400'
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
    color: 'text-purple-400'
  },
  {
    id: 'copyright',
    title: 'Copyright infringement',
    description: 'Uses copyrighted material without permission',
    icon: Flag,
    color: 'text-blue-400'
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
    color: 'text-gray-400'
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
      alert('Please select a reason for reporting');
      return;
    }
    if (!authToken) {
      alert('Please sign in to submit a report.');
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
      console.error('Error submitting report:', error);
      alert('Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resolvedOwnerId = videoOwnerIdFromDb ?? videoOwnerId;
  const canDeleteDemo = contentType === 'video' && !!authUserId && videoId.startsWith('mock-');
  const canDeleteOwned = contentType === 'video' && !!authUserId && !!resolvedOwnerId && authUserId === resolvedOwnerId;
  const canDelete = canDeleteDemo || canDeleteOwned;

  const handleDelete = async () => {
    if (!canDelete) return;
    if (isDeletingVideo) return;
    const ok = window.confirm('Delete this video?');
    if (!ok) return;
    setIsDeletingVideo(true);
    try {
      await deleteVideo(videoId);
      onClose();
      setSelectedReason('');
      setAdditionalDetails('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete video.';
      alert(message);
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
      <div className="fixed inset-0 z-modals bg-black flex items-center justify-center p-4">
        <div className="bg-[#121212] rounded-2xl p-6 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
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
    <div className="fixed inset-0 z-modals flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/80 pointer-events-auto" onClick={onClose} />
      <div
        className="relative w-full z-10 bg-[#121212] rounded-t-2xl max-h-[40dvh] overflow-hidden flex flex-col border-t border-white/10 shadow-2xl pb-safe pointer-events-auto"
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-red-400" />
            <h3 className="text-white text-xs font-semibold">Report {getContentTypeLabel()}</h3>
          </div>
          {contentType === 'video' && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeletingVideo || !canDelete}
              className="px-2 py-1 rounded-md bg-red-500/10 text-red-400 text-[10px] font-semibold hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isDeletingVideo
                ? 'Deleting...'
                : !authUserId
                  ? 'Delete (sign in)'
                  : canDelete
                    ? 'Delete'
                    : 'Delete (owner)'}
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
          <div className="mb-3 bg-transparent5 rounded-md p-2 border border-white/5">
            <p className="text-white/50 text-[10px] leading-tight">
              <span className="text-white font-medium block mb-0.5">Why are you reporting this {getContentTypeLabel()}?</span>
              Your report helps us understand what violates our community guidelines.
            </p>
          </div>

          {/* Report Reasons */}
          <div className="space-y-1.5 mb-6">
            {reportReasons.map((reason) => {
              const IconComponent = reason.icon;
              return (
                <button
                  key={reason.id}
                  onClick={() => setSelectedReason(reason.id)}
                  className={`w-full text-left p-1.5 rounded-md border transition-all ${
                    selectedReason === reason.id
                      ? 'border-[#FE2C55] bg-[#FE2C55]/10'
                      : 'border-white/10 hover:border-white/20 hover:bg-transparent5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-1 rounded bg-transparent10 ${reason.color}`}>
                      <IconComponent className="w-3 h-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="text-white text-xs font-medium mb-0 truncate">{reason.title}</h5>
                      <p className="text-white/50 text-[10px] truncate">{reason.description}</p>
                    </div>
                    <div className={`w-3 h-3 rounded-full border flex items-center justify-center flex-shrink-0 ${
                      selectedReason === reason.id
                        ? 'border-[#FE2C55] bg-[#FE2C55]'
                        : 'border-white/30'
                    }`}>
                      {selectedReason === reason.id && (
                        <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Additional Details */}
          <div className="mb-3">
            <label className="text-white text-[10px] font-medium mb-0.5 block">Additional details (optional)</label>
            <textarea
              value={additionalDetails}
              onChange={(e) => setAdditionalDetails(e.target.value)}
              placeholder="Provide more context..."
              className="w-full bg-[#121212] border border-white/10 text-white rounded-md p-1.5 text-[9px] focus:outline-none focus:border-white/20 resize-none leading-tight"
              rows={2}
              maxLength={500}
            />
            <div className="text-right text-white/40 text-[9px] mt-0.5">
              {additionalDetails.length}/500
            </div>
          </div>

          {/* Privacy Notice */}
          <div className="bg-transparent5 rounded-md p-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
              </div>
              <p className="text-white/50 text-[9px] leading-tight">
                <span className="text-white font-medium">Your privacy matters.</span> The person you're reporting won't know who reported them.
              </p>
            </div>
          </div>
        </div>

          {/* Footer */}
        <div className="p-3 border-t border-white/10">
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-3 py-1.5 bg-transparent10 text-white text-xs font-medium rounded-md hover:bg-transparent20 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedReason}
              className="flex-1 px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-md hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
