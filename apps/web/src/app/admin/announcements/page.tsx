'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  Card,
  CardTitle,
  Input,
  Button,
  ToggleSwitch,
  Badge,
  useFileDrop,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Pagination,
} from '@psc/ui';
import {
  Megaphone,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Edit2,
  ArrowRight,
  Eye,
  CheckCircle2,
  AlertCircle,
  Link as LinkIcon,
  Sparkles,
  X,
  Smartphone,
  Monitor,
  Layers,
  UploadCloud,
  Palette,
  RotateCcw,
  Sliders,
  Paintbrush,
  Search,
  LayoutList,
  LayoutGrid,
} from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { AnnouncementPopup } from '@psc/shared-types';
import { AnnouncementsPageSkeleton } from '../admin-skeleton';

const announcementSchema = Yup.object({
  title: Yup.string().trim().max(100, 'Title must be 100 characters or fewer').nullable(),
  message: Yup.string()
    .trim()
    .max(250, 'Message must be 250 characters or fewer')
    .required('Announcement message is required'),
  buttonText: Yup.string().trim().max(40, 'Button text must be 40 characters or fewer').nullable(),
  redirectUrl: Yup.string().trim().max(300, 'URL must be 300 characters or fewer').nullable(),
});

const FAR_FUTURE_END_DATE = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 10);
  return d.toISOString();
};

