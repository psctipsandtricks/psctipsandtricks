'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
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
  Search,
  Video as VideoIcon,
  Play,
  X,
  CheckCircle2,
  FileText,
  UploadCloud,
  ExternalLink,
  Eye,
} from 'lucide-react';
import type { VideoFolder, Video } from '@psc/shared-types';
import { extractYoutubeVideoId, youtubeFallbackThumbnail } from '@/lib/youtube';
import { MediaLibrarySkeleton, AdminSkeletonTable } from '../admin-skeleton';

const folderSchema = Yup.object({
  name: Yup.string().trim().required('Folder name is required'),
});

const videoSchema = Yup.object({
  title: Yup.string().trim().required('Video title is required'),
  youtubeUrl: Yup.string().trim().required('YouTube URL is required'),
});

export default function AdminVideoFoldersPage() {
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState<VideoFolder[]>([]);
  const [allFoldersList, setAllFoldersList] = useState<VideoFolder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageError, setPageError] = useState('');

  // Folder Dialog
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

  // Expandable Hierarchy Tree State
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [folderContents, setFolderContents] = useState<
    Record<string, { subFolders: VideoFolder[]; videos: Video[]; loading: boolean }>
  >({});

  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => setToastMsg(null), 4000);
    return () => clearTimeout(timer);
  }, [toastMsg]);

  const loadFolders = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [topLevel, allFolders] = await Promise.all([
        ApiClient.getVideoFolders('root'),
        ApiClient.getVideoFolders(),
      ]);
      setFolders(topLevel || []);
      setAllFoldersList(allFolders || []);
    } catch (err: any) {
      setPageError(err.message || 'Failed to load video folders.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  const refreshFolderContents = async (folderId: string) => {
    try {
      const [childrenFolders, videoList] = await Promise.all([
        ApiClient.getVideoFolders(folderId),
        ApiClient.getVideos({ folderId }),
      ]);
      setFolderContents((prev) => ({
        ...prev,
        [folderId]: {
          subFolders: childrenFolders || [],
          videos: videoList || [],
          loading: false,
        },
      }));
    } catch {
      // Ignore refresh error
    }
  };

  const toggleExpandFolder = async (folder: VideoFolder) => {
    const nextState = !expandedFolders[folder.id];
    setExpandedFolders((prev) => ({ ...prev, [folder.id]: nextState }));

    if (nextState && !folderContents[folder.id]) {
      setFolderContents((prev) => ({
        ...prev,
        [folder.id]: { subFolders: [], videos: [], loading: true },
      }));
      await refreshFolderContents(folder.id);
    }
  };

  // Folder Formik
  const folderFormik = useFormik({
    initialValues: { name: '', description: '', parentId: '', isActive: true },
    validationSchema: folderSchema,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        if (editingFolder) {
          await ApiClient.updateVideoFolder(editingFolder.id, {
            name: values.name.trim(),
            description: values.description?.trim() || null,
            parentId: values.parentId || null,
            isActive: values.isActive,
          });
          setToastMsg({ type: 'success', text: `Folder "${values.name}" updated successfully.` });
        } else {
          await ApiClient.createVideoFolder({
            name: values.name.trim(),
            description: values.description?.trim() || null,
            parentId: values.parentId || null,
            isActive: values.isActive,
          });
          setToastMsg({ type: 'success', text: `Folder "${values.name}" created successfully.` });
        }
        setIsFolderDialogOpen(false);
        setEditingFolder(null);
        setParentForNewFolder(null);
        resetForm();
        await loadFolders(true);
        if (values.parentId) {
          await refreshFolderContents(values.parentId);
        }
      } catch (err: any) {
        folderFormik.setFieldError('name', err.message || 'Failed to save folder.');
      } finally {
        setSubmitting(false);
      }
    },
  });

  // Video Formik
  const videoFormik = useFormik({
    initialValues: { title: '', description: '', youtubeUrl: '', folderId: '', isActive: true },
    validationSchema: videoSchema,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        let savedVideo: Video;
        if (editingVideo) {
          savedVideo = await ApiClient.updateVideo(editingVideo.id, {
            title: values.title.trim(),
            description: values.description?.trim() || undefined,
            youtubeUrl: values.youtubeUrl.trim(),
            folderId: values.folderId,
            isActive: values.isActive,
          });
          setToastMsg({ type: 'success', text: `Video "${values.title}" updated.` });
        } else {
          savedVideo = await ApiClient.createVideo({
            title: values.title.trim(),
            description: values.description?.trim() || undefined,
            youtubeUrl: values.youtubeUrl.trim(),
            folderId: values.folderId,
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
        if (values.folderId) {
          await refreshFolderContents(values.folderId);
        }
        await loadFolders(true);
      } catch (err: any) {
        videoFormik.setFieldError('title', err.message || 'Failed to save video.');
      } finally {
        setPdfUploadPercent(null);
        setSubmitting(false);
      }
    },
  });

  const handleOpenCreateFolder = (parent?: VideoFolder | null) => {
    setEditingFolder(null);
    setParentForNewFolder(parent || null);
    folderFormik.resetForm({
      values: {
        name: '',
        description: '',
        parentId: parent ? parent.id : '',
        isActive: true,
      },
    });
    setIsFolderDialogOpen(true);
  };

  const handleOpenEditFolder = (folder: VideoFolder) => {
    setEditingFolder(folder);
    setParentForNewFolder(null);
    folderFormik.resetForm({
      values: {
        name: folder.name,
        description: folder.description || '',
        parentId: folder.parentId || '',
        isActive: folder.isActive !== false,
      },
    });
    setIsFolderDialogOpen(true);
  };

  const handleOpenCreateVideo = (targetFolder?: VideoFolder | null) => {
    setEditingVideo(null);
    setTargetFolderForVideo(targetFolder || null);
    setAttachedPdfFile(null);
    videoFormik.resetForm({
      values: {
        title: '',
        description: '',
        youtubeUrl: '',
        folderId: targetFolder ? targetFolder.id : folders[0]?.id || '',
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
        folderId: video.folderId || '',
        isActive: video.isActive !== false,
      },
    });
    setIsVideoDialogOpen(true);
  };

  const handleDeleteFolder = async () => {
    if (!deleteFolderTarget) return;
    const target = deleteFolderTarget;
    const parentId = target.parentId;
    const prevFolders = folders;
    const prevFolderContents = folderContents;

    // 1. Immediately dismiss modal in 0ms
    setDeleteFolderTarget(null);

    // 2. Optimistically remove folder from table state
    setFolders((prev) => prev.filter((f) => f.id !== target.id));
    if (parentId && prevFolderContents[parentId]) {
      setFolderContents((prev) => ({
        ...prev,
        [parentId]: {
          ...prev[parentId],
          subFolders: prev[parentId].subFolders.filter((sf) => sf.id !== target.id),
        },
      }));
    }

    try {
      await ApiClient.deleteVideoFolder(target.id);
      setToastMsg({ type: 'success', text: `Folder "${target.name}" deleted.` });
      await loadFolders(true);
      if (parentId) {
        await refreshFolderContents(parentId);
      }
    } catch (err: any) {
      setFolders(prevFolders);
      setFolderContents(prevFolderContents);
      setToastMsg({ type: 'error', text: err.message || 'Failed to delete folder.' });
    }
  };

  const handleDeleteVideo = async () => {
    if (!deleteVideoTarget) return;
    const target = deleteVideoTarget;
    const folderId = target.folderId;
    const prevFolderContents = folderContents;

    // 1. Immediately dismiss modal in 0ms
    setDeleteVideoTarget(null);

    // 2. Optimistically remove video from table state
    if (folderId && prevFolderContents[folderId]) {
      setFolderContents((prev) => ({
        ...prev,
        [folderId]: {
          ...prev[folderId],
          videos: prev[folderId].videos.filter((v) => v.id !== target.id),
        },
      }));
    }

    try {
      await ApiClient.deleteVideo(target.id);
      setToastMsg({ type: 'success', text: `Video "${target.title}" deleted.` });
      if (folderId) {
        await refreshFolderContents(folderId);
      }
      await loadFolders(true);
    } catch (err: any) {
      setFolderContents(prevFolderContents);
      setToastMsg({ type: 'error', text: err.message || 'Failed to delete video.' });
    }
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const filteredFolders = folders.filter(
    (f) =>
      !searchTerm.trim() ||
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.description && f.description.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const totalPages = Math.max(1, Math.ceil(filteredFolders.length / pageSize));
  const paginatedFolders = filteredFolders.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  if (loading && folders.length === 0) {
    return <MediaLibrarySkeleton isPdf={false} />;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4 rounded-b-2xl">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-3 duration-200 ${
            toastMsg.type === 'success'
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

      {/* Header */}
      <div className="shrink-0 space-y-3">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Video Library
              </h1>
              <Badge variant="gold" className="font-extrabold text-xs">
                {folders.length} {folders.length === 1 ? 'Root Folder' : 'Root Folders'}
              </Badge>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5">
              Organize video lessons and PDF attachments across courses, chapters, and nested subfolders.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="font-bold border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
              onClick={() => handleOpenCreateVideo(null)}
              disabled={allFoldersList.length === 0}
            >
              <Plus className="w-4 h-4" />
              <span>Add Video</span>
            </Button>
            <Button
              variant="gold"
              size="sm"
              className="font-bold shadow-md shadow-amber-500/20 cursor-pointer"
              onClick={() => handleOpenCreateFolder(null)}
            >
              <Plus className="w-4 h-4" />
              <span>Add Folder</span>
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder="Search folders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Error State */}
      {pageError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center justify-between">
          <span>{pageError}</span>
          <button type="button" onClick={() => setPageError('')} className="text-rose-500 hover:underline text-[11px] font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* Table Card */}
      <Card className="flex-1 flex flex-col min-h-0 border border-slate-200/80 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] admin-table-card overflow-hidden p-0">
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <AdminSkeletonTable rowsCount={5} />
          ) : filteredFolders.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner">
                <FolderOpen className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {searchTerm ? 'No matching folders found' : 'No Video Folders Yet'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                  {searchTerm
                    ? 'Try adjusting your search keywords.'
                    : 'Click "Add Folder" to create your first top-level video folder category.'}
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200/80 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#0c152e]/50">
                  <TableHead className="font-bold text-xs">Folder Name</TableHead>
                  <TableHead className="font-bold text-xs">Sub-folders</TableHead>
                  <TableHead className="font-bold text-xs">Videos</TableHead>
                  <TableHead className="font-bold text-xs">Status</TableHead>
                  <TableHead className="font-bold text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedFolders.map((folder) => {
                  const hasContents =
                    (folder.subFolderCount || 0) > 0 || (folder.videoCount || 0) > 0;

                  return (
                    <React.Fragment key={`folder-frag-${folder.id}`}>
                      <TableRow className="border-b border-slate-100 dark:border-[#1e2e56]/40 hover:bg-amber-500/[0.04] transition-colors group">
                        {/* Folder Name & Tree expander */}
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2.5">
                            {hasContents ? (
                              <button
                                type="button"
                                onClick={() => toggleExpandFolder(folder)}
                                className="w-7 h-7 rounded-lg border border-amber-500/40 dark:border-amber-400/40 flex items-center justify-center text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer shrink-0"
                                title={expandedFolders[folder.id] ? 'Collapse contents' : 'Expand contents'}
                              >
                                <ChevronDown
                                  className={`w-4 h-4 transition-transform duration-200 ${
                                    expandedFolders[folder.id] ? '' : '-rotate-90'
                                  }`}
                                />
                              </button>
                            ) : (
                              <div className="w-7 h-7 flex items-center justify-center text-slate-300 dark:text-slate-700 font-mono text-xs shrink-0">
                                •
                              </div>
                            )}

                            <Link
                              href={`/admin/videos/folder/${folder.id}`}
                              className="flex items-center gap-2.5 group/link min-w-[200px]"
                            >
                              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 shadow-inner group-hover/link:scale-105 transition-transform">
                                <Folder className="w-4 h-4" />
                              </div>
                              <div className="space-y-0.5 min-w-0">
                                <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate block group-hover/link:text-amber-600 dark:group-hover/link:text-amber-400 transition-colors">
                                  {folder.name}
                                </span>
                                {folder.description && (
                                  <p className="text-[11px] text-slate-400 truncate max-w-xs">{folder.description}</p>
                                )}
                              </div>
                            </Link>
                          </div>
                        </TableCell>

                        {/* Sub-folder count */}
                        <TableCell className="py-3 text-xs font-mono text-slate-500 dark:text-slate-400">
                          {folder.subFolderCount || 0} {(folder.subFolderCount || 0) === 1 ? 'Subfolder' : 'Subfolders'}
                        </TableCell>

                        {/* Video count */}
                        <TableCell className="py-3 text-xs font-mono text-cyan-600 dark:text-cyan-400 font-bold">
                          {folder.videoCount || 0} {(folder.videoCount || 0) === 1 ? 'Video' : 'Videos'}
                        </TableCell>

                        {/* Status */}
                        <TableCell className="py-3">
                          {folder.isActive !== false ? (
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
                              onClick={() => handleOpenCreateVideo(folder)}
                              title={`Add video directly into ${folder.name}`}
                            >
                              <Plus className="w-3 h-3 mr-0.5" />
                              <span>Video</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 px-2 font-bold text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 cursor-pointer"
                              onClick={() => handleOpenCreateFolder(folder)}
                              title={`Add subfolder into ${folder.name}`}
                            >
                              <Plus className="w-3 h-3 mr-0.5" />
                              <span>Folder</span>
                            </Button>
                            <Link href={`/admin/videos/folder/${folder.id}`}>
                              <Button variant="outline" size="sm" className="text-xs h-7 px-2 font-bold cursor-pointer">
                                <span>Open</span>
                                <ChevronRight className="w-3 h-3 ml-0.5" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-400 hover:text-amber-500 h-7 w-7 p-0 cursor-pointer"
                              onClick={() => handleOpenEditFolder(folder)}
                              title="Edit Folder"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-400 hover:text-rose-500 h-7 w-7 p-0 cursor-pointer"
                              onClick={() => setDeleteFolderTarget(folder)}
                              title="Delete Folder"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Dropdown Hierarchy Rows if Expanded */}
                      {expandedFolders[folder.id] && (
                        <>
                          {folderContents[folder.id]?.loading ? (
                            <TableRow className="bg-slate-50/50 dark:bg-[#0c152e]/40 border-b border-slate-100 dark:border-[#1e2e56]/30">
                              <TableCell colSpan={5} className="py-3 pl-12">
                                <div className="flex items-center space-x-2 text-xs text-slate-400">
                                  <span className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                  <span>Loading contents for &ldquo;{folder.name}&rdquo;...</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            <>
                              {/* Subfolders inside this folder */}
                              {folderContents[folder.id]?.subFolders?.map((subF) => {
                                const subHasContents =
                                  (subF.subFolderCount || 0) > 0 || (subF.videoCount || 0) > 0;

                                return (
                                  <React.Fragment key={`subfolder-frag-${subF.id}`}>
                                    <TableRow className="bg-slate-50/40 dark:bg-[#0c152e]/30 border-b border-slate-100 dark:border-[#1e2e56]/30 hover:bg-amber-500/[0.04] transition-colors">
                                      <TableCell className="py-2.5 pl-10">
                                        <div className="flex items-center gap-2">
                                          {subHasContents ? (
                                            <button
                                              type="button"
                                              onClick={() => toggleExpandFolder(subF)}
                                              className="w-5 h-5 rounded border border-cyan-500/40 text-cyan-600 flex items-center justify-center hover:bg-cyan-500/10 cursor-pointer"
                                            >
                                              <ChevronDown
                                                className={`w-3 h-3 transition-transform ${
                                                  expandedFolders[subF.id] ? '' : '-rotate-90'
                                                }`}
                                              />
                                            </button>
                                          ) : (
                                            <span className="text-slate-300 dark:text-slate-600 text-xs font-mono shrink-0">└──</span>
                                          )}
                                          <Link
                                            href={`/admin/videos/folder/${subF.id}`}
                                            className="flex items-center gap-2 group/sublink"
                                          >
                                            <div className="w-6 h-6 rounded-md bg-amber-500/10 text-amber-500 flex items-center justify-center">
                                              <Folder className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="font-extrabold text-xs text-slate-900 dark:text-white group-hover/sublink:text-amber-500">
                                              {subF.name}
                                            </span>
                                            <Badge variant="default" className="text-[9px] px-1 py-0 bg-amber-500/10 text-amber-600">
                                              Sub-folder
                                            </Badge>
                                          </Link>
                                        </div>
                                      </TableCell>
                                      <TableCell className="py-2.5 text-xs font-mono text-slate-500">
                                        {subF.subFolderCount || 0} Subfolders
                                      </TableCell>
                                      <TableCell className="py-2.5 text-xs font-mono text-cyan-600 font-bold">
                                        {subF.videoCount || 0} Videos
                                      </TableCell>
                                      <TableCell className="py-2.5">
                                        {subF.isActive !== false ? (
                                          <Badge variant="success" className="text-[10px]">Active</Badge>
                                        ) : (
                                          <Badge variant="outline" className="text-[10px] text-slate-400">Hidden</Badge>
                                        )}
                                      </TableCell>
                                      <TableCell className="py-2.5 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-xs h-6 px-1.5 font-bold text-cyan-600 dark:text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10 cursor-pointer"
                                            onClick={() => handleOpenCreateVideo(subF)}
                                            title={`Add video in ${subF.name}`}
                                          >
                                            <Plus className="w-3 h-3 mr-0.5" />
                                            <span>Video</span>
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-xs h-6 px-1.5 font-bold text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 cursor-pointer"
                                            onClick={() => handleOpenCreateFolder(subF)}
                                            title={`Add subfolder in ${subF.name}`}
                                          >
                                            <Plus className="w-3 h-3 mr-0.5" />
                                            <span>Folder</span>
                                          </Button>
                                          <Link href={`/admin/videos/folder/${subF.id}`}>
                                            <Button variant="outline" size="sm" className="text-xs h-6 px-2 font-bold cursor-pointer">
                                              <span>Open</span>
                                              <ChevronRight className="w-3 h-3 ml-0.5" />
                                            </Button>
                                          </Link>
                                        </div>
                                      </TableCell>
                                    </TableRow>

                                    {/* Level 3: Nested items inside subF */}
                                    {expandedFolders[subF.id] && (
                                      <>
                                        {folderContents[subF.id]?.loading ? (
                                          <TableRow className="bg-slate-50/20 dark:bg-[#0c152e]/15 border-b border-slate-100 dark:border-[#1e2e56]/20">
                                            <TableCell colSpan={5} className="py-2 pl-20 text-xs text-slate-400">
                                              Loading nested items...
                                            </TableCell>
                                          </TableRow>
                                        ) : (
                                          <>
                                            {/* Sub-subfolders */}
                                            {folderContents[subF.id]?.subFolders?.map((innerSub) => (
                                              <TableRow
                                                key={`inner-sub-${innerSub.id}`}
                                                className="bg-slate-50/30 dark:bg-[#0c152e]/20 border-b border-slate-100 dark:border-[#1e2e56]/20 hover:bg-amber-500/[0.04] transition-colors"
                                              >
                                                <TableCell className="py-2 pl-20">
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-slate-300 dark:text-slate-600 text-xs font-mono shrink-0">└──</span>
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
                                            {folderContents[subF.id]?.videos?.map((vid) => {
                                              const videoId = vid.youtubeVideoId || extractYoutubeVideoId(vid.youtubeUrl || '');
                                              const videoThumb = vid.thumbnailUrl || (videoId ? youtubeFallbackThumbnail(videoId) : '');
                                              return (
                                                <TableRow
                                                  key={`subvid-item-${vid.id}`}
                                                  className="bg-slate-50/20 dark:bg-[#0c152e]/15 border-b border-slate-100 dark:border-[#1e2e56]/20 hover:bg-rose-500/[0.04] transition-colors"
                                                >
                                                  <TableCell className="py-2 pl-20">
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

                              {/* Direct Videos under Top Folder */}
                              {folderContents[folder.id]?.videos?.map((vid) => {
                                const videoId = vid.youtubeVideoId || extractYoutubeVideoId(vid.youtubeUrl || '');
                                const videoThumb = vid.thumbnailUrl || (videoId ? youtubeFallbackThumbnail(videoId) : '');
                                return (
                                  <TableRow
                                    key={`top-vid-item-${vid.id}`}
                                    className="bg-slate-50/30 dark:bg-[#0c152e]/20 border-b border-slate-100 dark:border-[#1e2e56]/30 hover:bg-rose-500/[0.04] transition-colors"
                                  >
                                    <TableCell className="py-2.5 pl-12">
                                      <div className="flex items-center gap-3">
                                        <span className="text-slate-300 dark:text-slate-600 text-xs font-mono shrink-0">└──</span>
                                        <div
                                          className="relative w-14 h-9 sm:w-16 sm:h-10 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 border border-slate-200/80 dark:border-[#1e2e56] shrink-0 group/thumb cursor-pointer shadow-xs"
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
                                              <Play className="w-3.5 h-3.5 fill-rose-500" />
                                            </div>
                                          )}
                                          <div className="absolute inset-0 bg-black/35 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                                            <Play className="w-3.5 h-3.5 text-white fill-white drop-shadow" />
                                          </div>
                                        </div>
                                        <div className="space-y-0.5 min-w-0">
                                          <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate block max-w-md">
                                            {vid.title}
                                          </span>
                                          {vid.description && (
                                            <p className="text-[11px] text-slate-400 truncate max-w-md">{vid.description}</p>
                                          )}
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-2.5">
                                      <Badge variant="outline" className="text-[9px] text-rose-500 border-rose-500/30 bg-rose-500/5">
                                        VIDEO
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="py-2.5 text-xs font-mono text-slate-500">
                                      YouTube{vid.pdfUrl ? ' · PDF attached' : ''}
                                    </TableCell>
                                    <TableCell className="py-2.5">
                                      {vid.isActive !== false ? (
                                        <Badge variant="success" className="text-[9px]">Active</Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-[9px] text-slate-400">Hidden</Badge>
                                      )}
                                    </TableCell>
                                    <TableCell className="py-2.5 text-right">
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
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination Footer */}
        {filteredFolders.length > 0 && (
          <div className="px-4 sm:px-6 py-3 border-t border-slate-200/80 dark:border-[#1e2e56]/40 bg-slate-50/50 dark:bg-[#0c152e]/30">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredFolders.length}
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

      {/* Folder Dialog */}
      <Dialog
        isOpen={isFolderDialogOpen}
        onClose={() => setIsFolderDialogOpen(false)}
        title={editingFolder ? 'Edit Video Folder' : parentForNewFolder ? `Add Subfolder inside "${parentForNewFolder.name}"` : 'Create Video Folder'}
      >
        <form onSubmit={folderFormik.handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Folder Name <span className="text-rose-500">*</span>
            </label>
            <Input
              name="name"
              placeholder="e.g. Kerala PSC Degree Level"
              value={folderFormik.values.name}
              onChange={folderFormik.handleChange}
              onBlur={folderFormik.handleBlur}
              error={folderFormik.touched.name && folderFormik.errors.name ? folderFormik.errors.name : undefined}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Parent Folder (Optional)
            </label>
            <select
              name="parentId"
              value={folderFormik.values.parentId}
              onChange={folderFormik.handleChange}
              className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-[#091124] border border-slate-200 dark:border-[#1e2e56] text-slate-900 dark:text-white"
            >
              <option value="">Top Level (No Parent)</option>
              {allFoldersList
                .filter((f) => !editingFolder || f.id !== editingFolder.id)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Description (Optional)
            </label>
            <textarea
              name="description"
              rows={3}
              placeholder="Brief description of videos stored in this folder..."
              value={folderFormik.values.description}
              onChange={folderFormik.handleChange}
              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#091124] border border-slate-200 dark:border-[#1e2e56] text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <ToggleSwitch
            label="Active Status"
            description="Visible to students in video library"
            checked={folderFormik.values.isActive}
            onChange={(checked) => folderFormik.setFieldValue('isActive', checked)}
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
              disabled={folderFormik.isSubmitting}
            >
              {folderFormik.isSubmitting ? 'Saving...' : editingFolder ? 'Save Changes' : 'Create Folder'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Video Dialog */}
      <Dialog
        isOpen={isVideoDialogOpen}
        onClose={() => setIsVideoDialogOpen(false)}
        title={editingVideo ? 'Edit Video' : `Add Video to "${targetFolderForVideo?.name || 'Folder'}"`}
      >
        <form onSubmit={videoFormik.handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Video Title <span className="text-rose-500">*</span>
            </label>
            <Input
              name="title"
              placeholder="e.g. Modern Indian History - Part 1"
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
              Folder <span className="text-rose-500">*</span>
            </label>
            <select
              name="folderId"
              value={videoFormik.values.folderId}
              onChange={videoFormik.handleChange}
              className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-[#091124] border border-slate-200 dark:border-[#1e2e56] text-slate-900 dark:text-white"
            >
              {allFoldersList.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Description (Optional)
            </label>
            <textarea
              name="description"
              rows={2}
              placeholder="Key topics covered in this lesson..."
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

            <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-[#1e2e56] bg-white dark:bg-[#091124] text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:border-amber-500/50 hover:bg-amber-500/5 transition-all">
              <UploadCloud className="w-3.5 h-3.5 text-amber-500" />
              <span>{attachedPdfFile ? 'Change attached PDF file…' : 'Choose a PDF file to attach…'}</span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  if (file && file.size > 50 * 1024 * 1024) {
                    alert('PDF file size must be less than 50MB.');
                    return;
                  }
                  setAttachedPdfFile(file);
                }}
              />
            </label>

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
        title="Delete Video Folder?"
        description={`Are you sure you want to delete "${deleteFolderTarget?.name}"? All nested subfolders and videos inside this folder will also be removed.`}
        confirmLabel="Delete Folder"
        variant="danger"
      />

      {/* Delete Video Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteVideoTarget}
        onCancel={() => setDeleteVideoTarget(null)}
        onConfirm={handleDeleteVideo}
        title="Delete Video?"
        description={`Are you sure you want to delete "${deleteVideoTarget?.title}"?`}
        confirmLabel="Delete Video"
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
