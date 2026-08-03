'use client';

import React from 'react';
import { StatsCard, Card, CardTitle, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge } from '@psc/ui';

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Personal Study Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Track your mock test accuracy, recent ranks, and study plan progress.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Mock Tests" value="14" change="2 this week" isPositive />
        <StatsCard title="Average Score" value="78.4%" change="4.2%" isPositive />
        <StatsCard title="State Rank" value="#42" change="12 ranks" isPositive />
        <StatsCard title="Study Hours" value="38.5 hrs" change="8 hrs" isPositive />
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
              <TableCell className="font-semibold text-white">Kerala PSC LDC Mega Mock 2026</TableCell>
              <TableCell className="font-mono text-amber-400 font-bold">82.5 / 100</TableCell>
              <TableCell className="font-mono text-emerald-400 font-bold">#42</TableCell>
              <TableCell>89%</TableCell>
              <TableCell><Badge variant="success">Passed</Badge></TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-semibold text-white">Indian Constitution Special</TableCell>
              <TableCell className="font-mono text-amber-400 font-bold">22.0 / 25</TableCell>
              <TableCell className="font-mono text-emerald-400 font-bold">#18</TableCell>
              <TableCell>92%</TableCell>
              <TableCell><Badge variant="success">Passed</Badge></TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-semibold text-white">Kerala Rivers & Geography</TableCell>
              <TableCell className="font-mono text-amber-400 font-bold">14.0 / 30</TableCell>
              <TableCell className="font-mono text-slate-400 font-bold">#140</TableCell>
              <TableCell>54%</TableCell>
              <TableCell><Badge variant="danger">Needs Improvement</Badge></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
