'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  Button,
  Input,
  Dialog,
  Pagination,
  ConfirmDialog,
  Select,
} from '@psc/ui';
import {
  Search,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  Plus,
  Edit3,
  Trash2,
  KeyRound,
  Sliders,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Mail,
  Phone,
  Calendar,
  Clock,
  BookOpen,
  HelpCircle,
  Youtube,
  FileText,
  Users,
  MessageSquare,
  ShoppingCart,
  Tag,
  Bell,
  Megaphone,
  LayoutDashboard,
  Lock,
} from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { StaffMember, StaffPermission } from '@psc/shared-types';
import { useAdminAuth } from '../admin-auth-provider';
import { AdminSkeletonHeader, AdminSkeletonTable } from '../admin-skeleton';

const PERMISSION_DEFINITIONS = [
  { key: 'viewAnalytics', label: 'Analytics Dashboard', icon: LayoutDashboard, category: 'Analytics & Reports' },
  { key: 'manageQuizzes', label: 'Manage Quizzes & Mocks', icon: HelpCircle, category: 'Assessments' },
  { key: 'manageBooks', label: 'Manage E-Books', icon: BookOpen, category: 'Content' },
  { key: 'manageVideos', label: 'Video Library', icon: Youtube, category: 'Content' },
  { key: 'managePdfs', label: 'PDF Library', icon: FileText, category: 'Content' },
  { key: 'manageUsers', label: 'User Management', icon: Users, category: 'User Management' },
  { key: 'manageChat', label: 'Community Groups', icon: MessageSquare, category: 'User Management' },
  { key: 'viewOrders', label: 'View Orders', icon: ShoppingCart, category: 'Commerce' },
  { key: 'manageOrders', label: 'Manage Orders', icon: ShoppingCart, category: 'Commerce' },
  { key: 'manageCoupons', label: 'Coupon Codes', icon: Tag, category: 'Commerce' },
  { key: 'manageNotifications', label: 'Push Notifications', icon: Bell, category: 'Communications' },
  { key: 'manageAnnouncements', label: 'Announcements', icon: Megaphone, category: 'Communications' },
  { key: 'manageStaff', label: 'Staff Management', icon: ShieldCheck, category: 'Administration' },
] as const;

