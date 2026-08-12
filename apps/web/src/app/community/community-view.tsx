'use client';

import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button, ConfirmDialog } from '@psc/ui';
import {
  Users,
  Search,
  ArrowLeft,
  CheckCircle2,
  Send,
  Pin,
  PinOff,
  Paperclip,
  FileText,
  FileAudio,
  FileImage,
  BarChart2,
  Smile,
  X,
  Reply,
  UserPlus,
  LogOut,
  Check,
  Clock,
  Table,
  FileCode,
  File,
  Download,
  CheckCircle,
  Sparkles,
  AlertCircle,
  Plus,
  Trash2,
  ChevronDown,
  Loader2,
  RotateCw,
  Lock,
  Bell,
  BellOff,
  MoreVertical,
  Eye,
  Maximize2,
} from 'lucide-react';
import {
  useChatGroups,
  useGroupMessages,
  useGroupRealtime,
  useGlobalRealtimeNotifications,
  useCommunityRealtimeSync,
  CommunityLifecycleEvent,
  usePrefetchGroupMessages,
  useJoinGroup,
  useLeaveGroup,
  usePinGroup,
  useUnpinGroup,
  useSendMessage,
  useMarkRead,
  useUpdateMessageMetadata,
  useDeleteMessage,
  ReplyPreview,
  Attachment,
  DiscussionMessage,
  MessagePage,
  flattenMessages,
  mapMessage,
  mergeIncomingMessage,
  MAX_PINS,
  RealtimeNotificationEvent,
  chatGroupsKey,
  chatMessagesKey,
} from './community-data';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useAuth } from '../auth-provider';
import { CommunitySkeleton, GroupRowSkeleton, BubbleSkeleton } from './community-skeleton';
import { GroupAvatar } from './group-avatar';
import { ApiClient } from '@/lib/api-client';

interface CommunityViewProps {
  initialGroupId?: string;
}

const EMOJI_LIST = [
  '👍', '❤️', '😂', '😮', '😢', '👏', '🔥', '💡',
  '📚', '✍️', '🎯', '🏆', '✅', '🧠', '💯', '📌',
  '🚀', '⭐', '🎉', '💪', '🙏', '🙌', '❓', '❗',
];

