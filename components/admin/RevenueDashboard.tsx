import React, { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, Calendar, CreditCard } from 'lucide-react';

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
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get current date boundaries
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);
      
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Initialize revenue metrics
      let todayRevenue = 0;
      let weekRevenue = 0;
      let monthRevenue = 0;
      let totalRevenue = 0;
      
      // Try to fetch transactions data with proper error handling
      try {
        // Fetch today's revenue - simple query
        const { data: todayData, error: todayError } = await supabase
          .from('transactions')
          .select('*')
          .gte('created_at', todayStart.toISOString())
          .lt('created_at', todayEnd.toISOString())
          .eq('status', 'completed');
        
        if (!todayError && todayData) {
          todayRevenue = todayData.reduce((sum, t) => sum + (t.amount || 0), 0);
        }
        
        // Fetch this week's revenue - simple query
        const { data: weekData, error: weekError } = await supabase
          .from('transactions')
          .select('*')
          .gte('created_at', weekAgo.toISOString())
          .eq('status', 'completed');
        
        if (!weekError && weekData) {
          weekRevenue = weekData.reduce((sum, t) => sum + (t.amount || 0), 0);
        }
        
        // Fetch this month's revenue - simple query
        const { data: monthData, error: monthError } = await supabase
          .from('transactions')
          .select('*')
          .gte('created_at', monthStart.toISOString())
          .eq('status', 'completed');
        
        if (!monthError && monthData) {
          monthRevenue = monthData.reduce((sum, t) => sum + (t.amount || 0), 0);
        }
        
        // Fetch total revenue - simple query
        const { data: totalData, error: totalError } = await supabase
          .from('transactions')
          .select('*')
          .eq('status', 'completed');
        
        if (!totalError && totalData) {
          totalRevenue = totalData.reduce((sum, t) => sum + (t.amount || 0), 0);
        }
      } catch (err) {
        console.log('Transactions table not available:', err);
      }
      
      setMetrics({
        todayRevenue,
        weekRevenue,
        monthRevenue,
        totalRevenue
      });
      
      // Fetch funnel data with actual counts
      let businessCount = 0;
      let previewCount = 0;
      let emailsSentCount = 0;
      let emailsOpenedCount = 0;
      let linksClickedCount = 0;
      let customersCount = 0;
      
      // Count businesses - simple query
      try {
        const { count: bizCount, error: bizError } = await supabase
          .from('businesses')
          .select('*', { count: 'exact', head: true });
        
        if (!bizError && bizCount !== null) {
          businessCount = bizCount;
        }
      } catch (err) {
        console.log('Error counting businesses:', err);
      }
      
      // Count previews - simple query
      try {
        const { count: prevCount, error: prevError } = await supabase
          .from('website_previews')
          .select('*', { count: 'exact', head: true })
          .not('html_content', 'is', null);
        
        if (!prevError && prevCount !== null) {
          previewCount = prevCount;
        }
      } catch (err) {
        console.log('Error counting previews:', err);
      }
      
      // Count emails - simple queries
      try {
        const { count: emailCount, error: emailError } = await supabase
          .from('emails')
          .select('*', { count: 'exact', head: true });
        
        if (!emailError && emailCount !== null) {
          emailsSentCount = emailCount;
        }
        
        // Count emails opened
        const { count: openCount, error: openError } = await supabase
          .from('emails')
          .select('*', { count: 'exact', head: true })
          .not('opened_at', 'is', null);
        
        if (!openError && openCount !== null) {
          emailsOpenedCount = openCount;
        }
        
        // Count links clicked
        const { count: clickCount, error: clickError } = await supabase
          .from('emails')
          .select('*', { count: 'exact', head: true })
          .not('clicked_at', 'is', null);
        
        if (!clickError && clickCount !== null) {
          linksClickedCount = clickCount;
        }
      } catch (err) {
        console.log('Emails table not available:', err);
      }
      
      // Count customers - simple query
      try {
        const { count: claimedCount, error: claimedError } = await supabase
          .from('businesses')
          .select('*', { count: 'exact', head: true })
          .not('claimed_at', 'is', null);
        
        if (!claimedError && claimedCount !== null) {
          customersCount = claimedCount;
        }
      } catch (err) {
        console.log('Error counting claimed businesses:', err);
      }
      
      // Try customers table as fallback
      if (customersCount === 0) {
        try {
          const { count: custCount, error: custError } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true });
          
          if (!custError && custCount !== null) {
            customersCount = custCount;
          }
        } catch (err) {
          console.log('Customers table not available:', err);
        }
      }
      
      // Calculate percentages for funnel
      const funnelStages: FunnelData[] = [
        { 
          stage: 'Businesses Imported', 
          value: businessCount, 
          percentage: 100 
        },
        { 
          stage: 'Previews Created', 
          value: previewCount, 
          percentage: businessCount > 0 ? (previewCount / businessCount) * 100 : 0 
        },
        { 
          stage: 'Emails Sent', 
          value: emailsSentCount, 
          percentage: businessCount > 0 ? (emailsSentCount / businessCount) * 100 : 0 
        },
        { 
          stage: 'Emails Opened', 
          value: emailsOpenedCount, 
          percentage: emailsSentCount > 0 ? (emailsOpenedCount / emailsSentCount) * 100 : 0 
        },
        { 
          stage: 'Links Clicked', 
          value: linksClickedCount, 
          percentage: emailsOpenedCount > 0 ? (linksClickedCount / emailsOpenedCount) * 100 : 0 
        },
        { 
          stage: 'Customers', 
          value: customersCount, 
          percentage: linksClickedCount > 0 ? (customersCount / linksClickedCount) * 100 : 0 
        }
      ];
      
      setFunnelData(funnelStages);
      
      // Fetch revenue chart data for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const chartArray: RevenueData[] = [];
      
      try {
        const { data: chartData, error: chartError } = await supabase
          .from('transactions')
          .select('*')
          .gte('created_at', thirtyDaysAgo.toISOString())
          .eq('status', 'completed')
          .order('created_at', { ascending: true });
        
        if (!chartError && chartData && chartData.length > 0) {
          // Group by day
          const revenueByDay: { [key: string]: number } = {};
          
          chartData.forEach(transaction => {
            const date = new Date(transaction.created_at).toLocaleDateString();
            revenueByDay[date] = (revenueByDay[date] || 0) + (transaction.amount || 0);
          });
          
          // Fill in all days with actual data or 0
          for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toLocaleDateString();
            chartArray.push({
              date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              revenue: revenueByDay[dateStr] || 0
            });
          }
        } else {
          // If no data or error, show 30 days of zeros
          for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            chartArray.push({
              date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              revenue: 0
            });
          }
        }
      } catch (err) {
        console.log('Error fetching chart data:', err);
        // Fill with zeros on error
        for (let i = 29; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          chartArray.push({
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            revenue: 0
          });
        }
      }
      
      setRevenueChart(chartArray);
      
      // Fetch recent transactions - simple query
      const recentTransactionsList: Transaction[] = [];
      
      try {
        const { data: recentTransactions, error: transError } = await supabase
          .from('transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (!transError && recentTransactions && recentTransactions.length > 0) {
          // Process transactions without complex joins
          for (const trans of recentTransactions) {
            let customerName = trans.customer_name || 'Unknown';
            
            // If we have a business_id, try to get the business name separately
            if (trans.business_id) {
              try {
                const { data: business, error: bizError } = await supabase
                  .from('businesses')
                  .select('*')
                  .eq('id', trans.business_id)
                  .limit(1);
                
                if (!bizError && business && business.length > 0) {
                  customerName = business[0].business_name || business[0].name || customerName;
                }
              } catch (err) {
                console.log('Error fetching business name:', err);
              }
            }
            
            recentTransactionsList.push({
              id: trans.id,
              customer: customerName,
              amount: trans.amount || 0,
              date: new Date(trans.created_at).toLocaleDateString(),
              status: trans.status || 'pending'
            });
          }
        }
      } catch (err) {
        console.log('Transactions table not available:', err);
      }
      
      setTransactions(recentTransactionsList);
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Unable to load dashboard data. Some features may be unavailable.');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchDashboardData();
    // Only fetch once on mount, no auto-refresh to prevent loops
  }, []);

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
      icon: <DollarSign className="w-5 h-5" />
    },
    {
      title: 'This Week',
      value: formatCurrency(metrics.weekRevenue),
      icon: <Calendar className="w-5 h-5" />
    },
    {
      title: 'This Month (MRR)',
      value: formatCurrency(metrics.monthRevenue),
      icon: <TrendingUp className="w-5 h-5" />
    },
    {
      title: 'Total Revenue',
      value: formatCurrency(metrics.totalRevenue),
      icon: <CreditCard className="w-5 h-5" />
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
      
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
          <p className="text-sm">{error}</p>
        </div>
      )}
      
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
              <BarChart
                data={funnelData}
                layout="horizontal"
                margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="stage" type="category" />
                <Tooltip 
                  formatter={(value: number | string, name: string) => {
                    if (name === 'percentage') {
                      return `${Number(value).toFixed(1)}%`;
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
        {revenueChart.some(item => item.revenue > 0) ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueChart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
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
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p>No revenue data yet. Complete transactions will appear here.</p>
          </div>
        )}
      </div>

      {/* Recent Transactions Table */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Transactions</h2>
        {transactions.length > 0 ? (
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
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p>No transactions yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
