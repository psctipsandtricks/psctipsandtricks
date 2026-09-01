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
  FileText,
  X,
  UploadCloud,
  ExternalLink,
  Eye,
  CheckCircle2,
  Search,
} from 'lucide-react';
import type { PdfFolder, PdfDocument } from '@psc/shared-types';
import { AdminFolderDetailSkeleton } from '@/app/skeletons/page-skeletons';
import { AdminSkeletonTable } from '../../../admin-skeleton';

const folderSchema = Yup.object({
  name: Yup.string().trim().required('Folder name is required'),
});

const documentSchema = Yup.object({
  title: Yup.string().trim().required('Document title is required'),
});

export default function AdminPdfFolderDetailPage({ params }: { params: { folderId: string } }) {
  const router = useRouter();
  const folderId = params.folderId;

  const [loading, setLoading] = useState(true);
  const [folderData, setFolderData] = useState<{
    folder: PdfFolder;
    breadcrumbs: { id: string; name: string }[];
    children: PdfFolder[];
    documents: PdfDocument[];
  } | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Subfolder Dialog
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<PdfFolder | null>(null);
  const [parentForNewFolder, setParentForNewFolder] = useState<PdfFolder | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<PdfFolder | null>(null);

  // Document Dialog
  const [isDocDialogOpen, setIsDocDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<PdfDocument | null>(null);
  const [targetFolderForDoc, setTargetFolderForDoc] = useState<PdfFolder | null>(null);
  const [deleteDocTarget, setDeleteDocTarget] = useState<PdfDocument | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [pdfUploadPercent, setPdfUploadPercent] = useState<number | null>(null);

  // Toast
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Expandable Hierarchy Tree State for Subfolders in this page
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [subFolderContents, setSubFolderContents] = useState<
    Record<string, { subFolders: PdfFolder[]; documents: PdfDocument[]; loading: boolean }>
  >({});

  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => setToastMsg(null), 4000);
    return () => clearTimeout(timer);
  }, [toastMsg]);

  const loadFolder = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await ApiClient.getPdfFolder(folderId);
      setFolderData({
        folder: data,
        breadcrumbs: data.breadcrumbs || [],
        children: data.children || [],
        documents: data.documents || [],
      });
    } catch {
      router.replace('/admin/pdfs');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [folderId, router]);

  useEffect(() => {
    loadFolder();
  }, [loadFolder]);

  const refreshSubFolderContents = async (subFolderId: string) => {
    try {
      const [childSubFolders, docList] = await Promise.all([
        ApiClient.getPdfFolders(subFolderId),
        ApiClient.getPdfDocuments({ folderId: subFolderId }),
      ]);
      setSubFolderContents((prev) => ({
        ...prev,
        [subFolderId]: {
          subFolders: childSubFolders || [],
          documents: docList || [],
          loading: false,
        },
      }));
    } catch {
      // Ignore refresh error
    }
  };

  const toggleExpandFolder = async (folder: PdfFolder) => {
    const hasContents = (folder.subFolderCount || 0) > 0 || (folder.documentCount || 0) > 0;
    if (!hasContents) return;

    const nextState = !expandedFolders[folder.id];
    setExpandedFolders((prev) => ({ ...prev, [folder.id]: nextState }));

    if (nextState && !subFolderContents[folder.id]) {
      setSubFolderContents((prev) => ({
        ...prev,
        [folder.id]: { subFolders: [], documents: [], loading: true },
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
          await ApiClient.updatePdfFolder(editingFolder.id, {
            name: values.name.trim(),
            description: values.description?.trim() || null,
            parentId: values.parentId || folderId,
            isActive: values.isActive,
          });
          setToastMsg({ type: 'success', text: `Folder "${values.name}" updated.` });
        } else {
          await ApiClient.createPdfFolder({
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

  // Document Formik
  const docFormik = useFormik({
    initialValues: { title: '', description: '', folderId, isActive: true },
    validationSchema: documentSchema,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        let savedDoc: PdfDocument;
        const targetFId = values.folderId || folderId;
        if (editingDoc) {
          savedDoc = await ApiClient.updatePdfDocument(editingDoc.id, {
            title: values.title.trim(),
            description: values.description?.trim() || undefined,
            folderId: targetFId,
            isActive: values.isActive,
          });
          setToastMsg({ type: 'success', text: `Document "${values.title}" updated.` });
        } else {
          if (!docFile) {
            docFormik.setFieldError('title', 'Please choose a PDF file to upload.');
            setSubmitting(false);
            return;
          }
          savedDoc = await ApiClient.createPdfDocument({
            title: values.title.trim(),
            description: values.description?.trim() || undefined,
            folderId: targetFId,
            isActive: values.isActive,
          });
          setToastMsg({ type: 'success', text: `Document "${values.title}" created.` });
        }

        if (docFile && savedDoc?.id) {
          setPdfUploadPercent(0);
          await ApiClient.uploadPdfDocumentFile(savedDoc.id, docFile, setPdfUploadPercent);
        }

        setIsDocDialogOpen(false);
        setEditingDoc(null);
        setTargetFolderForDoc(null);
        setDocFile(null);
        resetForm();
        if (targetFId !== folderId) {
          await refreshSubFolderContents(targetFId);
        }
        await loadFolder();
      } catch (err: any) {
        docFormik.setFieldError('title', err.message || 'Failed to save document.');
      } finally {
        setPdfUploadPercent(null);
        setSubmitting(false);
      }
    },
  });

  const handleOpenCreateSubFolder = (parent?: PdfFolder | null) => {
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

  const handleOpenEditSubFolder = (folderItem: PdfFolder) => {
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

  const handleOpenCreateDoc = (targetF?: PdfFolder | null) => {
    setEditingDoc(null);
    setTargetFolderForDoc(targetF || null);
    setDocFile(null);
    docFormik.resetForm({
      values: {
        title: '',
        description: '',
        folderId: targetF ? targetF.id : folderId,
        isActive: true,
      },
    });
    setIsDocDialogOpen(true);
  };

  const handleOpenEditDoc = (doc: PdfDocument) => {
    setEditingDoc(doc);
    setTargetFolderForDoc(null);
    setDocFile(null);
    docFormik.resetForm({
      values: {
        title: doc.title,
        description: doc.description || '',
        folderId: doc.folderId || folderId,
        isActive: doc.isActive !== false,
      },
    });
    setIsDocDialogOpen(true);
  };

  const handleDeleteFolder = async () => {
    if (!deleteFolderTarget) return;
    const target = deleteFolderTarget;
    const pId = target.parentId;
    const prevFolderData = folderData;
    const prevSubContents = subFolderContents;

    // 1. Dismiss modal instantly
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
      await ApiClient.deletePdfFolder(target.id);
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

  const handleDeleteDoc = async () => {
    if (!deleteDocTarget) return;
    const target = deleteDocTarget;
    const fId = target.folderId;
    const prevFolderData = folderData;
    const prevSubContents = subFolderContents;

    // 1. Dismiss modal instantly
    setDeleteDocTarget(null);

    // 2. Optimistic local removal
    if (folderData && fId === folderId) {
      setFolderData({
        ...folderData,
        documents: folderData.documents?.filter((d) => d.id !== target.id) || [],
      });
    }
    if (fId && fId !== folderId && prevSubContents[fId]) {
      setSubFolderContents((prev) => ({
        ...prev,
        [fId]: {
          ...prev[fId],
          documents: prev[fId].documents.filter((d) => d.id !== target.id),
        },
      }));
    }

    try {
      await ApiClient.deletePdfDocument(target.id);
      setToastMsg({ type: 'success', text: `Document "${target.title}" deleted.` });
      if (fId && fId !== folderId) {
        await refreshSubFolderContents(fId);
      }
      await loadFolder();
    } catch (err: any) {
      setFolderData(prevFolderData);
      setSubFolderContents(prevSubContents);
      setToastMsg({ type: 'error', text: err.message || 'Failed to delete document.' });
    }
  };

  if (loading || !folderData) {
    return <AdminFolderDetailSkeleton />;
  }

  const { folder, breadcrumbs, children: subFolders, documents } = folderData;

  const filteredSubFolders = subFolders.filter(
    (sf) =>
      !searchTerm.trim() ||
      sf.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sf.description && sf.description.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const filteredDocs = documents.filter(
    (d) =>
      !searchTerm.trim() ||
      d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.description && d.description.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const allItems = [
    ...filteredSubFolders.map((sf) => ({ type: 'FOLDER' as const, item: sf })),
    ...filteredDocs.map((doc) => ({ type: 'DOC' as const, item: doc })),
  ];

  const totalPages = Math.max(1, Math.ceil(allItems.length / pageSize));
  const paginatedItems = allItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const paginatedSubFolders = paginatedItems.filter((i) => i.type === 'FOLDER').map((i) => i.item);
  const paginatedDocs = paginatedItems.filter((i) => i.type === 'DOC').map((i) => i.item);

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

      {/* Header & Breadcrumb */}
      <div className="shrink-0 space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
          <Link
            href="/admin/pdfs"
            className="font-bold text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1"
          >
            <Folder className="w-3.5 h-3.5 text-amber-500" />
            <span>PDF Library</span>
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
                  href={`/admin/pdfs/folder/${bc.id}`}
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
                {folder.documentCount || 0} {(folder.documentCount || 0) === 1 ? 'Document' : 'Documents'}
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
              onClick={() => handleOpenCreateDoc(null)}
            >
              <Plus className="w-4 h-4" />
              <span>Add PDF in Folder</span>
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
          {filteredSubFolders.length === 0 && filteredDocs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner">
                <FolderOpen className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  No Documents or Subfolders in &ldquo;{folder.name}&rdquo;
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                  Click &ldquo;Add Subfolder&rdquo; to organize topics or &ldquo;Add PDF in Folder&rdquo; to upload materials here.
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
                  const sfHasContents = (sf.subFolderCount || 0) > 0 || (sf.documentCount || 0) > 0;
                  return (
                    <React.Fragment key={`subfolder-pdf-frag-${sf.id}`}>
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
                                  className={`w-4 h-4 transition-transform duration-200 ${
                                    expandedFolders[sf.id] ? '' : '-rotate-90'
                                  }`}
                                />
                              </button>
                            ) : (
                              <div className="w-7 h-7 flex items-center justify-center text-slate-300 dark:text-slate-700 font-mono text-xs shrink-0">
                                •
                              </div>
                            )}

                            <Link
                              href={`/admin/pdfs/folder/${sf.id}`}
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
                          {sf.documentCount || 0} {(sf.documentCount || 0) === 1 ? 'Document' : 'Documents'}
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
                              onClick={() => handleOpenCreateDoc(sf)}
                              title={`Add PDF in ${sf.name}`}
                            >
                              <Plus className="w-3 h-3 mr-0.5" />
                              <span>PDF</span>
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
                            <Link href={`/admin/pdfs/folder/${sf.id}`}>
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
                                  key={`inner-sub-pdf-${innerSub.id}`}
                                  className="bg-slate-50/30 dark:bg-[#0c152e]/25 border-b border-slate-100 dark:border-[#1e2e56]/30 hover:bg-amber-500/[0.04] transition-colors"
                                >
                                  <TableCell className="py-2 pl-14">
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-300 dark:text-slate-600 text-xs font-mono">└──</span>
                                      <Link
                                        href={`/admin/pdfs/folder/${innerSub.id}`}
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
                                    {innerSub.documentCount || 0} Documents
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
                                        onClick={() => handleOpenCreateDoc(innerSub)}
                                        title={`Add PDF in ${innerSub.name}`}
                                      >
                                        <Plus className="w-3 h-3 mr-0.5" />
                                        <span>PDF</span>
                                      </Button>
                                      <Link href={`/admin/pdfs/folder/${innerSub.id}`}>
                                        <Button variant="outline" size="sm" className="text-xs h-6 px-2 font-bold cursor-pointer">
                                          <span>Open</span>
                                          <ChevronRight className="w-3 h-3 ml-0.5" />
                                        </Button>
                                      </Link>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}

                              {/* Documents inside subF */}
                              {subFolderContents[sf.id]?.documents?.map((doc) => (
                                <TableRow
                                  key={`subdoc-item-${doc.id}`}
                                  className="bg-slate-50/20 dark:bg-[#0c152e]/15 border-b border-slate-100 dark:border-[#1e2e56]/20 hover:bg-cyan-500/[0.04] transition-colors"
                                >
                                  <TableCell className="py-2 pl-16">
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-300 dark:text-slate-600 text-xs font-mono">└──</span>
                                      <span className="font-extrabold text-xs text-slate-900 dark:text-white truncate max-w-sm">
                                        {doc.title}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-2">
                                    <Badge variant="outline" className="text-[9px] text-cyan-600 dark:text-cyan-400 border-cyan-500/30 bg-cyan-500/5">
                                      PDF
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="py-2 text-xs font-mono text-slate-500">
                                    {doc.fileName ? doc.fileName : 'Study Material PDF'}
                                  </TableCell>
                                  <TableCell className="py-2">
                                    {doc.isActive !== false ? (
                                      <Badge variant="success" className="text-[9px]">Active</Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-[9px] text-slate-400">Hidden</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="py-2 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      {doc.fileUrl && (
                                        <a
                                          href={doc.fileUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline px-2 py-1"
                                        >
                                          <span>View</span>
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 text-slate-400 hover:text-amber-500 cursor-pointer"
                                        onClick={() => handleOpenEditDoc(doc)}
                                        title="Edit Document"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 text-slate-400 hover:text-rose-500 cursor-pointer"
                                        onClick={() => setDeleteDocTarget(doc)}
                                        title="Delete Document"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </>
                          )}
                        </>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* Direct Documents in this Folder */}
                {paginatedDocs.map((doc) => (
                  <TableRow
                    key={`direct-doc-${doc.id}`}
                    className="border-b border-slate-100 dark:border-[#1e2e56]/40 hover:bg-cyan-500/[0.04] transition-colors"
                  >
                    <TableCell className="py-3 pl-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 flex items-center justify-center text-slate-300 dark:text-slate-700 font-mono text-xs shrink-0">
                          •
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 shrink-0 shadow-inner">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="space-y-0.5 min-w-0">
                          <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate block">
                            {doc.title}
                          </span>
                          {doc.description && (
                            <p className="text-[11px] text-slate-400 truncate max-w-sm">{doc.description}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="py-3">
                      <Badge variant="outline" className="font-bold text-xs text-cyan-600 dark:text-cyan-400 border-cyan-500/30 bg-cyan-500/5">
                        PDF
                      </Badge>
                    </TableCell>

                    <TableCell className="py-3 text-xs font-mono text-slate-500">
                      {doc.fileName ? doc.fileName : 'Study Material PDF'}
                    </TableCell>

                    <TableCell className="py-3">
                      {doc.isActive !== false ? (
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
                        {doc.fileUrl && (
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline px-2 py-1"
                          >
                            <span>View</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-slate-400 hover:text-amber-500 h-7 w-7 p-0 cursor-pointer"
                          onClick={() => handleOpenEditDoc(doc)}
                          title="Edit Document"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-slate-400 hover:text-rose-500 h-7 w-7 p-0 cursor-pointer"
                          onClick={() => setDeleteDocTarget(doc)}
                          title="Delete Document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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
              placeholder="e.g. 2024 Question Papers"
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

      {/* Document Dialog */}
      <Dialog
        isOpen={isDocDialogOpen}
        onClose={() => setIsDocDialogOpen(false)}
        title={editingDoc ? 'Edit Document' : `Add PDF Document to "${targetFolderForDoc?.name || folder.name}"`}
      >
        <form onSubmit={docFormik.handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Document Title <span className="text-rose-500">*</span>
            </label>
            <Input
              name="title"
              placeholder="e.g. 10th Level Preliminary Previous Questions"
              value={docFormik.values.title}
              onChange={docFormik.handleChange}
              onBlur={docFormik.handleBlur}
              error={docFormik.touched.title && docFormik.errors.title ? docFormik.errors.title : undefined}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Description (Optional)
            </label>
            <textarea
              name="description"
              rows={2}
              placeholder="Brief summary..."
              value={docFormik.values.description}
              onChange={docFormik.handleChange}
              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#091124] border border-slate-200 dark:border-[#1e2e56] text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* PDF File Upload */}
          <div className="space-y-2 p-3 rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#0c152e]/50">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-500" />
                <span>PDF File {!editingDoc && <span className="text-rose-500">*</span>}</span>
              </label>
              <span className="text-[10px] text-slate-400">PDF · Max 50MB</span>
            </div>

            {editingDoc?.fileUrl && !docFile && (
              <div className="flex items-center justify-between gap-2 p-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs">
                <p className="font-bold text-amber-900 dark:text-amber-300 truncate">
                  {editingDoc.fileName || 'Current Uploaded PDF'}
                </p>
                <a
                  href={editingDoc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold text-amber-600 hover:underline inline-flex items-center gap-0.5"
                >
                  <span>View</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {docFile && (
              <div className="flex items-center justify-between gap-2 p-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-300">
                <p className="font-bold truncate">{docFile.name}</p>
                <button type="button" onClick={() => setDocFile(null)} className="text-slate-400 hover:text-rose-500 cursor-pointer">
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
                setDocFile(file);
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
                      : docFile
                        ? 'Change PDF file…'
                        : 'Choose a PDF file to upload…'}
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
            checked={docFormik.values.isActive}
            onChange={(checked) => docFormik.setFieldValue('isActive', checked)}
            variant="emerald"
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDocDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="gold"
              size="sm"
              disabled={docFormik.isSubmitting}
            >
              {docFormik.isSubmitting ? 'Saving...' : editingDoc ? 'Save Changes' : 'Upload Document'}
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
        description={`Are you sure you want to delete "${deleteFolderTarget?.name}"? All inner folders and documents will also be deleted.`}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Delete Document Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteDocTarget}
        onCancel={() => setDeleteDocTarget(null)}
        onConfirm={handleDeleteDoc}
        title="Delete Document?"
        description={`Are you sure you want to delete "${deleteDocTarget?.title}"?`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
