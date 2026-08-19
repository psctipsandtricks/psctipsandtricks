'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { ApiClient } from '@/lib/api-client';
import { QuizFolder } from '@psc/shared-types';
import {
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
  Dialog,
  ConfirmDialog,
  Input,
  Badge,
  Pagination,
  Skeleton,
  DatePicker,
  TimePicker,
  combineDateAndTime,
  splitIsoToDateAndTime,
  getMinMockTestTime,
  todayLocalDateStr,
  Select,
  ToggleSwitch,
} from '@psc/ui';
import {
  Folder,
  Lock,
  Unlock,
  Search,
  Filter,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  HelpCircle,
  Eye,
  Edit3,
  ListChecks,
  History,
  Radio,
  Clock,
  ChevronRight,
  Loader2,
  X,
  Calendar,
} from 'lucide-react';
import { AdminSkeletonHeader, AdminSkeletonTable } from '../../../admin-skeleton';

export interface QuestionOption {
  id: string;
  text: string;
  explanation?: string;
}

export interface QuizQuestion {
  id: string;
  text: string;
  options: QuestionOption[];
  correctOptionId: string;
  marks: number;
  explanation?: string;
}

export interface QuizItem {
  id: string;
  title: string;
  folderName: string;
  releaseDate?: string;
  passingScore?: number;
  isActive?: boolean;
  showCorrectAnswerAfterSelection?: boolean;
  questionsCount: number;
  durationMinutes: number;
  isLiveMock: boolean;
  accessType: 'FREE' | 'PAID';
  price?: number;
  negativeMarkingEnabled?: boolean;
  negativeMarkingEvery?: number;
  negativeMarkingDeduct?: number;
  allowNegativeScore?: boolean;
  questions: QuizQuestion[];
}

interface QuizFormValues {
  title: string;
  releaseDate: string;
  releaseTime: string;
  duration: string;
  passingScore: string;
  isActive: boolean;
  isLive: boolean;
  mockTestTitle: string;
  mockTestDate: string;
  mockTestTime: string;
  showCorrectAnswerAfterSelection: boolean;
  selectedFolder: string;
  accessType: 'FREE' | 'PAID' | '';
  price: string;
  negativeMarkingEnabled: boolean;
  negativeMarkingEvery: string;
  negativeMarkingDeduct: string;
  allowNegativeScore: boolean;
}

const DEFAULT_QUIZ_FORM_VALUES: QuizFormValues = {
  title: '',
  releaseDate: '',
  releaseTime: '',
  duration: '30',
  passingScore: '60',
  isActive: true,
  isLive: false,
  mockTestTitle: '',
  mockTestDate: '',
  mockTestTime: '',
  showCorrectAnswerAfterSelection: true,
  selectedFolder: 'Root',
  accessType: 'FREE',
  price: '99',
  negativeMarkingEnabled: false,
  negativeMarkingEvery: '3',
  negativeMarkingDeduct: '1',
  allowNegativeScore: false,
};

const RELEASE_GRACE_MS = 60_000;

function resolveReleaseIso(releaseDate?: string, releaseTime?: string): string {
  if (!releaseDate) return '';
  const iso = combineDateAndTime(releaseDate, releaseTime);
  return iso || '';
}

function formatReleaseDateTime(releaseDate?: string) {
  if (!releaseDate) {
    return { formattedDate: 'Immediate', formattedTime: '', fullFormatted: 'Immediate Release', isUpcoming: false, isImmediate: true };
  }
  const d = new Date(releaseDate);
  if (isNaN(d.getTime())) {
    return { formattedDate: 'Immediate', formattedTime: '', fullFormatted: 'Immediate Release', isUpcoming: false, isImmediate: true };
  }
  const isUpcoming = d.getTime() > Date.now();
  const formattedDate = d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return {
    formattedDate,
    formattedTime,
    fullFormatted: `${formattedDate}, ${formattedTime}`,
    isUpcoming,
    isImmediate: false,
  };
}

const makeQuizSchema = (originalReleaseIso?: string) =>
  Yup.object({
    title: Yup.string().trim().required('Quiz Title is required.'),
    releaseTime: Yup.string().test(
      'release-not-in-past',
      'Release date and time cannot be in the past.',
      function (releaseTime) {
        const releaseDate = (this.parent as QuizFormValues).releaseDate;
        if (!releaseDate) return true;
        const iso = resolveReleaseIso(releaseDate, releaseTime);
        if (!iso) return true;
        if (originalReleaseIso && combineDateAndTime(releaseDate, releaseTime) === originalReleaseIso) {
          return true;
        }
        return new Date(iso).getTime() >= Date.now() - RELEASE_GRACE_MS;
      },
    ),
    duration: Yup.number().typeError('Duration must be a number').positive('Duration must be greater than 0 minutes.').required('Duration is required.'),
    passingScore: Yup.number().typeError('Passing score must be a number').min(0, 'Passing score cannot be negative.').max(100, 'Passing score cannot exceed 100%.').required('Passing score is required.'),
    accessType: Yup.string().oneOf(['FREE', 'PAID'], 'Access Type is mandatory. Please select Free or Paid.').required('Access Type is mandatory.'),
    price: Yup.number().when('accessType', {
      is: 'PAID',
      then: (schema) => schema.typeError('Price must be a number').positive('Price must be greater than 0.').required('Price is required for paid quizzes.'),
      otherwise: (schema) => schema.notRequired(),
    }),
    negativeMarkingEvery: Yup.number().when('negativeMarkingEnabled', {
      is: true,
      then: (schema) =>
        schema
          .typeError('Must be a number')
          .integer('Must be a whole number.')
          .min(1, 'Must be at least 1 wrong answer.')
          .required('Required.'),
      otherwise: (schema) => schema.notRequired(),
    }),
    negativeMarkingDeduct: Yup.number().when('negativeMarkingEnabled', {
      is: true,
      then: (schema) => schema.typeError('Must be a number').min(0, 'Cannot be negative.').required('Required.'),
      otherwise: (schema) => schema.notRequired(),
    }),
    mockTestTitle: Yup.string().when('isLive', {
      is: true,
      then: (schema) => schema.trim().required('Mock test title is required when live mock test is enabled.'),
      otherwise: (schema) => schema.notRequired(),
    }),
    mockTestDate: Yup.string().when('isLive', {
      is: true,
      then: (schema) =>
        schema
          .trim()
          .required('Scheduled date is required.')
          .test('not-past-date', 'Scheduled date cannot be in the past.', function (date) {
            if (!date) return true;
            return date >= todayLocalDateStr();
          }),
      otherwise: (schema) => schema.notRequired(),
    }),
    mockTestTime: Yup.string().when('isLive', {
      is: true,
      then: (schema) =>
        schema
          .trim()
          .required('Scheduled time is required.')
          .test('at-least-1-min-future', 'Scheduled time must be in the future.', function (time) {
            const date = (this.parent as QuizFormValues).mockTestDate;
            if (!date || !time) return true;
            const iso = combineDateAndTime(date, time);
            if (!iso) return true;
            return new Date(iso).getTime() >= Date.now() + 55_000;
          }),
      otherwise: (schema) => schema.notRequired(),
    }),
  });

