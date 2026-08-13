'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button, Dialog, ConfirmDialog, Input, ToggleSwitch, Badge, Pagination, Skeleton } from '@psc/ui';
import { AdminSkeletonHeader, AdminSkeletonTable } from '../admin-skeleton';
import { Edit3, Trash2, BookOpen, Library, ImagePlus, Eye, Gift, Globe } from 'lucide-react';
import { Book } from '@psc/shared-types';
import { ApiClient } from '@/lib/api-client';

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
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);

  const fetchBooks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ApiClient.getBooks();
      setBooks(data);
    } catch (err) {
      console.error('Failed to fetch books:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchBooks();
  }, [fetchBooks]);

  const formik = useFormik({
    initialValues: emptyValues,
    validationSchema: bookSchema,
    onSubmit: async (values, { resetForm, setSubmitting, setFieldError }) => {
      try {
        // "Free Book" is the single source of truth for whether payment is
        // required: ticking it zeroes the price and clears the premium flag
        // the checkout reads, so the two can never disagree.
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

        if (editingBook) {
          await ApiClient.updateBook(editingBook.id, payload);
          if (coverFile) await ApiClient.uploadBookCover(editingBook.id, coverFile);
        } else {
          if (!coverFile) {
            setFieldError('title', 'Choose a cover image before publishing.');
            setSubmitting(false);
            return;
          }
          const created = await ApiClient.createBook({ ...payload, coverUrl: '' });
          await ApiClient.uploadBookCover(created.id, coverFile);
        }

        resetForm();
        setCoverFile(null);
        setIsDialogOpen(false);
        setEditingBook(null);
        await fetchBooks();
      } catch (err: any) {
        setFieldError('title', err.message || `Failed to ${editingBook ? 'update' : 'create'} book.`);
      } finally {
        setSubmitting(false);
      }
    },
  });

  const handleOpenCreateDialog = () => {
    setEditingBook(null);
    setCoverFile(null);
    formik.resetForm({ values: emptyValues });
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (book: Book) => {
    setEditingBook(book);
    setCoverFile(null);
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

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  if (!mounted) {
    return (
      <div className="space-y-6">
        <AdminSkeletonHeader />
        <AdminSkeletonTable rowsCount={4} colsCount={7} />
      </div>
    );
  }

  const handleDeleteBook = async (id: string) => {
    const previousBooks = books;
    setBooks((prev) => prev.filter((b) => b.id !== id));
    try {
      await ApiClient.deleteBook(id);
    } catch (err: any) {
      setBooks(previousBooks);
      alert(err.message || 'Failed to delete book.');
    }
  };

  const totalItems = books.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedBooks = books.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4">
      {/* Fixed Header */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">E-Book Content Management</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">Upload and manage PSC PDF handbooks and question banks.</p>
        </div>
        <Button variant="gold" className="font-bold shadow-md shadow-amber-500/20 w-full sm:w-auto shrink-0" onClick={handleOpenCreateDialog}>
          + Add New Book
        </Button>
      </div>

      {/* Scrollable Table */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border border-slate-200/80 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] shadow-sm p-0">
        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 relative">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"><span className="sr-only">Cover</span></TableHead>
              <TableHead>Book Title</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Downloads</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={`skeleton-${idx}`} className="border-b border-slate-200/80 dark:border-slate-800/60">
                  <TableCell className="py-4 w-12"><Skeleton className="h-9 w-9 rounded-xl" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-48 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-32 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-24 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-16 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-20 rounded-lg" /></TableCell>
                  <TableCell className="py-4 text-right"><Skeleton className="h-8 w-20 rounded-xl ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : paginatedBooks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
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
                  <TableCell className="w-12">
                    {book.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={book.coverUrl} alt="" className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-[#1e2e56]" />
                    ) : (
                      <div className="w-9 h-9 bg-slate-100 dark:bg-[#091124] rounded-xl flex items-center justify-center text-cyan-400 border border-slate-200 dark:border-[#1e2e56]">
                        <BookOpen className="w-4 h-4" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-bold text-slate-900 dark:text-white">{book.title}</TableCell>
                  <TableCell className="text-slate-700 dark:text-slate-300 font-medium">{book.author}</TableCell>
                  <TableCell><Badge variant="gold">{book.category}</Badge></TableCell>
                  <TableCell className="font-mono text-cyan-400 font-extrabold">₹{book.price}</TableCell>
                  <TableCell className="font-mono text-slate-700 dark:text-slate-300">{book.downloadCount.toLocaleString()}</TableCell>
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
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Subscription Type</label>
              <select
                name="subscriptionType"
                value={formik.values.subscriptionType}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="h-11 w-full px-3 rounded-xl border border-slate-300 dark:border-[#1e2e56] bg-white dark:bg-[#091124] text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/60 cursor-pointer"
              >
                {SUBSCRIPTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              Cover Image {editingBook ? '(leave blank to keep current)' : ''}
            </label>
            <label className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-[#1e2e56] bg-slate-50/70 dark:bg-[#091124] text-sm cursor-pointer hover:border-cyan-500/50 transition-colors">
              <ImagePlus className="w-4 h-4 text-cyan-500 shrink-0" />
              <span className="text-slate-600 dark:text-slate-300 truncate">{coverFile ? coverFile.name : 'Choose a cover image…'}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
              />
            </label>
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
