'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  Input,
  Pagination,
  Skeleton,
  Button,
  Dialog,
  DatePicker,
  Select,
} from '@psc/ui';
import {
  Search,
  ShoppingCart,
  Gift,
  Filter,
  Calendar,
  FileDown,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertCircle,
  CreditCard,
  Download,
  Eye,
  Pencil,
  X,
  User as UserIcon,
  Mail,
  Receipt,
  Check,
  RefreshCw,
  Info,
} from 'lucide-react';
import { AdminSkeletonHeader, AdminSkeletonTable } from '../admin-skeleton';
import { ApiClient } from '@/lib/api-client';
import { User, Book, Quiz } from '@psc/shared-types';
import { generateOrdersPDF, OrderPDFItem } from '@/lib/orders-pdf-exporter';

const MANUAL_ORDER_TAG = 'MANUAL_GRANT';

interface OrderRecord {
  id: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  item: string;
  amount: number;
  razorpayPaymentId: string;
  razorpayOrderId?: string;
  razorpaySignature?: string;
  status: 'SUCCESS' | 'PENDING' | 'REFUNDED' | 'FAILED' | 'CANCELLED' | string;
  date: string; // YYYY-MM-DD
  timeFormatted: string; // e.g. "04:30 PM"
  createdAtRaw: string;
  description?: string;
  isSimulated?: boolean;
  isManual?: boolean;
  bookId?: string;
  quizId?: string;
}

