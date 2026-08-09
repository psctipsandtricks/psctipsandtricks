'use client';

import React from 'react';
import { StatsCard, Card, CardTitle, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge } from '@psc/ui';
import { Target, Award, Trophy, Clock } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="space-y-4 sm:space-y-8 py-2 sm:py-4 px-1 sm:px-0">
      <div>
        <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">Personal Study Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">
          Track your mock test accuracy, recent ranks, and study plan progress.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatsCard title="Total Mock Tests" value="14" change="2 this week" isPositive icon={<Target className="w-5 h-5" />} />
        <StatsCard title="Average Score" value="78.4%" change="4.2%" isPositive icon={<Award className="w-5 h-5" />} />
        <StatsCard title="State Rank" value="#42" change="12 ranks" isPositive icon={<Trophy className="w-5 h-5" />} />
        <StatsCard title="Study Hours" value="38.5 hrs" change="8 hrs" isPositive icon={<Clock className="w-5 h-5" />} />
      </div>

      <Card className="space-y-4">
        <CardTitle>Recent Mock Test Performances</CardTitle>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mock Test Title</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>State Rank</TableHead>
              <TableHead>Accuracy</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-bold text-slate-900 dark:text-white">Kerala PSC LDC Mega Mock 2026</TableCell>
              <TableCell className="font-mono text-amber-500 font-extrabold">82.5 / 100</TableCell>
              <TableCell className="font-mono text-emerald-500 dark:text-emerald-400 font-extrabold">#42</TableCell>
              <TableCell className="font-medium">89%</TableCell>
              <TableCell><Badge variant="success">Passed</Badge></TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-bold text-slate-900 dark:text-white">Indian Constitution Special</TableCell>
              <TableCell className="font-mono text-amber-500 font-extrabold">22.0 / 25</TableCell>
              <TableCell className="font-mono text-emerald-500 dark:text-emerald-400 font-extrabold">#18</TableCell>
              <TableCell className="font-medium">92%</TableCell>
              <TableCell><Badge variant="success">Passed</Badge></TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-bold text-slate-900 dark:text-white">Kerala Rivers & Geography</TableCell>
              <TableCell className="font-mono text-amber-500 font-extrabold">14.0 / 30</TableCell>
              <TableCell className="font-mono text-slate-400 font-extrabold">#140</TableCell>
              <TableCell className="font-medium">54%</TableCell>
              <TableCell><Badge variant="danger" className="font-medium">Needs Improvement</Badge></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
