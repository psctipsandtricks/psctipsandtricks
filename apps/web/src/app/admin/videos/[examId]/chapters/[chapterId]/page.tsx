'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Badge, Button, Card, ConfirmDialog, Dialog, Input, Skeleton, ToggleSwitch } from '@psc/ui';
import { ArrowLeft, ArrowDown, ArrowUp, Edit3, ExternalLink, Eye, Plus, Trash2, Video as VideoIcon, X } from 'lucide-react';
import type { Video } from '@psc/shared-types';
import { ApiClient } from '@/lib/api-client';
import { extractYoutubeVideoId, youtubeFallbackThumbnail, youtubeWatchUrl } from '@/lib/youtube';

const videoSchema = Yup.object({
  title: Yup.string().trim().required('Title is required'),
  youtubeUrl: Yup.string()
    .trim()
    .required('YouTube link is required')
    // Mirrors the API's rule so a bad link is caught before the round trip;
    // the server re-validates and is still the authority.
    .test('is-youtube', 'That does not look like a YouTube link', (value) => !!extractYoutubeVideoId(value || '')),
});

const emptyValues = { title: '', description: '', youtubeUrl: '', isActive: true };

export default function AdminChapterVideosPage() {
  const params = useParams();
  const examId = params?.examId as string;
  const chapterId = params?.chapterId as string;

  const [loading, setLoading] = useState(true);
  const [videos, setVideos] = useState<Video[]>([]);
  const [chapterTitle, setChapterTitle] = useState('');
  const [pageError, setPageError] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Video | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ApiClient.getVideos(chapterId);
      setVideos([...data].sort((a, b) => a.orderIndex - b.orderIndex));
    } catch (err: any) {
      setPageError(err.message || 'Failed to load videos.');
    } finally {
      setLoading(false);
    }
  }, [chapterId]);

  const loadChapterTitle = useCallback(async () => {
    try {
      const chapter = await ApiClient.getVideoChapter(chapterId);
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
    validationSchema: videoSchema,
    onSubmit: async (values, { resetForm, setSubmitting, setFieldError }) => {
      try {
        const payload = {
          title: values.title.trim(),
          description: values.description.trim() || undefined,
          youtubeUrl: values.youtubeUrl.trim(),
          isActive: values.isActive,
        };
        if (editingVideo) {
          await ApiClient.updateVideo(editingVideo.id, payload);
        } else {
          await ApiClient.createVideo(chapterId, { ...payload, orderIndex: videos.length });
        }
        resetForm();
        setIsDialogOpen(false);
        setEditingVideo(null);
        await load();
      } catch (err: any) {
        setFieldError('youtubeUrl', err.message || 'Failed to save video.');
      } finally {
        setSubmitting(false);
      }
    },
  });

  const handleOpenCreate = () => {
    setEditingVideo(null);
    formik.resetForm({ values: emptyValues });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (video: Video) => {
    setEditingVideo(video);
    formik.resetForm({
      values: {
        title: video.title,
        description: video.description || '',
        youtubeUrl: video.youtubeUrl,
        isActive: video.isActive,
      },
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const previous = videos;
    setVideos((prev) => prev.filter((v) => v.id !== id));
    try {
      await ApiClient.deleteVideo(id);
    } catch (err: any) {
      setVideos(previous);
      setPageError(err.message || 'Failed to delete video.');
    }
  };

  const move = async (index: number, direction: 'UP' | 'DOWN') => {
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= videos.length) return;

    const next = [...videos];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    const reindexed = next.map((video, idx) => ({ ...video, orderIndex: idx }));
    const previous = videos;
    setVideos(reindexed);
    setIsReordering(true);
    try {
      await ApiClient.reorderVideos(
        chapterId,
        reindexed.map((video) => ({ id: video.id, orderIndex: video.orderIndex })),
      );
    } catch (err: any) {
      setVideos(previous);
      setPageError(err.message || 'Failed to reorder.');
    } finally {
      setIsReordering(false);
    }
  };

  // Previewed live as the admin types, so a wrong link is obvious before saving.
  const previewVideoId = extractYoutubeVideoId(formik.values.youtubeUrl);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4">
      <div className="shrink-0 space-y-2">
        <Link
          href={`/admin/videos/${examId}`}
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Chapters</span>
        </Link>
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {chapterTitle || 'Videos'}
              </h1>
              <Badge variant="gold" className="font-extrabold text-xs">
                {videos.length} Videos
              </Badge>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
              Paste a YouTube link — the thumbnail is pulled from YouTube automatically.
            </p>
          </div>
          <Button
            variant="gold"
            className="font-bold text-xs shadow-md shadow-cyan-500/20 shrink-0"
            onClick={handleOpenCreate}
          >
            <Plus className="w-4 h-4" />
            <span>Add Video</span>
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
          Array.from({ length: 4 }).map((_, idx) => <Skeleton key={idx} className="h-20 w-full rounded-xl" />)
        ) : videos.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shadow-inner">
              <VideoIcon className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">No Videos Yet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click &ldquo;Add Video&rdquo; and paste a YouTube link to add the first one.
              </p>
            </div>
          </div>
        ) : (
          videos.map((video, idx) => (
            <div key={video.id} className="flex items-center gap-2">
              <div className="flex flex-col shrink-0">
                <button
                  type="button"
                  onClick={() => move(idx, 'UP')}
                  disabled={idx === 0 || isReordering}
                  className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 transition-colors cursor-pointer rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Move Video Up"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 'DOWN')}
                  disabled={idx === videos.length - 1 || isReordering}
                  className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 transition-colors cursor-pointer rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Move Video Down"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 min-w-0 flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-slate-50/60 dark:bg-[#0c152e]/60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={video.thumbnailUrl}
                  alt=""
                  className="w-24 h-14 rounded-lg object-cover bg-slate-200 dark:bg-slate-800 shrink-0"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white truncate">{video.title}</span>
                    <Badge
                      className={`text-[10px] font-extrabold shrink-0 ${
                        video.isActive
                          ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {video.isActive ? 'Visible' : 'Hidden'}
                    </Badge>
                  </div>
                  {video.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{video.description}</p>
                  )}
                  <a
                    href={youtubeWatchUrl(video.youtubeVideoId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-500 hover:underline mt-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span className="font-mono">{video.youtubeVideoId}</span>
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="p-2 rounded-xl border-slate-300 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/10 transition-all shadow-2xs cursor-pointer"
                  title="Edit Video"
                  onClick={() => handleOpenEdit(video)}
                >
                  <Edit3 className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  className="p-2 rounded-xl border-slate-300 dark:border-slate-700/80 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-500/50 hover:bg-rose-500/10 transition-all shadow-2xs cursor-pointer"
                  title="Delete Video"
                  onClick={() => setDeleteTarget(video)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </Card>

      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title={editingVideo ? 'Edit Video' : 'Add Video'}
      >
        <form className="space-y-4 pt-2" onSubmit={formik.handleSubmit} noValidate>
          <Input
            label="YouTube Link"
            name="youtubeUrl"
            placeholder="https://www.youtube.com/watch?v=… or https://youtu.be/…"
            value={formik.values.youtubeUrl}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.youtubeUrl && formik.errors.youtubeUrl ? formik.errors.youtubeUrl : undefined}
          />

          {previewVideoId && (
            <div className="flex items-center gap-3 p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={youtubeFallbackThumbnail(previewVideoId)}
                alt=""
                className="w-28 h-16 rounded-lg object-cover bg-slate-200 dark:bg-slate-800 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300">Thumbnail detected</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">{previewVideoId}</p>
              </div>
            </div>
          )}

          <Input
            label="Video Title"
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
            description="When OFF, this video is hidden from the student video library."
            checked={formik.values.isActive}
            onChange={(checked) => formik.setFieldValue('isActive', checked)}
          />

          <Button
            type="submit"
            variant="gold"
            className="w-full font-bold shadow-md shadow-cyan-500/20"
            isLoading={formik.isSubmitting}
          >
            {editingVideo ? 'Save Video' : 'Add Video'}
          </Button>
        </form>
      </Dialog>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete Video"
        description={
          deleteTarget
            ? `This will remove "${deleteTarget.title}" from this chapter. The video stays on YouTube.`
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
