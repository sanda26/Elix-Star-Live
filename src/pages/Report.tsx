import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle, Flag } from 'lucide-react';
import { trackEvent } from '../lib/analytics';

const REPORT_REASONS = {
  video: [
    { id: 'spam', label: 'Spam or misleading' },
    { id: 'harassment', label: 'Harassment or bullying' },
    { id: 'hate_speech', label: 'Hate speech' },
    { id: 'violence', label: 'Violence or dangerous content' },
    { id: 'sexual_content', label: 'Sexual content' },
    { id: 'child_safety', label: 'Child safety concerns' },
    { id: 'copyright', label: 'Copyright violation' },
    { id: 'other', label: 'Other' },
  ],
  user: [
    { id: 'harassment', label: 'Harassment or bullying' },
    { id: 'impersonation', label: 'Impersonation' },
    { id: 'spam', label: 'Spam account' },
    { id: 'underage', label: 'Underage user' },
    { id: 'other', label: 'Other' },
  ],
  comment: [
    { id: 'spam', label: 'Spam' },
    { id: 'harassment', label: 'Harassment' },
    { id: 'hate_speech', label: 'Hate speech' },
    { id: 'other', label: 'Other' },
  ],
};

export default function Report() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const contentType = (searchParams.get('type') as 'video' | 'user' | 'comment') || 'video';
  const contentId = searchParams.get('id') || '';

  const [selectedReason, setSelectedReason] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const reasons = REPORT_REASONS[contentType] || REPORT_REASONS.video;

  const handleSubmit = async () => {
    if (!selectedReason) {
      alert('Please select a reason');
      return;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { error } = await supabase.from('reports').insert({
        reporter_id: userData.user.id,
        content_type: contentType,
        content_id: contentId,
        reason: selectedReason,
        details: details.trim() || null,
      });

      if (error) throw error;

      trackEvent('report_submit', {
        content_type: contentType,
        content_id: contentId,
        reason: selectedReason,
      });

      setSubmitted(true);
      setTimeout(() => {
        navigate(-1);
      }, 2000);
    } catch (error) {
      console.error('Failed to submit report:', error);
      alert('Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-[100dvh] bg-[#121212] text-[#00f2ea] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-20 h-20 bg-[#00f2ea] rounded-full mx-auto mb-4 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-[#00f2ea]" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Report Submitted</h2>
          <p className="text-[#00f2ea]/60">Thank you for helping keep our community safe.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#121212] text-[#00f2ea] flex justify-center px-2">
      <div className="w-full max-w-[480px] h-[100dvh] rounded-3xl overflow-hidden bg-[#121212] flex flex-col pt-[var(--safe-top)] pb-[calc(var(--safe-bottom)+12mm)]">
      {/* Header */}
      <div className="sticky top-0 bg-[#121212] z-10 px-4 py-4 border-b border-transparent flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="p-2 hover:brightness-125 rounded-full transition">
          <img src="/Icons/power-button.png" alt="Back" className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">Report {contentType}</h1>
        <div className="w-10"></div>
      </div>

      <div className="px-4 py-6 flex-1 overflow-y-auto">
        {/* Icon */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-red-500/20 rounded-full mx-auto mb-3 flex items-center justify-center">
            <Flag className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">Why are you reporting this?</h2>
          <p className="text-sm text-[#00f2ea]/60">
            Your report is anonymous and helps us maintain a safe community
          </p>
        </div>

        {/* Reasons */}
        <div className="space-y-2 mb-6">
          {reasons.map(reason => (
            <button
              key={reason.id}
              onClick={() => setSelectedReason(reason.id)}
              className={`w-full text-left px-4 py-4 rounded-xl transition ${
                selectedReason === reason.id
                  ? 'bg-[#00f2ea]/20 border-2 border-[#00f2ea]'
                  : 'bg-white border-2 border-transparent hover:brightness-125'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{reason.label}</span>
                {selectedReason === reason.id && (
                  <div className="w-6 h-6 bg-[#00f2ea] rounded-full flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-black" />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Additional Details */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">
            Additional details (optional)
          </label>
          <textarea
            value={details}
            onChange={e => setDetails(e.target.value)}
            placeholder="Provide more context to help us understand the issue..."
            maxLength={500}
            rows={4}
            className="w-full bg-white rounded-xl px-4 py-3 outline-none text-[#00f2ea] placeholder-[#00f2ea]/40 border border-transparent focus:border-[#00f2ea] transition resize-none"
          />
          <p className="text-xs text-[#00f2ea]/40 mt-1 text-right">{details.length}/500</p>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!selectedReason || loading}
          className="w-full py-4 bg-red-500 text-[#00f2ea] rounded-xl font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition"
        >
          {loading ? 'Submitting...' : 'Submit Report'}
        </button>
      </div>
      </div>
    </div>
  );
}
