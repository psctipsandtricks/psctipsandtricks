'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { ApiClient } from '@/lib/api-client';
import {
  Card,
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
  ArrowUp,
  ArrowDown,
  Search,
  Radio,
  History,
  HelpCircle,
  Eye,
  X,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { QuizFolder } from '@psc/shared-types';
import { AdminSkeletonHeader } from '../admin-skeleton';

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
  const [deleteTarget, setDeleteTarget] = useState<QuizFolder | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => setToastMsg(null), 4000);
    return () => clearTimeout(timer);
  }, [toastMsg]);

  const loadFolders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ApiClient.getQuizFolders();
      setFolders(data || []);
    } catch (err: any) {
      setPageError(err.message || 'Failed to load quiz folders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  const formik = useFormik({
    initialValues: emptyValues,
    validationSchema: folderSchema,
    onSubmit: async (values, { resetForm, setSubmitting, setFieldError }) => {
      try {
        const payload = {
          name: values.name.trim(),
          description: values.description.trim() || undefined,
          isActive: values.isActive,
        };

        if (editingFolder) {
          await ApiClient.updateQuizFolder(editingFolder.id, payload);
          setToastMsg({ type: 'success', text: `Folder "${payload.name}" updated successfully.` });
        } else {
          await ApiClient.createQuizFolder({ ...payload, orderIndex: folders.length });
          setToastMsg({ type: 'success', text: `Folder "${payload.name}" created successfully.` });
        }

        resetForm();
        setIsDialogOpen(false);
        setEditingFolder(null);
        await loadFolders();
      } catch (err: any) {
        setFieldError('name', err.message || 'Failed to save folder.');
      } finally {
        setSubmitting(false);
      }
    },
  });

  const handleOpenCreate = () => {
    setEditingFolder(null);
    formik.resetForm({ values: emptyValues });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (folder: QuizFolder) => {
    setEditingFolder(folder);
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
    try {
      await ApiClient.deleteQuizFolder(folder.id);
      setToastMsg({ type: 'success', text: `Folder "${folder.name}" deleted. Any contained quizzes were moved to Root.` });
      await loadFolders();
    } catch (err: any) {
      setFolders(previous);
      setToastMsg({ type: 'error', text: err.message || 'Failed to delete folder.' });
    }
  };

  const move = async (index: number, direction: 'UP' | 'DOWN') => {
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= folders.length) return;

    const next = [...folders];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    const reindexed = next.map((f, idx) => ({ ...f, orderIndex: idx }));
    const previous = folders;
    setFolders(reindexed);
    setIsReordering(true);

    try {
      await ApiClient.reorderQuizFolders(
        reindexed.map((f) => ({ id: f.id, orderIndex: f.orderIndex })),
      );
    } catch (err: any) {
      setFolders(previous);
      setToastMsg({ type: 'error', text: err.message || 'Failed to reorder folders.' });
    } finally {
      setIsReordering(false);
    }
  };

  const filteredFolders = folders.filter((f) =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (f.description && f.description.toLowerCase().includes(searchTerm.toLowerCase()))
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
              Organize quizzes into folders. Open any folder to manage and create quizzes inside it.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link href="/admin/quizzes/mock-tests">
              <Button variant="outline" size="sm" className="font-bold flex items-center space-x-1.5 cursor-pointer">
                <Radio className="w-4 h-4 text-rose-500" />
                <span>Live Mock Tests</span>
              </Button>
            </Link>
            <Link href="/admin/quizzes/attempts">
              <Button variant="outline" size="sm" className="font-bold flex items-center space-x-1.5 cursor-pointer">
                <History className="w-4 h-4 text-cyan-500" />
                <span>Quiz Attempts</span>
              </Button>
            </Link>
            <Button
              variant="gold"
              size="sm"
              className="font-bold shadow-md shadow-cyan-500/20 cursor-pointer"
              onClick={handleOpenCreate}
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

      {/* Folders List Card */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-y-auto border border-slate-200/80 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] shadow-sm p-3 space-y-2.5 custom-scrollbar">
        {loading ? (
          Array.from({ length: 4 }).map((_, idx) => <Skeleton key={idx} className="h-16 w-full rounded-xl" />)
        ) : filteredFolders.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {searchTerm ? 'No Matching Folders' : 'No Quiz Folders Yet'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {searchTerm
                  ? 'Try adjusting your search query.'
                  : 'Click "Add Folder" to create your first quiz folder.'}
              </p>
            </div>
          </div>
        ) : (
          filteredFolders.map((folder, idx) => {
            const isRoot = folder.name === 'Root' || folder.name === 'Root / No Folder';
            const quizCount = folder.quizCount ?? 0;

            return (
              <div key={folder.id} className="flex items-center gap-2">
                {/* Reorder Up / Down */}
                <div className="flex flex-col shrink-0">
                  <button
                    type="button"
                    onClick={() => move(idx, 'UP')}
                    disabled={idx === 0 || isReordering}
                    className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 transition-colors cursor-pointer rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Move Folder Up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, 'DOWN')}
                    disabled={idx === filteredFolders.length - 1 || isReordering}
                    className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 transition-colors cursor-pointer rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Move Folder Down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Folder Row Card (Clickable to open folder) */}
                <Link
                  href={`/admin/quizzes/folder/${encodeURIComponent(folder.name)}`}
                  className="flex-1 min-w-0 cursor-pointer group"
                >
                  <div className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-slate-50/60 dark:bg-[#0c152e]/60 group-hover:border-cyan-500/50 group-hover:bg-cyan-500/[0.02] transition-all">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                      <Folder className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                          {folder.name === 'Root' ? '🏠 Root Level' : folder.name}
                        </span>
                        <Badge
                          className={`text-[10px] font-extrabold shrink-0 ${
                            folder.isActive !== false
                              ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {folder.isActive !== false ? 'Visible' : 'Hidden'}
                        </Badge>
                      </div>

                      {folder.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {folder.description}
                        </p>
                      )}

                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 font-mono">
                          {quizCount} {quizCount === 1 ? 'quiz' : 'quizzes'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0 text-slate-400 group-hover:text-cyan-500 transition-colors">
                      <span className="text-xs font-bold hidden sm:inline">Manage Quizzes</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </Link>

                {/* Edit & Delete Action Buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {!isRoot && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="p-2 rounded-xl border-slate-300 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/10 transition-all shadow-2xs cursor-pointer"
                        title="Edit Folder"
                        onClick={() => handleOpenEdit(folder)}
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        className="p-2 rounded-xl border-slate-300 dark:border-slate-700/80 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-500/50 hover:bg-rose-500/10 transition-all shadow-2xs cursor-pointer"
                        title="Delete Folder"
                        onClick={() => setDeleteTarget(folder)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                  {isRoot && (
                    <span className="text-[10px] font-mono text-slate-400 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                      System Folder
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </Card>

      {/* Add / Edit Folder Dialog */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title={editingFolder ? 'Edit Quiz Folder' : 'Add Quiz Folder'}
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
