'use client';

import React, { useState, useCallback, useEffect } from 'react';
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
  Button,
  Dialog,
  ConfirmDialog,
  Input,
  Badge,
  Pagination,
  Skeleton,
} from '@psc/ui';
import { Trash2, Star, Edit3, MessageSquareQuote } from 'lucide-react';
import { CustomerReview } from '@psc/shared-types';
import { ApiClient } from '@/lib/api-client';
import { ReviewsPageSkeleton } from '../admin-skeleton';

const NAME_MIN = 2;
const NAME_MAX = 60;
const COMMENT_MIN = 10;
// Kept in step with the API's own limit so a review that passes here never
// bounces back off the server.
const COMMENT_MAX = 600;

const reviewSchema = Yup.object({
  customerName: Yup.string()
    .trim()
    .min(NAME_MIN, `Name must be at least ${NAME_MIN} characters`)
    .max(NAME_MAX, `Name cannot exceed ${NAME_MAX} characters`)
    .required('Customer name is required'),
  rating: Yup.number()
    .typeError('Select a star rating')
    .integer('Rating must be a whole number of stars')
    .min(1, 'Select at least 1 star')
    .max(5, 'Rating cannot exceed 5 stars')
    .required('Star rating is required'),
  comment: Yup.string()
    .trim()
    .min(COMMENT_MIN, `Review must be at least ${COMMENT_MIN} characters`)
    .max(COMMENT_MAX, `Review cannot exceed ${COMMENT_MAX} characters`)
    .required('Review comment is required'),
});

function formatDate(dateStr?: string | null) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return isNaN(d.getTime())
    ? dateStr
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Read-only star row for the table. */
function StarRow({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={
            i < rating
              ? 'w-3.5 h-3.5 text-amber-400 fill-amber-400'
              : 'w-3.5 h-3.5 text-slate-300 dark:text-slate-700'
          }
        />
      ))}
    </span>
  );
}

