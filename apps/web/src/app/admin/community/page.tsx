'use client';

import React, { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Card, CardTitle, Button, Input, Pagination, Skeleton } from '@psc/ui';
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
  Paperclip,
  CheckCircle2,
  UserX,
  X,
  Search,
} from 'lucide-react';
import {
  useAdminGroups,
  useCreateGroup,
  useUpdateGroup,
  useToggleGroupLock,
  useDeleteGroup,
  useGroupMembers,
  useRemoveGroupMember,
  usePostAnnouncement,
  AdminGroup,
} from '../../community/community-data';

import { AdminSkeletonHeader, AdminSkeletonTable } from '../admin-skeleton';

const groupSchema = Yup.object({
  groupName: Yup.string().trim().required('Group name is required'),
  groupDesc: Yup.string().trim().required('Description is required'),
  groupCategory: Yup.string().required('Category is required'),
  groupEmoji: Yup.string().trim().required('Icon emoji is required'),
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
  const postAnnouncementMutation = usePostAnnouncement();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AdminGroup | null>(null);
  const [groupFormError, setGroupFormError] = useState('');
  const [announcementFormError, setAnnouncementFormError] = useState('');

  const groupFormik = useFormik({
    initialValues: { groupName: '', groupDesc: '', groupCategory: 'Kerala PSC', groupEmoji: '🏆' },
    validationSchema: groupSchema,
    onSubmit: async (values, { setSubmitting }) => {
      setGroupFormError('');
      try {
        if (editingGroup) {
          await updateGroupMutation.mutateAsync({
            groupId: editingGroup.id,
            payload: { name: values.groupName.trim(), description: values.groupDesc.trim(), category: values.groupCategory, iconEmoji: values.groupEmoji },
          });
        } else {
          await createGroupMutation.mutateAsync({
            name: values.groupName.trim(),
            description: values.groupDesc.trim(),
            category: values.groupCategory,
            iconEmoji: values.groupEmoji || '📚',
          });
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
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<{ id: string; name: string } | null>(null);
  const { data: activeGroupMembers = [] } = useGroupMembers(activeGroup?.id ?? null);
  const removeMemberMutation = useRemoveGroupMember(activeGroup?.id ?? '');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  if (!mounted) {
    return (
      <div className="space-y-8">
        <AdminSkeletonHeader />
        <AdminSkeletonTable rowsCount={5} colsCount={5} />
      </div>
    );
  }

  const handleOpenCreateModal = () => {
    setEditingGroup(null);
    groupFormik.resetForm({
      values: { groupName: '', groupDesc: '', groupCategory: 'Kerala PSC', groupEmoji: '🏆' },
    });
    setGroupFormError('');
    setIsGroupModalOpen(true);
  };

  const handleOpenEditModal = (group: AdminGroup) => {
    setEditingGroup(group);
    groupFormik.resetForm({
      values: { groupName: group.name, groupDesc: group.description, groupCategory: group.category, groupEmoji: group.iconEmoji },
    });
    setGroupFormError('');
    setIsGroupModalOpen(true);
  };

  const handleToggleLockGroup = (groupId: string) => {
    toggleLockMutation.mutate(groupId);
  };

  const handleDeleteGroup = (groupId: string) => {
    if (!confirm('Are you sure you want to delete this study group?')) return;
    deleteGroupMutation.mutate(groupId);
  };

  const handleOpenMembersModal = (group: AdminGroup) => {
    setActiveGroup({ id: group.id, name: group.name });
    setIsMemberModalOpen(true);
  };

  const handleRemoveMember = (userId: string) => {
    removeMemberMutation.mutate(userId);
  };

  const totalItems = groups.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedGroups = groups.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Community & Group Management
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Create study circles, publish rich announcements, manage student members, and moderate discussion channels.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsPostModalOpen(true)}
            className="font-bold flex items-center space-x-1.5"
          >
            <Megaphone className="w-4 h-4 text-cyan-400" />
            <span>Post Announcement</span>
          </Button>

          <Button
            type="button"
            variant="gold"
            onClick={handleOpenCreateModal}
            className="font-bold flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Group</span>
          </Button>
        </div>
      </div>

      {/* Groups Table Card */}
      <Card className="p-6 glass-panel border-slate-200/80 dark:border-[#1e2e56] shadow-2xl space-y-4">
        <CardTitle className="text-slate-900 dark:text-white font-bold flex items-center justify-between">
          <span>Active Study Groups ({groups.length})</span>
        </CardTitle>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-100/80 dark:bg-[#091124] text-slate-900 dark:text-slate-100 uppercase font-mono border-b border-slate-200 dark:border-[#1e2e56]">
              <tr>
                <th className="p-3.5">Group Details</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Members</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 dark:divide-[#1e2e56] font-medium">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`}>
                    <td className="p-3.5"><Skeleton className="h-5 w-44 rounded-lg" /></td>
                    <td className="p-3.5"><Skeleton className="h-5 w-24 rounded-lg" /></td>
                    <td className="p-3.5"><Skeleton className="h-5 w-20 rounded-lg" /></td>
                    <td className="p-3.5"><Skeleton className="h-5 w-20 rounded-lg" /></td>
                    <td className="p-3.5 text-right"><Skeleton className="h-7 w-20 rounded-lg ml-auto" /></td>
                  </tr>
                ))
              ) : paginatedGroups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center space-y-3 max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
                        <Users className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">No Group Match</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          No study groups found. Create a new community study group to get started.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedGroups.map((group) => (
                <tr key={group.id} className="hover:bg-slate-50/50 dark:hover:bg-[#0c152e]/40 transition-colors">
                  <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                    <div>
                      <div className="text-sm">{group.name}</div>
                      <div className="text-xs font-normal text-slate-400 mt-0.5 line-clamp-1">{group.description}</div>
                    </div>
                  </td>
                  <td className="p-3.5">
                    <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 font-bold border border-cyan-500/20">
                      {group.category}
                    </span>
                  </td>
                  <td className="p-3.5 font-mono">
                    <button
                      type="button"
                      onClick={() => handleOpenMembersModal(group)}
                      className="hover:underline flex items-center space-x-1 text-slate-700 dark:text-slate-300"
                    >
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{group.memberCount} members</span>
                    </button>
                  </td>

                  <td className="p-3.5">
                    {group.isLocked ? (
                      <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500 font-bold border border-rose-500/30 inline-flex items-center space-x-1">
                        <Lock className="w-3 h-3" />
                        <span>Locked</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30 inline-flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Active</span>
                      </span>
                    )}
                  </td>

                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => handleToggleLockGroup(group.id)}
                        className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-amber-500 transition-colors"
                        title={group.isLocked ? 'Unlock Group' : 'Lock Group'}
                      >
                        {group.isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(group)}
                        className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-indigo-500 transition-colors"
                        title="Edit Group"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(group.id)}
                        className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-rose-500 transition-colors"
                        title="Delete Group"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          </table>
        </div>

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
      </Card>

      {/* Create / Edit Group Modal */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingGroup ? 'Edit Study Group' : 'Create New Study Group'}
              </h3>
              <button
                type="button"
                onClick={() => setIsGroupModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={groupFormik.handleSubmit} className="space-y-4 text-xs" noValidate>
              {groupFormError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 font-semibold text-center">
                  {groupFormError}
                </div>
              )}
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
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/80 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
                {groupFormik.touched.groupDesc && groupFormik.errors.groupDesc && (
                  <p className="text-xs text-rose-500 font-medium">{groupFormik.errors.groupDesc}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Category</label>
                  <select
                    name="groupCategory"
                    value={groupFormik.values.groupCategory}
                    onChange={groupFormik.handleChange}
                    onBlur={groupFormik.handleBlur}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-bold"
                  >
                    <option value="Kerala PSC">Kerala PSC</option>
                    <option value="SSC & UPSC">SSC & UPSC</option>
                    <option value="Subject Wise">Subject Wise</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <Input
                  label="Icon Emoji"
                  name="groupEmoji"
                  value={groupFormik.values.groupEmoji}
                  onChange={groupFormik.handleChange}
                  onBlur={groupFormik.handleBlur}
                  error={groupFormik.touched.groupEmoji && groupFormik.errors.groupEmoji ? groupFormik.errors.groupEmoji : undefined}
                  placeholder="🏆"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <Button type="button" variant="outline" onClick={() => setIsGroupModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="gold" className="font-bold">
                  {editingGroup ? 'Save Changes' : 'Create Group'}
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
                <span>Members in "{activeGroup.name}" ({activeGroupMembers.length})</span>
              </h3>
              <button type="button" onClick={() => setIsMemberModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {activeGroupMembers.map((m) => (
                <div key={m.userId} className="p-3 rounded-2xl bg-slate-100 dark:bg-[#091124] flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-black flex items-center justify-center text-xs shadow-xs">
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
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">{m.user.email}</p>
                    </div>
                  </div>

                  {m.user.role !== 'ADMIN' && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(m.userId)}
                      className="px-2.5 py-1 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all font-bold text-[11px] flex items-center space-x-1"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
              ))}

              {activeGroupMembers.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-600">No members yet.</div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="button" variant="outline" onClick={() => setIsMemberModalOpen(false)}>
                Close Roster
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
