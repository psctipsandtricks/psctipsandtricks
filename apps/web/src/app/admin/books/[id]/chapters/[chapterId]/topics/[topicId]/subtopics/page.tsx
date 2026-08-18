'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ApiClient } from '@/lib/api-client';
import { ContentHierarchyPage } from '../../../../../../content-hierarchy';

export default function TopicSubtopicsPage() {
  const params = useParams();
  const bookId = params?.id as string;
  const chapterId = params?.chapterId as string;
  const topicId = params?.topicId as string;
  const [topicTitle, setTopicTitle] = useState('');

  const fetchTopicTitle = useCallback(async () => {
    try {
      const topic = await ApiClient.getTopic(topicId);
      setTopicTitle(topic.title);
    } catch {
      // The hierarchy panel below surfaces its own load error; the title is cosmetic.
    }
  }, [topicId]);

  useEffect(() => {
    if (topicId) fetchTopicTitle();
  }, [topicId, fetchTopicTitle]);

  return (
    <ContentHierarchyPage
      nounSingular="Subtopic"
      nounPlural="Subtopics"
      pageTitle={topicTitle || 'Subtopics'}
      pageSubtitle="The finest level of detail — each subtopic can carry its own YouTube link, audio, and PDF."
      backHref={`/admin/books/${bookId}/chapters/${chapterId}/topics`}
      backLabel="Back to Topics List"
      fetchItems={() => ApiClient.getSubtopics(topicId)}
      createItem={(payload) => ApiClient.createSubtopic(topicId, payload)}
      updateItem={(subtopicId, payload) => ApiClient.updateSubtopic(subtopicId, payload)}
      deleteItem={(subtopicId) => ApiClient.deleteSubtopic(subtopicId)}
      reorderItems={(subtopics) => ApiClient.reorderSubtopics(topicId, subtopics)}
      uploadAudio={(subtopicId, file) => ApiClient.uploadSubtopicAudio(subtopicId, file)}
      uploadPdf={(subtopicId, file) => ApiClient.uploadSubtopicPdf(subtopicId, file)}
    />
  );
}
