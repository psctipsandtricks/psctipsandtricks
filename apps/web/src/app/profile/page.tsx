'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge, Input, Skeleton } from '@psc/ui';
import {
  User as UserIcon,
  ChevronLeft,
  Camera,
  Mail,
  Calendar,
  ShoppingBag,
  History,
  Crown,
  CheckCircle2,
  AlertCircle,
  Chrome,
  Apple,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { useAuth } from '@/app/auth-provider';
import type { UserProfile } from '@psc/shared-types';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export default function ProfilePage() {
  const { user, isLoading: authLoading, updateUser } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState('');
  const [imageLoadError, setImageLoadError] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [applyingGoogleAvatar, setApplyingGoogleAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarBusy = uploadingAvatar || removingAvatar || applyingGoogleAvatar;

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?redirect=/profile');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    async function loadProfile() {
      try {
        setLoading(true);
        const data = await ApiClient.getUserProfile(user!.id);
        setProfile(data);
        setName(data.name || '');
        setPhoneNumber(data.phoneNumber || '');
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [user]);

  const hasChanges = profile && (name.trim() !== (profile.name || '') || phoneNumber.trim() !== (profile.phoneNumber || ''));

  const handleSave = async () => {
    if (!user) return;
    if (!name.trim()) {
      setSaveError('Name cannot be empty.');
      return;
    }
    setSaving(true);
    setSaveError('');
    setSaveSuccess('');
    try {
      const updated = await ApiClient.updateMyProfile(user.id, {
        name: name.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
      });
      setProfile(updated);
      updateUser({ name: updated.name, phoneNumber: updated.phoneNumber });
      setSaveSuccess('Profile updated successfully!');
      setTimeout(() => setSaveSuccess(''), 4000);
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarSelect = async (file: File | null) => {
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      setAvatarError('Please choose an image file (PNG, JPG, or WEBP).');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError('Image must be smaller than 5MB.');
      return;
    }
    setAvatarError('');

    const localPreview = URL.createObjectURL(file);
    setAvatarPreview(localPreview);
    setUploadingAvatar(true);
    try {
      const updated = await ApiClient.uploadAvatar(user.id, file);
      setProfile(updated);
      updateUser({ avatarUrl: updated.avatarUrl });
    } catch (err: any) {
      setAvatarError(err?.message || 'Failed to upload photo. Please try again.');
    } finally {
      URL.revokeObjectURL(localPreview);
      setAvatarPreview(null);
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    setAvatarError('');
    setRemovingAvatar(true);
    try {
      const updated = await ApiClient.removeAvatar(user.id);
      setProfile(updated);
      setImageLoadError(false);
      updateUser({ avatarUrl: updated.avatarUrl });
    } catch (err: any) {
      setAvatarError(err?.message || 'Failed to remove photo. Please try again.');
    } finally {
      setRemovingAvatar(false);
    }
  };

  const handleUseGoogleAvatar = async () => {
    if (!user || !profile?.googleAvatarUrl) return;
    setAvatarError('');
    setApplyingGoogleAvatar(true);
    try {
      const updated = await ApiClient.updateMyProfile(user.id, { avatarUrl: profile.googleAvatarUrl });
      setProfile(updated);
      setImageLoadError(false);
      updateUser({ avatarUrl: updated.avatarUrl });
    } catch (err: any) {
      setAvatarError(err?.message || 'Failed to apply your Google photo. Please try again.');
    } finally {
      setApplyingGoogleAvatar(false);
    }
  };

  const loginMethod = (() => {
    const provider = profile?.oauthIdentities?.[0]?.provider;
    if (provider === 'GOOGLE') return { label: 'Google Account', icon: Chrome };
    if (provider === 'APPLE') return { label: 'Apple Account', icon: Apple };
    return { label: 'Email & Password', icon: Mail };
  })();
  const LoginMethodIcon = loginMethod.icon;

  if (loading || authLoading || !user || !profile) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 py-6 px-2">
        <div className="flex items-center space-x-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="w-40 h-6 rounded-md" />
            <Skeleton className="w-56 h-4 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4 px-1 sm:px-0">
      {/* Top Navigation & Title */}
      <div className="flex items-center space-x-3">
        <Link href="/dashboard">
          <Button
            variant="outline"
            size="sm"
            className="p-2 rounded-xl border-cyan-500/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-400/70"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center space-x-2">
            <UserIcon className="w-6 h-6 text-cyan-400" />
            <span>My Profile</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage your personal details and profile picture.
          </p>
        </div>
      </div>

      {/* Identity Card */}
      <Card className="p-5 sm:p-6 glass-card">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="shrink-0 flex flex-col items-center gap-2">
            <div className="relative">
              {(avatarPreview || profile.avatarUrl) && !imageLoadError ? (
                <img
                  src={avatarPreview || profile.avatarUrl || ''}
                  alt={profile.name}
                  className="w-24 h-24 rounded-2xl object-cover border border-slate-200 dark:border-[#1e2e56] shadow-sm"
                  onError={() => setImageLoadError(true)}
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center font-black text-2xl text-slate-800 dark:text-white shadow-sm">
                  {profile.name
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase() || '#'}
                </div>
              )}
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarBusy}
                className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white border-2 border-white dark:border-slate-950 flex items-center justify-center shadow-md transition-colors cursor-pointer disabled:opacity-60"
                title="Change photo"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => {
                  handleAvatarSelect(e.target.files?.[0] || null);
                  e.target.value = '';
                }}
                className="hidden"
              />
            </div>

            {/* Secondary photo actions — only shown when relevant, so a fresh
                account with no photo and no Google link sees just the camera. */}
            {(profile.avatarUrl || (profile.googleAvatarUrl && profile.googleAvatarUrl !== profile.avatarUrl)) && (
              <div className="flex items-center gap-2.5">
                {profile.avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={avatarBusy}
                    className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    {removingAvatar ? 'Removing…' : 'Remove'}
                  </button>
                )}
                {profile.googleAvatarUrl && profile.googleAvatarUrl !== profile.avatarUrl && (
                  <button
                    type="button"
                    onClick={handleUseGoogleAvatar}
                    disabled={avatarBusy}
                    className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    {applyingGoogleAvatar ? 'Applying…' : 'Use Google photo'}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 text-center sm:text-left space-y-2">
            <div className="flex items-center justify-center sm:justify-start flex-wrap gap-2">
              <h2 className="text-lg font-black text-slate-900 dark:text-white truncate">{profile.name}</h2>
              {profile.isPremium && (
                <Badge variant="gold" className="text-[10px] font-bold flex items-center gap-1">
                  <Crown className="w-3 h-3" />
                  <span>PREMIUM</span>
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] font-bold">
                {profile.role}
              </Badge>
            </div>
            <div className="flex items-center justify-center sm:justify-start space-x-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Mail className="w-3.5 h-3.5 shrink-0" />
              <span className="font-mono truncate">{profile.email}</span>
            </div>
            <div className="flex items-center justify-center sm:justify-start space-x-1.5 text-xs text-slate-500 dark:text-slate-400">
              <LoginMethodIcon className="w-3.5 h-3.5 shrink-0" />
              <span>Signed in with {loginMethod.label}</span>
            </div>
            <div className="flex items-center justify-center sm:justify-start space-x-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>
                Member since{' '}
                {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
            </div>
            {avatarError && (
              <p className="text-[11px] text-rose-500 font-semibold flex items-center justify-center sm:justify-start gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{avatarError}</span>
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Link href="/orders">
          <Card className="p-3.5 sm:p-4 glass-card flex items-center space-x-3 cursor-pointer">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-semibold block">My Orders</span>
              <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono">
                {profile.ordersCount}
              </span>
            </div>
          </Card>
        </Link>

        <Link href="/quizzes/history">
          <Card className="p-3.5 sm:p-4 glass-card flex items-center space-x-3 cursor-pointer">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-semibold block">Quiz Attempts</span>
              <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono">
                {profile.quizAttemptsCount}
              </span>
            </div>
          </Card>
        </Link>
      </div>

      {/* Editable Details */}
      <Card className="p-5 sm:p-6 glass-card space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Personal Details</h3>

        {saveError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 dark:text-rose-400 text-xs font-bold flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}
        {saveSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
        )}

        <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />

        <Input
          label="Mobile / WhatsApp Number"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="e.g. 9876543210"
        />

        <div className="pt-1">
          <Button
            variant="gold"
            className="font-bold"
            disabled={saving || !hasChanges}
            isLoading={saving}
            onClick={handleSave}
          >
            Save Changes
          </Button>
        </div>
      </Card>
    </div>
  );
}
