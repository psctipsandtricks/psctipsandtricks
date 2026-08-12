'use client';

import { useEffect, useMemo } from 'react';
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { ApiClient, getActiveAccessToken } from '../../lib/api-client';
import type { ChatGroupWithUserState, ChatMessageType } from '@psc/shared-types';

export const MAX_PINS = 3;

/** How many messages we pull per request instead of the whole history. */
export const MESSAGE_PAGE_SIZE = 30;

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');

/* ── Realtime socket (single shared connection) ───────────────── */

let socket: Socket | null = null;
let socketToken: string | null = null;

/**
 * The student and admin surfaces are separate sessions with separate tokens
 * (see api-client.ts) — reconnect if the active token has changed since the
 * cached socket was opened, so an admin session actually authenticates as the
 * admin instead of silently reusing (or failing to find) a student token.
 */
function getSocket(): Socket | null {
  if (typeof window === 'undefined') return null;
  const token = getActiveAccessToken();
  if (!token) return null;
  if (socket && socketToken !== token) {
    socket.disconnect();
    socket = null;
  }
  if (!socket) {
    socket = io(API_BASE_URL, {
      auth: { token },
      transports: ['websocket'],
      autoConnect: true,
    });
    socketToken = token;
  }
  return socket;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
  votedUserIds?: string[];
}

export interface Attachment {
  type: 'image' | 'video' | 'audio' | 'pdf' | 'excel' | 'word' | 'file';
  url: string;
  name: string;
  size?: string;
  file?: File;
  uploadStatus?: 'uploading' | 'completed' | 'error';
  uploadProgress?: number;
  uploadError?: string;
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
  poll?: { question: string; options: PollOption[]; totalVotes: number; correctOptionId?: string };
  reactions: Reaction[];
  replyTo?: ReplyPreview;
  /** Set on an optimistic message when the send/upload ultimately failed, so the
   *  delivery tick can show a clear error instead of spinning forever. */
  sendFailed?: boolean;
}

export interface CommunityGroup {
  id: string;
  name: string;
  description: string;
  category: string;
  iconEmoji: string;
  imageUrl?: string | null;
  coverGradient: string;
  memberCount: number;
  unreadCount: number;
  isLocked: boolean;
  isJoined: boolean;
  isPinned: boolean;
  /** Admin switches — students only see features that are enabled. */
  allowTextMessages: boolean;
  allowPolls: boolean;
  lastReadMessageId?: string | null;
  lastMessageSnippet?: string;
  lastMessageTime?: string;
}

const ROLE_LABEL: Record<string, 'Admin' | 'Moderator' | 'Student'> = {
  ADMIN: 'Admin',
  STAFF: 'Moderator',
  STUDENT: 'Student',
};

export function mapMessage(m: any): DiscussionMessage {
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
    imageUrl: g.imageUrl ?? null,
    coverGradient: g.coverGradient,
    memberCount: g.memberCount,
    unreadCount: g.unreadCount,
    isLocked: g.isLocked,
    isJoined: g.isJoined,
    isPinned: g.isPinned,
    allowTextMessages: g.allowTextMessages ?? true,
    allowPolls: g.allowPolls ?? true,
    lastReadMessageId: g.lastReadMessageId,
    lastMessageSnippet: g.lastMessage?.content,
    lastMessageTime: g.lastMessage?.createdAt,
  };
}

export const chatGroupsKey = ['chat-groups'] as const;
export const chatMessagesKey = (groupId: string) => ['chat-messages', groupId] as const;

