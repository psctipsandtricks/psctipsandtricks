'use client';

import React from 'react';
import { StatsCard, Card, CardTitle, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge } from '@psc/ui';
import { Users, Zap, BookOpen, IndianRupee, ShoppingCart, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

import { AdminSkeletonHeader, AdminSkeletonKpiGrid, AdminSkeletonTable } from './admin-skeleton';

const REVENUE_DATA = [
  { month: 'Jan', revenue: 45000, users: 1200 },
  { month: 'Feb', revenue: 52000, users: 1800 },
  { month: 'Mar', revenue: 68000, users: 2400 },
  { month: 'Apr', revenue: 84000, users: 3100 },
  { month: 'May', revenue: 95000, users: 4200 },
  { month: 'Jun', revenue: 112000, users: 5600 },
];

const RECENT_ORDERS = [
  { id: 'ord_98127341', email: 'student@psctips.com', item: 'Kerala PSC Master Question Bank 2026', amount: '₹299', status: 'SUCCESS', date: 'Just now' },
  { id: 'ord_98127342', email: 'anandu.k@gmail.com', item: 'Indian Constitution & Polity Guide', amount: '₹199', status: 'SUCCESS', date: '10 mins ago' },
  { id: 'ord_98127343', email: 'sneha.nair@psctips.com', item: 'Kerala Geography Handbook 2026', amount: '₹149', status: 'SUCCESS', date: '45 mins ago' },
  { id: 'ord_98127344', email: 'rahul.varma@icloud.com', item: 'VIP Unlimited Subscription', amount: '₹499', status: 'SUCCESS', date: '2 hrs ago' },
];

export default function AdminDashboardPage() {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="space-y-8">
        <AdminSkeletonHeader />
        <AdminSkeletonKpiGrid cardsCount={4} />
        <AdminSkeletonTable rowsCount={4} colsCount={6} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center space-x-2">
            <span>Welcome back, Admin</span>
            <span>👋</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
            Real-time overview of PSC Education Platform
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold flex items-center space-x-1.5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span>Live • updating</span>
          </span>
        </div>
      </div>

      {/* SECTION 1 • LIVE ENVIRONMENT */}
      <div className="space-y-3">
        <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 block">
          SECTION 1 • LIVE ENVIRONMENT
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Revenue"
            value="₹4,56,000"
            change="+24.5%"
            isPositive
            icon={<TrendingUp className="w-5 h-5 text-cyan-400" />}
          />
          <StatsCard
            title="Total Orders"
            value="1,845"
            change="+15.2%"
            isPositive
            icon={<ShoppingCart className="w-5 h-5 text-cyan-400" />}
          />
          <StatsCard
            title="Monthly Revenue"
            value="₹1,12,000"
            change="+17.9%"
            isPositive
            icon={<IndianRupee className="w-5 h-5 text-cyan-400" />}
          />
          <StatsCard
            title="Registered Students"
            value="5,640"
            change="+18.2%"
            isPositive
            icon={<Users className="w-5 h-5 text-cyan-400" />}
          />
        </div>
      </div>

      {/* SECTION 2 • PLATFORM ANALYTICS */}
      <div className="space-y-3">
        <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 block">
          SECTION 2 • PLATFORM ANALYTICS
        </span>

        <Card className="p-6 space-y-4 bg-white dark:bg-[#0c152e] border border-slate-200/80 dark:border-[#1e2e56]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              <CardTitle className="text-slate-900 dark:text-white font-bold text-base">
                Platform Growth & Revenue Trends (2026)
              </CardTitle>
            </div>
            <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/30">
              ML Prediction Engine
            </span>
          </div>

          <div className="h-80 w-full pt-4 min-h-[320px]">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={REVENUE_DATA} margin={{ top: 10, right: 30, left: 15, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorRevTwin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2e56" opacity={0.5} />
                  <XAxis
                    dataKey="month"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }}
                    tickLine={false}
                    tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Monthly Revenue']}
                    labelFormatter={(label) => `Month: ${label}`}
                    contentStyle={{
                      backgroundColor: '#080f24',
                      borderColor: '#1e2e56',
                      borderRadius: '12px',
                      color: '#f8fafc',
                      fontWeight: 700,
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.7)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#38bdf8"
                    strokeWidth={3.5}
                    fillOpacity={1}
                    fill="url(#colorRevTwin)"
                    activeDot={{ r: 7, fill: '#38bdf8', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-slate-400">
                Loading analytics chart...
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* SECTION 3 • RECENT TRANSACTIONS */}
      <div className="space-y-3">
        <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 block">
          SECTION 3 • RECENT TRANSACTIONS & ORDERS
        </span>

        <Card className="p-6 space-y-4 bg-white dark:bg-[#0c152e] border border-slate-200/80 dark:border-[#1e2e56]">
          <div className="flex items-center justify-between">
            <CardTitle className="text-slate-900 dark:text-white font-bold text-base">Recent Orders & Transactions</CardTitle>
            <a href="/admin/orders" className="text-xs font-bold text-cyan-400 hover:underline">
              View All Orders →
            </a>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>User Email</TableHead>
                <TableHead>Item Purchased</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {RECENT_ORDERS.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-xs font-bold text-slate-900 dark:text-white">{order.id}</TableCell>
                  <TableCell className="text-xs text-slate-700 dark:text-slate-300">{order.email}</TableCell>
                  <TableCell className="font-medium text-slate-900 dark:text-white text-xs">{order.item}</TableCell>
                  <TableCell className="font-mono font-extrabold text-cyan-400">{order.amount}</TableCell>
                  <TableCell className="text-xs text-slate-400 font-mono">{order.date}</TableCell>
                  <TableCell>
                    <Badge variant="success">SUCCESS</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