/** Click-or-keyboard star picker used inside the create/edit form. */
function StarRatingField({
  value,
  onChange,
  onBlur,
  error,
}: {
  value: number;
  onChange: (rating: number) => void;
  onBlur: () => void;
  error?: string;
}) {
  const [hovered, setHovered] = useState(0);
  const shown = hovered || value;

  return (
    <div className="w-full space-y-1.5">
      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
        Star Rating <span className="text-rose-500">*</span>
      </label>
      <div
        className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border bg-slate-100 dark:bg-[#070b18]/70 transition-all ${
          error ? 'border-rose-500' : 'border-slate-400 dark:border-slate-800'
        }`}
        onMouseLeave={() => setHovered(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            aria-pressed={value === star}
            onMouseEnter={() => setHovered(star)}
            onFocus={() => setHovered(star)}
            onBlur={() => {
              setHovered(0);
              onBlur();
            }}
            onClick={() => onChange(star)}
            className="p-0.5 rounded-md cursor-pointer transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
          >
            <Star
              className={
                star <= shown
                  ? 'w-6 h-6 text-amber-400 fill-amber-400'
                  : 'w-6 h-6 text-slate-300 dark:text-slate-700'
              }
            />
          </button>
        ))}
        <span className="ml-1 text-xs font-mono font-extrabold text-slate-600 dark:text-slate-300">
          {value ? `${value}.0 / 5` : 'Not rated'}
        </span>
      </div>
      {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
    </div>
  );
}

export default function AdminReviewsPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<CustomerReview | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{
    type: 'toggle' | 'delete';
    review: CustomerReview;
  } | null>(null);
  const [isConfirmLoading, setIsConfirmLoading] = useState(false);

  const fetchReviews = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const data = await ApiClient.getReviews();
      const list = Array.isArray(data) ? data : (data as any)?.data || [];
      setReviews(list);
    } catch (err: any) {
      console.error('Failed to fetch reviews:', err);
      if (!silent) {
        setError(err?.message || 'Failed to fetch customer reviews.');
        setReviews([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchReviews();
  }, [fetchReviews]);

  const formik = useFormik({
    initialValues: { customerName: '', rating: 5, comment: '' },
    validationSchema: reviewSchema,
    onSubmit: async (values, { resetForm, setSubmitting, setFieldError }) => {
      const payload = {
        customerName: values.customerName.trim(),
        rating: Number(values.rating),
        comment: values.comment.trim(),
      };
      try {
        if (editingReview) {
          await ApiClient.updateReview(editingReview.id, payload);
        } else {
          await ApiClient.createReview(payload);
        }
        setIsDialogOpen(false);
        setEditingReview(null);
        resetForm();
        await fetchReviews();
      } catch (err: any) {
        setFieldError(
          'customerName',
          err.message || `Failed to ${editingReview ? 'update' : 'create'} review.`,
        );
      } finally {
        setSubmitting(false);
      }
    },
  });

  const handleOpenCreateDialog = () => {
    setEditingReview(null);
    formik.resetForm({ values: { customerName: '', rating: 5, comment: '' } });
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (review: CustomerReview) => {
    setEditingReview(review);
    formik.resetForm({
      values: {
        customerName: review.customerName,
        rating: review.rating,
        comment: review.comment,
      },
    });
    setIsDialogOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!confirmTarget) return;
    setIsConfirmLoading(true);
    try {
      if (confirmTarget.type === 'toggle') {
        const nextActive = !confirmTarget.review.isActive;
        await ApiClient.setReviewActive(confirmTarget.review.id, nextActive);
      } else {
        await ApiClient.deleteReview(confirmTarget.review.id);
      }
      setConfirmTarget(null);
      await fetchReviews();
    } catch (err: any) {
      alert(err.message || 'Failed to update review.');
    } finally {
      setIsConfirmLoading(false);
    }
  };

  if (!mounted || (loading && reviews.length === 0)) {
    return <ReviewsPageSkeleton />;
  }

  const query = searchTerm.toLowerCase().trim();
  const filteredReviews = reviews.filter(
    (r) =>
      !query ||
      r.customerName.toLowerCase().includes(query) ||
      r.comment.toLowerCase().includes(query),
  );

  const totalItems = filteredReviews.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedReviews = filteredReviews.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const activeCount = reviews.filter((r) => r.isActive).length;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4 rounded-b-2xl">
      {/* Fixed Header */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Customer Reviews
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">
            Manage the testimonials shown on the home page — {activeCount} of {reviews.length} are live.
          </p>
        </div>
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="w-full sm:w-64">
            <Input
              placeholder="Search name or comment..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <Button
            variant="gold"
            className="font-bold shadow-md shadow-amber-500/20 shrink-0"
            onClick={handleOpenCreateDialog}
          >
            + Add Review
          </Button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="shrink-0 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-between gap-3">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => fetchReviews(false)}>
            Retry
          </Button>
        </div>
      )}

      {/* Scrollable Table */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border border-slate-200 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] admin-table-card p-0">
        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 relative">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Review</TableHead>
                <TableHead>Added On</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow
                    key={`skeleton-${idx}`}
                    className="border-b border-slate-200/80 dark:border-slate-800/60"
                  >
                    <TableCell className="py-4"><Skeleton className="h-5 w-28 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-24 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-64 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-24 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-20 rounded-lg" /></TableCell>
                    <TableCell className="py-4 text-right"><Skeleton className="h-8 w-24 rounded-xl ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : paginatedReviews.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center space-y-3 max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
                        <MessageSquareQuote className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                          No Reviews Yet
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          Add your first customer testimonial — active reviews appear on the home page
                          below the quiz section.
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedReviews.map((review) => (
                  <TableRow key={review.id}>
                    <TableCell className="font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {review.customerName}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <StarRow rating={review.rating} />
                        <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                          {review.rating}.0
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                        {review.comment}
                      </p>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatDate(review.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={review.isActive ? 'success' : 'danger'}>
                        {review.isActive ? 'Active' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="p-2 rounded-xl transition-all shadow-sm"
                          title="Edit Review"
                          aria-label="Edit Review"
                          onClick={() => handleOpenEditDialog(review)}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={review.isActive ? 'outline' : 'primary'}
                          onClick={() => setConfirmTarget({ type: 'toggle', review })}
                        >
                          {review.isActive ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          className="p-2 rounded-xl transition-all shadow-sm"
                          title="Delete Review"
                          aria-label="Delete Review"
                          onClick={() => setConfirmTarget({ type: 'delete', review })}
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
        onClose={() => {
          setIsDialogOpen(false);
          setEditingReview(null);
        }}
        title={editingReview ? `Edit Review — ${editingReview.customerName}` : 'Add Customer Review'}
      >
        <form className="space-y-4 pt-2" onSubmit={formik.handleSubmit} noValidate>
          <Input
            label="Customer Name"
            name="customerName"
            placeholder="e.g. Anjali Menon"
            maxLength={NAME_MAX}
            value={formik.values.customerName}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={
              formik.touched.customerName && formik.errors.customerName
                ? formik.errors.customerName
                : undefined
            }
          />

          <StarRatingField
            value={formik.values.rating}
            onChange={(rating) => {
              formik.setFieldValue('rating', rating, true);
              formik.setFieldTouched('rating', true, false);
            }}
            onBlur={() => formik.setFieldTouched('rating', true, true)}
            error={
              formik.touched.rating && formik.errors.rating
                ? (formik.errors.rating as string)
                : undefined
            }
          />

          <div className="w-full space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="review-comment"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
              >
                Review / Comment <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] font-mono font-bold text-slate-400">
                {formik.values.comment.trim().length}/{COMMENT_MAX}
              </span>
            </div>
            <textarea
              id="review-comment"
              name="comment"
              rows={4}
              maxLength={COMMENT_MAX}
              placeholder="What did this customer say about the books, quizzes, or support?"
              value={formik.values.comment}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              className={`w-full px-3.5 py-2.5 rounded-xl text-sm border bg-slate-100 dark:bg-[#070b18]/70 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all shadow-xs resize-y ${
                formik.touched.comment && formik.errors.comment
                  ? 'border-rose-500 focus:ring-rose-500/30'
                  : 'border-slate-400 dark:border-slate-800 focus:border-cyan-500/60 focus:ring-cyan-500/40'
              }`}
            />
            {formik.touched.comment && formik.errors.comment && (
              <p className="text-xs text-rose-500 font-medium">{formik.errors.comment}</p>
            )}
          </div>

          <Button
            type="submit"
            variant="gold"
            className="w-full font-bold shadow-md shadow-amber-500/20"
            isLoading={formik.isSubmitting}
          >
            {editingReview ? 'Save Changes' : 'Publish Review ⭐'}
          </Button>
        </form>
      </Dialog>

      <ConfirmDialog
        isOpen={confirmTarget !== null}
        title={
          confirmTarget?.type === 'delete'
            ? 'Delete Review'
            : confirmTarget?.review.isActive
            ? 'Disable Review'
            : 'Enable Review'
        }
        description={
          confirmTarget?.type === 'delete'
            ? `This will permanently remove the review by "${confirmTarget.review.customerName}". This action cannot be undone.`
            : confirmTarget
            ? confirmTarget.review.isActive
              ? `Hide "${confirmTarget.review.customerName}" from the home page reviews section?`
              : `Show "${confirmTarget.review.customerName}" in the home page reviews section?`
            : undefined
        }
        confirmLabel={
          confirmTarget?.type === 'delete'
            ? 'Delete'
            : confirmTarget?.review.isActive
            ? 'Disable'
            : 'Enable'
        }
        variant={
          confirmTarget?.type === 'delete' || confirmTarget?.review.isActive ? 'danger' : 'default'
        }
        isLoading={isConfirmLoading}
        onConfirm={handleConfirmAction}
        onCancel={() => !isConfirmLoading && setConfirmTarget(null)}
      />
    </div>
  );
}
