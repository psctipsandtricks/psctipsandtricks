'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '../../lib/api-client';
import type { ChatGroupWithUserState, ChatMessageType } from '@psc/shared-types';

export const MAX_PINS = 3;

export interface PollOption {
  id: string;
  text: string;
  votes: number;
  votedUserIds?: string[];
}

export interface Attachment {
  type: 'image' | 'video' | 'audio' | 'pdf' | 'file';
  url: string;
  name: string;
  size?: string;
}

export interface Reaction {
  emoji: string;
  count: number;
  users: string[]; // user ids
}

export interface ReplyPreview {
  id: string;
  senderName: string;
  content: string;
}

export interface DiscussionMessage {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string | null;
  senderRole?: 'Admin' | 'Moderator' | 'Student';
  content: string;
  createdAt: string;
  isPinned?: boolean;
  isAnnouncement?: boolean;
  attachments?: Attachment[];
  poll?: { question: string; options: PollOption[]; totalVotes: number };
  reactions: Reaction[];
  replyTo?: ReplyPreview;
}

export interface CommunityGroup {
  id: string;
  name: string;
  description: string;
  category: string;
  iconEmoji: string;
  coverGradient: string;
  memberCount: number;
  unreadCount: number;
  isLocked: boolean;
  isJoined: boolean;
  isPinned: boolean;
  lastReadMessageId?: string | null;
  lastMessageSnippet?: string;
  lastMessageTime?: string;
}

const ROLE_LABEL: Record<string, 'Admin' | 'Moderator' | 'Student'> = {
  ADMIN: 'Admin',
  STAFF: 'Moderator',
  STUDENT: 'Student',
};

function mapMessage(m: any): DiscussionMessage {
  const metadata = m.metadata || {};
  return {
    id: m.id,
    groupId: m.groupId,
    senderId: m.userId,
    senderName: m.userName,
    senderAvatar: m.userAvatar,
    senderRole: ROLE_LABEL[m.senderRole] || 'Student',
    content: m.content,
    createdAt: m.createdAt,
    isPinned: metadata.isPinned,
    isAnnouncement: metadata.isAnnouncement,
    attachments: metadata.attachments,
    poll: metadata.poll,
    reactions: metadata.reactions || [],
    replyTo: metadata.replyTo,
  };
}

function mapGroup(g: ChatGroupWithUserState): CommunityGroup {
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    category: g.category,
    iconEmoji: g.iconEmoji,
    coverGradient: g.coverGradient,
    memberCount: g.memberCount,
    unreadCount: g.unreadCount,
    isLocked: g.isLocked,
    isJoined: g.isJoined,
    isPinned: g.isPinned,
    lastReadMessageId: g.lastReadMessageId,
    lastMessageSnippet: g.lastMessage?.content,
    lastMessageTime: g.lastMessage?.createdAt,
  };
}

export function useChatGroups() {
  return useQuery({
    queryKey: ['chat-groups'],
    queryFn: async () => (await ApiClient.getChatGroups()).map(mapGroup),
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
  });
}

export function useGroupMessages(groupId: string | null) {
  return useQuery({
    queryKey: ['chat-messages', groupId],
    queryFn: async () => (await ApiClient.getGroupMessages(groupId as string)).map(mapMessage),
    enabled: !!groupId,
    refetchInterval: groupId ? 8000 : false,
  });
}

export function useJoinGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => ApiClient.joinGroup(groupId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-groups'] }),
  });
}

export function useLeaveGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => ApiClient.leaveGroup(groupId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-groups'] }),
  });
}

export function usePinGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => ApiClient.pinGroup(groupId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-groups'] }),
  });
}

export function useUnpinGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => ApiClient.unpinGroup(groupId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-groups'] }),
  });
}

export function useSendMessage(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      content: string;
      messageType?: ChatMessageType;
      mediaUrl?: string;
      metadata?: Record<string, any>;
    }) => ApiClient.sendGroupMessage(groupId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-messages', groupId] });
      qc.invalidateQueries({ queryKey: ['chat-groups'] });
    },
  });
}

export function useMarkRead(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lastReadMessageId?: string) => ApiClient.markGroupRead(groupId, lastReadMessageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-groups'] }),
  });
}

export function useUpdateMessageMetadata(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, metadata }: { messageId: string; metadata: Record<string, any> }) =>
      ApiClient.updateMessageMetadata(messageId, metadata),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-messages', groupId] }),
  });
}

/* ── Admin hooks ──────────────────────────────────────────── */

export interface AdminGroup {
  id: string;
  name: string;
  description: string;
  category: string;
  iconEmoji: string;
  coverGradient: string;
  isLocked: boolean;
  memberCount: number;
}

export interface GroupMemberWithUser {
  id: string;
  groupId: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: { id: string; name: string; email: string; avatarUrl?: string | null; role: string };
}

function mapAdminGroup(g: any): AdminGroup {
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    category: g.category,
    iconEmoji: g.iconEmoji,
    coverGradient: g.coverGradient,
    isLocked: g.isLocked,
    memberCount: g._count?.members ?? 0,
  };
}

export function useAdminGroups() {
  return useQuery({
    queryKey: ['chat-groups-admin'],
    queryFn: async () => (await ApiClient.getAllChatGroups()).map(mapAdminGroup),
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; description: string; category: string; iconEmoji: string }) =>
      ApiClient.createChatGroup(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-groups-admin'] });
      qc.invalidateQueries({ queryKey: ['chat-groups'] });
    },
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, payload }: { groupId: string; payload: Partial<{ name: string; description: string; category: string; iconEmoji: string }> }) =>
      ApiClient.updateChatGroup(groupId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-groups-admin'] });
      qc.invalidateQueries({ queryKey: ['chat-groups'] });
    },
  });
}

export function useToggleGroupLock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => ApiClient.toggleGroupLock(groupId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-groups-admin'] });
      qc.invalidateQueries({ queryKey: ['chat-groups'] });
    },
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => ApiClient.deleteChatGroup(groupId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-groups-admin'] });
      qc.invalidateQueries({ queryKey: ['chat-groups'] });
    },
  });
}

export function useGroupMembers(groupId: string | null) {
  return useQuery({
    queryKey: ['chat-group-members', groupId],
    queryFn: () => ApiClient.getGroupMembers(groupId as string) as Promise<GroupMemberWithUser[]>,
    enabled: !!groupId,
  });
}

export function useRemoveGroupMember(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => ApiClient.removeGroupMember(groupId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-group-members', groupId] });
      qc.invalidateQueries({ queryKey: ['chat-groups-admin'] });
    },
  });
}

export function usePostAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, payload }: { groupId: string; payload: { content: string; metadata?: Record<string, any> } }) =>
      ApiClient.postAnnouncement(groupId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['chat-messages', variables.groupId] });
      qc.invalidateQueries({ queryKey: ['chat-groups-admin'] });
      qc.invalidateQueries({ queryKey: ['chat-groups'] });
    },
  });
}
