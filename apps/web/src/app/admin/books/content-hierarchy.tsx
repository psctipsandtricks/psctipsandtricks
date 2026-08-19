'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Card, Button, Dialog, ConfirmDialog, Input, ToggleSwitch, Badge, Skeleton } from '@psc/ui';
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  ChevronDown,
  Edit3,
  Trash2,
  Plus,
  Music,
  FileText,
  Youtube,
  ListTree,
  Eye,
  X,
  ExternalLink,
  CheckCircle2,
  UploadCloud,
} from 'lucide-react';

export interface ContentNode {
  id: string;
  title: string;
  description?: string | null;
  orderIndex: number;
  isActive: boolean;
  youtubeUrl?: string | null;
  audioUrl?: string | null;
  pdfUrl?: string | null;
  topicsCount?: number;
  topics?: {
    id: string;
    title: string;
    description?: string | null;
    orderIndex: number;
    isActive: boolean;
    youtubeUrl?: string | null;
    audioUrl?: string | null;
    pdfUrl?: string | null;
    subtopicsCount?: number;
  }[];
  subtopicsCount?: number;
  subtopics?: {
    id: string;
    title: string;
    description?: string | null;
    orderIndex: number;
    isActive: boolean;
    youtubeUrl?: string | null;
    audioUrl?: string | null;
    pdfUrl?: string | null;
  }[];
}

export interface ContentHierarchyPageProps {
  nounSingular: string;
  nounPlural: string;
  pageTitle: string;
  pageSubtitle?: string;
  backHref: string;
  backLabel: string;
  fetchItems: () => Promise<ContentNode[]>;
  createItem: (payload: {
    title: string;
    description?: string;
    isActive: boolean;
    youtubeUrl?: string;
    orderIndex?: number;
  }) => Promise<ContentNode>;
  updateItem: (id: string, payload: {
    title: string;
    description?: string;
    isActive: boolean;
    youtubeUrl?: string;
  }) => Promise<ContentNode>;
  deleteItem: (id: string) => Promise<any>;
  reorderItems: (items: { id: string; orderIndex: number }[]) => Promise<any>;
  uploadAudio: (id: string, file: File) => Promise<ContentNode>;
  uploadPdf: (id: string, file: File) => Promise<ContentNode>;
  /** When present, each row links deeper into the hierarchy (Chapter -> Topics, Topic -> Subtopics). Omitted at the leaf (Subtopic) level. */
  getChildHref?: (item: ContentNode) => string;
}

const nodeSchema = Yup.object({
  title: Yup.string().trim().required('Title is required'),
});

const emptyValues = { title: '', description: '', isActive: true, youtubeUrl: '' };