function formatDateTime(isoString?: string | null) {
  if (!isoString) return { date: 'Never', time: '-' };
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

const staffFormSchema = Yup.object({
  name: Yup.string().trim().required('Full name is required'),
  email: Yup.string().email('Enter a valid email').required('Email is required'),
  phoneNumber: Yup.string().trim().optional(),
  password: Yup.string()
    .trim()
    .when('$isNew', {
      is: true,
      then: (schema) => schema.min(6, 'Password must be at least 6 characters').optional(),
      otherwise: (schema) => schema.min(6, 'Password must be at least 6 characters').optional(),
    }),
  role: Yup.string().oneOf(['ADMIN', 'STAFF']).required('Role is required'),
  status: Yup.string().oneOf(['ACTIVE', 'SUSPENDED']).required('Status is required'),
});

export default function StaffManagementPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'STAFF'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  const [isPermModalOpen, setIsPermModalOpen] = useState(false);
  const [permStaff, setPermStaff] = useState<StaffMember | null>(null);
  const [permValues, setPermValues] = useState<Record<string, boolean>>({});

  const [isResetPassOpen, setIsResetPassOpen] = useState(false);
  const [resetStaff, setResetStaff] = useState<StaffMember | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const [deleteConfirmStaff, setDeleteConfirmStaff] = useState<StaffMember | null>(null);
  const [statusConfirmStaff, setStatusConfirmStaff] = useState<{ staff: StaffMember; nextStatus: 'ACTIVE' | 'SUSPENDED' } | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState('');
  const [successBanner, setSuccessBanner] = useState('');

  const { adminUser, refreshAdminUser } = useAdminAuth();

  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      setErrorBanner('');
      const res = await ApiClient.getStaff({
        search: searchTerm || undefined,
        role: roleFilter !== 'ALL' ? roleFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        page: currentPage,
        limit: pageSize,
      });
      setStaffList(res?.data || []);
      setTotalItems(res?.meta?.total || 0);
    } catch (err: any) {
      console.error('Failed to fetch staff:', err);
      setErrorBanner(err?.message || 'Failed to load staff list');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, roleFilter, statusFilter, currentPage, pageSize]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      fetchStaff();
    }
  }, [mounted, fetchStaff]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter, statusFilter]);

  // Formik for Add / Edit
  const formik = useFormik({
    initialValues: {
      name: '',
      email: '',
      phoneNumber: '',
      password: '',
      role: 'STAFF',
      status: 'ACTIVE',
    },
    validationSchema: staffFormSchema,
    enableReinitialize: true,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      setActionLoading(true);
      setErrorBanner('');
      try {
        if (editingStaff) {
          await ApiClient.updateStaff(editingStaff.id, {
            name: values.name,
            email: values.email,
            phoneNumber: values.phoneNumber || undefined,
            role: values.role,
            status: values.status,
            password: values.password?.trim() ? values.password.trim() : undefined,
          });
          setSuccessBanner(`Updated account for ${values.name}`);
        } else {
          const res = await ApiClient.createStaff({
            name: values.name,
            email: values.email,
            phoneNumber: values.phoneNumber || undefined,
            password: values.password?.trim() ? values.password.trim() : undefined,
            role: values.role,
            status: values.status,
          });
          if (res.generatedPassword) {
            setSuccessBanner(`Staff created! Temporary Password: ${res.generatedPassword}`);
          } else {
            setSuccessBanner(`Staff member ${values.name} created successfully!`);
          }
        }
        setIsAddEditOpen(false);
        resetForm();
        setEditingStaff(null);
        fetchStaff();
      } catch (err: any) {
        setErrorBanner(err?.message || 'Failed to save staff member');
      } finally {
        setActionLoading(false);
        setSubmitting(false);
      }
    },
  });

  const handleOpenAdd = () => {
    setEditingStaff(null);
    formik.resetForm({
      values: {
        name: '',
        email: '',
        phoneNumber: '',
        password: '',
        role: 'STAFF',
        status: 'ACTIVE',
      },
    });
    setIsAddEditOpen(true);
  };

  const handleOpenEdit = (staff: StaffMember) => {
    setEditingStaff(staff);
    formik.resetForm({
      values: {
        name: staff.name,
        email: staff.email,
        phoneNumber: staff.phoneNumber || '',
        password: '',
        role: staff.role,
        status: staff.status,
      },
    });
    setIsAddEditOpen(true);
  };

  const handleOpenPermissions = (staff: StaffMember) => {
    setPermStaff(staff);
    const existing = staff.staffPermission || ({} as any);
    const initial: Record<string, boolean> = {};
    PERMISSION_DEFINITIONS.forEach((def) => {
      initial[def.key] = staff.role === 'ADMIN' ? true : Boolean(existing[def.key]);
    });
    setPermValues(initial);
    setIsPermModalOpen(true);
  };

  const handleSavePermissions = async () => {
    if (!permStaff) return;
    setActionLoading(true);
    setErrorBanner('');
    try {
      await ApiClient.updateStaffPermissions(permStaff.id, permValues as Partial<StaffPermission>);
      setSuccessBanner(`Updated permissions for ${permStaff.name}`);
      setIsPermModalOpen(false);
      await fetchStaff();
      if (refreshAdminUser) {
        await refreshAdminUser();
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('psc:admin-session-refresh'));
      }
    } catch (err: any) {
      setErrorBanner(err?.message || 'Failed to update permissions');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleAllPerms = (enable: boolean) => {
    const updated: Record<string, boolean> = {};
    PERMISSION_DEFINITIONS.forEach((def) => {
      updated[def.key] = enable;
    });
    setPermValues(updated);
  };

  const handleOpenResetPass = (staff: StaffMember) => {
    setResetStaff(staff);
    setNewPassword('');
    setShowPassword(false);
    setCopied(false);
    setIsResetPassOpen(true);
  };

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pass = '';
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pass);
    setShowPassword(true);
    setCopied(false);
  };

  const handleSaveResetPassword = async () => {
    if (!resetStaff || !newPassword.trim()) return;
    setActionLoading(true);
    setErrorBanner('');
    try {
      await ApiClient.resetStaffPassword(resetStaff.id, newPassword.trim());
      setSuccessBanner(`Password reset for ${resetStaff.name}`);
      setIsResetPassOpen(false);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Failed to reset password');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyPassword = () => {
    if (!newPassword) return;
    navigator.clipboard.writeText(newPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExecuteStatusToggle = async () => {
    if (!statusConfirmStaff) return;
    setActionLoading(true);
    setErrorBanner('');
    try {
      if (statusConfirmStaff.nextStatus === 'SUSPENDED') {
        await ApiClient.suspendStaff(statusConfirmStaff.staff.id);
        setSuccessBanner(`Suspended account for ${statusConfirmStaff.staff.name}`);
      } else {
        await ApiClient.reactivateStaff(statusConfirmStaff.staff.id);
        setSuccessBanner(`Reactivated account for ${statusConfirmStaff.staff.name}`);
      }
      setStatusConfirmStaff(null);
      fetchStaff();
    } catch (err: any) {
      setErrorBanner(err?.message || 'Failed to update account status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteDelete = async () => {
    if (!deleteConfirmStaff) return;
    setActionLoading(true);
    setErrorBanner('');
    try {
      await ApiClient.deleteStaff(deleteConfirmStaff.id);
      setSuccessBanner(`Deleted staff account for ${deleteConfirmStaff.name}`);
      setDeleteConfirmStaff(null);
      fetchStaff();
    } catch (err: any) {
      setErrorBanner(err?.message || 'Failed to delete staff member');
    } finally {
      setActionLoading(false);
    }
  };

  if (!mounted || loading) {
    return (
      <div className="space-y-6">
        <AdminSkeletonHeader />
        <AdminSkeletonTable rowsCount={6} />
      </div>
    );
  }

  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-cyan-600 dark:text-cyan-400 mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Role-Based Access Control</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Staff Management
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5">
            Manage staff accounts, administrative roles, and module-level access permissions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStaff}
            className="font-bold text-xs"
            title="Refresh list"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>
          <Button
            variant="gold"
            onClick={handleOpenAdd}
            className="font-extrabold text-xs shadow-md shadow-amber-500/20"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Add Staff
          </Button>
        </div>
      </div>

      {/* ── Notification Banners ───────────────────────────────────── */}
      {errorBanner && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-between">
          <span>{errorBanner}</span>
          <button onClick={() => setErrorBanner('')} className="p-1 hover:bg-rose-500/20 rounded-md">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {successBanner && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-between">
          <span>{successBanner}</span>
          <button onClick={() => setSuccessBanner('')} className="p-1 hover:bg-emerald-500/20 rounded-md">
            <CheckCircle2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Filter Bar ─────────────────────────────────────────────── */}
      <Card className="p-4 glass-card space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div className="sm:col-span-6 relative">
            <Input
              placeholder="Search staff by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 text-xs"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>

          <div className="sm:col-span-3">
            <Select
              label="Role Filter"
              value={roleFilter}
              onChange={(val) => setRoleFilter(val as any)}
              options={[
                { value: 'ALL', label: 'All Roles (Admin & Staff)' },
                { value: 'ADMIN', label: 'Administrators Only' },
                { value: 'STAFF', label: 'Staff Members Only' },
              ]}
            />
          </div>

          <div className="sm:col-span-3">
            <Select
              label="Status Filter"
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as any)}
              options={[
                { value: 'ALL', label: 'All Statuses' },
                { value: 'ACTIVE', label: 'Active Only' },
                { value: 'SUSPENDED', label: 'Suspended Only' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* ── Staff Table ────────────────────────────────────────────── */}
      <Card className="overflow-hidden glass-panel border-slate-200/80 dark:border-[#1e2e56]">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-slate-200/80 dark:border-[#1e2e56] bg-slate-50/70 dark:bg-[#0c152e]/70">
                <TableHead className="font-extrabold text-xs">Staff Member</TableHead>
                <TableHead className="font-extrabold text-xs">Role</TableHead>
                <TableHead className="font-extrabold text-xs">Assigned Permissions</TableHead>
                <TableHead className="font-extrabold text-xs">Status</TableHead>
                <TableHead className="font-extrabold text-xs">Activity & Dates</TableHead>
                <TableHead className="font-extrabold text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <ShieldAlert className="w-8 h-8 text-slate-400" />
                      <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No staff members found</p>
                      <p className="text-xs text-slate-400">
                        {searchTerm ? 'Try refining your search terms.' : 'Click "Add Staff" to invite a team member.'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                staffList.map((staff) => {
                  const isCurrentAdmin = adminUser?.id === staff.id;
                  const perm = staff.staffPermission;
                  const activePermCount = perm
                    ? Object.entries(perm).filter(([k, v]) => v === true && k !== 'id' && k !== 'userId').length
                    : 0;
                  const created = formatDateTime(staff.createdAt);
                  const lastLogin = formatDateTime(staff.lastLoginAt);

                  return (
                    <TableRow
                      key={staff.id}
                      className="border-b border-slate-100 dark:border-[#1e2e56]/60 hover:bg-slate-50/80 dark:hover:bg-[#0c152e]/50 transition-colors"
                    >
                      {/* Name & Contact */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                            {staff.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-slate-900 dark:text-white text-xs truncate">
                                {staff.name}
                              </span>
                              {isCurrentAdmin && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-cyan-500/15 text-cyan-600 dark:text-cyan-300">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                              {staff.email}
                            </p>
                            {staff.phoneNumber && (
                              <p className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                                <Phone className="w-2.5 h-2.5" /> {staff.phoneNumber}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Role */}
                      <TableCell>
                        {staff.role === 'ADMIN' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-xs">
                            <ShieldCheck className="w-3 h-3" /> Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 shadow-xs">
                            <Users className="w-3 h-3" /> Staff
                          </span>
                        )}
                      </TableCell>

                      {/* Permissions Summary */}
                      <TableCell>
                        {staff.role === 'ADMIN' ? (
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Full Administrator Access
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap max-w-xs">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {activePermCount} of {PERMISSION_DEFINITIONS.length} Modules
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenPermissions(staff)}
                              className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                            >
                              View / Edit
                            </button>
                          </div>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        {staff.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                            <UserX className="w-3 h-3" />
                            Suspended
                          </span>
                        )}
                      </TableCell>

                      {/* Activity Timestamps */}
                      <TableCell>
                        <div className="text-[11px] space-y-0.5 font-mono">
                          <p className="text-slate-600 dark:text-slate-300 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" /> Joined {created.date}
                          </p>
                          <p className="text-slate-400 text-[10px] flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" /> Login: {lastLogin.date !== 'Never' ? `${lastLogin.date} ${lastLogin.time}` : 'Never logged in'}
                          </p>
                        </div>
                      </TableCell>

                      {/* Action Buttons */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Manage Permissions */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenPermissions(staff)}
                            className="p-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-cyan-500"
                            title="Manage Permissions"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </Button>

                          {/* Reset Password */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenResetPass(staff)}
                            className="p-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-amber-500"
                            title="Reset Password"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </Button>

                          {/* Edit Details */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEdit(staff)}
                            className="p-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-blue-500"
                            title="Edit Staff Member"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>

                          {/* Toggle Active / Suspended */}
                          {!isCurrentAdmin && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setStatusConfirmStaff({
                                  staff,
                                  nextStatus: staff.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
                                })
                              }
                              className={`p-1.5 text-xs ${
                                staff.status === 'ACTIVE'
                                  ? 'text-slate-600 dark:text-slate-300 hover:text-rose-500'
                                  : 'text-emerald-600 hover:text-emerald-500'
                              }`}
                              title={staff.status === 'ACTIVE' ? 'Suspend Account' : 'Reactivate Account'}
                            >
                              {staff.status === 'ACTIVE' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                            </Button>
                          )}

                          {/* Delete Account */}
                          {!isCurrentAdmin && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteConfirmStaff(staff)}
                              className="p-1.5 text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-500/10"
                              title="Delete Account"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200/80 dark:border-[#1e2e56]">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              pageSizeOptions={[5, 10, 20, 50]}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
            />
          </div>
        )}
      </Card>

      {/* ── 1. Add / Edit Staff Modal ───────────────────────────────── */}
      <Dialog
        isOpen={isAddEditOpen}
        onClose={() => {
          setIsAddEditOpen(false);
          setEditingStaff(null);
        }}
        title={editingStaff ? `Edit Staff: ${editingStaff.name}` : 'Add New Staff Member'}
      >
        <form onSubmit={formik.handleSubmit} className="space-y-4">
          <Input
            label="Full Name *"
            name="name"
            placeholder="e.g. Rahul Sharma"
            value={formik.values.name}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.name && formik.errors.name ? formik.errors.name : undefined}
          />

          <Input
            label="Email Address *"
            type="email"
            name="email"
            placeholder="staff@psctipsandtricks.com"
            value={formik.values.email}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.email && formik.errors.email ? formik.errors.email : undefined}
          />

          <Input
            label="Phone Number (Optional)"
            type="tel"
            name="phoneNumber"
            placeholder="+91 98765 43210"
            value={formik.values.phoneNumber}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
          />

          <Input
            label={editingStaff ? 'New Password (Leave empty to keep existing)' : 'Set Password (Optional - auto-generates if empty)'}
            type="password"
            name="password"
            placeholder="Minimum 6 characters"
            value={formik.values.password}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.password && formik.errors.password ? formik.errors.password : undefined}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Role *"
              name="role"
              value={formik.values.role}
              onChange={(val) => formik.setFieldValue('role', val)}
              options={[
                { value: 'STAFF', label: 'Staff (Permission-based)' },
                { value: 'ADMIN', label: 'Admin (Full Access)' },
              ]}
            />

            <Select
              label="Account Status *"
              name="status"
              value={formik.values.status}
              onChange={(val) => formik.setFieldValue('status', val)}
              options={[
                { value: 'ACTIVE', label: 'Active' },
                { value: 'SUSPENDED', label: 'Suspended' },
              ]}
            />
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAddEditOpen(false);
                setEditingStaff(null);
              }}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="gold" disabled={actionLoading}>
              {actionLoading ? 'Saving...' : editingStaff ? 'Save Changes' : 'Create Staff Member'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ── 2. Granular Permissions Modal ──────────────────────────── */}
      <Dialog
        isOpen={isPermModalOpen}
        onClose={() => {
          setIsPermModalOpen(false);
          setPermStaff(null);
        }}
        title={`Permission Matrix: ${permStaff?.name}`}
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {permStaff?.role === 'ADMIN' && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>This user is an Administrator with unrestricted access to all modules.</span>
            </div>
          )}

          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              Module Access Permissions
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleToggleAllPerms(true)}
                className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
              >
                Select All
              </button>
              <span className="text-slate-400">·</span>
              <button
                type="button"
                onClick={() => handleToggleAllPerms(false)}
                className="text-[11px] font-bold text-rose-500 hover:underline"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {PERMISSION_DEFINITIONS.map((def) => {
              const isChecked = Boolean(permValues[def.key]);
              return (
                <label
                  key={def.key}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    isChecked
                      ? 'border-cyan-500/50 bg-cyan-500/[0.07] dark:bg-cyan-950/20'
                      : 'border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0c152e]/50 opacity-70 hover:opacity-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) =>
                      setPermValues((prev) => ({
                        ...prev,
                        [def.key]: e.target.checked,
                      }))
                    }
                    className="mt-0.5 h-4 w-4 rounded text-cyan-600 focus:ring-cyan-500 border-slate-300"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <def.icon className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                      <span>{def.label}</span>
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">{def.category}</p>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsPermModalOpen(false);
                setPermStaff(null);
              }}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="gold"
              onClick={handleSavePermissions}
              disabled={actionLoading}
            >
              {actionLoading ? 'Saving...' : 'Update Permissions'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ── 3. Reset Password Modal ─────────────────────────────────── */}
      <Dialog
        isOpen={isResetPassOpen}
        onClose={() => {
          setIsResetPassOpen(false);
          setResetStaff(null);
        }}
        title={`Reset Password: ${resetStaff?.name}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Set a custom password or auto-generate a secure random password for this staff account.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              New Password *
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter or generate password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pr-20"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                {newPassword && (
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="p-1 text-slate-400 hover:text-cyan-500"
                    title="Copy to clipboard"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGeneratePassword}
              className="text-xs font-bold"
            >
              <KeyRound className="w-3.5 h-3.5 mr-1" /> Generate Strong Password
            </Button>
            {copied && <span className="text-[11px] font-bold text-emerald-500">Copied to clipboard!</span>}
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsResetPassOpen(false);
                setResetStaff(null);
              }}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="gold"
              onClick={handleSaveResetPassword}
              disabled={actionLoading || !newPassword.trim() || newPassword.length < 6}
            >
              {actionLoading ? 'Updating...' : 'Set New Password'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ── 4. Account Status Toggle Confirmation ───────────────────── */}
      <ConfirmDialog
        isOpen={Boolean(statusConfirmStaff)}
        onCancel={() => setStatusConfirmStaff(null)}
        onConfirm={handleExecuteStatusToggle}
        title={statusConfirmStaff?.nextStatus === 'SUSPENDED' ? 'Suspend Staff Account' : 'Reactivate Staff Account'}
        description={
          statusConfirmStaff?.nextStatus === 'SUSPENDED'
            ? `Are you sure you want to suspend ${statusConfirmStaff.staff.name}? They will immediately lose access to the admin control panel.`
            : `Reactivate ${statusConfirmStaff?.staff.name}'s account and restore their administrative privileges?`
        }
        confirmLabel={statusConfirmStaff?.nextStatus === 'SUSPENDED' ? 'Suspend Account' : 'Reactivate'}
        variant={statusConfirmStaff?.nextStatus === 'SUSPENDED' ? 'danger' : 'default'}
      />

      {/* ── 5. Delete Account Confirmation ──────────────────────────── */}
      <ConfirmDialog
        isOpen={Boolean(deleteConfirmStaff)}
        onCancel={() => setDeleteConfirmStaff(null)}
        onConfirm={handleExecuteDelete}
        title="Delete Staff Account"
        description={`Are you sure you want to permanently delete ${deleteConfirmStaff?.name}'s staff account (${deleteConfirmStaff?.email})? This action cannot be undone.`}
        confirmLabel="Delete Staff"
        variant="danger"
      />
    </div>
  );
}
