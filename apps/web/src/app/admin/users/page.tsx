'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge, Button, Input, Dialog, Pagination, Skeleton, ConfirmDialog, Select } from '@psc/ui';
import {
  Search,
  UserCheck,
  ShieldAlert,
  Zap,
  RefreshCw,
  Trash2,
  Edit3,
  Mail,
  Users,
  Apple,
  ShoppingBag,
  BookOpen,
  HelpCircle,
  CheckCircle2,
  Clock,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { AdminSkeletonHeader, AdminSkeletonTable } from '../admin-skeleton';

function formatOrderDateTime(isoString?: string) {
  if (!isoString) return { date: '-', time: '-' };
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return { date: '-', time: '-' };
  const date = d.toISOString().split('T')[0];
  const time = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return { date, time };
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

interface StudentUser {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  loginMethod: 'Email' | 'Google' | 'Apple';
  registeredAtDate: string;
  registeredAtTime: string;
  status: 'Active' | 'Suspended';
  subscription: 'Free Tier' | 'VIP Unlimited';
  ordersCount: number;
  quizAttemptsCount: number;
}

const createUserSchema = Yup.object({
  name: Yup.string().trim().required('Name is required'),
  email: Yup.string().email('Enter a valid email').required('Email is required'),
});

const editUserSchema = Yup.object({
  name: Yup.string().trim().required('Name is required'),
});

export default function AdminUsersPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentUser[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMethod, setFilterMethod] = useState<string>('ALL');
  const [confirmTarget, setConfirmTarget] = useState<{ type: 'suspend' | 'delete'; student: StudentUser } | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentUser | null>(null);

  // Student Completed Orders modal state
  const [selectedStudentForOrders, setSelectedStudentForOrders] = useState<StudentUser | null>(null);
  const [studentOrders, setStudentOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);

  const determineLoginMethod = (email: string, oauthIdentities?: Array<{ provider: string }>): 'Email' | 'Google' | 'Apple' => {
    if (Array.isArray(oauthIdentities) && oauthIdentities.length > 0) {
      const prov = oauthIdentities[0].provider?.toUpperCase();
      if (prov === 'GOOGLE') return 'Google';
      if (prov === 'APPLE') return 'Apple';
    }
    if (email) {
      const lower = email.toLowerCase();
      if (lower.endsWith('@gmail.com') || lower.endsWith('@googlemail.com')) {
        return 'Google';
      }
      if (lower.endsWith('@icloud.com') || lower.endsWith('@apple.com')) {
        return 'Apple';
      }
    }
    return 'Email';
  };

  const loadStudents = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await ApiClient.getUsers({
        page: currentPage,
        limit: pageSize,
        search: searchTerm.trim() || undefined,
        provider: filterMethod !== 'ALL' ? filterMethod : undefined,
      });

      if (res && res.data && Array.isArray(res.data)) {
        const mapped: StudentUser[] = res.data.map((u: any) => {
          const { date, time } = formatOrderDateTime(u.createdAt);
          return {
            id: u.id,
            name: u.name || u.email.split('@')[0],
            email: u.email,
            phoneNumber: u.phoneNumber || '',
            loginMethod: determineLoginMethod(u.email, u.oauthIdentities),
            registeredAtDate: date,
            registeredAtTime: time,
            status: u.status === 'SUSPENDED' ? ('Suspended' as const) : ('Active' as const),
            subscription: u.isPremium ? ('VIP Unlimited' as const) : ('Free Tier' as const),
            ordersCount: u.ordersCount ?? 0,
            quizAttemptsCount: u.quizAttemptsCount ?? 0,
          };
        });
        setStudents(mapped);
        setTotalCount(res.total || 0);
      } else if (Array.isArray(res)) {
        const mapped: StudentUser[] = res.map((u: any) => {
          const { date, time } = formatOrderDateTime(u.createdAt);
          return {
            id: u.id,
            name: u.name || u.email.split('@')[0],
            email: u.email,
            phoneNumber: u.phoneNumber || '',
            loginMethod: determineLoginMethod(u.email, u.oauthIdentities),
            registeredAtDate: date,
            registeredAtTime: time,
            status: u.status === 'SUSPENDED' ? ('Suspended' as const) : ('Active' as const),
            subscription: u.isPremium ? ('VIP Unlimited' as const) : ('Free Tier' as const),
            ordersCount: u.ordersCount ?? 0,
            quizAttemptsCount: u.quizAttemptsCount ?? 0,
          };
        });
        setStudents(mapped);
        setTotalCount(mapped.length);
      }
    } catch (err) {
      console.warn('Could not fetch users from backend API:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchTerm, filterMethod]);

  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => {
      loadStudents();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadStudents]);

  const handleViewStudentOrders = async (student: StudentUser) => {
    setSelectedStudentForOrders(student);
    setLoadingOrders(true);
    try {
      const orders = await ApiClient.getUserOrders(student.id);
      setStudentOrders(Array.isArray(orders) ? orders : []);
    } catch (err) {
      console.error('Failed to load user orders:', err);
      try {
        const all = await ApiClient.getAllOrders();
        const userOrders = (all || []).filter((o: any) => o.userId === student.id && o.status === 'SUCCESS');
        setStudentOrders(userOrders);
      } catch {
        setStudentOrders([]);
      }
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmTarget) return;
    const target = confirmTarget;
    setConfirmTarget(null);

    if (target.type === 'suspend') {
      try {
        const nextStatus = target.student.status === 'Active' ? 'SUSPENDED' : 'ACTIVE';
        await ApiClient.adminUpdateUser(target.student.id, { status: nextStatus });
        await loadStudents();
      } catch (err: any) {
        alert(err.message || 'Failed to update student account status.');
      }
    } else {
      try {
        await ApiClient.deleteUser(target.student.id);
        await loadStudents();
      } catch (err: any) {
        alert(err.message || 'Failed to delete student account.');
      }
    }
  };

  const createFormik = useFormik({
    initialValues: { name: '', email: '', phoneNumber: '', isPremium: false },
    validationSchema: createUserSchema,
    onSubmit: async (values, { resetForm, setSubmitting }) => {
      try {
        await ApiClient.createUser({
          name: values.name.trim(),
          email: values.email.trim(),
          phoneNumber: values.phoneNumber.trim() || undefined,
          isPremium: values.isPremium,
        });
        await loadStudents();
        resetForm();
        setIsCreateDialogOpen(false);
      } catch (err: any) {
        alert(err.message || 'Failed to create student account.');
      } finally {
        setSubmitting(false);
      }
    },
  });

  const editFormik = useFormik({
    enableReinitialize: true,
    initialValues: {
      name: editingStudent?.name || '',
      phoneNumber: editingStudent?.phoneNumber || '',
      isPremium: editingStudent?.subscription === 'VIP Unlimited',
      status: editingStudent?.status || 'Active',
    },
    validationSchema: editUserSchema,
    onSubmit: async (values, { setSubmitting }) => {
      if (!editingStudent) return;
      try {
        await ApiClient.adminUpdateUser(editingStudent.id, {
          name: values.name.trim(),
          phoneNumber: values.phoneNumber.trim() || undefined,
          isPremium: values.isPremium,
          status: values.status === 'Active' ? 'ACTIVE' : 'SUSPENDED',
        });
        await loadStudents();
        setEditingStudent(null);
      } catch (err: any) {
        alert(err.message || 'Failed to update student account.');
      } finally {
        setSubmitting(false);
      }
    },
  });

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  if (!mounted) {
    return (
      <div className="space-y-8">
        <AdminSkeletonHeader />
        <AdminSkeletonTable rowsCount={5} colsCount={7} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4">
      {/* Fixed Header & Filter Bar */}
      <div className="shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Student Account Management
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">
            View and manage registered student accounts, login providers, subscription statuses, and account controls.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-3 w-full md:w-auto">
          <div className="w-full md:w-64">
            <Input
              placeholder="Search name or email..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              value={filterMethod}
              onChange={(val) => {
                setFilterMethod(val);
                setCurrentPage(1);
              }}
              options={[
                { value: 'ALL', label: 'All Providers' },
                { value: 'GOOGLE', label: 'Google' },
                { value: 'APPLE', label: 'Apple' },
                { value: 'EMAIL', label: 'Email' },
              ]}
            />
          </div>
          <Button
            variant="gold"
            className="font-bold shadow-md shadow-amber-500/20 w-full sm:w-auto shrink-0"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            + New User
          </Button>
        </div>
      </div>

      {/* Scrollable Table Container */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border border-slate-200/80 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] shadow-sm p-0">
        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 relative">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student Details</TableHead>
              <TableHead>Login Method</TableHead>
              <TableHead>Registration Date & Time</TableHead>
              <TableHead>Orders</TableHead>
              <TableHead>Quiz Attempts</TableHead>
              <TableHead>Account Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={`skeleton-${idx}`} className="border-b border-slate-200/80 dark:border-slate-800/60">
                  <TableCell className="py-4"><Skeleton className="h-5 w-44 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-24 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-28 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-12 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-12 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-20 rounded-lg" /></TableCell>
                  <TableCell className="py-4 text-right"><Skeleton className="h-8 w-24 rounded-xl ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : students.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center justify-center space-y-3 max-w-sm mx-auto">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">No Student Match</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        No registered student accounts found matching your search or filter criteria.
                      </p>
                    </div>
                    {(searchTerm || filterMethod !== 'ALL') && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs font-bold border-cyan-500/40 text-cyan-600 hover:bg-cyan-500/10 mt-1 cursor-pointer"
                        onClick={() => {
                          setSearchTerm('');
                          setFilterMethod('ALL');
                          setCurrentPage(1);
                        }}
                      >
                        Reset All Filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">{student.name}</span>
                      <span className="text-xs font-mono text-slate-400">{student.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        student.loginMethod === 'Google'
                          ? 'warning'
                          : student.loginMethod === 'Apple'
                          ? 'default'
                          : 'outline'
                      }
                      className="inline-flex items-center justify-center p-1.5"
                      title={student.loginMethod}
                    >
                      {student.loginMethod === 'Google' ? (
                        <GoogleIcon className="h-4 w-4" />
                      ) : student.loginMethod === 'Apple' ? (
                        <Apple className="h-4 w-4" />
                      ) : (
                        <Mail className="h-4 w-4" />
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-xs text-slate-700 dark:text-slate-300 font-semibold">{student.registeredAtDate}</div>
                    <div className="flex items-center space-x-1 text-[11px] font-mono text-slate-400 mt-0.5">
                      <Clock className="w-3 h-3 text-cyan-500 shrink-0" />
                      <span>{student.registeredAtTime}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {student.ordersCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => handleViewStudentOrders(student)}
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-all hover:scale-105 shadow-2xs cursor-pointer group"
                        title="Click to view all completed orders and products"
                      >
                        <ShoppingBag className="w-3.5 h-3.5 shrink-0 group-hover:rotate-6 transition-transform" />
                        <span className="font-mono font-bold">{student.ordersCount}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleViewStudentOrders(student)}
                        className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Click to view order details"
                      >
                        <span className="font-mono">0</span>
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="font-mono font-semibold text-slate-700 dark:text-slate-300">{student.quizAttemptsCount}</TableCell>
                  <TableCell>
                    <Badge variant={student.status === 'Active' ? 'success' : 'danger'}>
                      {student.status === 'Active' ? 'Active' : 'Suspended'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingStudent(student)}
                        className="p-2"
                        title="Edit Student Account"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant={student.status === 'Active' ? 'outline' : 'primary'}
                        onClick={() => setConfirmTarget({ type: 'suspend', student })}
                        className="text-xs"
                      >
                        {student.status === 'Active' ? 'Suspend' : 'Activate'}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setConfirmTarget({ type: 'delete', student })}
                        className="p-2"
                        title="Delete Student Account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
            totalItems={totalCount}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
        </div>
      </Card>

      <ConfirmDialog
        isOpen={confirmTarget !== null}
        title={confirmTarget?.type === 'delete' ? 'Delete Student Account' : confirmTarget?.student.status === 'Active' ? 'Suspend Account' : 'Activate Account'}
        description={
          confirmTarget?.type === 'delete'
            ? `This will permanently remove ${confirmTarget.student.name} (${confirmTarget.student.email}). This action cannot be undone.`
            : confirmTarget
            ? `${confirmTarget.student.status === 'Active' ? 'Suspend' : 'Activate'} the account for ${confirmTarget.student.name} (${confirmTarget.student.email})?`
            : undefined
        }
        confirmLabel={confirmTarget?.type === 'delete' ? 'Delete' : confirmTarget?.student.status === 'Active' ? 'Suspend' : 'Activate'}
        variant={confirmTarget?.type === 'delete' || confirmTarget?.student.status === 'Active' ? 'danger' : 'default'}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmTarget(null)}
      />

      <Dialog isOpen={isCreateDialogOpen} onClose={() => setIsCreateDialogOpen(false)} title="Add New Student Account">
        <form className="space-y-4 pt-2" onSubmit={createFormik.handleSubmit} noValidate>
          <Input
            label="Full Name"
            name="name"
            placeholder="e.g. Anjali Menon"
            value={createFormik.values.name}
            onChange={createFormik.handleChange}
            onBlur={createFormik.handleBlur}
            error={createFormik.touched.name && createFormik.errors.name ? createFormik.errors.name : undefined}
          />
          <Input
            label="Email Address"
            name="email"
            type="email"
            placeholder="student@example.com"
            value={createFormik.values.email}
            onChange={createFormik.handleChange}
            onBlur={createFormik.handleBlur}
            error={createFormik.touched.email && createFormik.errors.email ? createFormik.errors.email : undefined}
          />
          <Input
            label="Phone Number (optional)"
            name="phoneNumber"
            placeholder="e.g. +91 98765 43210"
            value={createFormik.values.phoneNumber}
            onChange={createFormik.handleChange}
            onBlur={createFormik.handleBlur}
          />
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              name="isPremium"
              checked={createFormik.values.isPremium}
              onChange={createFormik.handleChange}
              className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-cyan-500 focus:ring-cyan-500/40 cursor-pointer"
            />
            Grant VIP Unlimited access
          </label>
          <Button type="submit" variant="gold" className="w-full font-bold shadow-md shadow-amber-500/20" isLoading={createFormik.isSubmitting}>
            Create Account
          </Button>
        </form>
      </Dialog>

      <Dialog
        isOpen={editingStudent !== null}
        onClose={() => setEditingStudent(null)}
        title="Edit Student Account"
        description={editingStudent?.email}
      >
        <form className="space-y-4 pt-2" onSubmit={editFormik.handleSubmit} noValidate>
          <Input
            label="Full Name"
            name="name"
            value={editFormik.values.name}
            onChange={editFormik.handleChange}
            onBlur={editFormik.handleBlur}
            error={editFormik.touched.name && editFormik.errors.name ? editFormik.errors.name : undefined}
          />
          <Input
            label="Phone Number"
            name="phoneNumber"
            placeholder="e.g. +91 98765 43210"
            value={editFormik.values.phoneNumber}
            onChange={editFormik.handleChange}
            onBlur={editFormik.handleBlur}
          />
          <Select
            label="Account Status"
            name="status"
            value={editFormik.values.status}
            onChange={(val) => editFormik.setFieldValue('status', val)}
            options={[
              { value: 'Active', label: 'Active' },
              { value: 'Suspended', label: 'Suspended' },
            ]}
          />
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              name="isPremium"
              checked={editFormik.values.isPremium}
              onChange={editFormik.handleChange}
              className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-cyan-500 focus:ring-cyan-500/40 cursor-pointer"
            />
            VIP Unlimited access
          </label>
          <Button type="submit" variant="gold" className="w-full font-bold shadow-md shadow-amber-500/20" isLoading={editFormik.isSubmitting}>
            Save Changes
          </Button>
        </form>
      </Dialog>

      {/* Student Completed Orders Inspector Dialog */}
      <Dialog
        isOpen={selectedStudentForOrders !== null}
        onClose={() => setSelectedStudentForOrders(null)}
        title="Completed Student Orders"
        description={selectedStudentForOrders ? `${selectedStudentForOrders.name} (${selectedStudentForOrders.email})` : ''}
        className="max-w-2xl w-full"
      >
        {selectedStudentForOrders && (
          <div className="space-y-4 pt-2">
            {/* Summary Metrics Strip */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                  Completed Orders
                </span>
                <span className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                  {loadingOrders ? '...' : studentOrders.length}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 block">
                  Total Spent
                </span>
                <span className="text-xl font-black text-cyan-700 dark:text-cyan-300">
                  {loadingOrders ? '...' : `₹${studentOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0).toLocaleString('en-IN')}`}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                  Account Plan
                </span>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300 mt-1 block truncate">
                  {selectedStudentForOrders.subscription}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-[#1e2e56] pb-2">
              <div className="flex items-center space-x-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Showing Completed (SUCCESS) Orders Only</span>
              </div>
              <span className="font-mono text-[11px]">
                {studentOrders.length} order{studentOrders.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Orders & Products List */}
            {loadingOrders ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <RefreshCw className="w-6 h-6 animate-spin text-cyan-500" />
                <p className="text-xs font-semibold text-slate-400">Loading student orders & products...</p>
              </div>
            ) : studentOrders.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center mx-auto text-slate-400">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Completed Orders Yet</h4>
                  <p className="text-xs text-slate-400 mt-1">This student has not completed any paid purchases or manual grants.</p>
                </div>
                <div className="pt-2">
                  <Link
                    href="/admin/orders"
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 font-bold text-xs transition-colors"
                  >
                    <span>Grant Manual Order</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                {studentOrders.map((order) => {
                  const { date, time } = formatOrderDateTime(order.createdAt);
                  const isBook = Boolean(order.bookId || order.book);
                  const isQuiz = Boolean(order.quizId || order.quiz);
                  const productTitle = order.book?.title || order.quiz?.title || order.description || 'General Order';
                  const isManual = order.razorpayOrderId === '[MANUAL_ORDER]' || order.razorpayOrderId?.startsWith('[MANUAL_ORDER]');

                  return (
                    <div
                      key={order.id}
                      className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-[#1e2e56] bg-slate-50/80 dark:bg-[#070b18]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-cyan-500/40 transition-all shadow-xs"
                    >
                      <div className="flex items-start space-x-3 min-w-0 flex-1">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                            isBook
                              ? 'bg-blue-500/15 text-blue-500'
                              : isQuiz
                              ? 'bg-purple-500/15 text-purple-500'
                              : 'bg-emerald-500/15 text-emerald-500'
                          }`}
                        >
                          {isBook ? (
                            <BookOpen className="w-4 h-4" />
                          ) : isQuiz ? (
                            <HelpCircle className="w-4 h-4" />
                          ) : (
                            <ShoppingBag className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                              {isBook ? 'Book' : isQuiz ? 'Quiz' : 'Item'}
                            </span>
                            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                              {productTitle}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-400 font-mono">
                            <span className="flex items-center space-x-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>{date}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{time}</span>
                            </span>
                            {order.razorpayPaymentId && (
                              <span className="truncate max-w-[130px] text-cyan-600 dark:text-cyan-400" title={order.razorpayPaymentId}>
                                ID: {order.razorpayPaymentId}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end sm:space-x-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-800/60 shrink-0">
                        <div className="text-right">
                          <div className="font-mono font-black text-sm text-slate-900 dark:text-white">
                            ₹{Number(order.amount).toLocaleString('en-IN')}
                          </div>
                          <Badge variant={isManual ? 'gold' : 'success'} className="text-[10px] px-1.5 py-0">
                            {isManual ? 'Admin Grant' : 'Completed'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 dark:border-[#1e2e56] flex justify-end">
              <Button
                variant="outline"
                onClick={() => setSelectedStudentForOrders(null)}
                className="font-bold border-slate-300 dark:border-[#1e2e56]"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
