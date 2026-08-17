'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Card, Button, Dialog, ConfirmDialog, Input, ToggleSwitch, Badge, Skeleton } from '@psc/ui';
import { ArrowLeft, ArrowDown, ArrowUp, ChevronRight, ChevronDown, Edit3, Eye, FolderOpen, Plus, Trash2, X, PlayCircle, FileText } from 'lucide-react';
import type { LibraryFolderPayload, ReorderEntry } from '@/lib/api-client';

/** An exam or chapter folder, at either level of either content library. */
export interface ManagedFolder {
  id: string;
  title: string;
  description?: string | null;
  orderIndex: number;
  isActive: boolean;
  chapterCount?: number;
  videoCount?: number;
  documentCount?: number;
  chapters?: {
    id: string;
    title: string;
    description?: string | null;
    orderIndex: number;
    isActive: boolean;
    videoCount?: number;
    documentCount?: number;
  }[];
  videos?: {
    id: string;
    title: string;
    youtubeUrl: string;
    orderIndex: number;
    isActive: boolean;
  }[];
  documents?: {
    id: string;
    title: string;
    fileUrl?: string | null;
    fileName?: string | null;
    fileSizeBytes?: number | null;
    orderIndex: number;
    isActive: boolean;
  }[];
}

export interface LibraryFolderManagerProps {
  /** e.g. "Exam" / "Exams" — drives every button and empty-state string. */
  nounSingular: string;
  nounPlural: string;
  pageTitle: string;
  pageSubtitle?: string;
  /** Omitted at the top level, where there is nothing to go back to. */
  backHref?: string;
  backLabel?: string;
  fetchItems: () => Promise<ManagedFolder[]>;
  createItem: (payload: LibraryFolderPayload) => Promise<ManagedFolder>;
  updateItem: (id: string, payload: Partial<LibraryFolderPayload>) => Promise<ManagedFolder>;
  deleteItem: (id: string) => Promise<unknown>;
  reorderItems: (items: ReorderEntry[]) => Promise<unknown>;
  /** Where clicking the folder leads — the next level down. */
  getChildHref: (item: ManagedFolder) => string;
  /** Short summary of what the folder holds, e.g. "3 chapters · 12 videos". */
  getSummary?: (item: ManagedFolder) => string | null;
}

const folderSchema = Yup.object({
  title: Yup.string().trim().required('Title is required'),
});

const emptyValues = { title: '', description: '', isActive: true };

/**
 * List + create/edit/delete/reorder for one folder level.
 *
 * The video and PDF libraries are separate modules with separate data, but
 * their folder levels are identical in shape, so all four admin folder screens
 * are this one component wired to different API calls.
 */
