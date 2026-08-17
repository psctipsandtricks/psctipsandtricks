'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge, Input, Pagination, Skeleton } from '@psc/ui';
import {
  Receipt,
  ChevronLeft,
  Search,
  ShoppingBag,
  BookOpen,
  HelpCircle,
  Radio,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { useAuth } from '@/app/auth-provider';
import type { OrderWithItems, OrderStatus } from '@psc/shared-types';

const STATUS_FILTERS: { label: string; value: OrderStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Paid', value: 'SUCCESS' },
  { label: 'Failed', value: 'FAILED' },
];

function statusBadge(status: OrderStatus) {
  switch (status) {
    case 'SUCCESS':
      return (
        <Badge variant="success" className="text-[10px] font-bold flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          <span>PAID</span>
        </Badge>
      );
    case 'REFUNDED':
      return (
        <Badge variant="outline" className="text-[10px] font-bold flex items-center gap-1">
          <RotateCcw className="w-3 h-3" />
          <span>REFUNDED</span>
        </Badge>
      );
    default:
      return (
        <Badge variant="danger" className="text-[10px] font-bold flex items-center gap-1">
          <XCircle className="w-3 h-3" />
          <span>FAILED</span>
        </Badge>
      );
  }
}

export default function MyOrdersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?redirect=/orders');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    async function loadOrders() {
      try {
        setLoading(true);
        const data = await ApiClient.getMyOrders();
        const validOrders = (data || []).filter((o) => o.status === 'SUCCESS');
        setOrders(validOrders);
      } catch (err) {
        console.error('Failed to load order history:', err);
      } finally {
        setLoading(false);
      }
    }
    loadOrders();
  }, [user]);

  const itemTitle = (order: OrderWithItems) => order.book?.title || order.quiz?.title || 'Purchase';
  const itemKind = (order: OrderWithItems): 'BOOK' | 'MOCK' | 'QUIZ' =>
    order.book ? 'BOOK' : order.quiz?.isLiveMock ? 'MOCK' : 'QUIZ';

  const filteredOrders = orders.filter((order) => {
    return itemTitle(order).toLowerCase().includes(searchTerm.toLowerCase());
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalItems = filteredOrders.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (loading || authLoading || !user) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 py-6 px-2">
        <div className="flex items-center space-x-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="w-48 h-6 rounded-md" />
            <Skeleton className="w-64 h-4 rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4 px-1 sm:px-0">
      {/* Top Navigation & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <Link href="/dashboard">
            <Button
              variant="outline"
              size="sm"
              className="p-2 rounded-xl border-cyan-500/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-400/70"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center space-x-2">
              <Receipt className="w-6 h-6 text-cyan-400" />
              <span>My Orders</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Your purchase history for premium quizzes, live mock tests, and e-books.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Summary Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Card className="p-3.5 sm:p-4 glass-card flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-semibold block">Completed Orders</span>
            <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono">{orders.length}</span>
          </div>
        </Card>

        <Card className="p-3.5 sm:p-4 glass-card flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-semibold block">Active Unlocked Items</span>
            <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{orders.length}</span>
          </div>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <Input
            placeholder="Search your purchased items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Order List */}
      {filteredOrders.length === 0 ? (
        <Card className="p-8 text-center space-y-3 glass-card border-dashed">
          <Receipt className="w-10 h-10 text-slate-400 dark:text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No Orders Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {orders.length === 0
              ? "You haven't purchased anything yet. Unlock a premium quiz, live mock test, or e-book to see it here."
              : 'No orders match this filter.'}
          </p>
          <Link href="/quizzes" className="inline-block pt-2">
            <Button variant="gold" size="sm" className="font-bold">
              Explore Quiz Hub
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {paginatedOrders.map((order) => {
            const kind = itemKind(order);
            const dateFormatted = new Date(order.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            const kindMeta =
              kind === 'BOOK'
                ? { label: 'E-Book', icon: BookOpen, color: 'text-indigo-500' }
                : kind === 'MOCK'
                ? { label: 'Live Mock Test', icon: Radio, color: 'text-cyan-400' }
                : { label: 'Quiz', icon: HelpCircle, color: 'text-amber-500' };
            const KindIcon = kindMeta.icon;

            return (
              <Card key={order.id} className="p-4 sm:p-5 glass-card space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 dark:border-[#1e2e56] pb-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <KindIcon className={`w-4 h-4 shrink-0 ${kindMeta.color}`} />
                      <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                        {itemTitle(order)}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-bold shrink-0">
                        {kindMeta.label}
                      </Badge>
                      {statusBadge(order.status)}
                    </div>
                    <div className="flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{dateFormatted}</span>
                      </span>
                      {order.razorpayPaymentId && (
                        <span className="font-mono text-[11px] text-slate-400 truncate">
                          {order.razorpayPaymentId}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Action / Amount */}
                  <div className="flex items-center space-x-3 self-end sm:self-center shrink-0">
                    <div className="text-right">
                      <span className="text-xs text-slate-500 dark:text-slate-400 block font-semibold">Amount</span>
                      <span className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">
                        ₹{order.amount}
                      </span>
                    </div>

                    {order.status === 'SUCCESS' && kind === 'BOOK' && order.book && (
                      <Link href={`/books/${order.book.id}`}>
                        <Button variant="gold" size="sm" className="font-bold">
                          View Book
                        </Button>
                      </Link>
                    )}
                    {order.status === 'SUCCESS' && kind === 'QUIZ' && order.quiz && (
                      <Link href={`/quizzes/${order.quiz.id}`}>
                        <Button variant="gold" size="sm" className="font-bold">
                          Start Quiz
                        </Button>
                      </Link>
                    )}
                    {order.status === 'SUCCESS' && kind === 'MOCK' && (
                      <Link href="/quizzes">
                        <Button variant="gold" size="sm" className="font-bold">
                          View Mock Test
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}

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
      )}
    </div>
  );
}
