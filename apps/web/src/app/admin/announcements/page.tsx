'use client';

import React, { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Card, CardTitle, Input, Button, Badge } from '@psc/ui';

import { AdminSkeletonHeader, AdminSkeletonForm } from '../admin-skeleton';

const announcementSchema = Yup.object({
  bannerText: Yup.string().trim().max(200, 'Banner message must be 200 characters or fewer').required('Banner message is required'),
});

const DEFAULT_BANNER_TEXT = '⚡ Admission open for Kerala PSC LDC Batch 2026! Use code PSC2026 for 20% OFF';

export default function AdminAnnouncementsPage() {
  const [mounted, setMounted] = useState(false);
  const [initialBannerText, setInitialBannerText] = useState(DEFAULT_BANNER_TEXT);
  const [isSaved, setIsSaved] = useState(false);

  React.useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('psc_announcement_banner');
      if (saved) setInitialBannerText(saved);
    } catch (e) {}
  }, []);

  const formik = useFormik({
    initialValues: { bannerText: initialBannerText },
    validationSchema: announcementSchema,
    enableReinitialize: true,
    onSubmit: (values) => {
      try {
        localStorage.setItem('psc_announcement_banner', values.bannerText);
      } catch (e) {}
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
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
        <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">Announcement Banner Config</h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">Configure global announcement banners shown at the top of web and mobile apps.</p>
      </div>

      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base sm:text-lg text-slate-900 dark:text-white font-bold">Global Banner Message</CardTitle>
          <Badge variant="gold">Active</Badge>
        </div>

        <form onSubmit={formik.handleSubmit} className="space-y-4" noValidate>
          <Input
            label="Banner Announcement Message"
            name="bannerText"
            value={formik.values.bannerText}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.bannerText && formik.errors.bannerText ? formik.errors.bannerText : undefined}
          />
          <Button type="submit" variant="gold" className="w-full font-bold shadow-md shadow-cyan-500/20">
            Update Banner Message
          </Button>
          {isSaved && <p className="text-xs text-emerald-500 font-semibold text-center">✓ Global announcement banner updated successfully!</p>}
        </form>
      </Card>
    </div>
  );
}
