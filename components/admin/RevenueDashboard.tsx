import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { getBrowserSupabase } from '@/lib/supabase';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, Calendar, CreditCard } from 'lucide-react';

interface MetricCardItem {
  title: string;
  value: string;
  icon: React.ReactNode;
}

interface FunnelData {
  stage: string;
  value: number;
  percentage: number;
}

interface RevenueData {
  date: string;
  revenue: number;
}

interface Transaction {
  id: string;
  email: string;
  amount: number; // dollars
  date: string;
  status: 'succeeded' | 'pending' | 'failed' | 'completed';
}

export default function RevenueDashboard() {
  const supabase = useMemo(() => getBrowserSupabase(), []);

  const [metrics, setMetrics] = useState({
    todayRevenue: 0,
    weekRevenue: 0,
    monthRevenue: 0,
    last30Revenue: 0,
  });
  
  const [funnelData, setFunnelData] = useState<FunnelData[]>([]);
  const [revenueChart, setRevenueChart] = useState<RevenueData[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRevenueMetrics = useCallback(async () => {
    // Single KPIs fetch (cards, recent tx, chart series)
    try {
      const res = await fetch('/api/admin/kpis', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load KPIs');
      const k = await res.json();
      setMetrics({
        todayRevenue: Number(k.revenue?.today || 0),
        weekRevenue: Number(k.revenue?.this_week || 0),
        monthRevenue: Number(k.revenue?.this_month || 0),
        last30Revenue: Number(k.revenue?.last_30_days_total || 0),
      });
      // Build chart from API series (oldest -> newest)
      const series: Array<{ date: string; amount: number }> = k.revenue?.series_30d || [];
      const chart: RevenueData[] = series.map((pt: { date: string; amount: number }) => {
        const d = new Date(pt.date + 'T00:00:00Z');
        return { date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), revenue: Number(pt.amount || 0) };
      });
      setRevenueChart(chart);
      // Map recent transactions (amount_cents -> dollars)
      const recent: Transaction[] = (k.recent_transactions || []).map((t: any) => ({
        id: String(t.id ?? ''),
        email: String(t.email ?? '—'),
        amount: Number((t.amount_cents ?? 0) / 100),
        date: new Date(String(t.created_at ?? '')).toLocaleDateString(),
        status: (String(t.status || 'succeeded') as Transaction['status']),
      }));
      setTransactions(recent);
    } catch (e: any) {
      setError(e.message || 'Failed loading KPIs');
    }
  }, []);

  const fetchFunnel = useCallback(async () => {
    // Funnel from DB counts; KPIs API does not currently return funnel stages
    try {
      let businessCount = 0;
      let previewCount = 0;
      let emailsSentCount = 0;
      let emailsOpenedCount = 0;
      let linksClickedCount = 0;
      let customersCount = 0;

      const [{ count: bizCount }, { count: prevCount }, emailsAll] = await Promise.all([
        supabase.from('businesses').select('id', { count: 'exact', head: true }),
        supabase.from('website_previews').select('id', { count: 'exact', head: true }).not('html_content', 'is', null),
        supabase.from('email_logs').select('sent_at,opened_at,clicked_at')
      ]);
      businessCount = bizCount || 0;
      previewCount = prevCount || 0;
      const emails = (emailsAll.data as Array<{ sent_at?: string|null; opened_at?: string|null; clicked_at?: string|null }> ) || [];
      emailsSentCount = emails.filter(e => !!e.sent_at).length;
      emailsOpenedCount = emails.filter(e => !!e.opened_at).length;
      linksClickedCount = emails.filter(e => !!e.clicked_at).length;

      const { count: claimedCount } = await supabase
        .from('businesses')
        .select('id', { count: 'exact', head: true })
        .not('claimed_at', 'is', null);
      customersCount = claimedCount || 0;

      setFunnelData([
        { stage: 'Businesses Imported', value: businessCount, percentage: 100 },
        { stage: 'Previews Created', value: previewCount, percentage: businessCount ? (previewCount / businessCount) * 100 : 0 },
        { stage: 'Emails Sent', value: emailsSentCount, percentage: businessCount ? (emailsSentCount / businessCount) * 100 : 0 },
        { stage: 'Emails Opened', value: emailsOpenedCount, percentage: emailsSentCount ? (emailsOpenedCount / emailsSentCount) * 100 : 0 },
        { stage: 'Links Clicked', value: linksClickedCount, percentage: emailsOpenedCount ? (linksClickedCount / emailsOpenedCount) * 100 : 0 },
        { stage: 'Customers', value: customersCount, percentage: linksClickedCount ? (customersCount / linksClickedCount) * 100 : 0 },
      ]);
    } catch (e: any) {
      setError(e.message || 'Failed to load funnel');
    }
  }, [supabase]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchRevenueMetrics(), fetchFunnel()]);
    } finally {
      setLoading(false);
    }
  }, [fetchRevenueMetrics, fetchFunnel]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const cards: MetricCardItem[] = [
    { title: "Today's Revenue", value: formatCurrency(metrics.todayRevenue), icon: <DollarSign className="w-5 h-5" /> },
    { title: 'This Week', value: formatCurrency(metrics.weekRevenue), icon: <Calendar className="w-5 h-5" /> },
    { title: 'This Month (MRR)', value: formatCurrency(metrics.monthRevenue), icon: <TrendingUp className="w-5 h-5" /> },
    { title: 'Last 30 Days', value: formatCurrency(metrics.last30Revenue), icon: <CreditCard className="w-5 h-5" /> },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-900">Revenue Dashboard</h1>

      {error && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((metric, index) => (
          <div key={index} className="relative overflow-hidden rounded-xl bg-gradient-to-br from-white to-gray-50 p-6 shadow-lg hover:shadow-xl transition-shadow">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 opacity-10"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg text-white">
                  {metric.icon}
                </div>
              </div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">{metric.title}</h3>
              <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Conversion Funnel Chart */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Conversion Funnel</h2>
        {funnelData.some(item => item.value > 0) ? (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={funnelData} layout="horizontal" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="stage" type="category" />
                <Tooltip formatter={(value: number | string, name: string) => (name === 'percentage' ? `${Number(value).toFixed(1)}%` : value)} />
                <Bar dataKey="value" fill="url(#colorGradient)" />
                <defs>
                  <linearGradient id="colorGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#8B5CF6" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {funnelData.map((item, index) => (
                <div key={index} className="text-center">
                  <p className="text-sm text-gray-600">{item.stage}</p>
                  <p className="text-lg font-bold text-gray-900">{item.value}</p>
                  <p className="text-sm text-blue-600">{item.percentage.toFixed(1)}%</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p>No data yet. Start importing businesses to see your funnel.</p>
          </div>
        )}
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Revenue (Last 30 Days)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={revenueChart}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Legend />
            <Line type="monotone" dataKey="revenue" stroke="url(#lineGradient)" strokeWidth={3} dot={{ fill: '#8B5CF6', r: 4 }} activeDot={{ r: 6 }} />
            <defs>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Transactions Table */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Transactions</h2>
        {transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Amount</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900">{transaction.email}</td>
                    <td className="py-3 px-4 font-semibold text-gray-900">{formatCurrency(transaction.amount)}</td>
                    <td className="py-3 px-4 text-gray-600">{transaction.date}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        transaction.status === 'succeeded' || transaction.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : transaction.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {transaction.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p>No transactions yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
