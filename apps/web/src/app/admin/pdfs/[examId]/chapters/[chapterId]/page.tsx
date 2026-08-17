'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Badge, Button, Card, ConfirmDialog, Dialog, Input, Skeleton, ToggleSwitch } from '@psc/ui';
import { ArrowLeft, ArrowDown, ArrowUp, Edit3, Eye, FileText, Plus, Trash2, TriangleAlert, X, CheckCircle2, UploadCloud, ExternalLink } from 'lucide-react';
import type { PdfDocument } from '@psc/shared-types';
import { ApiClient } from '@/lib/api-client';

const MAX_PDF_BYTES = 50 * 1024 * 1024; // matches the API's 50MB upload limit

const documentSchema = Yup.object({
  title: Yup.string().trim().required('Title is required'),
});

const emptyValues = { title: '', description: '', isActive: true };

function formatFileSize(bytes?: number | null): string | null {
  if (!bytes) return null;
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function AdminChapterPdfsPage() {
  const params = useParams();
  const examId = params?.examId as string;
  const chapterId = params?.chapterId as string;

  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<PdfDocument[]>([]);
  const [chapterTitle, setChapterTitle] = useState('');
  const [pageError, setPageError] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<PdfDocument | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PdfDocument | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ApiClient.getPdfDocuments(chapterId);
      setDocuments([...data].sort((a, b) => a.orderIndex - b.orderIndex));
    } catch (err: any) {
      setPageError(err.message || 'Failed to load PDFs.');
    } finally {
      setLoading(false);
    }
  }, [chapterId]);

  const loadChapterTitle = useCallback(async () => {
    try {
      const chapter = await ApiClient.getPdfChapter(chapterId);
      setChapterTitle(chapter.title);
    } catch {
      // The list below surfaces its own load error; the title is cosmetic.
    }
  }, [chapterId]);

  useEffect(() => {
    if (!chapterId) return;
    load();
    loadChapterTitle();
  }, [chapterId, load, loadChapterTitle]);

  const formik = useFormik({
    initialValues: emptyValues,
    validationSchema: documentSchema,
    onSubmit: async (values, { resetForm, setSubmitting, setFieldError }) => {
      // A brand new entry with no file would be invisible to students, so the
      // file is required on create and optional (replace) on edit.
      if (!editingDocument && !pdfFile) {
        setFieldError('title', 'Choose a PDF file to upload.');
        setSubmitting(false);
        return;
      }

      try {
        const payload = {
          title: values.title.trim(),
          description: values.description.trim() || undefined,
          isActive: values.isActive,
        };

        const target = editingDocument
          ? await ApiClient.updatePdfDocument(editingDocument.id, payload)
          : await ApiClient.createPdfDocument(chapterId, { ...payload, orderIndex: documents.length });

        if (pdfFile) {
          setUploadPercent(0);
          await ApiClient.uploadPdfDocumentFile(target.id, pdfFile, setUploadPercent);
        }

        resetForm();
        setPdfFile(null);
        setIsDialogOpen(false);
        setEditingDocument(null);
        await load();
      } catch (err: any) {
        setFieldError('title', err.message || 'Failed to save PDF.');
      } finally {
        setUploadPercent(null);
        setSubmitting(false);
      }
    },
  });

  const handleOpenCreate = () => {
    setEditingDocument(null);
    setPdfFile(null);
    formik.resetForm({ values: emptyValues });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (document: PdfDocument) => {
    setEditingDocument(document);
    setPdfFile(null);
    formik.resetForm({
      values: {
        title: document.title,
        description: document.description || '',
        isActive: document.isActive,
      },
    });
    setIsDialogOpen(true);
  };

  const handlePickFile = (file: File | null) => {
    if (file && file.size > MAX_PDF_BYTES) {
      // Caught here rather than after a long upload that the server would reject.
      setPageError(`"${file.name}" is larger than the 50MB limit.`);
      setPdfFile(null);
      return;
    }
    setPdfFile(file);
  };

  const handleDelete = async (id: string) => {
    const previous = documents;
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    try {
      await ApiClient.deletePdfDocument(id);
    } catch (err: any) {
      setDocuments(previous);
      setPageError(err.message || 'Failed to delete PDF.');
    }
  };

  const move = async (index: number, direction: 'UP' | 'DOWN') => {
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= documents.length) return;

    const next = [...documents];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    const reindexed = next.map((doc, idx) => ({ ...doc, orderIndex: idx }));
    const previous = documents;
    setDocuments(reindexed);
    setIsReordering(true);
    try {
      await ApiClient.reorderPdfDocuments(
        chapterId,
        reindexed.map((doc) => ({ id: doc.id, orderIndex: doc.orderIndex })),
      );
    } catch (err: any) {
      setDocuments(previous);
      setPageError(err.message || 'Failed to reorder.');
    } finally {
      setIsReordering(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4">
      <div className="shrink-0 space-y-2">
        <Link
          href={`/admin/pdfs/${examId}`}
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Chapters</span>
        </Link>
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {chapterTitle || 'PDFs'}
              </h1>
              <Badge variant="gold" className="font-extrabold text-xs">
                {documents.length} PDFs
              </Badge>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
              Upload the study material students can open inside this chapter.
            </p>
          </div>
          <Button
            variant="gold"
            className="font-bold text-xs shadow-md shadow-cyan-500/20 shrink-0"
            onClick={handleOpenCreate}
          >
            <Plus className="w-4 h-4" />
            <span>Add PDF</span>
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

      <Card className="flex-1 flex flex-col min-h-0 overflow-y-auto border border-slate-200/80 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] shadow-sm p-3 space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, idx) => <Skeleton key={idx} className="h-16 w-full rounded-xl" />)
        ) : documents.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner">
              <FileText className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">No PDFs Yet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click &ldquo;Add PDF&rdquo; to upload the first document.
              </p>
            </div>
          </div>
        ) : (
          documents.map((document, idx) => {
            const size = formatFileSize(document.fileSizeBytes);
            return (
              <div key={document.id} className="flex items-center gap-2">
                <div className="flex flex-col shrink-0">
                  <button
                    type="button"
                    onClick={() => move(idx, 'UP')}
                    disabled={idx === 0 || isReordering}
                    className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 transition-colors cursor-pointer rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Move PDF Up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, 'DOWN')}
                    disabled={idx === documents.length - 1 || isReordering}
                    className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 transition-colors cursor-pointer rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Move PDF Down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 min-w-0 flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-slate-50/60 dark:bg-[#0c152e]/60">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                    <FileText className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white truncate">{document.title}</span>
                      <Badge
                        className={`text-[10px] font-extrabold shrink-0 ${
                          document.isActive
                            ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {document.isActive ? 'Visible' : 'Hidden'}
                      </Badge>
                    </div>
                    {document.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{document.description}</p>
                    )}
                    {document.fileUrl ? (
                      <a
                        href={document.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline mt-1"
                      >
                        <FileText className="w-3 h-3" />
                        <span className="truncate max-w-[220px]">{document.fileName || 'Open PDF'}</span>
                        {size && <span className="text-slate-400 font-mono">· {size}</span>}
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-500 mt-1">
                        <TriangleAlert className="w-3 h-3" />
                        No file uploaded — hidden from students
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="p-2 rounded-xl border-slate-300 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/10 transition-all shadow-2xs cursor-pointer"
                    title="Edit PDF"
                    onClick={() => handleOpenEdit(document)}
                  >
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    className="p-2 rounded-xl border-slate-300 dark:border-slate-700/80 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-500/50 hover:bg-rose-500/10 transition-all shadow-2xs cursor-pointer"
                    title="Delete PDF"
                    onClick={() => setDeleteTarget(document)}
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
        title={editingDocument ? 'Edit PDF' : 'Add PDF'}
      >
        <form className="space-y-4 pt-2" onSubmit={formik.handleSubmit} noValidate>
          <Input
            label="PDF Title"
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

          <div className="space-y-2 p-3 rounded-2xl border border-slate-200 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#0c152e]/50">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-500" />
                <span>PDF Document{editingDocument ? ' (Optional)' : ''}</span>
              </label>
              <span className="text-[10px] text-slate-400 font-semibold">PDF · Max 50MB</span>
            </div>

            {/* Current Active PDF Document Preview */}
            {editingDocument?.fileUrl && !pdfFile && (
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-500/[0.07] text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold text-amber-900 dark:text-amber-300 truncate">
                      {editingDocument.fileName || 'Current PDF Attached'}
                    </p>
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 truncate">
                      {formatFileSize(editingDocument.fileSizeBytes) ? `${formatFileSize(editingDocument.fileSizeBytes)} · ` : ''}Active for students
                    </p>
                  </div>
                </div>
                <a
                  href={editingDocument.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 font-bold shrink-0 transition-colors text-[11px]"
                >
                  <span>View</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Newly Selected PDF Preview */}
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
                  : editingDocument?.fileUrl
                    ? 'Upload new PDF to replace current…'
                    : 'Choose a PDF file…'}
              </span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => handlePickFile(e.target.files?.[0] || null)}
              />
            </label>

            {uploadPercent !== null && (
              <div className="space-y-1 pt-1">
                <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-200"
                    style={{ width: `${uploadPercent}%` }}
                  />
                </div>
                <p className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400">Uploading… {uploadPercent}%</p>
              </div>
            )}
          </div>

          <ToggleSwitch
            icon={Eye}
            variant="emerald"
            label="Visible to students"
            description="When OFF, this PDF is hidden from the student PDF library."
            checked={formik.values.isActive}
            onChange={(checked) => formik.setFieldValue('isActive', checked)}
          />

          <Button
            type="submit"
            variant="gold"
            className="w-full font-bold shadow-md shadow-cyan-500/20"
            isLoading={formik.isSubmitting}
          >
            {editingDocument ? 'Save PDF' : 'Add PDF'}
          </Button>
        </form>
      </Dialog>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete PDF"
        description={
          deleteTarget ? `This will permanently remove "${deleteTarget.title}". This action cannot be undone.` : undefined
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
