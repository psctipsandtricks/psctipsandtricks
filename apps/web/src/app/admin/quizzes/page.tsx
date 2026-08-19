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
  Skeleton,
  ToggleSwitch,
} from '@psc/ui';
import {
  Folder,
  FolderOpen,
  Plus,
  Trash2,
  Edit3,
  ChevronRight,
  Search,
  Radio,
  HelpCircle,
  Eye,
  X,
  CheckCircle2,
  ListChecks,
} from 'lucide-react';
import type { QuizFolder } from '@psc/shared-types';
import { AdminSkeletonHeader, AdminSkeletonTable } from '../admin-skeleton';

const folderSchema = Yup.object({
  name: Yup.string().trim().required('Folder name is required'),
});

const emptyValues = { name: '', description: '', isActive: true };

export default function AdminQuizFoldersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState<QuizFolder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageError, setPageError] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<QuizFolder | null>(null);
  const [parentForNewFolder, setParentForNewFolder] = useState<QuizFolder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuizFolder | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Expandable Hierarchy Tree State
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [folderContents, setFolderContents] = useState<
    Record<string, { subFolders: QuizFolder[]; quizzes: any[]; loading: boolean }>
  >({});

  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => setToastMsg(null), 4000);
    return () => clearTimeout(timer);
  }, [toastMsg]);

  const loadFolders = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await ApiClient.getQuizFolders('root');
      const validFolders = (data || []).filter(
        (f) => f.name && f.name.toLowerCase() !== 'root' && f.id !== 'root-folder' && !f.parentId,
      );
      setFolders(validFolders);
    } catch (err: any) {
      setPageError(err.message || 'Failed to load quiz folders.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  const toggleExpandFolder = async (folder: QuizFolder) => {
    const nextState = !expandedFolders[folder.id];
    setExpandedFolders((prev) => ({ ...prev, [folder.id]: nextState }));

    if (nextState && !folderContents[folder.id]) {
      setFolderContents((prev) => ({
        ...prev,
        [folder.id]: { subFolders: [], quizzes: [], loading: true },
      }));
      try {
        const [childrenFolders, quizRes] = await Promise.all([
          ApiClient.getQuizFolders(folder.id),
          ApiClient.getQuizzes({ folder: folder.name, limit: 100 }),
        ]);

        const validChildFolders = (childrenFolders || []).filter(
          (f) => f.name && f.name.toLowerCase() !== 'root' && f.id !== folder.id,
        );
        const quizList = Array.isArray(quizRes?.data) ? quizRes.data : Array.isArray(quizRes) ? quizRes : [];

        setFolderContents((prev) => ({
          ...prev,
          [folder.id]: {
            subFolders: validChildFolders,
            quizzes: quizList,
            loading: false,
          },
        }));
      } catch (err) {
        console.error('Failed to load folder children:', err);
        setFolderContents((prev) => ({
          ...prev,
          [folder.id]: { subFolders: [], quizzes: [], loading: false },
        }));
      }
    }
  };

  const refreshFolderContents = useCallback(async (folderId: string, folderName: string) => {
    try {
      const [childrenFolders, quizRes] = await Promise.all([
        ApiClient.getQuizFolders(folderId),
        ApiClient.getQuizzes({ folder: folderName, limit: 100 }),
      ]);

      const validChildFolders = (childrenFolders || []).filter(
        (f) => f.name && f.name.toLowerCase() !== 'root' && f.id !== folderId,
      );
      const quizList = Array.isArray(quizRes?.data) ? quizRes.data : Array.isArray(quizRes) ? quizRes : [];

      setFolderContents((prev) => ({
        ...prev,
        [folderId]: {
          subFolders: validChildFolders,
          quizzes: quizList,
          loading: false,
        },
      }));
    } catch (err) {
      console.error('Failed to refresh folder contents:', err);
    }
  }, []);

  const formik = useFormik({
    initialValues: emptyValues,
    validationSchema: folderSchema,
    onSubmit: async (values, { resetForm, setSubmitting, setFieldError }) => {
      try {
        const payload = {
          name: values.name.trim(),
          parentId: parentForNewFolder?.id || undefined,
          description: values.description.trim() || undefined,
          isActive: values.isActive,
        };

        if (editingFolder) {
          const edited = editingFolder;
          setFolders((prev) =>
            prev.map((f) => (f.id === edited.id ? { ...f, ...payload } : f)),
          );
          setIsDialogOpen(false);
          setEditingFolder(null);
          setParentForNewFolder(null);
          resetForm();
          setToastMsg({ type: 'success', text: `Folder "${payload.name}" updated successfully.` });
          await ApiClient.updateQuizFolder(edited.id, payload);
          await loadFolders(true);

          if (edited.parentId) {
            refreshFolderContents(edited.parentId, edited.parentName || '');
          }
        } else {
          const parent = parentForNewFolder;
          setIsDialogOpen(false);
          setEditingFolder(null);
          setParentForNewFolder(null);
          resetForm();
          setToastMsg({ type: 'success', text: `Folder "${payload.name}" created successfully.` });
          await ApiClient.createQuizFolder({ ...payload, orderIndex: folders.length });
          await loadFolders(true);

          if (parent) {
            setExpandedFolders((prev) => ({ ...prev, [parent.id]: true }));
            refreshFolderContents(parent.id, parent.name);
          }
        }
      } catch (err: any) {
        setFieldError('name', err.message || 'Failed to save folder.');
      } finally {
        setSubmitting(false);
      }
    },
  });

  const handleOpenCreate = (parent?: QuizFolder) => {
    setEditingFolder(null);
    setParentForNewFolder(parent || null);
    formik.resetForm({ values: emptyValues });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (folder: QuizFolder) => {
    setEditingFolder(folder);
    setParentForNewFolder(null);
    formik.resetForm({
      values: {
        name: folder.name,
        description: folder.description || '',
        isActive: folder.isActive !== false,
      },
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (folder: QuizFolder) => {
    const previous = folders;
    setFolders((prev) => prev.filter((f) => f.id !== folder.id));
    setToastMsg({ type: 'success', text: `Folder "${folder.name}" deleted.` });
    try {
      await ApiClient.deleteQuizFolder(folder.id);
      await loadFolders(true);
      if (folder.parentId) {
        refreshFolderContents(folder.parentId, folder.parentName || '');
      }
      setFolderContents((prev) => {
        const next = { ...prev };
        delete next[folder.id];
        Object.keys(next).forEach((k) => {
          if (next[k]) {
            next[k] = {
              ...next[k],
              subFolders: next[k].subFolders.filter((sf) => sf.id !== folder.id),
            };
          }
        });
        return next;
      });
    } catch (err: any) {
      setFolders(previous);
      setToastMsg({ type: 'error', text: err.message || 'Failed to delete folder.' });
    }
  };

  const filteredFolders = folders.filter(
    (f) =>
      !searchTerm.trim() ||
      (f.name && f.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (f.description && f.description.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const totalQuizzes = folders.reduce((sum, f) => sum + (f.quizCount || 0), 0);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4">
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

      {/* Header Section */}
      <div className="shrink-0 space-y-3">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Quiz Folders
              </h1>
              <Badge variant="gold" className="font-extrabold text-xs">
                {folders.length} {folders.length === 1 ? 'Folder' : 'Folders'}
              </Badge>
              <Badge variant="default" className="font-bold text-xs">
                {totalQuizzes} {totalQuizzes === 1 ? 'Total Quiz' : 'Total Quizzes'}
              </Badge>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
              Expand any folder dropdown to view and manage its inner sub-folders and quizzes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link href="/admin/quizzes/mock-tests">
              <Button variant="outline" size="sm" className="font-bold flex items-center space-x-1.5 cursor-pointer">
                <Radio className="w-4 h-4 text-rose-500" />
                <span>Live Mock Tests</span>
              </Button>
            </Link>
            <Button
              variant="gold"
              size="sm"
              className="font-bold shadow-md shadow-cyan-500/20 cursor-pointer"
              onClick={() => handleOpenCreate()}
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
            placeholder="Search quiz folders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {pageError && (
        <div className="shrink-0 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-between">
          <span>{pageError}</span>
          <button type="button" onClick={() => setPageError('')} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Folders Tree Table Card */}
      <Card className="flex-1 flex flex-col min-h-0 border border-slate-200/80 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] shadow-sm overflow-hidden p-0">
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <AdminSkeletonTable rowsCount={5} colsCount={5} />
          ) : filteredFolders.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner">
                <FolderOpen className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  No Quiz Folders Found
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                  {searchTerm ? 'Try clearing your search term.' : 'Click "Add Folder" to create your first question bank folder.'}
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
                {filteredFolders.map((folder) => (
                  <React.Fragment key={`root-folder-${folder.id}`}>
                    <TableRow className="border-b border-slate-100 dark:border-[#1e2e56]/40 hover:bg-slate-50/70 dark:hover:bg-[#0c152e]/40 transition-colors group">
                      {/* Name with Expand Chevron */}
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleExpandFolder(folder)}
                            className="p-1 rounded text-slate-400 hover:text-cyan-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                            title={expandedFolders[folder.id] ? 'Collapse inner contents' : 'Expand inner contents'}
                          >
                            <ChevronRight
                              className={`w-4 h-4 transition-transform duration-200 ${
                                expandedFolders[folder.id] ? 'rotate-90 text-cyan-500' : ''
                              }`}
                            />
                          </button>

                          <Link
                            href={`/admin/quizzes/folder/${encodeURIComponent(folder.name)}`}
                            className="flex items-center gap-3 group/link min-w-[260px]"
                          >
                            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 shadow-inner group-hover/link:scale-105 transition-transform">
                              <Folder className="w-4.5 h-4.5" />
                            </div>
                            <div className="space-y-0.5 min-w-0">
                              <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate group-hover/link:text-cyan-600 dark:group-hover/link:text-cyan-400 transition-colors">
                                {folder.name}
                              </span>
                              {folder.description && (
                                <p className="text-xs text-slate-400 truncate max-w-xs">{folder.description}</p>
                              )}
                            </div>
                          </Link>
                        </div>
                      </TableCell>

                      {/* Type */}
                      <TableCell className="py-3">
                        <Badge variant="outline" className="font-bold text-xs flex items-center gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5">
                          <Folder className="w-3 h-3" />
                          <span>Top Folder</span>
                        </Badge>
                      </TableCell>

                      {/* Contents */}
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2 text-xs font-mono">
                          {folder.subFolderCount ? (
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              {folder.subFolderCount} {folder.subFolderCount === 1 ? 'sub-folder' : 'sub-folders'}
                            </span>
                          ) : null}
                          {folder.subFolderCount && folder.quizCount ? <span className="text-slate-300 dark:text-slate-700">·</span> : null}
                          <span className="font-bold text-cyan-600 dark:text-cyan-400">
                            {folder.quizCount || 0} {(folder.quizCount || 0) === 1 ? 'quiz' : 'quizzes'}
                          </span>
                        </div>
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

                      {/* Actions for Top Folder */}
                      <TableCell className="py-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <Link href={`/admin/quizzes/folder/${encodeURIComponent(folder.name)}?action=createQuiz`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 px-2 font-bold text-cyan-600 dark:text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10 cursor-pointer"
                              title={`Add quiz in ${folder.name}`}
                            >
                              <Plus className="w-3 h-3 mr-0.5" />
                              <span>Quiz</span>
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 px-2 font-bold text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 cursor-pointer"
                            onClick={() => handleOpenCreate(folder)}
                            title={`Add sub-folder inside ${folder.name}`}
                          >
                            <Plus className="w-3 h-3 mr-0.5" />
                            <span>Folder</span>
                          </Button>
                          <Link href={`/admin/quizzes/folder/${encodeURIComponent(folder.name)}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 px-2.5 font-bold border-cyan-500/30 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 cursor-pointer"
                            >
                              <span>Open</span>
                              <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-400 hover:text-amber-500 h-7 w-7 p-0 cursor-pointer"
                            onClick={() => handleOpenEdit(folder)}
                            title="Edit Folder"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-400 hover:text-rose-500 h-7 w-7 p-0 cursor-pointer"
                            onClick={() => setDeleteTarget(folder)}
                            title="Delete Folder"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expanded Inner Hierarchy (Sub-folders & Quizzes) */}
                    {expandedFolders[folder.id] && (
                      <>
                        {folderContents[folder.id]?.loading ? (
                          <TableRow className="bg-slate-50/40 dark:bg-[#0c152e]/30 border-b border-slate-100 dark:border-[#1e2e56]/30">
                            <TableCell colSpan={5} className="py-3 pl-12">
                              <div className="flex items-center space-x-2 text-xs text-slate-400">
                                <span className="w-3.5 h-3.5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                                <span>Loading inner contents for &ldquo;{folder.name}&rdquo;...</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (folderContents[folder.id]?.quizzes?.length === 0 && folderContents[folder.id]?.subFolders?.length === 0) ? (
                          <TableRow className="bg-slate-50/40 dark:bg-[#0c152e]/30 border-b border-slate-100 dark:border-[#1e2e56]/30">
                            <TableCell colSpan={5} className="py-3 pl-12">
                              <div className="flex items-center justify-between py-1 flex-wrap gap-2">
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                  <span className="text-slate-300 dark:text-slate-600 font-mono">└──</span>
                                  <span>No quizzes or sub-folders inside &ldquo;{folder.name}&rdquo; yet.</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Link href={`/admin/quizzes/folder/${encodeURIComponent(folder.name)}?action=createQuiz`}>
                                    <Button size="sm" variant="outline" className="text-xs h-7 px-2 font-bold text-cyan-600 border-cyan-500/30 hover:bg-cyan-500/10 cursor-pointer">
                                      <Plus className="w-3 h-3 mr-1" />
                                      <span>Add Quiz</span>
                                    </Button>
                                  </Link>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs h-7 px-2 font-bold text-amber-600 border-amber-500/30 hover:bg-amber-500/10 cursor-pointer"
                                    onClick={() => handleOpenCreate(folder)}
                                  >
                                    <Plus className="w-3 h-3 mr-1" />
                                    <span>Add Sub-folder</span>
                                  </Button>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          <>
                            {/* Inner Sub-Folders with Expand and Full Actions */}
                            {folderContents[folder.id]?.subFolders?.map((subF) => (
                              <React.Fragment key={`sub-frag-${subF.id}`}>
                                <TableRow
                                  key={`sub-${subF.id}`}
                                  className="bg-slate-50/50 dark:bg-[#0c152e]/40 border-b border-slate-100 dark:border-[#1e2e56]/30 hover:bg-amber-500/[0.04] transition-colors"
                                >
                                  {/* Item details with chevron expand */}
                                  <TableCell className="py-2.5 pl-10">
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-300 dark:text-slate-600 text-xs font-mono">├──</span>
                                      <button
                                        type="button"
                                        onClick={() => toggleExpandFolder(subF)}
                                        className="p-1 rounded text-slate-400 hover:text-cyan-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                                        title={expandedFolders[subF.id] ? 'Collapse inner contents' : 'Expand inner contents'}
                                      >
                                        <ChevronRight
                                          className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                            expandedFolders[subF.id] ? 'rotate-90 text-cyan-500' : ''
                                          }`}
                                        />
                                      </button>
                                      <Link
                                        href={`/admin/quizzes/folder/${encodeURIComponent(subF.name)}`}
                                        className="flex items-center gap-2 group/inner"
                                      >
                                        <div className="w-6 h-6 rounded bg-amber-500/10 text-amber-500 flex items-center justify-center">
                                          <Folder className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 group-hover/inner:text-amber-500">
                                          {subF.name}
                                        </span>
                                        <Badge variant="default" className="text-[9px] px-1 py-0 bg-amber-500/10 text-amber-600">
                                          Sub-folder
                                        </Badge>
                                      </Link>
                                    </div>
                                  </TableCell>

                                  {/* Type */}
                                  <TableCell className="py-2.5">
                                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">
                                      Sub-folder
                                    </Badge>
                                  </TableCell>

                                  {/* Contents */}
                                  <TableCell className="py-2.5 text-xs font-mono text-cyan-600">
                                    {subF.quizCount || 0} Quizzes
                                  </TableCell>

                                  {/* Status */}
                                  <TableCell className="py-2.5">
                                    {subF.isActive !== false ? (
                                      <Badge variant="success" className="text-[10px]">Active</Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-[10px] text-slate-400">Hidden</Badge>
                                    )}
                                  </TableCell>

                                  {/* Actions for Sub-Folder */}
                                  <TableCell className="py-2.5 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Link href={`/admin/quizzes/folder/${encodeURIComponent(folder.name)}?action=createQuiz&targetFolder=${encodeURIComponent(subF.name)}`}>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="text-xs h-7 px-2 font-bold text-cyan-600 dark:text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10 cursor-pointer"
                                          title={`Add quiz in ${subF.name}`}
                                        >
                                          <Plus className="w-3 h-3 mr-0.5" />
                                          <span>Quiz</span>
                                        </Button>
                                      </Link>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-xs h-7 px-2 font-bold text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 cursor-pointer"
                                        onClick={() => handleOpenCreate(subF)}
                                        title={`Create sub-folder inside ${subF.name}`}
                                      >
                                        <Plus className="w-3 h-3 mr-0.5" />
                                        <span>Folder</span>
                                      </Button>
                                      <Link href={`/admin/quizzes/folder/${encodeURIComponent(subF.name)}`}>
                                        <Button variant="outline" size="sm" className="text-xs h-7 px-2 font-bold cursor-pointer">
                                          <span>Open</span>
                                          <ChevronRight className="w-3 h-3 ml-0.5" />
                                        </Button>
                                      </Link>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-slate-400 hover:text-amber-500 cursor-pointer"
                                        onClick={() => handleOpenEdit(subF)}
                                        title="Edit Sub-folder"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-slate-400 hover:text-rose-500 cursor-pointer"
                                        onClick={() => setDeleteTarget(subF)}
                                        title="Delete Sub-folder"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>

                                {/* Nested child items inside subF (Multi-level hierarchy) */}
                                {expandedFolders[subF.id] && (
                                  <>
                                    {folderContents[subF.id]?.loading ? (
                                      <TableRow className="bg-slate-50/30 dark:bg-[#0c152e]/25 border-b border-slate-100 dark:border-[#1e2e56]/30">
                                        <TableCell colSpan={5} className="py-2.5 pl-20">
                                          <div className="flex items-center space-x-2 text-xs text-slate-400">
                                            <span className="w-3 h-3 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                                            <span>Loading inner items for &ldquo;{subF.name}&rdquo;...</span>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ) : (folderContents[subF.id]?.quizzes?.length === 0 && folderContents[subF.id]?.subFolders?.length === 0) ? (
                                      <TableRow className="bg-slate-50/30 dark:bg-[#0c152e]/25 border-b border-slate-100 dark:border-[#1e2e56]/30">
                                        <TableCell colSpan={5} className="py-2.5 pl-20">
                                          <div className="flex items-center justify-between py-1 flex-wrap gap-2">
                                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                              <span className="text-slate-300 dark:text-slate-600 font-mono">└──</span>
                                              <span>No items inside &ldquo;{subF.name}&rdquo; yet.</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <Link href={`/admin/quizzes/folder/${encodeURIComponent(folder.name)}?action=createQuiz&targetFolder=${encodeURIComponent(subF.name)}`}>
                                                <Button size="sm" variant="outline" className="text-xs h-6 px-2 font-bold text-cyan-600 border-cyan-500/30">
                                                  <Plus className="w-3 h-3 mr-1" />
                                                  <span>Add Quiz</span>
                                                </Button>
                                              </Link>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-xs h-6 px-2 font-bold text-amber-600 border-amber-500/30"
                                                onClick={() => handleOpenCreate(subF)}
                                              >
                                                <Plus className="w-3 h-3 mr-1" />
                                                <span>Add Folder</span>
                                              </Button>
                                            </div>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ) : (
                                      <>
                                        {/* Nested Sub-sub-folders */}
                                        {folderContents[subF.id]?.subFolders?.map((innerSub) => (
                                          <TableRow
                                            key={`innersub-${innerSub.id}`}
                                            className="bg-slate-50/30 dark:bg-[#0c152e]/25 border-b border-slate-100 dark:border-[#1e2e56]/30 hover:bg-amber-500/[0.04] transition-colors"
                                          >
                                            <TableCell className="py-2 pl-20">
                                              <div className="flex items-center gap-2">
                                                <span className="text-slate-300 dark:text-slate-600 text-xs font-mono">└──</span>
                                                <Link
                                                  href={`/admin/quizzes/folder/${encodeURIComponent(innerSub.name)}`}
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
                                              {innerSub.quizCount || 0} Quizzes
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
                                                <Link href={`/admin/quizzes/folder/${encodeURIComponent(folder.name)}?action=createQuiz&targetFolder=${encodeURIComponent(innerSub.name)}`}>
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-xs h-6 px-1.5 font-bold text-cyan-600 dark:text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10 cursor-pointer"
                                                    title={`Add quiz in ${innerSub.name}`}
                                                  >
                                                    <Plus className="w-3 h-3 mr-0.5" />
                                                    <span>Quiz</span>
                                                  </Button>
                                                </Link>
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  className="text-xs h-6 px-1.5 font-bold text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 cursor-pointer"
                                                  onClick={() => handleOpenCreate(innerSub)}
                                                  title={`Add sub-folder inside ${innerSub.name}`}
                                                >
                                                  <Plus className="w-3 h-3 mr-0.5" />
                                                  <span>Folder</span>
                                                </Button>
                                                <Link href={`/admin/quizzes/folder/${encodeURIComponent(innerSub.name)}`}>
                                                  <Button variant="outline" size="sm" className="text-xs h-6 px-1.5 font-bold cursor-pointer">
                                                    <span>Open</span>
                                                    <ChevronRight className="w-3 h-3 ml-0.5" />
                                                  </Button>
                                                </Link>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-6 w-6 p-0 text-slate-400 hover:text-amber-500 cursor-pointer"
                                                  onClick={() => handleOpenEdit(innerSub)}
                                                  title="Edit Sub-folder"
                                                >
                                                  <Edit3 className="w-3 h-3" />
                                                </Button>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-6 w-6 p-0 text-slate-400 hover:text-rose-500 cursor-pointer"
                                                  onClick={() => setDeleteTarget(innerSub)}
                                                  title="Delete Sub-folder"
                                                >
                                                  <Trash2 className="w-3 h-3" />
                                                </Button>
                                              </div>
                                            </TableCell>
                                          </TableRow>
                                        ))}

                                        {/* Nested Quizzes inside subF */}
                                        {folderContents[subF.id]?.quizzes?.map((qz) => (
                                          <TableRow
                                            key={`subf-qz-${qz.id}`}
                                            className="bg-slate-50/20 dark:bg-[#0c152e]/20 border-b border-slate-100 dark:border-[#1e2e56]/30 hover:bg-cyan-500/[0.04] transition-colors"
                                          >
                                            <TableCell className="py-2 pl-20">
                                              <div className="flex items-center gap-2">
                                                <span className="text-slate-300 dark:text-slate-600 text-xs font-mono">└──</span>
                                                <div className="flex items-center gap-1.5">
                                                  <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200">
                                                    {qz.title}
                                                  </span>
                                                  {qz.isLiveMock && (
                                                    <Badge variant="gold" className="text-[8px] px-1 py-0 font-bold">
                                                      🔥 Live
                                                    </Badge>
                                                  )}
                                                </div>
                                              </div>
                                            </TableCell>
                                            <TableCell className="py-2">
                                              {qz.accessType === 'PAID' ? (
                                                <Badge variant="gold" className="text-[9px]">₹{qz.price || 0}</Badge>
                                              ) : (
                                                <Badge variant="success" className="text-[9px]">FREE</Badge>
                                              )}
                                            </TableCell>
                                            <TableCell className="py-2 text-xs font-mono text-slate-600 dark:text-slate-400">
                                              {qz.totalQuestions || qz.questions?.length || 0} Qs · {qz.durationMinutes}m
                                            </TableCell>
                                            <TableCell className="py-2">
                                              <Badge className={`text-[9px] ${qz.isActive !== false ? 'bg-emerald-500/15 text-emerald-800' : 'bg-rose-500/10 text-rose-700'}`}>
                                                {qz.isActive !== false ? 'Active' : 'Hidden'}
                                              </Badge>
                                            </TableCell>
                                            <TableCell className="py-2 text-right">
                                              <Link href={`/admin/quizzes/${qz.id}/questions`}>
                                                <Button size="sm" variant="outline" className="text-xs h-6 px-2 font-bold border-cyan-500/30 text-cyan-600 cursor-pointer">
                                                  <ListChecks className="w-3 h-3 mr-0.5" />
                                                  <span>Questions</span>
                                                </Button>
                                              </Link>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </>
                                    )}
                                  </>
                                )}
                              </React.Fragment>
                            ))}

                            {/* Direct Quizzes inside this Folder */}
                            {folderContents[folder.id]?.quizzes?.map((qz) => (
                              <TableRow
                                key={`qz-${qz.id}`}
                                className="bg-slate-50/30 dark:bg-[#0c152e]/25 border-b border-slate-100 dark:border-[#1e2e56]/30 hover:bg-cyan-500/[0.04] transition-colors"
                              >
                                <TableCell className="py-2.5 pl-10">
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-300 dark:text-slate-600 text-xs font-mono">└──</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200">
                                        {qz.title}
                                      </span>
                                      {qz.isLiveMock && (
                                        <Badge variant="gold" className="text-[9px] px-1 py-0 font-bold">
                                          🔥 Live
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="py-2.5">
                                  {qz.accessType === 'PAID' ? (
                                    <Badge variant="gold" className="text-[10px]">₹{qz.price || 0}</Badge>
                                  ) : (
                                    <Badge variant="success" className="text-[10px]">FREE</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="py-2.5 text-xs font-mono text-slate-600 dark:text-slate-400">
                                  {qz.totalQuestions || qz.questions?.length || 0} Qs · {qz.durationMinutes}m
                                </TableCell>
                                <TableCell className="py-2.5">
                                  <Badge className={`text-[9px] ${qz.isActive !== false ? 'bg-emerald-500/15 text-emerald-800' : 'bg-rose-500/10 text-rose-700'}`}>
                                    {qz.isActive !== false ? 'Active' : 'Hidden'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-2.5 text-right">
                                  <Link href={`/admin/quizzes/${qz.id}/questions`}>
                                    <Button size="sm" variant="outline" className="text-xs h-6 px-2 font-bold border-cyan-500/30 text-cyan-600 cursor-pointer">
                                      <ListChecks className="w-3 h-3 mr-0.5" />
                                      <span>Questions</span>
                                    </Button>
                                  </Link>
                                </TableCell>
                              </TableRow>
                            ))}
                          </>
                        )}
                      </>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>

      {/* Add / Edit Folder Dialog */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title={editingFolder ? 'Edit Quiz Folder' : parentForNewFolder ? `Create Sub-folder in "${parentForNewFolder.name}"` : 'Add Quiz Folder'}
      >
        <form className="space-y-4 pt-2" onSubmit={formik.handleSubmit} noValidate>
          <Input
            label="Folder Name"
            name="name"
            placeholder="e.g. Kerala History, Current Affairs 2026..."
            value={formik.values.name}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.name && formik.errors.name ? formik.errors.name : undefined}
            required
            autoFocus
          />

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              Description (Optional)
            </label>
            <textarea
              name="description"
              rows={3}
              placeholder="Brief description of the quizzes contained in this folder..."
              value={formik.values.description}
              onChange={formik.handleChange}
              className="w-full p-3 text-sm rounded-xl border border-slate-300 dark:border-[#1e2e56] bg-slate-50/70 dark:bg-[#091124] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 resize-none transition-all font-medium"
            />
          </div>

          <ToggleSwitch
            icon={Eye}
            variant="emerald"
            label="Visible to students"
            description="When OFF, this folder and all quizzes inside it are hidden from the student quiz catalog."
            checked={formik.values.isActive}
            onChange={(checked) => formik.setFieldValue('isActive', checked)}
          />

          <Button
            type="submit"
            variant="gold"
            className="w-full font-bold shadow-md shadow-cyan-500/20 cursor-pointer"
            isLoading={formik.isSubmitting}
          >
            {editingFolder ? 'Save Folder' : 'Create Folder'}
          </Button>
        </form>
      </Dialog>

      {/* Delete Folder Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete Quiz Folder"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? Any quizzes currently in this folder will be moved to the Root folder. This action cannot be undone.`
            : undefined
        }
        confirmLabel="Delete Folder"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
