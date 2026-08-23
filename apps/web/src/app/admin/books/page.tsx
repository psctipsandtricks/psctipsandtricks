'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button, Dialog, ConfirmDialog, Input, ToggleSwitch, Badge, Pagination, Skeleton, Select, FileDropZone } from '@psc/ui';
import { AdminSkeletonHeader, AdminSkeletonTable } from '../admin-skeleton';
import { Edit3, Trash2, BookOpen, Library, ImagePlus, Eye, Gift, CheckCircle2, UploadCloud, X, ExternalLink, FileText, Clock, Music, Volume2, AlertCircle } from 'lucide-react';
import { Book, BOOK_SUBSCRIPTION_DURATIONS_LIST, formatSubscriptionDuration } from '@psc/shared-types';
import { ApiClient } from '@/lib/api-client';
import { validateCatalogCover, validateHeroCover } from '@/lib/image-validation';

const SecurePdfViewer = dynamic(
  () => import('@/components/secure-pdf-viewer').then((mod) => mod.SecurePdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center p-12 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500 mb-3" />
        <p className="text-xs font-bold font-mono">Loading PDF Preview…</p>
      </div>
    ),
  }
);

const MAX_PDF_BYTES = 50 * 1024 * 1024;
const MAX_AUDIO_BYTES = 45 * 1024 * 1024;

