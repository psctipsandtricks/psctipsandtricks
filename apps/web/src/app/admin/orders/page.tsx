'use client';

import React from 'react';
import { Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge } from '@psc/ui';

export default function AdminOrdersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Orders & Razorpay Transactions</h1>
        <p className="text-slate-400 text-sm mt-1">Audit transactions, payment verifications, and user book purchases.</p>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>User Email</TableHead>
              <TableHead>Item Purchased</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Payment Gateway ID</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-mono text-xs">ord_98127341</TableCell>
              <TableCell>student@psctips.com</TableCell>
              <TableCell>Kerala PSC Master Question Bank 2026</TableCell>
              <TableCell className="font-mono font-bold text-amber-400">₹299</TableCell>
              <TableCell className="font-mono text-xs text-slate-400">pay_rzp_mock_881</TableCell>
              <TableCell><Badge variant="success">SUCCESS</Badge></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
