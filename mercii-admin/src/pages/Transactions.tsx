import React, { useEffect, useState } from 'react';
import { transactionAPI } from '../services/api';
import {
  Search, ChevronLeft, ChevronRight, Loader2, MoreVertical,
  RotateCcw, XCircle, FileQuestion
} from 'lucide-react';

interface Transaction {
  id: string;
  customerId: string;
  customerName: string;
  beneficiaryName: string;
  amount: number;
  amountInPKR: number;
  status: string;
  usiPaymentId: string;
  createdAt: string;
}

const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await transactionAPI.getTransactions({ page, limit: 10, search, status: statusFilter });
      setTransactions(res.data.customers || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchTransactions(); }, [page, statusFilter]);

  const handleRefund = async (id: string) => {
    setActionLoading(id);
    try {
      await transactionAPI.refund(id, 'Admin initiated refund');
      fetchTransactions();
    } catch (err) { console.error(err); }
    finally { setActionLoading(null); setOpenMenu(null); }
  };

  const handleCancel = async (id: string) => {
    setActionLoading(id);
    try {
      await transactionAPI.cancel(id, 'Admin initiated cancellation');
      fetchTransactions();
    } catch (err) { console.error(err); }
    finally { setActionLoading(null); setOpenMenu(null); }
  };

  const statusBadge = (status: string) => {
    const m: Record<string, string> = {
      completed: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700',
      failed: 'bg-red-100 text-red-700',
      cancelled: 'bg-gray-100 text-gray-600',
      refunded: 'bg-purple-100 text-purple-700',
    };
    return <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${m[status] || 'bg-gray-100 text-gray-500'}`}>{status}</span>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); fetchTransactions(); }} className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[250px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search transactions..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 cursor-pointer">
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </select>
          <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors active:scale-95">Search</button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">Transactions</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-7 h-7 text-blue-500 animate-spin" /></div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-20 text-gray-400"><FileQuestion size={40} className="mx-auto mb-3 opacity-40" /><p>No transactions found</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <th className="px-6 py-3 text-left font-medium">ID</th>
                  <th className="px-4 py-3 text-left font-medium">Customer</th>
                  <th className="px-4 py-3 text-left font-medium">Beneficiary</th>
                  <th className="px-4 py-3 text-right font-medium">Amount (GBP)</th>
                  <th className="px-4 py-3 text-right font-medium">Amount (PKR)</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-gray-500 font-mono text-xs">{t.id.slice(0, 8)}...</td>
                    <td className="px-4 py-4 text-gray-800 font-medium">{t.customerName}</td>
                    <td className="px-4 py-4 text-gray-600">{t.beneficiaryName}</td>
                    <td className="px-4 py-4 text-right font-semibold text-gray-800">{'\u00A3'}{Number(t.amount).toLocaleString()}</td>
                    <td className="px-4 py-4 text-right text-gray-600">PKR {Number(t.amountInPKR || 0).toLocaleString()}</td>
                    <td className="px-4 py-4 text-center">{statusBadge(t.status)}</td>
                    <td className="px-4 py-4 text-gray-500 text-xs">{new Date(t.createdAt).toLocaleDateString('en-GB')}</td>
                    <td className="px-4 py-4 text-center relative">
                      <button onClick={() => setOpenMenu(openMenu === t.id ? null : t.id)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                        {actionLoading === t.id ? <Loader2 size={16} className="animate-spin" /> : <MoreVertical size={16} />}
                      </button>
                      {openMenu === t.id && (
                        <div className="absolute right-4 top-12 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-20 min-w-[150px] animate-fade-in">
                          <button onClick={() => handleRefund(t.id)} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-orange-600">
                            <RotateCcw size={14} /> Refund
                          </button>
                          <button onClick={() => handleCancel(t.id)} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600">
                            <XCircle size={14} /> Cancel
                          </button>
                        </div>
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
    </div>
  );
};

export default Transactions;
