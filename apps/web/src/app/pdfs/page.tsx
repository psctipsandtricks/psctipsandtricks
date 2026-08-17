'use client';

import React from 'react';
import type { PdfExam } from '@psc/shared-types';
import { ApiClient } from '@/lib/api-client';
import { LibraryFolderGrid } from '../library-folder-grid';

export default function PdfExamsPage() {
  return (
    <LibraryFolderGrid
      heading="PDF Study Material"
      subheading="Pick your exam to browse its chapters and downloadable notes."
      nounPlural="exams"
      loginRedirect="/pdfs"
      accentClassName="bg-amber-500/10 border-amber-500/20 text-amber-500"
      fetchFolders={() => ApiClient.getPdfExams()}
      getChildHref={(exam) => `/pdfs/${exam.id}`}
      getSummary={(exam) => {
        const { documentCount = 0 } = exam as PdfExam;
        return documentCount ? `${documentCount} PDF${documentCount === 1 ? '' : 's'}` : null;
      }}
    />
  );
}
