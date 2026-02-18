import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Book, HelpCircle, Mail, MessageCircle, Send, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { trackEvent } from '../lib/analytics';

const FAQ_ITEMS = [
  {
    question: 'How do I earn coins?',
    answer: 'You can purchase coins through the in-app store, or receive them as gifts from other users during your live streams.',
  },
  {
    question: 'What are battles?',
    answer: 'Battles are live competitions between two streamers where viewers send gifts to support their favorite creator. The streamer with the most gifts at the end wins!',
  },
  {
    question: 'How do I start a live stream?',
    answer: 'Tap the "+" button, select "Go Live", and follow the prompts to start broadcasting.',
  },
  {
    question: 'Can I download my videos?',
    answer: 'Yes! Tap the three dots on your video and select "Download" to save it to your device.',
  },
  {
    question: 'How do I delete my account?',
    answer: 'Go to Settings → Account → Delete Account. This action is permanent and cannot be undone.',
  },
  {
    question: 'What content is not allowed?',
    answer: 'Please review our Community Guidelines for a complete list. In general, content that promotes violence, harassment, hate speech, or illegal activities is prohibited.',
  },
];

export default function Support() {
  const navigate = useNavigate();
  const [showContactForm, setShowContactForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmitTicket = async () => {
    if (!subject.trim() || !message.trim() || !email.trim()) {
      alert('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      // In a real app, this would send to a support ticket system
      // For now, we'll log it and track the event
      console.log('Support ticket:', { subject, message, email, userId: userData.user?.id });

      trackEvent('support_ticket_submit', {
        subject,
        has_user: !!userData.user,
      });

      setSubmitted(true);
      setTimeout(() => {
        navigate(-1);
      }, 2000);
    } catch (error) {
      console.error('Failed to submit ticket:', error);
      alert('Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-20 h-20 bg-green-500 rounded-full mx-auto mb-4 flex items-center justify-center">
            <Send className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Message Sent!</h2>
          <p className="text-white/60">We'll get back to you within 24 hours.</p>
        </div>
      </div>
    );
  }

  if (showContactForm) {
    return (
      <div className="min-h-screen bg-black text-white">
        {/* Header */}
        <div className="sticky top-0  z-10 px-4 py-4 border-b border-transparent flex items-center justify-between">
          <button
            onClick={() => setShowContactForm(false)}
            className="p-2 hover:brightness-125 rounded-full transition"
          >
            <img src="/Icons/power-button.png" alt="Back" className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">Contact Support</h1>
          <div className="w-10"></div>
        </div>

        <div className="px-4 py-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full bg-black rounded-lg px-4 py-3 outline-none text-white placeholder-white/40 border border-transparent focus:border-[#E6B36A] transition"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Brief description of your issue"
              maxLength={100}
              className="w-full bg-black rounded-lg px-4 py-3 outline-none text-white placeholder-white/40 border border-transparent focus:border-[#E6B36A] transition"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Describe your issue in detail..."
              maxLength={1000}
              rows={6}
              className="w-full bg-black rounded-lg px-4 py-3 outline-none text-white placeholder-white/40 border border-transparent focus:border-[#E6B36A] transition resize-none"
            />
            <p className="text-xs text-white/40 mt-1 text-right">{message.length}/1000</p>
          </div>

          <button
            onClick={handleSubmitTicket}
            disabled={loading || !subject.trim() || !message.trim() || !email.trim()}
            className="w-full py-4 bg-[#E6B36A] text-black rounded-xl font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition"
          >
            {loading ? 'Sending...' : 'Send Message'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0  z-10 px-4 py-4 border-b border-transparent flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:brightness-125 rounded-full transition">
          <img src="/Icons/power-button.png" alt="Back" className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Help & Support</h1>
      </div>

      <div className="px-4 py-6">
        {/* Quick Links */}
        <Section title="Quick Links">
          <QuickLinkCard
            icon={<MessageCircle className="w-6 h-6" />}
            label="Contact Support"
            onClick={() => setShowContactForm(true)}
            color="bg-blue-500"
          />
          <QuickLinkCard
            icon={<Shield className="w-6 h-6" />}
            label="Safety Center"
            onClick={() => navigate('/settings/safety')}
            color="bg-purple-500"
          />
          <QuickLinkCard
            icon={<Book className="w-6 h-6" />}
            label="Community Guidelines"
            onClick={() => navigate('/guidelines')}
            color="bg-green-500"
          />
        </Section>

        {/* FAQ */}
        <Section title="Frequently Asked Questions">
          <div className="space-y-3">
            {FAQ_ITEMS.map((item, index) => (
              <FAQItem key={index} question={item.question} answer={item.answer} />
            ))}
          </div>
        </Section>

        {/* Legal */}
        <Section title="Legal">
          <TextLink label="Terms of Service" onClick={() => navigate('/terms')} />
          <TextLink label="Privacy Policy" onClick={() => navigate('/privacy')} />
          <TextLink label="Copyright Policy" onClick={() => navigate('/copyright')} />
        </Section>

        {/* Contact */}
        <div className="mt-8 p-6  rounded-2xl text-center">
          <Mail className="w-8 h-8 text-[#E6B36A] mx-auto mb-3" />
          <p className="text-sm text-white/80 mb-1">Email us directly</p>
          <a
            href="mailto:support@elixstar.live"
            className="text-[#E6B36A] font-semibold hover:underline"
          >
            support@elixstar.live
          </a>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-white/60 mb-3 px-2">{title}</h2>
      {children}
    </div>
  );
}

function QuickLinkCard({
  icon,
  label,
  onClick,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 p-4  rounded-xl hover:brightness-125 transition w-full text-left mb-2"
    >
      <div className={`w-12 h-12 ${color} rounded-full flex items-center justify-center text-white`}>
        {icon}
      </div>
      <span className="font-semibold">{label}</span>
    </button>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className=" rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:brightness-125 transition text-left"
      >
        <span className="font-semibold pr-4">{question}</span>
        <HelpCircle className={`w-5 h-5 flex-shrink-0 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="px-4 pb-4 text-sm text-white/70">
          {answer}
        </div>
      )}
    </div>
  );
}

function TextLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 hover: rounded-lg transition"
    >
      <span className="text-white/80 hover:text-[#E6B36A]">{label}</span>
    </button>
  );
}