const manualOrderSchema = Yup.object({
  userId: Yup.string().required('Select a student'),
  itemType: Yup.string().oneOf(['book', 'quiz']).required(),
  itemId: Yup.string().required('Select an item'),
  amount: Yup.string(),
  note: Yup.string(),
});

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function StudentSearchCombobox({
  users,
  selectedUserId,
  onSelectUser,
  error,
}: {
  users: User[];
  selectedUserId: string;
  onSelectUser: (userId: string) => void;
  error?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId),
    [users, selectedUserId]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return users.slice(0, 40);
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        (u.phoneNumber && u.phoneNumber.includes(q))
    ).slice(0, 50);
  }, [users, search]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-1.5 relative" ref={containerRef}>
      <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
        <span>
          Select Student <span className="text-rose-500">*</span>
        </span>
        {selectedUser && (
          <button
            type="button"
            onClick={() => {
              onSelectUser('');
              setSearch('');
              setIsOpen(true);
            }}
            className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline font-bold cursor-pointer"
          >
            Change
          </button>
        )}
      </label>

      {selectedUser ? (
        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 animate-in fade-in duration-200 shadow-2xs">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-black text-sm flex items-center justify-center shrink-0 border border-emerald-500/30">
              {selectedUser.name ? selectedUser.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-xs text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                <span>{selectedUser.name}</span>
                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                  Selected
                </span>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                {selectedUser.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onSelectUser('');
              setSearch('');
              setIsOpen(true);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors shrink-0 cursor-pointer"
            title="Remove selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Type student name, email or phone to search…"
              value={search}
              onFocus={() => setIsOpen(true)}
              onChange={(e) => {
                setSearch(e.target.value);
                setIsOpen(true);
              }}
              className="pl-9"
            />
          </div>

          {isOpen && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-[#091124] border border-slate-200 dark:border-[#1e2e56] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="p-2.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50 flex justify-between items-center text-[11px] font-semibold text-slate-500">
                <span>
                  {search ? `Matching Students (${filtered.length})` : `All Students (${users.length})`}
                </span>
                <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold">Click student to pick</span>
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/40">
                {filtered.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No students found matching "{search}"
                  </div>
                ) : (
                  filtered.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        onSelectUser(u.id);
                        setIsOpen(false);
                      }}
                      className="w-full text-left p-2.5 hover:bg-cyan-500/10 dark:hover:bg-cyan-500/20 transition-colors flex items-center justify-between gap-2.5 cursor-pointer group"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-black text-xs flex items-center justify-center shrink-0 border border-cyan-500/20 group-hover:border-cyan-500/40">
                          {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
                            {u.name}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                            {u.email}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 flex items-center gap-1">
                        <span>Select</span>
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs font-semibold text-rose-500 mt-1">{error}</p>}
    </div>
  );
}

export default function AdminOrdersPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRecord[]>([]);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'PENDING' | 'REFUNDED' | 'CANCELLED' | 'FAILED'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'ONLINE' | 'MANUAL'>('ALL');
  const [datePreset, setDatePreset] = useState<'ALL' | 'TODAY' | '7DAYS' | '30DAYS' | 'THIS_MONTH' | 'CUSTOM'>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Manual Grant Modal State
  const [isGrantDialogOpen, setIsGrantDialogOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [userSearch, setUserSearch] = useState('');

  // PDF Export Modal State
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfPeriodPreset, setPdfPeriodPreset] = useState<'CURRENT_FILTER' | 'ALL' | 'TODAY' | '7DAYS' | '30DAYS' | 'THIS_MONTH' | 'CUSTOM'>('CURRENT_FILTER');
  const [pdfStartDate, setPdfStartDate] = useState('');
  const [pdfEndDate, setPdfEndDate] = useState('');
  const [pdfStatusFilter, setPdfStatusFilter] = useState<'ALL' | 'SUCCESS' | 'PENDING' | 'REFUNDED' | 'CANCELLED' | 'FAILED'>('ALL');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // View & Edit Order Modal States
  const [viewingOrder, setViewingOrder] = useState<OrderRecord | null>(null);
  const [editingOrder, setEditingOrder] = useState<OrderRecord | null>(null);
  const [editStatus, setEditStatus] = useState<string>('SUCCESS');
  const [editAmount, setEditAmount] = useState<string>('');
  const [editNote, setEditNote] = useState<string>('');
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false);

  // Toast State
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => setToastMsg(null), 4000);
    return () => clearTimeout(timer);
  }, [toastMsg]);

  // Active Date Range based on Preset
  const activeDateRange = useMemo(() => {
    const today = new Date();
    const todayStr = formatLocalDate(today);

    switch (datePreset) {
      case 'TODAY':
        return { start: todayStr, end: todayStr };
      case '7DAYS': {
        const d7 = new Date(today);
        d7.setDate(d7.getDate() - 7);
        return { start: formatLocalDate(d7), end: todayStr };
      }
      case '30DAYS': {
        const d30 = new Date(today);
        d30.setDate(d30.getDate() - 30);
        return { start: formatLocalDate(d30), end: todayStr };
      }
      case 'THIS_MONTH': {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        return { start: formatLocalDate(startOfMonth), end: todayStr };
      }
      case 'CUSTOM':
        return { start: customStartDate || undefined, end: customEndDate || undefined };
      case 'ALL':
      default:
        return { start: undefined, end: undefined };
    }
  }, [datePreset, customStartDate, customEndDate]);

  const [totalCount, setTotalCount] = useState(0);
  const [metrics, setMetrics] = useState<{
    total: number;
    successCount: number;
    pendingCount: number;
    refundedCount: number;
    cancelledCount: number;
    failedCount: number;
    revenue: number;
  }>({
    total: 0,
    successCount: 0,
    pendingCount: 0,
    refundedCount: 0,
    cancelledCount: 0,
    failedCount: 0,
    revenue: 0,
  });

  const fetchOrders = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await ApiClient.getAllOrders({
        page: currentPage,
        limit: pageSize,
        search: searchTerm.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        startDate: activeDateRange.start,
        endDate: activeDateRange.end,
      });

      const fetchedOrders = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      const total = typeof res?.total === 'number' ? res.total : fetchedOrders.length;
      setTotalCount(total);

      if (res?.metrics) {
        setMetrics(res.metrics);
      } else {
        const successOrders = fetchedOrders.filter((o: any) => o.status === 'SUCCESS');
        const pendingOrders = fetchedOrders.filter((o: any) => o.status === 'PENDING');
        const refundedOrders = fetchedOrders.filter((o: any) => o.status === 'REFUNDED');
        const cancelledOrders = fetchedOrders.filter((o: any) => o.status === 'CANCELLED');
        const failedOrders = fetchedOrders.filter((o: any) => o.status === 'FAILED');
        const revenue = successOrders.reduce((sum: number, o: any) => sum + (Number(o.amount) || 0), 0);
        setMetrics({
          total,
          successCount: successOrders.length,
          pendingCount: pendingOrders.length,
          refundedCount: refundedOrders.length,
          cancelledCount: cancelledOrders.length,
          failedCount: failedOrders.length,
          revenue,
        });
      }

      const formatted: OrderRecord[] = fetchedOrders.map((o: any) => {
        const createdDate = o.createdAt ? new Date(o.createdAt) : null;
        return {
          id: o.id,
          userName: o.user?.name || 'Anonymous User',
          userEmail: o.user?.email || 'N/A',
          userPhone: o.user?.phoneNumber || '',
          item: o.book?.title || o.quiz?.title || 'PSC Premium Access',
          amount: o.amount,
          razorpayPaymentId: o.razorpayPaymentId || o.razorpayOrderId || 'N/A',
          razorpayOrderId: o.razorpayOrderId || undefined,
          razorpaySignature: o.razorpaySignature || undefined,
          status: o.status,
          date: createdDate ? createdDate.toISOString().split('T')[0] : '',
          timeFormatted: createdDate
            ? createdDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
            : '',
          createdAtRaw: o.createdAt || '',
          description: o.description || '',
          isSimulated: o.razorpayOrderId?.startsWith('order_sim_'),
          isManual: o.razorpayOrderId === MANUAL_ORDER_TAG,
          bookId: o.bookId || undefined,
          quizId: o.quizId || undefined,
        };
      });
      setOrders(formatted);
    } catch (err) {
      setOrders([]);
      setTotalCount(0);
      setMetrics({
        total: 0,
        successCount: 0,
        pendingCount: 0,
        refundedCount: 0,
        cancelledCount: 0,
        failedCount: 0,
        revenue: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchTerm, statusFilter, activeDateRange]);

  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => {
      fetchOrders();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchOrders]);

  const formik = useFormik({
    initialValues: { userId: '', itemType: 'book' as 'book' | 'quiz', itemId: '', amount: '', note: '' },
    validationSchema: manualOrderSchema,
    onSubmit: async (values, { resetForm, setSubmitting, setFieldError }) => {
      try {
        await ApiClient.createManualOrder({
          userId: values.userId,
          bookId: values.itemType === 'book' ? values.itemId : undefined,
          quizId: values.itemType === 'quiz' ? values.itemId : undefined,
          amount: values.amount.trim() ? Number(values.amount) : undefined,
          note: values.note.trim() || undefined,
        });
        resetForm();
        setUserSearch('');
        setIsGrantDialogOpen(false);
        setToastMsg({ type: 'success', text: 'Manual order granted successfully.' });
        await fetchOrders();
      } catch (err: any) {
        setFieldError('itemId', err.message || 'Failed to grant this order.');
      } finally {
        setSubmitting(false);
      }
    },
  });

  const handleOpenGrantDialog = async () => {
    formik.resetForm();
    setUserSearch('');
    setIsGrantDialogOpen(true);
    if (users.length === 0) ApiClient.getUsers().then(setUsers).catch(() => {});
    if (books.length === 0) ApiClient.getBooks().then(setBooks).catch(() => {});
    if (quizzes.length === 0) ApiClient.getQuizzes().then(setQuizzes).catch(() => {});
  };

  const filteredUsers = users.filter(
    (u) =>
      !userSearch ||
      u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase()),
  );
  const itemOptions = formik.values.itemType === 'book' ? books : quizzes;

  // Main Filtered Orders List
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // 1. Text Search (ID, User Name, Email, Item, Payment ID)
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        o.id.toLowerCase().includes(q) ||
        o.userName.toLowerCase().includes(q) ||
        o.userEmail.toLowerCase().includes(q) ||
        o.item.toLowerCase().includes(q) ||
        o.razorpayPaymentId.toLowerCase().includes(q);

      // 2. Status Filter
      const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;

      // 3. Order Type Filter
      const matchesType =
        typeFilter === 'ALL' ||
        (typeFilter === 'MANUAL' && o.isManual) ||
        (typeFilter === 'ONLINE' && !o.isManual);

      // 4. Date Range Filter
      let matchesDate = true;
      if (activeDateRange.start && o.date < activeDateRange.start) matchesDate = false;
      if (activeDateRange.end && o.date > activeDateRange.end) matchesDate = false;

      return matchesSearch && matchesStatus && matchesType && matchesDate;
    });
  }, [orders, searchTerm, statusFilter, typeFilter, activeDateRange]);

  // Summary Metrics from Filtered View (Overall from server)

  const hasActiveFilters =
    Boolean(searchTerm) ||
    statusFilter !== 'ALL' ||
    typeFilter !== 'ALL' ||
    datePreset !== 'ALL' ||
    Boolean(customStartDate) ||
    Boolean(customEndDate);

  const resetAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setDatePreset('ALL');
    setCustomStartDate('');
    setCustomEndDate('');
    setCurrentPage(1);
  };

  const totalItems = totalCount;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const paginatedOrders = Array.isArray(orders) ? orders : [];

  // Edit Order Handlers
  const handleOpenEditModal = (order: OrderRecord) => {
    setEditingOrder(order);
    setEditStatus(order.status);
    setEditAmount(String(order.amount));
    setEditNote(order.description || '');
  };

  const handleSaveOrderEdit = async () => {
    if (!editingOrder) return;
    setIsUpdatingOrder(true);
    try {
      await ApiClient.updateOrder(editingOrder.id, {
        status: editStatus,
        amount: editAmount.trim() ? Number(editAmount) : undefined,
        description: editNote.trim() || undefined,
      });

      // Update local state
      setOrders((prev) =>
        prev.map((o) =>
          o.id === editingOrder.id
            ? {
                ...o,
                status: editStatus,
                amount: editAmount.trim() ? Number(editAmount) : o.amount,
                description: editNote.trim(),
              }
            : o
        )
      );

      setToastMsg({ type: 'success', text: `Order #${editingOrder.id.substring(0, 8)} updated successfully.` });
      setEditingOrder(null);
    } catch (err: any) {
      setToastMsg({ type: 'error', text: err.message || 'Failed to update order.' });
    } finally {
      setIsUpdatingOrder(false);
    }
  };

  // PDF Export Dialog Handlers
  const handleOpenPdfModal = () => {
    setPdfPeriodPreset(hasActiveFilters ? 'CURRENT_FILTER' : 'ALL');
    setPdfStartDate(activeDateRange.start || '');
    setPdfEndDate(activeDateRange.end || '');
    setPdfStatusFilter(statusFilter);
    setIsPdfModalOpen(true);
  };

  // Compute orders to be exported for the PDF modal
  const pdfOrdersToExport = useMemo(() => {
    if (pdfPeriodPreset === 'CURRENT_FILTER') {
      return filteredOrders;
    }

    const today = new Date();
    const todayStr = formatLocalDate(today);
    let start: string | undefined;
    let end: string | undefined;

    switch (pdfPeriodPreset) {
      case 'TODAY':
        start = todayStr;
        end = todayStr;
        break;
      case '7DAYS': {
        const d7 = new Date(today);
        d7.setDate(d7.getDate() - 7);
        start = formatLocalDate(d7);
        end = todayStr;
        break;
      }
      case '30DAYS': {
        const d30 = new Date(today);
        d30.setDate(d30.getDate() - 30);
        start = formatLocalDate(d30);
        end = todayStr;
        break;
      }
      case 'THIS_MONTH': {
        const som = new Date(today.getFullYear(), today.getMonth(), 1);
        start = formatLocalDate(som);
        end = todayStr;
        break;
      }
      case 'CUSTOM':
        start = pdfStartDate || undefined;
        end = pdfEndDate || undefined;
        break;
      case 'ALL':
      default:
        start = undefined;
        end = undefined;
    }

    return orders.filter((o) => {
      if (pdfStatusFilter !== 'ALL' && o.status !== pdfStatusFilter) return false;
      if (start && o.date < start) return false;
      if (end && o.date > end) return false;
      return true;
    });
  }, [orders, filteredOrders, pdfPeriodPreset, pdfStartDate, pdfEndDate, pdfStatusFilter]);

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      let periodLabel = 'All Time';
      if (pdfPeriodPreset === 'CURRENT_FILTER') {
        periodLabel = activeDateRange.start
          ? `${activeDateRange.start} to ${activeDateRange.end || 'Present'}`
          : 'Filtered View (All Dates)';
      } else if (pdfPeriodPreset === 'TODAY') {
        periodLabel = `Today (${formatLocalDate(new Date())})`;
      } else if (pdfPeriodPreset === '7DAYS') {
        periodLabel = 'Last 7 Days';
      } else if (pdfPeriodPreset === '30DAYS') {
        periodLabel = 'Last 30 Days';
      } else if (pdfPeriodPreset === 'THIS_MONTH') {
        periodLabel = 'This Month';
      } else if (pdfPeriodPreset === 'CUSTOM') {
        periodLabel = `${pdfStartDate || 'Start'} to ${pdfEndDate || 'Present'}`;
      }

      const pdfItems: OrderPDFItem[] = pdfOrdersToExport.map((o) => ({
        id: o.id,
        userName: o.userName,
        email: o.userEmail,
        item: o.item,
        amount: o.amount,
        razorpayPaymentId: o.razorpayPaymentId,
        status: o.status,
        date: o.date,
        timeFormatted: o.timeFormatted,
        isManual: o.isManual,
      }));

      await generateOrdersPDF({
        periodLabel,
        startDate: pdfStartDate,
        endDate: pdfEndDate,
        orders: pdfItems,
        statusFilter: pdfStatusFilter,
      });

      setIsPdfModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to generate PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <Badge variant="success" className="font-extrabold px-2.5 py-1">
            SUCCESS
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge variant="warning" className="font-extrabold px-2.5 py-1">
            PENDING
          </Badge>
        );
      case 'REFUNDED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-black bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
            REFUNDED
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-black bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30">
            CANCELLED
          </span>
        );
      case 'FAILED':
      default:
        return (
          <Badge variant="danger" className="font-extrabold px-2.5 py-1">
            {status || 'FAILED'}
          </Badge>
        );
    }
  };

  if (!mounted) {
    return (
      <div className="space-y-6">
        <AdminSkeletonHeader />
        <AdminSkeletonTable rowsCount={5} colsCount={8} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4">
      {/* Top Header & Actions */}
      <div className="shrink-0 space-y-3">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Transactions & Razorpay Orders
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
              Monitor real-time student purchase records, payment verification statuses, and manage transaction records.
            </p>
          </div>
          <div className="flex items-center space-x-2.5 shrink-0">
            <Button
              variant="outline"
              onClick={handleOpenPdfModal}
              className="font-bold border-slate-300 dark:border-[#1e2e56] text-slate-800 dark:text-slate-200 hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-500/10 cursor-pointer shadow-2xs flex items-center space-x-1.5"
            >
              <FileDown className="w-4 h-4 text-cyan-500 shrink-0" />
              <span>Download PDF Report</span>
            </Button>
            <Button
              variant="gold"
              className="font-bold shadow-md shadow-amber-500/20 cursor-pointer flex items-center space-x-1.5"
              onClick={handleOpenGrantDialog}
            >
              <Gift className="w-4 h-4 shrink-0" />
              <span>Grant Manual Order</span>
            </Button>
          </div>
        </div>

        {/* Filter Bar Card */}
        <Card className="p-4 glass-card space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
              <Input
                placeholder="Search order ID, name, email, item..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Status Filter */}
            <Select
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as any)}
              icon={<Filter className="w-4 h-4 text-cyan-500 shrink-0" />}
              options={[
                { value: 'ALL', label: 'All Statuses (Success, Pending, Refunded, Cancelled)' },
                { value: 'SUCCESS', label: '🟢 Success Only (Paid)' },
                { value: 'PENDING', label: '🟡 Pending Payment Only' },
                { value: 'REFUNDED', label: '🟣 Refunded Orders Only' },
                { value: 'CANCELLED', label: '⚪ Cancelled Orders Only' },
                { value: 'FAILED', label: '🔴 Failed Only' },
              ]}
            />

            {/* Order Type Filter */}
            <Select
              value={typeFilter}
              onChange={(val) => setTypeFilter(val as any)}
              icon={<CreditCard className="w-4 h-4 text-cyan-500 shrink-0" />}
              options={[
                { value: 'ALL', label: 'All Order Types' },
                { value: 'ONLINE', label: '💳 Razorpay / Online Orders' },
                { value: 'MANUAL', label: '🎁 Manual Admin Grants' },
              ]}
            />

            {/* Date Period Preset Filter */}
            <Select
              value={datePreset}
              onChange={(val) => setDatePreset(val as any)}
              icon={<Calendar className="w-4 h-4 text-amber-500 shrink-0" />}
              options={[
                { value: 'ALL', label: '📅 All Time' },
                { value: 'TODAY', label: 'Today' },
                { value: '7DAYS', label: 'Last 7 Days' },
                { value: '30DAYS', label: 'Last 30 Days' },
                { value: 'THIS_MONTH', label: 'This Month' },
                { value: 'CUSTOM', label: 'Custom Date Range…' },
              ]}
            />
          </div>

          {/* Custom Date Pickers Row (visible when CUSTOM preset is active) */}
          {datePreset === 'CUSTOM' && (
            <div className="pt-2 border-t border-slate-200/80 dark:border-[#1e2e56]/80 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-200">
              <DatePicker
                label="From Date"
                value={customStartDate}
                onChange={setCustomStartDate}
                placeholder="YYYY-MM-DD"
              />
              <DatePicker
                label="To Date"
                value={customEndDate}
                onChange={setCustomEndDate}
                placeholder="YYYY-MM-DD"
              />
            </div>
          )}

          {/* Metrics summary & Reset Button */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/60 dark:border-[#1e2e56]/60 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Showing:</span>
              <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-[#080e1e] font-bold text-slate-800 dark:text-slate-200 font-mono">
                {metrics.total} orders
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="font-semibold text-slate-500 dark:text-slate-400">Total Paid Revenue:</span>
              <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 font-black text-emerald-600 dark:text-emerald-400 font-mono">
                ₹{metrics.revenue.toLocaleString('en-IN')}
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold">
                {metrics.successCount} Success
              </span>
              {metrics.pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold">
                  {metrics.pendingCount} Pending
                </span>
              )}
              {metrics.refundedCount > 0 && (
                <span className="px-2 py-0.5 rounded-lg bg-purple-500/15 text-purple-700 dark:text-purple-300 font-bold">
                  {metrics.refundedCount} Refunded
                </span>
              )}
              {metrics.cancelledCount > 0 && (
                <span className="px-2 py-0.5 rounded-lg bg-slate-500/15 text-slate-700 dark:text-slate-300 font-bold">
                  {metrics.cancelledCount} Cancelled
                </span>
              )}
            </div>

            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetAllFilters}
                className="text-xs font-bold border-cyan-500/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10 cursor-pointer h-8 flex items-center space-x-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* Scrollable Table */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border border-slate-200/80 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] shadow-sm p-0">
        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 relative">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Order ID</TableHead>
                <TableHead className="whitespace-nowrap">Customer</TableHead>
                <TableHead className="whitespace-nowrap">Item Purchased</TableHead>
                <TableHead className="whitespace-nowrap">Date & Time</TableHead>
                <TableHead className="whitespace-nowrap">Amount</TableHead>
                <TableHead className="whitespace-nowrap">Razorpay Payment ID</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead className="whitespace-nowrap text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={`skeleton-${idx}`} className="border-b border-slate-200/80 dark:border-slate-800/60">
                    <TableCell className="py-4"><Skeleton className="h-5 w-24 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-36 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-44 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-28 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-16 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-32 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-20 rounded-lg" /></TableCell>
                    <TableCell className="py-4 text-center"><Skeleton className="h-5 w-16 mx-auto rounded-lg" /></TableCell>
                  </TableRow>
                ))
              ) : paginatedOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center space-y-3 max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
                        <ShoppingCart className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">No Orders Found</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          No transactions match your current search or selected filter criteria.
                        </p>
                      </div>
                      {hasActiveFilters && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs font-bold border-cyan-500/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10 mt-1 cursor-pointer"
                          onClick={resetAllFilters}
                        >
                          Clear All Filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedOrders.map((order) => (
                  <TableRow key={order.id}>
                    {/* 1. Order ID */}
                    <TableCell className="font-mono text-xs text-slate-900 dark:text-white font-bold whitespace-nowrap">
                      <span title={order.id}>
                        {order.id.length > 18 ? `${order.id.substring(0, 16)}..` : order.id}
                      </span>
                    </TableCell>

                    {/* 2. Customer: User Name & Email */}
                    <TableCell className="whitespace-nowrap py-3">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-xs leading-snug">
                          {order.userName}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          {order.userEmail}
                        </p>
                      </div>
                    </TableCell>

                    {/* 3. Item Purchased */}
                    <TableCell className="font-medium text-slate-900 dark:text-white">
                      <div className="flex items-center gap-1.5 min-w-[170px]">
                        <span className="truncate">{order.item}</span>
                        {order.isManual && (
                          <Badge variant="outline" className="flex items-center gap-1 text-[10px] shrink-0 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 border-cyan-500/30 font-bold">
                            <Gift className="w-3 h-3" />
                            <span>Manual</span>
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* 4. Date & Purchase Time */}
                    <TableCell className="whitespace-nowrap">
                      <div>
                        <p className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                          {order.date || '—'}
                        </p>
                        {order.timeFormatted && (
                          <p className="font-mono text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{order.timeFormatted}</span>
                          </p>
                        )}
                      </div>
                    </TableCell>

                    {/* 5. Amount */}
                    <TableCell className="font-mono font-bold text-cyan-600 dark:text-cyan-400 whitespace-nowrap">
                      ₹{order.amount}
                    </TableCell>

                    {/* 6. Razorpay Payment ID */}
                    <TableCell className="font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {order.razorpayPaymentId}
                    </TableCell>

                    {/* 7. Status */}
                    <TableCell className="whitespace-nowrap">
                      {renderStatusBadge(order.status)}
                    </TableCell>

                    {/* 8. Actions (View & Edit) */}
                    <TableCell className="whitespace-nowrap text-center py-2.5">
                      <div className="flex items-center justify-center space-x-1.5">
                        {/* View Order */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingOrder(order)}
                          title="View Complete Order Details"
                          className="h-8 w-8 p-0 text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-500/10 cursor-pointer rounded-lg"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>

                        {/* Edit Order */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditModal(order)}
                          title="Edit Order Status / Amount"
                          className="h-8 w-8 p-0 text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 cursor-pointer rounded-lg"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </div>
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

      {/* ── View Order Details Dialog ────────────────────────────────────── */}
      <Dialog
        isOpen={viewingOrder !== null}
        onClose={() => setViewingOrder(null)}
        title="Transaction & Order Details"
        className="max-w-lg w-full"
      >
        {viewingOrder && (
          <div className="space-y-4 pt-1">
            {/* Header info */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-[#080e1e] border border-slate-200 dark:border-[#1e2e56]">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Amount
                </span>
                <span className="text-2xl font-black text-cyan-600 dark:text-cyan-400 font-mono">
                  ₹{viewingOrder.amount}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                  Status
                </span>
                {renderStatusBadge(viewingOrder.status)}
              </div>
            </div>

            {/* Details Grid */}
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-start py-2 border-b border-slate-200/70 dark:border-slate-800/70">
                <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-slate-400" />
                  <span>Order ID:</span>
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-white max-w-[240px] truncate text-right">
                  {viewingOrder.id}
                </span>
              </div>

              <div className="flex justify-between items-start py-2 border-b border-slate-200/70 dark:border-slate-800/70">
                <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Customer Name:</span>
                </span>
                <span className="font-bold text-slate-900 dark:text-white text-right">
                  {viewingOrder.userName}
                </span>
              </div>

              <div className="flex justify-between items-start py-2 border-b border-slate-200/70 dark:border-slate-800/70">
                <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Customer Email:</span>
                </span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 text-right">
                  {viewingOrder.userEmail}
                </span>
              </div>

              {viewingOrder.userPhone && (
                <div className="flex justify-between items-start py-2 border-b border-slate-200/70 dark:border-slate-800/70">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold">
                    <span>Mobile / WhatsApp:</span>
                  </span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 text-right">
                    {viewingOrder.userPhone}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-start py-2 border-b border-slate-200/70 dark:border-slate-800/70">
                <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5 text-slate-400" />
                  <span>Item Purchased:</span>
                </span>
                <span className="font-bold text-slate-900 dark:text-white max-w-[240px] text-right">
                  {viewingOrder.item}
                </span>
              </div>

              <div className="flex justify-between items-start py-2 border-b border-slate-200/70 dark:border-slate-800/70">
                <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Date & Purchase Time:</span>
                </span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-right">
                  {viewingOrder.date} {viewingOrder.timeFormatted ? `· ${viewingOrder.timeFormatted}` : ''}
                </span>
              </div>

              <div className="flex justify-between items-start py-2 border-b border-slate-200/70 dark:border-slate-800/70">
                <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                  <span>Razorpay Payment ID:</span>
                </span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 text-right">
                  {viewingOrder.razorpayPaymentId}
                </span>
              </div>

              {viewingOrder.description && (
                <div className="py-2">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold block mb-1">
                    Notes / Description:
                  </span>
                  <p className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium">
                    {viewingOrder.description}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center space-x-2.5 pt-2">
              <Button
                variant="gold"
                onClick={() => {
                  const target = viewingOrder;
                  setViewingOrder(null);
                  handleOpenEditModal(target);
                }}
                className="flex-1 font-bold shadow-md shadow-amber-500/20 flex items-center justify-center space-x-1.5"
              >
                <Pencil className="w-4 h-4" />
                <span>Edit Order</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => setViewingOrder(null)}
                className="font-bold border-slate-300 dark:border-[#1e2e56]"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Edit Order Modal ────────────────────────────────────────────── */}
      <Dialog
        isOpen={editingOrder !== null}
        onClose={() => setEditingOrder(null)}
        title="Edit Order Record"
        className="max-w-md w-full"
      >
        {editingOrder && (
          <div className="space-y-4 pt-1">
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#080e1e] border border-slate-200 dark:border-[#1e2e56] text-xs">
              <p className="font-bold text-slate-900 dark:text-white truncate">
                {editingOrder.item}
              </p>
              <p className="text-slate-500 font-mono text-[11px] mt-0.5">
                {editingOrder.userName} ({editingOrder.userEmail})
              </p>
            </div>

            {/* Order Status Select */}
            <Select
              label="Payment Status"
              value={editStatus}
              onChange={(val) => setEditStatus(val)}
              options={[
                { value: 'SUCCESS', label: '🟢 SUCCESS (Paid & Active Access)' },
                { value: 'PENDING', label: '🟡 PENDING (Awaiting Payment)' },
                { value: 'REFUNDED', label: '🟣 REFUNDED (Payment Returned)' },
                { value: 'FAILED', label: '🔴 FAILED (Transaction Failed)' },
                { value: 'CANCELLED', label: '⚪ CANCELLED (Order Cancelled)' },
              ]}
            />

            {/* Amount Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Amount (₹)
              </label>
              <Input
                type="number"
                min={0}
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                placeholder="499"
              />
            </div>

            {/* Note / Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Admin Note / Audit Reason
              </label>
              <Input
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="e.g. Refund requested on Aug 16 / Support ticket #402"
              />
            </div>

            <div className="flex items-center space-x-2.5 pt-2">
              <Button
                variant="gold"
                onClick={handleSaveOrderEdit}
                isLoading={isUpdatingOrder}
                className="flex-1 font-bold shadow-md shadow-amber-500/20"
              >
                Save Changes
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditingOrder(null)}
                disabled={isUpdatingOrder}
                className="font-bold border-slate-300 dark:border-[#1e2e56]"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Grant Manual Order Dialog */}
      <Dialog
        isOpen={isGrantDialogOpen}
        onClose={() => setIsGrantDialogOpen(false)}
        title="Grant Manual Order"
        className="max-w-lg w-full"
      >
        <form className="space-y-4 pt-2" onSubmit={formik.handleSubmit} noValidate>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Instantly marks a book or quiz as purchased for a student — no payment involved. Use this for support requests or testing.
          </p>

          {/* Student Search Combobox */}
          <StudentSearchCombobox
            users={users}
            selectedUserId={formik.values.userId}
            onSelectUser={(userId) => formik.setFieldValue('userId', userId)}
            error={formik.touched.userId ? (formik.errors.userId as string) : undefined}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Item Type"
              value={formik.values.itemType}
              onChange={(val) => {
                formik.setFieldValue('itemType', val);
                formik.setFieldValue('itemId', '');
              }}
              options={[
                { value: 'book', label: 'Book' },
                { value: 'quiz', label: 'Quiz' },
              ]}
            />
            <Select
              label={formik.values.itemType === 'book' ? 'Book' : 'Quiz'}
              value={formik.values.itemId}
              onChange={(val) => formik.setFieldValue('itemId', val)}
              placeholder="Select item..."
              searchable
              options={itemOptions.map((item) => ({
                value: item.id,
                label: item.title,
              }))}
              error={formik.touched.itemId ? (formik.errors.itemId as string) : undefined}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Amount Override (Optional)"
              name="amount"
              type="number"
              min={0}
              placeholder="Defaults to item price"
              value={formik.values.amount}
              onChange={formik.handleChange}
            />
            <Input
              label="Note (Optional)"
              name="note"
              placeholder="e.g. Support ticket #123"
              value={formik.values.note}
              onChange={formik.handleChange}
            />
          </div>

          <Button type="submit" variant="gold" className="w-full font-bold shadow-md shadow-cyan-500/20" isLoading={formik.isSubmitting}>
            Grant Access
          </Button>
        </form>
      </Dialog>

      {/* Download PDF Report Modal */}
      <Dialog
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        title="Download Orders & Transactions Statement"
        className="max-w-lg w-full"
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Generate an official PDF statement for your selected date period and status.
          </p>

          {/* Date Period Preset */}
          <Select
            label="Select Date Period"
            value={pdfPeriodPreset}
            onChange={(val) => setPdfPeriodPreset(val as any)}
            options={[
              ...(hasActiveFilters ? [{ value: 'CURRENT_FILTER', label: `Current Filtered View (${filteredOrders.length} records)` }] : []),
              { value: 'ALL', label: 'All Time' },
              { value: 'TODAY', label: 'Today' },
              { value: '7DAYS', label: 'Last 7 Days' },
              { value: '30DAYS', label: 'Last 30 Days' },
              { value: 'THIS_MONTH', label: 'This Month' },
              { value: 'CUSTOM', label: 'Custom Date Range…' },
            ]}
          />

          {/* Custom Date Pickers */}
          {pdfPeriodPreset === 'CUSTOM' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <DatePicker
                label="Start Date"
                value={pdfStartDate}
                onChange={setPdfStartDate}
                placeholder="YYYY-MM-DD"
              />
              <DatePicker
                label="End Date"
                value={pdfEndDate}
                onChange={setPdfEndDate}
                placeholder="YYYY-MM-DD"
              />
            </div>
          )}

          {/* Status Filter for PDF */}
          {pdfPeriodPreset !== 'CURRENT_FILTER' && (
            <Select
              label="Include Status"
              value={pdfStatusFilter}
              onChange={(val) => setPdfStatusFilter(val as any)}
              options={[
                { value: 'ALL', label: 'All Statuses (Success, Pending, Refunded, Cancelled, Failed)' },
                { value: 'SUCCESS', label: 'Success Only (Paid Transactions)' },
                { value: 'PENDING', label: 'Pending Only' },
                { value: 'REFUNDED', label: 'Refunded Only' },
                { value: 'CANCELLED', label: 'Cancelled Only' },
                { value: 'FAILED', label: 'Failed Only' },
              ]}
            />
          )}

          {/* Live Preview Box */}
          <div className="p-3.5 rounded-2xl bg-slate-100/90 dark:bg-[#080e1e] border border-slate-200 dark:border-[#1e2e56] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Orders to export:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{pdfOrdersToExport.length} transactions</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Total Paid Revenue:</span>
              <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                ₹{pdfOrdersToExport.filter((o) => o.status === 'SUCCESS').reduce((sum, o) => sum + (Number(o.amount) || 0), 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="gold"
            onClick={handleDownloadPdf}
            isLoading={isGeneratingPdf}
            disabled={pdfOrdersToExport.length === 0}
            className="w-full font-bold shadow-md shadow-cyan-500/20 flex items-center justify-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF Statement ({pdfOrdersToExport.length})</span>
          </Button>
        </div>
      </Dialog>

      {/* Floating Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-[9999] flex flex-col space-y-2.5 pointer-events-none max-w-sm sm:max-w-md w-full px-4 sm:px-0">
          <div
            className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-950/95 dark:bg-[#080e1e]/95 border ${
              toastMsg.type === 'success'
                ? 'border-emerald-500/40 text-emerald-400'
                : toastMsg.type === 'warning'
                ? 'border-amber-500/40 text-amber-400'
                : 'border-rose-500/40 text-rose-400'
            } shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300`}
          >
            <div className="flex items-center space-x-3 min-w-0">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  toastMsg.type === 'success'
                    ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                    : toastMsg.type === 'warning'
                    ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
                    : 'bg-rose-500/20 border border-rose-500/30 text-rose-400'
                }`}
              >
                {toastMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
              </div>
              <span className="text-xs font-extrabold leading-relaxed text-slate-100">{toastMsg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMsg(null)}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800 shrink-0 cursor-pointer"
              title="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
