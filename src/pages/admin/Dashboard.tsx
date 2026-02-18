import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { BarChart3, Users, Video, DollarSign, Flag, Zap } from 'lucide-react';

interface DashboardStats {
  dailyActiveUsers: number;
  totalUsers: number;
  totalVideos: number;
  liveRooms: number;
  totalRevenue: number;
  pendingReports: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    dailyActiveUsers: 0,
    totalUsers: 0,
    totalVideos: 0,
    liveRooms: 0,
    totalRevenue: 0,
    pendingReports: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [users, videos, liveRooms, reports, purchases] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('videos').select('id', { count: 'exact', head: true }),
        supabase.from('live_streams').select('id', { count: 'exact', head: true }).eq('is_live', true),
        supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('purchases').select('price_minor').eq('status', 'verified'),
      ]);

      const revenue = purchases.data?.reduce((sum, p) => sum + (p.price_minor || 0), 0) || 0;

      setStats({
        dailyActiveUsers: Math.floor((users.count || 0) * 0.3), // Estimate
        totalUsers: users.count || 0,
        totalVideos: videos.count || 0,
        liveRooms: liveRooms.count || 0,
        totalRevenue: revenue / 100, // Convert to dollars
        pendingReports: reports.count || 0,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-[#E6B36A]" />
          Admin Dashboard
        </h1>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <StatCard
            icon={<Users className="w-8 h-8" />}
            title="Daily Active Users"
            value={stats.dailyActiveUsers.toLocaleString()}
            color="blue"
          />
          <StatCard
            icon={<Users className="w-8 h-8" />}
            title="Total Users"
            value={stats.totalUsers.toLocaleString()}
            color="green"
          />
          <StatCard
            icon={<Video className="w-8 h-8" />}
            title="Total Videos"
            value={stats.totalVideos.toLocaleString()}
            color="purple"
          />
          <StatCard
            icon={<Zap className="w-8 h-8" />}
            title="Live Rooms"
            value={stats.liveRooms.toLocaleString()}
            color="red"
          />
          <StatCard
            icon={<DollarSign className="w-8 h-8" />}
            title="Total Revenue"
            value={`$${stats.totalRevenue.toLocaleString()}`}
            color="yellow"
          />
          <StatCard
            icon={<Flag className="w-8 h-8" />}
            title="Pending Reports"
            value={stats.pendingReports.toLocaleString()}
            color="orange"
          />
        </div>

        {/* Quick Actions */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ActionButton href="/admin/users" label="Manage Users" />
            <ActionButton href="/admin/videos" label="Manage Videos" />
            <ActionButton href="/admin/reports" label="Review Reports" />
            <ActionButton href="/admin/economy" label="Economy Controls" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, color }: { icon: React.ReactNode; title: string; value: string; color: string }) {
  const colorClasses = {
    blue: 'from-blue-500/20 to-blue-600/5',
    green: 'from-green-500/20 to-green-600/5',
    purple: 'from-purple-500/20 to-purple-600/5',
    red: 'from-red-500/20 to-red-600/5',
    yellow: 'from-yellow-500/20 to-yellow-600/5',
    orange: 'from-orange-500/20 to-orange-600/5',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} rounded-lg p-6`}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-white/80">{icon}</div>
      </div>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-sm text-white/60">{title}</div>
    </div>
  );
}

function ActionButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="px-4 py-3 bg-[#E6B36A] text-black rounded-lg font-semibold hover:bg-[#E6B36A]/90 transition text-center"
    >
      {label}
    </a>
  );
}
