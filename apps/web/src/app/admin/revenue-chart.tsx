'use client';

import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface RevenuePoint {
  month: string;
  revenue: number;
}

export default function RevenueChart({ data }: { data: RevenuePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 15, bottom: 5 }}>
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
  );
}