const normalizeRedirectUrl = (raw?: string | null): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) {
    return trimmed;
  }
  if (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

function isDarkColor(colorOrGradient?: string | null): boolean {
  if (!colorOrGradient) return false;
  const trimmed = colorOrGradient.trim();

  // Solid Hex Code
  if (trimmed.startsWith('#')) {
    const hex = trimmed.replace('#', '');
    if (hex.length !== 6 && hex.length !== 3) return false;
    const fullHex = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    const r = parseInt(fullHex.substring(0, 2), 16);
    const g = parseInt(fullHex.substring(2, 4), 16);
    const b = parseInt(fullHex.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 145;
  }

  // Gradient string: parse hex codes and average their luminance
  if (trimmed.includes('gradient')) {
    const hexMatches = trimmed.match(/#[0-9a-fA-F]{3,6}/g);
    if (hexMatches && hexMatches.length > 0) {
      let totalBrightness = 0;
      for (const hexStr of hexMatches) {
        const hex = hexStr.replace('#', '');
        const fullHex = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
        const r = parseInt(fullHex.substring(0, 2), 16) || 0;
        const g = parseInt(fullHex.substring(2, 4), 16) || 0;
        const b = parseInt(fullHex.substring(4, 6), 16) || 0;
        totalBrightness += (r * 299 + g * 587 + b * 114) / 1000;
      }
      return totalBrightness / hexMatches.length < 145;
    }
  }

  return false;
}

const GRADIENT_PRESETS = [
  { name: 'Brand Gradient', gradient: 'linear-gradient(to right, #f59e0b, #fbbf24, #22d3ee)' },
  { name: 'Sunrise Gold', gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24, #f97316)' },
  { name: 'Ocean Cyan', gradient: 'linear-gradient(135deg, #06b6d4, #3b82f6, #6366f1)' },
  { name: 'Emerald Forest', gradient: 'linear-gradient(135deg, #10b981, #059669, #047857)' },
  { name: 'Purple Nebula', gradient: 'linear-gradient(135deg, #8b5cf6, #ec4899, #f43f5e)' },
  { name: 'Midnight Dark', gradient: 'linear-gradient(135deg, #0f172a, #1e1b4b, #312e81)' },
  { name: 'Sunset Glow', gradient: 'linear-gradient(135deg, #f97316, #ec4899, #e11d48)' },
  { name: 'Cyber Obsidian', gradient: 'linear-gradient(135deg, #18181b, #27272a, #3f3f46)' },
  { name: 'Teal Lagoon', gradient: 'linear-gradient(135deg, #0d9488, #06b6d4, #38bdf8)' },
  { name: 'Rose Blossom', gradient: 'linear-gradient(135deg, #f43f5e, #fb7185, #fda4af)' },
];

const SOLID_PRESETS = [
  { name: 'Amber Gold', color: '#f59e0b' },
  { name: 'Cyan Sky', color: '#06b6d4' },
  { name: 'Emerald Green', color: '#10b981' },
  { name: 'Royal Violet', color: '#8b5cf6' },
  { name: 'Rose Sunset', color: '#ec4899' },
  { name: 'Crimson Red', color: '#ef4444' },
  { name: 'Dark Obsidian', color: '#0f172a' },
  { name: 'Navy Midnight', color: '#1e293b' },
];

const GRADIENT_DIRECTIONS = [
  { label: '➔ Horizontal (to right)', value: 'to right' },
  { label: '↗ Diagonal (135deg)', value: '135deg' },
  { label: '⬇ Vertical (to bottom)', value: 'to bottom' },
  { label: '↖ Inverse (225deg)', value: '225deg' },
];

export default function AdminAnnouncementsPage() {
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<AnnouncementPopup[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AnnouncementPopup | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<AnnouncementPopup | null>(null);

  // Form states
  const [isActive, setIsActive] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [backgroundColor, setBackgroundColor] = useState<string>('');
  const [bgTab, setBgTab] = useState<'gradient' | 'solid'>('gradient');

  // Custom Gradient Generator sub-states
  const [gradStart, setGradStart] = useState('#f59e0b');
  const [gradEnd, setGradEnd] = useState('#22d3ee');
  const [gradDirection, setGradDirection] = useState('135deg');

  const [uploadingImage, setUploadingImage] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

  // Pinned live preview item (defaults to highest priority active banner)
  const [selectedPreviewBanner, setSelectedPreviewBanner] = useState<AnnouncementPopup | null>(null);

  // Search, View Mode & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const loadAnnouncements = async () => {
    try {
      const list = await ApiClient.listAnnouncements();
      setAnnouncements(list || []);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not load announcements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const formik = useFormik({
    initialValues: {
      title: '',
      message: '',
      buttonText: '',
      redirectUrl: '',
    },
    validationSchema: announcementSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      setErrorMessage(null);
      try {
        const cleanRedirect = normalizeRedirectUrl(values.redirectUrl);
        const payload = {
          title: values.title?.trim() || 'Global Banner',
          message: values.message.trim(),
          imageUrl: imageUrl || null,
          buttonText: values.buttonText?.trim() || null,
          redirectUrl: cleanRedirect,
          backgroundColor: backgroundColor?.trim() || null,
          isActive,
          endDate: FAR_FUTURE_END_DATE(),
        };

        if (editingItem) {
          await ApiClient.updateAnnouncement(editingItem.id, payload);
          showToast('Announcement updated successfully!');
        } else {
          await ApiClient.createAnnouncement(payload);
          showToast('New announcement published successfully!');
        }

        setIsModalOpen(false);
        setEditingItem(null);
        await loadAnnouncements();
      } catch (err: any) {
        setErrorMessage(err?.message || 'Could not save announcement.');
      }
    },
  });

  const openCreateModal = () => {
    setEditingItem(null);
    setIsActive(true);
    setImageUrl(null);
    setBackgroundColor('');
    setBgTab('gradient');
    setGradStart('#f59e0b');
    setGradEnd('#22d3ee');
    setGradDirection('135deg');
    formik.setValues({
      title: 'Special Update',
      message: 'New Kerala PSC mock tests and study materials are now available!',
      buttonText: 'Explore Now',
      redirectUrl: '/quizzes',
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: AnnouncementPopup) => {
    setEditingItem(item);
    setIsActive(item.isActive);
    setImageUrl(item.imageUrl || null);
    const bg = item.backgroundColor || '';
    setBackgroundColor(bg);
    if (bg.startsWith('#')) {
      setBgTab('solid');
    } else {
      setBgTab('gradient');
      // If it contains hex stops, try to extract them into builder
      const matches = bg.match(/#[0-9a-fA-F]{6}/g);
      if (matches && matches.length >= 2) {
        setGradStart(matches[0]);
        setGradEnd(matches[matches.length - 1]);
      }
    }
    formik.setValues({
      title: item.title && item.title !== 'Global Banner' ? item.title : '',
      message: item.message || '',
      buttonText: item.buttonText || '',
      redirectUrl: item.redirectUrl || '',
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleApplyCustomGradient = (start = gradStart, end = gradEnd, dir = gradDirection) => {
    const custom = `linear-gradient(${dir}, ${start}, ${end})`;
    setBackgroundColor(custom);
  };

  const handleToggleStatus = async (item: AnnouncementPopup) => {
    try {
      const nextActive = !item.isActive;
      // Optimistic update
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, isActive: nextActive } : a)),
      );
      await ApiClient.updateAnnouncement(item.id, { isActive: nextActive });
      showToast(`Announcement ${nextActive ? 'activated' : 'deactivated'} successfully.`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not update status.');
      await loadAnnouncements();
    }
  };

  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= announcements.length) return;

    const reordered = [...announcements];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    // Optimistic UI update
    setAnnouncements(reordered);

    try {
      const ids = reordered.map((a) => a.id);
      await ApiClient.reorderAnnouncements(ids);
      showToast('Display order updated.');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not save order.');
      await loadAnnouncements();
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmItem) return;
    try {
      await ApiClient.deleteAnnouncement(deleteConfirmItem.id);
      showToast('Announcement deleted.');
      setDeleteConfirmItem(null);
      await loadAnnouncements();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to delete announcement.');
    }
  };

  const handleImageFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (.png, .jpg, .webp).');
      return;
    }

    try {
      setUploadingImage(true);
      setErrorMessage(null);
      const res = await ApiClient.uploadAnnouncementBannerImage(file);
      if (res?.url) {
        setImageUrl(res.url);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Image upload failed.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => handleImageFile(e.target.files?.[0]);

  // The banner tile accepts drops whether or not an image is already set, so
  // replacing one is the same gesture as adding the first.
  const bannerDrop = useFileDrop({
    accept: 'image/png,image/jpeg,image/webp,image/jpg',
    disabled: uploadingImage,
    onFiles: ([file]) => handleImageFile(file),
    onReject: () => setErrorMessage('Please select a valid image file (.png, .jpg, .webp).'),
  });

  if (loading) {
    return <AnnouncementsPageSkeleton />;
  }

  const activeCount = announcements.filter((a) => a.isActive).length;
  const modalIsDark = isDarkColor(backgroundColor);
  const previewIsDark = selectedPreviewBanner ? isDarkColor(selectedPreviewBanner.backgroundColor) : false;

  const filteredAnnouncements = announcements.filter((item) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (item.title && item.title.toLowerCase().includes(term)) ||
      (item.message && item.message.toLowerCase().includes(term)) ||
      (item.buttonText && item.buttonText.toLowerCase().includes(term)) ||
      (item.redirectUrl && item.redirectUrl.toLowerCase().includes(term))
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredAnnouncements.length / pageSize));
  const paginatedAnnouncements = filteredAnnouncements.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4 rounded-b-2xl w-full px-1 sm:px-0">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Announcement Management
            </h1>
            <Badge variant="gold" className="text-[11px] font-bold">
              {announcements.length} {announcements.length === 1 ? 'Banner' : 'Banners'}
            </Badge>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">
            Create, edit, reorder display priority, build custom gradients and colors, and toggle active announcements displayed across student apps.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {successToast && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 animate-fadeIn">
              <CheckCircle2 className="w-3.5 h-3.5" /> {successToast}
            </span>
          )}

          <Button
            type="button"
            variant="gold"
            onClick={openCreateModal}
            className="flex items-center gap-1.5 font-bold shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Announcement</span>
          </Button>
        </div>
      </div>

      {/* ── Quick Stats Grid ───────────────────────────────────────── */}
      <div className="shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center justify-between border border-slate-200/80 dark:border-[#1e2e56]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Banners</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{activeCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <Megaphone className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border border-slate-200/80 dark:border-[#1e2e56]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Inactive / Drafts</p>
            <p className="text-2xl font-black text-slate-600 dark:text-slate-400 mt-0.5">
              {announcements.length - activeCount}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-500/10 text-slate-400 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border border-slate-200/80 dark:border-[#1e2e56]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Student Rotation</p>
            <p className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 mt-1">
              {activeCount > 1 ? `Multi-Banner Carousel (${activeCount})` : 'Single Banner Priority'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* ── Announcements Management List / Table ──────────────────────────── */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border border-slate-200 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] admin-table-card p-0">
        <div className="shrink-0 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-[#0c152e]/30">
          <div>
            <CardTitle className="text-base sm:text-lg text-slate-900 dark:text-white font-bold flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-500" />
              <span>All Announcements & Display Sequence</span>
            </CardTitle>
            <p className="text-xs text-slate-400 mt-0.5">
              Top-ranked announcements appear first in student rotation. Use the up/down arrows to adjust priority.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[200px] sm:min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Search announcements..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs bg-white dark:bg-[#091124]"
              />
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center p-0.5 rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-slate-100 dark:bg-[#0e1730]">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-cyan-500 text-slate-900 dark:text-slate-950 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Table View"
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-white dark:bg-cyan-500 text-slate-900 dark:text-slate-950 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Cards View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Scrollable Table / Cards Content ─────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
          {filteredAnnouncements.length === 0 ? (
            <div className="py-16 text-center space-y-3 p-4">
              <Megaphone className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                {searchTerm ? 'No announcements matched your search.' : 'No announcements found.'}
              </p>
              {searchTerm ? (
                <Button variant="outline" size="sm" onClick={() => setSearchTerm('')} className="font-bold cursor-pointer">
                  Clear Search
                </Button>
              ) : (
                <Button variant="gold" onClick={openCreateModal} className="font-bold cursor-pointer">
                  <Plus className="w-4 h-4 mr-1" /> Create Your First Banner
                </Button>
              )}
            </div>
          ) : viewMode === 'table' ? (
            /* ── Table View ─────────────────────────────────────────────── */
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-200/80 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#0c152e]/50">
                    <TableHead className="font-bold text-xs w-28">Priority</TableHead>
                    <TableHead className="font-bold text-xs min-w-[240px]">Banner & Title</TableHead>
                    <TableHead className="font-bold text-xs min-w-[240px]">Message</TableHead>
                    <TableHead className="font-bold text-xs min-w-[180px]">Action & Link</TableHead>
                    <TableHead className="font-bold text-xs">Status</TableHead>
                    <TableHead className="font-bold text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAnnouncements.map((item) => {
                    const originalIndex = announcements.findIndex((a) => a.id === item.id);
                    const isFirst = originalIndex === 0;
                    const isLast = originalIndex === announcements.length - 1;

                    return (
                      <TableRow
                        key={item.id}
                        className={`border-b border-slate-100 dark:border-[#1e2e56]/40 hover:bg-slate-50/70 dark:hover:bg-[#0c152e]/40 transition-colors ${
                          !item.isActive ? 'opacity-70 bg-slate-50/30 dark:bg-[#080e1e]/30' : ''
                        }`}
                      >
                        {/* Priority Reorder Controls */}
                        <TableCell className="py-3">
                          <div className="flex items-center gap-1.5">
                            <div className="flex flex-col items-center gap-0.5 bg-slate-100 dark:bg-[#142247] p-1 rounded-xl shrink-0">
                              <button
                                type="button"
                                disabled={isFirst}
                                onClick={() => handleMoveOrder(originalIndex, 'up')}
                                title="Move Up"
                                className="p-0.5 rounded text-slate-600 dark:text-slate-300 hover:text-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-[10px] font-mono font-black text-cyan-600 dark:text-cyan-400 px-1">
                                #{originalIndex + 1}
                              </span>
                              <button
                                type="button"
                                disabled={isLast}
                                onClick={() => handleMoveOrder(originalIndex, 'down')}
                                title="Move Down"
                                className="p-0.5 rounded text-slate-600 dark:text-slate-300 hover:text-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {isFirst && item.isActive && (
                              <Badge variant="gold" className="text-[9px] font-bold px-1.5 py-0.5 shrink-0">
                                ⭐ Top
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Banner & Title */}
                        <TableCell className="py-3">
                          <div className="flex items-center gap-3">
                            {item.imageUrl ? (
                              <div
                                onClick={() => setSelectedPreviewBanner(item)}
                                className="w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 bg-slate-900 shadow-xs cursor-pointer group relative"
                                title="Click to preview"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={item.imageUrl} alt={item.title || 'Banner'} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center">
                                  <Eye className="w-3 h-3 text-white" />
                                </div>
                              </div>
                            ) : (
                              <div
                                onClick={() => setSelectedPreviewBanner(item)}
                                className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 shadow-inner cursor-pointer hover:scale-105 transition-transform"
                                title="Click to preview"
                              >
                                <Megaphone className="w-5 h-5" />
                              </div>
                            )}
                            <div className="space-y-1 min-w-0">
                              <span
                                onClick={() => setSelectedPreviewBanner(item)}
                                className="font-extrabold text-sm text-slate-900 dark:text-white truncate block max-w-[200px] cursor-pointer hover:text-cyan-500 transition-colors"
                              >
                                {item.title || 'Untitled Banner'}
                              </span>
                              {item.backgroundColor ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-[#142247] text-slate-700 dark:text-slate-300 max-w-[180px] truncate">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shadow-xs border border-black/10 shrink-0"
                                    style={{ background: item.backgroundColor }}
                                  />
                                  <span className="truncate">{item.backgroundColor}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                  <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-amber-400 to-cyan-400 shrink-0" />
                                  <span>Brand Gradient</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Message */}
                        <TableCell className="py-3">
                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-snug max-w-md">
                            {item.message}
                          </p>
                        </TableCell>

                        {/* Action / Link */}
                        <TableCell className="py-3">
                          {item.redirectUrl ? (
                            <div className="flex flex-col gap-0.5 text-xs">
                              <span className="font-bold text-slate-900 dark:text-white inline-flex items-center gap-1">
                                <span>{item.buttonText?.trim() || 'Link'}</span>
                                <ArrowRight className="w-3 h-3 text-cyan-500" />
                              </span>
                              <span className="font-mono text-[11px] text-cyan-600 dark:text-cyan-400 truncate max-w-[180px]">
                                {item.redirectUrl}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 font-mono italic">No action button</span>
                          )}
                        </TableCell>

                        {/* Status */}
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={item.isActive ? 'success' : 'outline'}
                              className="text-[10px] uppercase font-bold"
                            >
                              {item.isActive ? 'Active' : 'Disabled'}
                            </Badge>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(item)}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                                item.isActive
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                              }`}
                            >
                              {item.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="py-3 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="p-1.5 h-7 w-7 text-slate-400 hover:text-cyan-400 cursor-pointer"
                              onClick={() => setSelectedPreviewBanner(item)}
                              title="Preview Banner Modal"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="p-1.5 h-7 w-7 text-slate-400 hover:text-amber-400 cursor-pointer"
                              onClick={() => openEditModal(item)}
                              title="Edit Announcement"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="p-1.5 h-7 w-7 text-slate-400 hover:text-rose-500 cursor-pointer"
                              onClick={() => setDeleteConfirmItem(item)}
                              title="Delete Announcement"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            /* ── Cards View ─────────────────────────────────────────────── */
            <div className="space-y-3 p-4 sm:p-5">
              {paginatedAnnouncements.map((item) => {
                const originalIndex = announcements.findIndex((a) => a.id === item.id);
                const isFirst = originalIndex === 0;
                const isLast = originalIndex === announcements.length - 1;

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                      item.isActive
                        ? 'bg-white dark:bg-[#0c152e] border-slate-200/90 dark:border-[#1e2e56] shadow-xs'
                        : 'bg-slate-50/70 dark:bg-[#080e1e] border-slate-200/50 dark:border-slate-800/60 opacity-75'
                    }`}
                  >
                    {/* Left: Reorder Controls + Priority Badge + Image */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Order Controls */}
                      <div className="flex flex-col items-center gap-0.5 bg-slate-100 dark:bg-[#142247] p-1 rounded-xl shrink-0">
                        <button
                          type="button"
                          disabled={isFirst}
                          onClick={() => handleMoveOrder(originalIndex, 'up')}
                          title="Move Up"
                          className="p-1 rounded text-slate-600 dark:text-slate-300 hover:text-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] font-mono font-black text-cyan-600 dark:text-cyan-400 px-1">
                          #{originalIndex + 1}
                        </span>
                        <button
                          type="button"
                          disabled={isLast}
                          onClick={() => handleMoveOrder(originalIndex, 'down')}
                          title="Move Down"
                          className="p-1 rounded text-slate-600 dark:text-slate-300 hover:text-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Thumbnail Image */}
                      {item.imageUrl ? (
                        <div
                          onClick={() => setSelectedPreviewBanner(item)}
                          className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 bg-slate-900 cursor-pointer group relative shadow-2xs"
                          title="Click to preview"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.imageUrl} alt={item.title || 'Banner'} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center">
                            <Eye className="w-3 h-3 text-white" />
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => setSelectedPreviewBanner(item)}
                          className="w-14 h-14 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 cursor-pointer hover:scale-105 transition-transform"
                          title="Click to preview"
                        >
                          <Megaphone className="w-6 h-6" />
                        </div>
                      )}

                      {/* Content text */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4
                            onClick={() => setSelectedPreviewBanner(item)}
                            className="text-sm font-extrabold text-slate-900 dark:text-white truncate cursor-pointer hover:text-cyan-500 transition-colors"
                          >
                            {item.title || 'Untitled Banner'}
                          </h4>
                          <Badge
                            variant={item.isActive ? 'success' : 'outline'}
                            className="text-[10px] uppercase font-bold"
                          >
                            {item.isActive ? 'Active' : 'Disabled'}
                          </Badge>
                          {isFirst && item.isActive && (
                            <Badge variant="gold" className="text-[10px] font-bold">
                              ⭐ Top Priority
                            </Badge>
                          )}
                          {item.backgroundColor ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-[#142247] text-slate-700 dark:text-slate-300 max-w-[200px] truncate">
                              <span
                                className="w-3 h-3 rounded-full shadow-xs border border-black/10 shrink-0"
                                style={{ background: item.backgroundColor }}
                              />
                              <span className="truncate">{item.backgroundColor}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                              <span className="w-3 h-3 rounded-full bg-gradient-to-r from-amber-400 to-cyan-400 shrink-0" />
                              <span>Brand Gradient</span>
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-snug">
                          {item.message}
                        </p>

                        {item.redirectUrl && (
                          <div className="flex items-center gap-1.5 text-[11px] text-cyan-600 dark:text-cyan-400 font-semibold pt-0.5">
                            <LinkIcon className="w-3 h-3" />
                            <span>
                              {item.buttonText?.trim() ? `${item.buttonText.trim()} ➔ ` : ''}{item.redirectUrl}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Inline Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {/* Toggle Active Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          item.isActive
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                        }`}
                      >
                        {item.isActive ? 'Deactivate' : 'Activate'}
                      </button>

                      {/* Preview Button */}
                      <button
                        type="button"
                        onClick={() => setSelectedPreviewBanner(item)}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-[#142247] hover:text-cyan-400 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                        title="Preview Banner Modal"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-[#142247] hover:text-amber-400 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                        title="Edit Announcement"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmItem(item)}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-colors cursor-pointer"
                        title="Delete Announcement"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination Footer */}
        {filteredAnnouncements.length > 0 && (
          <div className="shrink-0 px-4 sm:px-6 py-3 border-t border-slate-200/80 dark:border-[#1e2e56] bg-slate-50/40 dark:bg-[#091124]/40">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredAnnouncements.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
              pageSizeOptions={[5, 10, 20, 50]}
              className="border-t-0 pt-0"
            />
          </div>
        )}
      </Card>

      {/* ── LIVE STUDENT BANNER PREVIEW MODAL ───────────────────────── */}
      {selectedPreviewBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 !mt-0">
          <div
            className="relative w-full max-w-4xl bg-white dark:bg-[#0c152e] border border-slate-200 dark:border-[#1e2e56] rounded-3xl shadow-2xl p-5 sm:p-7 space-y-5 flex flex-col max-h-[92vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#1e2e56] pb-4 shrink-0">
              <div>
                <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400">
                  <Sparkles className="w-5 h-5 text-cyan-500" />
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                    Live Student Banner Preview
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Realistic real-time preview of how this announcement appears to students on Desktop and Mobile.
                </p>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                {/* Desktop / Mobile Switch */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#142247] p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('desktop')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      previewMode === 'desktop'
                        ? 'bg-white dark:bg-cyan-500 text-slate-900 dark:text-slate-950 shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Monitor className="w-4 h-4" />
                    <span>Desktop Web</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('mobile')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      previewMode === 'mobile'
                        ? 'bg-white dark:bg-cyan-500 text-slate-900 dark:text-slate-950 shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Mobile App</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedPreviewBanner(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1e2e56] cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Device Simulation Canvas */}
            <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar space-y-4 py-1">
              {previewMode === 'desktop' ? (
                /* Desktop Browser Frame */
                <div className="rounded-2xl border border-slate-200 dark:border-[#1e2e56] bg-slate-100/70 dark:bg-[#070d1e] overflow-hidden shadow-md">
                  {/* Browser Bar */}
                  <div className="px-4 py-2.5 bg-slate-200/80 dark:bg-[#0e1730] border-b border-slate-200 dark:border-[#1e2e56] flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <div className="flex-1 max-w-xs mx-auto px-3 py-0.5 rounded-md bg-white/80 dark:bg-[#080e1e] text-[11px] text-slate-500 dark:text-slate-400 font-mono text-center truncate border border-slate-200/60 dark:border-slate-800">
                      https://psctipsandtricks.com
                    </div>
                  </div>

                  {/* Desktop Banner Display */}
                  <div
                    style={{
                      background: selectedPreviewBanner.backgroundColor?.trim() || undefined,
                    }}
                    className={`relative p-3.5 sm:px-6 sm:py-3 transition-all border-b shadow-sm ${
                      !selectedPreviewBanner.backgroundColor
                        ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-cyan-400 text-slate-950 border-amber-600/30'
                        : previewIsDark
                        ? 'text-white border-white/10'
                        : 'text-slate-950 border-slate-950/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 pr-10">
                      <div className="flex items-center gap-3.5 min-w-0">
                        {selectedPreviewBanner.imageUrl ? (
                          <div
                            className={`w-11 h-11 rounded-xl overflow-hidden shadow-xs shrink-0 border ${
                              previewIsDark ? 'border-white/20 bg-white/10' : 'border-slate-950/15 bg-slate-950/10'
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={selectedPreviewBanner.imageUrl}
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              previewIsDark ? 'bg-white/15 text-white' : 'bg-slate-950/10 text-slate-950'
                            }`}
                          >
                            <Megaphone className="w-4 h-4" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          {selectedPreviewBanner.title && selectedPreviewBanner.title !== 'Global Banner' && (
                            <p
                              className={`text-sm font-black leading-tight tracking-tight line-clamp-1 ${
                                previewIsDark ? 'text-white' : 'text-slate-950'
                              }`}
                            >
                              {selectedPreviewBanner.title}
                            </p>
                          )}
                          <p
                            className={`text-xs font-semibold leading-snug line-clamp-2 ${
                              previewIsDark ? 'text-slate-200' : 'text-slate-900/90'
                            }`}
                          >
                            {selectedPreviewBanner.message}
                          </p>
                        </div>
                      </div>

                      {selectedPreviewBanner.redirectUrl && (
                        <div className="shrink-0 flex items-center">
                          {selectedPreviewBanner.buttonText?.trim() ? (
                            <span
                              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold shadow-sm transition-all ${
                                previewIsDark
                                  ? 'bg-white text-slate-950'
                                  : 'bg-slate-950 text-amber-300'
                              }`}
                            >
                              <span>{selectedPreviewBanner.buttonText.trim()}</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span
                              className={`w-8 h-8 rounded-full inline-flex items-center justify-center shadow-md transition-all ${
                                previewIsDark
                                  ? 'bg-white text-slate-950'
                                  : 'bg-slate-950 text-amber-300'
                              }`}
                            >
                              <ArrowRight className="w-4 h-4" />
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div
                      className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                        previewIsDark ? 'text-white/60' : 'text-slate-950/60'
                      }`}
                    >
                      <X className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Browser Mock Content Skeleton */}
                  <div className="p-5 space-y-2.5 opacity-25 pointer-events-none">
                    <div className="h-3.5 bg-slate-300 dark:bg-slate-700 rounded-md w-1/4" />
                    <div className="h-14 bg-slate-300/60 dark:bg-slate-800 rounded-xl w-full" />
                  </div>
                </div>
              ) : (
                /* Mobile Device Frame */
                <div className="max-w-[340px] mx-auto rounded-[32px] border-4 border-slate-800 dark:border-slate-700 bg-slate-100 dark:bg-[#070d1e] overflow-hidden shadow-2xl p-3 space-y-3">
                  {/* Phone Status Bar */}
                  <div className="flex items-center justify-between px-3 text-[10px] font-bold text-slate-500 pt-1">
                    <span>9:41</span>
                    <div className="w-16 h-3 bg-slate-800 rounded-full mx-auto" />
                    <div className="flex items-center gap-1">
                      <span>5G</span>
                      <div className="w-3.5 h-2 border border-slate-500 rounded-xs" />
                    </div>
                  </div>

                  {/* Mobile Announcement Card */}
                  <div
                    style={{
                      background: selectedPreviewBanner.backgroundColor?.trim() || undefined,
                    }}
                    className={`relative rounded-2xl overflow-hidden shadow-lg p-3.5 border transition-all ${
                      !selectedPreviewBanner.backgroundColor
                        ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-cyan-400 text-slate-950 border-amber-600/30'
                        : previewIsDark
                        ? 'text-white border-white/10'
                        : 'text-slate-950 border-slate-950/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2.5 pr-6">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {selectedPreviewBanner.imageUrl ? (
                          <div
                            className={`w-10 h-10 rounded-xl overflow-hidden shadow-xs shrink-0 border ${
                              previewIsDark ? 'border-white/20 bg-white/10' : 'border-slate-950/15 bg-slate-950/10'
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={selectedPreviewBanner.imageUrl}
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              previewIsDark ? 'bg-white/15 text-white' : 'bg-slate-950/10 text-slate-950'
                            }`}
                          >
                            <Megaphone className="w-4 h-4" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          {selectedPreviewBanner.title && selectedPreviewBanner.title !== 'Global Banner' && (
                            <p
                              className={`text-xs font-black leading-tight tracking-tight line-clamp-1 ${
                                previewIsDark ? 'text-white' : 'text-slate-950'
                              }`}
                            >
                              {selectedPreviewBanner.title}
                            </p>
                          )}
                          <p
                            className={`text-[11px] font-semibold leading-snug line-clamp-2 ${
                              previewIsDark ? 'text-slate-200' : 'text-slate-900/90'
                            }`}
                          >
                            {selectedPreviewBanner.message}
                          </p>
                        </div>
                      </div>

                      {selectedPreviewBanner.redirectUrl && (
                        <div className="shrink-0">
                          {selectedPreviewBanner.buttonText?.trim() ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold shadow-sm ${
                                previewIsDark
                                  ? 'bg-white text-slate-950'
                                  : 'bg-slate-950 text-amber-300'
                              }`}
                            >
                              <span>{selectedPreviewBanner.buttonText.trim()}</span>
                              <ArrowRight className="w-3 h-3" />
                            </span>
                          ) : (
                            <span
                              className={`w-7 h-7 rounded-full inline-flex items-center justify-center shadow-md ${
                                previewIsDark
                                  ? 'bg-white text-slate-950'
                                  : 'bg-slate-950 text-amber-300'
                              }`}
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div
                      className={`absolute right-2 top-2 ${
                        previewIsDark ? 'text-white/60' : 'text-slate-950/60'
                      }`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Mobile Skeleton Items */}
                  <div className="space-y-2 px-1 pt-1 opacity-20 pointer-events-none">
                    <div className="h-3 bg-slate-300 dark:bg-slate-700 rounded-md w-1/2" />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-14 bg-slate-300 dark:bg-slate-800 rounded-xl" />
                      <div className="h-14 bg-slate-300 dark:bg-slate-800 rounded-xl" />
                    </div>
                  </div>
                </div>
              )}

              {/* Banner Details Info Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#111c3a] border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    selectedPreviewBanner.isActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-400'
                  }`}>
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">Banner Status</span>
                    <span className="font-extrabold text-slate-900 dark:text-white mt-0.5 block">
                      {selectedPreviewBanner.isActive ? (
                        <span className="text-emerald-600 dark:text-emerald-400">● Active (Live)</span>
                      ) : (
                        <span className="text-slate-400">○ Disabled</span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#111c3a] border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">Rotation Priority</span>
                    <span className="font-extrabold text-cyan-600 dark:text-cyan-400 font-mono mt-0.5 block">
                      Rank #{announcements.findIndex((a) => a.id === selectedPreviewBanner.id) + 1} of {announcements.length}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#111c3a] border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                    <LinkIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">Destination Link</span>
                    <span className="font-mono text-xs text-amber-600 dark:text-amber-400 font-bold truncate block mt-0.5">
                      {selectedPreviewBanner.redirectUrl || 'None (Notice only)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-[#1e2e56] shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const target = selectedPreviewBanner;
                  setSelectedPreviewBanner(null);
                  openEditModal(target);
                }}
                className="font-bold cursor-pointer inline-flex items-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit This Announcement</span>
              </Button>
              <Button
                type="button"
                variant="gold"
                size="sm"
                onClick={() => setSelectedPreviewBanner(null)}
                className="font-bold cursor-pointer"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE / EDIT MODAL ───────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn !mt-0">
          <div className="bg-white dark:bg-[#091124] border border-slate-200 dark:border-[#1e2e56] rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Fixed Header */}
            <div className="flex items-center justify-between px-5 sm:px-7 py-4 sm:py-5 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <span>{editingItem ? 'Edit Announcement' : 'Create New Announcement'}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure text content, gradients/colors, promotional graphic, and direct destination button.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-full text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5 space-y-5">
              {/* Live Modal Preview with Dynamic Background */}
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.03] dark:bg-cyan-950/10 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-cyan-600 dark:text-cyan-400">
                  <span className="flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" /> Real-time Live Preview
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase font-mono">
                    {isActive ? '● Active' : '○ Inactive'}
                  </span>
                </div>

                <div
                  style={{
                    background: backgroundColor?.trim() || undefined,
                  }}
                  className={`rounded-xl overflow-hidden p-3 shadow-md border transition-all ${
                    !backgroundColor
                      ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-cyan-400 text-slate-950 border-amber-600/30'
                      : modalIsDark
                      ? 'text-white border-white/10'
                      : 'text-slate-950 border-slate-950/10'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pr-6">
                    <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                      {imageUrl ? (
                        <div
                          className={`w-10 h-10 rounded-xl overflow-hidden shrink-0 border ${
                            modalIsDark ? 'border-white/20 bg-white/10' : 'border-slate-950/15 bg-slate-950/10'
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            modalIsDark ? 'bg-white/15 text-white' : 'bg-slate-950/10 text-slate-950'
                          }`}
                        >
                          <Megaphone className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        {formik.values.title && (
                          <p
                            className={`text-xs font-black leading-tight line-clamp-1 ${
                              modalIsDark ? 'text-white' : 'text-slate-950'
                            }`}
                          >
                            {formik.values.title}
                          </p>
                        )}
                        <p
                          className={`text-[11px] font-semibold leading-snug line-clamp-2 ${
                            modalIsDark ? 'text-slate-200' : 'text-slate-900/90'
                          }`}
                        >
                          {formik.values.message || 'Write announcement message...'}
                        </p>
                      </div>
                    </div>

                    {formik.values.redirectUrl && (
                      formik.values.buttonText?.trim() ? (
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-extrabold shadow-sm shrink-0 ${
                            modalIsDark
                              ? 'bg-white text-slate-950'
                              : 'bg-slate-950 text-amber-300'
                          }`}
                        >
                          <span>{formik.values.buttonText.trim()}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span
                          className={`w-7 h-7 rounded-full inline-flex items-center justify-center shadow-md shrink-0 ${
                            modalIsDark
                              ? 'bg-white text-slate-950'
                              : 'bg-slate-950 text-amber-300'
                          }`}
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Form Content */}
              <form id="announcement-form" onSubmit={formik.handleSubmit} className="space-y-4" noValidate>
                <Input
                  label="Announcement Headline / Title (Optional)"
                  placeholder="e.g. Kerala PSC 2026 Special Batch Live!"
                  name="title"
                  value={formik.values.title}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.title && formik.errors.title ? formik.errors.title : undefined}
                />

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Announcement Message / Description <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    name="message"
                    rows={3}
                    placeholder="Write the message text..."
                    value={formik.values.message}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium border bg-white dark:bg-[#0c152e] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                      formik.touched.message && formik.errors.message
                        ? 'border-rose-500 focus:ring-rose-500/20'
                        : 'border-slate-200 dark:border-[#1e2e56] focus:border-cyan-500 focus:ring-cyan-500/20'
                    }`}
                  />
                  {formik.touched.message && formik.errors.message && (
                    <p className="text-[11px] text-rose-500 font-medium mt-1">{formik.errors.message}</p>
                  )}
                </div>

                {/* ── Advanced Gradient & Color Builder ─────────────────────── */}
                <div className="space-y-3.5 p-4 rounded-2xl border border-slate-200 dark:border-[#1e2e56] bg-slate-50/70 dark:bg-[#0c152e]/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-cyan-500" />
                      <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Banner Background Styling
                      </span>
                    </div>

                    {/* Mode Tabs */}
                    <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-[#142247] p-0.5 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setBgTab('gradient')}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          bgTab === 'gradient'
                            ? 'bg-white dark:bg-cyan-500 text-slate-900 dark:text-slate-950 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Gradients</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBgTab('solid')}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          bgTab === 'solid'
                            ? 'bg-white dark:bg-cyan-500 text-slate-900 dark:text-slate-950 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Paintbrush className="w-3 h-3" />
                        <span>Solid Color</span>
                      </button>
                    </div>
                  </div>

                  {/* ── GRADIENTS TAB CONTENT ── */}
                  {bgTab === 'gradient' && (
                    <div className="space-y-3.5">
                      {/* Preset Gradients */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                            Preset Gradients:
                          </label>
                          {backgroundColor && (
                            <button
                              type="button"
                              onClick={() => setBackgroundColor('')}
                              className="text-[11px] font-bold text-slate-500 hover:text-amber-500 flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reset to Default</span>
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          {GRADIENT_PRESETS.map((preset) => {
                            const isSelected =
                              backgroundColor === preset.gradient || (!backgroundColor && preset.name === 'Brand Gradient');
                            return (
                              <button
                                key={preset.name}
                                type="button"
                                onClick={() => setBackgroundColor(preset.gradient)}
                                title={preset.name}
                                className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all cursor-pointer ${
                                  isSelected
                                    ? 'border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-500/30'
                                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-[#142247]'
                                }`}
                              >
                                <span
                                  className="w-5 h-5 rounded-lg shadow-xs border border-black/15 shrink-0"
                                  style={{ background: preset.gradient }}
                                />
                                <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200 truncate">
                                  {preset.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Interactive Custom Gradient Generator */}
                      <div className="p-3.5 rounded-xl border border-cyan-500/30 bg-cyan-500/[0.04] dark:bg-cyan-950/20 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5">
                            <Sliders className="w-3.5 h-3.5" />
                            <span>Custom Gradient Generator</span>
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {/* Start Color */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                              Start Color:
                            </label>
                            <div className="flex items-center gap-2">
                              <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600 cursor-pointer shadow-xs shrink-0">
                                <input
                                  type="color"
                                  value={gradStart}
                                  onChange={(e) => {
                                    setGradStart(e.target.value);
                                    handleApplyCustomGradient(e.target.value, gradEnd, gradDirection);
                                  }}
                                  className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer border-none bg-transparent"
                                />
                              </div>
                              <input
                                type="text"
                                value={gradStart}
                                onChange={(e) => {
                                  let v = e.target.value.trim();
                                  if (v && !v.startsWith('#')) v = '#' + v;
                                  setGradStart(v);
                                  if (/^#[0-9a-fA-F]{6}$/i.test(v)) {
                                    handleApplyCustomGradient(v, gradEnd, gradDirection);
                                  }
                                }}
                                className="w-full px-2.5 py-1 text-xs font-mono rounded-lg border border-slate-200 dark:border-[#1e2e56] bg-white dark:bg-[#0c152e] text-slate-900 dark:text-white"
                              />
                            </div>
                          </div>

                          {/* End Color */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                              End Color:
                            </label>
                            <div className="flex items-center gap-2">
                              <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600 cursor-pointer shadow-xs shrink-0">
                                <input
                                  type="color"
                                  value={gradEnd}
                                  onChange={(e) => {
                                    setGradEnd(e.target.value);
                                    handleApplyCustomGradient(gradStart, e.target.value, gradDirection);
                                  }}
                                  className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer border-none bg-transparent"
                                />
                              </div>
                              <input
                                type="text"
                                value={gradEnd}
                                onChange={(e) => {
                                  let v = e.target.value.trim();
                                  if (v && !v.startsWith('#')) v = '#' + v;
                                  setGradEnd(v);
                                  if (/^#[0-9a-fA-F]{6}$/i.test(v)) {
                                    handleApplyCustomGradient(gradStart, v, gradDirection);
                                  }
                                }}
                                className="w-full px-2.5 py-1 text-xs font-mono rounded-lg border border-slate-200 dark:border-[#1e2e56] bg-white dark:bg-[#0c152e] text-slate-900 dark:text-white"
                              />
                            </div>
                          </div>

                          {/* Direction Selector */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                              Direction / Angle:
                            </label>
                            <select
                              value={gradDirection}
                              onChange={(e) => {
                                setGradDirection(e.target.value);
                                handleApplyCustomGradient(gradStart, gradEnd, e.target.value);
                              }}
                              className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-[#1e2e56] bg-white dark:bg-[#0c152e] text-slate-900 dark:text-white cursor-pointer"
                            >
                              {GRADIENT_DIRECTIONS.map((dir) => (
                                <option key={dir.value} value={dir.value}>
                                  {dir.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── SOLID COLOR TAB CONTENT ── */}
                  {bgTab === 'solid' && (
                    <div className="space-y-3.5">
                      {/* Solid Swatches */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                          Solid Palette Presets:
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                          {SOLID_PRESETS.map((preset) => {
                            const isSelected = backgroundColor === preset.color;
                            return (
                              <button
                                key={preset.name}
                                type="button"
                                onClick={() => setBackgroundColor(preset.color)}
                                title={preset.name}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                  isSelected
                                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 ring-2 ring-cyan-500/30'
                                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-[#142247] text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <span
                                  className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs shrink-0"
                                  style={{ backgroundColor: preset.color }}
                                />
                                <span>{preset.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Custom Solid Color Picker & HEX Input */}
                      <div className="flex items-center gap-3 pt-1">
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor="customColorPicker"
                            className="text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer"
                          >
                            Custom Picker:
                          </label>
                          <div className="relative w-9 h-9 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-600 cursor-pointer shadow-xs">
                            <input
                              id="customColorPicker"
                              type="color"
                              value={backgroundColor.startsWith('#') ? backgroundColor : '#f59e0b'}
                              onChange={(e) => setBackgroundColor(e.target.value)}
                              className="absolute -top-2 -left-2 w-14 h-14 cursor-pointer border-none bg-transparent"
                            />
                          </div>
                        </div>

                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder="e.g. #f59e0b or #06b6d4"
                            value={backgroundColor}
                            onChange={(e) => {
                              let val = e.target.value.trim();
                              if (val && !val.startsWith('#')) val = '#' + val;
                              setBackgroundColor(val);
                            }}
                            className="w-full px-3 py-1.5 rounded-xl text-xs font-mono border border-slate-200 dark:border-[#1e2e56] bg-white dark:bg-[#0c152e] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Direct CSS Background Value / Raw Input */}
                  <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold mb-1">
                      <span>Applied Background Value (CSS / Hex / Gradient):</span>
                      {backgroundColor && (
                        <span className="font-mono text-[10px] text-cyan-600 dark:text-cyan-400 truncate max-w-xs">
                          {backgroundColor}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. linear-gradient(135deg, #f59e0b, #22d3ee) or #f59e0b"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl text-xs font-mono border border-slate-200 dark:border-[#1e2e56] bg-white dark:bg-[#0c152e] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                    />
                  </div>
                </div>

                {/* Banner Image Upload */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Banner Image / Thumbnail (Optional)
                  </label>
                  <div {...bannerDrop.dropProps} className="rounded-2xl">
                  {imageUrl ? (
                    <div
                      className={`flex items-center gap-3 p-3 rounded-2xl border bg-slate-50 dark:bg-[#0c152e] transition-all ${
                        bannerDrop.isDragActive
                          ? 'border-cyan-500 ring-2 ring-cyan-500/30 bg-cyan-500/10'
                          : 'border-slate-200 dark:border-[#1e2e56]'
                      }`}
                    >
                      <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-slate-300 dark:border-slate-700 bg-slate-900">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imageUrl} alt="Banner" className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-mono text-slate-500 truncate">{imageUrl}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-xs text-cyan-600 dark:text-cyan-400 font-bold hover:underline cursor-pointer"
                          >
                            Change Image
                          </button>
                          <span className="text-slate-400 text-xs">•</span>
                          <button
                            type="button"
                            onClick={() => setImageUrl(null)}
                            className="text-xs text-rose-500 font-bold hover:underline cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-4 text-center space-y-1.5 cursor-pointer transition-all ${
                        bannerDrop.isDragActive
                          ? 'border-cyan-500 ring-2 ring-cyan-500/30 bg-cyan-500/10'
                          : 'border-slate-300 dark:border-[#1e2e56] hover:border-cyan-500 bg-slate-50/50 dark:bg-[#0c152e]/50'
                      }`}
                    >
                      <UploadCloud className="w-6 h-6 text-cyan-500 mx-auto" />
                      <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                        {uploadingImage
                          ? 'Uploading Image...'
                          : bannerDrop.isDragActive
                            ? 'Drop image to upload…'
                            : 'Click or drop to upload Banner Image'}
                      </p>
                      <p className="text-[10px] text-slate-400">PNG, JPG, WEBP up to 5MB</p>
                    </div>
                  )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/jpg"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />
                </div>

                {/* Redirect Button Config */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Button Text (Optional)"
                    placeholder="e.g. Explore Now / Join Test"
                    name="buttonText"
                    value={formik.values.buttonText}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={formik.touched.buttonText && formik.errors.buttonText ? formik.errors.buttonText : undefined}
                  />

                  <Input
                    label="Redirect URL (Internal or External)"
                    placeholder="e.g. /quizzes or /books or https://..."
                    name="redirectUrl"
                    value={formik.values.redirectUrl}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={formik.touched.redirectUrl && formik.errors.redirectUrl ? formik.errors.redirectUrl : undefined}
                  />
                </div>

                {/* Active Toggle */}
                <ToggleSwitch
                  checked={isActive}
                  onChange={setIsActive}
                  icon={Megaphone}
                  variant="amber"
                  label="Activate Announcement"
                  description="Make this announcement active immediately for student sessions."
                />

                {errorMessage && (
                  <p className="text-xs text-rose-500 font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </p>
                )}
              </form>
            </div>

            {/* Modal Fixed Footer */}
            <div className="flex items-center justify-end gap-3 px-5 sm:px-7 py-3.5 sm:py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-[#0c152e]/90 backdrop-blur-xs shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="font-bold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                form="announcement-form"
                type="submit"
                variant="gold"
                disabled={formik.isSubmitting || uploadingImage}
                className="font-black px-6 shadow-md shadow-amber-500/20 cursor-pointer"
              >
                {formik.isSubmitting
                  ? 'Saving...'
                  : editingItem
                  ? 'Save Changes'
                  : 'Publish Announcement'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ────────────────────────────────── */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn !mt-0">
          <div className="bg-white dark:bg-[#091124] border border-slate-200 dark:border-[#1e2e56] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Delete Announcement?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Are you sure you want to delete &ldquo;{deleteConfirmItem.title || 'this announcement'}&rdquo;? This
                action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteConfirmItem(null)}
                className="w-full font-bold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleDelete}
                className="w-full font-black cursor-pointer shadow-md shadow-rose-500/20"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
