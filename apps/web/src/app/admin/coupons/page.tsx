'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button, Dialog, ConfirmDialog, Input, DatePicker, Badge, Pagination, Skeleton } from '@psc/ui';
import { Trash2, Ticket, Tag, Edit3 } from 'lucide-react';
import { Coupon } from '@psc/shared-types';
import { ApiClient } from '@/lib/api-client';
import { CouponsPageSkeleton } from '../admin-skeleton';

const sharedCouponFields = {
  code: Yup.string().trim().matches(/^[A-Za-z0-9]+$/, 'Code can only contain letters and numbers').required('Coupon code is required'),
  discountPercent: Yup.number().typeError('Must be a number').min(1, 'Must be at least 1%').max(100, 'Cannot exceed 100%').required('Discount percentage is required'),
  maxDiscount: Yup.number().typeError('Must be a number').positive('Must be greater than 0').required('Max discount amount is required'),
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// A new coupon must not be in the past.
const createCouponSchema = Yup.object({
  ...sharedCouponFields,
  validTill: Yup.date()
    .typeError('Enter a valid date')
    .min(startOfToday(), 'Valid-till date cannot be in the past')
    .required('Valid-till date is required'),
});
const editCouponSchema = Yup.object({
  ...sharedCouponFields,
  validTill: Yup.date().typeError('Enter a valid date').required('Valid-till date is required'),
});

/** `Coupon.validTill` comes back as a full ISO timestamp; the date picker only wants the date part. */
function toDateInputValue(iso?: string) {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getDefaultFutureDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d.toISOString().split('T')[0];
}

export default function AdminCouponsPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ type: 'toggle' | 'delete'; coupon: Coupon } | null>(null);

  const fetchCoupons = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const data = await ApiClient.getCoupons();
      const list = Array.isArray(data) ? data : (data as any)?.data || [];
      setCoupons(list);
    } catch (err: any) {
      console.error('Failed to fetch coupons:', err);
      if (!silent) {
        setError(err?.message || 'Failed to fetch coupons.');
        setCoupons([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchCoupons();
  }, [fetchCoupons]);

  const formik = useFormik({
    initialValues: { code: '', discountPercent: '20', maxDiscount: '100', validTill: getDefaultFutureDate() },
    validationSchema: editingCoupon ? editCouponSchema : createCouponSchema,
    onSubmit: async (values, { resetForm, setSubmitting, setFieldError }) => {
      const validTillIso = values.validTill.includes('T')
        ? values.validTill
        : new Date(`${values.validTill}T23:59:59.999Z`).toISOString();

      const payload = {
        code: values.code.trim().toUpperCase(),
        discountPercent: Number(values.discountPercent),
        maxDiscountAmount: Number(values.maxDiscount),
        validTill: validTillIso,
      };
      try {
        if (editingCoupon) {
          setCoupons((prev) =>
            prev.map((c) => (c.id === editingCoupon.id ? { ...c, ...payload } : c)),
          );
          setIsDialogOpen(false);
          setEditingCoupon(null);
          resetForm();
          await ApiClient.updateCoupon(editingCoupon.id, payload);
          await fetchCoupons();
        } else {
          setIsDialogOpen(false);
          setEditingCoupon(null);
          resetForm();
          await ApiClient.createCoupon(payload);
          await fetchCoupons();
        }
      } catch (err: any) {
        setFieldError('code', err.message || `Failed to ${editingCoupon ? 'update' : 'create'} coupon.`);
      } finally {
        setSubmitting(false);
      }
    },
  });

  const handleOpenCreateDialog = () => {
    setEditingCoupon(null);
    formik.resetForm({
      values: { code: '', discountPercent: '20', maxDiscount: '100', validTill: getDefaultFutureDate() },
    });
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    formik.resetForm({
      values: {
        code: coupon.code,
        discountPercent: String(coupon.discountPercent),
        maxDiscount: String(coupon.maxDiscountAmount),
        validTill: toDateInputValue(coupon.validTill) || getDefaultFutureDate(),
      },
    });
    setIsDialogOpen(true);
  };

  const handleToggleStatus = async (coupon: Coupon) => {
    const nextActive = !coupon.isActive;
    setCoupons((prev) => prev.map((c) => (c.id === coupon.id ? { ...c, isActive: nextActive } : c)));
    try {
      await ApiClient.setCouponActive(coupon.id, nextActive);
      await fetchCoupons();
    } catch (err: any) {
      setCoupons((prev) => prev.map((c) => (c.id === coupon.id ? { ...c, isActive: coupon.isActive } : c)));
      alert(err.message || 'Failed to update coupon status.');
    }
  };

  const handleDelete = async (id: string) => {
    const previousCoupons = coupons;
    setCoupons((prev) => prev.filter((c) => c.id !== id));
    try {
      await ApiClient.deleteCoupon(id);
      await fetchCoupons();
    } catch (err: any) {
      setCoupons(previousCoupons);
      alert(err.message || 'Failed to delete coupon.');
    }
  };

  const handleConfirmAction = () => {
    if (!confirmTarget) return;
    if (confirmTarget.type === 'toggle') {
      handleToggleStatus(confirmTarget.coupon);
    } else {
      handleDelete(confirmTarget.coupon.id);
    }
    setConfirmTarget(null);
  };

  if (!mounted || (loading && coupons.length === 0)) {
    return <CouponsPageSkeleton />;
  }

  const filteredCoupons = coupons.filter(
    (c) =>
      !searchTerm.trim() ||
      c.code.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  const totalItems = filteredCoupons.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedCoupons = filteredCoupons.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4 rounded-b-2xl">
      {/* Fixed Header */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">Coupon Code Management</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">Create and manage discount codes for courses and e-books.</p>
        </div>
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="w-full sm:w-64">
            <Input
              placeholder="Search coupon code..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <Button variant="gold" className="font-bold shadow-md shadow-amber-500/20 shrink-0" onClick={handleOpenCreateDialog}>
            + Create Coupon
          </Button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="shrink-0 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-between gap-3">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => fetchCoupons(false)}>Retry</Button>
        </div>
      )}

      {/* Scrollable Table */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border border-slate-200 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] admin-table-card p-0">
        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 relative">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Discount %</TableHead>
              <TableHead>Max Discount</TableHead>
              <TableHead>Valid Till</TableHead>
              <TableHead>Usage Count</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={`skeleton-${idx}`} className="border-b border-slate-200/80 dark:border-slate-800/60">
                  <TableCell className="py-4"><Skeleton className="h-5 w-24 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-16 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-20 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-24 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-16 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-20 rounded-lg" /></TableCell>
                  <TableCell className="py-4 text-right"><Skeleton className="h-8 w-24 rounded-xl ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : paginatedCoupons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center justify-center space-y-3 max-w-sm mx-auto">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
                      <Tag className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">No Coupon Match</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        No coupon codes available. Create your first coupon to offer discounts to students.
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedCoupons.map((coupon) => (
                <TableRow
                  key={coupon.id}
                  className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/80 dark:hover:bg-[#0c152e]/50 transition-colors"
                >
                  <TableCell className="font-mono font-bold text-cyan-600 dark:text-cyan-400 text-xs">
                    {coupon.code}
                  </TableCell>
                  <TableCell className="font-extrabold text-xs text-slate-900 dark:text-white">
                    {coupon.discountPercent}%
                  </TableCell>
                  <TableCell className="font-extrabold text-xs text-slate-900 dark:text-white">
                    ₹{coupon.maxDiscountAmount}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {formatDate(coupon.validTill)}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 dark:text-slate-300 font-bold">
                    {coupon.usageCount}
                  </TableCell>
                  <TableCell>
                    {coupon.isActive ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30">
                        Disabled
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditDialog(coupon)}
                        className="p-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-cyan-500"
                        title="Edit Coupon"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setConfirmTarget({
                            type: 'toggle',
                            coupon,
                          })
                        }
                        className={`px-2.5 py-1 text-xs font-bold ${
                          coupon.isActive
                            ? 'text-slate-600 dark:text-slate-300 hover:text-amber-500'
                            : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-500'
                        }`}
                      >
                        {coupon.isActive ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmTarget({ type: 'delete', coupon })}
                        className="p-1.5 text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-500/10"
                        title="Delete Coupon"
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

        <div className="shrink-0 px-4 py-3 border-t border-slate-200 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#091124]">
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
          setEditingCoupon(null);
        }}
        title={editingCoupon ? `Edit Coupon — ${editingCoupon.code}` : 'Create Discount Coupon'}
      >
        <form className="space-y-4 pt-2" onSubmit={formik.handleSubmit} noValidate>
          <Input
            label="Coupon Code"
            name="code"
            placeholder="e.g. KERALA50"
            value={formik.values.code}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.code && formik.errors.code ? formik.errors.code : undefined}
          />
          <Input
            label="Discount Percentage (%)"
            name="discountPercent"
            type="number"
            placeholder="20"
            value={formik.values.discountPercent}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.discountPercent && formik.errors.discountPercent ? formik.errors.discountPercent : undefined}
          />
          <Input
            label="Max Discount Amount (INR)"
            name="maxDiscount"
            type="number"
            placeholder="100"
            value={formik.values.maxDiscount}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.maxDiscount && formik.errors.maxDiscount ? formik.errors.maxDiscount : undefined}
          />
          <DatePicker
            label="Valid Until"
            value={formik.values.validTill}
            onChange={(date) => {
              formik.setFieldValue('validTill', date, true);
              formik.setFieldTouched('validTill', true, false);
            }}
            minDate={editingCoupon ? undefined : new Date().toISOString().split('T')[0]}
            error={formik.touched.validTill && formik.errors.validTill ? (formik.errors.validTill as string) : undefined}
          />
          <Button type="submit" variant="gold" className="w-full font-bold shadow-md shadow-amber-500/20" isLoading={formik.isSubmitting}>
            {editingCoupon ? 'Save Changes' : 'Create Coupon Code 🎟️'}
          </Button>
        </form>
      </Dialog>

      <ConfirmDialog
        isOpen={confirmTarget !== null}
        title={confirmTarget?.type === 'delete' ? 'Delete Coupon' : confirmTarget?.coupon.isActive ? 'Disable Coupon' : 'Enable Coupon'}
        description={
          confirmTarget?.type === 'delete'
            ? `This will permanently remove coupon "${confirmTarget.coupon.code}". This action cannot be undone.`
            : confirmTarget
            ? `${confirmTarget.coupon.isActive ? 'Disable' : 'Enable'} coupon "${confirmTarget.coupon.code}"?`
            : undefined
        }
        confirmLabel={confirmTarget?.type === 'delete' ? 'Delete' : confirmTarget?.coupon.isActive ? 'Disable' : 'Enable'}
        variant={confirmTarget?.type === 'delete' || confirmTarget?.coupon.isActive ? 'danger' : 'default'}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
