'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button, Dialog, ConfirmDialog, Input, ToggleSwitch, Badge, Pagination, Skeleton, Select } from '@psc/ui';
import { AdminSkeletonHeader, AdminSkeletonTable } from '../admin-skeleton';
import { Edit3, Trash2, BookOpen, Library, ImagePlus, Eye, Gift, Globe, CheckCircle2, UploadCloud, X, ExternalLink, FileText } from 'lucide-react';
import { Book } from '@psc/shared-types';
import { ApiClient } from '@/lib/api-client';

const MAX_PDF_BYTES = 50 * 1024 * 1024;

function formatFileSize(bytes?: number | null): string | null {
  if (!bytes) return null;
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const currentYear = new Date().getFullYear();

const bookSchema = Yup.object({
  title: Yup.string().trim().required('Book title is required'),
  author: Yup.string().trim().required('Author name is required'),
  description: Yup.string().trim().required('Description is required'),
  category: Yup.string().trim().required('Category is required'),
  price: Yup.number().typeError('Price must be a number').min(0, 'Price cannot be negative').required('Price is required'),
  discountPercent: Yup.number().typeError('Discount must be a number').min(0, 'Cannot be negative').max(100, 'Cannot exceed 100%'),
  publicationYear: Yup.number()
    .typeError('Publication year must be a number')
    .integer('Enter a four-digit year')
    .min(1800, 'Enter a valid year')
    .max(currentYear + 5, 'Year is too far in the future'),
});

const SUBSCRIPTION_TYPES = [
  { value: 'FULL_TIME_ACCESS', label: 'Full Time Access' },
  { value: 'LIMITED_ACCESS', label: 'Limited / Trial Access' },
  { value: 'SUBSCRIPTION', label: 'Subscription' },
] as const;

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
  const [previewPdfFile, setPdfPreviewFile] = useState<File | null>(null);
  const [removeExistingPreviewPdf, setRemoveExistingPreviewPdf] = useState(false);
  const [pdfUploadPercent, setPdfUploadPercent] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);

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
          isPremium: !values.isFree && price > 0,
          isPublished: values.isPublished,
          visibleToGuests: values.visibleToGuests,
        };

        let targetId = '';
        if (editingBook) {
          targetId = editingBook.id;
          await ApiClient.updateBook(targetId, payload);
          if (coverFile) await ApiClient.uploadBookCover(targetId, coverFile);
          if (removeExistingPreviewPdf && !previewPdfFile) {
            await ApiClient.deleteBookPreviewPdf(targetId);
          }
        } else {
          if (!coverFile) {
            setFieldError('title', 'Choose a cover image before publishing.');
            setSubmitting(false);
            return;
          }
          const created = await ApiClient.createBook({ ...payload, coverUrl: '' });
          targetId = created.id;
          await ApiClient.uploadBookCover(targetId, coverFile);
        }

        if (previewPdfFile && targetId) {
          setPdfUploadPercent(0);
          await ApiClient.uploadBookPreviewPdf(targetId, previewPdfFile, setPdfUploadPercent);
        }

        resetForm();
        setCoverFile(null);
        setPdfPreviewFile(null);
        setRemoveExistingPreviewPdf(false);
        setIsDialogOpen(false);
        setEditingBook(null);
        await fetchBooks(true);
      } catch (err: any) {
        setFieldError('title', err.message || `Failed to ${editingBook ? 'update' : 'create'} book.`);
      } finally {
        setPdfUploadPercent(null);
        setSubmitting(false);
      }
    },
  });

  const handleOpenCreateDialog = () => {
    setEditingBook(null);
    setCoverFile(null);
    setPdfPreviewFile(null);
    setRemoveExistingPreviewPdf(false);
    formik.resetForm({ values: emptyValues });
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (book: Book) => {
    setEditingBook(book);
    setCoverFile(null);
    setPdfPreviewFile(null);
    setRemoveExistingPreviewPdf(false);
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
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={`skeleton-${idx}`} className="border-b border-slate-200/80 dark:border-slate-800/60">
                  <TableCell className="py-3 w-16"><Skeleton className="h-16 w-12 rounded-xl" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-48 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-32 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-24 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-16 rounded-lg" /></TableCell>
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
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
        </div>
      </Card>

      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title={editingBook ? 'Edit Book' : 'Create New Book'}
        className="max-w-3xl w-full"
      >
        <form className="space-y-4 pt-2" onSubmit={formik.handleSubmit} noValidate>
          <Input
            label="Book Title"
            name="title"
            placeholder="e.g. Kerala Geography Handbook 2026"
            value={formik.values.title}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.title && formik.errors.title ? formik.errors.title : undefined}
          />
          <Input
            label="Author Name"
            name="author"
            placeholder="e.g. Dr. S. K. Nair"
            value={formik.values.author}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.author && formik.errors.author ? formik.errors.author : undefined}
          />
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Description</label>
            <textarea
              name="description"
              rows={3}
              placeholder="What this book covers…"
              value={formik.values.description}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              className={`w-full p-3 text-sm rounded-xl border bg-slate-50/70 dark:bg-[#091124] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 resize-none transition-all font-medium ${
                formik.touched.description && formik.errors.description
                  ? 'border-rose-500 focus:ring-rose-500/50 focus:border-rose-500 bg-rose-500/5'
                  : 'border-slate-300 dark:border-[#1e2e56] focus:ring-cyan-500/50 focus:border-cyan-500'
              }`}
            />
            {formik.touched.description && formik.errors.description && (
              <p className="text-xs font-semibold text-rose-500">{formik.errors.description}</p>
            )}
          </div>
          {/* Store listing identifiers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Product ID"
              name="productId"
              placeholder="com.psc.book"
              value={formik.values.productId}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
            />
            <Input
              label="Apple ID"
              name="appleId"
              placeholder="1234567890"
              value={formik.values.appleId}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
            />
            <Input
              label="Base Plan ID"
              name="basePlanId"
              placeholder="base-monthly"
              value={formik.values.basePlanId}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
            />
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Input
              label="Price (INR)"
              name="price"
              type="number"
              min={0}
              disabled={formik.values.isFree}
              value={formik.values.isFree ? '0' : formik.values.price}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.price && formik.errors.price ? formik.errors.price : undefined}
            />
            <Input
              label="Discount %"
              name="discountPercent"
              type="number"
              min={0}
              max={100}
              disabled={formik.values.isFree}
              value={formik.values.isFree ? '0' : formik.values.discountPercent}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.discountPercent && formik.errors.discountPercent ? formik.errors.discountPercent : undefined}
            />
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Final Price</label>
              <div
                title="Calculated automatically from Price and Discount %"
                className="flex h-11 w-full items-center rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-slate-100/80 dark:bg-[#0c152e]/80 px-3.5 text-sm font-mono font-extrabold text-cyan-600 dark:text-cyan-400"
              >
                ₹{formik.values.isFree ? 0 : computeFinalPrice(formik.values.price, formik.values.discountPercent)}
              </div>
            </div>
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

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Publication Year"
              name="publicationYear"
              type="number"
              value={formik.values.publicationYear}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.publicationYear && formik.errors.publicationYear ? formik.errors.publicationYear : undefined}
            />
            <Select
              label="Subscription Type"
              name="subscriptionType"
              value={formik.values.subscriptionType}
              onChange={(val) => formik.setFieldValue('subscriptionType', val)}
              options={SUBSCRIPTION_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            />
          </div>

          <div className="space-y-2 p-3 rounded-2xl border border-slate-200 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#0c152e]/50">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <ImagePlus className="w-3.5 h-3.5 text-cyan-500" />
                <span>Cover Image (Optional)</span>
              </label>
              <span className="text-[10px] text-slate-400 font-semibold">JPG, PNG, WEBP · Max 5MB</span>
            </div>

            {/* Current Active Cover Image Preview */}
            {editingBook?.coverUrl && !coverFile && (
              <div className="flex items-center gap-3 p-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 dark:bg-cyan-500/[0.07]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={editingBook.coverUrl}
                  alt={editingBook.title}
                  className="w-24 h-16 object-cover rounded-xl border border-cyan-500/30 shadow-xs shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse shrink-0" />
                    <p className="text-xs font-bold text-cyan-800 dark:text-cyan-300 truncate">Current Book Cover Active</p>
                  </div>
                  <p className="text-[10px] text-cyan-600 dark:text-cyan-400 truncate">Visible on book catalog & reader</p>
                </div>
                <a
                  href={editingBook.coverUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-700 dark:text-cyan-300 font-bold shrink-0 transition-colors text-[11px]"
                >
                  <span>View</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Newly Selected Cover Image Preview */}
            {coverFile && (
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-300">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold truncate">{coverFile.name}</p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                      {(coverFile.size / (1024 * 1024)).toFixed(2)} MB · Ready to upload
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCoverFile(null)}
                  className="text-slate-400 hover:text-rose-500 p-1 rounded transition-colors cursor-pointer"
                  title="Remove selection"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-[#1e2e56] bg-white dark:bg-[#091124] text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all">
              <UploadCloud className="w-3.5 h-3.5 text-cyan-500" />
              <span>
                {coverFile
                  ? 'Change cover image…'
                  : editingBook?.coverUrl
                    ? 'Upload new cover to replace current…'
                    : 'Choose a cover image…'}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          {/* Preview PDF Upload Section */}
          <div className="space-y-2 p-3 rounded-2xl border border-slate-200 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#0c152e]/50">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-500" />
                <span>Preview PDF / Sample Pages (Optional)</span>
              </label>
              <span className="text-[10px] text-slate-400 font-semibold">PDF · Max 50MB</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Students can view these preview sample pages before purchasing the book.
            </p>

            {/* Currently Active Preview PDF */}
            {editingBook?.previewPdfUrl && !removeExistingPreviewPdf && !previewPdfFile && (
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold text-amber-900 dark:text-amber-300 truncate">
                      {editingBook.previewPdfFileName || 'Attached Preview PDF'}
                    </p>
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 truncate">
                      {formatFileSize(editingBook.previewPdfSizeBytes) ? `${formatFileSize(editingBook.previewPdfSizeBytes)} · ` : ''}Active for student preview
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={editingBook.previewPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 font-bold transition-colors text-[11px]"
                  >
                    <span>View</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setRemoveExistingPreviewPdf(true)}
                    className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                    title="Remove attached preview PDF"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* If user clicked remove on existing Preview PDF */}
            {removeExistingPreviewPdf && !previewPdfFile && (
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 flex items-center justify-between">
                <span>Existing Preview PDF will be removed upon save.</span>
                <button
                  type="button"
                  onClick={() => setRemoveExistingPreviewPdf(false)}
                  className="font-bold underline text-[11px] cursor-pointer"
                >
                  Undo
                </button>
              </div>
            )}

            {/* Newly Selected Preview PDF File Preview */}
            {previewPdfFile && (
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-300">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold truncate">{previewPdfFile.name}</p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                      {(previewPdfFile.size / (1024 * 1024)).toFixed(2)} MB · Ready to upload
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPdfPreviewFile(null)}
                  className="text-slate-400 hover:text-rose-500 p-1 rounded transition-colors cursor-pointer"
                  title="Remove selection"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* PDF Picker Button */}
            <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-[#1e2e56] bg-white dark:bg-[#091124] text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:border-amber-500/50 hover:bg-amber-500/5 transition-all">
              <UploadCloud className="w-3.5 h-3.5 text-amber-500" />
              <span>
                {previewPdfFile
                  ? 'Change preview PDF file…'
                  : editingBook?.previewPdfUrl && !removeExistingPreviewPdf
                    ? 'Upload new preview PDF to replace current…'
                    : 'Choose a preview PDF to attach…'}
              </span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  if (file && file.size > MAX_PDF_BYTES) {
                    alert(`"${file.name}" exceeds the 50MB limit.`);
                    return;
                  }
                  setPdfPreviewFile(file);
                  setRemoveExistingPreviewPdf(false);
                }}
              />
            </label>

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

          <div className="space-y-2.5 pt-1">
            <ToggleSwitch
              icon={Eye}
              variant="emerald"
              label="Active"
              description="When ON, this book is published and visible to students."
              checked={formik.values.isPublished}
              onChange={(checked) => formik.setFieldValue('isPublished', checked)}
            />
            <ToggleSwitch
              icon={Gift}
              variant="cyan"
              label="Free Book"
              description="When ON, the price is zeroed out and this book is free to download."
              checked={formik.values.isFree}
              onChange={(checked) => formik.setFieldValue('isFree', checked)}
            />
            <ToggleSwitch
              icon={Globe}
              variant="amber"
              label="Visible to Guests"
              description="When ON, this book also shows in the public listing for signed-out users."
              checked={formik.values.visibleToGuests}
              onChange={(checked) => formik.setFieldValue('visibleToGuests', checked)}
            />
          </div>

          <Button type="submit" variant="gold" className="w-full font-bold shadow-md shadow-cyan-500/20" isLoading={formik.isSubmitting}>
            {editingBook ? 'Save Changes' : 'Create Book'}
          </Button>
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
    </div>
  );
}
