'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
  Input,
  Badge,
  Pagination,
  Skeleton,
  ConfirmDialog,
} from '@psc/ui';
import {
  Users,
  Plus,
  Lock,
  Unlock,
  Trash2,
  Edit,
  Pin,
  Megaphone,
  BarChart2,
  MessageSquare,
  Paperclip,
  CheckCircle2,
  UserX,
  Ban,
  ShieldCheck,
  X,
  Search,
  Filter,
  Tag,
  Image as ImageIcon,
  Camera,
} from 'lucide-react';
import {
  useAdminGroups,
  useToggleGroupFeature,
  useUploadGroupImage,
  useCreateGroup,
  useUpdateGroup,
  useToggleGroupLock,
  useDeleteGroup,
  useGroupMembers,
  useRemoveGroupMember,
  useSetGroupMemberBlocked,
  usePostAnnouncement,
  useCommunityRealtimeSync,
  AdminGroup,
  MEMBER_PAGE_SIZE,
  MemberStatusFilter,
} from '../../community/community-data';

import { GroupAvatar } from '../../community/group-avatar';
import { AdminSkeletonHeader, AdminSkeletonTable } from '../admin-skeleton';

const MAX_GROUP_IMAGE_BYTES = 5 * 1024 * 1024;

/** Delays a value so a search box hits the API once the admin stops typing. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

const groupSchema = Yup.object({
  groupName: Yup.string().trim().required('Group name is required'),
  groupDesc: Yup.string().trim().required('Description is required'),
  groupCategory: Yup.string().required('Category is required'),
});

const postAnnouncementSchema = Yup.object({
  selectedTargetGroupId: Yup.string().required('Please select a target group'),
  postContent: Yup.string().trim().required('Announcement text is required'),
  isPinned: Yup.boolean(),
  hasAttachment: Yup.boolean(),
  attachmentType: Yup.string().oneOf(['pdf', 'image', 'audio']),
  attachmentName: Yup.string().when('hasAttachment', {
    is: true,
    then: (schema) => schema.trim().required('Attachment title is required'),
    otherwise: (schema) => schema.notRequired(),
  }),
  hasPoll: Yup.boolean(),
  pollQuestion: Yup.string().when('hasPoll', {
    is: true,
    then: (schema) => schema.trim().required('Poll question is required'),
    otherwise: (schema) => schema.notRequired(),
  }),
  pollOptions: Yup.array()
    .of(Yup.string())
    .when('hasPoll', {
      is: true,
      then: (schema) =>
        schema.test(
          'min-two-filled',
          'Provide at least 2 poll options',
          (arr) => (arr || []).filter((o) => !!o && o.trim()).length >= 2,
        ),
      otherwise: (schema) => schema.notRequired(),
    }),
});

export default function AdminCommunityPage() {
  const [mounted, setMounted] = useState(false);
  const { data: groups = [], isLoading } = useAdminGroups();
  const createGroupMutation = useCreateGroup();
  const updateGroupMutation = useUpdateGroup();
  const toggleLockMutation = useToggleGroupLock();
  const deleteGroupMutation = useDeleteGroup();
  const toggleFeatureMutation = useToggleGroupFeature();
  const uploadImageMutation = useUploadGroupImage();
  const postAnnouncementMutation = usePostAnnouncement();

  // Keeps this table and any open Members roster in sync when a *different*
  // admin/staff session creates, edits, locks, deletes, or moderates a group.
  useCommunityRealtimeSync();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AdminGroup | null>(null);
  const [groupFormError, setGroupFormError] = useState('');
  const [groupImageFile, setGroupImageFile] = useState<File | null>(null);
  const [groupImagePreview, setGroupImagePreview] = useState<string | null>(null);
  const [groupImageError, setGroupImageError] = useState('');
  const groupImageInputRef = useRef<HTMLInputElement>(null);
  const [announcementFormError, setAnnouncementFormError] = useState('');

  // Swaps in a new local preview, revoking the previous blob: URL (if any) so
  // picking several photos in a row doesn't leak memory.
  const applyGroupImagePreview = (next: string | null) => {
    setGroupImagePreview((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return next;
    });
  };

  const handleGroupImageSelect = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setGroupImageError('Please choose an image file (PNG, JPG, or WEBP).');
      return;
    }
    if (file.size > MAX_GROUP_IMAGE_BYTES) {
      setGroupImageError('Image must be smaller than 5MB.');
      return;
    }
    setGroupImageError('');
    setGroupImageFile(file);
    applyGroupImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveStagedGroupImage = () => {
    setGroupImageFile(null);
    setGroupImageError('');
    applyGroupImagePreview(editingGroup?.imageUrl || null);
    if (groupImageInputRef.current) groupImageInputRef.current.value = '';
  };

  const groupFormik = useFormik({
    initialValues: { groupName: '', groupDesc: '', groupCategory: 'Kerala PSC' },
    validationSchema: groupSchema,
    onSubmit: async (values, { setSubmitting }) => {
      setGroupFormError('');
      try {
        let targetGroup: { id: string } | null = editingGroup;
        if (targetGroup) {
          await updateGroupMutation.mutateAsync({
            groupId: targetGroup.id,
            payload: {
              name: values.groupName.trim(),
              description: values.groupDesc.trim(),
              category: values.groupCategory,
            },
          });
        } else {
          // The group must exist before its picture can be attached to it.
          const created: any = await createGroupMutation.mutateAsync({
            name: values.groupName.trim(),
            description: values.groupDesc.trim(),
            category: values.groupCategory,
          });
          targetGroup = created;
          // Switch into "editing" the newly created group right away so that,
          // if the photo upload below fails, resubmitting retries the upload
          // instead of creating a second, duplicate group.
          setEditingGroup(targetGroup as AdminGroup);
        }

        if (groupImageFile && targetGroup?.id) {
          try {
            await uploadImageMutation.mutateAsync({ groupId: targetGroup.id, file: groupImageFile });
          } catch (uploadErr: any) {
            setGroupFormError(
              `${editingGroup ? 'Changes saved' : 'Group created'}, but the photo failed to upload — ${
                uploadErr?.message || 'please try again.'
              }`,
            );
            return;
          }
        }

        setIsGroupModalOpen(false);
      } catch (err: any) {
        setGroupFormError(err?.message || 'Something went wrong. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
  });

  // Announcement Modal state
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);

  const postFormik = useFormik({
    initialValues: {
      selectedTargetGroupId: '',
      postContent: '',
      isPinned: false,
      hasAttachment: false,
      attachmentType: 'pdf' as 'pdf' | 'image' | 'audio',
      attachmentName: 'Important_Study_Notes.pdf',
      hasPoll: false,
      pollQuestion: '',
      pollOptions: ['Option 1', 'Option 2'],
    },
    validationSchema: postAnnouncementSchema,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      setAnnouncementFormError('');

      let attachments = undefined;
      if (values.hasAttachment) {
        attachments = [
          {
            type: values.attachmentType,
            name: values.attachmentName.trim() || 'Admin_Study_Document.pdf',
            url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            size: '2.1 MB',
          },
        ];
      }

      let poll = undefined;
      if (values.hasPoll && values.pollQuestion.trim()) {
        poll = {
          question: values.pollQuestion.trim(),
          options: values.pollOptions
            .filter((opt) => opt.trim())
            .map((opt, idx) => ({
              id: `opt-${idx + 1}`,
              text: opt.trim(),
              votes: 0,
              votedUserIds: [],
            })),
          totalVotes: 0,
        };
      }

      try {
        await postAnnouncementMutation.mutateAsync({
          groupId: values.selectedTargetGroupId,
          payload: {
            content: values.postContent.trim(),
            metadata: { isPinned: values.isPinned, isAnnouncement: true, attachments, poll },
          },
        });

        setIsPostModalOpen(false);
        resetForm();
        alert('Announcement posted successfully to group stream!');
      } catch (err: any) {
        setAnnouncementFormError(err?.message || 'Something went wrong. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
  });

  // Member Modal state
  const [confirmAction, setConfirmAction] = useState<
    | { type: 'lock'; group: AdminGroup }
    | { type: 'delete-group'; group: AdminGroup }
    | { type: 'remove-member'; userId: string; name: string }
    | { type: 'block-member'; userId: string; name: string }
    | { type: 'unblock-member'; userId: string; name: string }
    | null
  >(null);

  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<{ id: string; name: string } | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberStatusFilter, setMemberStatusFilter] = useState<MemberStatusFilter>('ALL');
  const [memberPage, setMemberPage] = useState(1);

  // The roster is searched server-side, so hold off a beat instead of firing a
  // request per keystroke against a group with tens of thousands of members.
  const debouncedMemberSearch = useDebouncedValue(memberSearch, 300);

  const { data: memberPageData, isFetching: isFetchingMembers } = useGroupMembers(
    activeGroup?.id ?? null,
    { search: debouncedMemberSearch, page: memberPage, status: memberStatusFilter },
  );
  const activeGroupMembers = memberPageData?.items ?? [];
  const memberTotal = memberPageData?.total ?? 0;
  const memberTotalPages = memberPageData?.totalPages ?? 1;
  const blockedCount = memberPageData?.blockedCount ?? 0;

  const removeMemberMutation = useRemoveGroupMember(activeGroup?.id ?? '');
  const setMemberBlockedMutation = useSetGroupMemberBlocked(activeGroup?.id ?? '');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  if (!mounted) {
    return (
      <div className="space-y-6">
        <AdminSkeletonHeader />
        <AdminSkeletonTable rowsCount={5} colsCount={6} />
      </div>
    );
  }

  const handleOpenCreateModal = () => {
    setEditingGroup(null);
    groupFormik.resetForm({
      values: { groupName: '', groupDesc: '', groupCategory: 'Kerala PSC' },
    });
    setGroupFormError('');
    setGroupImageFile(null);
    setGroupImageError('');
    applyGroupImagePreview(null);
    setIsGroupModalOpen(true);
  };

  const handleOpenEditModal = (group: AdminGroup) => {
    setEditingGroup(group);
    groupFormik.resetForm({
      values: { groupName: group.name, groupDesc: group.description, groupCategory: group.category },
    });
    setGroupFormError('');
    // Clear any file picked in a previous session so it can't be uploaded to
    // this group, and show the picture this group already has.
    setGroupImageFile(null);
    setGroupImageError('');
    applyGroupImagePreview(group.imageUrl || null);
    setIsGroupModalOpen(true);
  };

  const handleToggleLockGroup = (groupId: string) => {
    toggleLockMutation.mutate(groupId);
  };

  const handleDeleteGroup = (groupId: string) => {
    deleteGroupMutation.mutate(groupId);
  };

  const handleOpenMembersModal = (group: AdminGroup) => {
    setActiveGroup({ id: group.id, name: group.name });
    // Start every roster from a clean slate rather than inheriting the last
    // group's search term and page.
    setMemberSearch('');
    setMemberStatusFilter('ALL');
    setMemberPage(1);
    setIsMemberModalOpen(true);
  };

  const handleRemoveMember = (userId: string) => {
    removeMemberMutation.mutate(userId);
  };

  const handleConfirmAction = () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'lock') handleToggleLockGroup(confirmAction.group.id);
    else if (confirmAction.type === 'delete-group') handleDeleteGroup(confirmAction.group.id);
    else if (confirmAction.type === 'block-member')
      setMemberBlockedMutation.mutate({ userId: confirmAction.userId, blocked: true });
    else if (confirmAction.type === 'unblock-member')
      setMemberBlockedMutation.mutate({ userId: confirmAction.userId, blocked: false });
    else handleRemoveMember(confirmAction.userId);
    setConfirmAction(null);
  };

  // Category options are derived from the groups that actually exist, so the
  // filter can never offer a category with nothing behind it.
  const categories = Array.from(new Set(groups.map((g) => g.category).filter(Boolean))).sort();

  const filteredGroups = groups.filter((group) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      group.name.toLowerCase().includes(term) || (group.description || '').toLowerCase().includes(term);

    const matchesCategory = selectedCategoryFilter === 'ALL' || group.category === selectedCategoryFilter;

    const matchesStatus =
      selectedStatusFilter === 'ALL' ||
      (selectedStatusFilter === 'ACTIVE' && !group.isLocked) ||
      (selectedStatusFilter === 'LOCKED' && group.isLocked);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const hasActiveFilters = !!searchTerm || selectedCategoryFilter !== 'ALL' || selectedStatusFilter !== 'ALL';

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCategoryFilter('ALL');
    setSelectedStatusFilter('ALL');
    setCurrentPage(1);
  };

  const totalItems = filteredGroups.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedGroups = filteredGroups.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4">
      {/* Fixed Header & Filter Bar */}
      <div className="shrink-0 space-y-3">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Community & Group Management
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
              Create study circles, publish rich announcements, manage student members, and moderate discussion channels.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPostModalOpen(true)}
              className="font-bold flex items-center space-x-1.5 cursor-pointer"
            >
              <Megaphone className="w-4 h-4 text-cyan-400" />
              <span>Post Announcement</span>
            </Button>

            <Button
              type="button"
              variant="gold"
              onClick={handleOpenCreateModal}
              className="font-bold shadow-md shadow-cyan-500/20 flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Group</span>
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <Card className="p-4 glass-card space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
              <Input
                placeholder="Search group name or description..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9"
              />
            </div>

            {/* Category Filter */}
            <div className="flex items-center space-x-2">
              <Tag className="w-4 h-4 text-cyan-500" />
              <select
                value={selectedCategoryFilter}
                onChange={(e) => {
                  setSelectedCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-11 bg-white/90 dark:bg-[#091124] border border-slate-300 dark:border-[#1e2e56] text-slate-900 dark:text-slate-100 rounded-xl px-3.5 text-sm font-semibold focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 shadow-2xs hover:border-slate-400 dark:hover:border-[#2a3e70] transition-all cursor-pointer"
              >
                <option value="ALL" className="bg-white text-slate-900 dark:bg-[#091124] dark:text-slate-100">All Categories</option>
                {categories.map((category) => (
                  <option key={category} value={category} className="bg-white text-slate-900 dark:bg-[#091124] dark:text-slate-100">
                    {category}
                  </option>
                ))}
              </select>
            </div>

            {/* Lock Status Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-cyan-500" />
              <select
                value={selectedStatusFilter}
                onChange={(e) => {
                  setSelectedStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-11 bg-white/90 dark:bg-[#091124] border border-slate-300 dark:border-[#1e2e56] text-slate-900 dark:text-slate-100 rounded-xl px-3.5 text-sm font-semibold focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 shadow-2xs hover:border-slate-400 dark:hover:border-[#2a3e70] transition-all cursor-pointer"
              >
                <option value="ALL" className="bg-white text-slate-900 dark:bg-[#091124] dark:text-slate-100">All Statuses (Active & Locked)</option>
                <option value="ACTIVE" className="bg-white text-slate-900 dark:bg-[#091124] dark:text-slate-100">🟢 Active Only (Open to Students)</option>
                <option value="LOCKED" className="bg-white text-slate-900 dark:bg-[#091124] dark:text-slate-100">🔒 Locked / Read Only</option>
              </select>
            </div>
          </div>
        </Card>
      </div>

      {/* Scrollable Groups Table Container */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border border-slate-200/80 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] shadow-sm p-0">
        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 relative">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px] max-w-[320px]">Group Details</TableHead>
                <TableHead className="whitespace-nowrap">Category</TableHead>
                <TableHead className="whitespace-nowrap">Members</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead className="whitespace-nowrap">Student Access</TableHead>
                <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={`skeleton-${idx}`} className="border-b border-slate-200/80 dark:border-slate-800/60">
                    <TableCell className="py-4"><Skeleton className="h-5 w-44 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-24 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-24 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-20 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-32 rounded-lg" /></TableCell>
                    <TableCell className="py-4 text-right"><Skeleton className="h-8 w-24 rounded-xl ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : paginatedGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center space-y-3 max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
                        <Users className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">No Group Match</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          {hasActiveFilters
                            ? 'No study groups match your selected search or filter criteria. Try adjusting your search term or filters.'
                            : 'No study groups found. Create a new community study group to get started.'}
                        </p>
                      </div>
                      {hasActiveFilters && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs font-bold border-amber-500/40 text-amber-500 hover:bg-amber-500/10 mt-1 cursor-pointer"
                          onClick={handleResetFilters}
                        >
                          Reset All Filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedGroups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="max-w-[240px] lg:max-w-[320px] py-4">
                    <div className="flex items-center gap-3">
                      <GroupAvatar
                        name={group.name}
                        imageUrl={group.imageUrl}
                        coverGradient={group.coverGradient}
                        className="w-9 h-9 rounded-xl shrink-0"
                        textClassName="text-xs"
                      />
                      <div className="relative group/title min-w-0">
                        <span className="block truncate font-bold text-slate-900 dark:text-white text-sm cursor-pointer">
                          {group.name}
                        </span>
                        <span className="block truncate text-xs font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                          {group.description}
                        </span>
                        <div className="pointer-events-none absolute left-0 bottom-full mb-1.5 hidden group-hover/title:block z-[90] w-max max-w-xs sm:max-w-md px-3 py-2 rounded-xl bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white text-xs font-semibold shadow-xl border border-slate-700/80 leading-snug break-words">
                          {group.name}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 border border-cyan-500/25 shadow-2xs">
                      <Tag className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                      <span>{group.category}</span>
                    </span>
                  </TableCell>
                  <TableCell className="font-mono font-extrabold text-cyan-600 dark:text-cyan-300 whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs font-bold border-cyan-500/40 text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 py-1 px-2.5 rounded-xl flex items-center space-x-1.5 cursor-pointer"
                      title="View group roster"
                      onClick={() => handleOpenMembersModal(group)}
                    >
                      <Users className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Manage ({group.memberCount} members)</span>
                    </Button>
                  </TableCell>

                  <TableCell className="whitespace-nowrap">
                    {group.isLocked ? (
                      <Badge variant="danger" className="font-extrabold flex items-center w-fit gap-1.5 text-[11px] bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/30 px-2.5 py-1">
                        <Lock className="w-3 h-3" />
                        <span>Locked</span>
                      </Badge>
                    ) : (
                      <Badge variant="success" className="font-extrabold flex items-center w-fit gap-1.5 text-[11px] bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 px-2.5 py-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Active</span>
                      </Badge>
                    )}
                  </TableCell>

                  {/* Per-group student feature switches */}
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          toggleFeatureMutation.mutate({
                            groupId: group.id,
                            feature: 'allowTextMessages',
                            enabled: !group.allowTextMessages,
                          })
                        }
                        disabled={toggleFeatureMutation.isPending}
                        aria-pressed={group.allowTextMessages}
                        title={group.allowTextMessages ? 'Text messages enabled — click to disable' : 'Text messages disabled — click to enable'}
                        className={`px-2 py-1 rounded-lg border text-[10px] font-bold inline-flex items-center gap-1 transition-colors disabled:opacity-60 cursor-pointer ${
                          group.allowTextMessages
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-200/70 dark:bg-slate-800/70 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 line-through'
                        }`}
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>Text</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          toggleFeatureMutation.mutate({
                            groupId: group.id,
                            feature: 'allowPolls',
                            enabled: !group.allowPolls,
                          })
                        }
                        disabled={toggleFeatureMutation.isPending}
                        aria-pressed={group.allowPolls}
                        title={group.allowPolls ? 'Polls enabled — click to disable' : 'Polls disabled — click to enable'}
                        className={`px-2 py-1 rounded-lg border text-[10px] font-bold inline-flex items-center gap-1 transition-colors disabled:opacity-60 cursor-pointer ${
                          group.allowPolls
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-200/70 dark:bg-slate-800/70 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 line-through'
                        }`}
                      >
                        <BarChart2 className="w-3 h-3" />
                        <span>Polls</span>
                      </button>
                    </div>
                  </TableCell>

                  <TableCell className="text-right whitespace-nowrap">
                    <div className="flex items-center justify-end space-x-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="p-2 rounded-xl border-slate-300 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/10 transition-all shadow-2xs"
                        title={group.isLocked ? 'Unlock Group' : 'Lock Group'}
                        onClick={() => setConfirmAction({ type: 'lock', group })}
                      >
                        {group.isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="p-2 rounded-xl border-slate-300 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-300 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all shadow-2xs"
                        title="Edit Group"
                        onClick={() => handleOpenEditModal(group)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant="danger"
                        className="p-2 rounded-xl border-slate-300 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-500/50 hover:bg-rose-500/10 transition-all shadow-2xs"
                        title="Delete Group"
                        onClick={() => setConfirmAction({ type: 'delete-group', group })}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
            </TableBody>
          </Table>
        </div>

        <div className="shrink-0 px-4 py-3 border-t border-slate-200/80 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#091124]">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
        </div>
      </Card>

      {/* Create / Edit Group Modal */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-5 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                    {editingGroup ? 'Edit Study Group' : 'Create New Study Group'}
                  </h3>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                    {editingGroup ? 'Update the group details and picture.' : 'Set up a new community for students to join.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGroupModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-all cursor-pointer shrink-0"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={groupFormik.handleSubmit} className="space-y-4 text-xs" noValidate>
              {groupFormError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 font-semibold text-center">
                  {groupFormError}
                </div>
              )}

              {/* Group Profile Picture */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Group Profile Picture
                </label>
                <div className="flex items-center gap-4 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50">
                  <div className="relative shrink-0">
                    {groupImagePreview ? (
                      <img
                        src={groupImagePreview}
                        alt="Group preview"
                        className="w-16 h-16 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-400">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => groupImageInputRef.current?.click()}
                      className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white border-2 border-white dark:border-slate-950 flex items-center justify-center shadow-md transition-colors cursor-pointer"
                      title={groupImagePreview ? 'Change photo' : 'Upload photo'}
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => groupImageInputRef.current?.click()}
                        className="text-xs font-bold text-cyan-700 dark:text-cyan-400 hover:underline cursor-pointer"
                      >
                        {groupImagePreview ? 'Change Photo' : 'Upload Photo'}
                      </button>
                      {groupImageFile && (
                        <>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <button
                            type="button"
                            onClick={handleRemoveStagedGroupImage}
                            className="text-xs font-bold text-rose-500 hover:underline cursor-pointer"
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                      PNG, JPG or WEBP — up to 5MB.
                    </p>
                    {groupImageFile && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono">
                        {groupImageFile.name}
                      </p>
                    )}
                    {groupImageError && <p className="text-[11px] text-rose-500 font-semibold">{groupImageError}</p>}
                  </div>

                  <input
                    ref={groupImageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(e) => {
                      handleGroupImageSelect(e.target.files?.[0] || null);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </div>
              </div>

              <Input
                label="Group Name"
                name="groupName"
                value={groupFormik.values.groupName}
                onChange={groupFormik.handleChange}
                onBlur={groupFormik.handleBlur}
                error={groupFormik.touched.groupName && groupFormik.errors.groupName ? groupFormik.errors.groupName : undefined}
                placeholder="e.g. Kerala PSC LDC 2026 Warriors"
              />

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Description</label>
                <textarea
                  name="groupDesc"
                  value={groupFormik.values.groupDesc}
                  onChange={groupFormik.handleChange}
                  onBlur={groupFormik.handleBlur}
                  placeholder="Summary of target exams and discussion guidelines..."
                  rows={3}
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/80 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                />
                {groupFormik.touched.groupDesc && groupFormik.errors.groupDesc && (
                  <p className="text-xs text-rose-500 font-medium">{groupFormik.errors.groupDesc}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Category</label>
                <select
                  name="groupCategory"
                  value={groupFormik.values.groupCategory}
                  onChange={groupFormik.handleChange}
                  onBlur={groupFormik.handleBlur}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                >
                  <option value="Kerala PSC">Kerala PSC</option>
                  <option value="SSC & UPSC">SSC & UPSC</option>
                  <option value="Subject Wise">Subject Wise</option>
                  <option value="General">General</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <Button type="button" variant="outline" onClick={() => setIsGroupModalOpen(false)} disabled={groupFormik.isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" variant="gold" className="font-bold" isLoading={groupFormik.isSubmitting}>
                  {uploadImageMutation.isPending
                    ? 'Uploading Photo…'
                    : createGroupMutation.isPending || updateGroupMutation.isPending
                    ? editingGroup
                      ? 'Saving…'
                      : 'Creating…'
                    : editingGroup
                    ? 'Save Changes'
                    : 'Create Group'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Post Announcement Modal */}
      {isPostModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Megaphone className="w-5 h-5 text-amber-500" />
                <span>Post Admin Announcement & Content</span>
              </h3>
              <button type="button" onClick={() => setIsPostModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={postFormik.handleSubmit} className="space-y-4 text-xs" noValidate>
              {announcementFormError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 font-semibold text-center">
                  {announcementFormError}
                </div>
              )}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Target Group</label>
                <select
                  name="selectedTargetGroupId"
                  value={postFormik.values.selectedTargetGroupId}
                  onChange={postFormik.handleChange}
                  onBlur={postFormik.handleBlur}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-bold"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                {postFormik.touched.selectedTargetGroupId && postFormik.errors.selectedTargetGroupId && (
                  <p className="text-xs text-rose-500 font-medium">{postFormik.errors.selectedTargetGroupId}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Announcement Text</label>
                <textarea
                  name="postContent"
                  value={postFormik.values.postContent}
                  onChange={postFormik.handleChange}
                  onBlur={postFormik.handleBlur}
                  placeholder="Write your announcement, instructions, or exam update..."
                  rows={4}
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/80 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
                {postFormik.touched.postContent && postFormik.errors.postContent && (
                  <p className="text-xs text-rose-500 font-medium">{postFormik.errors.postContent}</p>
                )}
              </div>

              {/* Pin Checkbox */}
              <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={postFormik.values.isPinned}
                  onChange={(e) => postFormik.setFieldValue('isPinned', e.target.checked)}
                  className="rounded text-cyan-400 focus:ring-cyan-500"
                />
                <Pin className="w-3.5 h-3.5 text-indigo-500" />
                <span>Pin to top of group chat</span>
              </label>

              {/* Attachment Toggle */}
              <div className="pt-2 border-t border-slate-200 dark:border-[#1e2e56] space-y-3">
                <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={postFormik.values.hasAttachment}
                    onChange={(e) => postFormik.setFieldValue('hasAttachment', e.target.checked)}
                    className="rounded text-cyan-400 focus:ring-cyan-500"
                  />
                  <Paperclip className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Attach Document / File (PDF, Image, Audio)</span>
                </label>

                {postFormik.values.hasAttachment && (
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#091124] space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => postFormik.setFieldValue('attachmentType', 'pdf')}
                        className={`p-2 rounded-lg text-center font-bold text-[11px] border ${
                          postFormik.values.attachmentType === 'pdf' ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 border-cyan-400' : 'bg-slate-200 dark:bg-[#0c152e] text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        PDF Document
                      </button>
                      <button
                        type="button"
                        onClick={() => postFormik.setFieldValue('attachmentType', 'image')}
                        className={`p-2 rounded-lg text-center font-bold text-[11px] border ${
                          postFormik.values.attachmentType === 'image' ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 border-cyan-400' : 'bg-slate-200 dark:bg-[#0c152e] text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        Image Note
                      </button>
                      <button
                        type="button"
                        onClick={() => postFormik.setFieldValue('attachmentType', 'audio')}
                        className={`p-2 rounded-lg text-center font-bold text-[11px] border ${
                          postFormik.values.attachmentType === 'audio' ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 border-cyan-400' : 'bg-slate-200 dark:bg-[#0c152e] text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        Audio Explanation
                      </button>
                    </div>

                    <Input
                      label="Attachment Title"
                      name="attachmentName"
                      value={postFormik.values.attachmentName}
                      onChange={postFormik.handleChange}
                      onBlur={postFormik.handleBlur}
                      error={postFormik.touched.attachmentName && postFormik.errors.attachmentName ? postFormik.errors.attachmentName : undefined}
                      placeholder="e.g. LDC_2026_Study_Notes.pdf"
                    />
                  </div>
                )}
              </div>

              {/* Poll Toggle */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={postFormik.values.hasPoll}
                    onChange={(e) => postFormik.setFieldValue('hasPoll', e.target.checked)}
                    className="rounded text-amber-500 focus:ring-amber-500"
                  />
                  <BarChart2 className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Create Interactive Poll</span>
                </label>

                {postFormik.values.hasPoll && (
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 space-y-3">
                    <Input
                      label="Poll Question"
                      name="pollQuestion"
                      value={postFormik.values.pollQuestion}
                      onChange={postFormik.handleChange}
                      onBlur={postFormik.handleBlur}
                      error={postFormik.touched.pollQuestion && postFormik.errors.pollQuestion ? postFormik.errors.pollQuestion : undefined}
                      placeholder="e.g. Which topic needs extra live classes?"
                    />

                    <div className="space-y-2">
                      <label className="font-bold text-slate-700 dark:text-slate-300">Poll Options</label>
                      {postFormik.values.pollOptions.map((opt, idx) => (
                        <div key={idx} className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const copy = [...postFormik.values.pollOptions];
                              copy[idx] = e.target.value;
                              postFormik.setFieldValue('pollOptions', copy);
                            }}
                            placeholder={`Option ${idx + 1}`}
                            className="flex-1 p-2 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs"
                          />
                          {postFormik.values.pollOptions.length > 2 && (
                            <button
                              type="button"
                              onClick={() =>
                                postFormik.setFieldValue(
                                  'pollOptions',
                                  postFormik.values.pollOptions.filter((_, i) => i !== idx),
                                )
                              }
                              className="text-rose-500 text-xs font-bold"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                      {typeof postFormik.errors.pollOptions === 'string' && postFormik.touched.pollOptions && (
                        <p className="text-xs text-rose-500 font-medium">{postFormik.errors.pollOptions}</p>
                      )}

                      {postFormik.values.pollOptions.length < 5 && (
                        <button
                          type="button"
                          onClick={() =>
                            postFormik.setFieldValue('pollOptions', [
                              ...postFormik.values.pollOptions,
                              `Option ${postFormik.values.pollOptions.length + 1}`,
                            ])
                          }
                          className="text-amber-500 text-xs font-bold hover:underline inline-block pt-1"
                        >
                          + Add Option
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <Button type="button" variant="outline" onClick={() => setIsPostModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="gold" className="font-bold">
                  Publish Content
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Group Members Modal */}
      {isMemberModalOpen && activeGroup && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#1e2e56]">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Users className="w-5 h-5 text-cyan-400" />
                <span>Members in "{activeGroup.name}" ({memberTotal})</span>
              </h3>
              <button type="button" onClick={() => setIsMemberModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search runs on the server — groups can hold tens of thousands of members. */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <Input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => {
                    setMemberSearch(e.target.value);
                    setMemberPage(1);
                  }}
                  placeholder="Search members by name or email..."
                  className="pl-9"
                />
              </div>
              <select
                value={memberStatusFilter}
                onChange={(e) => {
                  setMemberStatusFilter(e.target.value as MemberStatusFilter);
                  setMemberPage(1);
                }}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-[#091124] border border-slate-200 dark:border-[#1e2e56] text-slate-700 dark:text-slate-200"
              >
                <option value="ALL">All members</option>
                <option value="ACTIVE">Active only</option>
                <option value="BLOCKED">Blocked only{blockedCount ? ` (${blockedCount})` : ''}</option>
              </select>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {activeGroupMembers.map((m) => (
                <div
                  key={m.userId}
                  className={`p-3 rounded-2xl flex items-center justify-between text-xs ${
                    m.isBlocked
                      ? 'bg-rose-500/5 border border-rose-500/30'
                      : 'bg-slate-100 dark:bg-[#091124]'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-8 h-8 rounded-full font-black flex items-center justify-center text-xs shadow-xs ${
                        m.isBlocked
                          ? 'bg-slate-400 text-white'
                          : 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950'
                      }`}
                    >
                      {m.user.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                        <span>{m.user.name}</span>
                        {m.user.role === 'ADMIN' && (
                          <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[9px] font-bold">
                            Admin
                          </span>
                        )}
                        {m.isBlocked && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-500 font-mono text-[9px] font-bold">
                            Blocked
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">{m.user.email}</p>
                    </div>
                  </div>

                  {m.user.role !== 'ADMIN' && (
                    <div className="flex items-center space-x-1.5">
                      {m.isBlocked ? (
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmAction({ type: 'unblock-member', userId: m.userId, name: m.user.name })
                          }
                          className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all font-bold text-[11px] flex items-center space-x-1"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Unblock</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmAction({ type: 'block-member', userId: m.userId, name: m.user.name })
                          }
                          className="px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white transition-all font-bold text-[11px] flex items-center space-x-1"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Block</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ type: 'remove-member', userId: m.userId, name: m.user.name })}
                        className="px-2.5 py-1 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all font-bold text-[11px] flex items-center space-x-1"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {activeGroupMembers.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-600">
                  {isFetchingMembers
                    ? 'Loading members...'
                    : debouncedMemberSearch || memberStatusFilter !== 'ALL'
                    ? 'No members match this search.'
                    : 'No members yet.'}
                </div>
              )}
            </div>

            {memberTotal > 0 && (
              <Pagination
                currentPage={memberPage}
                totalPages={memberTotalPages}
                totalItems={memberTotal}
                pageSize={MEMBER_PAGE_SIZE}
                onPageChange={setMemberPage}
              />
            )}

            <div className="pt-2 flex justify-end">
              <Button type="button" variant="outline" onClick={() => setIsMemberModalOpen(false)}>
                Close Roster
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmAction !== null}
        title={
          confirmAction?.type === 'lock'
            ? confirmAction.group.isLocked
              ? 'Unlock Group'
              : 'Lock Group'
            : confirmAction?.type === 'delete-group'
            ? 'Delete Study Group'
            : confirmAction?.type === 'block-member'
            ? 'Block Member'
            : confirmAction?.type === 'unblock-member'
            ? 'Unblock Member'
            : 'Remove Member'
        }
        description={
          confirmAction?.type === 'lock'
            ? `${confirmAction.group.isLocked ? 'Unlock' : 'Lock'} "${confirmAction.group.name}"?`
            : confirmAction?.type === 'delete-group'
            ? `This will permanently delete "${confirmAction.group.name}" and all its messages. This action cannot be undone.`
            : confirmAction?.type === 'remove-member'
            ? `Remove ${confirmAction.name} from this group?`
            : confirmAction?.type === 'block-member'
            ? `Block ${confirmAction.name}? This group will disappear from their community page and they won't be able to read or post in it. You can unblock them from this roster later.`
            : confirmAction?.type === 'unblock-member'
            ? `Unblock ${confirmAction.name}? The group will show up on their community page again.`
            : undefined
        }
        confirmLabel={
          confirmAction?.type === 'lock'
            ? confirmAction.group.isLocked
              ? 'Unlock'
              : 'Lock'
            : confirmAction?.type === 'delete-group'
            ? 'Delete'
            : confirmAction?.type === 'block-member'
            ? 'Block'
            : confirmAction?.type === 'unblock-member'
            ? 'Unblock'
            : 'Remove'
        }
        variant={
          confirmAction?.type === 'delete-group' ||
          confirmAction?.type === 'remove-member' ||
          confirmAction?.type === 'block-member'
            ? 'danger'
            : 'default'
        }
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