const DEFAULT_QUIZ_SCHEMA = makeQuizSchema();

export default function AdminFolderQuizzesPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawFolderName = params?.folderName as string;
  const currentFolder = rawFolderName ? decodeURIComponent(rawFolderName) : 'Root';

  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [mockTestByQuizId, setMockTestByQuizId] = useState<Record<string, any>>({});

  // Sub-folders State
  const [subFolders, setSubFolders] = useState<QuizFolder[]>([]);
  const [currentFolderData, setCurrentFolderData] = useState<QuizFolder | null>(null);
  const [isSubFolderDialogOpen, setIsSubFolderDialogOpen] = useState(false);
  const [editingSubFolder, setEditingSubFolder] = useState<QuizFolder | null>(null);
  const [parentForNewSubFolder, setParentForNewSubFolder] = useState<QuizFolder | null>(null);
  const [deleteSubFolderTarget, setDeleteSubFolderTarget] = useState<QuizFolder | null>(null);
  const [subFolderName, setSubFolderName] = useState('');
  const [subFolderDesc, setSubFolderDesc] = useState('');
  const [subFolderActive, setSubFolderActive] = useState(true);
  const [subFolderError, setSubFolderError] = useState('');
  const [subFolderSaving, setSubFolderSaving] = useState(false);

  // Hierarchy Tree Expand State
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [subFolderContents, setSubFolderContents] = useState<
    Record<string, { subFolders: QuizFolder[]; quizzes: QuizItem[]; loading: boolean }>
  >({});

  // Filter & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccessFilter, setSelectedAccessFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [originalReleaseIso, setOriginalReleaseIso] = useState<string | undefined>(undefined);
  const [formSubmitError, setFormSubmitError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<QuizItem | null>(null);
  const [updatingStatusQuizId, setUpdatingStatusQuizId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => setToastMsg(null), 4000);
    return () => clearTimeout(timer);
  }, [toastMsg]);

  const mapApiQuizToLocal = useCallback((apiQuiz: any): QuizItem => {
    return {
      id: apiQuiz.id,
      title: apiQuiz.title,
      folderName: (!apiQuiz.folderName || apiQuiz.folderName === 'Root / No Folder' || apiQuiz.folderName === 'Root') ? 'Root' : apiQuiz.folderName,
      releaseDate: apiQuiz.releaseDate,
      passingScore: apiQuiz.passingMarks,
      isActive: apiQuiz.isActive ?? true,
      showCorrectAnswerAfterSelection: apiQuiz.showCorrectAnswerAfterSelection ?? true,
      questionsCount: apiQuiz.totalQuestions || (apiQuiz.questions?.length ?? 0),
      durationMinutes: apiQuiz.durationMinutes,
      isLiveMock: apiQuiz.isLiveMock,
      accessType: apiQuiz.accessType === 'PAID' ? 'PAID' : 'FREE',
      price: apiQuiz.price > 0 ? apiQuiz.price : undefined,
      negativeMarkingEnabled: apiQuiz.negativeMarkingEnabled ?? false,
      negativeMarkingEvery: apiQuiz.negativeMarkingEvery ?? 3,
      negativeMarkingDeduct: apiQuiz.negativeMarkingDeduct ?? 1,
      allowNegativeScore: apiQuiz.allowNegativeScore ?? false,
      questions: (apiQuiz.questions || []).map((q: any) => ({
        id: q.id,
        text: q.text,
        marks: q.marks ?? 1,
        explanation: q.explanation ?? '',
        options: Array.isArray(q.options)
          ? q.options.map((o: any) => ({
              id: typeof o === 'string' ? `opt-${Math.random()}` : o.id,
              text: typeof o === 'string' ? o : o.text,
              explanation: typeof o === 'object' && o ? o.explanation || '' : '',
            }))
          : [],
        correctOptionId: Array.isArray(q.options) && q.options[q.correctOptionIndex]
          ? q.options[q.correctOptionIndex].id
          : '',
      })),
    };
  }, []);

  const fetchSubFolders = useCallback(async () => {
    try {
      const [allFolders, children] = await Promise.all([
        ApiClient.getQuizFolders(),
        ApiClient.getQuizFolders(currentFolder),
      ]);
      const current = (allFolders || []).find(
        (f) => f.name.toLowerCase() === currentFolder.toLowerCase() || f.id === currentFolder,
      );
      if (current) setCurrentFolderData(current);
      const validSub = (children || []).filter(
        (f) => f.name && f.name.toLowerCase() !== 'root' && f.name.toLowerCase() !== currentFolder.toLowerCase(),
      );
      setSubFolders(validSub);
    } catch (err) {
      console.error('Failed to fetch sub-folders:', err);
    }
  }, [currentFolder]);

  const fetchQuizzes = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await ApiClient.getQuizzes({
        page: currentPage,
        limit: pageSize,
        search: searchTerm.trim() || undefined,
        folder: currentFolder,
        access: selectedAccessFilter !== 'ALL' ? selectedAccessFilter : undefined,
        status: selectedStatusFilter !== 'ALL' ? selectedStatusFilter : undefined,
      });

      const data = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      const total = typeof res?.total === 'number' ? res.total : data.length;
      setTotalCount(total);
      setQuizzes(data.map(mapApiQuizToLocal));
    } catch (err) {
      console.error('Failed to fetch folder quizzes:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [currentPage, pageSize, searchTerm, currentFolder, selectedAccessFilter, selectedStatusFilter, mapApiQuizToLocal]);

  const fetchMockTests = useCallback(async () => {
    try {
      const mockTests = await ApiClient.getMockTests();
      const now = Date.now();
      const byQuiz: Record<string, any> = {};

      (mockTests as any[]).forEach((mt) => {
        if (!mt?.quizId) return;
        const current = byQuiz[mt.quizId];
        if (!current) {
          byQuiz[mt.quizId] = mt;
          return;
        }
        const candidateAt = new Date(mt.scheduledAt).getTime();
        const currentAt = new Date(current.scheduledAt).getTime();
        const candidateUpcoming = candidateAt >= now;
        const currentUpcoming = currentAt >= now;

        if (candidateUpcoming !== currentUpcoming) {
          if (candidateUpcoming) byQuiz[mt.quizId] = mt;
        } else if (candidateUpcoming ? candidateAt < currentAt : candidateAt > currentAt) {
          byQuiz[mt.quizId] = mt;
        }
      });

      setMockTestByQuizId(byQuiz);
    } catch (err) {
      console.error('Failed to fetch live mock tests:', err);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchSubFolders();
    fetchQuizzes();
    fetchMockTests();
  }, [fetchSubFolders, fetchQuizzes, fetchMockTests]);

  const handleOpenCreateSubFolder = (parentFolder?: QuizFolder) => {
    setEditingSubFolder(null);
    setParentForNewSubFolder(parentFolder || null);
    setSubFolderName('');
    setSubFolderDesc('');
    setSubFolderActive(true);
    setSubFolderError('');
    setIsSubFolderDialogOpen(true);
  };

  const handleOpenEditSubFolder = (sf: QuizFolder) => {
    setEditingSubFolder(sf);
    setParentForNewSubFolder(null);
    setSubFolderName(sf.name);
    setSubFolderDesc(sf.description || '');
    setSubFolderActive(sf.isActive !== false);
    setSubFolderError('');
    setIsSubFolderDialogOpen(true);
  };

  const toggleExpandFolder = async (folder: QuizFolder) => {
    const nextState = !expandedFolders[folder.id];
    setExpandedFolders((prev) => ({ ...prev, [folder.id]: nextState }));

    if (nextState && !subFolderContents[folder.id]) {
      setSubFolderContents((prev) => ({
        ...prev,
        [folder.id]: { subFolders: [], quizzes: [], loading: true },
      }));
      try {
        const [childrenFolders, quizRes] = await Promise.all([
          ApiClient.getQuizFolders(folder.id),
          ApiClient.getQuizzes({ folder: folder.name, limit: 100 }),
        ]);

        const validChildFolders = (childrenFolders || []).filter(
          (f) => f.name && f.name.toLowerCase() !== 'root' && f.id !== folder.id,
        );
        const quizList = Array.isArray(quizRes?.data) ? quizRes.data : Array.isArray(quizRes) ? quizRes : [];

        setSubFolderContents((prev) => ({
          ...prev,
          [folder.id]: {
            subFolders: validChildFolders,
            quizzes: quizList.map(mapApiQuizToLocal),
            loading: false,
          },
        }));
      } catch (err) {
        console.error('Failed to load inner folder contents:', err);
        setSubFolderContents((prev) => ({
          ...prev,
          [folder.id]: { subFolders: [], quizzes: [], loading: false },
        }));
      }
    }
  };

  const handleOpenCreateQuizInSubFolder = (targetFolderName: string) => {
    setEditingQuizId(null);
    setOriginalReleaseIso(undefined);
    setFormSubmitError('');
    formik.resetForm({
      values: {
        ...DEFAULT_QUIZ_FORM_VALUES,
        selectedFolder: targetFolderName,
      },
    });
    setIsDialogOpen(true);
  };

  useEffect(() => {
    if (searchParams?.get('action') === 'createQuiz' || searchParams?.get('createQuiz') === 'true') {
      const targetFolder = searchParams.get('targetFolder') || currentFolder;
      handleOpenCreateQuizInSubFolder(targetFolder);
    }
  }, [searchParams, currentFolder]);

  const handleSaveSubFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = subFolderName.trim();
    if (!name) {
      setSubFolderError('Folder name is required.');
      return;
    }
    setSubFolderSaving(true);
    setSubFolderError('');
    try {
      if (editingSubFolder) {
        setSubFolders((prev) =>
          prev.map((f) =>
            f.id === editingSubFolder.id
              ? { ...f, name, description: subFolderDesc.trim() || null, isActive: subFolderActive }
              : f,
          ),
        );
        setIsSubFolderDialogOpen(false);
        setToastMsg({ type: 'success', text: `Sub-folder "${name}" updated.` });
        await ApiClient.updateQuizFolder(editingSubFolder.id, {
          name,
          description: subFolderDesc.trim() || undefined,
          isActive: subFolderActive,
        });
        fetchSubFolders();
      } else {
        const targetParentId = parentForNewSubFolder?.id || currentFolderData?.id || null;
        const targetParentName = parentForNewSubFolder?.name || currentFolder;
        const tempId = `temp-${Date.now()}`;
        const newFolder: QuizFolder = {
          id: tempId,
          name,
          parentId: targetParentId,
          parentName: targetParentName,
          description: subFolderDesc.trim() || null,
          orderIndex: subFolders.length,
          isActive: subFolderActive,
          quizCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setSubFolders((prev) => [...prev, newFolder]);
        setIsSubFolderDialogOpen(false);
        setToastMsg({ type: 'success', text: `Sub-folder "${name}" created.` });
        await ApiClient.createQuizFolder({
          name,
          parentId: targetParentId || targetParentName,
          description: subFolderDesc.trim() || undefined,
          orderIndex: subFolders.length,
          isActive: subFolderActive,
        });
        fetchSubFolders();
      }
    } catch (err: any) {
      setSubFolderError(err.message || 'Failed to save sub-folder.');
    } finally {
      setSubFolderSaving(false);
    }
  };

  const handleDeleteSubFolder = async (sf: QuizFolder) => {
    const previous = subFolders;
    setSubFolders((prev) => prev.filter((f) => f.id !== sf.id));
    setToastMsg({ type: 'success', text: `Sub-folder "${sf.name}" deleted.` });
    try {
      await ApiClient.deleteQuizFolder(sf.id);
      fetchSubFolders();
    } catch (err: any) {
      setSubFolders(previous);
      setToastMsg({ type: 'error', text: err.message || 'Failed to delete sub-folder.' });
    }
  };

  const syncLiveMockTest = useCallback(
    async (quizId: string, values: QuizFormValues) => {
      if (!values.isLive) return;
      const scheduledAt = combineDateAndTime(values.mockTestDate, values.mockTestTime);
      if (!scheduledAt) return;

      const payload = { title: values.mockTestTitle.trim() || values.title.trim(), scheduledAt };
      const existing = mockTestByQuizId[quizId];

      if (existing?.id) {
        await ApiClient.updateMockTest(existing.id, payload);
      } else {
        await ApiClient.createMockTest({ ...payload, quizId });
      }
    },
    [mockTestByQuizId],
  );

  const formik = useFormik<QuizFormValues>({
    initialValues: {
      ...DEFAULT_QUIZ_FORM_VALUES,
      selectedFolder: currentFolder,
    },
    validationSchema: originalReleaseIso ? makeQuizSchema(originalReleaseIso) : DEFAULT_QUIZ_SCHEMA,
    onSubmit: async (values, { setSubmitting }) => {
      const currentEditingQuiz = editingQuizId ? quizzes.find((q) => q.id === editingQuizId) : null;
      const isAlreadyReleased = Boolean(
        editingQuizId &&
          currentEditingQuiz &&
          (!currentEditingQuiz.releaseDate || new Date(currentEditingQuiz.releaseDate).getTime() <= Date.now()),
      );

      const numericPrice = values.accessType === 'PAID' ? Number(values.price) || 0 : 0;
      const fullReleaseIso = isAlreadyReleased
        ? (currentEditingQuiz?.releaseDate || undefined)
        : (values.releaseDate ? resolveReleaseIso(values.releaseDate, values.releaseTime) : null);

      const apiPayload = {
        title: values.title.trim(),
        folderName: currentFolder,
        accessType: values.accessType || 'FREE',
        isActive: values.isActive,
        showCorrectAnswerAfterSelection: values.showCorrectAnswerAfterSelection,
        releaseDate: isAlreadyReleased ? undefined : (fullReleaseIso || undefined),
        durationMinutes: Number(values.duration) || 30,
        isLiveMock: values.isLive,
        isPremium: values.accessType === 'PAID',
        price: numericPrice,
        negativeMarkingEnabled: values.negativeMarkingEnabled,
        negativeMarkingEvery: values.negativeMarkingEnabled ? Number(values.negativeMarkingEvery) || 3 : 3,
        negativeMarkingDeduct: values.negativeMarkingEnabled ? Number(values.negativeMarkingDeduct) || 1 : 1,
        allowNegativeScore: values.allowNegativeScore,
        passingMarks: Number(values.passingScore) || 40,
        totalMarks: 100,
      };

      try {
        let createdOrUpdated: any = null;
        if (editingQuizId) {
          // Optimistically update edited quiz in table
          setQuizzes((prev) =>
            prev.map((q) =>
              q.id === editingQuizId
                ? {
                    ...q,
                    title: apiPayload.title,
                    accessType: apiPayload.accessType as 'FREE' | 'PAID',
                    isActive: apiPayload.isActive,
                    durationMinutes: apiPayload.durationMinutes,
                    isLiveMock: apiPayload.isLiveMock,
                    price: apiPayload.price,
                  }
                : q,
            ),
          );
          setIsDialogOpen(false);
          setToastMsg({ type: 'success', text: 'Quiz updated successfully.' });

          await ApiClient.updateQuiz(editingQuizId, apiPayload);
          await syncLiveMockTest(editingQuizId, values);
          await Promise.all([fetchQuizzes(true), fetchMockTests()]);
        } else {
          setIsDialogOpen(false);
          createdOrUpdated = await ApiClient.createQuiz(apiPayload);
          if (createdOrUpdated?.id) {
            await syncLiveMockTest(createdOrUpdated.id, values);
            router.push(`/admin/quizzes/${createdOrUpdated.id}/questions`);
          } else {
            await Promise.all([fetchQuizzes(true), fetchMockTests()]);
          }
        }
      } catch (err: any) {
        setFormSubmitError(err.message || 'Failed to save quiz settings.');
      } finally {
        setSubmitting(false);
      }
    },
  });

  const handleOpenCreateModal = () => {
    setEditingQuizId(null);
    setOriginalReleaseIso(undefined);
    setFormSubmitError('');
    formik.resetForm({
      values: {
        ...DEFAULT_QUIZ_FORM_VALUES,
        selectedFolder: currentFolder,
      },
    });
    setIsDialogOpen(true);
  };

  const handleOpenEditModal = (quiz: QuizItem) => {
    setEditingQuizId(quiz.id);
    setFormSubmitError('');
    const { date: relDate, time: relTime } = splitIsoToDateAndTime(quiz.releaseDate);
    setOriginalReleaseIso(combineDateAndTime(relDate, relTime) || undefined);

    const existingMockTest = mockTestByQuizId[quiz.id];
    const { date: mockDate, time: mockTime } = splitIsoToDateAndTime(existingMockTest?.scheduledAt);

    formik.resetForm({
      values: {
        title: quiz.title,
        releaseDate: relDate,
        releaseTime: relTime,
        duration: String(quiz.durationMinutes),
        passingScore: quiz.passingScore ? String(quiz.passingScore) : '60',
        isActive: quiz.isActive !== undefined ? quiz.isActive : true,
        isLive: quiz.isLiveMock,
        mockTestTitle: existingMockTest?.title || quiz.title,
        mockTestDate: mockDate,
        mockTestTime: mockTime,
        showCorrectAnswerAfterSelection: quiz.showCorrectAnswerAfterSelection ?? true,
        selectedFolder: currentFolder,
        accessType: quiz.accessType,
        price: quiz.price ? String(quiz.price) : '99',
        negativeMarkingEnabled: quiz.negativeMarkingEnabled ?? false,
        negativeMarkingEvery: String(quiz.negativeMarkingEvery ?? 3),
        negativeMarkingDeduct: String(quiz.negativeMarkingDeduct ?? 1),
        allowNegativeScore: quiz.allowNegativeScore ?? false,
      },
    });
    setIsDialogOpen(true);
  };

  const handleDeleteQuiz = async (id: string) => {
    const previous = quizzes;
    const previousTotal = totalCount;
    setQuizzes((prev) => prev.filter((q) => q.id !== id));
    setTotalCount((prev) => Math.max(0, prev - 1));
    setToastMsg({ type: 'success', text: 'Quiz deleted successfully.' });
    try {
      await ApiClient.deleteQuiz(id);
      fetchQuizzes(true);
    } catch (err: any) {
      setQuizzes(previous);
      setTotalCount(previousTotal);
      setToastMsg({ type: 'error', text: err.message || 'Failed to delete quiz.' });
    }
  };

  const handleQuickToggleActive = async (quiz: QuizItem) => {
    const rel = formatReleaseDateTime(quiz.releaseDate);
    if (rel.isUpcoming) {
      setToastMsg({
        type: 'warning',
        text: `Cannot toggle status. This quiz is scheduled for future release on ${rel.fullFormatted}.`,
      });
      return;
    }

    const qCount = quiz.questionsCount ?? (quiz.questions?.length ?? 0);
    const nextIsActive = !quiz.isActive;

    if (nextIsActive && qCount === 0) {
      setToastMsg({
        type: 'warning',
        text: 'Cannot activate a quiz with 0 questions. Please add questions first.',
      });
      return;
    }

    const previous = quizzes;
    setQuizzes((prev) => prev.map((q) => (q.id === quiz.id ? { ...q, isActive: nextIsActive } : q)));
    setUpdatingStatusQuizId(quiz.id);

    try {
      await ApiClient.updateQuiz(quiz.id, { isActive: nextIsActive });
      setToastMsg({
        type: 'success',
        text: `Status updated to ${nextIsActive ? 'Active' : 'Inactive'}`,
      });
    } catch (err: any) {
      setQuizzes(previous);
      setToastMsg({ type: 'error', text: err.message || 'Failed to update status.' });
    } finally {
      setUpdatingStatusQuizId(null);
    }
  };

  if (!mounted) {
    return (
      <div className="space-y-6">
        <AdminSkeletonHeader />
        <AdminSkeletonTable rowsCount={4} colsCount={7} />
      </div>
    );
  }

  const filteredSubFolders = subFolders.filter((sf) => {
    if (selectedAccessFilter !== 'ALL') {
      return false;
    }
    const matchesSearch =
      !searchTerm ||
      sf.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sf.description && sf.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus =
      selectedStatusFilter === 'ALL' ||
      (selectedStatusFilter === 'ACTIVE' ? sf.isActive !== false : sf.isActive === false);
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-3 duration-200 ${
            toastMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
              : toastMsg.type === 'warning'
                ? 'bg-amber-50 dark:bg-amber-950/90 border-amber-500/40 text-amber-800 dark:text-amber-300'
                : 'bg-rose-50 dark:bg-rose-950/90 border-rose-500/40 text-rose-800 dark:text-rose-300'
          }`}
        >
          <span>{toastMsg.text}</span>
          <button type="button" onClick={() => setToastMsg(null)} className="ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header & Breadcrumb */}
      <div className="shrink-0 space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
          <Link
            href="/admin/quizzes"
            className="font-bold text-cyan-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1"
          >
            <Folder className="w-3.5 h-3.5 text-amber-500" />
            <span>Quiz Folders</span>
          </Link>
          {currentFolderData?.parentName && (
            <>
              <ChevronRight className="w-3 h-3 text-slate-400" />
              <Link
                href={`/admin/quizzes/folder/${encodeURIComponent(currentFolderData.parentName)}`}
                className="font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
              >
                {currentFolderData.parentName}
              </Link>
            </>
          )}
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span className="font-extrabold text-slate-900 dark:text-white">{currentFolder}</span>
        </div>

        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 shadow-inner">
                <Folder className="w-4.5 h-4.5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {currentFolder === 'Root' ? 'Root Level Quizzes' : currentFolder}
              </h1>
              <Badge variant="gold" className="font-extrabold text-xs">
                {totalCount} {totalCount === 1 ? 'Quiz' : 'Quizzes'}
              </Badge>
              {subFolders.length > 0 && (
                <Badge variant="default" className="font-bold text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {subFolders.length} {subFolders.length === 1 ? 'Sub-folder' : 'Sub-folders'}
                </Badge>
              )}
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
              Manage sub-folders, questions, settings, pricing, and live mock tests inside &ldquo;{currentFolder}&rdquo;.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="font-bold cursor-pointer border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 shadow-2xs"
              onClick={() => handleOpenCreateSubFolder()}
            >
              <Plus className="w-4 h-4" />
              <span>Add Sub-folder</span>
            </Button>
            <Button
              variant="gold"
              size="sm"
              className="font-bold shadow-md shadow-cyan-500/20 cursor-pointer"
              onClick={handleOpenCreateModal}
            >
              <Plus className="w-4 h-4" />
              <span>Create Quiz in Folder</span>
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <Card className="p-3 glass-card space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input
                placeholder="Search quiz or folder title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <Select
              value={selectedAccessFilter}
              onChange={(val) => setSelectedAccessFilter(val)}
              icon={<Filter className="w-4 h-4 text-cyan-500" />}
              options={[
                { value: 'ALL', label: 'All Access Types (Free & Paid)' },
                { value: 'FREE', label: 'Free Quizzes Only' },
                { value: 'PAID', label: 'Paid / Premium Quizzes Only' },
              ]}
            />

            <Select
              value={selectedStatusFilter}
              onChange={(val) => setSelectedStatusFilter(val)}
              icon={<CheckCircle2 className="w-4 h-4 text-cyan-500" />}
              options={[
                { value: 'ALL', label: 'All Statuses (Active & Hidden)' },
                { value: 'ACTIVE', label: 'Active / Published' },
                { value: 'INACTIVE', label: 'Hidden / Draft' },
              ]}
            />
          </div>
        </Card>
      </div>

      {/* Folders & Quizzes Table Card */}
      <Card className="flex-1 flex flex-col min-h-0 border border-slate-200/80 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] shadow-sm overflow-hidden p-0">
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <AdminSkeletonTable rowsCount={5} colsCount={6} />
          ) : filteredSubFolders.length === 0 && quizzes.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
                <Folder className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  No Folders or Quizzes in &ldquo;{currentFolder}&rdquo;
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                  Click &ldquo;Add Sub-folder&rdquo; to organize topics or &ldquo;Create Quiz in Folder&rdquo; to add quizzes here.
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200/80 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#0c152e]/50">
                  <TableHead className="font-bold text-xs">Item Details</TableHead>
                  <TableHead className="font-bold text-xs">Type / Access</TableHead>
                  <TableHead className="font-bold text-xs">Config / Contents</TableHead>
                  <TableHead className="font-bold text-xs">Schedule</TableHead>
                  <TableHead className="font-bold text-xs">Status</TableHead>
                  <TableHead className="font-bold text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Sub-Folders Rows */}
                {filteredSubFolders.map((sf) => (
                  <React.Fragment key={`folder-fragment-${sf.id}`}>
                    <TableRow
                      key={`folder-${sf.id}`}
                      className="border-b border-slate-100 dark:border-[#1e2e56]/40 hover:bg-amber-500/[0.04] dark:hover:bg-amber-500/[0.04] transition-colors group"
                    >
                      {/* Item Details with Expand Chevron */}
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleExpandFolder(sf)}
                            className="p-1 rounded text-slate-400 hover:text-cyan-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                            title={expandedFolders[sf.id] ? 'Collapse inner contents' : 'Expand inner contents'}
                          >
                            <ChevronRight
                              className={`w-4 h-4 transition-transform duration-200 ${
                                expandedFolders[sf.id] ? 'rotate-90 text-cyan-500' : ''
                              }`}
                            />
                          </button>

                          <Link
                            href={`/admin/quizzes/folder/${encodeURIComponent(sf.name)}`}
                            className="flex items-center gap-2.5 group/link min-w-[260px]"
                          >
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 shadow-inner group-hover/link:scale-105 transition-transform">
                              <Folder className="w-4 h-4" />
                            </div>
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate group-hover/link:text-amber-600 dark:group-hover/link:text-amber-400 transition-colors">
                                  {sf.name}
                                </span>
                                <Badge variant="default" className="text-[10px] px-1.5 py-0 font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                                  Sub-folder
                                </Badge>
                              </div>
                              {sf.description && (
                                <p className="text-[11px] text-slate-400 truncate max-w-xs">{sf.description}</p>
                              )}
                            </div>
                          </Link>
                        </div>
                      </TableCell>

                      {/* Type / Access */}
                      <TableCell className="py-3">
                        <Badge variant="outline" className="font-bold text-xs flex items-center gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5">
                          <Folder className="w-3 h-3" />
                          <span>Folder</span>
                        </Badge>
                      </TableCell>

                      {/* Config / Contents */}
                      <TableCell className="py-3">
                        <div className="text-xs space-y-0.5 font-mono">
                          <p className="font-bold text-cyan-600 dark:text-cyan-400">
                            {sf.quizCount || 0} {(sf.quizCount || 0) === 1 ? 'Quiz' : 'Quizzes'}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Inside sub-folder
                          </p>
                        </div>
                      </TableCell>

                      {/* Schedule */}
                      <TableCell className="py-3">
                        <span className="text-xs text-slate-400 font-mono">—</span>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-3">
                        {sf.isActive !== false ? (
                          <Badge variant="success" className="font-bold text-xs flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Active</span>
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="font-bold text-xs flex items-center gap-1 text-slate-400">
                            <Eye className="w-3 h-3" />
                            <span>Hidden</span>
                          </Badge>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-3 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 px-2 font-bold text-cyan-600 dark:text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10 cursor-pointer"
                            onClick={() => handleOpenCreateQuizInSubFolder(sf.name)}
                            title={`Create quiz in ${sf.name}`}
                          >
                            <Plus className="w-3 h-3 mr-0.5" />
                            <span>Quiz</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 px-2 font-bold text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 cursor-pointer"
                            onClick={() => handleOpenCreateSubFolder(sf)}
                            title={`Create sub-folder inside ${sf.name}`}
                          >
                            <Plus className="w-3 h-3 mr-0.5" />
                            <span>Folder</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-400 hover:text-amber-500 h-7 w-7 p-0 cursor-pointer"
                            onClick={() => handleOpenEditSubFolder(sf)}
                            title="Edit Sub-folder"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-400 hover:text-rose-500 h-7 w-7 p-0 cursor-pointer"
                            onClick={() => setDeleteSubFolderTarget(sf)}
                            title="Delete Sub-folder"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expanded Dropdown Tree Children */}
                    {expandedFolders[sf.id] && (
                      <>
                        {subFolderContents[sf.id]?.loading ? (
                          <TableRow className="bg-slate-50/40 dark:bg-[#0c152e]/30 border-b border-slate-100 dark:border-[#1e2e56]/30">
                            <TableCell colSpan={6} className="py-3 pl-12">
                              <div className="flex items-center space-x-2 text-xs text-slate-400">
                                <span className="w-3.5 h-3.5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                                <span>Loading inner contents for &ldquo;{sf.name}&rdquo;...</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (subFolderContents[sf.id]?.quizzes?.length === 0 && subFolderContents[sf.id]?.subFolders?.length === 0) ? (
                          <TableRow className="bg-slate-50/40 dark:bg-[#0c152e]/30 border-b border-slate-100 dark:border-[#1e2e56]/30">
                            <TableCell colSpan={6} className="py-3 pl-12">
                              <div className="flex items-center justify-between py-1 flex-wrap gap-2">
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                  <span className="text-slate-300 dark:text-slate-600 font-mono">└──</span>
                                  <span>No quizzes or inner folders inside &ldquo;{sf.name}&rdquo; yet.</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs h-7 px-2 font-bold text-cyan-600 border-cyan-500/30 hover:bg-cyan-500/10 cursor-pointer"
                                    onClick={() => handleOpenCreateQuizInSubFolder(sf.name)}
                                  >
                                    <Plus className="w-3 h-3 mr-1" />
                                    <span>Add Quiz</span>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs h-7 px-2 font-bold text-amber-600 border-amber-500/30 hover:bg-amber-500/10 cursor-pointer"
                                    onClick={() => handleOpenCreateSubFolder(sf)}
                                  >
                                    <Plus className="w-3 h-3 mr-1" />
                                    <span>Add Sub-folder</span>
                                  </Button>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          <>
                            {/* Inner Nested Sub-Folders */}
                            {subFolderContents[sf.id]?.subFolders?.map((innerSf) => (
                              <TableRow
                                key={`inner-sf-${innerSf.id}`}
                                className="bg-slate-50/50 dark:bg-[#0c152e]/40 border-b border-slate-100 dark:border-[#1e2e56]/30 hover:bg-amber-500/[0.04] transition-colors"
                              >
                                <TableCell className="py-2.5 pl-10">
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-300 dark:text-slate-600 text-xs font-mono">├──</span>
                                    <Link
                                      href={`/admin/quizzes/folder/${encodeURIComponent(innerSf.name)}`}
                                      className="flex items-center gap-2 group/inner"
                                    >
                                      <div className="w-6 h-6 rounded bg-amber-500/10 text-amber-500 flex items-center justify-center">
                                        <Folder className="w-3.5 h-3.5" />
                                      </div>
                                      <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 group-hover/inner:text-amber-500">
                                        {innerSf.name}
                                      </span>
                                      <Badge variant="default" className="text-[9px] px-1 py-0 bg-amber-500/10 text-amber-600">
                                        Sub-folder
                                      </Badge>
                                    </Link>
                                  </div>
                                </TableCell>
                                <TableCell className="py-2.5">
                                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">
                                    Folder
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-2.5 text-xs font-mono text-cyan-600">
                                  {innerSf.quizCount || 0} Quizzes
                                </TableCell>
                                <TableCell className="py-2.5 text-xs text-slate-400 font-mono">—</TableCell>
                                <TableCell className="py-2.5">
                                  {innerSf.isActive !== false ? (
                                    <Badge variant="success" className="text-[10px]">Active</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] text-slate-400">Hidden</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="py-2.5 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Link href={`/admin/quizzes/folder/${encodeURIComponent(innerSf.name)}`}>
                                      <Button variant="outline" size="sm" className="text-xs h-6 px-1.5 font-bold cursor-pointer">
                                        Open
                                      </Button>
                                    </Link>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-slate-400 hover:text-amber-500 cursor-pointer"
                                      onClick={() => handleOpenEditSubFolder(innerSf)}
                                    >
                                      <Edit3 className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-slate-400 hover:text-rose-500 cursor-pointer"
                                      onClick={() => setDeleteSubFolderTarget(innerSf)}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}

                            {/* Inner Nested Quizzes */}
                            {subFolderContents[sf.id]?.quizzes?.map((innerQuiz) => {
                              const innerRel = formatReleaseDateTime(innerQuiz.releaseDate);
                              const innerPaid = innerQuiz.accessType === 'PAID';
                              return (
                                <TableRow
                                  key={`inner-quiz-${innerQuiz.id}`}
                                  className="bg-slate-50/30 dark:bg-[#0c152e]/25 border-b border-slate-100 dark:border-[#1e2e56]/30 hover:bg-cyan-500/[0.04] transition-colors"
                                >
                                  <TableCell className="py-2.5 pl-10">
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-300 dark:text-slate-600 text-xs font-mono">└──</span>
                                      <div className="space-y-0.5">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200">
                                            {innerQuiz.title}
                                          </span>
                                          {innerQuiz.isLiveMock && (
                                            <Badge variant="gold" className="text-[9px] px-1 py-0 font-bold">
                                              🔥 Live
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-2.5">
                                    {innerQuiz.accessType === 'PAID' ? (
                                      <Badge variant="gold" className="text-[10px]">₹{innerQuiz.price || 0}</Badge>
                                    ) : (
                                      <Badge variant="success" className="text-[10px]">FREE</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="py-2.5 text-xs font-mono text-slate-600 dark:text-slate-400">
                                    {innerQuiz.questionsCount} Qs · {innerQuiz.durationMinutes}m
                                  </TableCell>
                                  <TableCell className="py-2.5 text-xs text-slate-400">
                                    {formatReleaseDateTime(innerQuiz.releaseDate).fullFormatted}
                                  </TableCell>
                                  <TableCell className="py-2.5">
                                    <button
                                      type="button"
                                      onClick={() => handleQuickToggleActive(innerQuiz)}
                                      className="cursor-pointer"
                                    >
                                      <Badge className={`text-[9px] ${innerQuiz.isActive ? 'bg-emerald-500/15 text-emerald-800' : 'bg-rose-500/10 text-rose-700'}`}>
                                        {innerQuiz.isActive ? 'Active' : 'Hidden'}
                                      </Badge>
                                    </button>
                                  </TableCell>
                                  <TableCell className="py-2.5 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Link href={`/admin/quizzes/${innerQuiz.id}/questions`}>
                                        <Button size="sm" variant="outline" className="text-xs h-6 px-1.5 font-bold border-cyan-500/30 text-cyan-600 cursor-pointer">
                                          <ListChecks className="w-3 h-3 mr-0.5" />
                                          <span>Questions</span>
                                        </Button>
                                      </Link>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 w-6 p-0 cursor-pointer"
                                        onClick={() => handleOpenEditModal(innerQuiz)}
                                      >
                                        <Edit3 className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="danger"
                                        className="h-6 w-6 p-0 cursor-pointer"
                                        onClick={() => setDeleteTarget(innerQuiz)}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </>
                        )}
                      </>
                    )}
                  </React.Fragment>
                ))}

                {/* Quizzes Rows */}
                {quizzes.map((quiz) => {
                  const rel = formatReleaseDateTime(quiz.releaseDate);
                  const isPaid = quiz.accessType === 'PAID';

                  return (
                    <TableRow
                      key={quiz.id}
                      className="border-b border-slate-100 dark:border-[#1e2e56]/40 hover:bg-slate-50/60 dark:hover:bg-[#0c152e]/40 transition-colors"
                    >
                      {/* Quiz Details */}
                      <TableCell className="py-3">
                        <div className="space-y-1 min-w-[200px] max-w-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                              {quiz.title}
                            </span>
                            {quiz.isLiveMock && (
                              <Badge variant="gold" className="text-[10px] px-1.5 py-0 font-bold shrink-0">
                                🔥 Live Mock
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Access Type */}
                      <TableCell className="py-3">
                        {isPaid ? (
                          <Badge variant="gold" className="font-bold text-xs flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            <span>₹{quiz.price || 0}</span>
                          </Badge>
                        ) : (
                          <Badge variant="success" className="font-bold text-xs flex items-center gap-1">
                            <Unlock className="w-3 h-3" />
                            <span>FREE</span>
                          </Badge>
                        )}
                      </TableCell>

                      {/* Config */}
                      <TableCell className="py-3">
                        <div className="text-xs space-y-0.5 font-mono">
                          <p className="font-bold text-slate-700 dark:text-slate-300">
                            {quiz.questionsCount} {quiz.questionsCount === 1 ? 'Question' : 'Questions'}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {quiz.durationMinutes} Minutes · Pass: {quiz.passingScore ?? 40}%
                          </p>
                        </div>
                      </TableCell>

                      {/* Schedule */}
                      <TableCell className="py-3">
                        <div className="space-y-0.5 text-xs font-mono">
                          <p className="font-bold text-slate-800 dark:text-slate-200">
                            {rel.formattedDate}
                          </p>
                          {rel.formattedTime && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {rel.formattedTime}
                            </p>
                          )}
                          {rel.isUpcoming && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500/40 text-amber-600 dark:text-amber-400">
                              Scheduled
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-3">
                        <button
                          type="button"
                          onClick={() => handleQuickToggleActive(quiz)}
                          className="cursor-pointer transition-transform hover:scale-105"
                          title="Click to toggle status"
                        >
                          {quiz.isActive ? (
                            <Badge variant="success" className="font-bold text-xs flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Active</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="font-bold text-xs flex items-center gap-1 text-slate-400">
                              <Eye className="w-3 h-3" />
                              <span>Hidden</span>
                            </Badge>
                          )}
                        </button>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <Link href={`/admin/quizzes/${quiz.id}/questions`}>
                            <Button variant="outline" size="sm" className="font-bold text-xs h-7 px-2 border-cyan-500/30 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 cursor-pointer">
                              <ListChecks className="w-3.5 h-3.5 mr-1" />
                              <span>Questions</span>
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-400 hover:text-amber-500 h-7 w-7 p-0 cursor-pointer"
                            onClick={() => handleOpenEditModal(quiz)}
                            title="Edit Quiz"
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-400 hover:text-rose-500 h-7 w-7 p-0 cursor-pointer"
                            onClick={() => setDeleteTarget(quiz)}
                            title="Delete Quiz"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination Footer */}
        {totalCount > pageSize && (
          <div className="shrink-0 p-3 border-t border-slate-200/80 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#0c152e]/50">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalCount}
              pageSize={pageSize}
              pageSizeOptions={[10, 20, 50]}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
            />
          </div>
        )}
      </Card>

      {/* Quiz Builder Dialog */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setEditingQuizId(null);
          setOriginalReleaseIso(undefined);
          setFormSubmitError('');
        }}
        title={editingQuizId ? `Edit Quiz: ${formik.values.title}` : `Create New Quiz in "${formik.values.selectedFolder || currentFolder}"`}
        className="max-w-2xl"
      >
        <form className="space-y-4 pt-2 max-h-[75vh] overflow-y-auto px-1 custom-scrollbar" onSubmit={formik.handleSubmit} noValidate>
          {formSubmitError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold">
              {formSubmitError}
            </div>
          )}

          <Input
            label="Quiz Title"
            name="title"
            placeholder="e.g. Kerala PSC General Science Mock 2026"
            value={formik.values.title}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.title && formik.errors.title ? formik.errors.title : undefined}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Duration (Minutes)"
              name="duration"
              type="number"
              value={formik.values.duration}
              onChange={formik.handleChange}
              error={formik.touched.duration && formik.errors.duration ? formik.errors.duration : undefined}
            />
            <Input
              label="Passing Score (%)"
              name="passingScore"
              type="number"
              value={formik.values.passingScore}
              onChange={formik.handleChange}
              error={formik.touched.passingScore && formik.errors.passingScore ? formik.errors.passingScore : undefined}
            />
          </div>

          {/* Access Type & Pricing */}
          <div className="space-y-2 p-3 rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#0c152e]/50">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Access Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  formik.setFieldValue('accessType', 'FREE');
                  formik.setFieldValue('negativeMarkingEnabled', false);
                }}
                className={`p-2.5 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  formik.values.accessType === 'FREE'
                    ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/50 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Unlock className="w-4 h-4" />
                <span>Free Access</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  formik.setFieldValue('accessType', 'PAID');
                  formik.setFieldValue('negativeMarkingEnabled', true);
                }}
                className={`p-2.5 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  formik.values.accessType === 'PAID'
                    ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/50 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>Paid / Premium</span>
              </button>
            </div>

            {formik.values.accessType === 'PAID' && (
              <div className="pt-2">
                <Input
                  label="Price (INR ₹)"
                  name="price"
                  type="number"
                  placeholder="e.g. 99"
                  value={formik.values.price}
                  onChange={formik.handleChange}
                  error={formik.touched.price && formik.errors.price ? formik.errors.price : undefined}
                />
              </div>
            )}
          </div>

          {/* Negative Marking */}
          <div className="space-y-2 p-3 rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#0c152e]/50">
            <ToggleSwitch
              icon={HelpCircle}
              variant="amber"
              label="Negative Marking"
              description="Deduct marks for incorrect answers."
              checked={formik.values.negativeMarkingEnabled}
              onChange={(checked) => formik.setFieldValue('negativeMarkingEnabled', checked)}
            />

            {formik.values.negativeMarkingEnabled && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Input
                  label="For every N wrong answers"
                  name="negativeMarkingEvery"
                  type="number"
                  value={formik.values.negativeMarkingEvery}
                  onChange={formik.handleChange}
                />
                <Input
                  label="Deduct marks"
                  name="negativeMarkingDeduct"
                  type="number"
                  value={formik.values.negativeMarkingDeduct}
                  onChange={formik.handleChange}
                />
              </div>
            )}
          </div>

          {/* Release Schedule */}
          <div className="space-y-2 p-3 rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#0c152e]/50">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-cyan-500" />
              <span>Release Schedule (Optional)</span>
            </label>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Leave blank to publish immediately once active.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <DatePicker
                label="Release Date"
                value={formik.values.releaseDate}
                onChange={(val) => formik.setFieldValue('releaseDate', val)}
              />
              <TimePicker
                label="Release Time"
                value={formik.values.releaseTime}
                onChange={(val) => formik.setFieldValue('releaseTime', val)}
              />
            </div>
          </div>

          {/* Live Mock Test */}
          <div className="space-y-2 p-3 rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#0c152e]/50">
            <ToggleSwitch
              icon={Radio}
              variant="rose"
              label="Live Mock Test Session"
              description="Schedule as a timed live mock test with rank list."
              checked={formik.values.isLive}
              onChange={(checked) => {
                formik.setFieldValue('isLive', checked);
                if (checked && !formik.values.mockTestTitle) {
                  formik.setFieldValue('mockTestTitle', formik.values.title);
                }
              }}
            />

            {formik.values.isLive && (
              <div className="space-y-3 pt-2">
                <Input
                  label="Mock Test Session Title"
                  name="mockTestTitle"
                  value={formik.values.mockTestTitle}
                  onChange={formik.handleChange}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <DatePicker
                    label="Scheduled Date"
                    value={formik.values.mockTestDate}
                    onChange={(val) => formik.setFieldValue('mockTestDate', val)}
                  />
                  <TimePicker
                    label="Scheduled Time"
                    value={formik.values.mockTestTime}
                    onChange={(val) => formik.setFieldValue('mockTestTime', val)}
                  />
                </div>
              </div>
            )}
          </div>

          <ToggleSwitch
            icon={Eye}
            variant="emerald"
            label="Active / Visible to students"
            description="When OFF, this quiz is hidden from students."
            checked={formik.values.isActive}
            onChange={(checked) => formik.setFieldValue('isActive', checked)}
          />

          <Button
            type="submit"
            variant="gold"
            className="w-full font-bold shadow-md shadow-cyan-500/20 cursor-pointer"
            isLoading={formik.isSubmitting}
          >
            {editingQuizId ? 'Save Quiz Settings' : 'Create Quiz & Add Questions'}
          </Button>
        </form>
      </Dialog>

      {/* Sub-folder Create / Edit Dialog */}
      <Dialog
        isOpen={isSubFolderDialogOpen}
        onClose={() => setIsSubFolderDialogOpen(false)}
        title={editingSubFolder ? `Edit Sub-folder in "${currentFolder}"` : `Create Sub-folder in "${currentFolder}"`}
      >
        <form onSubmit={handleSaveSubFolder} className="space-y-4 pt-2">
          {subFolderError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center space-x-2">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>{subFolderError}</span>
            </div>
          )}

          <Input
            label="Sub-folder Name"
            placeholder="e.g. 5th STD Social Science"
            value={subFolderName}
            onChange={(e) => setSubFolderName(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="Description (Optional)"
            placeholder="Brief notes about quizzes in this sub-folder"
            value={subFolderDesc}
            onChange={(e) => setSubFolderDesc(e.target.value)}
          />

          <ToggleSwitch
            icon={Eye}
            variant="emerald"
            label="Active / Visible to students"
            description="When OFF, this sub-folder and its quizzes are hidden from students."
            checked={subFolderActive}
            onChange={(checked) => setSubFolderActive(checked)}
          />

          <Button
            type="submit"
            variant="gold"
            className="w-full font-bold shadow-md shadow-cyan-500/20 cursor-pointer"
            isLoading={subFolderSaving}
          >
            {editingSubFolder ? 'Update Sub-folder' : 'Create Sub-folder'}
          </Button>
        </form>
      </Dialog>

      {/* Delete Sub-folder Confirmation */}
      <ConfirmDialog
        isOpen={deleteSubFolderTarget !== null}
        title="Delete Sub-folder"
        description={
          deleteSubFolderTarget
            ? `Are you sure you want to delete sub-folder "${deleteSubFolderTarget.name}"? Quizzes inside will be moved to "${currentFolder}".`
            : undefined
        }
        confirmLabel="Delete Sub-folder"
        variant="danger"
        onConfirm={() => {
          if (deleteSubFolderTarget) handleDeleteSubFolder(deleteSubFolderTarget);
          setDeleteSubFolderTarget(null);
        }}
        onCancel={() => setDeleteSubFolderTarget(null)}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete Quiz"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.title}" and its questions? This action cannot be undone.`
            : undefined
        }
        confirmLabel="Delete Quiz"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) handleDeleteQuiz(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
