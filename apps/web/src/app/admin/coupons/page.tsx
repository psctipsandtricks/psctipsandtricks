'use client';

import React, { useState } from 'react';
import { Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button, Dialog, Input, Badge } from '@psc/ui';

export default function AdminCouponsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Coupon Code Management</h1>
          <p className="text-slate-400 text-sm mt-1">Create and manage discount codes for courses and e-books.</p>
        </div>
        <Button variant="gold" onClick={() => setIsDialogOpen(true)}>
          + Create Coupon
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Discount %</TableHead>
              <TableHead>Max Discount</TableHead>
              <TableHead>Valid Till</TableHead>
              <TableHead>Usage Count</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-mono font-bold text-amber-400">PSC2026</TableCell>
              <TableCell>20%</TableCell>
              <TableCell>₹100</TableCell>
              <TableCell>2027-12-31</TableCell>
              <TableCell>142</TableCell>
              <TableCell><Badge variant="success">Active</Badge></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      <Dialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title="Create Discount Coupon">
        <form className="space-y-4 pt-2" onSubmit={(e) => { e.preventDefault(); setIsDialogOpen(false); }}>
          <Input label="Coupon Code" placeholder="e.g. KERALA50" required />
          <Input label="Discount Percentage (%)" type="number" placeholder="20" required />
          <Input label="Max Discount Amount (INR)" type="number" placeholder="100" required />
          <Input label="Valid Until" type="date" required />
          <Button type="submit" variant="gold" className="w-full font-bold">
            Create Coupon Code 🎟️
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
