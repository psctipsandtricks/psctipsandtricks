'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge, Input, Pagination, Skeleton, Dialog } from '@psc/ui';
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
  AlertCircle,
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
  const [unavailableOrder, setUnavailableOrder] = useState<OrderWithItems | null>(null);

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

  const itemTitle = (order: OrderWithItems) =>
    order.book?.title ||
    order.quiz?.title ||
    (order.bookId ? 'E-Book (Unavailable)' : order.quizId ? 'Quiz (Unavailable)' : 'Purchased Item (Unavailable)');
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

            const isSubscriptionOrder = Boolean(order.validTill);
            const isExpired = order.validTill ? new Date(order.validTill).getTime() <= Date.now() : false;
            const validTillFormatted = order.validTill
              ? new Date(order.validTill).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : null;

            const isDetached = !order.book && !order.quiz && !order.bookId && !order.quizId;
            const productUrl =
              kind === 'BOOK' && (order.book?.id || order.bookId)
                ? `/books/${order.book?.id || order.bookId}`
                : (kind === 'QUIZ' || kind === 'MOCK') && (order.quiz?.id || order.quizId)
                ? `/quizzes/${order.quiz?.id || order.quizId}`
                : null;

            const handleOpenOrder = (e?: React.MouseEvent) => {
              if (e) e.stopPropagation();
              if (isDetached || !productUrl) {
                setUnavailableOrder(order);
              } else {
                router.push(productUrl);
              }
            };

            return (
              <Card
                key={order.id}
                onClick={() => handleOpenOrder()}
                className="p-4 sm:p-5 glass-card space-y-3 cursor-pointer transition-all duration-200 hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/5 group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-[#1e2e56] pb-3">
                  <div className="flex items-start sm:items-center space-x-3 min-w-0 flex-1">
                    {kind === 'BOOK' && order.book?.coverUrl ? (
                      <img
                        src={order.book.coverUrl}
                        alt={order.book.title || 'Book cover'}
                        className="w-10 h-13 object-cover rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm shrink-0 group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shrink-0 group-hover:border-cyan-500/40 transition-colors">
                        <KindIcon className={`w-5 h-5 ${kindMeta.color}`} />
                      </div>
                    )}
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span
                          onClick={handleOpenOrder}
                          className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors"
                        >
                          {itemTitle(order)}
                        </span>
                        <Badge variant="outline" className="text-[10px] font-bold shrink-0">
                          {kindMeta.label}
                        </Badge>
                        {statusBadge(order.status)}
                        {order.status === 'SUCCESS' && kind === 'BOOK' && (
                          isSubscriptionOrder ? (
                            isExpired ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                                Expired on {validTillFormatted}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                Valid till {validTillFormatted}
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              Full-Time
                            </span>
                          )
                        )}
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
                  </div>

                  {/* Right Action / Amount */}
                  <div className="flex items-center space-x-3 self-end sm:self-center shrink-0">
                    <div className="text-right">
                      <span className="text-xs text-slate-500 dark:text-slate-400 block font-semibold">Amount</span>
                      <span className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">
                        ₹{order.amount}
                      </span>
                    </div>

                    <Button
                      variant={isExpired ? "danger" : "gold"}
                      size="sm"
                      className="font-bold"
                      onClick={handleOpenOrder}
                    >
                      {isDetached
                        ? 'Unavailable'
                        : kind === 'BOOK'
                        ? (isExpired ? 'Renew Book' : 'View Book')
                        : kind === 'MOCK'
                        ? 'View Mock Test'
                        : 'Start Quiz'}
                    </Button>
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

      {/* Unavailable Product Information Dialog */}
      <Dialog
        isOpen={Boolean(unavailableOrder)}
        onClose={() => setUnavailableOrder(null)}
        title="Product Notice"
      >
        <div className="space-y-4 text-center py-2">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              This product is no longer available.
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              This product was removed by the administrator and is no longer accessible. Your payment receipt and transaction ID remain safely recorded in your order history.
            </p>
          </div>

          {unavailableOrder && (
            <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-3.5 text-left border border-slate-200 dark:border-slate-700/60 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Item:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[200px]">{itemTitle(unavailableOrder)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Amount:</span>
                <span className="font-bold font-mono text-amber-600 dark:text-amber-400">₹{unavailableOrder.amount}</span>
              </div>
              {unavailableOrder.razorpayPaymentId && (
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Payment ID:</span>
                  <span className="font-mono text-slate-600 dark:text-slate-400 text-[11px]">{unavailableOrder.razorpayPaymentId}</span>
                </div>
              )}
            </div>
          )}

          <Button
            variant="gold"
            className="w-full font-bold mt-2"
            onClick={() => setUnavailableOrder(null)}
          >
            Back to Order History
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
