import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, Calendar, CreditCard, Users, Mail, MousePointer, Eye, Package } from 'lucide-react';

interface MetricCard {
  title: string;
  value: string;
  icon: React.ReactNode;
  change?: string;
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
  customer: string;
  amount: number;
  date: string;
  status: 'completed' | 'pending' | 'failed';
}

export default function RevenueDashboard() {
  const [metrics, setMetrics] = useState({
    todayRevenue: 0,
    weekRevenue: 0,
    monthRevenue: 0,
    totalRevenue: 0
  });
  
  const [funnelData, setFunnelData] = useState<FunnelData[]>([]);
  const [revenueChart, setRevenueChart] = useState<RevenueData[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch revenue metrics
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      // Fetch today's revenue
      const { data: todayData } = await supabase
        .from('transactions')
        .select('amount')
        .gte('created_at', startOfDay.toISOString())
        .eq('status', 'completed');
      
      // Fetch week's revenue
      const { data: weekData } = await supabase
        .from('transactions')
        .select('amount')
        .gte('created_at', startOfWeek.toISOString())
        .eq('status', 'completed');
      
      // Fetch month's revenue (MRR)
      const { data: monthData } = await supabase
        .from('transactions')
        .select('amount')
        .gte('created_at', startOfMonth.toISOString())
        .eq('status', 'completed');
      
      // Fetch total revenue
      const { data: totalData } = await supabase
        .from('transactions')
        .select('amount')
        .eq('status', 'completed');
      
      setMetrics({
        todayRevenue: todayData?.reduce((sum, t) => sum + t.amount, 0) || 0,
        weekRevenue: weekData?.reduce((sum, t) => sum + t.amount, 0) || 0,
        monthRevenue: monthData?.reduce((sum, t) => sum + t.amount, 0) || 0,
        totalRevenue: totalData?.reduce((sum, t) => sum + t.amount, 0) || 0
      });
      
      // Fetch funnel data
      const { data: businessesData } = await supabase
        .from('businesses')
        .select('id', { count: 'exact' });
      
      const { data: previewsData } = await supabase
        .from('previews')
        .select('id', { count: 'exact' });
      
      const { data: emailsSentData } = await supabase
        .from('emails')
        .select('id', { count: 'exact' });
      
      const { data: emailsOpenedData } = await supabase
        .from('emails')
        .select('id', { count: 'exact' })
        .not('opened_at', 'is', null);
      
      const { data: linksClickedData } = await supabase
        .from('emails')
        .select('id', { count: 'exact' })
        .not('clicked_at', 'is', null);
      
      const { data: customersData } = await supabase
        .from('customers')
        .select('id', { count: 'exact' });
      
      const businessCount = businessesData?.length || 0;
      const previewCount = previewsData?.length || 0;
      const emailsSentCount = emailsSentData?.length || 0;
      const emailsOpenedCount = emailsOpenedData?.length || 0;
      const linksClickedCount = linksClickedData?.length || 0;
      const customersCount = customersData?.length || 0;
      
      setFunnelData([
        { stage: 'Businesses Imported', value: businessCount, percentage: 100 },
        { stage: 'Previews Created', value: previewCount, percentage: businessCount > 0 ? (previewCount / businessCount) * 100 : 0 },
        { stage: 'Emails Sent', value: emailsSentCount, percentage: businessCount > 0 ? (emailsSentCount / businessCount) * 100 : 0 },
        { stage: 'Emails Opened', value: emailsOpenedCount, percentage: emailsSentCount > 0 ? (emailsOpenedCount / emailsSentCount) * 100 : 0 },
        { stage: 'Links Clicked', value: linksClickedCount, percentage: emailsOpenedCount > 0 ? (linksClickedCount / emailsOpenedCount) * 100 : 0 },
        { stage: 'Customers', value: customersCount, percentage: linksClickedCount > 0 ? (customersCount / linksClickedCount) * 100 : 0 }
      ]);
      
      // Fetch revenue chart data (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: chartData } = await supabase
        .from('transactions')
        .select('amount, created_at')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .eq('status', 'completed')
        .order('created_at', { ascending: true });
      
      // Group by day
      const revenueByDay: { [key: string]: number } = {};
      chartData?.forEach(transaction => {
        const date = new Date(transaction.created_at).toLocaleDateString();
        revenueByDay[date] = (revenueByDay[date] || 0) + transaction.amount;
      });
      
      // Fill in missing days with 0
      const chartArray: RevenueData[] = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toLocaleDateString();
        chartArray.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          revenue: revenueByDay[dateStr] || 0
        });
      }
      
      setRevenueChart(chartArray);
      
      // Fetch recent transactions
      const { data: recentTransactions } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      setTransactions(recentTransactions?.map(t => ({
        id: t.id,
        customer: t.customer_name || 'Unknown',
        amount: t.amount,
        date: new Date(t.created_at).toLocaleDateString(),
        status: t.status
      })) || []);
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const metricCards: MetricCard[] = [
    {
      title: "Today's Revenue",
      value: formatCurrency(metrics.todayRevenue),
      icon: <DollarSign className="w-5 h-5" />,
      change: '+12%'
    },
    {
      title: 'This Week',
      value: formatCurrency(metrics.weekRevenue),
      icon: <Calendar className="w-5 h-5" />,
      change: '+8%'
    },
    {
      title: 'This Month (MRR)',
      value: formatCurrency(metrics.monthRevenue),
      icon: <TrendingUp className="w-5 h-5" />,
      change: '+15%'
    },
    {
      title: 'Total Revenue',
      value: formatCurrency(metrics.totalRevenue),
      icon: <CreditCard className="w-5 h-5" />,
      change: '+23%'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-900">Revenue Dashboard</h1>
      
      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metricCards.map((metric, index) => (
          <div
            key={index}
            className="relative overflow-hidden rounded-xl bg-gradient-to-br from-white to-gray-50 p-6 shadow-lg hover:shadow-xl transition-shadow"
          >
            <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 opacity-10"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg text-white">
                  {metric.icon}
                </div>
                {metric.change && (
                  <span className="text-sm font-semibold text-green-600">{metric.change}</span>
                )}
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
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={funnelData}
            layout="horizontal"
            margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="stage" type="category" />
            <Tooltip 
              formatter={(value: any, name: string) => {
                if (name === 'percentage') {
                  return `${value.toFixed(1)}%`;
                }
                return value;
              }}
            />
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
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Revenue (Last 30 Days)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={revenueChart}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(value: any) => formatCurrency(value)} />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="revenue" 
              stroke="url(#lineGradient)" 
              strokeWidth={3}
              dot={{ fill: '#8B5CF6', r: 4 }}
              activeDot={{ r: 6 }}
            />
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
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Customer</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Amount</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900">{transaction.customer}</td>
                  <td className="py-3 px-4 font-semibold text-gray-900">
                    {formatCurrency(transaction.amount)}
                  </td>
                  <td className="py-3 px-4 text-gray-600">{transaction.date}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        transaction.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : transaction.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {transaction.status}
                    </span>
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
