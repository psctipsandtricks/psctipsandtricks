'use client';

import React from 'react';
import { ApiClient } from '@/lib/api-client';
import { LibraryFolderManager } from '../library-folder-manager';
import type { VideoExam } from '@psc/shared-types';

export default function AdminVideoExamsPage() {
  return (
    <LibraryFolderManager
      nounSingular="Exam"
      nounPlural="Exams"
      pageTitle="Video Library"
      pageSubtitle="Top level of the video library. Each exam holds chapters, and each chapter holds YouTube videos."
      fetchItems={() => ApiClient.getVideoExams()}
      createItem={(payload) => ApiClient.createVideoExam(payload)}
      updateItem={(examId, payload) => ApiClient.updateVideoExam(examId, payload)}
      deleteItem={(examId) => ApiClient.deleteVideoExam(examId)}
      reorderItems={(items) => ApiClient.reorderVideoExams(items)}
      getChildHref={(exam) => `/admin/videos/${exam.id}`}
      getSummary={(exam) => {
        const { chapterCount = 0, videoCount = 0 } = exam as VideoExam;
        return `${chapterCount} chapter${chapterCount === 1 ? '' : 's'} · ${videoCount} video${videoCount === 1 ? '' : 's'}`;
      }}
    />
  );
}
