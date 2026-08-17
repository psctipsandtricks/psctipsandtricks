'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ApiClient } from '@/lib/api-client';
import { LibraryFolderManager } from '../../library-folder-manager';
import type { VideoChapter } from '@psc/shared-types';

export default function AdminVideoChaptersPage() {
  const params = useParams();
  const examId = params?.examId as string;
  const [examTitle, setExamTitle] = useState('');

  const fetchExamTitle = useCallback(async () => {
    try {
      const exam = await ApiClient.getVideoExam(examId);
      setExamTitle(exam.title);
    } catch {
      // The folder list below surfaces its own load error; the title is cosmetic.
    }
  }, [examId]);

  useEffect(() => {
    if (examId) fetchExamTitle();
  }, [examId, fetchExamTitle]);

  return (
    <LibraryFolderManager
      nounSingular="Chapter"
      nounPlural="Chapters"
      pageTitle={examTitle || 'Chapters'}
      pageSubtitle="Chapters inside this exam. Open one to add its YouTube videos."
      backHref="/admin/videos"
      backLabel="Back to Video Library"
      fetchItems={() => ApiClient.getVideoChapters(examId)}
      createItem={(payload) => ApiClient.createVideoChapter(examId, payload)}
      updateItem={(chapterId, payload) => ApiClient.updateVideoChapter(chapterId, payload)}
      deleteItem={(chapterId) => ApiClient.deleteVideoChapter(chapterId)}
      reorderItems={(items) => ApiClient.reorderVideoChapters(examId, items)}
      getChildHref={(chapter) => `/admin/videos/${examId}/chapters/${chapter.id}`}
      getSummary={(chapter) => {
        const { videoCount = 0 } = chapter as VideoChapter;
        return `${videoCount} video${videoCount === 1 ? '' : 's'}`;
      }}
    />
  );
}
