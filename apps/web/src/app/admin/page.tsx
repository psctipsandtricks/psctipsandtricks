'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { StatsCard, Card, CardTitle, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge } from '@psc/ui';
import { Users, Zap, IndianRupee, ShoppingCart, TrendingUp } from 'lucide-react';
import { ApiClient } from '@/lib/api-client';

import { AdminSkeletonHeader, AdminSkeletonKpiGrid, AdminSkeletonTable } from './admin-skeleton';

// recharts is a heavy dependency — load it on demand instead of shipping it
// in the initial JS of the first page every admin lands on.
const RevenueChart = dynamic(() => import('./revenue-chart'), {
  ssr: false,
  loading: () => <div className="h-80 w-full min-h-[320px] rounded-xl bg-slate-100 dark:bg-slate-900 animate-pulse" />,
});

interface OrderItem {
  id: string;
  user?: { email?: string; name?: string };
  book?: { title?: string };
  quiz?: { title?: string };
  amount: number;
  status: 'SUCCESS' | 'PENDING' | 'FAILED' | 'REFUNDED';
  createdAt: string;
}

export default function AdminDashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    totalRevenue: number;
    totalOrders: number;
    monthlyRevenue: number;
    registeredStudents: number;
    revenueChartData: { month: string; revenue: number }[];
    recentOrders: any[];
  } | null>(null);

  useEffect(() => {
    setMounted(true);
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        const res = await ApiClient.getAdminDashboard();
        if (cancelled) return;
        setData(res);
      } catch (err) {
        console.error('Failed to load admin dashboard data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!mounted || loading) {
    return (
      <div className="space-y-8">
        <AdminSkeletonHeader />
        <AdminSkeletonKpiGrid cardsCount={4} />
        <AdminSkeletonTable rowsCount={4} colsCount={6} />
      </div>
    );
  }

  const totalRevenue = data?.totalRevenue ?? 0;
  const totalOrders = data?.totalOrders ?? 0;
  const registeredStudents = data?.registeredStudents ?? 0;
  const monthlyRevenue = data?.monthlyRevenue ?? 0;
  const revenueChartData = data?.revenueChartData ?? [];
  const recentOrders = data?.recentOrders ?? [];

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
            value={`₹${totalRevenue.toLocaleString('en-IN')}`}
            change={totalRevenue > 0 ? '+100%' : '0%'}
            isPositive
            icon={<TrendingUp className="w-5 h-5 text-cyan-400" />}
          />
          <StatsCard
            title="Completed Orders"
            value={totalOrders.toLocaleString('en-IN')}
            change={totalOrders > 0 ? '+100%' : '0%'}
            isPositive
            icon={<ShoppingCart className="w-5 h-5 text-cyan-400" />}
          />
          <StatsCard
            title="Monthly Revenue"
            value={`₹${monthlyRevenue.toLocaleString('en-IN')}`}
            change={monthlyRevenue > 0 ? '+100%' : '0%'}
            isPositive
            icon={<IndianRupee className="w-5 h-5 text-cyan-400" />}
          />
          <StatsCard
            title="Registered Students"
            value={registeredStudents.toLocaleString('en-IN')}
            change={registeredStudents > 0 ? '+100%' : '0%'}
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
                Platform Growth & Revenue Trends ({new Date().getFullYear()})
              </CardTitle>
            </div>
            <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/30">
              Live Order Analytics
            </span>
          </div>

          <div className="h-80 w-full pt-4 min-h-[320px]">
            <RevenueChart data={revenueChartData} />
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
              {recentOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs font-semibold">
                    No recent transactions found.
                  </TableCell>
                </TableRow>
              ) : (
                recentOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs font-bold text-slate-900 dark:text-white">{order.id}</TableCell>
                    <TableCell className="text-xs text-slate-700 dark:text-slate-300">{order.user?.email || 'N/A'}</TableCell>
                    <TableCell className="font-medium text-slate-900 dark:text-white text-xs">
                      {order.book?.title || order.quiz?.title || 'PSC Premium Access'}
                    </TableCell>
                    <TableCell className="font-mono font-extrabold text-cyan-400">₹{order.amount}</TableCell>
                    <TableCell className="text-xs text-slate-400 font-mono">
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={order.status === 'SUCCESS' ? 'success' : order.status === 'PENDING' ? 'warning' : 'danger'}>
                        {order.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
