'use client';

import React, { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Card, Input, Button } from '@psc/ui';

import { AdminSkeletonHeader, AdminSkeletonForm } from '../admin-skeleton';

const notificationSchema = Yup.object({
  title: Yup.string().trim().max(100, 'Title must be 100 characters or fewer').required('Notification title is required'),
  body: Yup.string().trim().max(500, 'Message body must be 500 characters or fewer').required('Message body is required'),
});

export default function AdminNotificationsPage() {
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const formik = useFormik({
    initialValues: { title: '', body: '' },
    validationSchema: notificationSchema,
    onSubmit: (values, { setSubmitting, resetForm }) => {
      setTimeout(() => {
        setSubmitting(false);
        alert('🚀 FCM Push Notification queued successfully!');
        resetForm();
      }, 1200);
    },
  });

  if (!mounted) {
    return (
      <div className="max-w-xl space-y-6">
        <AdminSkeletonHeader />
        <AdminSkeletonForm />
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-4 sm:space-y-6 px-1 sm:px-0">
      <div>
        <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">Push Notification Composer</h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">Broadcast Firebase FCM push notifications to student mobile & web apps.</p>
      </div>

      <Card className="p-4 sm:p-6 space-y-4">
        <form onSubmit={formik.handleSubmit} className="space-y-4" noValidate>
          <Input
            label="Notification Title"
            name="title"
            placeholder="New Live Mock Test is Live!"
            value={formik.values.title}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.title && formik.errors.title ? formik.errors.title : undefined}
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Message Body</label>
            <textarea
              name="body"
              className="w-full h-32 px-3.5 py-2.5 glass-input text-sm font-medium focus:ring-cyan-500/50"
              placeholder="Join 1,000+ aspirants taking the Kerala PSC LDC Mock Test right now..."
              value={formik.values.body}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
            />
            {formik.touched.body && formik.errors.body && (
              <p className="text-xs text-rose-500 font-medium">{formik.errors.body}</p>
            )}
          </div>
          <Button type="submit" variant="gold" size="lg" className="w-full font-bold shadow-md shadow-cyan-500/20" isLoading={formik.isSubmitting}>
            Dispatch Push Notification
          </Button>
        </form>
      </Card>
    </div>
  );
}