export function LibraryFolderManager({
  nounSingular,
  nounPlural,
  pageTitle,
  pageSubtitle,
  backHref,
  backLabel,
  fetchItems,
  createItem,
  updateItem,
  deleteItem,
  reorderItems,
  getChildHref,
  getSummary,
}: LibraryFolderManagerProps) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ManagedFolder[]>([]);
  const [pageError, setPageError] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ManagedFolder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedFolder | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchItems();
      setItems([...data].sort((a, b) => a.orderIndex - b.orderIndex));
    } catch (err: any) {
      setPageError(err.message || `Failed to load ${nounPlural.toLowerCase()}.`);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const formik = useFormik({
    initialValues: emptyValues,
    validationSchema: folderSchema,
    onSubmit: async (values, { resetForm, setSubmitting, setFieldError }) => {
      try {
        const payload = {
          title: values.title.trim(),
          description: values.description.trim() || undefined,
          isActive: values.isActive,
        };
        if (editingItem) {
          await updateItem(editingItem.id, payload);
        } else {
          await createItem({ ...payload, orderIndex: items.length });
        }
        resetForm();
        setIsDialogOpen(false);
        setEditingItem(null);
        await load();
      } catch (err: any) {
        setFieldError('title', err.message || `Failed to save ${nounSingular.toLowerCase()}.`);
      } finally {
        setSubmitting(false);
      }
    },
  });

  const handleOpenCreate = () => {
    setEditingItem(null);
    formik.resetForm({ values: emptyValues });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (item: ManagedFolder) => {
    setEditingItem(item);
    formik.resetForm({
      values: { title: item.title, description: item.description || '', isActive: item.isActive },
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const previous = items;
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await deleteItem(id);
    } catch (err: any) {
      setItems(previous);
      alert(err.message || `Failed to delete ${nounSingular.toLowerCase()}.`);
    }
  };

  const move = async (index: number, direction: 'UP' | 'DOWN') => {
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const next = [...items];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    const reindexed = next.map((item, idx) => ({ ...item, orderIndex: idx }));
    const previous = items;
    setItems(reindexed);
    setIsReordering(true);
    try {
      await reorderItems(reindexed.map((item) => ({ id: item.id, orderIndex: item.orderIndex })));
    } catch (err: any) {
      setItems(previous);
      alert(err.message || 'Failed to reorder.');
    } finally {
      setIsReordering(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4">
      <div className="shrink-0 space-y-2">
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center space-x-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{backLabel ?? 'Back'}</span>
          </Link>
        )}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{pageTitle}</h1>
              <Badge variant="gold" className="font-extrabold text-xs">
                {items.length} {nounPlural}
              </Badge>
            </div>
            {pageSubtitle && <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">{pageSubtitle}</p>}
          </div>
          <Button
            variant="gold"
            className="font-bold text-xs shadow-md shadow-cyan-500/20 shrink-0"
            onClick={handleOpenCreate}
          >
            <Plus className="w-4 h-4" />
            <span>Add {nounSingular}</span>
          </Button>
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

      <Card className="flex-1 flex flex-col min-h-0 overflow-y-auto border border-slate-200/80 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] shadow-sm p-3 space-y-2.5 custom-scrollbar">
        {loading ? (
          Array.from({ length: 4 }).map((_, idx) => <Skeleton key={idx} className="h-16 w-full rounded-xl" />)
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">No {nounPlural} Yet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click &ldquo;Add {nounSingular}&rdquo; to create the first one.
              </p>
            </div>
          </div>
        ) : (
          items.map((item, idx) => {
            const summary = getSummary?.(item);
            const isExpanded = expandedFolderIds.has(item.id);
            const hasChildChapters = Array.isArray(item.chapters) && item.chapters.length > 0;
            const hasChildVideos = Array.isArray(item.videos) && item.videos.length > 0;
            const hasChildDocs = Array.isArray(item.documents) && item.documents.length > 0;
            const canExpand = hasChildChapters || hasChildVideos || hasChildDocs || (item.chapterCount ?? 0) > 0 || (item.videoCount ?? 0) > 0 || (item.documentCount ?? 0) > 0;

            return (
              <div key={item.id} className="flex flex-col space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col shrink-0">
                    <button
                      type="button"
                      onClick={() => move(idx, 'UP')}
                      disabled={idx === 0 || isReordering}
                      className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 transition-colors cursor-pointer rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                      title={`Move ${nounSingular} Up`}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(idx, 'DOWN')}
                      disabled={idx === items.length - 1 || isReordering}
                      className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 transition-colors cursor-pointer rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                      title={`Move ${nounSingular} Down`}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <Link href={getChildHref(item)} className="flex-1 min-w-0 cursor-pointer">
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-slate-50/60 dark:bg-[#0c152e]/60 hover:border-cyan-500/40 transition-colors">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                        <FolderOpen className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white truncate">{item.title}</span>
                          <Badge
                            className={`text-[10px] font-extrabold shrink-0 ${
                              item.isActive
                                ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'
                            }`}
                          >
                            {item.isActive ? 'Visible' : 'Hidden'}
                          </Badge>
                        </div>
                        {item.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{item.description}</p>
                        )}
                        {summary && (
                          <p className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 mt-1">{summary}</p>
                        )}
                      </div>

                      {canExpand && (
                        <button
                          type="button"
                          onClick={(e) => toggleExpand(item.id, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-500 hover:bg-cyan-500/10 dark:hover:bg-cyan-500/15 transition-all cursor-pointer shrink-0"
                          title={isExpanded ? 'Collapse folder contents' : 'Expand folder contents'}
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-cyan-500' : ''}`} />
                        </button>
                      )}

                      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                    </div>
                  </Link>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="p-2 rounded-xl border-slate-300 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/10 transition-all shadow-2xs cursor-pointer"
                      title={`Edit ${nounSingular}`}
                      onClick={() => handleOpenEdit(item)}
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      className="p-2 rounded-xl border-slate-300 dark:border-slate-700/80 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-500/50 hover:bg-rose-500/10 transition-all shadow-2xs cursor-pointer"
                      title={`Delete ${nounSingular}`}
                      onClick={() => setDeleteTarget(item)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Nested Dropdown Accordion Panel */}
                {isExpanded && (
                  <div className="ml-9 mr-14 p-3 rounded-xl border border-cyan-500/30 bg-cyan-500/[0.03] dark:bg-cyan-950/20 space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between pb-1.5 border-b border-cyan-500/20 text-xs">
                      <span className="font-extrabold text-cyan-700 dark:text-cyan-300">
                        Contents of &ldquo;{item.title}&rdquo;
                      </span>
                      <Link
                        href={getChildHref(item)}
                        className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        Manage {nounSingular} →
                      </Link>
                    </div>

                    {/* Render child chapters if present */}
                    {hasChildChapters ? (
                      <div className="space-y-1.5">
                        {item.chapters!.map((chapter, chIdx) => (
                          <div
                            key={chapter.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-white/80 dark:bg-[#0c152e]/80 border border-slate-200/80 dark:border-[#1e2e56] text-xs hover:border-cyan-500/40 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-[11px] font-bold text-cyan-600 dark:text-cyan-400 shrink-0">
                                {idx + 1}.{chIdx + 1}
                              </span>
                              <span className="font-semibold text-slate-900 dark:text-white truncate">{chapter.title}</span>
                              <Badge
                                className={`text-[9px] px-1.5 py-0 font-extrabold shrink-0 ${
                                  chapter.isActive
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                }`}
                              >
                                {chapter.isActive ? 'Visible' : 'Hidden'}
                              </Badge>
                              {chapter.videoCount !== undefined && (
                                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                  · {chapter.videoCount} video{chapter.videoCount === 1 ? '' : 's'}
                                </span>
                              )}
                              {chapter.documentCount !== undefined && (
                                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                  · {chapter.documentCount} PDF{chapter.documentCount === 1 ? '' : 's'}
                                </span>
                              )}
                            </div>
                            <Link
                              href={`${getChildHref(item)}/chapters/${chapter.id}`}
                              className="text-[10px] font-bold text-slate-500 hover:text-cyan-500 dark:text-slate-400 dark:hover:text-cyan-400 shrink-0 ml-2"
                            >
                              Open Chapter →
                            </Link>
                          </div>
                        ))}
                      </div>
                    ) : hasChildVideos ? (
                      <div className="space-y-1.5">
                        {item.videos!.map((video, vIdx) => (
                          <div
                            key={video.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-white/80 dark:bg-[#0c152e]/80 border border-slate-200/80 dark:border-[#1e2e56] text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <PlayCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                              <span className="font-mono text-[11px] font-bold text-slate-400">{vIdx + 1}.</span>
                              <span className="font-semibold text-slate-900 dark:text-white truncate">{video.title}</span>
                            </div>
                            {video.youtubeUrl && (
                              <a
                                href={video.youtubeUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] font-bold text-rose-500 hover:underline shrink-0 ml-2"
                              >
                                Watch YouTube ↗
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : hasChildDocs ? (
                      <div className="space-y-1.5">
                        {item.documents!.map((doc, dIdx) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-white/80 dark:bg-[#0c152e]/80 border border-slate-200/80 dark:border-[#1e2e56] text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span className="font-mono text-[11px] font-bold text-slate-400">{dIdx + 1}.</span>
                              <span className="font-semibold text-slate-900 dark:text-white truncate">{doc.title}</span>
                            </div>
                            {doc.fileUrl && (
                              <a
                                href={doc.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline shrink-0 ml-2"
                              >
                                View PDF ↗
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-3 text-center text-xs text-slate-500 dark:text-slate-400">
                        No items added to this folder yet.
                        <Link href={getChildHref(item)} className="ml-1 text-cyan-600 dark:text-cyan-400 font-bold hover:underline">
                          Add contents →
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </Card>

      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title={editingItem ? `Edit ${nounSingular}` : `Add ${nounSingular}`}
      >
        <form className="space-y-4 pt-2" onSubmit={formik.handleSubmit} noValidate>
          <Input
            label={`${nounSingular} Name`}
            name="title"
            value={formik.values.title}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.title && formik.errors.title ? formik.errors.title : undefined}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Description (Optional)</label>
            <textarea
              name="description"
              rows={3}
              value={formik.values.description}
              onChange={formik.handleChange}
              className="w-full p-3 text-sm rounded-xl border border-slate-300 dark:border-[#1e2e56] bg-slate-50/70 dark:bg-[#091124] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 resize-none transition-all font-medium"
            />
          </div>

          <ToggleSwitch
            icon={Eye}
            variant="emerald"
            label="Visible to students"
            description={`When OFF, this ${nounSingular.toLowerCase()} folder and everything inside it is hidden from students.`}
            checked={formik.values.isActive}
            onChange={(checked) => formik.setFieldValue('isActive', checked)}
          />

          <Button
            type="submit"
            variant="gold"
            className="w-full font-bold shadow-md shadow-cyan-500/20"
            isLoading={formik.isSubmitting}
          >
            {editingItem ? `Save ${nounSingular}` : `Create ${nounSingular}`}
          </Button>
        </form>
      </Dialog>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title={`Delete ${nounSingular}`}
        description={
          deleteTarget
            ? `This will permanently remove "${deleteTarget.title}" and everything nested inside it. This action cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