function formatFileSize(bytes?: number | null): string | null {
  if (!bytes) return null;
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const currentYear = new Date().getFullYear();

const SUBSCRIPTION_TYPES = [
  { value: 'FULL_TIME_ACCESS', label: 'Full Time Access' },
  { value: 'SUBSCRIPTION', label: 'Subscription' },
] as const;

const SUBSCRIPTION_DURATIONS = BOOK_SUBSCRIPTION_DURATIONS_LIST;

const bookSchema = Yup.object({
  title: Yup.string().trim().required('Book title is required'),
  author: Yup.string().trim().required('Author name is required'),
  description: Yup.string().trim().required('Description is required'),
  category: Yup.string().trim().required('Category is required'),
  isFree: Yup.boolean(),
  price: Yup.mixed().when('isFree', {
    is: true,
    then: () => Yup.number().nullable().notRequired(),
    otherwise: () =>
      Yup.number()
        .typeError('Price must be a number')
        .min(0, 'Price cannot be negative')
        .required('Price is required'),
  }),
  discountPercent: Yup.number()
    .typeError('Discount must be a number')
    .min(0, 'Cannot be negative')
    .max(100, 'Cannot exceed 100%')
    .nullable()
    .notRequired(),
  publicationYear: Yup.number()
    .typeError('Publication year must be a number')
    .integer('Enter a four-digit year')
    .min(1800, 'Enter a valid year')
    .max(currentYear + 5, 'Year is too far in the future'),
  subscriptionType: Yup.string().required('Subscription type is required'),
  subscriptionDuration: Yup.string().when('subscriptionType', {
    is: 'SUBSCRIPTION',
    then: (schema) => schema.required('Subscription duration is required'),
    otherwise: (schema) => schema.notRequired().nullable(),
  }),
});

const emptyValues = {
  title: '',
  author: '',
  description: '',
  category: '',
  price: '0',
  discountPercent: '0',
  publicationYear: String(currentYear),
  productId: '',
  appleId: '',
  basePlanId: '',
  subscriptionType: 'FULL_TIME_ACCESS',
  subscriptionDuration: '1_MONTH',
  isFree: false,
  isPublished: true,
  visibleToGuests: false,
};

/** Mirrors the server's own rule in books.service.ts so the admin sees the exact number that will be charged. */
function computeFinalPrice(price: string, discountPercent: string) {
  const p = Math.max(0, Number(price) || 0);
  const d = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  return Math.round(p - (p * d) / 100);
}

export default function AdminBooksPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState<Book[]>([]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverDimensions, setCoverDimensions] = useState<{ width: number; height: number } | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [isValidatingCover, setIsValidatingCover] = useState(false);

  const [heroCoverFile, setHeroCoverFile] = useState<File | null>(null);
  const [heroCoverDimensions, setHeroCoverDimensions] = useState<{ width: number; height: number } | null>(null);
  const [heroCoverError, setHeroCoverError] = useState<string | null>(null);
  const [isValidatingHeroCover, setIsValidatingHeroCover] = useState(false);
  const [removeExistingHeroCover, setRemoveExistingHeroCover] = useState(false);

  const [previewPdfFile, setPdfPreviewFile] = useState<File | null>(null);
  const [removeExistingPreviewPdf, setRemoveExistingPreviewPdf] = useState(false);
  const [pdfUploadPercent, setPdfUploadPercent] = useState<number | null>(null);
  const [previewAudioFile, setPreviewAudioFile] = useState<File | null>(null);
  const [removeExistingPreviewAudio, setRemoveExistingPreviewAudio] = useState(false);
  const [audioUploadPercent, setAudioUploadPercent] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);

  const handleCoverFileSelect = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setIsValidatingCover(true);
    setCoverError(null);
    try {
      const result = await validateCatalogCover(file);
      if (result.valid) {
        setCoverFile(file);
        setCoverDimensions({ width: result.width, height: result.height });
        setCoverError(null);
      } else {
        setCoverFile(null);
        setCoverDimensions(null);
        setCoverError(result.errorMessage || 'Invalid image dimensions.');
      }
    } catch (err: any) {
      setCoverFile(null);
      setCoverDimensions(null);
      setCoverError(err.message || 'Failed to inspect image.');
    } finally {
      setIsValidatingCover(false);
    }
  };

  const handleHeroCoverFileSelect = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setIsValidatingHeroCover(true);
    setHeroCoverError(null);
    try {
      const result = await validateHeroCover(file);
      if (result.valid) {
        setHeroCoverFile(file);
        setHeroCoverDimensions({ width: result.width, height: result.height });
        setHeroCoverError(null);
        setRemoveExistingHeroCover(false);
      } else {
        setHeroCoverFile(null);
        setHeroCoverDimensions(null);
        setHeroCoverError(result.errorMessage || 'Invalid image dimensions.');
      }
    } catch (err: any) {
      setHeroCoverFile(null);
      setHeroCoverDimensions(null);
      setHeroCoverError(err.message || 'Failed to inspect image.');
    } finally {
      setIsValidatingHeroCover(false);
    }
  };

  // Newly-selected local file previews before upload — revoked on change/unmount to avoid leaking blob URLs.
  const localPreviewPdfUrl = useMemo(() => (previewPdfFile ? URL.createObjectURL(previewPdfFile) : null), [previewPdfFile]);
  useEffect(() => () => { if (localPreviewPdfUrl) URL.revokeObjectURL(localPreviewPdfUrl); }, [localPreviewPdfUrl]);

  const activePreviewPdfUrl = localPreviewPdfUrl || (!removeExistingPreviewPdf ? editingBook?.previewPdfUrl : undefined) || null;
  const activePreviewPdfName = previewPdfFile?.name || (!removeExistingPreviewPdf ? editingBook?.previewPdfFileName : undefined) || 'Sample Preview PDF';

  const [searchTerm, setSearchTerm] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchBooks = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await ApiClient.getBooks({
        page: currentPage,
        limit: pageSize,
        search: searchTerm.trim() || undefined,
      });
      const data = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      const total = typeof res?.total === 'number' ? res.total : data.length;
      setBooks(data);
      setTotalCount(total);
    } catch (err) {
      console.error('Failed to fetch books:', err);
      if (!silent) {
        setBooks([]);
        setTotalCount(0);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [currentPage, pageSize, searchTerm]);

  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => {
      fetchBooks();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchBooks]);

  const formik = useFormik({
    initialValues: emptyValues,
    validationSchema: bookSchema,
    onSubmit: async (values, { resetForm, setSubmitting, setFieldError }) => {
      if (coverError) {
        setFieldError('title', coverError);
        setSubmitting(false);
        return;
      }
      if (heroCoverError) {
        setFieldError('title', heroCoverError);
        setSubmitting(false);
        return;
      }
      if (!editingBook && !coverFile) {
        setCoverError('Catalog Cover (16:9) is required before creating a book.');
        setFieldError('title', 'Catalog Cover (16:9) is required before creating a book.');
        setSubmitting(false);
        return;
      }

      try {
        const price = values.isFree ? 0 : Number(values.price);
        const payload = {
          title: values.title.trim(),
          author: values.author.trim(),
          description: values.description.trim(),
          category: values.category.trim(),
          price,
          discountPercent: values.isFree ? 0 : Number(values.discountPercent) || 0,
          publicationYear: Number(values.publicationYear) || undefined,
          productId: values.productId.trim() || undefined,
          appleId: values.appleId.trim() || undefined,
          basePlanId: values.basePlanId.trim() || undefined,
          subscriptionType: values.subscriptionType as 'FULL_TIME_ACCESS' | 'LIMITED_ACCESS' | 'SUBSCRIPTION',
          subscriptionDuration: values.subscriptionType === 'SUBSCRIPTION' ? values.subscriptionDuration : undefined,
          isPremium: !values.isFree && price > 0,
          isPublished: values.isPublished,
          visibleToGuests: values.visibleToGuests,
        };

        let targetId = '';
        if (editingBook) {
          targetId = editingBook.id;
          await ApiClient.updateBook(targetId, payload);
          if (coverFile) await ApiClient.uploadBookCover(targetId, coverFile);
          if (heroCoverFile) await ApiClient.uploadBookHeroCover(targetId, heroCoverFile);
          if (removeExistingHeroCover && !heroCoverFile) {
            await ApiClient.deleteBookHeroCover(targetId);
          }
          if (removeExistingPreviewPdf && !previewPdfFile) {
            await ApiClient.deleteBookPreviewPdf(targetId);
          }
          if (removeExistingPreviewAudio && !previewAudioFile) {
            await ApiClient.deleteBookPreviewAudio(targetId);
          }
        } else {
          const created = await ApiClient.createBook({ ...payload, coverUrl: '' });
          targetId = created.id;
          await ApiClient.uploadBookCover(targetId, coverFile!);
          if (heroCoverFile) {
            await ApiClient.uploadBookHeroCover(targetId, heroCoverFile);
          }
        }

        if (previewPdfFile && targetId) {
          setPdfUploadPercent(0);
          await ApiClient.uploadBookPreviewPdf(targetId, previewPdfFile, setPdfUploadPercent);
        }

        if (previewAudioFile && targetId) {
          setAudioUploadPercent(0);
          await ApiClient.uploadBookPreviewAudio(targetId, previewAudioFile, setAudioUploadPercent);
        }

        resetForm();
        setCoverFile(null);
        setCoverDimensions(null);
        setCoverError(null);
        setHeroCoverFile(null);
        setHeroCoverDimensions(null);
        setHeroCoverError(null);
        setRemoveExistingHeroCover(false);
        setPdfPreviewFile(null);
        setRemoveExistingPreviewPdf(false);
        setPreviewAudioFile(null);
        setRemoveExistingPreviewAudio(false);
        setPdfPreviewOpen(false);
        setIsDialogOpen(false);
        setEditingBook(null);
        await fetchBooks(true);
      } catch (err: any) {
        setFieldError('title', err.message || `Failed to ${editingBook ? 'update' : 'create'} book.`);
      } finally {
        setPdfUploadPercent(null);
        setAudioUploadPercent(null);
        setSubmitting(false);
      }
    },
  });

  const handleOpenCreateDialog = () => {
    setEditingBook(null);
    setCoverFile(null);
    setCoverDimensions(null);
    setCoverError(null);
    setHeroCoverFile(null);
    setHeroCoverDimensions(null);
    setHeroCoverError(null);
    setRemoveExistingHeroCover(false);
    setPdfPreviewFile(null);
    setRemoveExistingPreviewPdf(false);
    setPreviewAudioFile(null);
    setRemoveExistingPreviewAudio(false);
    setPdfPreviewOpen(false);
    formik.resetForm({ values: emptyValues });
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (book: Book) => {
    setEditingBook(book);
    setCoverFile(null);
    setCoverDimensions(null);
    setCoverError(null);
    setHeroCoverFile(null);
    setHeroCoverDimensions(null);
    setHeroCoverError(null);
    setRemoveExistingHeroCover(false);
    setPdfPreviewFile(null);
    setRemoveExistingPreviewPdf(false);
    setPreviewAudioFile(null);
    setRemoveExistingPreviewAudio(false);
    setPdfPreviewOpen(false);
    formik.resetForm({
      values: {
        title: book.title,
        author: book.author,
        description: book.description,
        category: book.category,
        price: String(book.price),
        discountPercent: String(book.discountPercent ?? 0),
        publicationYear: String(book.publicationYear ?? currentYear),
        productId: book.productId ?? '',
        appleId: book.appleId ?? '',
        basePlanId: book.basePlanId ?? '',
        subscriptionType: book.subscriptionType ?? 'FULL_TIME_ACCESS',
        subscriptionDuration: (book.subscriptionDuration as string) || '1_MONTH',
        isFree: !book.isPremium && (book.price ?? 0) === 0,
        isPublished: book.isPublished,
        visibleToGuests: book.visibleToGuests ?? false,
      },
    });
    setIsDialogOpen(true);
  };

  const handleDeleteBook = async (id: string) => {
    const previousBooks = books;
    const previousTotal = totalCount;
    setBooks((prev) => prev.filter((b) => b.id !== id));
    setTotalCount((prev) => Math.max(0, prev - 1));
    try {
      await ApiClient.deleteBook(id);
      fetchBooks(true);
    } catch (err: any) {
      setBooks(previousBooks);
      setTotalCount(previousTotal);
      alert(err.message || 'Failed to delete book.');
    }
  };

  if (!mounted) {
    return (
      <div className="space-y-6">
        <AdminSkeletonHeader />
        <AdminSkeletonTable rowsCount={4} colsCount={7} />
      </div>
    );
  }

  const totalItems = totalCount;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const paginatedBooks = Array.isArray(books) ? books : [];

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4">
      {/* Fixed Header */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">E-Book Content Management</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">Upload and manage PSC PDF handbooks and question banks.</p>
        </div>
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="w-full sm:w-64">
            <Input
              placeholder="Search books..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <Button variant="gold" className="font-bold shadow-md shadow-amber-500/20 shrink-0" onClick={handleOpenCreateDialog}>
            + Add New Book
          </Button>
        </div>
      </div>

      {/* Scrollable Table */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border border-slate-200/80 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] shadow-sm p-0">
        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 relative">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Cover</TableHead>
              <TableHead>Book Title</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Price</TableHead>
              <TableHead className="whitespace-nowrap">Orders</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: pageSize || 8 }).map((_, idx) => (
                <TableRow key={`skeleton-${idx}`} className="border-b border-slate-200/80 dark:border-slate-800/60">
                  <TableCell className="py-3 w-28"><Skeleton className="w-24 h-16 rounded-xl" /></TableCell>
                  <TableCell className="py-4">
                    <div className="space-y-1.5">
                      <Skeleton className="h-5 w-48 rounded-lg" />
                      <div className="flex gap-1.5">
                        <Skeleton className="h-4 w-20 rounded-md" />
                        <Skeleton className="h-4 w-16 rounded-md" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-32 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-24 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-16 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-20 rounded-lg" /></TableCell>
                  <TableCell className="py-4 text-right"><Skeleton className="h-8 w-20 rounded-xl ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : paginatedBooks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <div className="flex flex-col items-center justify-center space-y-3 max-w-sm mx-auto">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">No E-Book Match</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        No e-books available. Upload your first PDF book for students to purchase.
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedBooks.map((book) => (
                <TableRow key={book.id}>
                  <TableCell className="w-28 py-3">
                    {book.coverUrl ? (
                      <div className="relative group/cover w-24 h-16 rounded-xl overflow-hidden border border-slate-200/90 dark:border-[#1e2e56] shadow-sm bg-slate-900/10 dark:bg-[#070e22] shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={book.coverUrl}
                          alt={book.title}
                          className="w-full h-full object-cover object-center transition-transform duration-200 group-hover/cover:scale-105"
                        />
                      </div>
                    ) : (
                      <div className="w-24 h-16 bg-slate-100 dark:bg-[#091124] rounded-xl flex flex-col items-center justify-center text-cyan-400 border border-slate-200 dark:border-[#1e2e56] shrink-0">
                        <BookOpen className="w-5 h-5 opacity-60" />
                        <span className="text-[9px] font-mono text-slate-400 mt-1">No Cover</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="space-y-1.5 max-w-xs sm:max-w-md">
                      <span className="font-bold text-slate-900 dark:text-white block leading-snug">{book.title}</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link
                          href={`/admin/books/${book.id}/chapters`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono hover:border-cyan-500/50 transition-colors shadow-2xs cursor-pointer group"
                          title="Manage Chapters"
                        >
                          <Library className="w-3 h-3 text-cyan-500" />
                          <span>{book.chaptersCount ?? 0} {book.chaptersCount === 1 ? 'Chapter' : 'Chapters'}</span>
                        </Link>
                        <Link
                          href={`/admin/books/${book.id}/chapters`}
                          className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-extrabold bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/25 font-mono hover:bg-cyan-500/20 transition-colors shadow-2xs cursor-pointer"
                          title="View Topics"
                        >
                          <span>{book.topicsCount ?? 0} {book.topicsCount === 1 ? 'Topic' : 'Topics'}</span>
                        </Link>
                        {book.subscriptionType === 'SUBSCRIPTION' ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-extrabold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 font-mono shadow-2xs"
                            title="Subscription Access"
                          >
                            <Clock className="w-3 h-3 text-amber-500" />
                            <span>Sub · {formatSubscriptionDuration(book.subscriptionDuration)}</span>
                          </span>
                        ) : book.subscriptionType === 'LIMITED_ACCESS' ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-mono shadow-2xs"
                            title="Trial / Limited Access"
                          >
                            <span>Trial Access</span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-extrabold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 font-mono shadow-2xs"
                            title="Full-Time Access"
                          >
                            <span>Full-Time</span>
                          </span>
                        )}
                        {book.previewPdfUrl && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-extrabold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 font-mono shadow-2xs"
                            title="Preview PDF Attached"
                          >
                            <FileText className="w-3 h-3 text-amber-500" />
                            <span>Preview PDF</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-700 dark:text-slate-300 font-medium">{book.author}</TableCell>
                  <TableCell><Badge variant="gold">{book.category}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={book.isPublished ? 'success' : 'default'}>
                      {book.isPublished ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono font-extrabold">
                    <span className="text-cyan-400">₹{book.finalPrice}</span>
                    {book.discountPercent > 0 && (
                      <span className="ml-1.5 text-slate-400 dark:text-slate-500 line-through font-medium">₹{book.price}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-mono shadow-2xs">
                      {book.ordersCount ?? (book as any)._count?.orders ?? 0}
                    </span>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/admin/books/${book.id}/chapters`}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="p-2 rounded-xl text-cyan-700 dark:text-cyan-300 hover:text-cyan-400 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all shadow-xs"
                          title="Manage Chapters"
                        >
                          <Library className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        className="p-2 rounded-xl text-cyan-700 dark:text-cyan-300 hover:text-cyan-400 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all shadow-xs"
                        title="Edit Book"
                        onClick={() => handleOpenEditDialog(book)}
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        className="p-2 rounded-xl transition-all shadow-xs"
                        title="Delete Book"
                        onClick={() => setDeleteTarget(book)}
                      >
                        <Trash2 className="w-4 h-4" />
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
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setCurrentPage(1);
            }}
          />
        </div>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setEditingBook(null);
        }}
        title={editingBook ? 'Edit Book' : 'Add New Book'}
        className="max-w-3xl w-full"
      >
        <form onSubmit={formik.handleSubmit} className="space-y-4 pb-1">
          {/* ── SECTION 1: BOOK DETAILS ── */}
          <div className="space-y-3.5 p-4 rounded-2xl border border-slate-200/80 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#0c152e]/50">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-200/60 dark:border-[#1e2e56]/60">
              <BookOpen className="w-4 h-4 text-cyan-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Book Information
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
              <div className="sm:col-span-8">
                <Input
                  label="Book Title"
                  name="title"
                  placeholder="Kerala PSC General Knowledge 2026"
                  value={formik.values.title}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.title && formik.errors.title ? formik.errors.title : undefined}
                />
              </div>
              <div className="sm:col-span-4">
                <Input
                  label="Category"
                  name="category"
                  placeholder="Question Bank"
                  value={formik.values.category}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.category && formik.errors.category ? formik.errors.category : undefined}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
              <div className="sm:col-span-8">
                <Input
                  label="Author Name (Optional)"
                  name="author"
                  placeholder="PSC Tips and Tricks Editorial Board"
                  value={formik.values.author}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.author && formik.errors.author ? formik.errors.author : undefined}
                />
              </div>
              <div className="sm:col-span-4">
                <Input
                  label="Publication Year (Optional)"
                  name="publicationYear"
                  type="number"
                  value={formik.values.publicationYear}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.publicationYear && formik.errors.publicationYear ? formik.errors.publicationYear : undefined}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Description (Optional)
              </label>
              <textarea
                name="description"
                rows={3}
                placeholder="Comprehensive syllabus guide for all PSC exams..."
                value={formik.values.description}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className={`w-full rounded-xl border bg-white dark:bg-[#091124] px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/60 transition-all ${
                  formik.touched.description && formik.errors.description ? 'border-rose-500' : 'border-slate-300 dark:border-[#1e2e56]'
                }`}
              />
              {formik.touched.description && formik.errors.description && (
                <p className="text-xs text-rose-500 font-bold mt-1">{formik.errors.description}</p>
              )}
            </div>
          </div>

          {/* ── SECTION 2: ACCESS MODEL & PRICING ── */}
          <div className="space-y-3.5 p-4 rounded-2xl border border-slate-200/80 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#0c152e]/50">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200/60 dark:border-[#1e2e56]/60">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Access Model & Pricing
                </h3>
              </div>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                {formik.values.subscriptionType === 'SUBSCRIPTION' ? 'Subscription Mode' : 'Full Time Access Mode'}
              </span>
            </div>

            {/* Access Model & Duration Grid */}
            <div className={`grid gap-3.5 ${formik.values.subscriptionType === 'SUBSCRIPTION' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
              <Select
                label="Subscription / Access Model"
                name="subscriptionType"
                value={formik.values.subscriptionType}
                onChange={(val) => {
                  formik.setFieldValue('subscriptionType', val);
                  if (val === 'SUBSCRIPTION' && !formik.values.subscriptionDuration) {
                    formik.setFieldValue('subscriptionDuration', '1_MONTH');
                  }
                }}
                options={SUBSCRIPTION_TYPES.map((t) => ({ value: t.value, label: t.label }))}
              />

              {formik.values.subscriptionType === 'SUBSCRIPTION' && (
                <div className="space-y-1.5">
                  <Select
                    label="Subscription Duration (Required)"
                    name="subscriptionDuration"
                    value={formik.values.subscriptionDuration || '1_MONTH'}
                    onChange={(val) => formik.setFieldValue('subscriptionDuration', val)}
                    options={SUBSCRIPTION_DURATIONS.map((d) => ({ value: d.value, label: d.label }))}
                  />
                  {formik.touched.subscriptionDuration && formik.errors.subscriptionDuration && (
                    <p className="text-xs text-rose-500 font-bold">{formik.errors.subscriptionDuration}</p>
                  )}
                </div>
              )}
            </div>

            {/* Pricing Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-start pt-1">
              <Input
                label="Price (INR)"
                name="price"
                type="number"
                disabled={formik.values.isFree}
                value={formik.values.isFree ? '0' : formik.values.price}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={!formik.values.isFree && formik.touched.price && formik.errors.price ? formik.errors.price : undefined}
              />
              <Input
                label="Discount %"
                name="discountPercent"
                type="number"
                disabled={formik.values.isFree}
                value={formik.values.isFree ? '0' : formik.values.discountPercent}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={!formik.values.isFree && formik.touched.discountPercent && formik.errors.discountPercent ? formik.errors.discountPercent : undefined}
              />
              <div className="w-full space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Final Student Price
                </label>
                <div
                  title="Calculated automatically from Price and Discount %"
                  className="flex h-11 w-full items-center justify-between rounded-xl border border-cyan-500/40 bg-cyan-500/[0.08] dark:bg-cyan-500/[0.05] px-3.5 text-sm font-mono font-black text-cyan-600 dark:text-cyan-400 shadow-2xs"
                >
                  <span className="text-base font-black">
                    ₹{formik.values.isFree ? 0 : computeFinalPrice(formik.values.price, formik.values.discountPercent)}
                  </span>
                  {Number(formik.values.discountPercent) > 0 && !formik.values.isFree && (
                    <span className="text-[11px] font-sans font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-md">
                      {formik.values.discountPercent}% OFF
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── SECTION 3: APP STORE IDENTIFIERS ── */}
          <div className="space-y-3.5 p-4 rounded-2xl border border-slate-200/80 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#0c152e]/50">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200/60 dark:border-[#1e2e56]/60">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                In-App Purchase & Store Identifiers
              </h3>
              <span className="text-[10px] text-slate-400 font-semibold">Play Store & App Store Billing</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <Input
                label="Product ID (Optional)"
                name="productId"
                placeholder="com.psctipsandtricks.book.xyz"
                value={formik.values.productId}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.productId && formik.errors.productId ? formik.errors.productId : undefined}
              />
              <Input
                label="Apple ID (Optional)"
                name="appleId"
                placeholder="6769373341"
                value={formik.values.appleId}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.appleId && formik.errors.appleId ? formik.errors.appleId : undefined}
              />
              <Input
                label="Base Plan ID (Optional)"
                name="basePlanId"
                placeholder="p1m / p3m / p6m"
                value={formik.values.basePlanId}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.basePlanId && formik.errors.basePlanId ? formik.errors.basePlanId : undefined}
              />
            </div>
          </div>

          {/* ── SECTION 4: MEDIA & ATTACHMENTS ── */}
          <div className="space-y-3.5 p-4 rounded-2xl border border-slate-200/80 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#0c152e]/50">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200/60 dark:border-[#1e2e56]/60">
              <div className="flex items-center gap-2">
                <ImagePlus className="w-4 h-4 text-cyan-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Book Covers & Sample Materials
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold">Images Max 5MB · PDF Max 50MB</span>
            </div>

            {/* 2-Column Responsive Grid for Covers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Cover 1: Catalog Cover */}
              <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-[#1e2e56] bg-white/80 dark:bg-[#091124]/80 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <ImagePlus className="w-3.5 h-3.5 text-cyan-500" />
                      <span>Catalog Cover</span>
                    </label>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20">
                      16:9 · Recommended 1280 × 720 px
                    </span>
                  </div>

                  {editingBook?.coverUrl && !coverFile && (
                    <div className="flex items-center gap-2.5 p-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={editingBook.coverUrl} alt="Cover" className="w-16 h-9 object-cover rounded-lg border border-cyan-500/30 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-cyan-800 dark:text-cyan-300 truncate">Active 16:9 Cover</p>
                        <a href={editingBook.coverUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-cyan-600 hover:underline inline-flex items-center gap-1">
                          View <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </div>
                  )}

                  {isValidatingCover && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-300 font-bold">
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-amber-500 border-t-transparent shrink-0" />
                      <span>Checking 16:9 image dimensions…</span>
                    </div>
                  )}

                  {coverFile && (
                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-300">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold truncate">{coverFile.name}</p>
                          {coverDimensions && (
                            <p className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                              ✓ {coverDimensions.width} × {coverDimensions.height} px (16:9) · {(coverFile.size / (1024 * 1024)).toFixed(1)} MB
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCoverFile(null);
                          setCoverDimensions(null);
                          setCoverError(null);
                        }}
                        className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                        title="Remove"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {coverError && (
                    <div className="flex items-start gap-2 p-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-xs text-rose-700 dark:text-rose-300 font-medium">
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <p className="font-bold">Invalid Image Dimensions</p>
                        <p className="text-[11px] leading-snug">{coverError}</p>
                      </div>
                    </div>
                  )}
                </div>

                <FileDropZone
                  accept="image/jpeg,image/png,image/webp"
                  onFiles={handleCoverFileSelect}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-[#1e2e56] bg-white dark:bg-[#091124] text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all"
                >
                  {({ isDragActive }) => (
                    <>
                      <UploadCloud className="w-3.5 h-3.5 text-cyan-500" />
                      <span>
                        {isDragActive
                          ? 'Drop 16:9 image to upload…'
                          : coverFile
                            ? 'Change cover image…'
                            : 'Upload 16:9 Catalog Cover…'}
                      </span>
                    </>
                  )}
                </FileDropZone>
              </div>

              {/* Cover 2: Hero Carousel Portrait Cover */}
              <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-[#1e2e56] bg-white/80 dark:bg-[#091124]/80 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Library className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Book Size Hero Cover</span>
                    </label>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
                      2:3 · Recommended 1024 × 1536 px
                    </span>
                  </div>

                  {editingBook?.heroCoverUrl && !heroCoverFile && !removeExistingHeroCover && (
                    <div className="flex items-center gap-2.5 p-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={editingBook.heroCoverUrl} alt="Hero Cover" className="w-10 h-14 object-cover rounded-lg border border-indigo-500/30 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-indigo-800 dark:text-indigo-300 truncate">Active 2:3 Hero Cover</p>
                        <button type="button" onClick={() => setRemoveExistingHeroCover(true)} className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer">
                          Remove
                        </button>
                      </div>
                    </div>
                  )}

                  {isValidatingHeroCover && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-300 font-bold">
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-amber-500 border-t-transparent shrink-0" />
                      <span>Checking 2:3 dimensions…</span>
                    </div>
                  )}

                  {heroCoverFile && (
                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-300">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold truncate">{heroCoverFile.name}</p>
                          {heroCoverDimensions && (
                            <p className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                              ✓ {heroCoverDimensions.width} × {heroCoverDimensions.height} px (2:3) · {(heroCoverFile.size / (1024 * 1024)).toFixed(1)} MB
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setHeroCoverFile(null);
                          setHeroCoverDimensions(null);
                          setHeroCoverError(null);
                        }}
                        className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                        title="Remove"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {heroCoverError && (
                    <div className="flex items-start gap-2 p-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-xs text-rose-700 dark:text-rose-300 font-medium">
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <p className="font-bold">Invalid Image Dimensions</p>
                        <p className="text-[11px] leading-snug">{heroCoverError}</p>
                      </div>
                    </div>
                  )}
                </div>

                <FileDropZone
                  accept="image/jpeg,image/png,image/webp"
                  onFiles={handleHeroCoverFileSelect}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-[#1e2e56] bg-white dark:bg-[#091124] text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all"
                >
                  {({ isDragActive }) => (
                    <>
                      <UploadCloud className="w-3.5 h-3.5 text-indigo-500" />
                      <span>
                        {isDragActive
                          ? 'Drop 2:3 image to upload…'
                          : heroCoverFile
                            ? 'Change book size cover…'
                            : 'Upload 2:3 Hero Cover…'}
                      </span>
                    </>
                  )}
                </FileDropZone>
              </div>
            </div>

            {/* Preview PDF */}
            <div className="space-y-2 p-3 rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-white/80 dark:bg-[#091124]/80">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-500" />
                  <span>Sample Preview PDF (Optional)</span>
                </label>
                <span className="text-[10px] text-slate-400">PDF · Max 50MB</span>
              </div>

              {editingBook?.previewPdfUrl && !removeExistingPreviewPdf && !previewPdfFile && (
                <div className="flex items-center justify-between gap-2 p-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                    <p className="font-bold text-amber-900 dark:text-amber-300 truncate">
                      {editingBook.previewPdfFileName || 'Attached Preview PDF'} {editingBook.previewPdfSizeBytes ? `(${formatFileSize(editingBook.previewPdfSizeBytes)})` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button type="button" onClick={() => setPdfPreviewOpen(true)} className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer">
                      Preview
                    </button>
                    <button type="button" onClick={() => setRemoveExistingPreviewPdf(true)} className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer">
                      Remove
                    </button>
                  </div>
                </div>
              )}

              {previewPdfFile && (
                <div className="flex items-center justify-between gap-2 p-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-300">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <p className="font-bold truncate">{previewPdfFile.name}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button type="button" onClick={() => setPdfPreviewOpen(true)} className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer">
                      Preview
                    </button>
                    <button type="button" onClick={() => setPdfPreviewFile(null)} className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              <FileDropZone
                accept="application/pdf,.pdf"
                onFiles={([file]) => {
                  if (file && file.size > MAX_PDF_BYTES) {
                    alert(`"${file.name}" exceeds the 50MB limit.`);
                    return;
                  }
                  setPdfPreviewFile(file);
                  setRemoveExistingPreviewPdf(false);
                }}
                onReject={() => alert('Only PDF files can be attached here.')}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-[#1e2e56] bg-white dark:bg-[#091124] text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:border-amber-500/50 hover:bg-amber-500/5 transition-all"
              >
                {({ isDragActive }) => (
                  <>
                    <UploadCloud className="w-3.5 h-3.5 text-amber-500" />
                    <span>
                      {isDragActive
                        ? 'Drop PDF to upload…'
                        : previewPdfFile
                          ? 'Change preview PDF file…'
                          : 'Choose a preview PDF to attach…'}
                    </span>
                  </>
                )}
              </FileDropZone>

              {pdfUploadPercent !== null && (
                <div className="space-y-1 pt-1">
                  <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-cyan-500 transition-all duration-200"
                      style={{ width: `${pdfUploadPercent}%` }}
                    />
                  </div>
                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Uploading Preview PDF… {pdfUploadPercent}%</p>
                </div>
              )}
            </div>

            {/* Preview Audio (Optional) */}
            <div className="space-y-2 p-3 rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-white/80 dark:bg-[#091124]/80">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Sample Preview Audio (Optional)</span>
                </label>
                <span className="text-[10px] text-slate-400">MP3, M4A, WAV · Max 45MB</span>
              </div>

              {editingBook?.previewAudioUrl && !removeExistingPreviewAudio && !previewAudioFile && (
                <div className="flex flex-col gap-2 p-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Volume2 className="w-4 h-4 text-cyan-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-cyan-800 dark:text-cyan-300 truncate">
                          {editingBook.previewAudioFileName || 'Attached Preview Audio'}
                        </p>
                        {formatFileSize(editingBook.previewAudioSizeBytes) && (
                          <p className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono">
                            {formatFileSize(editingBook.previewAudioSizeBytes)}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRemoveExistingPreviewAudio(true)}
                      className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                  <audio controls className="w-full h-8 rounded-lg" src={editingBook.previewAudioUrl}>
                    Your browser does not support audio playback.
                  </audio>
                </div>
              )}

              {previewAudioFile && (
                <div className="space-y-2 p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                  <div className="flex items-center justify-between gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-bold truncate">{previewAudioFile.name}</p>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                          {formatFileSize(previewAudioFile.size)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewAudioFile(null)}
                      className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <audio controls className="w-full h-8 rounded-lg" src={URL.createObjectURL(previewAudioFile)}>
                    Your browser does not support audio playback.
                  </audio>
                </div>
              )}

              <FileDropZone
                accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg"
                onFiles={([file]) => {
                  if (file && file.size > MAX_AUDIO_BYTES) {
                    alert(`"${file.name}" exceeds the 45MB limit.`);
                    return;
                  }
                  setPreviewAudioFile(file);
                  setRemoveExistingPreviewAudio(false);
                }}
                onReject={() => alert('Only audio files can be attached here.')}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-[#1e2e56] bg-white dark:bg-[#091124] text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all"
              >
                {({ isDragActive }) => (
                  <>
                    <UploadCloud className="w-3.5 h-3.5 text-cyan-500" />
                    <span>
                      {isDragActive
                        ? 'Drop audio file to upload…'
                        : previewAudioFile
                          ? 'Change preview audio file…'
                          : 'Choose a preview audio to attach…'}
                    </span>
                  </>
                )}
              </FileDropZone>

              {audioUploadPercent !== null && (
                <div className="space-y-1 pt-1">
                  <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-amber-500 transition-all duration-200"
                      style={{ width: `${audioUploadPercent}%` }}
                    />
                  </div>
                  <p className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400">
                    Uploading Preview Audio… {audioUploadPercent}%
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── SECTION 5: PUBLISHING & ACCESS CONTROLS ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ToggleSwitch
              icon={Eye}
              variant="emerald"
              label="Active Status"
              description="Visible & accessible in student store"
              badge={
                <Badge
                  variant={formik.values.isPublished ? 'success' : 'outline'}
                  className="text-[10px] uppercase font-bold"
                >
                  {formik.values.isPublished ? 'Published' : 'Draft'}
                </Badge>
              }
              checked={formik.values.isPublished}
              onChange={(checked) => formik.setFieldValue('isPublished', checked)}
              className="p-4 rounded-2xl bg-white dark:bg-[#0c152e] border-slate-200/90 dark:border-[#1e2e56] shadow-xs hover:border-emerald-500/40 transition-colors"
            />
            <ToggleSwitch
              icon={Gift}
              variant="cyan"
              label="Free Book"
              description="Zero cost instant reading for all students"
              badge={
                <Badge
                  variant={formik.values.isFree ? 'success' : 'gold'}
                  className="text-[10px] uppercase font-bold"
                >
                  {formik.values.isFree ? 'Free' : 'Paid'}
                </Badge>
              }
              checked={formik.values.isFree}
              onChange={(checked) => {
                formik.setFieldValue('isFree', checked);
                if (checked) {
                  formik.setFieldValue('price', '0');
                  formik.setFieldValue('discountPercent', '0');
                  formik.setFieldError('price', undefined);
                  formik.setFieldError('discountPercent', undefined);
                  formik.setFieldTouched('price', false, false);
                  formik.setFieldTouched('discountPercent', false, false);
                }
              }}
              className="p-4 rounded-2xl bg-white dark:bg-[#0c152e] border-slate-200/90 dark:border-[#1e2e56] shadow-xs hover:border-cyan-500/40 transition-colors"
            />
          </div>

          {/* ── FOOTER ACTIONS ── */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200/80 dark:border-[#1e2e56]">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false);
                setEditingBook(null);
              }}
              className="font-bold text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="gold"
              className="font-bold text-xs shadow-md shadow-amber-500/20 px-6"
              isLoading={formik.isSubmitting}
            >
              {editingBook ? 'Save Changes' : 'Create Book'}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete Book"
        description={deleteTarget ? `This will permanently remove "${deleteTarget.title}" by ${deleteTarget.author}, along with all its chapters. This action cannot be undone.` : undefined}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) handleDeleteBook(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      {pdfPreviewOpen && activePreviewPdfUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-2 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Sample PDF Preview: ${activePreviewPdfName}`}
          onClick={() => setPdfPreviewOpen(false)}
        >
          <div
            className="w-full max-w-4xl h-[88vh] bg-slate-900 border border-slate-800 rounded-3xl p-3 sm:p-4 shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <SecurePdfViewer
              url={activePreviewPdfUrl}
              title={activePreviewPdfName}
              onClose={() => setPdfPreviewOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
