'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { ApiClient } from '@/lib/api-client';
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
  ToggleSwitch,
  FileDropZone,
  Pagination,
} from '@psc/ui';
import {
  Folder,
  FolderOpen,
  Plus,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Video as VideoIcon,
  Play,
  X,
  FileText,
  UploadCloud,
  ExternalLink,
  Eye,
  CheckCircle2,
  Search,
} from 'lucide-react';
import type { VideoFolder, Video } from '@psc/shared-types';
import { AdminFolderDetailSkeleton } from '@/app/skeletons/page-skeletons';
import { extractYoutubeVideoId, youtubeFallbackThumbnail } from '@/lib/youtube';
import { AdminSkeletonTable } from '../../../admin-skeleton';

const folderSchema = Yup.object({
  name: Yup.string().trim().required('Folder name is required'),
});

const videoSchema = Yup.object({
  title: Yup.string().trim().required('Video title is required'),
  youtubeUrl: Yup.string().trim().required('YouTube URL is required'),
});

export default function AdminVideoFolderDetailPage({ params }: { params: { folderId: string } }) {
  const router = useRouter();
  const folderId = params.folderId;

  const [loading, setLoading] = useState(true);
  const [folderData, setFolderData] = useState<{
    folder: VideoFolder;
    breadcrumbs: { id: string; name: string }[];
    children: VideoFolder[];
    videos: Video[];
  } | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Subfolder Dialog
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<VideoFolder | null>(null);
  const [parentForNewFolder, setParentForNewFolder] = useState<VideoFolder | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<VideoFolder | null>(null);

  // Video Dialog
  const [isVideoDialogOpen, setIsVideoDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [targetFolderForVideo, setTargetFolderForVideo] = useState<VideoFolder | null>(null);
  const [deleteVideoTarget, setDeleteVideoTarget] = useState<Video | null>(null);
  const [attachedPdfFile, setAttachedPdfFile] = useState<File | null>(null);
  const [pdfUploadPercent, setPdfUploadPercent] = useState<number | null>(null);

  // Preview Player
  const [previewVideo, setPreviewVideo] = useState<Video | null>(null);

  // Toast
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Expandable Hierarchy Tree State for Subfolders in this page
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [subFolderContents, setSubFolderContents] = useState<
    Record<string, { subFolders: VideoFolder[]; videos: Video[]; loading: boolean }>
  >({});

  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => setToastMsg(null), 4000);
    return () => clearTimeout(timer);
  }, [toastMsg]);

  const loadFolder = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await ApiClient.getVideoFolder(folderId);
      setFolderData({
        folder: data,
        breadcrumbs: data.breadcrumbs || [],
        children: data.children || [],
        videos: data.videos || [],
      });
    } catch {
      router.replace('/admin/videos');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [folderId, router]);

  useEffect(() => {
    loadFolder();
  }, [loadFolder]);

  const refreshSubFolderContents = async (subFolderId: string) => {
    try {
      const [childSubFolders, videoList] = await Promise.all([
        ApiClient.getVideoFolders(subFolderId),
        ApiClient.getVideos({ folderId: subFolderId }),
      ]);
      setSubFolderContents((prev) => ({
        ...prev,
        [subFolderId]: {
          subFolders: childSubFolders || [],
          videos: videoList || [],
          loading: false,
        },
      }));
    } catch {
      // Ignore refresh error
    }
  };

  const toggleExpandFolder = async (folder: VideoFolder) => {
    const hasContents = (folder.subFolderCount || 0) > 0 || (folder.videoCount || 0) > 0;
    if (!hasContents) return;

    const nextState = !expandedFolders[folder.id];
    setExpandedFolders((prev) => ({ ...prev, [folder.id]: nextState }));

    if (nextState && !subFolderContents[folder.id]) {
      setSubFolderContents((prev) => ({
        ...prev,
        [folder.id]: { subFolders: [], videos: [], loading: true },
      }));
      await refreshSubFolderContents(folder.id);
    }
  };

  // Subfolder Formik
  const subFolderFormik = useFormik({
    initialValues: { name: '', description: '', parentId: folderId, isActive: true },
    validationSchema: folderSchema,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        if (editingFolder) {
          await ApiClient.updateVideoFolder(editingFolder.id, {
            name: values.name.trim(),
            description: values.description?.trim() || null,
            parentId: values.parentId || folderId,
            isActive: values.isActive,
          });
          setToastMsg({ type: 'success', text: `Folder "${values.name}" updated.` });
        } else {
          await ApiClient.createVideoFolder({
            name: values.name.trim(),
            parentId: values.parentId || folderId,
            description: values.description?.trim() || null,
            isActive: values.isActive,
          });
          setToastMsg({ type: 'success', text: `Subfolder "${values.name}" created.` });
        }
        setIsFolderDialogOpen(false);
        setEditingFolder(null);
        setParentForNewFolder(null);
        resetForm();
        if (values.parentId && values.parentId !== folderId) {
          await refreshSubFolderContents(values.parentId);
        }
        await loadFolder();
      } catch (err: any) {
        subFolderFormik.setFieldError('name', err.message || 'Failed to save folder.');
      } finally {
        setSubmitting(false);
      }
    },
  });

  // Video Formik
  const videoFormik = useFormik({
    initialValues: { title: '', description: '', youtubeUrl: '', folderId, isActive: true },
    validationSchema: videoSchema,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        let savedVideo: Video;
        const targetFId = values.folderId || folderId;
        if (editingVideo) {
          savedVideo = await ApiClient.updateVideo(editingVideo.id, {
            title: values.title.trim(),
            description: values.description?.trim() || undefined,
            youtubeUrl: values.youtubeUrl.trim(),
            folderId: targetFId,
            isActive: values.isActive,
          });
          setToastMsg({ type: 'success', text: `Video "${values.title}" updated.` });
        } else {
          savedVideo = await ApiClient.createVideo({
            title: values.title.trim(),
            description: values.description?.trim() || undefined,
            youtubeUrl: values.youtubeUrl.trim(),
            folderId: targetFId,
            isActive: values.isActive,
          });
          setToastMsg({ type: 'success', text: `Video "${values.title}" added.` });
        }

        if (attachedPdfFile && savedVideo?.id) {
          setPdfUploadPercent(0);
          await ApiClient.uploadVideoPdf(savedVideo.id, attachedPdfFile, setPdfUploadPercent);
        }

        setIsVideoDialogOpen(false);
        setEditingVideo(null);
        setTargetFolderForVideo(null);
        setAttachedPdfFile(null);
        resetForm();
        if (targetFId !== folderId) {
          await refreshSubFolderContents(targetFId);
        }
        await loadFolder();
      } catch (err: any) {
        videoFormik.setFieldError('title', err.message || 'Failed to save video.');
      } finally {
        setPdfUploadPercent(null);
        setSubmitting(false);
      }
    },
  });

  const handleOpenCreateSubFolder = (parent?: VideoFolder | null) => {
    setEditingFolder(null);
    setParentForNewFolder(parent || null);
    subFolderFormik.resetForm({
      values: {
        name: '',
        description: '',
        parentId: parent ? parent.id : folderId,
        isActive: true,
      },
    });
    setIsFolderDialogOpen(true);
  };

  const handleOpenEditSubFolder = (folderItem: VideoFolder) => {
    setEditingFolder(folderItem);
    setParentForNewFolder(null);
    subFolderFormik.resetForm({
      values: {
        name: folderItem.name,
        description: folderItem.description || '',
        parentId: folderItem.parentId || folderId,
        isActive: folderItem.isActive !== false,
      },
    });
    setIsFolderDialogOpen(true);
  };

  const handleOpenCreateVideo = (targetF?: VideoFolder | null) => {
    setEditingVideo(null);
    setTargetFolderForVideo(targetF || null);
    setAttachedPdfFile(null);
    videoFormik.resetForm({
      values: {
        title: '',
        description: '',
        youtubeUrl: '',
        folderId: targetF ? targetF.id : folderId,
        isActive: true,
      },
    });
    setIsVideoDialogOpen(true);
  };

  const handleOpenEditVideo = (video: Video) => {
    setEditingVideo(video);
    setTargetFolderForVideo(null);
    setAttachedPdfFile(null);
    videoFormik.resetForm({
      values: {
        title: video.title,
        description: video.description || '',
        youtubeUrl: video.youtubeUrl,
        folderId: video.folderId || folderId,
        isActive: video.isActive !== false,
      },
    });
    setIsVideoDialogOpen(true);
  };

  const handleDeleteFolder = async () => {
    if (!deleteFolderTarget) return;
    const target = deleteFolderTarget;
    const pId = target.parentId;
    const prevFolderData = folderData;
    const prevSubContents = subFolderContents;

    // 1. Dismiss modal instantly in 0ms
    setDeleteFolderTarget(null);

    // 2. Optimistic local removal
    if (folderData) {
      setFolderData({
        ...folderData,
        children: folderData.children?.filter((sf) => sf.id !== target.id) || [],
      });
    }
    if (pId && pId !== folderId && prevSubContents[pId]) {
      setSubFolderContents((prev) => ({
        ...prev,
        [pId]: {
          ...prev[pId],
          subFolders: prev[pId].subFolders.filter((sf) => sf.id !== target.id),
        },
      }));
    }

    try {
      await ApiClient.deleteVideoFolder(target.id);
      setToastMsg({ type: 'success', text: `Folder "${target.name}" deleted.` });
      if (pId && pId !== folderId) {
        await refreshSubFolderContents(pId);
      }
      await loadFolder();
    } catch (err: any) {
      setFolderData(prevFolderData);
      setSubFolderContents(prevSubContents);
      setToastMsg({ type: 'error', text: err.message || 'Failed to delete folder.' });
    }
  };

  const handleDeleteVideo = async () => {
    if (!deleteVideoTarget) return;
    const target = deleteVideoTarget;
    const fId = target.folderId;
    const prevFolderData = folderData;
    const prevSubContents = subFolderContents;

    // 1. Dismiss modal instantly in 0ms
    setDeleteVideoTarget(null);

    // 2. Optimistic local removal
    if (folderData && fId === folderId) {
      setFolderData({
        ...folderData,
        videos: folderData.videos?.filter((v) => v.id !== target.id) || [],
      });
    }
    if (fId && fId !== folderId && prevSubContents[fId]) {
      setSubFolderContents((prev) => ({
        ...prev,
        [fId]: {
          ...prev[fId],
          videos: prev[fId].videos.filter((v) => v.id !== target.id),
        },
      }));
    }

    try {
      await ApiClient.deleteVideo(target.id);
      setToastMsg({ type: 'success', text: `Video "${target.title}" deleted.` });
      if (fId && fId !== folderId) {
        await refreshSubFolderContents(fId);
      }
      await loadFolder();
    } catch (err: any) {
      setFolderData(prevFolderData);
      setSubFolderContents(prevSubContents);
      setToastMsg({ type: 'error', text: err.message || 'Failed to delete video.' });
    }
  };

  if (loading || !folderData) {
    return <AdminFolderDetailSkeleton />;
  }

  const { folder, breadcrumbs, children: subFolders, videos } = folderData;

  const filteredSubFolders = subFolders.filter(
    (sf) =>
      !searchTerm.trim() ||
      sf.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sf.description && sf.description.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const filteredVideos = videos.filter(
    (v) =>
      !searchTerm.trim() ||
      v.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.description && v.description.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const allItems = [
    ...filteredSubFolders.map((sf) => ({ type: 'FOLDER' as const, item: sf })),
    ...filteredVideos.map((vid) => ({ type: 'VIDEO' as const, item: vid })),
  ];

  const totalPages = Math.max(1, Math.ceil(allItems.length / pageSize));
  const paginatedItems = allItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const paginatedSubFolders = paginatedItems.filter((i) => i.type === 'FOLDER').map((i) => i.item);
  const paginatedVideos = paginatedItems.filter((i) => i.type === 'VIDEO').map((i) => i.item);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4 rounded-b-2xl">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-3 duration-200 ${toastMsg.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
            : toastMsg.type === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/90 border-amber-500/40 text-amber-800 dark:text-amber-300'
              : 'bg-rose-50 dark:bg-rose-950/90 border-rose-500/40 text-rose-800 dark:text-rose-300'
            }`}
        >
          <span>{toastMsg.text}</span>
          <button type="button" onClick={() => setToastMsg(null)} className="ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header & Breadcrumb */}
      <div className="shrink-0 space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
          <Link
            href="/admin/videos"
            className="font-bold text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1"
          >
            <Folder className="w-3.5 h-3.5 text-amber-500" />
            <span>Video Library</span>
          </Link>
          {breadcrumbs.map((bc, idx) => (
            <React.Fragment key={bc.id}>
              <ChevronRight className="w-3 h-3 text-slate-400" />
              {idx === breadcrumbs.length - 1 ? (
                <span className="font-extrabold text-slate-900 dark:text-white truncate max-w-xs">
                  {bc.name}
                </span>
              ) : (
                <Link
                  href={`/admin/videos/folder/${bc.id}`}
                  className="font-bold text-amber-600 dark:text-amber-400 hover:underline truncate max-w-xs"
                >
                  {bc.name}
                </Link>
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 shadow-inner">
                <Folder className="w-4.5 h-4.5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {folder.name}
              </h1>
              <Badge variant="gold" className="font-extrabold text-xs">
                {folder.videoCount || 0} {(folder.videoCount || 0) === 1 ? 'Video' : 'Videos'}
              </Badge>
              {subFolders.length > 0 && (
                <Badge variant="default" className="font-bold text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {subFolders.length} {subFolders.length === 1 ? 'Sub-folder' : 'Sub-folders'}
                </Badge>
              )}
            </div>
            {folder.description && (
              <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">{folder.description}</p>
            )}
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="font-bold cursor-pointer border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              onClick={() => handleOpenCreateSubFolder(null)}
            >
              <Plus className="w-4 h-4" />
              <span>Add Subfolder</span>
            </Button>
            <Button
              variant="gold"
              size="sm"
              className="font-bold shadow-md shadow-amber-500/20 cursor-pointer"
              onClick={() => handleOpenCreateVideo(null)}
            >
              <Plus className="w-4 h-4" />
              <span>Add Video in Folder</span>
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder="Search items in this folder..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Table Card */}
      <Card className="flex-1 flex flex-col min-h-0 border border-slate-200/80 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] admin-table-card overflow-hidden p-0">
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredSubFolders.length === 0 && filteredVideos.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner">
                <FolderOpen className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  No Videos or Subfolders in &ldquo;{folder.name}&rdquo;
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                  Click &ldquo;Add Subfolder&rdquo; to organize chapters or &ldquo;Add Video in Folder&rdquo; to add lessons here.
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200/80 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#0c152e]/50">
                  <TableHead className="font-bold text-xs">Folder / Item Name</TableHead>
                  <TableHead className="font-bold text-xs">Type</TableHead>
                  <TableHead className="font-bold text-xs">Contents</TableHead>
                  <TableHead className="font-bold text-xs">Status</TableHead>
                  <TableHead className="font-bold text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Subfolders in this folder */}
                {paginatedSubFolders.map((sf) => {
                  const sfHasContents = (sf.subFolderCount || 0) > 0 || (sf.videoCount || 0) > 0;
                  return (
                    <React.Fragment key={`subfolder-frag-${sf.id}`}>
                      <TableRow className="border-b border-slate-100 dark:border-[#1e2e56]/40 hover:bg-amber-500/[0.04] transition-colors group">
                        {/* Name with Expand Chevron ONLY if it has contents */}
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2.5">
                            {sfHasContents ? (
                              <button
                                type="button"
                                onClick={() => toggleExpandFolder(sf)}
                                className="w-7 h-7 rounded-lg border border-cyan-500/40 dark:border-cyan-400/40 flex items-center justify-center text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 transition-colors cursor-pointer shrink-0"
                                title={expandedFolders[sf.id] ? 'Collapse inner contents' : 'Expand inner contents'}
                              >
                                <ChevronDown
                                  className={`w-4 h-4 transition-transform duration-200 ${expandedFolders[sf.id] ? '' : '-rotate-90'
                                    }`}
                                />
                              </button>
                            ) : (
                              <div className="w-7 h-7 flex items-center justify-center text-slate-300 dark:text-slate-700 font-mono text-xs shrink-0">
                                •
                              </div>
                            )}

                            <Link
                              href={`/admin/videos/folder/${sf.id}`}
                              className="flex items-center gap-2.5 group/link min-w-[240px]"
                            >
                              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 shadow-inner group-hover/link:scale-105 transition-transform">
                                <Folder className="w-4 h-4" />
                              </div>
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate group-hover/link:text-amber-600 dark:group-hover/link:text-amber-400 transition-colors">
                                    {sf.name}
                                  </span>
                                  <Badge variant="default" className="text-[10px] px-1.5 py-0 font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                                    Sub-folder
                                  </Badge>
                                </div>
                                {sf.description && (
                                  <p className="text-[11px] text-slate-400 truncate max-w-xs">{sf.description}</p>
                                )}
                              </div>
                            </Link>
                          </div>
                        </TableCell>

                        {/* Type */}
                        <TableCell className="py-3">
                          <Badge variant="outline" className="font-bold text-xs flex items-center gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5">
                            <Folder className="w-3 h-3" />
                            <span>Sub-folder</span>
                          </Badge>
                        </TableCell>

                        {/* Contents */}
                        <TableCell className="py-3 text-xs font-mono text-cyan-600 dark:text-cyan-400 font-bold">
                          {sf.videoCount || 0} {(sf.videoCount || 0) === 1 ? 'Video' : 'Videos'}
                        </TableCell>

                        {/* Status */}
                        <TableCell className="py-3">
                          {sf.isActive !== false ? (
                            <Badge variant="success" className="font-bold text-xs flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Active</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="font-bold text-xs flex items-center gap-1 text-slate-400">
                              <Eye className="w-3 h-3" />
                              <span>Hidden</span>
                            </Badge>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="py-3 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 px-2 font-bold text-cyan-600 dark:text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10 cursor-pointer"
                              onClick={() => handleOpenCreateVideo(sf)}
                              title={`Add video in ${sf.name}`}
                            >
                              <Plus className="w-3 h-3 mr-0.5" />
                              <span>Video</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 px-2 font-bold text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 cursor-pointer"
                              onClick={() => handleOpenCreateSubFolder(sf)}
                              title={`Create sub-folder inside ${sf.name}`}
                            >
                              <Plus className="w-3 h-3 mr-0.5" />
                              <span>Folder</span>
                            </Button>
                            <Link href={`/admin/videos/folder/${sf.id}`}>
                              <Button variant="outline" size="sm" className="text-xs h-7 px-2 font-bold cursor-pointer">
                                <span>Open</span>
                                <ChevronRight className="w-3 h-3 ml-0.5" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-400 hover:text-amber-500 h-7 w-7 p-0 cursor-pointer"
                              onClick={() => handleOpenEditSubFolder(sf)}
                              title="Edit Sub-folder"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-400 hover:text-rose-500 h-7 w-7 p-0 cursor-pointer"
                              onClick={() => setDeleteFolderTarget(sf)}
                              title="Delete Sub-folder"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Dropdown Hierarchy Rows if Expanded */}
                      {expandedFolders[sf.id] && (
                        <>
                          {subFolderContents[sf.id]?.loading ? (
                            <TableRow className="bg-slate-50/40 dark:bg-[#0c152e]/30 border-b border-slate-100 dark:border-[#1e2e56]/30">
                              <TableCell colSpan={5} className="py-3 pl-12">
                                <div className="flex items-center space-x-2 text-xs text-slate-400">
                                  <span className="w-3.5 h-3.5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                                  <span>Loading inner contents for &ldquo;{sf.name}&rdquo;...</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            <>
                              {/* Sub-subfolders */}
                              {subFolderContents[sf.id]?.subFolders?.map((innerSub) => (
                                <TableRow
                                  key={`inner-sub-${innerSub.id}`}
                                  className="bg-slate-50/30 dark:bg-[#0c152e]/25 border-b border-slate-100 dark:border-[#1e2e56]/30 hover:bg-amber-500/[0.04] transition-colors"
                                >
                                  <TableCell className="py-2 pl-14">
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-300 dark:text-slate-600 text-xs font-mono">└──</span>
                                      <Link
                                        href={`/admin/videos/folder/${innerSub.id}`}
                                        className="flex items-center gap-2 group/inner"
                                      >
                                        <div className="w-5 h-5 rounded bg-amber-500/10 text-amber-500 flex items-center justify-center">
                                          <Folder className="w-3 h-3" />
                                        </div>
                                        <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 group-hover/inner:text-amber-500">
                                          {innerSub.name}
                                        </span>
                                        <Badge variant="default" className="text-[8px] px-1 py-0 bg-amber-500/10 text-amber-600">
                                          Sub-folder
                                        </Badge>
                                      </Link>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-2">
                                    <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-500/30">
                                      Sub-folder
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="py-2 text-xs font-mono text-cyan-600">
                                    {innerSub.videoCount || 0} Videos
                                  </TableCell>
                                  <TableCell className="py-2">
                                    {innerSub.isActive !== false ? (
                                      <Badge variant="success" className="text-[9px]">Active</Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-[9px] text-slate-400">Hidden</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="py-2 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-xs h-6 px-1.5 font-bold text-cyan-600 dark:text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10 cursor-pointer"
                                        onClick={() => handleOpenCreateVideo(innerSub)}
                                        title={`Add video in ${innerSub.name}`}
                                      >
                                        <Plus className="w-3 h-3 mr-0.5" />
                                        <span>Video</span>
                                      </Button>
                                      <Link href={`/admin/videos/folder/${innerSub.id}`}>
                                        <Button variant="outline" size="sm" className="text-xs h-6 px-2 font-bold cursor-pointer">
                                          <span>Open</span>
                                          <ChevronRight className="w-3 h-3 ml-0.5" />
                                        </Button>
                                      </Link>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}

                              {/* Videos inside subF */}
                              {subFolderContents[sf.id]?.videos?.map((vid) => {
                                const videoId = vid.youtubeVideoId || extractYoutubeVideoId(vid.youtubeUrl || '');
                                const videoThumb = vid.thumbnailUrl || (videoId ? youtubeFallbackThumbnail(videoId) : '');
                                return (
                                  <TableRow
                                    key={`subvid-item-${vid.id}`}
                                    className="bg-slate-50/20 dark:bg-[#0c152e]/15 border-b border-slate-100 dark:border-[#1e2e56]/20 hover:bg-rose-500/[0.04] transition-colors"
                                  >
                                    <TableCell className="py-2 pl-14">
                                      <div className="flex items-center gap-2.5">
                                        <span className="text-slate-300 dark:text-slate-600 text-xs font-mono shrink-0">└──</span>
                                        <div
                                          className="relative w-14 h-9 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 border border-slate-200/80 dark:border-[#1e2e56] shrink-0 group/thumb cursor-pointer shadow-xs"
                                          onClick={() => setPreviewVideo(vid)}
                                          title="Click to watch video preview"
                                        >
                                          {videoThumb ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                              src={videoThumb}
                                              alt={vid.title}
                                              className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-200"
                                              loading="lazy"
                                              onError={(e) => {
                                                if (videoId) {
                                                  (e.target as HTMLImageElement).src = youtubeFallbackThumbnail(videoId);
                                                }
                                              }}
                                            />
                                          ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-rose-500/10 text-rose-500">
                                              <Play className="w-3 h-3 fill-rose-500" />
                                            </div>
                                          )}
                                          <div className="absolute inset-0 bg-black/35 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                                            <Play className="w-3.5 h-3.5 text-white fill-white drop-shadow" />
                                          </div>
                                        </div>
                                        <div className="space-y-0.5 min-w-0">
                                          <span className="font-extrabold text-xs text-slate-900 dark:text-white truncate block max-w-sm">
                                            {vid.title}
                                          </span>
                                          {vid.description && (
                                            <p className="text-[11px] text-slate-400 truncate max-w-sm">{vid.description}</p>
                                          )}
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-2">
                                      <Badge variant="outline" className="text-[9px] text-rose-500 border-rose-500/30 bg-rose-500/5">
                                        VIDEO
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="py-2 text-xs font-mono text-slate-500">
                                      YouTube{vid.pdfUrl ? ' · PDF attached' : ''}
                                    </TableCell>
                                    <TableCell className="py-2">
                                      {vid.isActive !== false ? (
                                        <Badge variant="success" className="text-[9px]">Active</Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-[9px] text-slate-400">Hidden</Badge>
                                      )}
                                    </TableCell>
                                    <TableCell className="py-2 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="text-xs h-6 px-2 font-bold text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/10 cursor-pointer"
                                          onClick={() => setPreviewVideo(vid)}
                                        >
                                          <Play className="w-3 h-3 mr-1 fill-rose-500" />
                                          <span>Watch</span>
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0 text-slate-400 hover:text-amber-500 cursor-pointer"
                                          onClick={() => handleOpenEditVideo(vid)}
                                          title="Edit Video"
                                        >
                                          <Edit3 className="w-3 h-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0 text-slate-400 hover:text-rose-500 cursor-pointer"
                                          onClick={() => setDeleteVideoTarget(vid)}
                                          title="Delete Video"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </>
                          )}
                        </>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* Direct Videos in this Folder */}
                {paginatedVideos.map((vid) => {
                  const videoId = vid.youtubeVideoId || extractYoutubeVideoId(vid.youtubeUrl || '');
                  const videoThumb = vid.thumbnailUrl || (videoId ? youtubeFallbackThumbnail(videoId) : '');
                  return (
                    <TableRow
                      key={`direct-vid-${vid.id}`}
                      className="border-b border-slate-100 dark:border-[#1e2e56]/40 hover:bg-rose-500/[0.04] transition-colors"
                    >
                      <TableCell className="py-3 pl-4">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 flex items-center justify-center text-slate-300 dark:text-slate-700 font-mono text-xs shrink-0">
                            •
                          </div>
                          <div
                            className="relative w-16 h-10 sm:w-20 sm:h-12 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 border border-slate-200/80 dark:border-[#1e2e56] shrink-0 group/thumb cursor-pointer shadow-xs"
                            onClick={() => setPreviewVideo(vid)}
                            title="Click to watch video preview"
                          >
                            {videoThumb ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={videoThumb}
                                alt={vid.title}
                                className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-200"
                                loading="lazy"
                                onError={(e) => {
                                  if (videoId) {
                                    (e.target as HTMLImageElement).src = youtubeFallbackThumbnail(videoId);
                                  }
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-rose-500/10 text-rose-500">
                                <Play className="w-4 h-4 fill-rose-500" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/20 group-hover/thumb:bg-black/40 transition-colors flex items-center justify-center">
                              <div className="w-6 h-6 rounded-full bg-rose-600/90 text-white flex items-center justify-center shadow-md group-hover/thumb:scale-110 transition-transform">
                                <Play className="w-2.5 h-2.5 fill-white ml-0.5" />
                              </div>
                            </div>
                          </div>
                          <div className="space-y-0.5 min-w-0">
                            <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate block">
                              {vid.title}
                            </span>
                            {vid.description && (
                              <p className="text-[11px] text-slate-400 truncate max-w-sm">{vid.description}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="py-3">
                        <Badge variant="outline" className="font-bold text-xs text-rose-600 dark:text-rose-400 border-rose-500/30 bg-rose-500/5">
                          Video
                        </Badge>
                      </TableCell>

                      <TableCell className="py-3 text-xs font-mono text-slate-500">
                        YouTube{vid.pdfUrl ? ' · PDF attached' : ''}
                      </TableCell>

                      <TableCell className="py-3">
                        {vid.isActive !== false ? (
                          <Badge variant="success" className="font-bold text-xs flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Active</span>
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="font-bold text-xs flex items-center gap-1 text-slate-400">
                            <Eye className="w-3 h-3" />
                            <span>Hidden</span>
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="py-3 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 px-2 font-bold text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/10 cursor-pointer"
                            onClick={() => setPreviewVideo(vid)}
                          >
                            <Play className="w-3 h-3 mr-1 fill-rose-500" />
                            <span>Watch</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-400 hover:text-amber-500 h-7 w-7 p-0 cursor-pointer"
                            onClick={() => handleOpenEditVideo(vid)}
                            title="Edit Video"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-400 hover:text-rose-500 h-7 w-7 p-0 cursor-pointer"
                            onClick={() => setDeleteVideoTarget(vid)}
                            title="Delete Video"
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
          )}
        </div>

        {/* Pagination Footer */}
        {allItems.length > 0 && (
          <div className="p-4 border-t border-slate-200/80 dark:border-[#1e2e56]/40 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 dark:bg-[#0c152e]/30">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Showing <span className="font-bold text-slate-700 dark:text-slate-200">{Math.min(allItems.length, (currentPage - 1) * pageSize + 1)}</span> to{' '}
              <span className="font-bold text-slate-700 dark:text-slate-200">{Math.min(allItems.length, currentPage * pageSize)}</span> of{' '}
              <span className="font-bold text-slate-700 dark:text-slate-200">{allItems.length}</span> items
            </span>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={allItems.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </Card>

      {/* Subfolder Dialog */}
      <Dialog
        isOpen={isFolderDialogOpen}
        onClose={() => setIsFolderDialogOpen(false)}
        title={editingFolder ? 'Edit Subfolder' : parentForNewFolder ? `Add Subfolder inside "${parentForNewFolder.name}"` : `Create Subfolder inside "${folder.name}"`}
      >
        <form onSubmit={subFolderFormik.handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Subfolder Name <span className="text-rose-500">*</span>
            </label>
            <Input
              name="name"
              placeholder="e.g. Ancient Kerala History"
              value={subFolderFormik.values.name}
              onChange={subFolderFormik.handleChange}
              onBlur={subFolderFormik.handleBlur}
              error={subFolderFormik.touched.name && subFolderFormik.errors.name ? subFolderFormik.errors.name : undefined}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Description (Optional)
            </label>
            <textarea
              name="description"
              rows={3}
              placeholder="Brief description..."
              value={subFolderFormik.values.description}
              onChange={subFolderFormik.handleChange}
              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#091124] border border-slate-200 dark:border-[#1e2e56] text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <ToggleSwitch
            label="Active Status"
            description="Visible to students"
            checked={subFolderFormik.values.isActive}
            onChange={(checked) => subFolderFormik.setFieldValue('isActive', checked)}
            variant="emerald"
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsFolderDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="gold"
              size="sm"
              disabled={subFolderFormik.isSubmitting}
            >
              {subFolderFormik.isSubmitting ? 'Saving...' : editingFolder ? 'Save Changes' : 'Create Subfolder'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Video Dialog */}
      <Dialog
        isOpen={isVideoDialogOpen}
        onClose={() => setIsVideoDialogOpen(false)}
        title={editingVideo ? 'Edit Video' : `Add Video to "${targetFolderForVideo?.name || folder.name}"`}
      >
        <form onSubmit={videoFormik.handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Video Title <span className="text-rose-500">*</span>
            </label>
            <Input
              name="title"
              placeholder="e.g. Medieval Indian History"
              value={videoFormik.values.title}
              onChange={videoFormik.handleChange}
              onBlur={videoFormik.handleBlur}
              error={videoFormik.touched.title && videoFormik.errors.title ? videoFormik.errors.title : undefined}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              YouTube Video URL <span className="text-rose-500">*</span>
            </label>
            <Input
              name="youtubeUrl"
              placeholder="https://www.youtube.com/watch?v=... or youtu.be/..."
              value={videoFormik.values.youtubeUrl}
              onChange={videoFormik.handleChange}
              onBlur={videoFormik.handleBlur}
              error={videoFormik.touched.youtubeUrl && videoFormik.errors.youtubeUrl ? videoFormik.errors.youtubeUrl : undefined}
            />
            {(() => {
              const previewVidId = extractYoutubeVideoId(videoFormik.values.youtubeUrl);
              if (!previewVidId) return null;
              return (
                <div className="mt-2 flex items-center gap-3 p-2.5 rounded-xl border border-rose-500/20 bg-rose-500/5 animate-in fade-in duration-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={youtubeFallbackThumbnail(previewVidId)}
                    alt="YouTube Preview"
                    className="w-24 h-14 rounded-lg object-cover bg-slate-200 dark:bg-slate-800 shrink-0 border border-rose-500/20 shadow-xs"
                  />
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-500">
                      YouTube Thumbnail Detected
                    </p>
                    <p className="text-xs font-mono text-slate-600 dark:text-slate-300 truncate">
                      ID: {previewVidId}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Description (Optional)
            </label>
            <textarea
              name="description"
              rows={2}
              placeholder="Key notes..."
              value={videoFormik.values.description}
              onChange={videoFormik.handleChange}
              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#091124] border border-slate-200 dark:border-[#1e2e56] text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Attached PDF Option */}
          <div className="space-y-2 p-3 rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#0c152e]/50">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-500" />
                <span>Attach Study Material PDF (Optional)</span>
              </label>
              <span className="text-[10px] text-slate-400">PDF · Max 50MB</span>
            </div>

            {editingVideo?.pdfUrl && !attachedPdfFile && (
              <div className="flex items-center justify-between gap-2 p-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs">
                <p className="font-bold text-amber-900 dark:text-amber-300 truncate">
                  {editingVideo.pdfFileName || 'Attached Study PDF'}
                </p>
                <a
                  href={editingVideo.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold text-amber-600 hover:underline inline-flex items-center gap-0.5"
                >
                  <span>View</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {attachedPdfFile && (
              <div className="flex items-center justify-between gap-2 p-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-300">
                <p className="font-bold truncate">{attachedPdfFile.name}</p>
                <button type="button" onClick={() => setAttachedPdfFile(null)} className="text-slate-400 hover:text-rose-500 cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <FileDropZone
              accept="application/pdf,.pdf"
              onFiles={([file]) => {
                if (file && file.size > 50 * 1024 * 1024) {
                  alert('PDF file size must be less than 50MB.');
                  return;
                }
                setAttachedPdfFile(file);
              }}
              onReject={() => alert('Only PDF files can be attached here.')}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-[#1e2e56] bg-white dark:bg-[#091124] text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:border-amber-500/50 hover:bg-amber-500/5 transition-all"
            >
              {({ isDragActive }) => (
                <>
                  <UploadCloud className="w-3.5 h-3.5 text-amber-500" />
                  <span>
                    {isDragActive
                      ? 'Drop PDF to upload…'
                      : attachedPdfFile
                        ? 'Change attached PDF file…'
                        : 'Choose a PDF file to attach…'}
                  </span>
                </>
              )}
            </FileDropZone>

            {pdfUploadPercent !== null && (
              <div className="space-y-1 pt-1">
                <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-cyan-500 transition-all duration-200"
                    style={{ width: `${pdfUploadPercent}%` }}
                  />
                </div>
                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Uploading PDF… {pdfUploadPercent}%</p>
              </div>
            )}
          </div>

          <ToggleSwitch
            label="Active Status"
            description="Visible to students"
            checked={videoFormik.values.isActive}
            onChange={(checked) => videoFormik.setFieldValue('isActive', checked)}
            variant="emerald"
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsVideoDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="gold"
              size="sm"
              disabled={videoFormik.isSubmitting}
            >
              {videoFormik.isSubmitting ? 'Saving...' : editingVideo ? 'Save Changes' : 'Add Video'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Folder Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteFolderTarget}
        onCancel={() => setDeleteFolderTarget(null)}
        onConfirm={handleDeleteFolder}
        title="Delete Subfolder?"
        description={`Are you sure you want to delete "${deleteFolderTarget?.name}"? All inner folders and videos will also be deleted.`}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Delete Video Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteVideoTarget}
        onCancel={() => setDeleteVideoTarget(null)}
        onConfirm={handleDeleteVideo}
        title="Delete Video?"
        description={`Are you sure you want to delete "${deleteVideoTarget?.title}"?`}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* YouTube Preview Player Modal */}
      {previewVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 !mt-0"
          onClick={() => setPreviewVideo(null)}
        >
          <div
            className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white truncate">{previewVideo.title}</h3>
              <button
                type="button"
                onClick={() => setPreviewVideo(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${previewVideo.youtubeVideoId}?autoplay=1`}
                title={previewVideo.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