/** Shared list + create/edit/delete/reorder UI for Chapters, Topics, and Subtopics — the three levels share an identical field set, so one implementation drives all three admin pages. */
export function ContentHierarchyPage({
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
  uploadAudio,
  uploadPdf,
  getChildHref,
}: ContentHierarchyPageProps) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ContentNode[]>([]);
  const [pageError, setPageError] = useState('');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentNode | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContentNode | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setExpandedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await fetchItems();
      setItems([...data].sort((a, b) => a.orderIndex - b.orderIndex));
    } catch (err: any) {
      setPageError(err.message || `Failed to load ${nounPlural.toLowerCase()}.`);
    } finally {
      if (!silent) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const formik = useFormik({
    initialValues: emptyValues,
    validationSchema: nodeSchema,
    onSubmit: async (values, { resetForm, setSubmitting }) => {
      try {
        if (editingItem) {
          setItems((prev) =>
            prev.map((i) =>
              i.id === editingItem.id
                ? {
                    ...i,
                    title: values.title.trim(),
                    description: values.description?.trim() || undefined,
                    isActive: values.isActive,
                    youtubeUrl: values.youtubeUrl?.trim() || undefined,
                  }
                : i,
            ),
          );
          setIsDialogOpen(false);
          await updateItem(editingItem.id, {
            title: values.title.trim(),
            description: values.description?.trim() || undefined,
            isActive: values.isActive,
            youtubeUrl: values.youtubeUrl?.trim() || undefined,
          });
          if (audioFile) await uploadAudio(editingItem.id, audioFile);
          if (pdfFile) await uploadPdf(editingItem.id, pdfFile);
        } else {
          setIsDialogOpen(false);
          const created = await createItem({
            title: values.title.trim(),
            description: values.description?.trim() || undefined,
            isActive: values.isActive,
            youtubeUrl: values.youtubeUrl?.trim() || undefined,
            orderIndex: items.length,
          });
          if (audioFile) await uploadAudio(created.id, audioFile);
          if (pdfFile) await uploadPdf(created.id, pdfFile);
        }
        resetForm();
        setAudioFile(null);
        setPdfFile(null);
        setEditingItem(null);
        await load(true);
      } catch (err: any) {
        setPageError(err.message || `Failed to save ${nounSingular.toLowerCase()}.`);
      } finally {
        setSubmitting(false);
      }
    },
  });

  const handleOpenCreate = () => {
    setEditingItem(null);
    setAudioFile(null);
    setPdfFile(null);
    formik.resetForm();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (item: ContentNode) => {
    setEditingItem(item);
    setAudioFile(null);
    setPdfFile(null);
    formik.resetForm({
      values: {
        title: item.title,
        description: item.description || '',
        isActive: item.isActive,
        youtubeUrl: item.youtubeUrl || '',
      },
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const previous = items;
    setItems((prev) => prev.filter((i) => i.id !== id));
    setDeleteTarget(null);
    try {
      await deleteItem(id);
      await load(true);
    } catch (err: any) {
      setItems(previous);
      setPageError(err.message || `Failed to delete ${nounSingular.toLowerCase()}.`);
    }
  };

  const move = async (currentIndex: number, direction: 'UP' | 'DOWN') => {
    const targetIndex = direction === 'UP' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const reordered = [...items];
    const [movedItem] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, movedItem);

    const updated = reordered.map((item, idx) => ({ ...item, orderIndex: idx }));
    setItems(updated);
    setReorderingId(movedItem.id);

    try {
      await reorderItems(updated.map((i) => ({ id: i.id, orderIndex: i.orderIndex })));
    } catch (err: any) {
      setPageError(err.message || `Failed to save ${nounPlural.toLowerCase()} order.`);
      load();
    } finally {
      setReorderingId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4">
      <div className="shrink-0 space-y-2">
        <Link
          href={backHref}
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{backLabel}</span>
        </Link>
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
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="gold" className="font-bold text-xs shadow-md shadow-cyan-500/20 shrink-0" onClick={handleOpenCreate}>
              <Plus className="w-4 h-4" />
              <span>Add {nounSingular}</span>
            </Button>
          </div>
        </div>
      </div>

      {pageError && (
        <div className="shrink-0 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-between">
          <span>{pageError}</span>
          <button type="button" onClick={() => setPageError('')} className="cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
      )}

      <Card className="flex-1 flex flex-col min-h-0 overflow-y-auto border border-slate-200/80 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] shadow-sm p-3 space-y-2.5 custom-scrollbar">
        {loading ? (
          Array.from({ length: 4 }).map((_, idx) => <Skeleton key={idx} className="h-16 w-full rounded-xl" />)
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
              <ListTree className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">No {nounPlural} Yet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Click "Add {nounSingular}" to create the first one.</p>
            </div>
          </div>
        ) : (
          items.map((item, idx) => {
            const isExpanded = expandedItemIds.has(item.id);
            const hasChildTopics = Array.isArray(item.topics) && item.topics.length > 0;
            const hasChildSubtopics = Array.isArray(item.subtopics) && item.subtopics.length > 0;
            const canExpand = item.topicsCount !== undefined || hasChildTopics || item.subtopicsCount !== undefined || hasChildSubtopics;

            const RowInner = (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-slate-50/60 dark:bg-[#0c152e]/60 hover:border-cyan-500/40 transition-colors">
                <span className="font-mono text-xs font-extrabold text-cyan-600 dark:text-cyan-400 w-7 text-center shrink-0">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white truncate">{item.title}</span>
                    <Badge
                      className={`text-[10px] font-extrabold shrink-0 ${
                        item.isActive
                          ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {item.isActive ? 'Active' : 'Inactive'}
                    </Badge>

                    {item.topicsCount !== undefined && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-extrabold font-mono bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                        {item.topicsCount} {item.topicsCount === 1 ? 'Topic' : 'Topics'}
                      </span>
                    )}

                    {item.subtopicsCount !== undefined && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-extrabold font-mono bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                        {item.subtopicsCount} {item.subtopicsCount === 1 ? 'Subtopic' : 'Subtopics'}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{item.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    {item.youtubeUrl && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-500"><Youtube className="w-3 h-3" /> YouTube</span>
                    )}
                    {item.audioUrl && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-600 dark:text-cyan-400"><Music className="w-3 h-3" /> Audio</span>
                    )}
                    {item.pdfUrl && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400"><FileText className="w-3 h-3" /> PDF</span>
                    )}
                  </div>
                </div>

                {canExpand && (
                  <button
                    type="button"
                    onClick={(e) => toggleExpand(item.id, e)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-500 hover:bg-cyan-500/10 dark:hover:bg-cyan-500/15 transition-all cursor-pointer shrink-0"
                    title={isExpanded ? `Collapse ${nounSingular} Topics` : `View Topics inside this ${nounSingular}`}
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-cyan-500' : ''}`} />
                  </button>
                )}

                {getChildHref && (
                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                )}
              </div>
            );

            return (
              <div key={item.id} className="flex flex-col space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col shrink-0">
                    <button
                      type="button"
                      onClick={() => move(idx, 'UP')}
                      disabled={idx === 0 || reorderingId !== null}
                      className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 transition-colors cursor-pointer rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                      title={`Move ${nounSingular} Up`}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(idx, 'DOWN')}
                      disabled={idx === items.length - 1 || reorderingId !== null}
                      className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 transition-colors cursor-pointer rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                      title={`Move ${nounSingular} Down`}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {getChildHref ? (
                    <Link href={getChildHref(item)} className="flex-1 min-w-0 cursor-pointer">
                      {RowInner}
                    </Link>
                  ) : (
                    <div className="flex-1 min-w-0">{RowInner}</div>
                  )}

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

                {/* Nested Dropdown View of Topics inside the Chapter */}
                {isExpanded && (
                  <div className="ml-9 mr-14 p-3 rounded-xl border border-cyan-500/30 bg-cyan-500/[0.03] dark:bg-cyan-950/20 space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between pb-1.5 border-b border-cyan-500/20 text-xs">
                      <span className="font-extrabold text-cyan-700 dark:text-cyan-300">
                        Topics inside "{item.title}" ({item.topics?.length ?? item.topicsCount ?? 0})
                      </span>
                      {getChildHref && (
                        <Link
                          href={getChildHref(item)}
                          className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          Manage Topics <ChevronRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>

                    {item.topics && item.topics.length > 0 ? (
                      <div className="space-y-1.5">
                        {item.topics.map((topic, topicIdx) => (
                          <div
                            key={topic.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-white/80 dark:bg-[#0c152e]/80 border border-slate-200/80 dark:border-[#1e2e56] text-xs hover:border-cyan-500/40 transition-colors flex-wrap gap-1.5"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="font-mono text-[11px] font-bold text-cyan-600 dark:text-cyan-400 shrink-0">
                                {idx + 1}.{topicIdx + 1}
                              </span>
                              <span className="font-semibold text-slate-900 dark:text-white truncate">{topic.title}</span>
                              <Badge
                                className={`text-[9px] px-1.5 py-0 font-extrabold shrink-0 ${
                                  topic.isActive
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                }`}
                              >
                                {topic.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                              {topic.subtopicsCount !== undefined && topic.subtopicsCount > 0 && (
                                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                  · {topic.subtopicsCount} subtopics
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {topic.audioUrl && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 font-bold text-[10px]">
                                  <Music className="w-2.5 h-2.5" /> Audio
                                </span>
                              )}
                              {topic.pdfUrl && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold text-[10px]">
                                  <FileText className="w-2.5 h-2.5" /> PDF
                                </span>
                              )}
                              {topic.youtubeUrl && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-700 dark:text-rose-300 font-bold text-[10px]">
                                  <Youtube className="w-2.5 h-2.5" /> Video
                                </span>
                              )}
                              {getChildHref && (
                                <Link
                                  href={`${getChildHref(item)}/${topic.id}/subtopics`}
                                  className="text-[10px] font-bold text-slate-500 hover:text-cyan-500 dark:text-slate-400 dark:hover:text-cyan-400 shrink-0 ml-1"
                                >
                                  Manage →
                                </Link>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-3 text-center text-xs text-slate-500 dark:text-slate-400">
                        No topics added to this chapter yet.
                        {getChildHref && (
                          <Link href={getChildHref(item)} className="ml-1 text-cyan-600 dark:text-cyan-400 font-bold hover:underline">
                            Add the first topic →
                          </Link>
                        )}
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
        title={editingItem ? `Edit ${nounSingular}` : `Add ${nounSingular}${editingItem ? '' : ` to "${pageTitle}"`}`}
      >
        <form className="space-y-4 pt-2" onSubmit={formik.handleSubmit} noValidate>
          <Input
            label={`${nounSingular} Title`}
            name="title"
            value={formik.values.title}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.title && formik.errors.title ? formik.errors.title : undefined}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Description</label>
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
            label="Active"
            description={`When ON, this ${nounSingular.toLowerCase()} is visible to students.`}
            checked={formik.values.isActive}
            onChange={(checked) => formik.setFieldValue('isActive', checked)}
          />

          <Input
            label="YouTube Link (Optional)"
            name="youtubeUrl"
            placeholder="https://www.youtube.com/watch?v=… or https://youtu.be/…"
            value={formik.values.youtubeUrl}
            onChange={formik.handleChange}
          />

          {/* If editing a Chapter, show its child topics media overview */}
          {editingItem?.topics && editingItem.topics.length > 0 && (
            <div className="p-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/[0.04] dark:bg-cyan-950/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-cyan-800 dark:text-cyan-300 flex items-center gap-1.5">
                  <ListTree className="w-3.5 h-3.5 text-cyan-500" />
                  Topics & Materials in this Chapter ({editingItem.topics.length})
                </span>
                {getChildHref && (
                  <Link
                    href={getChildHref(editingItem)}
                    className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1"
                  >
                    Manage Topics <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {editingItem.topics.map((t, i) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-1.5 rounded-lg bg-white/70 dark:bg-[#070e22]/70 text-[11px] border border-slate-200/60 dark:border-slate-800"
                  >
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate mr-2">
                      {i + 1}. {t.title}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {t.audioUrl && (
                        <span className="text-[10px] font-bold text-cyan-600 flex items-center gap-0.5">
                          <Music className="w-2.5 h-2.5" /> Audio
                        </span>
                      )}
                      {t.pdfUrl && (
                        <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
                          <FileText className="w-2.5 h-2.5" /> PDF
                        </span>
                      )}
                      {t.youtubeUrl && (
                        <span className="text-[10px] font-bold text-rose-500 flex items-center gap-0.5">
                          <Youtube className="w-2.5 h-2.5" /> Video
                        </span>
                      )}
                      {!t.audioUrl && !t.pdfUrl && !t.youtubeUrl && (
                        <span className="text-[10px] text-slate-400">No media attached</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 p-3 rounded-2xl border border-slate-200 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#0c152e]/50">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-cyan-500" />
                <span>Audio File (Optional)</span>
              </label>
              <span className="text-[10px] text-slate-400 font-semibold">MP3, WAV, OGG · Max 45MB</span>
            </div>

            {/* Current Active Audio File Preview */}
            {editingItem?.audioUrl && !audioFile && (
              <div className="p-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 dark:bg-cyan-500/[0.07] space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse shrink-0" />
                    <span className="text-xs font-bold text-cyan-800 dark:text-cyan-300 truncate">
                      Current Audio File Attached
                    </span>
                  </div>
                  <a
                    href={editingItem.audioUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline shrink-0"
                  >
                    <span>Open File</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <audio src={editingItem.audioUrl} controls className="w-full h-8" preload="metadata" />
              </div>
            )}

            {/* Newly Selected Audio File Preview */}
            {audioFile && (
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-300">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold truncate">{audioFile.name}</p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                      {(audioFile.size / (1024 * 1024)).toFixed(2)} MB · Ready to upload
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAudioFile(null)}
                  className="text-slate-400 hover:text-rose-500 p-1 rounded transition-colors cursor-pointer"
                  title="Remove selection"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-[#1e2e56] bg-white dark:bg-[#091124] text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all">
              <UploadCloud className="w-3.5 h-3.5 text-cyan-500" />
              <span>
                {audioFile
                  ? 'Change audio file…'
                  : editingItem?.audioUrl
                    ? 'Upload new audio to replace current…'
                    : 'Choose an audio file…'}
              </span>
              <input
                type="file"
                accept="audio/mpeg,audio/wav,audio/ogg,.mp3,.wav,.ogg"
                className="hidden"
                onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div className="space-y-2 p-3 rounded-2xl border border-slate-200 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#0c152e]/50">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-500" />
                <span>PDF File (Optional)</span>
              </label>
              <span className="text-[10px] text-slate-400 font-semibold">PDF · Max 20MB</span>
            </div>

            {/* Current Active PDF File Preview */}
            {editingItem?.pdfUrl && !pdfFile && (
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-500/[0.07] text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold text-amber-900 dark:text-amber-300 truncate">Current PDF Document Attached</p>
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 truncate">Uploaded & active for students</p>
                  </div>
                </div>
                <a
                  href={editingItem.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 font-bold shrink-0 transition-colors text-[11px]"
                >
                  <span>View PDF</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Newly Selected PDF File Preview */}
            {pdfFile && (
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-300">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold truncate">{pdfFile.name}</p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                      {(pdfFile.size / (1024 * 1024)).toFixed(2)} MB · Ready to upload
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPdfFile(null)}
                  className="text-slate-400 hover:text-rose-500 p-1 rounded transition-colors cursor-pointer"
                  title="Remove selection"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-[#1e2e56] bg-white dark:bg-[#091124] text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:border-amber-500/50 hover:bg-amber-500/5 transition-all">
              <UploadCloud className="w-3.5 h-3.5 text-amber-500" />
              <span>
                {pdfFile
                  ? 'Change PDF file…'
                  : editingItem?.pdfUrl
                    ? 'Upload new PDF to replace current…'
                    : 'Choose a PDF file…'}
              </span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <Button type="submit" variant="gold" className="w-full font-bold shadow-md shadow-cyan-500/20" isLoading={formik.isSubmitting}>
            {editingItem ? `Save ${nounSingular}` : `Create ${nounSingular}`}
          </Button>
        </form>
      </Dialog>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title={`Delete ${nounSingular}`}
        description={
          deleteTarget
            ? `This will permanently remove "${deleteTarget.title}"${getChildHref ? ' and everything nested inside it' : ''}. This action cannot be undone.`
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
