import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Ban, Search } from 'lucide-react';

interface User {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
  coin_balance?: number;
  is_banned?: boolean;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, username, email, avatar_url, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const usersData = data?.map(u => ({
        id: u.user_id,
        username: u.username,
        email: u.email,
        avatar_url: u.avatar_url,
        created_at: u.created_at,
      })) || [];

      setUsers(usersData);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBanUser = async (userId: string) => {
    const confirmed = confirm('Ban this user?');
    if (!confirmed) return;

    try {
      await supabase.from('user_bans').insert({
        user_id: userId,
        banned_by: 'ADMIN_ID', // Replace with actual admin ID
        reason: 'Admin action',
        ban_type: 'permanent',
      });

      alert('User banned successfully');
      loadUsers();
    } catch (error) {
      console.error('Failed to ban user:', error);
      alert('Failed to ban user');
    }
  };

  const filteredUsers = users.filter(
    u =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">User Management</h1>

        {/* Search */}
        <div className="mb-6 flex items-center gap-4 bg-gray-800 rounded-lg px-4 py-3">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-white"
          />
        </div>

        {/* Users Table */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-gray-700/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}`}
                        alt={user.username}
                        className="w-10 h-10 object-cover"
                      />
                      <span className="font-semibold">{user.username}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{user.email}</td>
                  <td className="px-4 py-3 text-gray-400">{new Date(user.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => window.open(`/profile/${user.username}`, '_blank')}
                        className="px-3 py-1 bg-blue-600 rounded hover:bg-blue-700 text-sm"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleBanUser(user.id)}
                        className="px-3 py-1 bg-red-600 rounded hover:bg-red-700 text-sm flex items-center gap-1"
                      >
                        <Ban className="w-4 h-4" />
                        Ban
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
