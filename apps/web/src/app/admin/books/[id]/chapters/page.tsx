'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ApiClient } from '@/lib/api-client';
import { ContentHierarchyPage } from '../../content-hierarchy';

export default function BookChaptersPage() {
  const params = useParams();
  const bookId = params?.id as string;
  const [bookTitle, setBookTitle] = useState('');

  const fetchBookTitle = useCallback(async () => {
    try {
      const book = await ApiClient.getBookById(bookId);
      setBookTitle(book.title);
    } catch {
      // The hierarchy panel below surfaces its own load error; the title is cosmetic.
    }
  }, [bookId]);

  useEffect(() => {
    if (bookId) fetchBookTitle();
  }, [bookId, fetchBookTitle]);

  return (
    <ContentHierarchyPage
      nounSingular="Chapter"
      nounPlural="Chapters"
      pageTitle={bookTitle || 'Chapters'}
      pageSubtitle="Organize this book into chapters, then break each chapter into topics and subtopics."
      backHref="/admin/books"
      backLabel="Back to Books List"
      fetchItems={() => ApiClient.getChapters(bookId)}
      createItem={(payload) => ApiClient.createChapter(bookId, payload)}
      updateItem={(chapterId, payload) => ApiClient.updateChapter(chapterId, payload)}
      deleteItem={(chapterId) => ApiClient.deleteChapter(chapterId)}
      reorderItems={(chapters) => ApiClient.reorderChapters(bookId, chapters)}
      uploadAudio={(chapterId, file) => ApiClient.uploadChapterAudio(chapterId, file)}
      uploadPdf={(chapterId, file) => ApiClient.uploadChapterPdf(chapterId, file)}
      reprocessAudio={(chapterId) => ApiClient.reprocessChapterAudio(chapterId)}
      onReprocessAll={() => ApiClient.reprocessAllAudio()}
      getChildHref={(item) => `/admin/books/${bookId}/chapters/${item.id}/topics`}
    />
  );
}
