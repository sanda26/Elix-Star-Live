import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Eye, AlertTriangle, Ban, Flag, HelpCircle } from 'lucide-react';

export default function SafetyCenter() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 bg-black z-10 px-4 py-4 border-b border-transparent flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:brightness-125 rounded-full transition">
          <img src="/Icons/power-button.png" alt="Back" className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Safety Center</h1>
      </div>

      <div className="px-4 py-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full mx-auto mb-4 flex items-center justify-center">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Your Safety Matters</h2>
          <p className="text-sm text-white/60">
            Tools and resources to help you stay safe on Elix Star
          </p>
        </div>

        {/* Quick Actions */}
        <Section title="Quick Actions">
          <ActionCard
            icon={<Ban className="w-6 h-6" />}
            title="Blocked Accounts"
            description="Manage users you've blocked"
            onClick={() => navigate('/settings/blocked')}
          />
          <ActionCard
            icon={<Flag className="w-6 h-6" />}
            title="Report a Problem"
            description="Report content or users that violate our guidelines"
            onClick={() => navigate('/report')}
          />
        </Section>

        {/* Privacy Controls */}
        <Section title="Privacy Controls">
          <ActionCard
            icon={<Lock className="w-6 h-6" />}
            title="Account Privacy"
            description="Control who can see your content and interact with you"
            onClick={() => alert('Coming soon')}
          />
          <ActionCard
            icon={<Eye className="w-6 h-6" />}
            title="Data & Personalization"
            description="Manage how your data is used"
            onClick={() => alert('Coming soon')}
          />
        </Section>

        {/* Resources */}
        <Section title="Safety Resources">
          <InfoCard
            icon={<AlertTriangle className="w-6 h-6 text-yellow-500" />}
            title="Community Guidelines"
            description="Learn what's allowed on Elix Star"
            onClick={() => navigate('/guidelines')}
          />
          <InfoCard
            icon={<HelpCircle className="w-6 h-6 text-blue-500" />}
            title="Safety Tips"
            description="Best practices for staying safe online"
            onClick={() => window.open('https://help.elixstar.live/safety', '_blank')}
          />
        </Section>

        {/* Emergency */}
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 mt-6">
          <h3 className="text-lg font-bold text-red-500 mb-2">Need Immediate Help?</h3>
          <p className="text-sm text-white/80 mb-4">
            If you or someone you know is in immediate danger, please contact local emergency services.
          </p>
          <div className="space-y-2 text-sm">
            <p className="text-white/60">
              <strong>US:</strong> 911
            </p>
            <p className="text-white/60">
              <strong>UK:</strong> 999
            </p>
            <p className="text-white/60">
              <strong>EU:</strong> 112
            </p>
          </div>
        </div>

        {/* Contact Support */}
        <div className="text-center mt-8">
          <p className="text-sm text-white/60 mb-3">Need to talk to someone?</p>
          <button
            onClick={() => navigate('/support')}
            className="px-6 py-3 bg-[#E6B36A] text-black rounded-full font-bold hover:opacity-90 transition"
          >
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-white/60 mb-3 px-2">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-4 p-4 bg-white rounded-xl hover:brightness-125 transition text-left"
    >
      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <p className="font-semibold mb-1">{title}</p>
        <p className="text-sm text-white/60">{description}</p>
      </div>
    </button>
  );
}

function InfoCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 bg-white rounded-xl hover:brightness-125 transition text-left"
    >
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1">
        <p className="font-semibold mb-0.5">{title}</p>
        <p className="text-xs text-white/60">{description}</p>
      </div>
    </button>
  );
}
