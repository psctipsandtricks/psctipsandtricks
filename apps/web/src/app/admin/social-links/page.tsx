'use client';

import React, { useEffect, useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Card, CardTitle, CardDescription, Input, Button } from '@psc/ui';
import { ExternalLink, Save, CheckCircle2 } from 'lucide-react';
import { SocialLinks } from '@psc/shared-types';
import { ApiClient } from '@/lib/api-client';
import { SocialLinksPageSkeleton } from '../admin-skeleton';
import { TelegramIcon, InstagramIcon, YoutubeIcon, FacebookIcon, TwitterIcon } from '../../social-icons';

/** Kept in sync with the server's `UpdateSocialLinksDto` — empty fails silently to "unset", so only a real mismatch should show an inline error. */
const PLATFORMS = [
  {
    key: 'telegramUrl' as const,
    label: 'Telegram',
    placeholder: 'https://t.me/yourchannel',
    icon: TelegramIcon,
    accent: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
    pattern: /^https?:\/\/(www\.)?(t\.me|telegram\.me|telegram\.org)\//i,
    hint: 'Must be a t.me, telegram.me, or telegram.org link.',
  },
  {
    key: 'instagramUrl' as const,
    label: 'Instagram',
    placeholder: 'https://instagram.com/yourpage',
    icon: InstagramIcon,
    accent: 'bg-fuchsia-500/10 text-fuchsia-500 border-fuchsia-500/20',
    pattern: /^https?:\/\/(www\.)?(instagram\.com|instagr\.am)\//i,
    hint: 'Must be an instagram.com link.',
  },
  {
    key: 'youtubeUrl' as const,
    label: 'YouTube',
    placeholder: 'https://youtube.com/@yourchannel',
    icon: YoutubeIcon,
    accent: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    pattern: /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)\//i,
    hint: 'Must be a youtube.com or youtu.be link.',
  },
  {
    key: 'facebookUrl' as const,
    label: 'Facebook',
    placeholder: 'https://facebook.com/yourpage',
    icon: FacebookIcon,
    accent: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    pattern: /^https?:\/\/(www\.)?(facebook\.com|fb\.com|fb\.me)\//i,
    hint: 'Must be a facebook.com link.',
  },
  {
    key: 'twitterUrl' as const,
    label: 'Twitter',
    placeholder: 'https://x.com/yourhandle',
    icon: TwitterIcon,
    accent: 'bg-slate-500/10 text-slate-500 dark:text-slate-300 border-slate-500/20',
    pattern: /^https?:\/\/(www\.)?(twitter\.com|x\.com)\//i,
    hint: 'Must be a twitter.com or x.com link.',
  },
];

const socialLinksSchema = Yup.object(
  Object.fromEntries(
    PLATFORMS.map((p) => [
      p.key,
      Yup.string()
        .trim()
        .test('platform-domain', p.hint, (value) => !value || p.pattern.test(value)),
    ]),
  ),
);

type FormValues = {
  telegramUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  facebookUrl: string;
  twitterUrl: string;
};

export default function AdminSocialLinksPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<FormValues>({
    telegramUrl: '',
    instagramUrl: '',
    youtubeUrl: '',
    facebookUrl: '',
    twitterUrl: '',
  });

  const formik = useFormik<FormValues>({
    initialValues,
    validationSchema: socialLinksSchema,
    enableReinitialize: true,
    onSubmit: async (values, { setSubmitting }) => {
      try {
        setError(null);
        const updated = await ApiClient.updateSocialLinks({
          telegramUrl: values.telegramUrl.trim(),
          instagramUrl: values.instagramUrl.trim(),
          youtubeUrl: values.youtubeUrl.trim(),
          facebookUrl: values.facebookUrl.trim(),
          twitterUrl: values.twitterUrl.trim(),
        });
        setInitialValues({
          telegramUrl: updated.telegramUrl || '',
          instagramUrl: updated.instagramUrl || '',
          youtubeUrl: updated.youtubeUrl || '',
          facebookUrl: updated.facebookUrl || '',
          twitterUrl: updated.twitterUrl || '',
        });
        setSavedAt(Date.now());
      } catch (err: any) {
        setError(err?.message || 'Failed to save social links.');
      } finally {
        setSubmitting(false);
      }
    },
  });

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setLoading(true);
        const data: SocialLinks = await ApiClient.getSocialLinks();
        if (!isMounted) return;
        setInitialValues({
          telegramUrl: data.telegramUrl || '',
          instagramUrl: data.instagramUrl || '',
          youtubeUrl: data.youtubeUrl || '',
          facebookUrl: data.facebookUrl || '',
          twitterUrl: data.twitterUrl || '',
        });
      } catch (err: any) {
        if (isMounted) setError(err?.message || 'Failed to load social links.');
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!savedAt) return;
    const timer = setTimeout(() => setSavedAt(null), 4000);
    return () => clearTimeout(timer);
  }, [savedAt]);

  if (loading) {
    return <SocialLinksPageSkeleton />;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          Social Media Links
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">
          Configure the Telegram, Instagram, YouTube, Facebook, and Twitter links shown in the home page social
          section. Leave a field blank to hide that platform.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
          {error}
        </div>
      )}

      <Card className="space-y-5">
        <div>
          <CardTitle>Platform Links</CardTitle>
          <CardDescription>Only platforms with a saved link will appear on the home page.</CardDescription>
        </div>

        <form onSubmit={formik.handleSubmit} className="space-y-4" noValidate>
          {PLATFORMS.map(({ key, label, placeholder, icon: Icon, accent }) => {
            const value = formik.values[key];
            const touched = formik.touched[key];
            const fieldError = formik.errors[key];
            const isValidForPreview = Boolean(value) && !fieldError;

            return (
              <div key={key} className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-[#1e2e56] bg-slate-50/60 dark:bg-[#0c152e]/50">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 mt-1 ${accent}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label htmlFor={key} className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      {label}
                    </label>
                    {isValidForPreview && (
                      <a
                        href={value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline shrink-0"
                      >
                        <span>Open link</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <Input
                    id={key}
                    name={key}
                    placeholder={placeholder}
                    value={value}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={touched && fieldError ? String(fieldError) : undefined}
                  />
                </div>
              </div>
            );
          })}

          <div className="flex items-center gap-3 pt-1">
            <Button
              type="submit"
              variant="gold"
              className="font-bold shadow-md shadow-amber-500/20"
              isLoading={formik.isSubmitting}
              disabled={!formik.dirty}
            >
              <Save className="w-4 h-4 mr-1.5" />
              Save Changes
            </Button>
            {savedAt && !formik.dirty && !formik.isSubmitting && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-200">
                <CheckCircle2 className="w-4 h-4" />
                Saved
              </span>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
