'use client';

import React, { useEffect, useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Card, CardTitle, CardDescription, Input, Button, ToggleSwitch, ConfirmDialog } from '@psc/ui';
import { Smartphone, Zap, Layers, CheckCircle2, Save, ShieldAlert } from 'lucide-react';
import { AppUpdateConfig } from '@psc/shared-types';
import { ApiClient } from '@/lib/api-client';
import { AppUpdatePageSkeleton } from '../admin-skeleton';
import { compareVersions, isValidVersion } from '@/lib/version';

type FormValues = {
  enabled: boolean;
  updateMode: 'immediate' | 'flexible';
  minimumVersion: string;
  latestVersion: string;
  forceUpdate: boolean;
  message: string;
};

/** What a brand-new environment gets before an admin ever saves — matches the
 * server's own defaults in `AppUpdateConfig` so the form never shows a value
 * the backend wouldn't actually be enforcing yet. */
const DEFAULTS: FormValues = {
  enabled: true,
  updateMode: 'immediate',
  minimumVersion: '1.0.0',
  latestVersion: '1.0.0',
  forceUpdate: true,
  message: 'A new version of the app is available. Please update to continue.',
};

const versionField = (label: string) =>
  Yup.string()
    .trim()
    .required(`${label} is required`)
    .test('format', `${label} must look like 2.5.0 (major.minor.patch)`, (v) => !!v && isValidVersion(v));

const schema = Yup.object({
  enabled: Yup.boolean(),
  updateMode: Yup.string().oneOf(['immediate', 'flexible']),
  minimumVersion: versionField('Minimum supported version'),
  latestVersion: versionField('Latest version'),
  forceUpdate: Yup.boolean(),
  message: Yup.string().trim().min(1, 'Update message is required').max(500, 'Keep it under 500 characters'),
}).test(
  'min-lte-latest',
  'Minimum supported version cannot be greater than the latest version',
  (values) =>
    !values?.minimumVersion ||
    !values?.latestVersion ||
    !isValidVersion(values.minimumVersion) ||
    !isValidVersion(values.latestVersion) ||
    compareVersions(values.minimumVersion, values.latestVersion) <= 0,
);

