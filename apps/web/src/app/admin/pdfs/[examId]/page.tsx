'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ApiClient } from '@/lib/api-client';
import { LibraryFolderManager } from '../../library-folder-manager';
import type { PdfChapter } from '@psc/shared-types';

export default function AdminPdfChaptersPage() {
  const params = useParams();
  const examId = params?.examId as string;
  const [examTitle, setExamTitle] = useState('');

  const fetchExamTitle = useCallback(async () => {
    try {
      const exam = await ApiClient.getPdfExam(examId);
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
      pageSubtitle="Chapters inside this exam. Open one to upload its PDF study material."
      backHref="/admin/pdfs"
      backLabel="Back to PDF Library"
      fetchItems={() => ApiClient.getPdfChapters(examId)}
      createItem={(payload) => ApiClient.createPdfChapter(examId, payload)}
      updateItem={(chapterId, payload) => ApiClient.updatePdfChapter(chapterId, payload)}
      deleteItem={(chapterId) => ApiClient.deletePdfChapter(chapterId)}
      reorderItems={(items) => ApiClient.reorderPdfChapters(examId, items)}
      getChildHref={(chapter) => `/admin/pdfs/${examId}/chapters/${chapter.id}`}
      getSummary={(chapter) => {
        const { documentCount = 0 } = chapter as PdfChapter;
        return `${documentCount} PDF${documentCount === 1 ? '' : 's'}`;
      }}
    />
  );
}
