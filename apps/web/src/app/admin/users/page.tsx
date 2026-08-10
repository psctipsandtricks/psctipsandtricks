'use client';

import React, { useState, useEffect } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge, Button, Input, Dialog, Pagination, Skeleton, ConfirmDialog } from '@psc/ui';
import { Search, UserCheck, ShieldAlert, Zap, RefreshCw, Trash2, Edit3, Mail, Users, Apple } from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { AdminSkeletonHeader, AdminSkeletonTable } from '../admin-skeleton';

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
  registeredAt: string;
  status: 'Active' | 'Suspended';
  subscription: 'Free Tier' | 'VIP Unlimited';
  ordersCount: number;
  quizAttemptsCount: number;
}

const createUserSchema = Yup.object({
  name: Yup.string().trim().required('Name is required'),
  email: Yup.string().email('Enter a valid email').required('Email is required'),
  password: Yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
});

const editUserSchema = Yup.object({
  name: Yup.string().trim().required('Name is required'),
});

export default function AdminUsersPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMethod, setFilterMethod] = useState<string>('ALL');
  const [confirmTarget, setConfirmTarget] = useState<{ type: 'suspend' | 'delete'; student: StudentUser } | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentUser | null>(null);

  useEffect(() => {
    setMounted(true);
    loadStudents();
  }, []);

  const INITIAL_STUDENTS: StudentUser[] = [
    { id: 'usr-101', name: 'Anandu Krishnan', email: 'anandu.k@gmail.com', phoneNumber: '', loginMethod: 'Google', registeredAt: '2026-07-28', status: 'Active', subscription: 'VIP Unlimited', ordersCount: 3, quizAttemptsCount: 12 },
    { id: 'usr-102', name: 'Sneha Nair', email: 'sneha.nair@psctips.com', phoneNumber: '', loginMethod: 'Email', registeredAt: '2026-07-30', status: 'Active', subscription: 'VIP Unlimited', ordersCount: 1, quizAttemptsCount: 5 },
    { id: 'usr-103', name: 'Rahul Varma', email: 'rahul.varma@icloud.com', phoneNumber: '', loginMethod: 'Apple', registeredAt: '2026-08-01', status: 'Active', subscription: 'Free Tier', ordersCount: 0, quizAttemptsCount: 2 },
    { id: 'usr-104', name: 'Divya S. Pillai', email: 'divya.sp@gmail.com', phoneNumber: '', loginMethod: 'Google', registeredAt: '2026-08-02', status: 'Active', subscription: 'Free Tier', ordersCount: 0, quizAttemptsCount: 0 },
    { id: 'usr-105', name: 'Muhammed Shafi', email: 'shafi.m@gmail.com', phoneNumber: '', loginMethod: 'Email', registeredAt: '2026-08-03', status: 'Active', subscription: 'VIP Unlimited', ordersCount: 2, quizAttemptsCount: 8 },
  ];

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

  const loadStudents = async () => {
    let apiStudents: StudentUser[] = [];
    try {
      const dbUsers = await ApiClient.getUsers();
      if (Array.isArray(dbUsers) && dbUsers.length > 0) {
        apiStudents = dbUsers.map((u: any) => ({
          id: u.id,
          name: u.name || u.email.split('@')[0],
          email: u.email,
          phoneNumber: u.phoneNumber || '',
          loginMethod: determineLoginMethod(u.email, u.oauthIdentities),
          registeredAt: u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          status: u.status === 'SUSPENDED' ? 'Suspended' as const : 'Active' as const,
          subscription: u.isPremium ? 'VIP Unlimited' as const : 'Free Tier' as const,
          ordersCount: u.ordersCount ?? 0,
          quizAttemptsCount: u.quizAttemptsCount ?? 0,
        }));
      }
    } catch (err) {
      console.warn('Could not fetch users from backend API:', err);
    }

    let localSessionUser: StudentUser | null = null;
    try {
      const pscUserRaw = localStorage.getItem('psc_user');
      if (pscUserRaw) {
        const pscUser = JSON.parse(pscUserRaw);
        if (pscUser && pscUser.email) {
          localSessionUser = {
            id: pscUser.id || 'usr-local-session',
            name: pscUser.name || pscUser.email.split('@')[0],
            email: pscUser.email,
            phoneNumber: pscUser.phoneNumber || '',
            loginMethod: determineLoginMethod(pscUser.email, pscUser.oauthIdentities),
            registeredAt: new Date().toISOString().split('T')[0],
            status: 'Active' as const,
            subscription: pscUser.isPremium ? 'VIP Unlimited' as const : 'Free Tier' as const,
            ordersCount: pscUser.ordersCount ?? 0,
            quizAttemptsCount: pscUser.quizAttemptsCount ?? 0,
          };
        }
      }
    } catch (e) {}

    let storedLocal: StudentUser[] = [];
    try {
      const stored = localStorage.getItem('psc_registered_students');
      if (stored) {
        storedLocal = JSON.parse(stored);
      }
    } catch (e) {}

    const baseList = apiStudents.length > 0 ? apiStudents : (storedLocal.length > 0 ? storedLocal : INITIAL_STUDENTS);

    const finalMap = new Map<string, StudentUser>();
    
    if (localSessionUser) {
      finalMap.set(localSessionUser.email.toLowerCase(), localSessionUser);
    }

    baseList.forEach((s) => {
      if (!finalMap.has(s.email.toLowerCase())) {
        finalMap.set(s.email.toLowerCase(), {
          ...s,
          phoneNumber: s.phoneNumber ?? '',
          ordersCount: s.ordersCount ?? 0,
          quizAttemptsCount: s.quizAttemptsCount ?? 0,
          loginMethod: determineLoginMethod(s.email, (s as any).oauthIdentities),
        });
      }
    });

    const mergedList = Array.from(finalMap.values());
    setStudents(mergedList);
    try {
      localStorage.setItem('psc_registered_students', JSON.stringify(mergedList));
    } catch (e) {}
    setLoading(false);
  };

  const handleToggleStatus = (id: string) => {
    const updated = students.map((s) => {
      if (s.id === id) {
        return {
          ...s,
          status: s.status === 'Active' ? ('Suspended' as const) : ('Active' as const),
        };
      }
      return s;
    });
    setStudents(updated);
    localStorage.setItem('psc_registered_students', JSON.stringify(updated));
  };

  const handleDelete = (id: string) => {
    const updated = students.filter((s) => s.id !== id);
    setStudents(updated);
    localStorage.setItem('psc_registered_students', JSON.stringify(updated));
  };

  const handleConfirmAction = () => {
    if (!confirmTarget) return;
    if (confirmTarget.type === 'suspend') {
      handleToggleStatus(confirmTarget.student.id);
    } else {
      handleDelete(confirmTarget.student.id);
    }
    setConfirmTarget(null);
  };

  const createFormik = useFormik({
    initialValues: { name: '', email: '', password: '', phoneNumber: '', isPremium: false },
    validationSchema: createUserSchema,
    onSubmit: async (values, { resetForm, setSubmitting }) => {
      try {
        await ApiClient.createUser({
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password,
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

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterMethod]);

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMethod = filterMethod === 'ALL' || s.loginMethod.toUpperCase() === filterMethod.toUpperCase();
    return matchesSearch && matchesMethod;
  });

  const totalItems = filteredStudents.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (!mounted) {
    return (
      <div className="space-y-8">
        <AdminSkeletonHeader />
        <AdminSkeletonTable rowsCount={5} colsCount={7} />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-8 px-1 sm:px-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
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
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value)}
            className="h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
          >
            <option value="ALL">All Providers</option>
            <option value="GOOGLE">Google</option>
            <option value="APPLE">Apple</option>
            <option value="EMAIL">Email</option>
          </select>
          <Button
            variant="gold"
            className="font-bold shadow-md shadow-amber-500/20 w-full sm:w-auto shrink-0"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            + New User
          </Button>
        </div>
      </div>

      <Card className="p-3 sm:p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student Details</TableHead>
              <TableHead>Login Method</TableHead>
              <TableHead>Registration Date</TableHead>
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
            ) : paginatedStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center justify-center space-y-3 max-w-sm mx-auto">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
                      <Users className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
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
                        }}
                      >
                        Reset All Filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedStudents.map((student) => (
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
                  <TableCell className="font-mono text-xs text-slate-400">{student.registeredAt}</TableCell>
                  <TableCell className="font-mono font-semibold text-slate-700 dark:text-slate-300">{student.ordersCount}</TableCell>
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

        <div className="px-4 pb-4">
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
            label="Password"
            name="password"
            type="password"
            placeholder="Minimum 6 characters"
            value={createFormik.values.password}
            onChange={createFormik.handleChange}
            onBlur={createFormik.handleBlur}
            error={createFormik.touched.password && createFormik.errors.password ? createFormik.errors.password : undefined}
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
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Account Status
            </label>
            <select
              name="status"
              value={editFormik.values.status}
              onChange={editFormik.handleChange}
              className="h-11 w-full px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-[#070b18]/70 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="Active">Active</option>
              <option value="Suspended">Suspended</option>
            </select>
          </div>
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
    </div>
  );
}
