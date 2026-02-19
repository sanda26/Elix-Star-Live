import React, { useState } from 'react';
import { 
  Link, 
  Download, 
  Mail, 
  MessageCircle,
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  Check,
  Share2,
  QrCode,
  Code
} from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: {
    id: string;
    url: string;
    thumbnail?: string;
    description: string;
    user: {
      username: string;
    };
    stats: {
      likes: number;
      comments: number;
    };
  };
}

const sharePlatforms = [
  {
    name: 'Copy Link',
    icon: Link,
    color: 'bg-gray-600',
    hover: 'hover:bg-gray-700',
    action: 'copy'
  },
  {
    name: 'Messages',
    icon: MessageCircle,
    color: 'bg-green-600',
    hover: 'hover:bg-green-700',
    action: 'sms'
  },
  {
    name: 'Email',
    icon: Mail,
    color: 'bg-red-600',
    hover: 'hover:bg-red-700',
    action: 'email'
  },
  {
    name: 'WhatsApp',
    icon: MessageCircle,
    color: 'bg-green-500',
    hover: 'hover:bg-green-600',
    action: 'whatsapp'
  },
  {
    name: 'Facebook',
    icon: Facebook,
    color: 'bg-blue-600',
    hover: 'hover:bg-blue-700',
    action: 'facebook'
  },
  {
    name: 'Twitter',
    icon: Twitter,
    color: 'bg-blue-400',
    hover: 'hover:bg-blue-500',
    action: 'twitter'
  },
  {
    name: 'Instagram',
    icon: Instagram,
    color: 'bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500',
    hover: 'hover:from-purple-700 hover:via-pink-700 hover:to-orange-600',
    action: 'instagram'
  },
  {
    name: 'YouTube',
    icon: Youtube,
    color: 'bg-red-600',
    hover: 'hover:bg-red-700',
    action: 'youtube'
  }
];

export default function ShareModal({ isOpen, onClose, video }: ShareModalProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);

  if (!isOpen) return null;

  const videoUrl = `${window.location.origin}/video/${video.id}`;
  const shareText = `Check out this amazing video by @${video.user.username}: ${video.description}`;

  const handleShare = async (platform: string) => {
    try {
      switch (platform) {
        case 'copy':
          await navigator.clipboard.writeText(videoUrl);
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 2000);
          break;
          
        case 'sms':
          window.open(`sms:?body=${encodeURIComponent(shareText + ' ' + videoUrl)}`);
          break;
          
        case 'email':
          window.open(`mailto:?subject=Check out this video&body=${encodeURIComponent(shareText + '\n\n' + videoUrl)}`);
          break;
          
        case 'whatsapp':
          window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + videoUrl)}`);
          break;
          
        case 'facebook':
          window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(videoUrl)}&quote=${encodeURIComponent(shareText)}`);
          break;
          
        case 'twitter':
          window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(videoUrl)}`);
          break;
          
        case 'instagram':
          // Instagram doesn't allow direct sharing via URL, copy to clipboard instead
          await navigator.clipboard.writeText(shareText + ' ' + videoUrl);
          alert('Caption copied to clipboard! You can now paste it in your Instagram story or post.');
          break;
          
        case 'youtube':
          // YouTube doesn't allow direct sharing, copy to clipboard instead
          await navigator.clipboard.writeText(shareText + ' ' + videoUrl);
          alert('Video link copied to clipboard!');
          break;
          
        default:
          if (navigator.share) {
            await navigator.share({
              title: `Video by @${video.user.username}`,
              text: shareText,
              url: videoUrl,
            });
          } else {
            await navigator.clipboard.writeText(videoUrl);
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2000);
          }
      }
    } catch (error) {
      console.error('Error sharing:', error);
      // Fallback to copying link
      try {
        await navigator.clipboard.writeText(videoUrl);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } catch (clipboardError) {
        console.error('Failed to copy to clipboard:', clipboardError);
      }
    }
  };

  const generateQRCode = () => {
    // In a real app, you'd use a QR code library
    // For now, we'll just show a placeholder
    setShowQRCode(true);
  };

  const generateEmbedCode = () => {
    const embedCode = `<iframe src="${videoUrl}" width="560" height="315" frameborder="0" allowfullscreen></iframe>`;
    navigator.clipboard.writeText(embedCode);
    alert('Embed code copied to clipboard!');
  };

  const handleDownload = async () => {
    try {
      // In a real app, you'd have a proper download endpoint
      const link = document.createElement('a');
      link.href = video.url;
      link.download = `video_${video.id}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading video:', error);
      alert('Download failed. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-modals bg-black flex items-end" onClick={onClose}>
      <div className="bg-[#121212] w-full h-[40dvh] rounded-t-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-transparent">
          <div className="flex items-center gap-3">
            <Share2 className="w-4 h-4 text-[#00f2ea]" />
            <h3 className="text-white font-semibold">Share Video</h3>
          </div>
        </div>

        {/* Share Options */}
        <div className="flex-1 overflow-y-auto p-3 pb-safe">
          <div className="grid grid-cols-6 grid-rows-2 justify-items-center gap-3">
            {sharePlatforms.map((platform) => (
              <button
                key={platform.name}
                onClick={() => handleShare(platform.action)}
                  className="flex flex-col items-center gap-1.5"
              >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${platform.color} ${platform.hover}`}>
                    {platform.action === 'copy' && copiedLink ? (
                      <Check className="w-1/2 h-1/2 text-white" />
                    ) : (
                      <platform.icon className="w-1/2 h-1/2 text-white" />
                    )}
                  </div>
                  <span className="text-white text-[11px] text-center leading-tight">{platform.name}</span>
              </button>
            ))}
            <button
              onClick={handleDownload}
                className="flex flex-col items-center gap-1.5"
            >
                <div className="w-10 h-10 rounded-full flex items-center justify-center transition-colors bg-white/10 hover:bg-white/15">
                  <Download className="w-1/2 h-1/2 text-white" />
                </div>
                <span className="text-white text-[11px] text-center leading-tight">Download</span>
            </button>

            <button
              onClick={generateQRCode}
                className="flex flex-col items-center gap-1.5"
            >
                <div className="w-10 h-10 rounded-full flex items-center justify-center transition-colors bg-white/10 hover:bg-white/15">
                  <QrCode className="w-1/2 h-1/2 text-white" />
                </div>
                <span className="text-white text-[11px] text-center leading-tight">QR Code</span>
            </button>

            <button
              onClick={generateEmbedCode}
                className="flex flex-col items-center gap-1.5"
            >
                <div className="w-10 h-10 rounded-full flex items-center justify-center transition-colors bg-white/10 hover:bg-white/15">
                  <Code className="w-1/2 h-1/2 text-white" />
                </div>
                <span className="text-white text-[11px] text-center leading-tight">Embed</span>
            </button>
          </div>

        </div>

        {/* QR Code Modal */}
        {showQRCode && (
          <div
            className="fixed inset-0 z-modals bg-black flex items-center justify-center p-4"
            onClick={() => setShowQRCode(false)}
          >
            <div className="bg-[#121212] rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-white font-semibold">QR Code</h4>
              </div>
              <div className="bg-white p-4 rounded-lg flex items-center justify-center">
                <div className="w-48 h-48 bg-gray-300 rounded flex items-center justify-center">
                  <QrCode className="w-1/2 h-1/2 text-gray-600" />
                </div>
              </div>
              <p className="text-white/60 text-sm text-center mt-3">
                Scan this QR code to view the video
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
