'use client';

import React, { useState } from 'react';
import { Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button, Dialog, Input, Badge } from '@psc/ui';

export default function AdminQuizzesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Quiz & Mock Test Management</h1>
          <p className="text-slate-400 text-sm mt-1">Configure live mock tests, passing criteria, and question sets.</p>
        </div>
        <Button variant="gold" onClick={() => setIsDialogOpen(true)}>
          + Create Mock Test
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quiz Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Questions</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-semibold text-white">Kerala PSC LDC Mega Mock 2026</TableCell>
              <TableCell>LDC / Tenth Level</TableCell>
              <TableCell>100</TableCell>
              <TableCell>75 mins</TableCell>
              <TableCell><Badge variant="gold">🔥 Live Mock</Badge></TableCell>
              <TableCell className="space-x-2">
                <Button size="sm" variant="outline">Edit Questions</Button>
                <Button size="sm" variant="danger">Delete</Button>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-semibold text-white">Indian Constitution Special</TableCell>
              <TableCell>Polity</TableCell>
              <TableCell>25</TableCell>
              <TableCell>20 mins</TableCell>
              <TableCell><Badge variant="default">Practice</Badge></TableCell>
              <TableCell className="space-x-2">
                <Button size="sm" variant="outline">Edit Questions</Button>
                <Button size="sm" variant="danger">Delete</Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      <Dialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title="Create New Quiz / Mock Test">
        <form className="space-y-4 pt-2" onSubmit={(e) => { e.preventDefault(); setIsDialogOpen(false); }}>
          <Input label="Quiz Title" placeholder="e.g. CPO Special Mock 2026" required />
          <Input label="Category" placeholder="e.g. Uniformed Posts" required />
          <Input label="Duration (Minutes)" type="number" placeholder="45" required />
          <Input label="Passing Marks" type="number" placeholder="40" required />
          <Button type="submit" variant="gold" className="w-full font-bold">
            Save Quiz & Add Questions 📝
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
