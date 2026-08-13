'use client';

import React, { useEffect, useState } from 'react';
import { Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge, Input, Pagination, Skeleton, Button } from '@psc/ui';
import { Search, Receipt, ShoppingCart, FlaskConical, CheckCircle2 } from 'lucide-react';
import { AdminSkeletonHeader, AdminSkeletonTable } from '../admin-skeleton';
import { ApiClient } from '@/lib/api-client';

interface OrderRecord {
  id: string;
  email: string;
  item: string;
  amount: number;
  razorpayPaymentId: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  date: string;
  isSimulated?: boolean;
}

export default function AdminOrdersPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [orders, setOrders] = useState<OrderRecord[]>([]);

  const isDemoMode =
    !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID.includes('sample_key') ||
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID.includes('your_key') ||
    process.env.NEXT_PUBLIC_RAZORPAY_MODE === 'test';

  useEffect(() => {
    setMounted(true);
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const fetchedOrders = await ApiClient.getAllOrders();
        if (Array.isArray(fetchedOrders)) {
          const formatted: OrderRecord[] = fetchedOrders.map((o: any) => ({
            id: o.id,
            email: o.user?.email || 'N/A',
            item: o.book?.title || o.quiz?.title || 'PSC Premium Access',
            amount: o.amount,
            razorpayPaymentId: o.razorpayPaymentId || o.razorpayOrderId || 'N/A',
            status: o.status,
            date: o.createdAt ? new Date(o.createdAt).toISOString().split('T')[0] : '',
            isSimulated: o.razorpayOrderId?.startsWith('order_sim_'),
          }));
          setOrders(formatted);
        } else {
          setOrders([]);
        }
      } catch (err) {
        if (!cancelled) {
          setOrders([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  if (!mounted) {
    return (
      <div className="space-y-6">
        <AdminSkeletonHeader />
        <AdminSkeletonTable rowsCount={5} colsCount={7} />
      </div>
    );
  }

  const filteredOrders = orders.filter(
    (o) =>
      o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.item.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalItems = filteredOrders.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4">
      {/* Fixed Header */}
      <div className="shrink-0 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Transactions & Razorpay Orders</h1>
            {isDemoMode ? (
              <Badge variant="gold" className="flex items-center gap-1 font-bold">
                <FlaskConical className="w-3.5 h-3.5" />
                <span>DEMO / TEST MODE</span>
              </Badge>
            ) : (
              <Badge variant="success" className="flex items-center gap-1 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>LIVE MODE</span>
              </Badge>
            )}
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Monitor real-time student purchase records, Razorpay payment verification statuses, and revenue details.</p>
        </div>
        <div className="w-full sm:w-64">
          <Input
            placeholder="Search order ID, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Scrollable Table */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border border-slate-200/80 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] shadow-sm p-0">
        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 relative">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>User Email</TableHead>
                <TableHead>Item Purchased</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Razorpay Payment ID</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={`skeleton-${idx}`} className="border-b border-slate-200/80 dark:border-slate-800/60">
                    <TableCell className="py-4"><Skeleton className="h-5 w-24 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-36 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-44 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-24 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-16 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-32 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-20 rounded-lg" /></TableCell>
                  </TableRow>
                ))
              ) : paginatedOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center space-y-3 max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
                        <ShoppingCart className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">No Orders Found</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          No transactions match your search query or selected filter criteria. Try adjusting your filter parameters.
                        </p>
                      </div>
                      {searchTerm && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs font-bold border-cyan-500/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10 mt-1 cursor-pointer"
                          onClick={() => setSearchTerm('')}
                        >
                          Reset Search
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs text-slate-900 dark:text-white font-bold">{order.id}</TableCell>
                    <TableCell className="text-slate-700 dark:text-slate-300 text-xs">{order.email}</TableCell>
                    <TableCell className="font-medium text-slate-900 dark:text-white">{order.item}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500 dark:text-slate-400">{order.date}</TableCell>
                    <TableCell className="font-mono font-bold text-cyan-600 dark:text-cyan-400">₹{order.amount}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      {order.razorpayPaymentId}
                    </TableCell>
                    <TableCell>
                      <Badge variant={order.status === 'SUCCESS' ? 'success' : order.status === 'PENDING' ? 'warning' : 'danger'}>
                        {order.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="shrink-0 px-4 py-3 border-t border-slate-200/80 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#091124]">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
        </div>
      </Card>
    </div>
  );
}
