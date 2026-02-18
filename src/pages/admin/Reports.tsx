import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Flag, CheckCircle, XCircle, Eye } from 'lucide-react';

interface Report {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  reporter?: { username: string };
}

export default function AdminReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const loadReports = async () => {
    try {
      let query = supabase
        .from('reports')
        .select('*, reporter:profiles!reporter_id(username)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (filter === 'pending') {
        query = query.eq('status', 'pending');
      }

      const { data, error } = await query;

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (reportId: string, outcome: 'removed' | 'warned' | 'no_action') => {
    try {
      const { error } = await supabase
        .from('reports')
        .update({
          status: 'resolved',
          outcome,
          resolved_at: new Date().toISOString(),
          moderator_id: 'ADMIN_ID', // Replace with actual admin ID
        })
        .eq('id', reportId);

      if (error) throw error;

      alert('Report resolved');
      loadReports();
    } catch (error) {
      console.error('Failed to resolve report:', error);
      alert('Failed to resolve report');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 flex items-center gap-3">
          <Flag className="w-8 h-8 text-red-500" />
          Reports Queue
        </h1>

        {/* Filter */}
        <div className="mb-6 flex gap-4">
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg font-semibold ${
              filter === 'pending' ? 'bg-[#E6B36A] text-black' : 'bg-gray-700 text-white'
            }`}
          >
            Pending ({reports.filter(r => r.status === 'pending').length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-semibold ${
              filter === 'all' ? 'bg-[#E6B36A] text-black' : 'bg-gray-700 text-white'
            }`}
          >
            All
          </button>
        </div>

        {/* Reports List */}
        <div className="space-y-4">
          {reports.map(report => (
            <div key={report.id} className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-3 py-1 bg-red-600 rounded-full text-xs font-bold">
                      {report.reason.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="text-gray-400 text-sm">{report.target_type}</span>
                  </div>
                  <p className="text-gray-300 mb-2">{report.details || 'No details provided'}</p>
                  <p className="text-gray-500 text-sm">
                    Reported by: {report.reporter?.username || 'Unknown'} •{' '}
                    {new Date(report.created_at).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    report.status === 'pending'
                      ? 'bg-yellow-600'
                      : report.status === 'resolved'
                      ? 'bg-green-600'
                      : 'bg-gray-600'
                  }`}
                >
                  {report.status}
                </span>
              </div>

              {report.status === 'pending' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleResolve(report.id, 'removed')}
                    className="px-4 py-2 bg-red-600 rounded hover:bg-red-700 flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Remove Content
                  </button>
                  <button
                    onClick={() => handleResolve(report.id, 'warned')}
                    className="px-4 py-2 bg-yellow-600 rounded hover:bg-yellow-700 flex items-center gap-2"
                  >
                    <Flag className="w-4 h-4" />
                    Warn User
                  </button>
                  <button
                    onClick={() => handleResolve(report.id, 'no_action')}
                    className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-700 flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    No Action
                  </button>
                  <button
                    onClick={() => window.open(`/${report.target_type}/${report.target_id}`, '_blank')}
                    className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </button>
                </div>
              )}
            </div>
          ))}

          {reports.length === 0 && (
            <div className="text-center py-12 text-gray-400">No reports found</div>
          )}
        </div>
      </div>
    </div>
  );
}
