'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ApiClient } from '@/lib/api-client';
import { ContentHierarchyPage } from '../../../../content-hierarchy';

export default function ChapterTopicsPage() {
  const params = useParams();
  const bookId = params?.id as string;
  const chapterId = params?.chapterId as string;
  const [chapterTitle, setChapterTitle] = useState('');

  const fetchChapterTitle = useCallback(async () => {
    try {
      const chapter = await ApiClient.getChapter(chapterId);
      setChapterTitle(chapter.title);
    } catch {
      // The hierarchy panel below surfaces its own load error; the title is cosmetic.
    }
  }, [chapterId]);

  useEffect(() => {
    if (chapterId) fetchChapterTitle();
  }, [chapterId, fetchChapterTitle]);

  return (
    <ContentHierarchyPage
      nounSingular="Topic"
      nounPlural="Topics"
      pageTitle={chapterTitle || 'Topics'}
      pageSubtitle="Break this chapter into topics, then optionally split each topic into subtopics."
      backHref={`/admin/books/${bookId}/chapters`}
      backLabel="Back to Chapters List"
      fetchItems={() => ApiClient.getTopics(chapterId)}
      createItem={(payload) => ApiClient.createTopic(chapterId, payload)}
      updateItem={(topicId, payload) => ApiClient.updateTopic(topicId, payload)}
      deleteItem={(topicId) => ApiClient.deleteTopic(topicId)}
      reorderItems={(topics) => ApiClient.reorderTopics(chapterId, topics)}
      uploadAudio={(topicId, file) => ApiClient.uploadTopicAudio(topicId, file)}
      uploadPdf={(topicId, file) => ApiClient.uploadTopicPdf(topicId, file)}
      reprocessAudio={(topicId) => ApiClient.reprocessTopicAudio(topicId)}
      getChildHref={(item) => `/admin/books/${bookId}/chapters/${chapterId}/topics/${item.id}/subtopics`}
    />
  );
}
