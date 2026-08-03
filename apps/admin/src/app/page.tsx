'use client';

import React from 'react';
import { StatsCard, Card, CardTitle } from '@psc/ui';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const REVENUE_DATA = [
  { month: 'Jan', revenue: 45000, users: 1200 },
  { month: 'Feb', revenue: 52000, users: 1800 },
  { month: 'Mar', revenue: 68000, users: 2400 },
  { month: 'Apr', revenue: 84000, users: 3100 },
  { month: 'May', revenue: 95000, users: 4200 },
  { month: 'Jun', revenue: 112000, users: 5600 },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">System Analytics & Growth</h1>
        <p className="text-slate-400 text-sm mt-1">Real-time overview of platform users, revenue, and active test takers.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Registered Users" value="5,640" change="18.2%" isPositive />
        <StatsCard title="Active Live Mocks" value="8" change="2 new" isPositive />
        <StatsCard title="E-Book Downloads" value="2,890" change="12.5%" isPositive />
        <StatsCard title="Monthly Revenue" value="₹1,12,000" change="17.9%" isPositive />
      </div>

      <Card className="p-6 space-y-4">
        <CardTitle>Platform Growth & Revenue (2026)</CardTitle>
        <div className="h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={REVENUE_DATA}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
              <Area type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
