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
  Edit3,
  Trash2,
  Plus,
  Music,
  FileText,
  Youtube,
  ListTree,
  Eye,
  X,
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
    validationSchema: nodeSchema,
    onSubmit: async (values, { resetForm, setSubmitting, setFieldError }) => {
      try {
        const payload = {
          title: values.title.trim(),
          description: values.description.trim() || undefined,
          isActive: values.isActive,
          youtubeUrl: values.youtubeUrl.trim() || undefined,
        };

        let target: ContentNode;
        if (editingItem) {
          target = await updateItem(editingItem.id, payload);
        } else {
          target = await createItem({ ...payload, orderIndex: items.length });
        }
        if (audioFile) target = await uploadAudio(target.id, audioFile);
        if (pdfFile) target = await uploadPdf(target.id, pdfFile);

        resetForm();
        setAudioFile(null);
        setPdfFile(null);
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
    setAudioFile(null);
    setPdfFile(null);
    formik.resetForm({ values: emptyValues });
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
    setReorderingId(reindexed[targetIndex].id);
    try {
      await reorderItems(reindexed.map((item) => ({ id: item.id, orderIndex: item.orderIndex })));
    } catch (err: any) {
      setItems(previous);
      alert(err.message || 'Failed to reorder.');
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
          <Button variant="gold" className="font-bold text-xs shadow-md shadow-cyan-500/20 shrink-0" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            <span>Add {nounSingular}</span>
          </Button>
        </div>
      </div>

      {pageError && (
        <div className="shrink-0 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-between">
          <span>{pageError}</span>
          <button type="button" onClick={() => setPageError('')} className="cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
      )}

      <Card className="flex-1 flex flex-col min-h-0 overflow-y-auto border border-slate-200/80 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] shadow-sm p-3 space-y-2">
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
            const RowInner = (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-slate-50/60 dark:bg-[#0c152e]/60 hover:border-cyan-500/40 transition-colors">
                <span className="font-mono text-xs font-extrabold text-cyan-600 dark:text-cyan-400 w-7 text-center shrink-0">
                  {idx + 1}
                </span>
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
                      {item.isActive ? 'Active' : 'Inactive'}
                    </Badge>
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
                {getChildHref && <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />}
              </div>
            );

            return (
              <div key={item.id} className="flex items-center gap-2">
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

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200">Audio File (Optional)</label>
              <span className="text-[10px] text-slate-400 font-semibold">Supported: MP3, WAV, OGG · Max 45MB</span>
            </div>
            <label className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-[#1e2e56] bg-slate-50/70 dark:bg-[#091124] text-sm cursor-pointer hover:border-cyan-500/50 transition-colors">
              <Music className="w-4 h-4 text-cyan-500 shrink-0" />
              <span className="text-slate-600 dark:text-slate-300 truncate">
                {audioFile ? audioFile.name : editingItem?.audioUrl ? 'Replace current audio file…' : 'Choose an audio file…'}
              </span>
              <input type="file" accept="audio/mpeg,audio/wav,audio/ogg,.mp3,.wav,.ogg" className="hidden" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
            </label>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200">PDF File (Optional)</label>
              <span className="text-[10px] text-slate-400 font-semibold">Supported: PDF · Max 20MB</span>
            </div>
            <label className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-[#1e2e56] bg-slate-50/70 dark:bg-[#091124] text-sm cursor-pointer hover:border-cyan-500/50 transition-colors">
              <FileText className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-slate-600 dark:text-slate-300 truncate">
                {pdfFile ? pdfFile.name : editingItem?.pdfUrl ? 'Replace current PDF file…' : 'Choose a PDF file…'}
              </span>
              <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} />
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
