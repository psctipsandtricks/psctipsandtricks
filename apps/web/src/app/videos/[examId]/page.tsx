'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { VideoChapter } from '@psc/shared-types';
import { ApiClient } from '@/lib/api-client';
import { LibraryFolderGrid } from '../../library-folder-grid';

export default function VideoChaptersPage() {
  const params = useParams();
  const examId = params?.examId as string;
  const [examTitle, setExamTitle] = useState('');

  const loadExamTitle = useCallback(async () => {
    try {
      const exam = await ApiClient.getVideoExam(examId);
      setExamTitle(exam.title);
    } catch {
      // The grid below surfaces its own load error; the heading is cosmetic.
    }
  }, [examId]);

  useEffect(() => {
    if (examId) loadExamTitle();
  }, [examId, loadExamTitle]);

  return (
    <LibraryFolderGrid
      heading={examTitle || 'Chapters'}
      subheading="Open a chapter to watch its video lessons."
      nounPlural="chapters"
      loginRedirect={`/videos/${examId}`}
      backHref="/videos"
      backLabel="All Exams"
      accentClassName="bg-rose-500/10 border-rose-500/20 text-rose-500"
      fetchFolders={() => ApiClient.getVideoChapters(examId)}
      getChildHref={(chapter) => `/videos/${examId}/chapters/${chapter.id}`}
      getSummary={(chapter) => {
        const { videoCount = 0 } = chapter as VideoChapter;
        return videoCount ? `${videoCount} video${videoCount === 1 ? '' : 's'}` : null;
      }}
    />
  );
}
