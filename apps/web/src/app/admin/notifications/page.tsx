'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  Card,
  Input,
  Button,
  Badge,
  Select,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Pagination,
} from '@psc/ui';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Megaphone,
  Plus,
  Receipt,
  Search,
  Send,
  Sparkles,
  Trash2,
  Trophy,
  UploadCloud,
  Users,
  User as UserIcon,
  X,
} from 'lucide-react';
import type { PushStatus, SentNotification, User } from '@psc/shared-types';

import { ApiClient } from '../../../lib/api-client';
import { NotificationsPageSkeleton } from '../admin-skeleton';

const TITLE_MAX = 100;
const BODY_MAX = 500;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/** Mirrors the icon and colour the student app gives each kind. */
const TYPES = [
  { value: 'ANNOUNCEMENT', label: 'Announcement', icon: Megaphone, tone: 'text-sky-500', bg: 'bg-sky-500/10' },
  { value: 'BOOK', label: 'New book / study material', icon: BookOpen, tone: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  { value: 'QUIZ', label: 'Quiz', icon: Trophy, tone: 'text-amber-500', bg: 'bg-amber-500/10' },
  { value: 'MOCK_TEST', label: 'Mock test', icon: Trophy, tone: 'text-amber-500', bg: 'bg-amber-500/10' },
  { value: 'ORDER', label: 'Order / payment', icon: Receipt, tone: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { value: 'CHAT', label: 'Community', icon: MessageSquare, tone: 'text-indigo-500', bg: 'bg-indigo-500/10' },
] as const;

const notificationSchema = Yup.object({
  title: Yup.string().trim().max(TITLE_MAX, `Title must be ${TITLE_MAX} characters or fewer`).required('Notification title is required'),
  body: Yup.string().trim().max(BODY_MAX, `Message body must be ${BODY_MAX} characters or fewer`).required('Message body is required'),
  route: Yup.string()
    .trim()
    .test('shape', 'Use an in-app path like /books/123, or a full https:// link', (value) => {
      if (!value) return true;
      return value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://');
    }),
  imageUrl: Yup.string().nullable().optional(),
  userId: Yup.string().when('audience', {
    is: 'one',
    then: (schema) => schema.required('Pick the student this notification is for'),
    otherwise: (schema) => schema.optional().nullable(),
  }),
  audience: Yup.string().oneOf(['all', 'one']).required(),
  isScheduled: Yup.boolean(),
  scheduledDate: Yup.string().when('isScheduled', {
    is: true,
    then: (schema) =>
      schema
        .required('Please select a schedule date & time')
        .test('is-future', 'Schedule date & time must be in the future', (val) => {
          if (!val) return false;
          return new Date(val).getTime() > Date.now();
        }),
    otherwise: (schema) => schema.optional().nullable(),
  }),
});

export default function AdminNotificationsPage() {
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [sent, setSent] = useState<SentNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [sentFailed, setSentFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Table filters, search & pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'SENT' | 'SCHEDULED'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Create Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [previewNotification, setPreviewNotification] = useState<SentNotification | null>(null);

  // Delete Target state
  const [deleteTarget, setDeleteTarget] = useState<SentNotification | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Student picker state
  const [studentQuery, setStudentQuery] = useState('');
  const [studentResults, setStudentResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);

  // Image Upload state
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{ width?: number; height?: number; fileName?: string } | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setSuccessToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setSuccessToast(null), 4000);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [statusRes, sentRes] = await Promise.allSettled([
      ApiClient.getPushStatus(),
      ApiClient.listSentNotifications(100),
    ]);
    if (statusRes.status === 'fulfilled') setStatus(statusRes.value);
    setSentFailed(sentRes.status === 'rejected');
    if (sentRes.status === 'fulfilled') setSent(sentRes.value || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    setMounted(true);
    loadData();
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [loadData]);

  const formik = useFormik({
    initialValues: {
      title: '',
      body: '',
      type: 'ANNOUNCEMENT',
      route: '',
      imageUrl: '',
      audience: 'all',
      userId: '',
      isScheduled: false,
      scheduledDate: '',
    },
    validationSchema: notificationSchema,
    onSubmit: async (values, { resetForm }) => {
      setErrorMessage(null);
      try {
        const scheduledFor =
          values.isScheduled && values.scheduledDate
            ? new Date(values.scheduledDate).toISOString()
            : undefined;

        await ApiClient.sendNotification({
          title: values.title.trim(),
          body: values.body.trim(),
          type: values.type,
          route: values.route?.trim() || undefined,
          imageUrl: values.imageUrl?.trim() || undefined,
          userId: values.audience === 'one' ? values.userId : undefined,
          scheduledFor,
        });

        if (scheduledFor) {
          showToast(
            `Notification scheduled for ${new Date(values.scheduledDate).toLocaleString([], {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}.`,
          );
        } else {
          showToast(
            values.audience === 'one'
              ? `Notification queued for ${selectedStudent?.name || 'the selected student'}.`
              : 'Broadcast queued for every student.',
          );
        }

        resetForm();
        setSelectedStudent(null);
        setStudentQuery('');
        setStudentResults([]);
        setImageMeta(null);
        setImageUploadError(null);
        setIsCreateModalOpen(false);
        await loadData();
      } catch (err: any) {
        setErrorMessage(err?.message || 'Could not send this notification.');
      }
    },
  });

  const handleDeleteNotification = async (id: string) => {
    try {
      setIsDeleting(true);
      await ApiClient.deleteNotification(id);
      setDeleteTarget(null);
      showToast('Notification deleted successfully.');
      await loadData();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to delete notification.');
    } finally {
      setIsDeleting(false);
    }
  };

  const setSchedulePreset = (hoursFromNow: number) => {
    const d = new Date(Date.now() + hoursFromNow * 3600 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const str = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    formik.setFieldValue('scheduledDate', str);
    formik.setFieldValue('isScheduled', true);
  };

  const setScheduleTomorrow = (hour24: number) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(hour24, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    const str = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    formik.setFieldValue('scheduledDate', str);
    formik.setFieldValue('isScheduled', true);
  };

  const handleImageFile = async (file: File) => {
    setImageUploadError(null);

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setImageUploadError('Invalid format. Please upload a JPG, PNG, or WEBP image.');
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setImageUploadError(`File is too large (${sizeMB}MB). Maximum allowed size is 5MB.`);
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      setImageMeta({ width: img.naturalWidth, height: img.naturalHeight, fileName: file.name });
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;

    try {
      setIsUploadingImage(true);
      const res = await ApiClient.uploadNotificationImage(file);
      if (res?.url) {
        formik.setFieldValue('imageUrl', res.url);
      }
    } catch (err: any) {
      setImageUploadError(err?.message || 'Failed to upload image. Please try again.');
      setImageMeta(null);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const removeImage = () => {
    formik.setFieldValue('imageUrl', '');
    setImageMeta(null);
    setImageUploadError(null);
  };

  // Debounced student search
  useEffect(() => {
    if (formik.values.audience !== 'one') return;
    const q = studentQuery.trim();
    if (q.length < 2) {
      setStudentResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await ApiClient.getUsers({ search: q, limit: 8 });
        const list: User[] = Array.isArray(res) ? res : res?.data || [];
        setStudentResults(list);
      } catch {
        setStudentResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [studentQuery, formik.values.audience]);

  const selectAudience = (audience: 'all' | 'one') => {
    formik.setFieldValue('audience', audience);
    if (audience === 'all') {
      formik.setFieldValue('userId', '');
      setSelectedStudent(null);
    }
  };

  const pickStudent = (student: User) => {
    setSelectedStudent(student);
    formik.setFieldValue('userId', student.id);
    setStudentResults([]);
    setStudentQuery('');
  };

  const activeType = useMemo(
    () => TYPES.find((t) => t.value === formik.values.type) || TYPES[0],
    [formik.values.type],
  );

  const scheduledCount = useMemo(
    () =>
      sent.filter(
        (n) =>
          n.status === 'SCHEDULED' ||
          (n.scheduledFor && new Date(n.scheduledFor).getTime() > Date.now()),
      ).length,
    [sent],
  );
  const sentCount = useMemo(
    () => sent.length - scheduledCount,
    [sent, scheduledCount],
  );

  // Filtered sent & scheduled notifications
  const filteredSent = useMemo(() => {
    return sent.filter((item) => {
      const isItemScheduled =
        item.status === 'SCHEDULED' ||
        (item.scheduledFor && new Date(item.scheduledFor).getTime() > Date.now());

      const matchesStatus =
        selectedStatusFilter === 'ALL' ||
        (selectedStatusFilter === 'SCHEDULED' && isItemScheduled) ||
        (selectedStatusFilter === 'SENT' && !isItemScheduled);

      const matchesSearch =
        searchQuery.trim() === '' ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.user?.name && item.user.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.user?.email && item.user.email.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesType =
        selectedTypeFilter === 'ALL' || (item.type || 'ANNOUNCEMENT').toUpperCase() === selectedTypeFilter;

      return matchesStatus && matchesSearch && matchesType;
    });
  }, [sent, searchQuery, selectedTypeFilter, selectedStatusFilter]);

  const totalPages = Math.ceil(filteredSent.length / pageSize) || 1;
  const paginatedSent = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSent.slice(start, start + pageSize);
  }, [filteredSent, currentPage, pageSize]);

  if (!mounted || (loading && sent.length === 0)) {
    return <NotificationsPageSkeleton />;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4 rounded-b-2xl w-full px-1 sm:px-0">
      {/* Header */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Bell className="w-7 h-7 text-cyan-500" />
            Push Notifications
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">
            Manage sent notifications and broadcast rich 16:9 banner messages to all student devices.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DeliveryChip status={status} />
          <Button
            onClick={() => {
              setErrorMessage(null);
              setIsCreateModalOpen(true);
            }}
            variant="gold"
            size="md"
            className="font-bold shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create Notification
          </Button>
        </div>
      </div>

      {status && !status.configured && (
        <div className="shrink-0 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
          <span className="font-extrabold">Push delivery is not configured.</span> Notifications you send are saved
          and appear in the student app&apos;s notifications screen, but no push reaches a phone until the API has
          its <code className="font-mono">FIREBASE_*</code> credentials.
        </div>
      )}

      {/* Filter, Search & Full-Width Table Card */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border border-slate-200 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] admin-table-card p-0">
        <div className="shrink-0 p-4 sm:p-5 border-b border-slate-200/80 dark:border-[#1e2e56]">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  className="w-full pl-10 pr-4 py-2 glass-input text-xs sm:text-sm font-medium focus:ring-cyan-500/50"
                  placeholder="Search notifications by title, body, or recipient…"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              {/* Status Tabs (All / Sent / Scheduled) */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-[#0c152e] rounded-xl border border-slate-200/80 dark:border-[#1e2e56] shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStatusFilter('ALL');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                    selectedStatusFilter === 'ALL'
                      ? 'bg-white dark:bg-[#1a2b58] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  All ({sent.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStatusFilter('SENT');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedStatusFilter === 'SENT'
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-emerald-500'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Sent ({sentCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStatusFilter('SCHEDULED');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedStatusFilter === 'SCHEDULED'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-amber-500'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Scheduled ({scheduledCount})</span>
                </button>
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedTypeFilter('ALL');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                  selectedTypeFilter === 'ALL'
                    ? 'bg-cyan-500 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-[#111c3a] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#1a2b58]'
                }`}
              >
                All Categories
              </button>
              {TYPES.map((t) => {
                const count = sent.filter((item) => (item.type || 'ANNOUNCEMENT').toUpperCase() === t.value).length;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      setSelectedTypeFilter(t.value);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                      selectedTypeFilter === t.value
                        ? 'bg-cyan-500 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-[#111c3a] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#1a2b58]'
                    }`}
                  >
                    {t.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>

        {/* Table of Sent & Scheduled Notifications */}
        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 custom-scrollbar">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-[#091124]">
                <TableHead className="w-24">Banner</TableHead>
                <TableHead className="min-w-[220px]">Title & Message</TableHead>
                <TableHead className="w-32">Category</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="w-40">Target Audience</TableHead>
                <TableHead className="w-36">Action Route</TableHead>
                <TableHead className="w-32">Sent By</TableHead>
                <TableHead className="w-32">Schedule / Date</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeletonRows rows={5} />
              ) : sentFailed ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-48 text-center text-amber-500">
                    Could not load sent notifications from server.
                  </TableCell>
                </TableRow>
              ) : paginatedSent.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-56 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#111c3a] grid place-items-center text-slate-400">
                        <Bell className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No notifications found</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {searchQuery
                            ? 'No notifications match your search query.'
                            : 'Create your first push notification to get started.'}
                        </p>
                      </div>
                      {!searchQuery && (
                        <Button
                          onClick={() => setIsCreateModalOpen(true)}
                          variant="gold"
                          size="sm"
                          className="font-bold mt-1 shadow-md shadow-amber-500/20"
                        >
                          <Plus className="w-4 h-4 mr-1.5" />
                          Create Notification
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedSent.map((item) => {
                  const typeObj =
                    TYPES.find((t) => t.value === (item.type || 'ANNOUNCEMENT').toUpperCase()) || TYPES[0];
                  const Icon = typeObj.icon;
                  const isItemScheduled =
                    item.status === 'SCHEDULED' ||
                    (item.scheduledFor && new Date(item.scheduledFor).getTime() > Date.now());

                  return (
                    <TableRow
                      key={item.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-[#0f1a36]/60 transition-colors"
                    >
                      {/* Banner thumbnail */}
                      <TableCell>
                        {item.imageUrl ? (
                          <div
                            onClick={() => setPreviewNotification(item)}
                            className="w-20 aspect-video rounded-lg overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer group relative shadow-2xs"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center">
                              <Eye className="w-3.5 h-3.5 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className={`w-12 h-12 rounded-xl ${typeObj.bg} grid place-items-center ${typeObj.tone}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                        )}
                      </TableCell>

                      {/* Title & Body */}
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">{item.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                            {item.body}
                          </p>
                        </div>
                      </TableCell>

                      {/* Category Badge */}
                      <TableCell>
                        <Badge variant="default" className="text-[10px] font-bold">
                          {typeObj.label}
                        </Badge>
                      </TableCell>

                      {/* Status Badge */}
                      <TableCell>
                        {isItemScheduled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[11px] font-extrabold shadow-2xs">
                            <Clock className="w-3 h-3 shrink-0 animate-pulse" />
                            <span>Scheduled</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[11px] font-extrabold shadow-2xs">
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                            <span>Sent</span>
                          </span>
                        )}
                      </TableCell>

                      {/* Target Audience */}
                      <TableCell>
                        {item.user ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 font-bold text-[10px] grid place-items-center shrink-0">
                              {item.user.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                {item.user.name}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">{item.user.email}</p>
                            </div>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-bold flex items-center gap-1 w-fit">
                            <Users className="w-3 h-3 text-cyan-500" />
                            ALL STUDENTS
                          </Badge>
                        )}
                      </TableCell>

                      {/* Action Route */}
                      <TableCell>
                        {item.route ? (
                          <span
                            className="inline-flex items-center gap-1 font-mono text-[11px] text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md truncate max-w-[150px]"
                            title={item.route}
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate">{item.route}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </TableCell>

                      {/* Sent By */}
                      <TableCell>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {item.sentBy?.name || 'Admin'}
                        </span>
                      </TableCell>

                      {/* Schedule / Date */}
                      <TableCell>
                        <div className="space-y-0.5">
                          <p
                            className={`text-xs font-bold ${
                              isItemScheduled ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {new Date(item.scheduledFor || item.createdAt).toLocaleDateString(undefined, {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                          <p className="text-[10px] font-mono text-slate-400">
                            {new Date(item.scheduledFor || item.createdAt).toLocaleTimeString(undefined, {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setPreviewNotification(item)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e2e56] text-slate-500 hover:text-cyan-500 transition-colors cursor-pointer"
                            title="View notification details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                            title="Delete notification"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination & Per Page Input */}
        {filteredSent.length > 0 && (
          <div className="shrink-0 px-4 sm:px-6 py-3 border-t border-slate-200/80 dark:border-[#1e2e56] bg-slate-50/40 dark:bg-[#091124]/40">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredSent.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
              pageSizeOptions={[5, 10, 20, 50]}
              className="border-t-0 pt-0"
            />
          </div>
        )}
      </Card>

      {/* CREATE NOTIFICATION MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200 !mt-0">
          <div
            className="relative w-full max-w-4xl bg-white dark:bg-[#0c152e] border border-slate-200 dark:border-[#1e2e56] rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#1e2e56] shrink-0 bg-slate-50/50 dark:bg-[#091124]/50">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Send className="w-5 h-5 text-cyan-500" />
                  Compose Push Notification
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Broadcast rich notifications with 16:9 YouTube thumbnail banners to all devices.
                </p>
              </div>
              <button
                type="button"
                disabled={formik.isSubmitting || isUploadingImage}
                onClick={() => !formik.isSubmitting && !isUploadingImage && setIsCreateModalOpen(false)}
                className={`p-2 rounded-xl transition-colors ${formik.isSubmitting || isUploadingImage ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1e2e56] cursor-pointer'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className={`p-6 overflow-y-auto space-y-6 flex-1 ${formik.isSubmitting || isUploadingImage ? 'pointer-events-none opacity-80 cursor-wait select-none' : ''}`}>
              <fieldset disabled={formik.isSubmitting || isUploadingImage} className="contents disabled:pointer-events-none">
              {errorMessage && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs sm:text-sm font-semibold text-rose-800 dark:text-rose-300">
                  {errorMessage}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
                {/* Form column */}
                <form id="notification-form" onSubmit={formik.handleSubmit} className="space-y-4" noValidate>
                  {/* Audience */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Audience
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <AudienceButton
                        active={formik.values.audience === 'all'}
                        onClick={() => selectAudience('all')}
                        icon={<Users className="w-4 h-4" />}
                        title="All students"
                        subtitle="Broadcast to every device"
                      />
                      <AudienceButton
                        active={formik.values.audience === 'one'}
                        onClick={() => selectAudience('one')}
                        icon={<UserIcon className="w-4 h-4" />}
                        title="One student"
                        subtitle="Only their devices"
                      />
                    </div>
                  </div>

                  {formik.values.audience === 'one' && (
                    <div className="space-y-2">
                      {selectedStudent ? (
                        <div className="flex items-center gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2.5">
                          <div className="w-8 h-8 rounded-full bg-cyan-500/20 grid place-items-center text-xs font-black text-cyan-700 dark:text-cyan-300 shrink-0">
                            {selectedStudent.name?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{selectedStudent.name}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{selectedStudent.email}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStudent(null);
                              formik.setFieldValue('userId', '');
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            aria-label="Clear selected student"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          <input
                            className="w-full pl-9 pr-9 py-2.5 glass-input text-xs sm:text-sm font-medium focus:ring-cyan-500/50"
                            placeholder="Search students by name or email…"
                            value={studentQuery}
                            onChange={(e) => setStudentQuery(e.target.value)}
                          />
                          {searching && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500 animate-spin" />
                          )}
                          {studentResults.length > 0 && (
                            <div className="absolute z-20 mt-1.5 w-full rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-white dark:bg-[#0c152e] shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                              {studentResults.map((student) => (
                                <button
                                  key={student.id}
                                  type="button"
                                  onClick={() => pickStudent(student)}
                                  className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-[#111c3a] transition-colors cursor-pointer"
                                >
                                  <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-[#1e2e56] grid place-items-center text-[11px] font-black text-slate-600 dark:text-slate-300 shrink-0">
                                    {student.name?.charAt(0).toUpperCase() || '?'}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{student.name}</p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{student.email}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                          {studentQuery.trim().length >= 2 && !searching && studentResults.length === 0 && (
                            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">No students matched that search.</p>
                          )}
                        </div>
                      )}
                      {formik.touched.userId && formik.errors.userId && (
                        <p className="text-xs text-rose-500 font-medium">{formik.errors.userId}</p>
                      )}
                    </div>
                  )}

                  <Select
                    label="Category"
                    options={TYPES.map((t) => ({ value: t.value, label: t.label }))}
                    value={formik.values.type}
                    onChange={(value) => formik.setFieldValue('type', value)}
                    helperText="Sets the icon and colour the student app shows next to the message."
                  />

                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Notification Title
                      </label>
                      <Counter value={formik.values.title.length} max={TITLE_MAX} />
                    </div>
                    <Input
                      name="title"
                      placeholder="New Live Mock Test is Live!"
                      maxLength={TITLE_MAX}
                      value={formik.values.title}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      error={formik.touched.title && formik.errors.title ? formik.errors.title : undefined}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Message Body
                      </label>
                      <Counter value={formik.values.body.length} max={BODY_MAX} />
                    </div>
                    <textarea
                      name="body"
                      className="w-full h-24 px-3.5 py-2.5 glass-input text-xs sm:text-sm font-medium focus:ring-cyan-500/50"
                      placeholder="Join 1,000+ aspirants taking the Kerala PSC LDC Mock Test right now..."
                      maxLength={BODY_MAX}
                      value={formik.values.body}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                    />
                    {formik.touched.body && formik.errors.body && (
                      <p className="text-xs text-rose-500 font-medium">{formik.errors.body}</p>
                    )}
                  </div>

                  {/* 16:9 Thumbnail Banner Image Upload (YouTube Style) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Notification Banner Image (Optional)
                      </label>
                      <span className="text-[11px] text-cyan-600 dark:text-cyan-400 font-semibold">
                        16:9 YouTube Thumbnail (Max 5MB)
                      </span>
                    </div>

                    <ImageDropzone
                      imageUrl={formik.values.imageUrl}
                      isUploading={isUploadingImage}
                      error={imageUploadError}
                      imageMeta={imageMeta}
                      onFileSelected={handleImageFile}
                      onRemove={removeImage}
                    />
                  </div>

                  <Input
                    label="Opens (optional)"
                    name="route"
                    placeholder="/books/9f2c…  or  https://psctipsandtricks.com/offer"
                    value={formik.values.route}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    helperText="Where tapping the notification lands. Leave blank to open the notifications screen."
                    error={formik.touched.route && formik.errors.route ? formik.errors.route : undefined}
                  />

                  {/* Delivery Timing (Immediate vs Scheduled) */}
                  <div className="p-4 rounded-2xl border border-slate-200/90 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#0c152e]/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Delivery Timing
                      </label>
                      <span className="text-[11px] font-bold text-amber-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formik.values.isScheduled ? 'Scheduled Dispatch' : 'Immediate Dispatch'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          formik.setFieldValue('isScheduled', false);
                          formik.setFieldValue('scheduledDate', '');
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                          !formik.values.isScheduled
                            ? 'border-cyan-500/80 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 shadow-xs'
                            : 'border-slate-200 dark:border-[#1e2e56] bg-white dark:bg-[#091124] text-slate-700 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        <Send className="w-4 h-4 shrink-0" />
                        <div>
                          <span className="block text-xs font-extrabold">Send Now</span>
                          <span className="block text-[10px] text-slate-400">Broadcast right away</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          formik.setFieldValue('isScheduled', true);
                          if (!formik.values.scheduledDate) {
                            setSchedulePreset(1);
                          }
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                          formik.values.isScheduled
                            ? 'border-amber-500/80 bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-xs'
                            : 'border-slate-200 dark:border-[#1e2e56] bg-white dark:bg-[#091124] text-slate-700 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        <Clock className="w-4 h-4 shrink-0" />
                        <div>
                          <span className="block text-xs font-extrabold">Schedule Later</span>
                          <span className="block text-[10px] text-slate-400">Pick date & time</span>
                        </div>
                      </button>
                    </div>

                    {formik.values.isScheduled && (
                      <div className="pt-2 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
                          <input
                            type="datetime-local"
                            name="scheduledDate"
                            min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                            value={formik.values.scheduledDate}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            className="flex-1 px-3.5 py-2 glass-input text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:ring-amber-500/50"
                          />
                        </div>

                        {formik.touched.scheduledDate && formik.errors.scheduledDate && (
                          <p className="text-xs text-rose-500 font-semibold">{formik.errors.scheduledDate}</p>
                        )}

                        {/* Quick presets */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          <span className="text-[10px] font-bold text-slate-400 mr-1">Quick pick:</span>
                          <button
                            type="button"
                            onClick={() => setSchedulePreset(1)}
                            className="px-2 py-1 rounded-md text-[10px] font-bold bg-white dark:bg-[#132044] border border-slate-200 dark:border-[#1e2e56] hover:border-amber-500/40 text-slate-600 dark:text-slate-300 cursor-pointer"
                          >
                            +1 Hour
                          </button>
                          <button
                            type="button"
                            onClick={() => setSchedulePreset(3)}
                            className="px-2 py-1 rounded-md text-[10px] font-bold bg-white dark:bg-[#132044] border border-slate-200 dark:border-[#1e2e56] hover:border-amber-500/40 text-slate-600 dark:text-slate-300 cursor-pointer"
                          >
                            +3 Hours
                          </button>
                          <button
                            type="button"
                            onClick={() => setScheduleTomorrow(9)}
                            className="px-2 py-1 rounded-md text-[10px] font-bold bg-white dark:bg-[#132044] border border-slate-200 dark:border-[#1e2e56] hover:border-amber-500/40 text-slate-600 dark:text-slate-300 cursor-pointer"
                          >
                            Tomorrow 9 AM
                          </button>
                          <button
                            type="button"
                            onClick={() => setScheduleTomorrow(18)}
                            className="px-2 py-1 rounded-md text-[10px] font-bold bg-white dark:bg-[#132044] border border-slate-200 dark:border-[#1e2e56] hover:border-amber-500/40 text-slate-600 dark:text-slate-300 cursor-pointer"
                          >
                            Tomorrow 6 PM
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </form>

                {/* Right side live phone preview */}
                <div className="space-y-3 sticky top-0">
                  <PhonePreview
                    title={formik.values.title}
                    body={formik.values.body}
                    type={activeType}
                    route={formik.values.route}
                    imageUrl={formik.values.imageUrl}
                  />
                </div>
              </div>
              </fieldset>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#091124]/50 shrink-0">
              <Button
                type="button"
                variant="outline"
                disabled={formik.isSubmitting || isUploadingImage}
                onClick={() => setIsCreateModalOpen(false)}
                className="font-bold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="notification-form"
                variant="gold"
                size="md"
                className="font-bold shadow-md shadow-amber-500/20 cursor-pointer"
                isLoading={formik.isSubmitting || isUploadingImage}
              >
                {formik.values.isScheduled ? (
                  <>
                    <Clock className="w-4 h-4 mr-2" />
                    Schedule Notification
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    {formik.values.audience === 'one' ? 'Send to this student' : 'Broadcast to all students'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW DETAILS MODAL */}
      {previewNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 !mt-0">
          <div
            className="relative w-full max-w-lg bg-white dark:bg-[#0c152e] border border-slate-200 dark:border-[#1e2e56] rounded-3xl shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-500" />
                Notification Details
              </h3>
              <button
                type="button"
                onClick={() => setPreviewNotification(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1e2e56] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {previewNotification.imageUrl && (
              <div className="w-full aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-inner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewNotification.imageUrl}
                  alt={previewNotification.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-base font-black text-slate-900 dark:text-white">{previewNotification.title}</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {previewNotification.body}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-slate-100 dark:border-[#1e2e56]">
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Category</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {(previewNotification.type || 'ANNOUNCEMENT').replace('_', ' ')}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Status</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                  {previewNotification.status === 'SCHEDULED' ||
                  (previewNotification.scheduledFor && new Date(previewNotification.scheduledFor).getTime() > Date.now()) ? (
                    <span className="text-amber-500 font-extrabold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Scheduled
                    </span>
                  ) : (
                    <span className="text-emerald-500 font-extrabold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Sent
                    </span>
                  )}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Target</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {previewNotification.user ? previewNotification.user.name : 'All students'}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Opens Route</span>
                <span className="font-mono text-cyan-600 dark:text-cyan-400 font-semibold truncate block">
                  {previewNotification.route || 'Notifications screen'}
                </span>
              </div>
              <div className="col-span-2">
                <span className="block text-[10px] font-bold text-slate-400 uppercase">
                  {previewNotification.status === 'SCHEDULED' ? 'Scheduled Delivery' : 'Sent Date & Time'}
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {new Date(previewNotification.scheduledFor || previewNotification.createdAt).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button
                onClick={() => {
                  const target = previewNotification;
                  setPreviewNotification(null);
                  setDeleteTarget(target);
                }}
                variant="danger"
                size="sm"
                className="font-bold cursor-pointer inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </Button>
              <Button
                onClick={() => setPreviewNotification(null)}
                variant="outline"
                size="sm"
                className="font-bold cursor-pointer"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 !mt-0">
          <div
            className="relative w-full max-w-md bg-white dark:bg-[#0c152e] border border-slate-200 dark:border-[#1e2e56] rounded-3xl shadow-2xl p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shrink-0 shadow-inner">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Delete Notification?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Are you sure you want to delete <strong className="text-slate-900 dark:text-white">&ldquo;{deleteTarget.title}&rdquo;</strong>?
                  {deleteTarget.status === 'SCHEDULED' && (
                    <span className="block text-amber-500 mt-1 font-semibold">
                      This will cancel the scheduled broadcast before it is sent.
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#1e2e56]">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                className="font-bold cursor-pointer"
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => handleDeleteNotification(deleteTarget.id)}
                className="font-black cursor-pointer shadow-md shadow-rose-500/20"
                isLoading={isDeleting}
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Delete Notification
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 backdrop-blur px-4 py-3 text-sm font-bold text-emerald-800 dark:text-emerald-200 shadow-xl">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          {successToast}
        </div>
      )}
    </div>
  );
}

/** Table Skeleton Rows for clean loading state */
function TableSkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i} className="animate-pulse">
          <TableCell className="py-2.5">
            <div className="w-16 aspect-video rounded-lg bg-slate-200 dark:bg-[#1a2b58]" />
          </TableCell>
          <TableCell className="py-2.5">
            <div className="space-y-1.5">
              <div className="h-3.5 w-36 bg-slate-200 dark:bg-[#1a2b58] rounded" />
              <div className="h-2.5 w-48 bg-slate-100 dark:bg-[#132044] rounded" />
            </div>
          </TableCell>
          <TableCell className="py-2.5">
            <div className="h-5 w-20 bg-slate-200 dark:bg-[#1a2b58] rounded-full" />
          </TableCell>
          <TableCell className="py-2.5">
            <div className="h-5 w-24 bg-slate-200 dark:bg-[#1a2b58] rounded-full" />
          </TableCell>
          <TableCell className="py-2.5">
            <div className="h-4 w-20 bg-slate-100 dark:bg-[#132044] rounded" />
          </TableCell>
          <TableCell className="py-2.5">
            <div className="h-3.5 w-14 bg-slate-200 dark:bg-[#1a2b58] rounded" />
          </TableCell>
          <TableCell className="py-2.5">
            <div className="space-y-1">
              <div className="h-3 w-14 bg-slate-200 dark:bg-[#1a2b58] rounded" />
              <div className="h-2 w-10 bg-slate-100 dark:bg-[#132044] rounded" />
            </div>
          </TableCell>
          <TableCell className="py-2.5 text-right">
            <div className="h-5 w-5 bg-slate-200 dark:bg-[#1a2b58] rounded-lg ml-auto" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}



/** Drag & Drop Image Uploader with 16:9 Aspect Ratio preview and file validation */
function ImageDropzone({
  imageUrl,
  isUploading,
  error,
  imageMeta,
  onFileSelected,
  onRemove,
}: {
  imageUrl?: string;
  isUploading: boolean;
  error: string | null;
  imageMeta: { width?: number; height?: number; fileName?: string } | null;
  onFileSelected: (file: File) => void;
  onRemove: () => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      onFileSelected(files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelected(files[0]);
    }
  };

  if (imageUrl) {
    return (
      <div className="relative rounded-2xl border border-slate-200 dark:border-[#1e2e56] bg-slate-50 dark:bg-[#0c152e] p-2 space-y-1.5">
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 shadow-inner group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Push notification banner"
            className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur text-[10px] font-bold text-white uppercase tracking-wider">
              <ImageIcon className="w-3 h-3 text-cyan-400" />
              16:9 Thumbnail {imageMeta?.width && imageMeta?.height ? `· ${imageMeta.width}×${imageMeta.height}` : ''}
            </span>
            <button
              type="button"
              onClick={onRemove}
              className="p-1.5 rounded-lg bg-rose-500/80 hover:bg-rose-600 text-white shadow-md transition-all cursor-pointer"
              title="Remove image"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-2xl transition-all cursor-pointer text-center ${isDragOver
          ? 'border-cyan-500 bg-cyan-500/10 scale-[1.01]'
          : 'border-slate-300 dark:border-[#1e2e56] hover:border-cyan-500/50 bg-slate-50/50 dark:bg-[#091124]/50'
          }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleInputChange}
          disabled={isUploading}
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Uploading banner image…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-1">
            <div className="w-8 h-8 rounded-full bg-cyan-500/10 dark:bg-cyan-500/20 grid place-items-center text-cyan-500">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Drag & drop 16:9 thumbnail, or <span className="text-cyan-500 underline">browse</span>
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                JPG, PNG, WEBP up to 5MB (1280×720 recommended)
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-rose-500 font-medium px-1">{error}</p>
      )}
    </div>
  );
}

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <span className={`text-[10px] font-mono font-bold ${value > max * 0.9 ? 'text-amber-500' : 'text-slate-400'}`}>
      {value}/{max}
    </span>
  );
}

function AudienceButton({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-left transition-all cursor-pointer ${active
        ? 'border-cyan-500/50 bg-cyan-500/10 shadow-2xs'
        : 'border-slate-200 dark:border-[#1e2e56] hover:border-slate-300 dark:hover:border-[#2a3d6e]'
        }`}
    >
      <span className={active ? 'text-cyan-500 mt-0.5' : 'text-slate-400 mt-0.5'}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs font-bold text-slate-900 dark:text-white">{title}</span>
        <span className="block text-[10px] text-slate-500 dark:text-slate-400">{subtitle}</span>
      </span>
    </button>
  );
}

function DeliveryChip({ status }: { status: PushStatus | null }) {
  if (!status) return null;
  if (!status.configured) {
    return <Badge variant="warning">FCM NOT CONFIGURED</Badge>;
  }
  return (
    <div className="flex items-center gap-2">
      <Badge variant="success">FCM READY</Badge>
      <Badge variant="outline">
        {status.devices} {status.devices === 1 ? 'DEVICE' : 'DEVICES'} · {status.students} SIGNED IN
      </Badge>
    </div>
  );
}

/** Live phone tray preview */
function PhonePreview({
  title,
  body,
  type,
  route,
  imageUrl,
}: {
  title: string;
  body: string;
  type: (typeof TYPES)[number];
  route: string;
  imageUrl?: string;
}) {
  const Icon = type.icon;
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-[#1e2e56] bg-slate-50 dark:bg-[#091124] p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono font-bold tracking-wider text-slate-400">LIVE PREVIEW</p>
        <span className="text-[9px] font-mono text-cyan-500 font-bold">Android & iOS Tray</span>
      </div>

      <div className="rounded-xl bg-white dark:bg-[#0c152e] border border-slate-200 dark:border-[#1e2e56] p-3 shadow-2xs space-y-2">
        <div className="flex items-center gap-1.5">
          <Bell className="w-3 h-3 text-slate-400" />
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">PSC Tips And Tricks</span>
          <span className="text-[10px] text-slate-400">· now</span>
        </div>

        <div className="flex items-start gap-2">
          <span className={`mt-0.5 shrink-0 ${type.tone}`}>
            <Icon className="w-3.5 h-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-900 dark:text-white break-words">
              {title.trim() || 'Notification title'}
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 break-words line-clamp-3">
              {body.trim() || 'The message body appears here.'}
            </p>
          </div>
        </div>

        {/* 16:9 Expanded BigPicture Thumbnail */}
        {imageUrl && (
          <div className="w-full aspect-video rounded-lg overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Notification banner preview"
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
        Tapping opens <code className="font-mono font-bold">{route.trim() || '/notifications'}</code>
      </p>
    </div>
  );
}
