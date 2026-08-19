'use client';

import React from 'react';
import { BarChart3 } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  TooltipProps,
} from 'recharts';

interface TrendPoint {
  label: string;
  date: string;
  percentage: number;
  accuracy: number;
}

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-white/95 dark:bg-[#0c152e]/95 backdrop-blur-md px-3 py-2 shadow-lg">
      <p className="text-[11px] font-bold text-slate-900 dark:text-white max-w-[180px] truncate">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-[11px] font-mono font-bold" style={{ color: entry.color }}>
          {entry.name}: {entry.value}%
        </p>
      ))}
    </div>
  );
}

export default function PerformanceTrendChart({ trend }: { trend: TrendPoint[] }) {
  if (trend.length < 2) {
    return (
      <div className="h-56 flex flex-col items-center justify-center text-center gap-2">
        <BarChart3 className="w-8 h-8 text-slate-300 dark:text-slate-600" />
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
          One more attempt and your score trend will start plotting here.
        </p>
      </div>
    );
  }

  // A trend confined to one day would otherwise repeat the same date on every
  // tick, so it switches to clock time instead.
  const trendWithinOneDay =
    trend.length > 0 && new Set(trend.map((point) => new Date(point.date).toDateString())).size === 1;
  const formatTrendTick = (value: string) =>
    new Date(value).toLocaleString('en-IN', trendWithinOneDay ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' });

  return (
    <div className="h-56 -ml-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="accuracyFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke="currentColor" className="text-slate-200 dark:text-[#1e2e56]" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatTrendTick}
            tick={{ fontSize: 10 }}
            stroke="currentColor"
            className="text-slate-400 dark:text-slate-500"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10 }}
            stroke="currentColor"
            className="text-slate-400 dark:text-slate-500"
            tickLine={false}
            axisLine={false}
            width={34}
            tickFormatter={(value: number) => `${value}%`}
          />
          <Tooltip content={<ChartTooltip />} labelFormatter={(_, entries) => entries?.[0]?.payload?.label ?? ''} />
          <Area
            type="monotone"
            dataKey="percentage"
            name="Score"
            stroke="#06b6d4"
            strokeWidth={2.5}
            fill="url(#scoreFill)"
            dot={{ r: 3, fill: '#06b6d4', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
          <Area
            type="monotone"
            dataKey="accuracy"
            name="Accuracy"
            stroke="#8b5cf6"
            strokeWidth={2}
            strokeDasharray="5 4"
            fill="url(#accuracyFill)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
