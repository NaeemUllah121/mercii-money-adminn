import React, { useEffect, useState } from 'react';
import { overviewAPI } from '../services/api';
import { Loader2 } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6'];

const Analytics: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [kpis, setKpis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('24h');

  useEffect(() => { fetchData(); }, [timeframe]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [mRes, kRes] = await Promise.allSettled([
        overviewAPI.getMetrics(timeframe),
        overviewAPI.getKPIs(),
      ]);
      if (mRes.status === 'fulfilled') setMetrics(mRes.value.data);
      if (kRes.status === 'fulfilled') setKpis(kRes.value.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>;
  }

  const pieData = kpis ? [
    { name: 'Completed', value: kpis.totalTransactions - kpis.failedTransactions },
    { name: 'Failed', value: kpis.failedTransactions },
    { name: 'Pending KYC', value: kpis.pendingKYC },
    { name: 'MLRO Flags', value: kpis.pendingMLRO },
  ].filter(d => d.value > 0) : [];

  const barData = metrics ? [
    { name: 'Transactions', value: metrics.metrics?.transactions || 0 },
    { name: 'Registrations', value: metrics.metrics?.userRegistrations || 0 },
    { name: 'KYC Submissions', value: metrics.metrics?.kycSubmissions || 0 },
    { name: 'MLRO Flags', value: metrics.metrics?.mlroFlags || 0 },
  ] : [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Timeframe selector */}
      <div className="flex items-center justify-end gap-2">
        {['1h', '24h', '7d'].map((tf) => (
          <button key={tf} onClick={() => setTimeframe(tf)}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${
              timeframe === tf ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>{tf === '1h' ? 'Last Hour' : tf === '24h' ? 'Last 24h' : 'Last 7 Days'}</button>
        ))}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {barData.map((item, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm card-animate">
            <p className="text-xs text-gray-500 mb-1">{item.name}</p>
            <p className="text-2xl font-bold text-gray-800">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm card-animate">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Activity Overview</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm card-animate">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Status Distribution</h3>
          <div className="h-64">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                  <Legend iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">No data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Volume Trend */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm card-animate">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-800">Volume Trend</h3>
          {kpis && (
            <div className={`text-sm font-medium flex items-center gap-1 ${kpis.volumeTrend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {kpis.volumeTrend >= 0 ? '+' : ''}{kpis.volumeTrend}% vs last month
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
            <p className="text-xs text-blue-600">Total Volume</p>
            <p className="text-xl font-bold text-blue-800">{'\u00A3'}{Number(kpis?.totalVolume || 0).toLocaleString()}</p>
          </div>
          <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100">
            <p className="text-xs text-indigo-600">Monthly Volume</p>
            <p className="text-xl font-bold text-indigo-800">{'\u00A3'}{Number(kpis?.monthlyVolume || 0).toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