export function CommunityView({ initialGroupId }: CommunityViewProps) {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: groups = [], isLoading: groupsLoading } = useChatGroups();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId || null);
  const {
    messages,
    isLoading: messagesLoading,
    hasOlder,
    isLoadingOlder,
    loadOlder,
  } = useGroupMessages(selectedGroupId);

  // Three-Dot Header Menu State
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  /** Which sidebar row's chevron dropdown (Mute/Pin) is currently open, if any. */
  const [openRowMenuGroupId, setOpenRowMenuGroupId] = useState<string | null>(null);

  // In-App Document & Image Viewer Modal State
  const [activePreview, setActivePreview] = useState<{
    name: string;
    url: string;
    type: 'image' | 'pdf' | 'other';
    size?: string;
  } | null>(null);

  // Mute / Unmute Group Notifications State (Persisted per User)
  const [mutedGroupIds, setMutedGroupIds] = useState<string[]>(() => {
    if (typeof window === 'undefined' || !user?.id) return [];
    try {
      const saved = localStorage.getItem(`psc_muted_groups_${user.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleMuteGroup = (groupId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setMutedGroupIds((prev) => {
      const isMuted = prev.includes(groupId);
      const next = isMuted ? prev.filter((id) => id !== groupId) : [...prev, groupId];
      try {
        if (user?.id) {
          localStorage.setItem(`psc_muted_groups_${user.id}`, JSON.stringify(next));
        }
      } catch {}
      return next;
    });
  };

  // Close header menu on click outside or group change
  useEffect(() => {
    setShowGroupMenu(false);
    setOpenRowMenuGroupId(null);
  }, [selectedGroupId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowGroupMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close a sidebar row's chevron menu on an outside click or Escape. Scoped
  // by `data-row-menu` rather than a per-row ref, since rows are generated
  // from a `.map()` and don't each get a stable ref of their own.
  useEffect(() => {
    if (!openRowMenuGroupId) return;
    const handleClickOutsideRowMenu = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-row-menu]')) {
        setOpenRowMenuGroupId(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenRowMenuGroupId(null);
    };
    document.addEventListener('mousedown', handleClickOutsideRowMenu);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideRowMenu);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openRowMenuGroupId]);

  // Realtime Socket for active group & metadata
  useGroupRealtime(selectedGroupId);

  // Global Realtime Notifications for Admin messages across all groups
  const [realtimeToast, setRealtimeToast] = useState<{
    groupId: string;
    groupName: string;
    senderName: string;
    content: string;
    isAdmin: boolean;
  } | null>(null);

  const handleGlobalNotif = useCallback(
    (evt: RealtimeNotificationEvent) => {
      if (user && evt.senderName === user.name) return;
      if (mutedGroupIds.includes(evt.groupId)) return;

      const group = groups.find((g) => g.id === evt.groupId);
      // The server already scopes this event to the group's active members,
      // but a stale/not-yet-loaded local group list must not surface a toast
      // for a group this session doesn't (yet) show as joined — moderators
      // are the one exception, since they can act on any group.
      const isModerator = user?.role === 'ADMIN' || user?.role === 'STAFF';
      if (!group || !(group.isJoined || isModerator)) return;

      setRealtimeToast({
        groupId: evt.groupId,
        groupName: group.name,
        senderName: evt.senderName,
        content: evt.content,
        isAdmin: evt.senderRole === 'Admin',
      });
    },
    [groups, user, mutedGroupIds],
  );

  useGlobalRealtimeNotifications(handleGlobalNotif);

  useEffect(() => {
    if (!realtimeToast) return;
    const t = setTimeout(() => setRealtimeToast(null), 4500);
    return () => clearTimeout(t);
  }, [realtimeToast]);

  const prefetchMessages = usePrefetchGroupMessages();

  const joinMutation = useJoinGroup();
  const leaveMutation = useLeaveGroup();
  const pinMutation = usePinGroup();
  const unpinMutation = useUnpinGroup();
  const sendMutation = useSendMessage(
    selectedGroupId || '',
    user ? { id: user.id, name: user.name, avatarUrl: user.avatarUrl } : undefined,
  );
  const markReadMutation = useMarkRead(selectedGroupId || '');
  const metadataMutation = useUpdateMessageMetadata(selectedGroupId || '');
  const deleteMessageMutation = useDeleteMessage(selectedGroupId || '');

  /* Background Attachment Uploader Helper */
  const updateAttachmentProgressInCache = useCallback(
    (
      groupId: string,
      messageId: string,
      attIndex: number,
      updates: Partial<Attachment>,
    ) => {
      const key = chatMessagesKey(groupId);
      qc.setQueryData<InfiniteData<MessagePage>>(key, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((p) =>
            p.map((m) => {
              if (m.id !== messageId || !m.attachments) return m;
              const updatedAtts = [...m.attachments];
              if (updatedAtts[attIndex]) {
                updatedAtts[attIndex] = { ...updatedAtts[attIndex], ...updates };
              }
              return { ...m, attachments: updatedAtts };
            }),
          ),
        };
      });
    },
    [qc],
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [newMessage, setNewMessage] = useState('');

  /* Poll Composer State */
  const [showPollComposer, setShowPollComposer] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<{ id: string; text: string }[]>([
    { id: 'opt-1', text: '' },
    { id: 'opt-2', text: '' },
  ]);
  const [correctOptionId, setCorrectOptionId] = useState<string | null>('opt-1');

  /* Admin File Attachments State */
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Emoji Picker & Reaction Popovers */
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);

  /* Join Group Loading Tracker */
  const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null);

  const [replyingTo, setReplyingTo] = useState<ReplyPreview | null>(null);
  const [deleteTargetMsgId, setDeleteTargetMsgId] = useState<string | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(!!initialGroupId);
  const [mounted, setMounted] = useState(false);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const [pinToast, setPinToast] = useState<string | null>(null);

  /* Real-time Moderation Sync: group create/rename/lock/delete + member
     block/remove, none of which touch the message stream. If the group the
     user currently has open is the one affected, boot them out immediately
     instead of leaving them typing into a group they've lost. */
  const handleCommunityLifecycleEvent = useCallback(
    (evt: CommunityLifecycleEvent) => {
      if (evt.groupId !== selectedGroupId) return;
      if (evt.type === 'groupDeleted') {
        setSelectedGroupId(null);
        setMobileShowChat(false);
        setPinToast('This study circle was deleted by an admin');
      } else if (evt.type === 'memberBlockStatusChanged' && evt.isBlocked && evt.userId === user?.id) {
        setSelectedGroupId(null);
        setMobileShowChat(false);
        setPinToast('You have been blocked from this group by an admin');
      } else if (evt.type === 'memberRemoved' && evt.userId === user?.id) {
        setSelectedGroupId(null);
        setMobileShowChat(false);
        setPinToast('You have been removed from this group');
      }
    },
    [selectedGroupId, user],
  );
  useCommunityRealtimeSync(handleCommunityLifecycleEvent);

  /* Scroll Preservation Refs & State */
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const markReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isUserNearBottomRef = useRef(true);
  const prevScrollHeightRef = useRef<number | null>(null);
  const prevFirstMsgIdRef = useRef<string | null>(null);
  const prevSelectedGroupIdRef = useRef<string | null>(null);
  const prevMessagesLengthRef = useRef<number>(0);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  /* ── Mount Guard ── */
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !authLoading && !user) {
      router.replace('/login?redirect=/community');
    }
  }, [mounted, user, authLoading, router]);

  /* ── Default select group ── */
  useEffect(() => {
    if (initialGroupId) {
      setSelectedGroupId(initialGroupId);
      setMobileShowChat(true);
    } else if (!selectedGroupId && groups.length > 0) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups, selectedGroupId, initialGroupId]);

  /* ── Cache Warmup ── */
  useEffect(() => {
    if (groups.length === 0) return;
    const priority = [...groups]
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.unreadCount - a.unreadCount)
      .slice(0, 5);
    priority.forEach((g) => prefetchMessages(g.id));
  }, [groups, prefetchMessages]);

  // `useMutation`'s result OBJECT gets a new identity on every render (its
  // `.mutate` function does not) — this is the piece that has to go in a
  // dependency array below. Depending on the whole object instead used to
  // retrigger the effect on every single render it caused, which in turn
  // called `setQueryData`/`mutate` and caused another render: an infinite
  // loop that hammered `/chat/groups/mine` and the mark-read endpoint
  // continuously, and — because every one of those cache writes raced with
  // the real realtime update — was also *why* incoming messages elsewhere
  // never visibly moved the unread badge.
  const markRead = markReadMutation.mutate;

  /* ── Instant Auto Mark-As-Read & Badge Clear ── */
  useEffect(() => {
    if (!selectedGroupId) return;

    qc.setQueryData<any[]>(chatGroupsKey, (old) => {
      if (!old) return old;
      const target = old.find((g) => g.id === selectedGroupId);
      // Returning the same reference when nothing actually changes avoids
      // notifying subscribers (and re-rendering) for a no-op update.
      if (!target || target.unreadCount === 0) return old;
      return old.map((g) => (g.id === selectedGroupId ? { ...g, unreadCount: 0 } : g));
    });

    if (messages.length === 0) return;
    const lastMsgId = messages[messages.length - 1].id;
    if (!lastMsgId || lastMsgId.startsWith('optimistic-') || lastMsgId.startsWith('temp-')) return;

    if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
    markReadTimerRef.current = setTimeout(() => {
      markRead(lastMsgId);
    }, 400);

    return () => {
      if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
    };
  }, [selectedGroupId, messages, markRead, qc]);

  /* ── Scroll Position Preservation Logic ── */
  const handleChatScroll = () => {
    const container = chatContainerRef.current;
    if (!container) return;

    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const isNearBottom = distanceToBottom < 140;
    isUserNearBottomRef.current = isNearBottom;
    setShowScrollBottomBtn(!isNearBottom);
  };

  useLayoutEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const isGroupChanged = prevSelectedGroupIdRef.current !== selectedGroupId;
    prevSelectedGroupIdRef.current = selectedGroupId;

    if (isGroupChanged) {
      container.scrollTop = container.scrollHeight;
      isUserNearBottomRef.current = true;
      setShowScrollBottomBtn(false);
      prevScrollHeightRef.current = container.scrollHeight;
      prevFirstMsgIdRef.current = messages[0]?.id || null;
      prevMessagesLengthRef.current = messages.length;
      return;
    }

    const messagesDiff = messages.length - prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = messages.length;

    if (messagesDiff > 0) {
      const currentFirstMsgId = messages[0]?.id || null;
      const isOlderPrepended =
        prevFirstMsgIdRef.current &&
        currentFirstMsgId &&
        currentFirstMsgId !== prevFirstMsgIdRef.current;

      prevFirstMsgIdRef.current = currentFirstMsgId;

      if (isOlderPrepended && prevScrollHeightRef.current !== null) {
        const scrollHeightDiff = container.scrollHeight - prevScrollHeightRef.current;
        container.scrollTop = container.scrollTop + scrollHeightDiff;
        prevScrollHeightRef.current = container.scrollHeight;
        return;
      }

      const lastMsg = messages[messages.length - 1];
      const isSentByMe = lastMsg && user && lastMsg.senderId === user.id;

      if (isUserNearBottomRef.current || isSentByMe) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        isUserNearBottomRef.current = true;
        setShowScrollBottomBtn(false);
      } else {
        setShowScrollBottomBtn(true);
      }
    }

    prevScrollHeightRef.current = container.scrollHeight;
  }, [messages, selectedGroupId, user]);

  const scrollToBottom = () => {
    const container = chatContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      isUserNearBottomRef.current = true;
      setShowScrollBottomBtn(false);
    }
  };

  /* ── Toast dismiss ── */
  useEffect(() => {
    if (!pinToast) return;
    const t = setTimeout(() => setPinToast(null), 2500);
    return () => clearTimeout(t);
  }, [pinToast]);

  // A resize/orientation change reflows wrapped text to a different number of
  // lines, so a height computed at the old width can clip content — recompute
  // for every open poll textarea whenever the viewport changes.
  useEffect(() => {
    if (!showPollComposer) return;
    const handleViewportResize = () => {
      document.querySelectorAll<HTMLTextAreaElement>('textarea[data-autogrow="poll"]').forEach((el) => {
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
      });
    };
    window.addEventListener('resize', handleViewportResize);
    return () => window.removeEventListener('resize', handleViewportResize);
  }, [showPollComposer]);

  if (!mounted || authLoading || !user) return <CommunitySkeleton />;

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || null;

  /* Admin is automatically considered a member of every group! */
  const isUserMember = (selectedGroup?.isJoined ?? false) || isAdmin;

  /* Blocked / Locked group restrictions apply ONLY to regular students, NOT to Admin! */
  const isLockedForUser = (selectedGroup?.isLocked ?? false) && !isAdmin;

  const isModerator = user.role === 'ADMIN' || user.role === 'STAFF';
  const canSendText = !!selectedGroup && (selectedGroup.allowTextMessages || isModerator);
  const canPostPolls = !!selectedGroup && (selectedGroup.allowPolls || isModerator);
  const isSending = sendMutation.isPending;
  // Scoped per group rather than one shared flag — otherwise pinning Group A
  // would leave every other group's pin button disabled for the duration of
  // that one request.
  const isPinBusyFor = (groupId: string) =>
    (pinMutation.isPending && pinMutation.variables === groupId) ||
    (unpinMutation.isPending && unpinMutation.variables === groupId);

  const categories = ['All', 'Joined', 'Kerala PSC', 'SSC & UPSC', 'Subject Wise'];

  /* ── Handlers ── */
  const handleSelectGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    setMobileShowChat(true);
    setReplyingTo(null);
    setShowPollComposer(false);
    setShowEmojiPicker(false);
    setActiveReactionMsgId(null);

    qc.setQueryData<any[]>(chatGroupsKey, (old) =>
      old?.map((g) => (g.id === groupId ? { ...g, unreadCount: 0 } : g)),
    );
  };

  const handleTogglePin = async (groupId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const group = groups.find((g) => g.id === groupId);
    const isMember = group?.isJoined || isAdmin;
    if (!isMember) {
      setPinToast('Join the study circle first before pinning');
      return;
    }
    try {
      if (group?.isPinned) {
        await unpinMutation.mutateAsync(groupId);
      } else {
        await pinMutation.mutateAsync(groupId);
      }
    } catch (err: any) {
      setPinToast(err?.message || `You can only pin up to ${MAX_PINS} chats`);
    }
  };

  const handleToggleJoin = async (groupId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const group = groups.find((g) => g.id === groupId);
    setJoiningGroupId(groupId);
    try {
      if (group?.isJoined) {
        await leaveMutation.mutateAsync(groupId);
      } else {
        await joinMutation.mutateAsync(groupId);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to update membership');
    } finally {
      setJoiningGroupId(null);
    }
  };



  const uploadAndPostAttachmentMessage = async (
    groupId: string,
    content: string,
    replyTo?: ReplyPreview,
    attachmentsToProcess?: Attachment[],
  ) => {
    if (!attachmentsToProcess || attachmentsToProcess.length === 0 || !user) return;

    const tempId = `optimistic-${Date.now()}`;
    const initialAttachments: Attachment[] = attachmentsToProcess.map((att) => ({
      ...att,
      uploadStatus: 'uploading',
      uploadProgress: 0,
    }));

    const optimisticMsg: DiscussionMessage = {
      id: tempId,
      groupId,
      senderId: user.id,
      senderName: user.name,
      senderAvatar: user.avatarUrl,
      senderRole: (user.role === 'ADMIN' ? 'Admin' : user.role === 'STAFF' ? 'Moderator' : 'Student'),
      content: content || `Attached ${attachmentsToProcess.length} document(s)`,
      createdAt: new Date().toISOString(),
      attachments: initialAttachments,
      reactions: [],
      replyTo,
    };

    // 1. Immediately insert optimistic post into timeline
    const key = chatMessagesKey(groupId);
    qc.setQueryData<InfiniteData<MessagePage>>(key, (old) => {
      if (!old) return old;
      const pages = [...old.pages];
      pages[0] = [...pages[0], optimisticMsg];
      return { ...old, pages };
    });

    // 2. Scroll to bottom right away so user sees instant feedback
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    }, 50);

    // 3. Upload each file in background with real-time XHR progress callbacks
    const uploadedResults: (Attachment | null)[] = await Promise.all(
      attachmentsToProcess.map(async (att, idx) => {
        if (!att.file) {
          return att;
        }
        try {
          const res = await ApiClient.uploadChatAttachmentWithProgress(att.file, (pct) => {
            updateAttachmentProgressInCache(groupId, tempId, idx, {
              uploadStatus: 'uploading',
              uploadProgress: pct,
            });
          });
          const completedAtt: Attachment = {
            name: res.name,
            url: res.url,
            type: res.type,
            size: res.size,
            file: att.file,
            uploadStatus: 'completed',
            uploadProgress: 100,
          };
          updateAttachmentProgressInCache(groupId, tempId, idx, completedAtt);
          return completedAtt;
        } catch (err: any) {
          updateAttachmentProgressInCache(groupId, tempId, idx, {
            uploadStatus: 'error',
            uploadError: err?.message || 'Upload failed',
          });
          return null;
        }
      }),
    );

    const successfulAtts = uploadedResults.filter((a): a is Attachment => a !== null && !!a.url);

    // Marks the still-optimistic bubble as failed instead of leaving it spinning
    // forever — the per-attachment error badges explain which file broke, but the
    // message-level tick needs its own signal since the post never actually saved.
    const markMessageFailed = () => {
      qc.setQueryData<InfiniteData<MessagePage>>(key, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((p) => p.map((m) => (m.id === tempId ? { ...m, sendFailed: true } : m))),
        };
      });
    };

    // 4. Reconcile post with backend once uploads finish
    if (successfulAtts.length === attachmentsToProcess.length) {
      try {
        const saved = await ApiClient.sendGroupMessage(groupId, {
          content: content || `Attached ${successfulAtts.length} document(s)`,
          metadata: {
            replyTo,
            attachments: successfulAtts.map(({ file, uploadStatus, uploadProgress, uploadError, ...rest }) => rest),
          },
        });
        const real = mapMessage(saved);
        qc.setQueryData<InfiniteData<MessagePage>>(key, (old) => mergeIncomingMessage(old, real));
        qc.invalidateQueries({ queryKey: ['chat-groups'] });
      } catch (err: any) {
        console.error('Failed to post message after upload:', err);
        markMessageFailed();
      }
    } else {
      // At least one file never finished uploading — nothing was posted. The
      // per-attachment "Retry" button can still recover it (see handleRetryUpload).
      markMessageFailed();
    }
  };

  const handleRetryUpload = async (messageId: string, attIndex: number) => {
    if (!selectedGroupId || !user) return;
    const key = chatMessagesKey(selectedGroupId);
    const cachedData = qc.getQueryData<InfiniteData<MessagePage>>(key);
    const msg = flattenMessages(cachedData).find((m) => m.id === messageId);
    if (!msg || !msg.attachments || !msg.attachments[attIndex]) return;

    const targetAtt = msg.attachments[attIndex];
    if (!targetAtt.file) return;

    updateAttachmentProgressInCache(selectedGroupId, messageId, attIndex, {
      uploadStatus: 'uploading',
      uploadProgress: 0,
      uploadError: undefined,
    });

    try {
      const res = await ApiClient.uploadChatAttachmentWithProgress(targetAtt.file, (pct) => {
        updateAttachmentProgressInCache(selectedGroupId, messageId, attIndex, {
          uploadStatus: 'uploading',
          uploadProgress: pct,
        });
      });

      const completedAtt: Attachment = {
        name: res.name,
        url: res.url,
        type: res.type,
        size: res.size,
        file: targetAtt.file,
        uploadStatus: 'completed',
        uploadProgress: 100,
      };
      updateAttachmentProgressInCache(selectedGroupId, messageId, attIndex, completedAtt);

      const updatedData = qc.getQueryData<InfiniteData<MessagePage>>(key);
      const updatedMsg = flattenMessages(updatedData).find((m) => m.id === messageId);
      if (
        updatedMsg &&
        updatedMsg.attachments &&
        updatedMsg.attachments.every((a) => a.uploadStatus === 'completed' && a.url)
      ) {
        const saved = await ApiClient.sendGroupMessage(selectedGroupId, {
          content: updatedMsg.content,
          metadata: {
            replyTo: updatedMsg.replyTo,
            attachments: updatedMsg.attachments.map(({ file, uploadStatus, uploadProgress, uploadError, ...rest }) => rest),
          },
        });
        const real = mapMessage(saved);
        qc.setQueryData<InfiniteData<MessagePage>>(key, (old) => mergeIncomingMessage(old, real));
        qc.invalidateQueries({ queryKey: ['chat-groups'] });
      }
    } catch (err: any) {
      updateAttachmentProgressInCache(selectedGroupId, messageId, attIndex, {
        uploadStatus: 'error',
        uploadError: err?.message || 'Upload failed',
      });
    }
  };

  /* Instant Send Message Flow */
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && pendingAttachments.length === 0) return;
    if (!selectedGroup || !isUserMember || isLockedForUser || !selectedGroupId) return;

    const msgContent = newMessage.trim();
    const attachmentsToSend = pendingAttachments.length > 0 ? [...pendingAttachments] : undefined;

    setNewMessage('');
    setPendingAttachments([]);
    setReplyingTo(null);
    setShowEmojiPicker(false);

    if (attachmentsToSend && attachmentsToSend.length > 0) {
      uploadAndPostAttachmentMessage(selectedGroupId, msgContent, replyingTo || undefined, attachmentsToSend);
      return;
    }

    sendMutation.mutate({
      content: msgContent,
      metadata: {
        replyTo: replyingTo || undefined,
      },
    });
  };

  /* Instant Poll Creation Flow */
  /** Grows a textarea to fit its content so long questions/options are never clipped or scrolled. */
  const autoGrowTextarea = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const handleSubmitPoll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId || !isUserMember || isLockedForUser) return;
    const question = pollQuestion.trim();
    const validOptions = pollOptions.filter((o) => o.text.trim().length > 0);
    if (!question || validOptions.length < 2) return;

    const pollMetadata = {
      poll: {
        question,
        options: validOptions.map((opt, idx) => ({
          id: `opt-${idx + 1}`,
          text: opt.text.trim(),
          votes: 0,
          votedUserIds: [],
        })),
        totalVotes: 0,
        correctOptionId: correctOptionId
          ? `opt-${validOptions.findIndex((o) => o.id === correctOptionId) + 1}`
          : undefined,
      },
    };

    setPollQuestion('');
    setPollOptions([
      { id: 'opt-1', text: '' },
      { id: 'opt-2', text: '' },
    ]);
    setCorrectOptionId('opt-1');
    setShowPollComposer(false);

    sendMutation.mutate({
      content: question,
      metadata: pollMetadata,
    });
  };

  const handleAddPollOption = () => {
    if (pollOptions.length >= 6) return;
    const nextId = `opt-${Date.now()}`;
    setPollOptions((prev) => [...prev, { id: nextId, text: '' }]);
  };

  const handleRemovePollOption = (id: string) => {
    if (pollOptions.length <= 2) return;
    setPollOptions((prev) => prev.filter((o) => o.id !== id));
    if (correctOptionId === id) {
      const remaining = pollOptions.filter((o) => o.id !== id);
      setCorrectOptionId(remaining[0]?.id || null);
    }
  };

  /* Instant Admin File Attachment Selection */
  const handleAdminFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !isAdmin) return;

    const newPending: Attachment[] = Array.from(files).map((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'file';
      let type: 'pdf' | 'excel' | 'word' | 'image' | 'file' = 'file';
      if (ext === 'pdf') type = 'pdf';
      else if (['xls', 'xlsx', 'csv'].includes(ext)) type = 'excel';
      else if (['doc', 'docx'].includes(ext)) type = 'word';
      else if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) type = 'image';

      const formattedSize =
        file.size > 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.round(file.size / 1024)} KB`;

      return {
        file,
        name: file.name,
        type,
        size: formattedSize,
        url: '',
        uploadStatus: 'completed',
      };
    });

    setPendingAttachments((prev) => [...prev, ...newPending]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* Admin/Staff Moderation: Delete Any Message From Any Group */
  const handleDeleteMessage = (messageId: string) => {
    if (messageId.startsWith('optimistic-')) return;
    setDeleteTargetMsgId(messageId);
  };

  const handleConfirmDeleteMessage = () => {
    if (!deleteTargetMsgId) return;
    deleteMessageMutation.mutate(deleteTargetMsgId, {
      onError: (err: any) => alert(err?.message || 'Failed to delete message'),
    });
    setDeleteTargetMsgId(null);
  };

  /* Strictly 1 Emoji Reaction Per User Per Message */
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!isUserMember || isLockedForUser || !user) return;
    if (!messageId || messageId.startsWith('optimistic-') || messageId.startsWith('temp-')) return;
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;

    const currentReactionWithEmoji = msg.reactions.find(
      (r) => r.emoji === emoji && r.users.includes(user.id),
    );

    let updatedReactions = msg.reactions
      .map((r) => {
        const filteredUsers = r.users.filter((u) => u !== user.id);
        return {
          ...r,
          count: filteredUsers.length,
          users: filteredUsers,
        };
      })
      .filter((r) => r.count > 0);

    if (!currentReactionWithEmoji) {
      const existingEmojiIdx = updatedReactions.findIndex((r) => r.emoji === emoji);
      if (existingEmojiIdx >= 0) {
        updatedReactions[existingEmojiIdx] = {
          ...updatedReactions[existingEmojiIdx],
          count: updatedReactions[existingEmojiIdx].count + 1,
          users: [...updatedReactions[existingEmojiIdx].users, user.id],
        };
      } else {
        updatedReactions.push({ emoji, count: 1, users: [user.id] });
      }
    }

    try {
      await metadataMutation.mutateAsync({ messageId, metadata: { reactions: updatedReactions } });
    } catch (err) {
      console.warn('Failed to update reaction:', err);
    }
    setActiveReactionMsgId(null);
  };

  /* Participant Poll Voting Flow (Author Restricted) */
  const handleVotePoll = async (messageId: string, optionId: string) => {
    if (!isUserMember || isLockedForUser || !user) return;
    if (!messageId || messageId.startsWith('optimistic-') || messageId.startsWith('temp-')) return;
    const msg = messages.find((m) => m.id === messageId);
    if (!msg?.poll) return;

    // Disallow poll author from voting!
    if (msg.senderId === user.id) return;

    const alreadyVoted = msg.poll.options.some((opt) => opt.votedUserIds?.includes(user.id));
    if (alreadyVoted) return;

    const updatedOptions = msg.poll.options.map((opt) =>
      opt.id === optionId
        ? { ...opt, votes: opt.votes + 1, votedUserIds: [...(opt.votedUserIds || []), user.id] }
        : opt,
    );
    const updatedPoll = { ...msg.poll, options: updatedOptions, totalVotes: msg.poll.totalVotes + 1 };
    try {
      await metadataMutation.mutateAsync({ messageId, metadata: { poll: updatedPoll } });
    } catch (err) {
      console.warn('Failed to vote in poll:', err);
    }
  };

  /* Dynamic Group Sorting: Joined Groups ALWAYS on top, Unjoined below */
  const sortGroupsByRecentActivity = (a: any, b: any) => {
    const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
    const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
    return timeB - timeA;
  };

  const filteredGroups = groups.filter((group) => {
    const matchesSearch =
      group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.description.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (selectedCategory === 'All') return true;
    if (selectedCategory === 'Joined') return group.isJoined || isAdmin;
    return group.category === selectedCategory;
  });

  const pinnedFiltered = filteredGroups
    .filter((g) => g.isPinned && (g.isJoined || isAdmin))
    .sort(sortGroupsByRecentActivity);

  const joinedUnpinnedFiltered = filteredGroups
    .filter((g) => !g.isPinned && (g.isJoined || isAdmin))
    .sort(sortGroupsByRecentActivity);

  const unjoinedFiltered = filteredGroups
    .filter((g) => !g.isJoined && !isAdmin)
    .sort(sortGroupsByRecentActivity);

  const pinnedCount = groups.filter((g) => g.isPinned && (g.isJoined || isAdmin)).length;

  const pinnedMessage = messages.find((m) => m.isPinned);

  const lastReadMsgId = selectedGroup?.lastReadMessageId ?? null;
  const newMsgStartIndex = (() => {
    if (!lastReadMsgId) return -1;
    const idx = messages.findIndex((m) => m.id === lastReadMsgId);
    if (idx === -1) return -1;
    return messages.findIndex((m, i) => i > idx && m.senderId !== user.id);
  })();

  /* Group Row Renderer - WhatsApp Style Right-End Time & Hover Chevron + WhatsApp Green Notification Badge */
  const renderGroupRow = (group: (typeof groups)[number]) => {
    const isSelected = group.id === selectedGroupId;
    const joined = group.isJoined || isAdmin;
    const isPinned = group.isPinned;
    const isMuted = mutedGroupIds.includes(group.id);
    const isRowMenuOpen = openRowMenuGroupId === group.id;
    const unread = isSelected ? 0 : group.unreadCount ?? 0;
    const isJoiningThisGroup = joiningGroupId === group.id;

    return (
      <div
        key={group.id}
        onClick={() => handleSelectGroup(group.id)}
        onMouseEnter={() => {
          setHoveredGroupId(group.id);
          prefetchMessages(group.id);
        }}
        onFocus={() => prefetchMessages(group.id)}
        onTouchStart={() => prefetchMessages(group.id)}
        onMouseLeave={() => setHoveredGroupId(null)}
        className={`group p-3 flex items-start space-x-3 transition-all cursor-pointer relative rounded-xl mx-1.5 my-1 ${
          isSelected
            ? 'bg-emerald-500/15 dark:bg-emerald-500/20 border-l-4 border-emerald-500 ring-1 ring-emerald-500/30 shadow-md font-bold'
            : 'hover:bg-slate-100 dark:hover:bg-slate-900/60 border-l-4 border-transparent'
        }`}
      >
        <div className="relative shrink-0">
          <GroupAvatar
            name={group.name}
            imageUrl={group.imageUrl}
            coverGradient={group.coverGradient}
            className="w-11 h-11 rounded-2xl"
          />
          {joined && (
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-950 absolute -bottom-0.5 -right-0.5" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Top Line: Title + Right End (Time / Hover Chevron) */}
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center space-x-1 min-w-0 flex-1">
              {isPinned && <Pin className="w-2.5 h-2.5 text-emerald-500 shrink-0" />}
              {isMuted && (
                <span title="Notifications Muted">
                  <BellOff className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                </span>
              )}
              <h3
                className={`text-xs truncate transition-colors ${
                  isSelected
                    ? 'text-emerald-600 dark:text-emerald-400 font-black'
                    : 'text-slate-900 dark:text-white font-extrabold group-hover:text-emerald-500'
                }`}
              >
                {group.name}
              </h3>
            </div>

            {/* Right End: WhatsApp-style Time & Hover Down Arrow Chevron */}
            <div className="shrink-0 relative flex items-center justify-end min-w-[55px] h-5">
              {/* Time display (hides on hover/menu open like WhatsApp) */}
              <span
                className={`text-[10px] font-mono text-slate-500 dark:text-slate-400 transition-opacity ${
                  isRowMenuOpen ? 'opacity-0' : 'group-hover:opacity-0 sm:group-hover:opacity-0'
                }`}
              >
                {group.lastMessageTime
                  ? new Date(group.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'Today'}
              </span>

              {/* WhatsApp Down Arrow Hover Trigger */}
              <div data-row-menu className="absolute right-0 top-1/2 -translate-y-1/2 z-10">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpenRowMenuGroupId((prev) => (prev === group.id ? null : group.id));
                  }}
                  title="Chat options"
                  className={`p-1 rounded-full shadow-sm transition-all cursor-pointer ${
                    isRowMenuOpen
                      ? 'opacity-100 bg-emerald-500 text-white'
                      : 'opacity-0 group-hover:opacity-100 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-500 hover:text-white'
                  }`}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {isRowMenuOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-7 z-50 w-48 py-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-0.5 animate-in fade-in zoom-in-95"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        toggleMuteGroup(group.id, e);
                        setOpenRowMenuGroupId(null);
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs font-bold flex items-center space-x-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      {isMuted ? (
                        <>
                          <Bell className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span>Unmute Notifications</span>
                        </>
                      ) : (
                        <>
                          <BellOff className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>Mute Notifications</span>
                        </>
                      )}
                    </button>

                    {joined && (
                      <button
                        type="button"
                        disabled={isPinBusyFor(group.id)}
                        onClick={(e) => {
                          handleTogglePin(group.id, e);
                          setOpenRowMenuGroupId(null);
                        }}
                        title={isPinned ? undefined : `${pinnedCount}/${MAX_PINS} pinned`}
                        className="w-full px-3.5 py-2 text-left text-xs font-bold flex items-center space-x-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200 disabled:opacity-50 cursor-pointer"
                      >
                        {isPinned ? (
                          <>
                            <PinOff className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span>Unpin Chat</span>
                          </>
                        ) : (
                          <>
                            <Pin className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>Pin Chat</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className={`text-[11px] truncate mt-0.5 ${isSelected ? 'text-slate-800 dark:text-slate-200 font-semibold' : 'text-slate-600 dark:text-slate-400'}`}>
            {group.lastMessageSnippet || group.description}
          </p>

          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 flex items-center space-x-0.5">
              <Users className="w-3 h-3 text-emerald-500 inline mr-0.5" />
              {group.memberCount.toLocaleString()}
            </span>

            <div className="flex items-center space-x-1.5">
              {!joined && (
                <button
                  type="button"
                  disabled={isJoiningThisGroup}
                  onClick={(e) => handleToggleJoin(group.id, e)}
                  className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black shadow-md active:scale-95 transition-all shrink-0 flex items-center gap-1 cursor-pointer disabled:opacity-60"
                >
                  {isJoiningThisGroup ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin text-white" />
                      <span>Joining…</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3 h-3" />
                      <span>Join</span>
                    </>
                  )}
                </button>
              )}

              {/* WhatsApp Green Unread Count Badge */}
              {!isSelected && unread > 0 && (
                <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center justify-center shadow-sm">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-[calc(100vh-64px)] flex flex-col">
      {/* Real-time Notification Banner */}
      {realtimeToast && (
        <div className="fixed top-20 right-6 z-50 max-w-sm w-full p-4 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl border border-emerald-500/40 flex items-start space-x-3 transition-all animate-bounce">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
            {realtimeToast.isAdmin ? '👑' : '💬'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 truncate">
                {realtimeToast.isAdmin ? '👑 Admin Announcement' : realtimeToast.senderName} in {realtimeToast.groupName}
              </span>
              <button
                type="button"
                onClick={() => setRealtimeToast(null)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-200 line-clamp-2 mt-1">
              {realtimeToast.content}
            </p>
            <button
              type="button"
              onClick={() => {
                handleSelectGroup(realtimeToast.groupId);
                setRealtimeToast(null);
              }}
              className="mt-2 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] active:scale-95 transition-all inline-flex items-center gap-1 shadow-sm"
            >
              <span>View Message →</span>
            </button>
          </div>
        </div>
      )}

      {/* Moderation: Delete Message Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTargetMsgId}
        title="Delete Message"
        description="Delete this message for everyone in the group? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteMessageMutation.isPending}
        onConfirm={handleConfirmDeleteMessage}
        onCancel={() => setDeleteTargetMsgId(null)}
      />

      {/* Poll Composer Modal */}
      {canPostPolls && showPollComposer && isUserMember && !isLockedForUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg max-h-[92vh] sm:max-h-[85vh] flex flex-col bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <span className="text-sm font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <BarChart2 className="w-5 h-5" />
                <span>Create Study Poll / Question</span>
              </span>
              <button
                type="button"
                onClick={() => setShowPollComposer(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                title="Cancel poll"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPoll} className="flex-1 min-h-0 flex flex-col">
              {/* Scrollable fields — full question/options always visible, never clipped */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                    Question
                  </label>
                  <textarea
                    data-autogrow="poll"
                    value={pollQuestion}
                    onChange={(e) => {
                      setPollQuestion(e.target.value);
                      autoGrowTextarea(e.target);
                    }}
                    placeholder="Ask a question or enter quiz item..."
                    rows={3}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/40 placeholder:text-slate-400 resize-none overflow-hidden"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wide gap-2">
                    <span className="shrink-0">Poll Options</span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono normal-case text-right">
                      Mark the correct answer
                    </span>
                  </div>

                  {pollOptions.map((opt, idx) => (
                    <div key={opt.id} className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => setCorrectOptionId(opt.id)}
                        title={correctOptionId === opt.id ? 'Correct answer marked' : 'Mark as correct answer'}
                        className={`mt-1 p-1.5 rounded-lg border text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                          correctOptionId === opt.id
                            ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700 hover:border-emerald-500'
                        }`}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span className="text-[10px] hidden sm:inline">{correctOptionId === opt.id ? 'Correct' : 'Mark'}</span>
                      </button>

                      <textarea
                        data-autogrow="poll"
                        value={opt.text}
                        onChange={(e) => {
                          setPollOptions((prev) => prev.map((o) => (o.id === opt.id ? { ...o, text: e.target.value } : o)));
                          autoGrowTextarea(e.target);
                        }}
                        placeholder={`Option ${idx + 1}`}
                        rows={2}
                        className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 placeholder:text-slate-400 resize-none overflow-hidden"
                      />

                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePollOption(opt.id)}
                          className="mt-1 p-1.5 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer shrink-0"
                          title="Remove option"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}

                  {pollOptions.length < 6 && (
                    <button
                      type="button"
                      onClick={handleAddPollOption}
                      className="text-xs font-extrabold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Option
                    </button>
                  )}
                </div>
              </div>

              {/* Footer actions — always visible, never scrolls away */}
              <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPollComposer(false)}
                  className="text-xs h-auto py-2 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="gold"
                  disabled={!pollQuestion.trim() || pollOptions.filter((o) => o.text.trim()).length < 2}
                  className="font-extrabold px-4 py-2 h-auto text-xs cursor-pointer"
                >
                  <span>Post Poll</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-App Document & Image Viewer Modal */}
      {activePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 px-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
              <div className="flex items-center space-x-3 min-w-0 pr-4">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 font-bold">
                  {activePreview.type === 'image' ? <FileImage className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-white truncate">{activePreview.name}</h3>
                  <span className="text-[10px] font-mono text-slate-400 uppercase">
                    In-App Viewer • {activePreview.type} {activePreview.size ? `• ${activePreview.size}` : ''}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <a
                  href={activePreview.url}
                  download={activePreview.name}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setActivePreview(null)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Content Body */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950/40 min-h-[400px]">
              {activePreview.type === 'image' ? (
                <img
                  src={activePreview.url}
                  alt={activePreview.name}
                  className="max-w-full max-h-[72vh] object-contain rounded-2xl shadow-xl"
                />
              ) : activePreview.type === 'pdf' ? (
                <iframe
                  src={`${activePreview.url}#toolbar=1`}
                  title={activePreview.name}
                  className="w-full h-[72vh] rounded-2xl border border-slate-800 bg-white"
                />
              ) : (
                <div className="text-center p-8 space-y-3">
                  <File className="w-12 h-12 text-amber-500 mx-auto" />
                  <p className="text-sm font-bold text-white">Document Preview</p>
                  <a
                    href={activePreview.url}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs inline-flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Download File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {pinToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-950 dark:bg-white text-white dark:text-slate-900 text-xs font-bold px-4 py-2.5 rounded-full shadow-2xl flex items-center space-x-2 pointer-events-none">
          <Pin className="w-3.5 h-3.5 text-amber-400 dark:text-amber-600 shrink-0" />
          <span>{pinToast}</span>
        </div>
      )}

      <div className="flex flex-1 h-full overflow-hidden border-t border-slate-200/80 dark:border-slate-800/80">
        {/* ════ LEFT SIDEBAR ════ */}
        <div
          className={`w-full md:w-[320px] lg:w-[360px] border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col bg-white/95 dark:bg-slate-950/70 backdrop-blur-xl shrink-0 transition-all ${
            mobileShowChat ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800/80 space-y-2.5 shrink-0 bg-slate-50/80 dark:bg-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 text-xs font-bold">
                  ⚡
                </div>
                <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">Community</h2>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                {groups.length} Groups
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search chats (⌘K)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>

            <div className="flex items-center space-x-1 overflow-x-auto pb-0.5 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-900/60 text-slate-700 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-300/70 dark:border-slate-800/50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800/40">
            {/* Pinned Section */}
            {pinnedFiltered.map((g) => renderGroupRow(g))}

            {/* Joined Groups Section */}
            {joinedUnpinnedFiltered.map((g) => renderGroupRow(g))}

            {/* Unjoined Groups Section */}
            {unjoinedFiltered.length > 0 && (
              <>
                <div className="px-4 py-1.5 bg-slate-100/90 dark:bg-slate-900/40 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    Explore & Join ({unjoinedFiltered.length})
                  </span>
                </div>
                {unjoinedFiltered.map((g) => renderGroupRow(g))}
              </>
            )}

            {groupsLoading && groups.length === 0 && (
              <>
                <GroupRowSkeleton wide />
                <GroupRowSkeleton />
                <GroupRowSkeleton wide />
                <GroupRowSkeleton />
              </>
            )}

            {!groupsLoading && pinnedFiltered.length === 0 && joinedUnpinnedFiltered.length === 0 && unjoinedFiltered.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-600">
                No study circles found.
              </div>
            )}
          </div>
        </div>

        {/* ════ RIGHT CONVERSATION PANE ════ */}
        <div
          className={`flex-1 min-w-0 flex flex-col bg-slate-50 dark:bg-slate-950/40 backdrop-blur-2xl transition-all relative ${
            !mobileShowChat ? 'hidden md:flex' : 'flex'
          }`}
        >
          {selectedGroup ? (
            <>
              {/* Chat Header */}
              <div className="p-3 px-4 sm:px-5 border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md flex items-center justify-between shrink-0 shadow-sm z-10">
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    className="md:hidden p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer"
                    onClick={() => setMobileShowChat(false)}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <GroupAvatar
                    name={selectedGroup.name}
                    imageUrl={selectedGroup.imageUrl}
                    coverGradient={selectedGroup.coverGradient}
                    className="w-9 h-9 rounded-xl"
                    textClassName="text-xs"
                  />

                  <div className="min-w-0">
                    <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate flex items-center space-x-1.5">
                      <span className="truncate">{selectedGroup.name}</span>
                      {selectedGroup.isLocked && (
                        <span className="px-1.5 py-0.2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-[9px] font-mono font-bold shrink-0 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          <span>{isAdmin ? 'Locked for Students' : 'Locked'}</span>
                        </span>
                      )}
                    </h2>
                    <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                      {selectedGroup.memberCount.toLocaleString()} members • {selectedGroup.category}
                    </p>
                  </div>
                </div>

                {/* Top-Right Action Controls: Join Button & Three-Dot (⋮) Menu */}
                <div className="flex items-center space-x-2 shrink-0 relative" ref={menuRef}>
                  {/* Join Group Button for unjoined regular users */}
                  {!selectedGroup.isJoined && !isAdmin && (
                    <Button
                      type="button"
                      variant="gold"
                      isLoading={joiningGroupId === selectedGroup.id}
                      disabled={joiningGroupId === selectedGroup.id}
                      onClick={(e) => handleToggleJoin(selectedGroup.id, e)}
                      className="text-xs font-extrabold px-4 py-1.5 h-auto cursor-pointer shadow-md"
                    >
                      <span>{joiningGroupId === selectedGroup.id ? 'Joining…' : 'Join Group'}</span>
                    </Button>
                  )}

                  {/* Three-Dot Menu (⋮) Button for Group Chat Settings */}
                  <button
                    type="button"
                    onClick={() => setShowGroupMenu((prev) => !prev)}
                    title="Group chat options"
                    className={`p-2 rounded-xl transition-all border cursor-pointer ${
                      showGroupMenu
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md'
                        : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-amber-500'
                    }`}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {/* Three-Dot Dropdown Menu */}
                  {showGroupMenu && (
                    <div className="absolute right-0 top-11 z-50 w-52 py-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-0.5 animate-in fade-in zoom-in-95">
                      {/* Mute / Unmute Option */}
                      <button
                        type="button"
                        onClick={(e) => {
                          toggleMuteGroup(selectedGroup.id, e);
                          setShowGroupMenu(false);
                        }}
                        className="w-full px-3.5 py-2 text-left text-xs font-bold flex items-center space-x-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        {mutedGroupIds.includes(selectedGroup.id) ? (
                          <>
                            <Bell className="w-4 h-4 text-amber-500 shrink-0" />
                            <span>Unmute Notifications</span>
                          </>
                        ) : (
                          <>
                            <BellOff className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>Mute Notifications</span>
                          </>
                        )}
                      </button>

                      {/* Pin / Unpin Option */}
                      {(selectedGroup.isJoined || isAdmin) && (
                        <button
                          type="button"
                          disabled={isPinBusyFor(selectedGroup.id)}
                          onClick={(e) => {
                            handleTogglePin(selectedGroup.id, e);
                            setShowGroupMenu(false);
                          }}
                          className="w-full px-3.5 py-2 text-left text-xs font-bold flex items-center space-x-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200 disabled:opacity-50 cursor-pointer"
                        >
                          {selectedGroup.isPinned ? (
                            <>
                              <PinOff className="w-4 h-4 text-amber-500 shrink-0" />
                              <span>Unpin Group</span>
                            </>
                          ) : (
                            <>
                              <Pin className="w-4 h-4 text-slate-400 shrink-0" />
                              <span>Pin Group</span>
                            </>
                          )}
                        </button>
                      )}

                      <div className="h-px bg-slate-200 dark:bg-slate-800 my-1" />

                      {/* Leave Group Option */}
                      {isAdmin ? (
                        <div className="px-3.5 py-2 text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                          <span>👑 Admin Full Access</span>
                        </div>
                      ) : selectedGroup.isJoined ? (
                        <button
                          type="button"
                          disabled={joiningGroupId === selectedGroup.id}
                          onClick={(e) => {
                            handleToggleJoin(selectedGroup.id, e);
                            setShowGroupMenu(false);
                          }}
                          className="w-full px-3.5 py-2 text-left text-xs font-extrabold flex items-center space-x-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <LogOut className="w-4 h-4 shrink-0" />
                          <span>{joiningGroupId === selectedGroup.id ? 'Leaving…' : 'Leave Group'}</span>
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>

              {/* Pinned Message Bar */}
              {pinnedMessage && (
                <div className="px-5 py-2 bg-indigo-500/10 border-b border-indigo-500/20 text-indigo-900 dark:text-indigo-200 flex items-center space-x-2 text-xs shrink-0 z-10">
                  <Pin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 shrink-0 text-[11px]">Pinned:</span>
                  <span className="truncate text-[11px]">{pinnedMessage.content}</span>
                </div>
              )}

              {/* Chat Messages Stream */}
              <div
                ref={chatContainerRef}
                onScroll={handleChatScroll}
                className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 relative"
              >
                {hasOlder && (
                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (chatContainerRef.current) {
                          prevScrollHeightRef.current = chatContainerRef.current.scrollHeight;
                        }
                        loadOlder();
                      }}
                      disabled={isLoadingOlder}
                      className="px-3.5 py-1 rounded-full bg-slate-200 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-mono font-bold uppercase tracking-wider disabled:opacity-60 cursor-pointer shadow-sm hover:bg-slate-300 dark:hover:bg-slate-800 transition-all"
                    >
                      {isLoadingOlder ? 'Loading older history…' : '↑ Load older messages'}
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-center">
                  <span className="px-3 py-0.5 rounded-full bg-slate-200 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-400 text-[10px] font-mono font-bold uppercase tracking-wider">
                    Today
                  </span>
                </div>

                {messagesLoading && messages.length === 0 && (
                  <>
                    <BubbleSkeleton bubbleWidth="60%" hasSecondLine />
                    <BubbleSkeleton isMe bubbleWidth="45%" />
                    <BubbleSkeleton bubbleWidth="70%" hasSecondLine />
                  </>
                )}

                {messages.map((msg, msgIndex) => {
                  const isMe = msg.senderId === user.id;
                  const isAdminSender = msg.senderRole === 'Admin' || (msg.senderId === user.id && isAdmin);
                  const showNewDivider = newMsgStartIndex >= 0 && msgIndex === newMsgStartIndex;

                  return (
                    <React.Fragment key={msg.id}>
                      {showNewDivider && (
                        <div className="flex items-center space-x-3 py-1">
                          <div className="flex-1 h-px bg-rose-400/40 dark:bg-rose-500/30" />
                          <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-400/40 text-rose-600 dark:text-rose-400 text-[9px] font-black uppercase tracking-widest shrink-0 flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block animate-pulse" />
                            <span>New Messages</span>
                          </span>
                          <div className="flex-1 h-px bg-rose-400/40 dark:bg-rose-500/30" />
                        </div>
                      )}

                      <div className={`flex space-x-2.5 group ${isMe ? 'flex-row-reverse space-x-reverse' : ''}`}>
                        {/* Sender Avatar */}
                        <div
                          className={`w-7 h-7 rounded-lg font-bold flex items-center justify-center text-xs shrink-0 shadow-sm ${
                            isAdminSender
                              ? 'bg-amber-500 text-slate-950 font-black'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {isAdminSender ? '👑' : msg.senderName.slice(0, 2).toUpperCase()}
                        </div>

                        {/* Bubble Container */}
                        <div className={`max-w-md sm:max-w-xl space-y-1 ${isMe ? 'items-end text-right' : ''}`}>
                          {/* Sender Metadata Header & Delivery Status Tick */}
                          <div className="flex items-center space-x-1.5 text-[10px]">
                            <span className="font-extrabold text-slate-900 dark:text-slate-100">{msg.senderName}</span>
                            {isAdminSender && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-mono font-bold text-[9px]">
                                👑 Admin
                              </span>
                            )}
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isMe &&
                              (msg.sendFailed ? (
                                <span title="Failed to send — retry the attachment below">
                                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" aria-label="Failed to send" />
                                </span>
                              ) : msg.id.startsWith('optimistic-') ? (
                                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-label="Sending" />
                              ) : (
                                <Check className="w-3.5 h-3.5 text-emerald-500 font-black shrink-0" aria-label="Sent" />
                              ))}
                          </div>

                          {/* Message Bubbles */}
                          <div
                            className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm relative ${
                              isMe
                                ? 'bg-amber-500/15 dark:bg-slate-800/90 border border-amber-500/40 text-slate-900 dark:text-slate-100 font-medium rounded-tr-none'
                                : isAdminSender
                                ? 'bg-white dark:bg-slate-900 border-2 border-amber-500/40 text-slate-900 dark:text-slate-100 rounded-tl-none shadow-md'
                                : 'bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-none'
                            }`}
                          >
                            {/* Reply Quote */}
                            {msg.replyTo && (
                              <div className="mb-2 p-2 rounded-lg bg-slate-950/10 dark:bg-slate-950/40 border-l-2 border-amber-600 text-[10px] space-y-0.5 text-left">
                                <span className="font-bold text-amber-700 dark:text-amber-400 block">
                                  {msg.replyTo.senderName}
                                </span>
                                <span className="text-slate-700 dark:text-slate-300 line-clamp-1">
                                  {msg.replyTo.content}
                                </span>
                              </div>
                            )}

                            {!msg.poll && msg.content && (
                              <p className="whitespace-pre-wrap text-left font-medium">{msg.content}</p>
                            )}

                             {/* Document & File Attachments with In-App Preview & Progress */}
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="mt-2.5 space-y-2 text-left">
                                {msg.attachments.map((att, idx) => {
                                  const isPdf = att.type === 'pdf';
                                  const isExcel = att.type === 'excel';
                                  const isWord = att.type === 'word';
                                  const isImg = att.type === 'image';
                                  const isUploading = att.uploadStatus === 'uploading';
                                  const isError = att.uploadStatus === 'error';
                                  const progress = att.uploadProgress ?? 0;

                                  if (isImg && att.url && !isUploading && !isError) {
                                    return (
                                      <div key={idx} className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950/5 p-1 max-w-sm">
                                        <img
                                          src={att.url}
                                          alt={att.name}
                                          onClick={() => setActivePreview({ name: att.name, url: att.url, type: 'image', size: att.size })}
                                          className="w-full h-auto max-h-60 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                        />
                                        <div className="p-1.5 flex items-center justify-between text-[11px] font-bold">
                                          <span className="truncate">{att.name}</span>
                                          <button
                                            type="button"
                                            onClick={() => setActivePreview({ name: att.name, url: att.url, type: 'image', size: att.size })}
                                            className="text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer font-extrabold"
                                          >
                                            <Eye className="w-3 h-3" /> View Image
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div
                                      key={idx}
                                      onClick={() => {
                                        if (att.url && !isUploading && !isError) {
                                          setActivePreview({ name: att.name, url: att.url, type: isPdf ? 'pdf' : isImg ? 'image' : 'other', size: att.size });
                                        }
                                      }}
                                      className={`p-3 rounded-xl border transition-all ${
                                        isError
                                          ? 'bg-rose-500/10 border-rose-500/40 text-rose-800 dark:text-rose-200'
                                          : isUploading
                                          ? 'bg-amber-500/10 border-amber-500/40 text-slate-900 dark:text-slate-100'
                                          : 'bg-slate-100 dark:bg-slate-950 border-slate-300/80 dark:border-slate-800 hover:border-amber-500/60 cursor-pointer'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-3 text-xs">
                                        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                                          <div
                                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-extrabold text-[10px] ${
                                              isError
                                                ? 'bg-rose-500/20 text-rose-500 border border-rose-500/40'
                                                : isUploading
                                                ? 'bg-amber-500/20 text-amber-500 border border-amber-500/40 animate-pulse'
                                                : isPdf
                                                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                                : isExcel
                                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                                : isWord
                                                ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                                                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                            }`}
                                          >
                                            {isError ? (
                                              <AlertCircle className="w-4 h-4" />
                                            ) : isUploading ? (
                                              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                                            ) : isPdf ? (
                                              <FileText className="w-4 h-4" />
                                            ) : isExcel ? (
                                              <Table className="w-4 h-4" />
                                            ) : isWord ? (
                                              <FileCode className="w-4 h-4" />
                                            ) : (
                                              <File className="w-4 h-4" />
                                            )}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <p className="font-extrabold text-slate-900 dark:text-slate-100 truncate text-[11px]">
                                              {att.name}
                                            </p>
                                            <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-500">
                                              <span>{att.type.toUpperCase()}</span>
                                              {att.size && <span>• {att.size}</span>}
                                              {isUploading && (
                                                <span className="text-amber-600 dark:text-amber-400 font-bold">
                                                  • Uploading... {progress}%
                                                </span>
                                              )}
                                              {isError && (
                                                <span className="text-rose-500 font-bold">
                                                  • Failed
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        {isUploading && (
                                          <div className="shrink-0 flex items-center space-x-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            <span>{progress}%</span>
                                          </div>
                                        )}

                                        {isError && att.file && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRetryUpload(msg.id, idx);
                                            }}
                                            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-[10px] flex items-center gap-1 shadow-sm cursor-pointer active:scale-95 transition-all shrink-0"
                                          >
                                            <RotateCw className="w-3 h-3" />
                                            <span>Retry</span>
                                          </button>
                                        )}

                                        {!isUploading && !isError && att.url && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActivePreview({ name: att.name, url: att.url, type: isPdf ? 'pdf' : isImg ? 'image' : 'other', size: att.size });
                                            }}
                                            className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-extrabold text-[10px] hover:bg-amber-400 active:scale-95 transition-all shrink-0 flex items-center gap-1 shadow-sm cursor-pointer"
                                          >
                                            <Eye className="w-3 h-3" />
                                            <span>{isPdf ? 'Open PDF' : 'Preview'}</span>
                                          </button>
                                        )}
                                      </div>

                                      {/* Upload Progress Bar */}
                                      {isUploading && (
                                        <div className="mt-2 w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                          <div
                                            className="bg-gradient-to-r from-amber-500 to-amber-400 h-full transition-all duration-200 rounded-full"
                                            style={{ width: `${progress}%` }}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Poll Card Display (With Author Voting Disabled & Participant Wrong/Correct Badges) */}
                            {msg.poll && (
                              <div className="mt-1 p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-300/80 dark:border-slate-800 space-y-3 text-left shadow-inner">
                                <div className="flex flex-col gap-1.5 text-xs font-black text-slate-900 dark:text-white pb-1.5 border-b border-slate-200 dark:border-slate-800/60">
                                  <span className="flex items-start gap-1.5">
                                    <BarChart2 className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                    <span className="whitespace-pre-wrap break-words">{msg.poll.question}</span>
                                  </span>
                                  <div className="flex items-center flex-wrap gap-2 pl-[22px]">
                                    {msg.senderId === user.id && (
                                      <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 font-mono font-extrabold text-[9px]">
                                        📊 Author View (Voting Disabled)
                                      </span>
                                    )}
                                    <span className="text-[10px] font-mono text-slate-500 font-bold">{msg.poll.totalVotes} votes</span>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  {msg.poll.options.map((opt) => {
                                    const percent = msg.poll!.totalVotes > 0 ? Math.round((opt.votes / msg.poll!.totalVotes) * 100) : 0;
                                    const isAuthor = msg.senderId === user.id;
                                    const hasVotedOpt = opt.votedUserIds?.includes(user.id);
                                    const hasVotedAny = msg.poll!.options.some((o) => o.votedUserIds?.includes(user.id));
                                    const isCorrectOpt = msg.poll!.correctOptionId === opt.id;
                                    const isWrongSelection = hasVotedOpt && !isCorrectOpt;

                                    return (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        disabled={!isUserMember || isLockedForUser || hasVotedAny || isAuthor}
                                        onClick={() => handleVotePoll(msg.id, opt.id)}
                                        className={`w-full p-3 rounded-xl border text-xs font-semibold relative overflow-hidden transition-all text-left ${
                                          isAuthor
                                            ? isCorrectOpt
                                              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-300 font-extrabold cursor-default'
                                              : 'border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 opacity-95 cursor-default'
                                            : isWrongSelection
                                            ? 'border-rose-500 bg-rose-500/10 text-rose-900 dark:text-rose-300 font-extrabold ring-1 ring-rose-500/50'
                                            : isCorrectOpt && hasVotedAny
                                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-300 font-extrabold ring-1 ring-emerald-500/50'
                                            : hasVotedOpt
                                            ? 'border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-300 font-bold'
                                            : 'border-slate-300 dark:border-slate-800 hover:border-amber-500/60 text-slate-800 dark:text-slate-200 cursor-pointer'
                                        }`}
                                      >
                                        <div
                                          className={`absolute top-0 left-0 bottom-0 transition-all duration-500 ${
                                            isWrongSelection
                                              ? 'bg-rose-500/20'
                                              : isCorrectOpt && (hasVotedAny || isAuthor)
                                              ? 'bg-emerald-500/25'
                                              : 'bg-amber-500/20'
                                          }`}
                                          style={{ width: `${percent}%` }}
                                        />

                                        <div className="relative z-10 space-y-1.5">
                                          <div className="flex items-start justify-between gap-2">
                                            <span className="whitespace-pre-wrap break-words">{opt.text}</span>
                                            <span className="font-mono text-[10px] font-bold shrink-0 mt-0.5">
                                              {percent}% ({opt.votes})
                                            </span>
                                          </div>

                                          {((isCorrectOpt && (hasVotedAny || isAuthor)) || (!isAuthor && isWrongSelection)) && (
                                            <div className="flex items-center flex-wrap gap-1.5">
                                              {/* Correct Answer Badge */}
                                              {isCorrectOpt && (hasVotedAny || isAuthor) && (
                                                <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-white font-mono text-[9px] font-black shrink-0 flex items-center gap-0.5">
                                                  <CheckCircle className="w-2.5 h-2.5" /> Correct Answer
                                                </span>
                                              )}

                                              {/* Wrong Answer Badge for participant who chose wrong option */}
                                              {!isAuthor && isWrongSelection && (
                                                <span className="px-1.5 py-0.2 rounded bg-rose-500 text-white font-mono text-[9px] font-black shrink-0 flex items-center gap-0.5">
                                                  <X className="w-2.5 h-2.5" /> Wrong Answer
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Result Feedback Banner */}
                                {msg.poll.correctOptionId && (
                                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] font-bold">
                                    {msg.senderId === user.id ? (
                                      <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                        <BarChart2 className="w-3.5 h-3.5 text-amber-500" />
                                        <span>📊 Poll Author View • Student votes update in real-time</span>
                                      </span>
                                    ) : msg.poll.options.some((o) => o.votedUserIds?.includes(user.id)) ? (
                                      msg.poll.options.find((o) => o.id === msg.poll!.correctOptionId)?.votedUserIds?.includes(user.id) ? (
                                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                          <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                                          <span>🎉 Correct Answer chosen! Outstanding effort.</span>
                                        </span>
                                      ) : (
                                        <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                          <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                                          <span>❌ Wrong Answer! Correct Answer: {msg.poll.options.find((o) => o.id === msg.poll!.correctOptionId)?.text}</span>
                                        </span>
                                      )
                                    ) : null}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Reaction Bar & Reply */}
                          <div className="flex items-center space-x-1 pt-0.5 relative">
                            {msg.reactions.map((r) => {
                              const hasReacted = r.users.includes(user.id);
                              return (
                                <button
                                  key={r.emoji}
                                  type="button"
                                  disabled={!isUserMember || isLockedForUser}
                                  onClick={() => handleToggleReaction(msg.id, r.emoji)}
                                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold border transition-all cursor-pointer ${
                                    hasReacted
                                      ? 'bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-400 font-bold'
                                      : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                                  }`}
                                >
                                  <span>{r.emoji}</span>
                                  {r.count > 0 && <span className="ml-0.5 font-mono">{r.count}</span>}
                                </button>
                              );
                            })}

                            <button
                              type="button"
                              disabled={!isUserMember || isLockedForUser}
                              onClick={() => setActiveReactionMsgId((prev) => (prev === msg.id ? null : msg.id))}
                              className="px-1.5 py-0.5 rounded-full text-[10px] font-bold border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:text-amber-500 cursor-pointer"
                              title="Add reaction"
                            >
                              +😀
                            </button>

                            {activeReactionMsgId === msg.id && (
                              <div className="absolute left-0 bottom-7 z-30 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl grid grid-cols-6 gap-1 w-48">
                                {EMOJI_LIST.slice(0, 12).map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => handleToggleReaction(msg.id, emoji)}
                                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-base text-center cursor-pointer"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => setReplyingTo({ id: msg.id, senderName: msg.senderName, content: msg.content })}
                              className="p-1 text-slate-400 hover:text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                              title="Reply to message"
                            >
                              <Reply className="w-3.5 h-3.5" />
                            </button>

                            {/* Moderation: admins can remove any message from any group */}
                            {isAdmin && !msg.id.startsWith('optimistic-') && (
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="p-1 text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                title="Delete message"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
                <div ref={chatBottomRef} />
              </div>

              {/* Floating "Scroll to Bottom" icon button */}
              {showScrollBottomBtn && (
                <button
                  type="button"
                  onClick={scrollToBottom}
                  title="Scroll to bottom"
                  aria-label="Scroll to bottom"
                  className="absolute bottom-20 right-6 z-30 p-2.5 rounded-full bg-amber-500 text-slate-950 shadow-2xl flex items-center justify-center hover:bg-amber-400 transition-all active:scale-95 cursor-pointer border border-amber-400"
                >
                  <ChevronDown className="w-5 h-5 animate-bounce" />
                </button>
              )}

              {/* Composer Input Bar */}
              <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/90 backdrop-blur-md space-y-2 shrink-0 z-20">
                {replyingTo && (
                  <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-between text-xs font-semibold text-amber-800 dark:text-amber-300">
                    <div className="flex items-center space-x-2 truncate">
                      <Reply className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="font-bold text-amber-500 text-[11px]">Replying to {replyingTo.senderName}:</span>
                      <span className="truncate text-slate-700 dark:text-slate-300 text-[11px]">{replyingTo.content}</span>
                    </div>
                    <button type="button" onClick={() => setReplyingTo(null)} className="p-1 hover:text-rose-500 transition-colors cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Pending Admin Upload Preview Chips */}
                {pendingAttachments.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {pendingAttachments.map((att, idx) => (
                      <div
                        key={idx}
                        className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-extrabold flex items-center gap-1.5 shrink-0"
                      >
                        {att.type === 'pdf' && <FileText className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                        {att.type === 'excel' && <Table className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                        {att.type === 'word' && <FileCode className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                        {att.type === 'image' && <FileImage className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                        {!['pdf', 'excel', 'word', 'image'].includes(att.type) && <File className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                        <span className="truncate max-w-[140px]">{att.name}</span>
                        <button
                          type="button"
                          onClick={() => setPendingAttachments((prev) => prev.filter((_, i) => i !== idx))}
                          className="hover:text-rose-500 cursor-pointer ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Input Bar Form */}
                {!canSendText && !isAdmin ? (
                  <div className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-300 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 text-center">
                    Messaging is turned off for this study circle by the admin.
                  </div>
                ) : (
                  <form onSubmit={handleSendMessage} className="flex items-center space-x-2 relative">
                    {/* Emoji Picker Popover */}
                    {showEmojiPicker && (
                      <div className="absolute right-12 bottom-12 z-30 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl grid grid-cols-6 gap-1.5 w-64 max-h-48 overflow-y-auto">
                        {EMOJI_LIST.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              setNewMessage((prev) => prev + emoji);
                              setShowEmojiPicker(false);
                              messageInputRef.current?.focus();
                            }}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-lg text-center cursor-pointer transition-all hover:scale-110"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Hidden Admin File Input */}
                    {isAdmin && (
                      <input
                        type="file"
                        ref={fileInputRef}
                        multiple
                        onChange={handleAdminFileUpload}
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp,.txt,.zip"
                        className="hidden"
                      />
                    )}

                    <input
                      ref={messageInputRef}
                      type="text"
                      disabled={!isUserMember || isLockedForUser}
                      placeholder={
                        !isUserMember
                          ? 'Join study circle to start messaging...'
                          : isLockedForUser
                          ? 'This study circle is locked by admin...'
                          : 'Write a message...'
                      }
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="flex-1 min-w-0 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:opacity-50 placeholder:text-slate-400"
                    />

                    {/* Admin Document Attachment Button */}
                    {isAdmin && (
                      <button
                        type="button"
                        disabled={uploadingFile}
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 disabled:opacity-50 cursor-pointer shrink-0"
                        title="Upload Documents & Files (Admin Only)"
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>
                    )}

                    {/* Poll Button */}
                    {canPostPolls && (
                      <button
                        type="button"
                        disabled={!isUserMember || isLockedForUser}
                        onClick={() => setShowPollComposer((v) => !v)}
                        className="p-2 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-amber-500 disabled:opacity-50 cursor-pointer shrink-0"
                        title="Create a poll"
                      >
                        <BarChart2 className="w-4 h-4" />
                      </button>
                    )}

                    {/* Emoji Button */}
                    <button
                      type="button"
                      disabled={!isUserMember || isLockedForUser}
                      onClick={() => setShowEmojiPicker((v) => !v)}
                      className="p-2 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-amber-500 disabled:opacity-50 cursor-pointer shrink-0"
                      title="Insert Emoji"
                    >
                      <Smile className="w-4 h-4" />
                    </button>

                    <Button
                      type="submit"
                      variant="gold"
                      disabled={
                        !isUserMember ||
                        isLockedForUser ||
                        (!newMessage.trim() && pendingAttachments.length === 0)
                      }
                      className="font-extrabold flex items-center space-x-1 px-3.5 py-2 h-auto text-xs shrink-0 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </Button>
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl shadow-xl">
                ⚡
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Select a chat to start messaging</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Choose a Kerala PSC or SSC study circle from the left list to view daily notes, admin announcements, and peer discussions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
