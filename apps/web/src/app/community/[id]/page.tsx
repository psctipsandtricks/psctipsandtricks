'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { CommunityView } from '../community-view';

export default function GroupDiscussionPage() {
  const params = useParams();
  const groupId = (params?.id as string) || '';

  return <CommunityView initialGroupId={groupId} />;
}
