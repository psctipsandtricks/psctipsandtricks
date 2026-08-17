'use client';

import React from 'react';
import { ApiClient } from '@/lib/api-client';
import { LibraryFolderManager } from '../library-folder-manager';
import type { PdfExam } from '@psc/shared-types';

export default function AdminPdfExamsPage() {
  return (
    <LibraryFolderManager
      nounSingular="Exam"
      nounPlural="Exams"
      pageTitle="PDF Library"
      pageSubtitle="Top level of the PDF library. Each exam holds chapters, and each chapter holds PDF study material."
      fetchItems={() => ApiClient.getPdfExams()}
      createItem={(payload) => ApiClient.createPdfExam(payload)}
      updateItem={(examId, payload) => ApiClient.updatePdfExam(examId, payload)}
      deleteItem={(examId) => ApiClient.deletePdfExam(examId)}
      reorderItems={(items) => ApiClient.reorderPdfExams(items)}
      getChildHref={(exam) => `/admin/pdfs/${exam.id}`}
      getSummary={(exam) => {
        const { chapterCount = 0, documentCount = 0 } = exam as PdfExam;
        return `${chapterCount} chapter${chapterCount === 1 ? '' : 's'} · ${documentCount} PDF${documentCount === 1 ? '' : 's'}`;
      }}
    />
  );
}
