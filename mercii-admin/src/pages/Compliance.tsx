import React, { useEffect, useState } from 'react';
import { complianceAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Search, ChevronLeft, ChevronRight, Loader2, CheckCircle2, XCircle,
  AlertTriangle, FileQuestion, Clock
} from 'lucide-react';

interface MLROFlag {
  id: string;
  customerId: string;
  customerName: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  status: string;
  notes: string | null;
  createdAt: string;
  slaDeadline: string;
  slaRemainingHours: number;
  slaBreached: boolean;
}

const Compliance: React.FC = () => {
  const { user } = useAuth();
  const [flags, setFlags] = useState<MLROFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notesModal, setNotesModal] = useState<{ id: string; action: string } | null>(null);
  const [notes, setNotes] = useState('');

  // Check if user has access to compliance
  const hasComplianceAccess = user?.role === 'admin' || user?.role === 'mlro';

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { 
    if (hasComplianceAccess) {
      fetchFlags(); 
    }
  }, [page, statusFilter, severityFilter, hasComplianceAccess]);

  // If Support role, show access denied message
  if (user?.role === 'support') {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertTriangle className="w-12 h-12 text-orange-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Access Denied</h3>
        <p className="text-gray-600 text-center max-w-md">
          You don't have access to Compliance & Investigations. This feature is available to Admin and MLRO roles only.
        </p>
      </div>
    );
  }

  const fetchFlags = async () => {
    setLoading(true);
    try {
      const res = await complianceAPI.getMLROFlags({ page, limit: 10, status: statusFilter, severity: severityFilter });
      setFlags(res.data.flags || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleAction = async () => {
    if (!notesModal) return;
    setActionLoading(notesModal.id);
    try {
      if (notesModal.action === 'approve') {
        await complianceAPI.approveFlag(notesModal.id, notes);
      } else if (notesModal.action === 'reject') {
        await complianceAPI.rejectFlag(notesModal.id, notes);
      } else if (notesModal.action === 'hold') {
        await complianceAPI.holdFlag(notesModal.id, notes);
      }
      fetchFlags();
    } catch (err) { console.error(err); }
    finally { setActionLoading(null); setNotesModal(null); setNotes(''); }
  };

  const severityBadge = (severity: string) => {
    const m: Record<string, string> = {
      high: 'bg-red-100 text-red-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-blue-100 text-blue-700',
      critical: 'bg-red-200 text-red-800',
    };
    return <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${m[severity] || 'bg-gray-100 text-gray-500'}`}>{severity}</span>;
  };

  const statusBadge = (status: string) => {
    const m: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      hold: 'bg-orange-100 text-orange-700',
    };
    return <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${m[status] || 'bg-gray-100 text-gray-500'}`}>{status}</span>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 cursor-pointer">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="hold">On Hold</option>
          </select>
          <select value={severityFilter} onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
            className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 cursor-pointer">
            <option value="">All Severity</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Flags Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">MLRO Flags</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-7 h-7 text-blue-500 animate-spin" /></div>
        ) : flags.length === 0 ? (
          <div className="text-center py-20 text-gray-400"><FileQuestion size={40} className="mx-auto mb-3 opacity-40" /><p>No MLRO flags found</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <th className="px-6 py-3 text-left font-medium">Flag</th>
                  <th className="px-4 py-3 text-left font-medium">Customer</th>
                  <th className="px-4 py-3 text-center font-medium">Severity</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-center font-medium">SLA</th>
                  <th className="px-4 py-3 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {flags.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-800">{f.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">{f.description}</p>
                    </td>
                    <td className="px-4 py-4 text-gray-600">{f.customerName}</td>
                    <td className="px-4 py-4 text-center">{severityBadge(f.severity)}</td>
                    <td className="px-4 py-4 text-center">{statusBadge(f.status)}</td>
                    <td className="px-4 py-4 text-gray-500 text-xs">{new Date(f.createdAt).toLocaleDateString('en-GB')}</td>
                    <td className="px-4 py-4 text-center">
                      {f.status === 'pending' || f.status === 'hold' ? (
                        f.slaBreached ? (
                          <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 font-medium">BREACHED</span>
                        ) : (
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            f.slaRemainingHours < 4 ? 'bg-red-50 text-red-600' :
                            f.slaRemainingHours < 12 ? 'bg-yellow-50 text-yellow-600' :
                            'bg-green-50 text-green-600'
                          }`}>{f.slaRemainingHours}h left</span>
                        )
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {(f.status === 'pending' || f.status === 'hold') ? (
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => setNotesModal({ id: f.id, action: 'approve' })}
                            className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors" title="Approve">
                            <CheckCircle2 size={16} />
                          </button>
                          <button onClick={() => setNotesModal({ id: f.id, action: 'hold' })}
                            className="p-1.5 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors" title="Hold">
                            <Clock size={16} />
                          </button>
                          <button onClick={() => setNotesModal({ id: f.id, action: 'reject' })}
                            className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors" title="Reject">
                            <XCircle size={16} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Resolved</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"><ChevronLeft size={16} /></button>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Notes Modal */}
      {notesModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {notesModal.action === 'approve' ? 'Approve' : notesModal.action === 'hold' ? 'Hold' : 'Reject'} MLRO Flag
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes..."
              rows={4}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none transition-all"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setNotesModal(null); setNotes(''); }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleAction} disabled={!!actionLoading}
                className={`px-5 py-2 text-sm font-medium text-white rounded-lg transition-all active:scale-95 ${
                  notesModal.action === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                  notesModal.action === 'hold' ? 'bg-orange-600 hover:bg-orange-700' :
                  'bg-red-600 hover:bg-red-700'
                }`}>
                {actionLoading ? <Loader2 size={16} className="animate-spin" /> :
                  notesModal.action === 'approve' ? 'Approve' :
                  notesModal.action === 'hold' ? 'Hold' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Compliance;