export default function AdminAppUpdatePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [initialValues, setInitialValues] = useState<FormValues>(DEFAULTS);
  const [live, setLive] = useState<AppUpdateConfig | null>(null);

  const formik = useFormik<FormValues>({
    initialValues,
    validationSchema: schema,
    enableReinitialize: true,
    onSubmit: async (values, { setSubmitting }) => {
      // Force Update is the one setting that can put every signed-in student
      // on an update screen they cannot dismiss — a second tap here is
      // cheaper than a support inbox full of "the app won't open" reports.
      if (values.forceUpdate && !confirmOpen) {
        setConfirmOpen(true);
        setSubmitting(false);
        return;
      }
      await save(values, setSubmitting);
    },
  });

  const save = async (values: FormValues, setSubmitting: (v: boolean) => void) => {
    try {
      setError(null);
      const updated = await ApiClient.updateAppUpdateConfig(values);
      setLive(updated);
      setInitialValues({
        enabled: updated.enabled,
        updateMode: updated.updateMode,
        minimumVersion: updated.minimumVersion,
        latestVersion: updated.latestVersion,
        forceUpdate: updated.forceUpdate,
        message: updated.message,
      });
      setSavedAt(Date.now());
    } catch (err: any) {
      setError(err?.message || 'Failed to save app update settings.');
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await ApiClient.getAppUpdateConfig();
        if (!isMounted) return;
        setLive(data);
        setInitialValues({
          enabled: data.enabled,
          updateMode: data.updateMode,
          minimumVersion: data.minimumVersion,
          latestVersion: data.latestVersion,
          forceUpdate: data.forceUpdate,
          message: data.message,
        });
      } catch (err: any) {
        if (isMounted) setError(err?.message || 'Failed to load app update settings.');
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

  if (loading) return <AppUpdatePageSkeleton />;

  const v = formik.values;
  const minLatestError =
    isValidVersion(v.minimumVersion) && isValidVersion(v.latestVersion) && compareVersions(v.minimumVersion, v.latestVersion) > 0;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">App Update Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">
          Controls the Android in-app update the mobile app checks for on every launch. Nothing here is hard-coded into
          the app — every install reads this configuration fresh.
        </p>
      </div>

      {live && (
        <div className="flex flex-wrap items-center gap-2 p-3.5 rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-slate-50/60 dark:bg-[#0c152e]/50 text-xs">
          <span className="font-bold text-slate-700 dark:text-slate-300">Currently active:</span>
          <span className={`px-2 py-0.5 rounded-full font-bold ${live.enabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-500/10 text-slate-500'}`}>
            {live.enabled ? 'Check ON' : 'Check OFF'}
          </span>
          <span className="px-2 py-0.5 rounded-full font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 capitalize">
            {live.updateMode}
          </span>
          {live.forceUpdate && (
            <span className="px-2 py-0.5 rounded-full font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400">Force ON</span>
          )}
          <span className="text-slate-500 dark:text-slate-400">
            min {live.minimumVersion} · latest {live.latestVersion}
          </span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
          {error}
        </div>
      )}

      <Card className="space-y-5">
        <div>
          <CardTitle>Android In-App Update</CardTitle>
          <CardDescription>
            Applies to every Android install through Google Play's in-app update mechanism — no custom APK downloads.
          </CardDescription>
        </div>

        <form onSubmit={formik.handleSubmit} className="space-y-5" noValidate>
          <fieldset disabled={formik.isSubmitting} className="space-y-5 disabled:opacity-80 disabled:pointer-events-none disabled:cursor-wait">
          <ToggleSwitch
            checked={v.enabled}
            onChange={(checked) => formik.setFieldValue('enabled', checked)}
            icon={Smartphone}
            variant="cyan"
            label="Enable Update Check"
            description="When off, the app never contacts this endpoint's update logic and behaves as if no update exists."
          />

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Update Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ModeCard
                icon={Zap}
                title="Immediate Update"
                description="Full-screen, blocking. The student must update before using the app again."
                selected={v.updateMode === 'immediate'}
                onSelect={() => formik.setFieldValue('updateMode', 'immediate')}
              />
              <ModeCard
                icon={Layers}
                title="Flexible Update"
                description="Downloads in the background; the student keeps using the app and installs it when ready."
                selected={v.updateMode === 'flexible'}
                onSelect={() => formik.setFieldValue('updateMode', 'flexible')}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Minimum Supported Version"
              name="minimumVersion"
              placeholder="2.5.0"
              value={v.minimumVersion}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.minimumVersion ? (formik.errors.minimumVersion as string) : undefined}
              helperText="Installs older than this are always treated as mandatory, regardless of Update Mode."
            />
            <Input
              label="Latest Version"
              name="latestVersion"
              placeholder="2.6.0"
              value={v.latestVersion}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.latestVersion ? (formik.errors.latestVersion as string) : undefined}
              helperText="The version currently live on Google Play."
            />
          </div>
          {minLatestError && (
            <p className="-mt-2 text-xs font-semibold text-rose-500 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              Minimum supported version cannot be greater than the latest version.
            </p>
          )}

          <ToggleSwitch
            checked={v.forceUpdate}
            onChange={(checked) => formik.setFieldValue('forceUpdate', checked)}
            icon={ShieldAlert}
            variant="rose"
            label="Force Update"
            description="No Later/Skip option. Combined with Immediate Update, the student cannot continue without updating."
          />

          <div className="w-full space-y-1.5">
            <label htmlFor="message" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Update Message
            </label>
            <textarea
              id="message"
              name="message"
              rows={3}
              value={v.message}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              placeholder="A new version of the app is available. Please update to continue."
              className="flex w-full rounded-xl border border-slate-400 dark:border-slate-800 bg-slate-100 dark:bg-[#070b18]/70 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/60 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 shadow-xs resize-none"
            />
            {formik.touched.message && formik.errors.message ? (
              <p className="text-xs text-rose-500 font-medium">{formik.errors.message as string}</p>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">Shown on the update screen, and as the fallback message when Google Play has no update available yet.</p>
            )}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button
              type="submit"
              variant="gold"
              className="font-bold shadow-md shadow-amber-500/20"
              isLoading={formik.isSubmitting}
              disabled={!formik.dirty || !formik.isValid || formik.isSubmitting}
            >
              <Save className="w-4 h-4 mr-1.5" />
              Save Settings
            </Button>
            {savedAt && !formik.dirty && !formik.isSubmitting && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-200">
                <CheckCircle2 className="w-4 h-4" />
                Saved
              </span>
            )}
          </div>
          </fieldset>
        </form>
      </Card>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Force update for every student?"
        description={`With Force Update on${
          v.updateMode === 'immediate' ? ' and Update Mode set to Immediate' : ''
        }, every student on a version below ${v.latestVersion} will be required to update before they can keep using the app — there is no Later or Skip option. This applies the moment they next open it.`}
        confirmLabel="Yes, apply this"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={formik.isSubmitting}
        onConfirm={() => save(v, formik.setSubmitting)}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

function ModeCard({
  icon: Icon,
  title,
  description,
  selected,
  onSelect,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left p-4 rounded-xl border transition-all ${
        selected
          ? 'border-cyan-500/60 bg-cyan-500/10 ring-1 ring-cyan-500/40'
          : 'border-slate-200 dark:border-[#1e2e56] bg-slate-50/60 dark:bg-[#0c152e]/50 hover:border-slate-300 dark:hover:border-[#2a3f74]'
      }`}
    >
      <div className="flex items-center gap-2.5 mb-1.5">
        <div
          className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
            selected ? 'border-cyan-500' : 'border-slate-400 dark:border-slate-600'
          }`}
        >
          {selected && <div className="w-2 h-2 rounded-full bg-cyan-500" />}
        </div>
        <Icon className={`w-4 h-4 ${selected ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-500'}`} />
        <span className="text-sm font-bold text-slate-900 dark:text-white">{title}</span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
    </button>
  );
}