export function useChatGroups() {
  return useQuery({
    queryKey: chatGroupsKey,
    queryFn: async () => (await ApiClient.getChatGroups()).map(mapGroup),
    // Served from cache instantly on revisit; realtime + mutations keep it fresh,
    // so we no longer poll every 15s.
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export type MessagePage = DiscussionMessage[];

const OPTIMISTIC_PREFIX = 'optimistic-';

/**
 * Folds a server message into the cached pages exactly once, regardless of
 * whether it arrives first via the realtime socket or via the POST response.
 *
 * Without this the sender saw their own message twice: the optimistic copy is
 * keyed by a temporary id, so an id-only check treats the socket echo as new.
 */
export function mergeIncomingMessage(
  old: InfiniteData<MessagePage> | undefined,
  msg: DiscussionMessage,
): InfiniteData<MessagePage> | undefined {
  if (!old) return old;

  const alreadyStored = old.pages.some((p) => p.some((m) => m.id === msg.id));
  const matchesOptimistic = (m: DiscussionMessage) =>
    m.id.startsWith(OPTIMISTIC_PREFIX) &&
    m.senderId === msg.senderId &&
    m.content === msg.content;

  // The real message is already here — just drop the placeholder it replaced.
  if (alreadyStored) {
    if (!old.pages.some((p) => p.some(matchesOptimistic))) return old;
    return { ...old, pages: old.pages.map((p) => p.filter((m) => !matchesOptimistic(m))) };
  }

  // Swap our placeholder for the server's copy in place, keeping its position.
  if (old.pages.some((p) => p.some(matchesOptimistic))) {
    return { ...old, pages: old.pages.map((p) => p.map((m) => (matchesOptimistic(m) ? msg : m))) };
  }

  const pages = [...old.pages];
  pages[0] = [...pages[0], msg];
  return { ...old, pages };
}

/** Oldest → newest across every loaded page. */
export function flattenMessages(data?: InfiniteData<MessagePage>): DiscussionMessage[] {
  if (!data) return [];
  return [...data.pages].reverse().flat();
}

/**
 * Loads the most recent page of messages and pages backwards through history on
 * demand, rather than pulling an entire group's history up front.
 */
export function useGroupMessages(groupId: string | null) {
  const query = useInfiniteQuery({
    queryKey: chatMessagesKey(groupId as string),
    enabled: !!groupId,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      (
        await ApiClient.getGroupMessages(groupId as string, {
          before: pageParam,
          limit: MESSAGE_PAGE_SIZE,
        })
      ).map(mapMessage),
    // A short page means we've reached the beginning of the group's history.
    getNextPageParam: (lastPage) =>
      lastPage.length < MESSAGE_PAGE_SIZE ? undefined : lastPage[0]?.createdAt,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // `query.data` only gets a new reference when the cached content actually
  // changes (react-query preserves identity across unrelated re-renders), so
  // memoizing on it — rather than recomputing a fresh array every render —
  // is what makes `messages` safe to use as an effect dependency elsewhere.
  // An unstable array here previously fed a mark-as-read effect a "changed"
  // dependency on every render regardless of content, which retriggered the
  // effect, which mutated and invalidated the cache, which re-rendered —
  // an infinite loop hammering the API for as long as a group stayed open.
  const messages = useMemo(() => flattenMessages(query.data), [query.data]);

  return {
    ...query,
    messages,
    /** Older messages exist further back in history. */
    hasOlder: query.hasNextPage,
    isLoadingOlder: query.isFetchingNextPage,
    loadOlder: query.fetchNextPage,
  };
}

/**
 * Subscribes to the group's realtime feed and merges new messages straight into
 * the cache, so an open chat updates without polling.
 */
export function useGroupRealtime(groupId: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!groupId) return;
    const s = getSocket();
    if (!s) return;

    const room = `group:${groupId}`;
    const join = () => s.emit('joinRoom', { room });
    join();
    s.on('connect', join);

    const onNewMessage = (raw: any) => {
      if (raw?.groupId && raw.groupId !== groupId) return;
      const msg = mapMessage(raw);
      qc.setQueryData<InfiniteData<MessagePage>>(chatMessagesKey(groupId), (old) =>
        mergeIncomingMessage(old, msg),
      );
      // Refresh unread badges / last-message snippets in the sidebar.
      qc.invalidateQueries({ queryKey: chatGroupsKey });
    };

    const onMetadataUpdated = (payload: { messageId: string; metadata: any }) => {
      const { messageId, metadata } = payload;
      qc.setQueryData<InfiniteData<MessagePage>>(chatMessagesKey(groupId), (old) => {
        if (!old) return old;
        const pages = old.pages.map((page) =>
          page.map((m) => {
            if (m.id !== messageId) return m;
            return {
              ...m,
              reactions: metadata.reactions ?? m.reactions,
              poll: metadata.poll ?? m.poll,
            };
          }),
        );
        return { ...old, pages };
      });
    };

    const onMessageDeleted = (payload: { groupId: string; messageId: string }) => {
      if (payload.groupId !== groupId) return;
      qc.setQueryData<InfiniteData<MessagePage>>(chatMessagesKey(groupId), (old) => {
        if (!old) return old;
        return { ...old, pages: old.pages.map((page) => page.filter((m) => m.id !== payload.messageId)) };
      });
      // The deleted message may have been the sidebar's "last message" preview —
      // refresh it for every viewer, not just the admin who deleted it.
      qc.invalidateQueries({ queryKey: chatGroupsKey });
    };

    s.on('newChatMessage', onNewMessage);
    s.on('messageMetadataUpdated', onMetadataUpdated);
    s.on('messageDeleted', onMessageDeleted);
    return () => {
      s.off('newChatMessage', onNewMessage);
      s.off('messageMetadataUpdated', onMetadataUpdated);
      s.off('messageDeleted', onMessageDeleted);
      s.off('connect', join);
    };
  }, [groupId, qc]);
}

export interface RealtimeNotificationEvent {
  groupId: string;
  senderName: string;
  senderRole?: string;
  content: string;
  isPoll?: boolean;
}

export function useGlobalRealtimeNotifications(
  onNotif?: (evt: RealtimeNotificationEvent) => void,
) {
  const qc = useQueryClient();

  useEffect(() => {
    const s = getSocket();
    if (!s) return;

    const handleGlobalNotif = (payload: { groupId: string; message: any }) => {
      const { groupId, message } = payload;
      const mapped = mapMessage(message);

      qc.invalidateQueries({ queryKey: chatGroupsKey });

      qc.setQueryData<InfiniteData<MessagePage>>(chatMessagesKey(groupId), (old) => {
        if (!old) return old;
        return mergeIncomingMessage(old, mapped);
      });

      if (onNotif) {
        onNotif({
          groupId,
          senderName: mapped.senderName,
          senderRole: mapped.senderRole,
          content: mapped.content || (mapped.poll ? `Poll: ${mapped.poll.question}` : 'Attached document'),
          isPoll: !!mapped.poll,
        });
      }
    };

    s.on('globalGroupNotification', handleGlobalNotif);
    return () => {
      s.off('globalGroupNotification', handleGlobalNotif);
    };
  }, [qc, onNotif]);
}

export interface CommunityLifecycleEvent {
  type: 'groupCreated' | 'groupUpdated' | 'groupDeleted' | 'memberBlockStatusChanged' | 'memberRemoved';
  groupId: string;
  userId?: string;
  isBlocked?: boolean;
}

/**
 * Keeps the group list, admin roster, and open thread in sync with moderation
 * actions taken elsewhere: another admin creating/renaming/locking/deleting a
 * group, or blocking/removing a member — none of which touch the message
 * stream, so useGroupRealtime/useGlobalRealtimeNotifications never see them.
 * Independent of which group (if any) is currently open, since a sidebar
 * update or a group disappearing has to reach every connected client.
 */
export function useCommunityRealtimeSync(onEvent?: (evt: CommunityLifecycleEvent) => void) {
  const qc = useQueryClient();

  useEffect(() => {
    const s = getSocket();
    if (!s) return;

    const refreshGroupLists = () => {
      qc.invalidateQueries({ queryKey: chatGroupsKey });
      qc.invalidateQueries({ queryKey: ['chat-groups-admin'] });
    };
    const refreshRoster = (groupId: string) => {
      qc.invalidateQueries({ queryKey: ['chat-group-members', groupId] });
    };

    const onGroupCreated = () => refreshGroupLists();
    const onGroupUpdated = () => refreshGroupLists();
    const onGroupDeleted = (payload: { groupId: string }) => {
      refreshGroupLists();
      onEvent?.({ type: 'groupDeleted', groupId: payload.groupId });
    };
    const onMemberBlockStatusChanged = (payload: { groupId: string; userId: string; isBlocked: boolean }) => {
      refreshGroupLists();
      refreshRoster(payload.groupId);
      onEvent?.({ type: 'memberBlockStatusChanged', ...payload });
    };
    const onMemberRemoved = (payload: { groupId: string; userId: string }) => {
      refreshGroupLists();
      refreshRoster(payload.groupId);
      onEvent?.({ type: 'memberRemoved', ...payload });
    };

    s.on('groupCreated', onGroupCreated);
    s.on('groupUpdated', onGroupUpdated);
    s.on('groupDeleted', onGroupDeleted);
    s.on('memberBlockStatusChanged', onMemberBlockStatusChanged);
    s.on('memberRemoved', onMemberRemoved);
    return () => {
      s.off('groupCreated', onGroupCreated);
      s.off('groupUpdated', onGroupUpdated);
      s.off('groupDeleted', onGroupDeleted);
      s.off('memberBlockStatusChanged', onMemberBlockStatusChanged);
      s.off('memberRemoved', onMemberRemoved);
    };
  }, [qc, onEvent]);
}

/**
 * Warms the cache for groups the user is most likely to open next, so selecting
 * one renders from cache instead of waiting on a request.
 */
export function prefetchGroupMessages(qc: QueryClient, groupId: string) {
  return qc.prefetchInfiniteQuery({
    queryKey: chatMessagesKey(groupId),
    initialPageParam: undefined as string | undefined,
    queryFn: async () =>
      (await ApiClient.getGroupMessages(groupId, { limit: MESSAGE_PAGE_SIZE })).map(mapMessage),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePrefetchGroupMessages() {
  const qc = useQueryClient();
  return (groupId: string) => {
    if (!groupId) return;
    if (qc.getQueryData(chatMessagesKey(groupId))) return; // already cached
    void prefetchGroupMessages(qc, groupId);
  };
}

/**
 * Shared optimistic patcher for the cached group list, so membership/pin
 * buttons flip on click instead of after a POST + refetch round trip.
 */
function useOptimisticGroupMutation<TVars extends string>(
  mutationFn: (groupId: TVars) => Promise<unknown>,
  patch: (group: CommunityGroup) => CommunityGroup,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: async (groupId: TVars) => {
      await qc.cancelQueries({ queryKey: chatGroupsKey });
      const previous = qc.getQueryData<CommunityGroup[]>(chatGroupsKey);
      qc.setQueryData<CommunityGroup[]>(chatGroupsKey, (old) =>
        old?.map((g) => (g.id === groupId ? patch(g) : g)),
      );
      return { previous };
    },
    onError: (_e, _v, ctx: any) => {
      if (ctx?.previous) qc.setQueryData(chatGroupsKey, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: chatGroupsKey }),
  });
}

export function useJoinGroup() {
  return useOptimisticGroupMutation(
    (groupId: string) => ApiClient.joinGroup(groupId),
    (g) => ({ ...g, isJoined: true, memberCount: g.memberCount + 1 }),
  );
}

export function useLeaveGroup() {
  return useOptimisticGroupMutation(
    (groupId: string) => ApiClient.leaveGroup(groupId),
    (g) => ({ ...g, isJoined: false, memberCount: Math.max(0, g.memberCount - 1) }),
  );
}

export function usePinGroup() {
  return useOptimisticGroupMutation(
    (groupId: string) => ApiClient.pinGroup(groupId),
    (g) => ({ ...g, isPinned: true }),
  );
}

export function useUnpinGroup() {
  return useOptimisticGroupMutation(
    (groupId: string) => ApiClient.unpinGroup(groupId),
    (g) => ({ ...g, isPinned: false }),
  );
}

export interface OptimisticSender {
  id: string;
  name: string;
  avatarUrl?: string | null;
  role?: 'Admin' | 'Moderator' | 'Student';
}

/**
 * Sends a message and paints it in the thread immediately, reconciling with the
 * server's copy once the request lands (and rolling back if it fails).
 */
export function useSendMessage(groupId: string, sender?: OptimisticSender) {
  const qc = useQueryClient();
  const key = chatMessagesKey(groupId);

  return useMutation({
    mutationFn: (payload: {
      content: string;
      messageType?: ChatMessageType;
      mediaUrl?: string;
      metadata?: Record<string, any>;
    }) => ApiClient.sendGroupMessage(groupId, payload),

    onMutate: async (payload) => {
      if (!groupId || !sender) return {};
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<InfiniteData<MessagePage>>(key);
      const tempId = `optimistic-${Date.now()}`;
      const metadata = payload.metadata || {};
      const optimistic: DiscussionMessage = {
        id: tempId,
        groupId,
        senderId: sender.id,
        senderName: sender.name,
        senderAvatar: sender.avatarUrl,
        senderRole: sender.role || 'Student',
        content: payload.content,
        createdAt: new Date().toISOString(),
        isPinned: metadata.isPinned,
        isAnnouncement: metadata.isAnnouncement,
        attachments: metadata.attachments,
        poll: metadata.poll,
        reactions: metadata.reactions || [],
        replyTo: metadata.replyTo,
      };
      qc.setQueryData<InfiniteData<MessagePage>>(key, (old) => {
        if (!old) return old;
        const pages = [...old.pages];
        pages[0] = [...pages[0], optimistic];
        return { ...old, pages };
      });
      return { previous, tempId };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },

    onSuccess: (saved) => {
      // Same reconciliation the socket uses, so whichever arrives first wins and
      // the other becomes a no-op instead of a duplicate bubble.
      const real = mapMessage(saved);
      qc.setQueryData<InfiniteData<MessagePage>>(key, (old) => mergeIncomingMessage(old, real));
      qc.invalidateQueries({ queryKey: chatGroupsKey });
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

/**
 * Reactions and poll votes. Applied to the cache immediately so a vote fills in
 * on click instead of after the round trip plus a refetch.
 */
export function useUpdateMessageMetadata(groupId: string) {
  const qc = useQueryClient();
  const key = chatMessagesKey(groupId);

  return useMutation({
    mutationFn: async ({ messageId, metadata }: { messageId: string; metadata: Record<string, any> }) => {
      if (!messageId || messageId.startsWith('optimistic-') || messageId.startsWith('temp-')) {
        return null;
      }
      try {
        return await ApiClient.updateMessageMetadata(messageId, metadata);
      } catch (err) {
        console.warn('Failed to update message metadata on backend:', err);
        return null;
      }
    },

    onMutate: async ({ messageId, metadata }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<InfiniteData<MessagePage>>(key);
      qc.setQueryData<InfiniteData<MessagePage>>(key, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((p) =>
            p.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    ...(metadata.poll ? { poll: metadata.poll } : {}),
                    ...(metadata.reactions ? { reactions: metadata.reactions } : {}),
                  }
                : m,
            ),
          ),
        };
      });
      return { previous };
    },

    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
  });
}

/**
 * Deletes a message from a group. Admins/staff-with-manageChat can delete any
 * message, not just their own — removed from the cache immediately, with a
 * socket broadcast (see useGroupRealtime) keeping every other open viewer in sync.
 */
export function useDeleteMessage(groupId: string) {
  const qc = useQueryClient();
  const key = chatMessagesKey(groupId);

  return useMutation({
    mutationFn: (messageId: string) => ApiClient.deleteMessage(messageId),

    onMutate: async (messageId: string) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<InfiniteData<MessagePage>>(key);
      qc.setQueryData<InfiniteData<MessagePage>>(key, (old) => {
        if (!old) return old;
        return { ...old, pages: old.pages.map((page) => page.filter((m) => m.id !== messageId)) };
      });
      return { previous };
    },

    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },

    onSuccess: () => qc.invalidateQueries({ queryKey: chatGroupsKey }),
  });
}

/* ── Admin hooks ──────────────────────────────────────────── */

export interface AdminGroup {
  id: string;
  name: string;
  description: string;
  category: string;
  iconEmoji: string;
  imageUrl?: string | null;
  coverGradient: string;
  isLocked: boolean;
  allowTextMessages: boolean;
  allowPolls: boolean;
  memberCount: number;
}

export interface GroupMemberWithUser {
  id: string;
  groupId: string;
  userId: string;
  role: string;
  isBlocked: boolean;
  blockedAt?: string | null;
  joinedAt: string;
  user: { id: string; name: string; email: string; avatarUrl?: string | null; role: string };
}

export type MemberStatusFilter = 'ALL' | 'ACTIVE' | 'BLOCKED';

export interface GroupMemberPage {
  items: GroupMemberWithUser[];
  total: number;
  blockedCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Roster page size — groups can hold tens of thousands of members. */
export const MEMBER_PAGE_SIZE = 20;

function mapAdminGroup(g: any): AdminGroup {
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    category: g.category,
    iconEmoji: g.iconEmoji,
    imageUrl: g.imageUrl ?? null,
    coverGradient: g.coverGradient,
    isLocked: g.isLocked,
    allowTextMessages: g.allowTextMessages ?? true,
    allowPolls: g.allowPolls ?? true,
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
    mutationFn: (payload: { name: string; description: string; category: string; iconEmoji?: string }) =>
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
    mutationFn: ({ groupId, payload }: { groupId: string; payload: Partial<{ name: string; description: string; category: string; iconEmoji: string; imageUrl: string }> }) =>
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

/**
 * Flips one of the per-group student permissions. Applied optimistically so the
 * admin toggle responds on click instead of after the round trip.
 */
export function useUploadGroupImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, file }: { groupId: string; file: File }) =>
      ApiClient.uploadGroupImage(groupId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-groups-admin'] });
      qc.invalidateQueries({ queryKey: chatGroupsKey });
    },
  });
}

