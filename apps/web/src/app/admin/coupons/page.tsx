'use client';

import React, { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button, Dialog, Input, Badge, Pagination, Skeleton } from '@psc/ui';
import { Trash2, Ticket, Tag } from 'lucide-react';
import { AdminSkeletonHeader, AdminSkeletonTable } from '../admin-skeleton';

const couponSchema = Yup.object({
  code: Yup.string().trim().matches(/^[A-Za-z0-9]+$/, 'Code can only contain letters and numbers').required('Coupon code is required'),
  discountPercent: Yup.number().typeError('Must be a number').min(1, 'Must be at least 1%').max(100, 'Cannot exceed 100%').required('Discount percentage is required'),
  maxDiscount: Yup.number().typeError('Must be a number').positive('Must be greater than 0').required('Max discount amount is required'),
  validTill: Yup.date().typeError('Enter a valid date').min(new Date(), 'Valid-till date must be in the future').required('Valid-till date is required'),
});

interface CouponItem {
  id: string;
  code: string;
  discountPercent: number;
  maxDiscountAmount: number;
  validTill: string;
  usageCount: number;
  isActive: boolean;
}

export default function AdminCouponsPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [coupons, setCoupons] = useState<CouponItem[]>([
    { id: 'c-1', code: 'PSC2026', discountPercent: 20, maxDiscountAmount: 100, validTill: '2027-12-31', usageCount: 142, isActive: true },
    { id: 'c-2', code: 'LDC50', discountPercent: 15, maxDiscountAmount: 75, validTill: '2026-10-31', usageCount: 68, isActive: true },
    { id: 'c-3', code: 'WELCOME10', discountPercent: 10, maxDiscountAmount: 50, validTill: '2026-08-31', usageCount: 210, isActive: false },
  ]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  React.useEffect(() => {
    setMounted(true);
    setLoading(false);
  }, []);

  const formik = useFormik({
    initialValues: { code: '', discountPercent: '20', maxDiscount: '100', validTill: '2027-12-31' },
    validationSchema: couponSchema,
    onSubmit: (values, { resetForm }) => {
      const newCoupon: CouponItem = {
        id: `c-${Date.now()}`,
        code: values.code.trim().toUpperCase(),
        discountPercent: Number(values.discountPercent),
        maxDiscountAmount: Number(values.maxDiscount),
        validTill: values.validTill,
        usageCount: 0,
        isActive: true,
      };
      setCoupons((prev) => [newCoupon, ...prev]);
      resetForm();
    },
  });

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

  const handleToggleStatus = (id: string) => {
    setCoupons(
      coupons.map((c) => (c.id === id ? { ...c, isActive: !c.isActive } : c))
    );
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this coupon?')) {
      setCoupons(coupons.filter((c) => c.id !== id));
    }
  };

  const totalItems = coupons.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedCoupons = coupons.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-4 sm:space-y-6 px-1 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">Coupon Code Management</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">Create and manage discount codes for courses and e-books.</p>
        </div>
        <Button variant="gold" className="font-bold shadow-md shadow-amber-500/20 w-full sm:w-auto shrink-0" onClick={() => setIsDialogOpen(true)}>
          + Create Coupon
        </Button>
      </div>

      <Card>
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
              <TableRow key={coupon.id}>
                <TableCell className="font-mono font-bold text-cyan-400">{coupon.code}</TableCell>
                <TableCell className="font-bold">{coupon.discountPercent}%</TableCell>
                <TableCell className="font-mono font-semibold">₹{coupon.maxDiscountAmount}</TableCell>
                <TableCell className="font-mono text-slate-700 dark:text-slate-300">{coupon.usageCount}</TableCell>
                <TableCell className="font-mono text-xs text-slate-500 dark:text-slate-400">{coupon.validTill}</TableCell>
                <TableCell>
                  <Badge variant={coupon.isActive ? 'success' : 'danger'}>
                    {coupon.isActive ? 'Active' : 'Disabled'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button size="sm" variant={coupon.isActive ? 'outline' : 'primary'} onClick={() => handleToggleStatus(coupon.id)}>
                      {coupon.isActive ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      className="p-2 rounded-xl transition-all shadow-sm"
                      title="Delete Coupon"
                      aria-label="Delete Coupon"
                      onClick={() => handleDelete(coupon.id)}
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

      <Dialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title="Create Discount Coupon">
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
          <Input
            label="Valid Until"
            name="validTill"
            type="date"
            value={formik.values.validTill}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.validTill && formik.errors.validTill ? (formik.errors.validTill as string) : undefined}
          />
          <Button type="submit" variant="gold" className="w-full font-bold shadow-md shadow-amber-500/20">
            Create Coupon Code 🎟️
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
