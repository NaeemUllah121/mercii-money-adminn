import React, { useEffect, useState } from 'react';
import { operationsAPI } from '../services/api';
import {
  Loader2, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  Clock, FileQuestion, Activity, Webhook, Cog, Download
} from 'lucide-react';

const Operations: React.FC = () => {
  const [reconciliation, setReconciliation] = useState<any>(null);
  const [webhooks, setWebhooks] = useState<any>(null);
  const [jobs, setJobs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'recon' | 'webhooks' | 'jobs'>('recon');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reconRes, whRes, jobsRes] = await Promise.allSettled([
        operationsAPI.getReconciliation(),
        operationsAPI.getWebhooks(),
        operationsAPI.getJobs(),
      ]);
      if (reconRes.status === 'fulfilled') setReconciliation(reconRes.value.data);
      if (whRes.status === 'fulfilled') setWebhooks(whRes.value.data);
      if (jobsRes.status === 'fulfilled') setJobs(jobsRes.value.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleRetryWebhook = async (id: string) => {
    try {
      await operationsAPI.retryWebhook(id);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleExportCSV = async () => {
    try {
      const res = await operationsAPI.exportReconciliationCSV(reconciliation?.date);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reconciliation_${reconciliation?.date || 'today'}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) { console.error(err); }
  };

  const tabs = [
    { key: 'recon', label: 'Reconciliation', icon: Activity },
    { key: 'webhooks', label: 'Webhooks & Jobs', icon: Webhook },
    { key: 'jobs', label: 'Background Jobs', icon: Cog },
  ] as const;

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex border-b border-gray-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-6 py-3.5 text-sm font-medium transition-all border-b-2 ${
                  activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                <Icon size={16} /> {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {/* Reconciliation Tab */}
          {activeTab === 'recon' && reconciliation && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-end">
                <button onClick={handleExportCSV}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all active:scale-95">
                  <Download size={16} /> Export CSV
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Transactions', value: reconciliation.summary?.totalTransactions || 0, color: 'blue' },
                  { label: 'Completed', value: reconciliation.summary?.completedTransactions || 0, color: 'green' },
                  { label: 'Failed', value: reconciliation.summary?.failedTransactions || 0, color: 'red' },
                  { label: 'Success Rate', value: `${reconciliation.summary?.successRate || 0}%`, color: 'indigo' },
                ].map((stat, i) => (
                  <div key={i} className={`p-4 rounded-xl border border-gray-200 card-animate`}>
                    <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
                    <p className={`text-2xl font-bold text-${stat.color}-600`}>{stat.value}</p>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-3">Volume Summary</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                    <p className="text-xs text-blue-600 mb-1">Total GBP</p>
                    <p className="text-xl font-bold text-blue-800">{'\u00A3'}{Number(reconciliation.summary?.totalAmount || 0).toLocaleString()}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-green-50 border border-green-100">
                    <p className="text-xs text-green-600 mb-1">Total PKR</p>
                    <p className="text-xl font-bold text-green-800">PKR {Number(reconciliation.summary?.totalAmountPKR || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
              {reconciliation.variances?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-yellow-500" /> Variances
                  </h4>
                  <div className="space-y-2">
                    {reconciliation.variances.map((v: any, i: number) => (
                      <div key={i} className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-yellow-800">{v.description}</p>
                          <p className="text-xs text-yellow-600">Amount: {'\u00A3'}{Number(v.amount || 0).toLocaleString()}</p>
                        </div>
                        <button className="px-3 py-1.5 text-xs font-medium bg-yellow-200 text-yellow-800 rounded-lg hover:bg-yellow-300 transition-colors">
                          Mark Resolved
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Webhooks Tab */}
          {activeTab === 'webhooks' && webhooks && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="p-3 rounded-lg bg-green-50 border border-green-100 text-center">
                  <p className="text-lg font-bold text-green-700">{webhooks.summary?.delivered || 0}</p>
                  <p className="text-xs text-green-600">Delivered</p>
                </div>
                <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-center">
                  <p className="text-lg font-bold text-red-700">{webhooks.summary?.failed || 0}</p>
                  <p className="text-xs text-red-600">Failed</p>
                </div>
                <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-100 text-center">
                  <p className="text-lg font-bold text-yellow-700">{webhooks.summary?.pending || 0}</p>
                  <p className="text-xs text-yellow-600">Pending</p>
                </div>
              </div>
              {webhooks.webhooks?.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <th className="px-4 py-3 text-left font-medium">Event</th>
                      <th className="px-4 py-3 text-center font-medium">Status</th>
                      <th className="px-4 py-3 text-center font-medium">Attempts</th>
                      <th className="px-4 py-3 text-center font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {webhooks.webhooks.map((w: any) => (
                      <tr key={w.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{w.event}</p>
                          <p className="text-xs text-gray-400 truncate max-w-xs">{w.endpoint}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            w.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>{w.status}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600">{w.attempts}</td>
                        <td className="px-4 py-3 text-center">
                          {w.status === 'failed' && (
                            <button onClick={() => handleRetryWebhook(w.id)}
                              className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Retry">
                              <RefreshCw size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12 text-gray-400"><FileQuestion size={32} className="mx-auto mb-2 opacity-50" />No webhooks to show</div>
              )}
            </div>
          )}

          {/* Background Jobs Tab */}
          {activeTab === 'jobs' && jobs && (
            <div className="space-y-3 animate-fade-in">
              {jobs.jobs?.length > 0 ? (
                jobs.jobs.map((job: any) => (
                  <div key={job.id} className="p-4 border border-gray-200 rounded-xl hover:shadow-sm transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          job.status === 'completed' ? 'bg-green-500' :
                          job.status === 'running' ? 'bg-blue-500 animate-pulse' :
                          job.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                        }`} />
                        <span className="text-sm font-medium text-gray-800">{job.type?.replace(/_/g, ' ')}</span>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        job.status === 'completed' ? 'bg-green-100 text-green-700' :
                        job.status === 'running' ? 'bg-blue-100 text-blue-700' :
                        job.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>{job.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{job.details}</p>
                    {job.status === 'running' && (
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-blue-500 animate-progress" style={{ width: `${job.progress}%` }} />
                      </div>
                    )}
                    {job.error && <p className="text-xs text-red-500 mt-1">Error: {job.error}</p>}
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-gray-400"><FileQuestion size={32} className="mx-auto mb-2 opacity-50" />No background jobs</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Operations;
