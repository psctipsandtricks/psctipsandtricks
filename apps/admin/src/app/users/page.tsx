'use client';

import React from 'react';
import { Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge, Button } from '@psc/ui';

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">User Account Management</h1>
        <p className="text-slate-400 text-sm mt-1">View student registrations, role assignments, and subscription statuses.</p>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Subscription Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-semibold text-white">PSC Admin Master</TableCell>
              <TableCell>admin@psctips.com</TableCell>
              <TableCell><Badge variant="gold">ADMIN</Badge></TableCell>
              <TableCell><Badge variant="success">VIP Unlimited</Badge></TableCell>
              <TableCell><Button size="sm" variant="outline">Edit Role</Button></TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-semibold text-white">Kerala PSC Aspirant</TableCell>
              <TableCell>student@psctips.com</TableCell>
              <TableCell><Badge variant="default">STUDENT</Badge></TableCell>
              <TableCell><Badge variant="outline">Free Tier</Badge></TableCell>
              <TableCell><Button size="sm" variant="outline">Upgrade Plan</Button></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
