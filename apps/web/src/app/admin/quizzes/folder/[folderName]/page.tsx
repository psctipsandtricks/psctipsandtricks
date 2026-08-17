'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { ApiClient } from '@/lib/api-client';
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
  category: string;
  folderName: string;
  releaseDate?: string;
  passingScore?: number;
  topic?: string;
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
  category: string;
  duration: string;
  passingScore: string;
  selectedTopic: string;
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
  category: 'General',
  duration: '30',
  passingScore: '60',
  selectedTopic: '',
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
  const rawFolderName = params?.folderName as string;
  const currentFolder = rawFolderName ? decodeURIComponent(rawFolderName) : 'Root';

  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [mockTestByQuizId, setMockTestByQuizId] = useState<Record<string, any>>({});

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
      category: apiQuiz.category || 'General',
      folderName: (!apiQuiz.folderName || apiQuiz.folderName === 'Root / No Folder' || apiQuiz.folderName === 'Root') ? 'Root' : apiQuiz.folderName,
      releaseDate: apiQuiz.releaseDate,
      passingScore: apiQuiz.passingMarks,
      topic: apiQuiz.topic,
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

  const fetchQuizzes = useCallback(async () => {
    try {
      setLoading(true);
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
      setLoading(false);
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
    fetchQuizzes();
    fetchMockTests();
  }, [fetchQuizzes, fetchMockTests]);

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
        category: values.category || 'General',
        folderName: currentFolder,
        accessType: values.accessType || 'FREE',
        isActive: values.isActive,
        showCorrectAnswerAfterSelection: values.showCorrectAnswerAfterSelection,
        releaseDate: isAlreadyReleased ? undefined : (fullReleaseIso || undefined),
        topic: values.selectedTopic || undefined,
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
          await ApiClient.updateQuiz(editingQuizId, apiPayload);
          await syncLiveMockTest(editingQuizId, values);
          setToastMsg({ type: 'success', text: 'Quiz updated successfully.' });
          setIsDialogOpen(false);
          await Promise.all([fetchQuizzes(), fetchMockTests()]);
        } else {
          createdOrUpdated = await ApiClient.createQuiz(apiPayload);
          if (createdOrUpdated?.id) {
            await syncLiveMockTest(createdOrUpdated.id, values);
          }
          setIsDialogOpen(false);
          if (createdOrUpdated?.id) {
            router.push(`/admin/quizzes/${createdOrUpdated.id}/questions`);
          } else {
            await Promise.all([fetchQuizzes(), fetchMockTests()]);
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
        category: quiz.category || 'General',
        duration: String(quiz.durationMinutes),
        passingScore: quiz.passingScore ? String(quiz.passingScore) : '60',
        selectedTopic: quiz.topic || '',
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
    setQuizzes((prev) => prev.filter((q) => q.id !== id));
    try {
      await ApiClient.deleteQuiz(id);
      setToastMsg({ type: 'success', text: 'Quiz deleted successfully.' });
      await fetchQuizzes();
    } catch (err: any) {
      setQuizzes(previous);
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
        <Link
          href="/admin/quizzes"
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Folders</span>
        </Link>

        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                <Folder className="w-4.5 h-4.5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {currentFolder === 'Root' ? 'Root Level Quizzes' : currentFolder}
              </h1>
              <Badge variant="gold" className="font-extrabold text-xs">
                {totalCount} {totalCount === 1 ? 'Quiz' : 'Quizzes'}
              </Badge>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
              Manage questions, settings, pricing, and live mock tests inside &ldquo;{currentFolder}&rdquo;.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <Button
              variant="gold"
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
                placeholder="Search quiz title..."
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

      {/* Quizzes Table Card */}
      <Card className="flex-1 flex flex-col min-h-0 border border-slate-200/80 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] shadow-sm overflow-hidden p-0">
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <AdminSkeletonTable rowsCount={5} colsCount={6} />
          ) : quizzes.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  No Quizzes in this Folder
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                  Click &ldquo;Create Quiz in Folder&rdquo; to add your first question bank here.
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200/80 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#0c152e]/50">
                  <TableHead className="font-bold text-xs">Quiz Details</TableHead>
                  <TableHead className="font-bold text-xs">Access</TableHead>
                  <TableHead className="font-bold text-xs">Config</TableHead>
                  <TableHead className="font-bold text-xs">Schedule</TableHead>
                  <TableHead className="font-bold text-xs">Status</TableHead>
                  <TableHead className="font-bold text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
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
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-semibold">{quiz.category}</span>
                            {quiz.topic && <span>· {quiz.topic}</span>}
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
                            {quiz.questionsCount} Qs · {quiz.durationMinutes}m
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Pass: {quiz.passingScore ?? 40}%
                            {quiz.negativeMarkingEnabled ? ' · Neg Marking ON' : ''}
                          </p>
                        </div>
                      </TableCell>

                      {/* Schedule */}
                      <TableCell className="py-3">
                        <div className="text-xs">
                          {rel.isUpcoming ? (
                            <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{rel.fullFormatted}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 dark:text-slate-400">{rel.fullFormatted}</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Status Toggle */}
                      <TableCell className="py-3">
                        <button
                          type="button"
                          onClick={() => handleQuickToggleActive(quiz)}
                          disabled={updatingStatusQuizId === quiz.id}
                          className="cursor-pointer"
                        >
                          <Badge
                            className={`text-[10px] font-extrabold ${
                              quiz.isActive
                                ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'
                            }`}
                          >
                            {updatingStatusQuizId === quiz.id
                              ? 'Saving…'
                              : quiz.isActive
                                ? 'Active'
                                : 'Hidden'}
                          </Badge>
                        </button>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/admin/quizzes/${quiz.id}/questions`}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="px-2.5 py-1 text-xs font-bold flex items-center gap-1 border-cyan-500/30 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 cursor-pointer"
                              title="Manage Questions"
                            >
                              <ListChecks className="w-3.5 h-3.5" />
                              <span>Questions</span>
                            </Button>
                          </Link>

                          <Button
                            size="sm"
                            variant="outline"
                            className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-amber-600 cursor-pointer"
                            title="Edit Quiz Settings"
                            onClick={() => handleOpenEditModal(quiz)}
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>

                          <Button
                            size="sm"
                            variant="danger"
                            className="p-1.5 hover:text-rose-600 cursor-pointer"
                            title="Delete Quiz"
                            onClick={() => setDeleteTarget(quiz)}
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
        onClose={() => setIsDialogOpen(false)}
        title={editingQuizId ? 'Edit Quiz Settings' : `Create New Quiz in "${currentFolder}"`}
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
              label="Category"
              name="category"
              placeholder="e.g. General Knowledge"
              value={formik.values.category}
              onChange={formik.handleChange}
            />
            <Input
              label="Topic (Optional)"
              name="selectedTopic"
              placeholder="e.g. Modern Indian History"
              value={formik.values.selectedTopic}
              onChange={formik.handleChange}
            />
          </div>

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