export function useToggleGroupFeature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      groupId,
      feature,
      enabled,
    }: {
      groupId: string;
      feature: 'allowTextMessages' | 'allowPolls';
      enabled: boolean;
    }) => ApiClient.updateChatGroup(groupId, { [feature]: enabled }),
    onMutate: async ({ groupId, feature, enabled }) => {
      await qc.cancelQueries({ queryKey: ['chat-groups-admin'] });
      const previous = qc.getQueryData<AdminGroup[]>(['chat-groups-admin']);
      qc.setQueryData<AdminGroup[]>(['chat-groups-admin'], (old) =>
        old?.map((g) => (g.id === groupId ? { ...g, [feature]: enabled } : g)),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(['chat-groups-admin'], ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['chat-groups-admin'] });
      qc.invalidateQueries({ queryKey: chatGroupsKey });
    },
  });
}

/**
 * Searching and paging happen on the server: a group can have 30k+ members, so
 * the roster never loads them all to filter client-side.
 */
export function useGroupMembers(
  groupId: string | null,
  opts: { search?: string; page?: number; status?: MemberStatusFilter } = {},
) {
  const { search = '', page = 1, status = 'ALL' } = opts;
  return useQuery({
    queryKey: ['chat-group-members', groupId, search, page, status],
    queryFn: () =>
      ApiClient.getGroupMembers(groupId as string, {
        search: search || undefined,
        page,
        limit: MEMBER_PAGE_SIZE,
        status,
      }) as Promise<GroupMemberPage>,
    enabled: !!groupId,
    // Keeps the previous page on screen while the next one loads, so typing in
    // the search box doesn't flash an empty roster on every keystroke.
    placeholderData: (previous) => previous,
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

/** Blocks/unblocks a member — a blocked student stops seeing the group entirely. */
export function useSetGroupMemberBlocked(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, blocked }: { userId: string; blocked: boolean }) =>
      blocked ? ApiClient.blockGroupMember(groupId, userId) : ApiClient.unblockGroupMember(groupId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-group-members', groupId] });
      qc.invalidateQueries({ queryKey: ['chat-groups-admin'] });
      qc.invalidateQueries({ queryKey: chatGroupsKey });
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
