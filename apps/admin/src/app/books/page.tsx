'use client';

import React, { useState } from 'react';
import { Card, CardTitle, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button, Dialog, Input, Badge } from '@psc/ui';

export default function AdminBooksPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">E-Book Content Management</h1>
          <p className="text-slate-400 text-sm mt-1">Upload and manage PSC PDF handbooks and question banks.</p>
        </div>
        <Button variant="gold" onClick={() => setIsDialogOpen(true)}>
          + Add New Book
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Book Title</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Downloads</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-semibold text-white">Kerala PSC Master Question Bank 2026</TableCell>
              <TableCell>PSC Tips Expert Team</TableCell>
              <TableCell><Badge variant="gold">Question Bank</Badge></TableCell>
              <TableCell className="font-mono text-amber-400 font-bold">₹299</TableCell>
              <TableCell>1,420</TableCell>
              <TableCell className="space-x-2">
                <Button size="sm" variant="outline">Edit</Button>
                <Button size="sm" variant="danger">Delete</Button>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-semibold text-white">Indian Constitution & Polity Guide</TableCell>
              <TableCell>Dr. K. R. Nambiar</TableCell>
              <TableCell><Badge variant="default">Polity</Badge></TableCell>
              <TableCell className="font-mono text-amber-400 font-bold">₹199</TableCell>
              <TableCell>850</TableCell>
              <TableCell className="space-x-2">
                <Button size="sm" variant="outline">Edit</Button>
                <Button size="sm" variant="danger">Delete</Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      <Dialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title="Upload New E-Book">
        <form className="space-y-4 pt-2" onSubmit={(e) => { e.preventDefault(); setIsDialogOpen(false); }}>
          <Input label="Book Title" placeholder="e.g. Kerala Geography Handbook 2026" required />
          <Input label="Author Name" placeholder="e.g. Dr. S. K. Nair" required />
          <Input label="Price (INR)" type="number" placeholder="299" required />
          <Input label="PDF Download URL" placeholder="https://..." required />
          <Button type="submit" variant="gold" className="w-full font-bold">
            Publish Book 📚
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
