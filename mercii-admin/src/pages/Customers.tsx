import React, { useEffect, useState } from 'react';
import { customerAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Search, ChevronLeft, ChevronRight, UserCheck, UserX,
  RefreshCw, Shield, MoreVertical, Loader2, Eye, AlertTriangle
} from 'lucide-react';

interface Customer {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  status: string;
  kycStatus: string;
  transferLimit: number;
  usedLimit: number;
  monthlyCap: number;
  createdAt: string;
  beneficiaryCount: number;
}

const Customers: React.FC = () => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [kycFilter, setKycFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // Check if user has access to customer management
  const hasCustomerAccess = user?.role === 'admin' || user?.role === 'support';

  useEffect(() => {
    if (hasCustomerAccess) {
      fetchCustomers();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, kycFilter, hasCustomerAccess]);

  // If MLRO role, show access denied message
  if (user?.role === 'mlro') {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertTriangle className="w-12 h-12 text-orange-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Access Denied</h3>
        <p className="text-gray-600 text-center max-w-md">
          You don't have access to Customer Management. This feature is available to Admin and Support roles only.
        </p>
      </div>
    );
  }

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await customerAPI.getCustomers({ page, limit: 10, search, status: statusFilter, kycStatus: kycFilter });
      setCustomers(res.data.customers || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
      setTotal(res.data.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to fetch customers', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCustomers();
  };

  const handleSuspend = async (id: string) => {
    setActionLoading(id);
    try {
      await customerAPI.suspendCustomer(id, 'Suspended by admin');
      fetchCustomers();
    } catch (err) { console.error(err); }
    finally { setActionLoading(null); setOpenMenu(null); }
  };

  const handleUnsuspend = async (id: string) => {
    setActionLoading(id);
    try {
      await customerAPI.unsuspendCustomer(id);
      fetchCustomers();
    } catch (err) { console.error(err); }
    finally { setActionLoading(null); setOpenMenu(null); }
  };

  const handleResendKYC = async (id: string) => {
    setActionLoading(id);
    try {
      await customerAPI.resendKYC(id);
      fetchCustomers();
    } catch (err) { console.error(err); }
    finally { setActionLoading(null); setOpenMenu(null); }
  };

  const kycBadge = (status: string) => {
    const styles: Record<string, string> = {
      verified: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700',
      rejected: 'bg-red-100 text-red-700',
      not_initiated: 'bg-gray-100 text-gray-500',
    };
    return (
      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${styles[status] || styles.not_initiated}`}>
        {status?.replace('_', ' ')}
      </span>
    );
  };

  const statusBadge = (status: string) => {
    return status === 'active'
      ? <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-green-100 text-green-700">Active</span>
      : <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-red-100 text-red-700">Suspended</span>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Search & Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <form onSubmit={handleSearch} className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[250px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 cursor-pointer"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
          <select
            value={kycFilter}
            onChange={(e) => { setKycFilter(e.target.value); setPage(1); }}
            className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 cursor-pointer"
          >
            <option value="">All KYC</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
            <option value="not_initiated">Not Initiated</option>
          </select>
          <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors active:scale-95">
            Search
          </button>
        </form>
      </div>

      {/* Customer Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">
            Customers <span className="text-gray-400 font-normal">({total})</span>
          </h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Search size={40} className="mx-auto mb-3 opacity-40" />
            <p>No customers found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <th className="px-6 py-3 text-left font-medium">Customer</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Phone</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-center font-medium">KYC</th>
                  <th className="px-4 py-3 text-right font-medium">Limit Used</th>
                  <th className="px-4 py-3 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-bold">
                            {c.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2) || '??'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{c.fullName || 'N/A'}</p>
                          <p className="text-xs text-gray-400">ID: {c.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-gray-600">{c.email || '---'}</td>
                    <td className="px-4 py-4 text-gray-600">{c.phoneNumber || '---'}</td>
                    <td className="px-4 py-4 text-center">{statusBadge(c.status)}</td>
                    <td className="px-4 py-4 text-center">{kycBadge(c.kycStatus)}</td>
                    <td className="px-4 py-4 text-right">
                      <div className="text-gray-700 font-medium">{'\u00A3'}{c.usedLimit?.toLocaleString()} / {'\u00A3'}{c.transferLimit?.toLocaleString()}</div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1.5">
                        <div
                          className="h-1.5 rounded-full bg-blue-500 animate-progress"
                          style={{ width: `${Math.min(100, (c.usedLimit / c.transferLimit) * 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center relative">
                      <button
                        onClick={() => setOpenMenu(openMenu === c.id ? null : c.id)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {actionLoading === c.id ? <Loader2 size={16} className="animate-spin" /> : <MoreVertical size={16} />}
                      </button>
                      {openMenu === c.id && (
                        <div className="absolute right-4 top-12 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-20 min-w-[160px] animate-fade-in">
                          <button onClick={() => {}} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                            <Eye size={14} /> View Profile
                          </button>
                          {c.status === 'active' ? (
                            <button onClick={() => handleSuspend(c.id)} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600">
                              <UserX size={14} /> Suspend
                            </button>
                          ) : (
                            <button onClick={() => handleUnsuspend(c.id)} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-green-600">
                              <UserCheck size={14} /> Unsuspend
                            </button>
                          )}
                          <button onClick={() => handleResendKYC(c.id)} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                            <RefreshCw size={14} /> Resend KYC
                          </button>
                          <button onClick={() => { setOpenMenu(null); }} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                            <Shield size={14} /> AML Rescreen
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Customers;
