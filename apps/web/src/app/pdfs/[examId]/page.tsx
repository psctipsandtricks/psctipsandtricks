'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { PdfChapter } from '@psc/shared-types';
import { ApiClient } from '@/lib/api-client';
import { LibraryFolderGrid } from '../../library-folder-grid';

export default function PdfChaptersPage() {
  const params = useParams();
  const examId = params?.examId as string;
  const [examTitle, setExamTitle] = useState('');

  const loadExamTitle = useCallback(async () => {
    try {
      const exam = await ApiClient.getPdfExam(examId);
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
      subheading="Open a chapter to read its PDF study material."
      nounPlural="chapters"
      loginRedirect={`/pdfs/${examId}`}
      backHref="/pdfs"
      backLabel="All Exams"
      accentClassName="bg-amber-500/10 border-amber-500/20 text-amber-500"
      fetchFolders={() => ApiClient.getPdfChapters(examId)}
      getChildHref={(chapter) => `/pdfs/${examId}/chapters/${chapter.id}`}
      getSummary={(chapter) => {
        const { documentCount = 0 } = chapter as PdfChapter;
        return documentCount ? `${documentCount} PDF${documentCount === 1 ? '' : 's'}` : null;
      }}
    />
  );
}
