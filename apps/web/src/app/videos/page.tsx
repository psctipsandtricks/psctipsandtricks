'use client';

import React from 'react';
import type { VideoExam } from '@psc/shared-types';
import { ApiClient } from '@/lib/api-client';
import { LibraryFolderGrid } from '../library-folder-grid';

export default function VideoExamsPage() {
  return (
    <LibraryFolderGrid
      heading="Video Classes"
      subheading="Pick your exam to browse its chapters and video lessons."
      nounPlural="exams"
      loginRedirect="/videos"
      accentClassName="bg-rose-500/10 border-rose-500/20 text-rose-500"
      fetchFolders={() => ApiClient.getVideoExams()}
      getChildHref={(exam) => `/videos/${exam.id}`}
      getSummary={(exam) => {
        const { videoCount = 0 } = exam as VideoExam;
        return videoCount ? `${videoCount} video${videoCount === 1 ? '' : 's'}` : null;
      }}
    />
  );
}
