import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Ban } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BlockedUser {
  id: string;
  blocked_id: string;
  blocked_user?: { username: string; avatar_url: string | null };
  created_at: string;
}

export default function BlockedAccounts() {
  const navigate = useNavigate();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadBlockedUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  const loadCurrentUser = async () => {
    const { data } = await supabase.auth.getUser();
    setCurrentUserId(data.user?.id || null);
  };

  const loadBlockedUsers = async () => {
    if (!currentUserId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('blocks')
        .select('*, blocked_user:profiles!blocked_id(username, avatar_url)')
        .eq('blocker_id', currentUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBlockedUsers(data || []);
    } catch (error) {
      console.error('Failed to load blocked users:', error);
    } finally {
      setLoading(false);
    }
  };

  const unblockUser = async (blockId: string) => {
    try {
      const { error } = await supabase.from('blocks').delete().eq('id', blockId);

      if (error) throw error;

      setBlockedUsers(prev => prev.filter(b => b.id !== blockId));
    } catch (error) {
      console.error('Failed to unblock user:', error);
      alert('Failed to unblock user');
    }
  };

  const filteredUsers = blockedUsers.filter(
    user =>
      user.blocked_user?.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 bg-black z-10 px-4 py-4 border-b border-transparent">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:brightness-125 rounded-full transition">
            <img src="/Icons/power-button.png" alt="Back" className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Blocked Accounts</h1>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 bg-black rounded-full px-4 py-3">
          <Search className="w-5 h-5 text-white/60" />
          <input
            type="text"
            placeholder="Search blocked users..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-white placeholder-white/40"
          />
        </div>
      </div>

      {/* Blocked Users List */}
      <div className="px-4 py-4">
        {loading ? (
          <div className="text-center py-12 text-white/40">Loading...</div>
        ) : (
          <div className="space-y-2">
            {filteredUsers.map(block => (
              <div
                key={block.id}
                className="flex items-center gap-3 p-4 bg-white rounded-xl"
              >
                <img
                  src={
                    block.blocked_user?.avatar_url ||
                    `https://ui-avatars.com/api/?name=${block.blocked_user?.username}`
                  }
                  alt={block.blocked_user?.username}
                  className="w-12 h-12 object-cover"
                />
                <div className="flex-1">
                  <p className="font-semibold">{block.blocked_user?.username}</p>
                  <p className="text-sm text-white/60">Blocked {formatDate(block.created_at)}</p>
                </div>
                <button
                  onClick={() => unblockUser(block.id)}
                  className="px-4 py-2 bg-black rounded-full text-sm font-semibold hover:brightness-125 transition"
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}

        {!loading && filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <Ban className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/40">
              {searchQuery ? 'No blocked users found' : 'You haven\'t blocked anyone'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
}
