'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@psc/ui';
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
} from 'lucide-react';
import {
  useChatGroups,
  useGroupMessages,
  useGroupRealtime,
  usePrefetchGroupMessages,
  useJoinGroup,
  useLeaveGroup,
  usePinGroup,
  useUnpinGroup,
  useSendMessage,
  useMarkRead,
  useUpdateMessageMetadata,
  ReplyPreview,
  MAX_PINS,
} from './community-data';
import { useAuth } from '../auth-provider';
import { CommunitySkeleton, GroupRowSkeleton, BubbleSkeleton } from './community-skeleton';
import { GroupAvatar } from './group-avatar';

export default function CommunityPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const { data: groups = [], isLoading: groupsLoading } = useChatGroups();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const {
    messages,
    isLoading: messagesLoading,
    hasOlder,
    isLoadingOlder,
    loadOlder,
  } = useGroupMessages(selectedGroupId);

  // Live updates for the open group, so we don't poll.
  useGroupRealtime(selectedGroupId);
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

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [newMessage, setNewMessage] = useState('');
  const [showPollComposer, setShowPollComposer] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [replyingTo, setReplyingTo] = useState<ReplyPreview | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const [pinToast, setPinToast] = useState<string | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const markReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Mount ──────────────────────────────────────────────── */
  useEffect(() => {
    setMounted(true);
  }, []);

  /* ── Auth guard ─────────────────────────────────────────── */
  useEffect(() => {
    if (mounted && !authLoading && !user) {
      router.replace('/login?redirect=/community');
    }
  }, [mounted, user, authLoading, router]);

  /* ── Default-select first group once groups load ───────── */
  useEffect(() => {
    if (!selectedGroupId && groups.length > 0) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups, selectedGroupId]);

  /* ── Warm the cache for the groups most likely to be opened ── */
  useEffect(() => {
    if (groups.length === 0) return;
    // Pinned and unread groups first, then the rest of the top of the list.
    const priority = [...groups]
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.unreadCount - a.unreadCount)
      .slice(0, 5);
    priority.forEach((g) => prefetchMessages(g.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  /* ── Auto mark-as-read after 1.5s of viewing ────────────── */
  useEffect(() => {
    if (!selectedGroupId || messages.length === 0) return;
    if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
    markReadTimerRef.current = setTimeout(() => {
      const lastMsgId = messages[messages.length - 1].id;
      const group = groups.find((g) => g.id === selectedGroupId);
      if (group && group.lastReadMessageId === lastMsgId) return;
      markReadMutation.mutate(lastMsgId);
    }, 1500);

    return () => {
      if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId, messages]);

  /* ── Scroll to bottom on new messages ──────────────────── */
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedGroupId]);

  /* ── Toast auto-dismiss ─────────────────────────────────── */
  useEffect(() => {
    if (!pinToast) return;
    const t = setTimeout(() => setPinToast(null), 2500);
    return () => clearTimeout(t);
  }, [pinToast]);

  /* ── Early returns ──────────────────────────────────────────
     Only auth blocks the whole page. Group and message loading render
     region-level skeletons inside the shell, so navigating here (or between
     groups) paints instantly from cache instead of waiting on the network. */
  if (!mounted || authLoading || !user) return <CommunitySkeleton />;

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || null;
  const isUserMember = selectedGroup?.isJoined ?? false;

  /* Admin-controlled feature switches. Moderators keep access so they can still
     run a group whose student-facing features are turned off. */
  const isModerator = user.role === 'ADMIN' || user.role === 'STAFF';
  const canSendText = !!selectedGroup && (selectedGroup.allowTextMessages || isModerator);
  const canPostPolls = !!selectedGroup && (selectedGroup.allowPolls || isModerator);
  const isSending = sendMutation.isPending;
  const isJoinBusy = joinMutation.isPending || leaveMutation.isPending;
  const isPinBusy = pinMutation.isPending || unpinMutation.isPending;

  const categories = ['All', 'Joined', 'Kerala PSC', 'SSC & UPSC', 'Subject Wise'];

  /* ── Handlers ───────────────────────────────────────────── */

  const handleSelectGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    setMobileShowChat(true);
    setReplyingTo(null);
    setShowPollComposer(false);
  };

  const handleTogglePin = async (groupId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const group = groups.find((g) => g.id === groupId);
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
    if (group?.isJoined) {
      await leaveMutation.mutateAsync(groupId);
    } else {
      await joinMutation.mutateAsync(groupId);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    if (!selectedGroup || !isUserMember || selectedGroup.isLocked || !selectedGroupId) return;

    const msgContent = newMessage.trim();
    await sendMutation.mutateAsync({
      content: msgContent,
      metadata: { replyTo: replyingTo || undefined },
    });

    setNewMessage('');
    setReplyingTo(null);
  };

  /* ── Poll composer (students, when the admin allows polls) ─── */
  const handleSubmitPoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId || !isUserMember || sendMutation.isPending) return;
    const question = pollQuestion.trim();
    const options = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!question || options.length < 2) return;

    await sendMutation.mutateAsync({
      content: question,
      metadata: {
        poll: {
          question,
          options: options.map((text, idx) => ({ id: `opt-${idx + 1}`, text, votes: 0, votedUserIds: [] })),
          totalVotes: 0,
        },
      },
    });

    setPollQuestion('');
    setPollOptions(['', '']);
    setShowPollComposer(false);
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!isUserMember || (selectedGroup && selectedGroup.isLocked) || !user) return;
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;

    const existingIndex = msg.reactions.findIndex((r) => r.emoji === emoji);
    let updatedReactions = [...msg.reactions];
    if (existingIndex >= 0) {
      const r = updatedReactions[existingIndex];
      const userHasReacted = r.users.includes(user.id);
      if (userHasReacted) {
        const newUsers = r.users.filter((u) => u !== user.id);
        if (newUsers.length === 0) updatedReactions.splice(existingIndex, 1);
        else updatedReactions[existingIndex] = { ...r, count: r.count - 1, users: newUsers };
      } else {
        updatedReactions[existingIndex] = { ...r, count: r.count + 1, users: [...r.users, user.id] };
      }
    } else {
      updatedReactions.push({ emoji, count: 1, users: [user.id] });
    }
    await metadataMutation.mutateAsync({ messageId, metadata: { reactions: updatedReactions } });
  };

  const handleVotePoll = async (messageId: string, optionId: string) => {
    if (!isUserMember || (selectedGroup && selectedGroup.isLocked) || !user) return;
    const msg = messages.find((m) => m.id === messageId);
    if (!msg?.poll) return;
    const alreadyVoted = msg.poll.options.some((opt) => opt.votedUserIds?.includes(user.id));
    if (alreadyVoted) return;

    const updatedOptions = msg.poll.options.map((opt) =>
      opt.id === optionId
        ? { ...opt, votes: opt.votes + 1, votedUserIds: [...(opt.votedUserIds || []), user.id] }
        : opt,
    );
    const updatedPoll = { ...msg.poll, options: updatedOptions, totalVotes: msg.poll.totalVotes + 1 };
    await metadataMutation.mutateAsync({ messageId, metadata: { poll: updatedPoll } });
  };

  /* ── Computed values ────────────────────────────────────── */

  const filteredGroups = groups.filter((group) => {
    const matchesSearch =
      group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.description.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (selectedCategory === 'All') return true;
    if (selectedCategory === 'Joined') return group.isJoined;
    return group.category === selectedCategory;
  });

  const pinnedFiltered = filteredGroups.filter((g) => g.isPinned);
  const unpinnedFiltered = filteredGroups.filter((g) => !g.isPinned);
  const sortedFilteredGroups = [...pinnedFiltered, ...unpinnedFiltered];
  const pinnedCount = groups.filter((g) => g.isPinned).length;

  const pinnedMessage = messages.find((m) => m.isPinned);
  const availableEmojis = ['👍', '❤️', '😂', '😮', '😢', '👏', '🔥', '💡'];

  // "New Messages" divider: first message after lastRead marker
  const lastReadMsgId = selectedGroup?.lastReadMessageId ?? null;
  const newMsgStartIndex = (() => {
    if (!lastReadMsgId) return -1;
    const idx = messages.findIndex((m) => m.id === lastReadMsgId);
    if (idx === -1) return -1;
    // Your own messages are never "new" to you, so the divider marks the first
    // unread message from someone else rather than sitting above one you just sent.
    return messages.findIndex((m, i) => i > idx && m.senderId !== user.id);
  })();

  /* ── Group row renderer ─────────────────────────────────── */
  const renderGroupRow = (group: (typeof groups)[number]) => {
    const isSelected = group.id === selectedGroupId;
    const joined = group.isJoined;
    const isPinned = group.isPinned;
    const isHovered = hoveredGroupId === group.id;
    const unread = group.unreadCount ?? 0;

    return (
      <div
        key={group.id}
        onClick={() => handleSelectGroup(group.id)}
        onMouseEnter={() => {
          setHoveredGroupId(group.id);
          prefetchMessages(group.id); // warm the thread before the click lands
        }}
        onFocus={() => prefetchMessages(group.id)}
        onTouchStart={() => prefetchMessages(group.id)}
        onMouseLeave={() => setHoveredGroupId(null)}
        className={`p-3 flex items-start space-x-3 transition-all cursor-pointer relative ${
          isSelected
            ? 'bg-amber-500/12 border-l-4 border-amber-500'
            : 'hover:bg-slate-100 dark:hover:bg-slate-900/40 border-l-4 border-transparent'
        }`}
      >
        {/* Avatar with online dot for joined */}
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

        {/* Text block */}
        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center space-x-1 min-w-0">
              {isPinned && <Pin className="w-2.5 h-2.5 text-amber-500 shrink-0" />}
              <h3 className={`text-xs font-extrabold truncate transition-colors ${
                isSelected ? 'text-amber-500' : 'text-slate-900 dark:text-slate-100 group-hover:text-amber-500'
              }`}>
                {group.name}
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
              {group.lastMessageTime ? new Date(group.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
            </span>
          </div>

          <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate mt-0.5">
            {group.lastMessageSnippet || group.description}
          </p>

          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 flex items-center space-x-0.5">
              <Users className="w-3 h-3 text-amber-500 inline mr-0.5" />
              {group.memberCount.toLocaleString()}
            </span>

            <div className="flex items-center space-x-1.5">
              {/* Quick Join button (only when not joined) */}
              {!joined && (
                <button
                  type="button"
                  disabled={isJoinBusy}
                  onClick={(e) => handleToggleJoin(group.id, e)}
                  className="flex items-center space-x-0.5 px-2 py-0.5 rounded-lg bg-amber-500 text-slate-950 text-[9px] font-black hover:bg-amber-400 active:scale-95 transition-all shrink-0 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <UserPlus className="w-2.5 h-2.5" />
                  <span>{isJoinBusy ? '…' : 'Join'}</span>
                </button>
              )}

              {/* Unread badge */}
              {unread > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black flex items-center justify-center shadow-sm">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Pin / Unpin button — visible on hover */}
        {isHovered && (
          <button
            type="button"
            disabled={isPinBusy}
            onClick={(e) => handleTogglePin(group.id, e)}
            title={isPinned ? 'Unpin' : `Pin (${pinnedCount}/${MAX_PINS})`}
            className={`absolute top-2 right-2 p-1 rounded-lg transition-all shadow-sm ${
              isPinned
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-rose-500/10 hover:text-rose-500'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-amber-500/10 hover:text-amber-500'
            }`}
          >
            {isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
          </button>
        )}
      </div>
    );
  };

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="w-full h-[calc(100vh-64px)] flex flex-col">

      {/* Pin limit toast */}
      {pinToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-950 dark:bg-white text-white dark:text-slate-900 text-xs font-bold px-4 py-2.5 rounded-full shadow-2xl flex items-center space-x-2 pointer-events-none">
          <Pin className="w-3.5 h-3.5 text-amber-400 dark:text-amber-600 shrink-0" />
          <span>{pinToast}</span>
        </div>
      )}

      <div className="flex flex-1 h-full overflow-hidden border-t border-slate-200/80 dark:border-slate-800/80">

        {/* ════ LEFT SIDEBAR ════════════════════════════════════ */}
        <div
          className={`w-full md:w-[320px] lg:w-[360px] border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col bg-white/95 dark:bg-slate-950/70 backdrop-blur-xl shrink-0 transition-all ${
            mobileShowChat ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Header */}
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800/80 space-y-2.5 shrink-0 bg-slate-50/80 dark:bg-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 text-xs font-bold">⚡</div>
                <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">Community</h2>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                {groups.length} Groups
              </span>
            </div>

            {/* Search */}
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

            {/* Category tabs */}
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

          {/* Group list */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800/40">

            {/* Pinned section header */}
            {pinnedFiltered.length > 0 && (
              <div className="px-4 py-1.5 flex items-center space-x-1.5 bg-amber-500/5 dark:bg-amber-500/5 sticky top-0 z-10 border-b border-amber-500/10">
                <Pin className="w-2.5 h-2.5 text-amber-500" />
                <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                  Pinned — {pinnedFiltered.length}/{MAX_PINS}
                </span>
              </div>
            )}

            {pinnedFiltered.map((g) => renderGroupRow(g))}

            {/* All Groups divider (only when there are pinned) */}
            {pinnedFiltered.length > 0 && unpinnedFiltered.length > 0 && (
              <div className="px-4 py-1.5 bg-slate-50/80 dark:bg-slate-900/20 sticky top-0 z-10">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">All Groups</span>
              </div>
            )}

            {unpinnedFiltered.map((g) => renderGroupRow(g))}

            {groupsLoading && groups.length === 0 && (
              <>
                <GroupRowSkeleton wide />
                <GroupRowSkeleton />
                <GroupRowSkeleton wide />
                <GroupRowSkeleton />
                <GroupRowSkeleton wide />
              </>
            )}

            {!groupsLoading && sortedFilteredGroups.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-600">
                No study circles found.
              </div>
            )}
          </div>
        </div>

        {/* ════ RIGHT CONVERSATION PANE ════════════════════════ */}
        <div
          className={`flex-1 min-w-0 flex flex-col bg-slate-100/60 dark:bg-slate-950/20 backdrop-blur-2xl transition-all ${
            !mobileShowChat ? 'hidden md:flex' : 'flex'
          }`}
        >
          {selectedGroup ? (
            <>
              {/* Chat header */}
              <div className="p-3 px-4 sm:px-5 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    className="md:hidden p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
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
                        <span className="px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-500 text-[9px] font-mono font-bold shrink-0">Locked</span>
                      )}
                    </h2>
                    <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                      {selectedGroup.memberCount.toLocaleString()} members • {selectedGroup.category}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {/* Pin button in header */}
                  <button
                    type="button"
                    disabled={isPinBusy}
                    onClick={(e) => handleTogglePin(selectedGroup.id, e)}
                    title={selectedGroup.isPinned ? 'Unpin this group' : `Pin this group (${pinnedCount}/${MAX_PINS})`}
                    className={`p-1.5 rounded-xl transition-all border disabled:opacity-60 disabled:cursor-not-allowed ${
                      selectedGroup.isPinned
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/30'
                    }`}
                  >
                    {selectedGroup.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                  </button>

                  {isUserMember ? (
                    <>
                      <Button
                        type="button"
                        variant="danger"
                        isLoading={isJoinBusy}
                        disabled={isJoinBusy}
                        onClick={(e) => handleToggleJoin(selectedGroup.id, e)}
                        className="text-xs font-bold px-3 py-1.5 h-auto flex items-center gap-1"
                        title="Leave this study circle"
                      >
                        {!isJoinBusy && <LogOut className="w-3.5 h-3.5" />}
                        <span>{isJoinBusy ? 'Leaving…' : 'Leave Group'}</span>
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="gold"
                      isLoading={isJoinBusy}
                      disabled={isJoinBusy}
                      onClick={(e) => handleToggleJoin(selectedGroup.id, e)}
                      className="text-xs font-bold px-3 py-1.5 h-auto"
                    >
                      <span>Join Group</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Pinned announcement bar */}
              {pinnedMessage && (
                <div className="px-5 py-2 bg-indigo-500/10 border-b border-indigo-500/20 text-indigo-900 dark:text-indigo-200 flex items-center space-x-2 text-xs shrink-0 z-10">
                  <Pin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 shrink-0 text-[11px]">Pinned:</span>
                  <span className="truncate text-[11px]">{pinnedMessage.content}</span>
                </div>
              )}

              {/* Chat stream */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {/* Older-history pagination */}
                {hasOlder && (
                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => loadOlder()}
                      disabled={isLoadingOlder}
                      className="px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-mono font-bold uppercase tracking-wider disabled:opacity-60 cursor-pointer"
                    >
                      {isLoadingOlder ? 'Loading…' : 'Load older messages'}
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
                    <BubbleSkeleton isMe bubbleWidth="38%" />
                  </>
                )}

                {messages.map((msg, msgIndex) => {
                  const isMe = msg.senderId === user.id;
                  const isAdmin = msg.senderRole === 'Admin';
                  const showNewDivider = newMsgStartIndex >= 0 && msgIndex === newMsgStartIndex;

                  return (
                    <React.Fragment key={msg.id}>
                      {/* ── New Messages divider ── */}
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

                      {/* ── Message bubble ── */}
                      <div className={`flex space-x-2.5 group ${isMe ? 'flex-row-reverse space-x-reverse' : ''}`}>
                        {/* Avatar */}
                        <div className={`w-7 h-7 rounded-lg font-bold flex items-center justify-center text-xs shrink-0 shadow-sm ${
                          isAdmin ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                        }`}>
                          {isAdmin ? '👑' : msg.senderName.slice(0, 2).toUpperCase()}
                        </div>

                        {/* Bubble container */}
                        <div className={`max-w-md sm:max-w-xl space-y-1 ${isMe ? 'items-end text-right' : ''}`}>
                          {/* Sender + timestamp */}
                          <div className="flex items-center space-x-1.5 text-[10px]">
                            <span className="font-extrabold text-slate-800 dark:text-slate-100">{msg.senderName}</span>
                            {isAdmin && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-mono font-bold text-[9px]">Admin</span>
                            )}
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {/* Delivery status on your own messages: a clock while the
                                server round trip is in flight, then a single tick. */}
                            {isMe &&
                              (msg.id.startsWith('optimistic-') ? (
                                <Clock className="w-3 h-3 text-slate-400 shrink-0" aria-label="Sending" />
                              ) : (
                                <Check className="w-3 h-3 text-emerald-500 shrink-0" aria-label="Sent" />
                              ))}
                          </div>

                          {/* Bubble body */}
                          <div className={`p-3 rounded-2xl text-xs leading-relaxed shadow-sm relative ${
                            isMe
                              ? 'bg-amber-500 text-slate-950 font-medium rounded-tr-none'
                              : isAdmin
                              ? 'bg-gradient-to-r from-amber-500/15 via-indigo-500/10 to-amber-500/10 border border-amber-500/30 text-slate-800 dark:text-slate-100 rounded-tl-none'
                              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 text-slate-800 dark:text-slate-100 rounded-tl-none'
                          }`}>
                            {/* Reply quote */}
                            {msg.replyTo && (
                              <div className="mb-2 p-2 rounded-lg bg-slate-950/10 dark:bg-slate-950/40 border-l-2 border-amber-600 text-[10px] space-y-0.5 text-left">
                                <span className="font-bold text-amber-700 dark:text-amber-400 block">{msg.replyTo.senderName}</span>
                                <span className="text-slate-600 dark:text-slate-300 line-clamp-1">{msg.replyTo.content}</span>
                              </div>
                            )}

                            <p className="whitespace-pre-wrap">{msg.content}</p>

                            {/* Attachments */}
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="mt-2 space-y-1.5">
                                {msg.attachments.map((att, idx) => (
                                  <div key={idx} className="p-2 rounded-lg bg-white/70 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                                    <div className="flex items-center space-x-2 truncate">
                                      {att.type === 'pdf' && <FileText className="w-4 h-4 text-rose-500 shrink-0" />}
                                      {att.type === 'image' && <FileImage className="w-4 h-4 text-emerald-500 shrink-0" />}
                                      {att.type === 'audio' && <FileAudio className="w-4 h-4 text-indigo-500 shrink-0" />}
                                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate text-[11px]">{att.name}</span>
                                    </div>
                                    <a href={att.url} target="_blank" rel="noreferrer" className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[9px] hover:bg-amber-400 transition-all shrink-0 ml-2">
                                      Download
                                    </a>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Poll */}
                            {msg.poll && (
                              <div className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-2 text-left">
                                <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-white">
                                  <span className="flex items-center space-x-1.5">
                                    <BarChart2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                    <span>{msg.poll.question}</span>
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{msg.poll.totalVotes} votes</span>
                                </div>
                                <div className="space-y-1">
                                  {msg.poll.options.map((opt) => {
                                    const percent = msg.poll!.totalVotes > 0 ? Math.round((opt.votes / msg.poll!.totalVotes) * 100) : 0;
                                    const hasVotedOpt = opt.votedUserIds?.includes(user.id);
                                    return (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        disabled={!isUserMember || selectedGroup.isLocked}
                                        onClick={() => handleVotePoll(msg.id, opt.id)}
                                        className={`w-full p-2 rounded-lg border text-xs font-semibold relative overflow-hidden transition-all text-left cursor-pointer ${
                                          hasVotedOpt
                                            ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold'
                                            : 'border-slate-300 dark:border-slate-800 hover:border-amber-500/50 text-slate-700 dark:text-slate-200'
                                        }`}
                                      >
                                        <div className="absolute top-0 left-0 bottom-0 bg-amber-500/20 transition-all duration-500" style={{ width: `${percent}%` }} />
                                        <div className="relative z-10 flex items-center justify-between text-[11px]">
                                          <span>{opt.text}</span>
                                          <span className="font-mono text-[10px] font-bold">{percent}% ({opt.votes})</span>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Reaction bar */}
                          <div className="flex items-center space-x-1 pt-0.5">
                            {availableEmojis.map((emoji) => {
                              const existing = msg.reactions.find((r) => r.emoji === emoji);
                              const count = existing ? existing.count : 0;
                              const hasReacted = existing ? existing.users.includes(user.id) : false;
                              return (
                                <button
                                  key={emoji}
                                  type="button"
                                  disabled={!isUserMember || selectedGroup.isLocked}
                                  onClick={() => handleToggleReaction(msg.id, emoji)}
                                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold border transition-all cursor-pointer ${
                                    hasReacted
                                      ? 'bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-400 font-bold'
                                      : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                  }`}
                                >
                                  <span>{emoji}</span>
                                  {count > 0 && <span className="ml-0.5 font-mono">{count}</span>}
                                </button>
                              );
                            })}

                            <button
                              type="button"
                              onClick={() => setReplyingTo({ id: msg.id, senderName: msg.senderName, content: msg.content })}
                              className="p-1 text-slate-400 hover:text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Reply to message"
                            >
                              <Reply className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
                <div ref={chatBottomRef} />
              </div>

              {/* Input bar */}
              <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/80 backdrop-blur-md space-y-2 shrink-0">
                {replyingTo && (
                  <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-between text-xs font-semibold text-amber-800 dark:text-amber-300">
                    <div className="flex items-center space-x-2 truncate">
                      <Reply className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="font-bold text-amber-500 text-[11px]">Replying to {replyingTo.senderName}:</span>
                      <span className="truncate text-slate-700 dark:text-slate-300 text-[11px]">{replyingTo.content}</span>
                    </div>
                    <button type="button" onClick={() => setReplyingTo(null)} className="p-1 hover:text-rose-500 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}


                {/* Poll composer — only when the admin allows polls here */}
                {canPostPolls && showPollComposer && isUserMember && !selectedGroup.isLocked && (
                  <form
                    onSubmit={handleSubmitPoll}
                    className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                        <BarChart2 className="w-3.5 h-3.5" /> New Poll
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowPollComposer(false)}
                        className="p-1 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                        title="Cancel poll"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <input
                      type="text"
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      placeholder="Ask a question..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/80 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/40 placeholder:text-slate-500 dark:placeholder:text-slate-400"
                    />

                    {pollOptions.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) =>
                            setPollOptions((prev) => prev.map((o, i) => (i === idx ? e.target.value : o)))
                          }
                          placeholder={`Option ${idx + 1}`}
                          className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/80 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/40 placeholder:text-slate-500 dark:placeholder:text-slate-400"
                        />
                        {pollOptions.length > 2 && (
                          <button
                            type="button"
                            onClick={() => setPollOptions((prev) => prev.filter((_, i) => i !== idx))}
                            className="p-1 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer shrink-0"
                            title="Remove option"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      {pollOptions.length < 4 ? (
                        <button
                          type="button"
                          onClick={() => setPollOptions((prev) => [...prev, ''])}
                          className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                        >
                          + Add option
                        </button>
                      ) : (
                        <span />
                      )}
                      <Button
                        type="submit"
                        variant="gold"
                        isLoading={isSending}
                        disabled={
                          isSending ||
                          !pollQuestion.trim() ||
                          pollOptions.filter((o) => o.trim()).length < 2
                        }
                        className="font-extrabold px-3 py-1.5 h-auto text-xs"
                      >
                        {isSending ? 'Posting…' : 'Post Poll'}
                      </Button>
                    </div>
                  </form>
                )}

                {!canSendText ? (
                  <div className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-300 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 text-center">
                    Messaging is turned off for this study circle by the admin.
                  </div>
                ) : (
                <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                  <input
                    type="text"
                    disabled={!isUserMember || selectedGroup.isLocked}
                    placeholder={
                      !isUserMember
                        ? 'Join study circle to start messaging...'
                        : selectedGroup.isLocked
                        ? 'This study circle is locked by admin...'
                        : 'Write a message...'
                    }
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 min-w-0 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/80 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:opacity-50 placeholder:text-slate-500 dark:placeholder:text-slate-400"
                  />

                  {canPostPolls && (
                    <button
                      type="button"
                      disabled={!isUserMember || selectedGroup.isLocked}
                      onClick={() => setShowPollComposer((v) => !v)}
                      className="p-2 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-amber-500 disabled:opacity-50 cursor-pointer shrink-0"
                      title="Create a poll"
                    >
                      <BarChart2 className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={!isUserMember || selectedGroup.isLocked}
                    onClick={() => setNewMessage((prev) => prev + ' 💡')}
                    className="p-2 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-amber-500 disabled:opacity-50 cursor-pointer shrink-0"
                    title="Insert Emoji"
                  >
                    <Smile className="w-4 h-4" />
                  </button>

                  <Button
                    type="submit"
                    variant="gold"
                    disabled={!isUserMember || selectedGroup.isLocked || !newMessage.trim()}
                    className="font-extrabold flex items-center space-x-1 px-3.5 py-2 h-auto text-xs shrink-0"
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
              <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl shadow-xl">⚡</div>
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
