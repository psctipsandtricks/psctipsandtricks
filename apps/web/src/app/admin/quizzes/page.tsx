'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { ApiClient } from '@/lib/api-client';
import { Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button, Dialog, ConfirmDialog, Input, Badge, Pagination, Skeleton, DatePicker, TimePicker, combineDateAndTime, splitIsoToDateAndTime } from '@psc/ui';
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
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  HelpCircle,
  Eye,
  Edit3,
  Layers,
  Sparkles,
  AlertCircle,
  Clock,
  Home,
  Flame,
  Check,
  Send,
  Settings,
  ListChecks,
  History,
  Radio,
  MinusCircle,
} from 'lucide-react';
import { AdminSkeletonHeader, AdminSkeletonTable } from '../admin-skeleton';

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
  description?: string;
  releaseDate?: string;
  passingScore?: number;
  bookId?: string;
  chapterId?: string;
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

const DEFAULT_FOLDERS = [
  'Root',
  'LDC Preparation 2026',
  'Polity & Constitution',
  'Kerala History & Culture',
];

const INITIAL_SAMPLE_QUIZZES: QuizItem[] = [
  {
    id: 'q-1',
    title: 'Kerala PSC LDC Mega Mock 2026',
    category: 'LDC / Tenth Level',
    folderName: 'LDC Preparation 2026',
    questionsCount: 2,
    durationMinutes: 75,
    isLiveMock: true,
    accessType: 'PAID',
    price: 199,
    questions: [
      {
        id: 'quest-101',
        text: 'Who was the founder of the Atma Vidya Sangham in Kerala?',
        marks: 1,
        explanation: 'Vagbhatananda established Atma Vidya Sangham in 1917 for social reform.',
        options: [
          { id: 'opt-1', text: 'Sree Narayana Guru' },
          { id: 'opt-2', text: 'Vagbhatananda' },
          { id: 'opt-3', text: 'Chattampi Swamikal' },
          { id: 'opt-4', text: 'Ayyankali' },
        ],
        correctOptionId: 'opt-2',
      },
      {
        id: 'quest-102',
        text: 'Which river is known as the Lifeline of Kerala?',
        marks: 1,
        explanation: 'Periyar River is the longest river in Kerala, stretching 244 km.',
        options: [
          { id: 'opt-1', text: 'Bharathapuzha' },
          { id: 'opt-2', text: 'Pamba River' },
          { id: 'opt-3', text: 'Periyar River' },
          { id: 'opt-4', text: 'Chaliyar River' },
        ],
        correctOptionId: 'opt-3',
      },
    ],
  },
  {
    id: 'q-2',
    title: 'Indian Constitution Special',
    category: 'Polity',
    folderName: 'Polity & Constitution',
    questionsCount: 1,
    durationMinutes: 20,
    isLiveMock: false,
    accessType: 'FREE',
    questions: [
      {
        id: 'quest-201',
        text: 'Which Article of the Indian Constitution abolishes Untouchability?',
        marks: 1,
        explanation: 'Article 17 prohibits the practice of untouchability in any form.',
        options: [
          { id: 'opt-a', text: 'Article 14' },
          { id: 'opt-b', text: 'Article 17' },
          { id: 'opt-c', text: 'Article 21' },
          { id: 'opt-d', text: 'Article 32' },
        ],
        correctOptionId: 'opt-b',
      },
    ],
  },
];

interface QuizFormValues {
  title: string;
  releaseDate: string;
  releaseTime: string;
  description: string;
  category: string;
  duration: string;
  passingScore: string;
  selectedBook: string;
  selectedChapter: string;
  selectedTopic: string;
  isActive: boolean;
  isLive: boolean;
  /** Name the session appears under in the Live Mock Tests list. */
  mockTestTitle: string;
  mockTestDate: string;
  mockTestTime: string;
  showCorrectAnswerAfterSelection: boolean;
  selectedFolder: string;
  newFolderName: string;
  accessType: 'FREE' | 'PAID' | '';
  price: string;
  negativeMarkingEnabled: boolean;
  negativeMarkingEvery: string;
  negativeMarkingDeduct: string;
  allowNegativeScore: boolean;
}

const EMPTY_QUESTION = (): QuizQuestion => ({
  id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  text: '',
  marks: 1,
  explanation: '',
  options: [
    { id: `opt-${Date.now()}-1`, text: '' },
    { id: `opt-${Date.now()}-2`, text: '' },
    { id: `opt-${Date.now()}-3`, text: '' },
    { id: `opt-${Date.now()}-4`, text: '' },
  ],
  correctOptionId: '',
});

const DEFAULT_QUIZ_FORM_VALUES: QuizFormValues = {
  title: '',
  releaseDate: '',
  releaseTime: '',
  description: '',
  category: '',
  duration: '30',
  passingScore: '60',
  selectedBook: '',
  selectedChapter: '',
  selectedTopic: '',
  isActive: true,
  isLive: false,
  mockTestTitle: '',
  mockTestDate: '',
  mockTestTime: '',
  showCorrectAnswerAfterSelection: true,
  selectedFolder: 'Root',
  newFolderName: '',
  accessType: 'FREE',
  price: '99',
  // Off by default for every quiz — selecting Paid/Premium access switches
  // this on automatically (see the Access Type radio's onChange below).
  negativeMarkingEnabled: false,
  negativeMarkingEvery: '3',
  negativeMarkingDeduct: '1',
  allowNegativeScore: false,
};

const quizSchema = Yup.object({
  title: Yup.string().trim().required('Quiz Title is required.'),
  duration: Yup.number().typeError('Duration must be a number').positive('Duration must be greater than 0 minutes.').required('Duration is required.'),
  passingScore: Yup.number().typeError('Passing score must be a number').min(0, 'Passing score cannot be negative.').max(100, 'Passing score cannot exceed 100%.').required('Passing score is required.'),
  accessType: Yup.string().oneOf(['FREE', 'PAID'], 'Access Type (Free or Paid) is mandatory. Please select one.').required('Access Type (Free or Paid) is mandatory. Please select one.'),
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
        .integer('Must be a whole number of questions.')
        .min(1, 'Must be at least 1 wrong answer.')
        .required('Required.'),
    otherwise: (schema) => schema.notRequired(),
  }),
  negativeMarkingDeduct: Yup.number().when('negativeMarkingEnabled', {
    is: true,
    then: (schema) =>
      schema.typeError('Must be a number').min(0, 'Cannot be negative.').required('Required.'),
    otherwise: (schema) => schema.notRequired(),
  }),
  // A live mock needs a name and a start time — both are required by the
  // scheduled session this quiz gets added to.
  mockTestTitle: Yup.string().when('isLive', {
    is: true,
    then: (schema) => schema.trim().required('Mock test title is required when the quiz is a live mock test.'),
    otherwise: (schema) => schema.notRequired(),
  }),
  mockTestDate: Yup.string().when('isLive', {
    is: true,
    then: (schema) => schema.trim().required('Scheduled date is required for a live mock test.'),
    otherwise: (schema) => schema.notRequired(),
  }),
  mockTestTime: Yup.string().when('isLive', {
    is: true,
    then: (schema) => schema.trim().required('Scheduled time is required for a live mock test.'),
    otherwise: (schema) => schema.notRequired(),
  }),
});

const SETTINGS_FIELD_KEYS = ['title', 'duration', 'passingScore', 'accessType', 'price'];

function getFirstFormikError(errors: any): string | null {
  if (!errors) return null;
  if (typeof errors === 'string') return errors;
  if (Array.isArray(errors)) {
    for (const e of errors) {
      const found = getFirstFormikError(e);
      if (found) return found;
    }
    return null;
  }
  if (typeof errors === 'object') {
    for (const key of Object.keys(errors)) {
      const found = getFirstFormikError(errors[key]);
      if (found) return found;
    }
  }
  return null;
}

export default function QuizAdminPage() {
  const router = useRouter();

  // Data state
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [folders, setFolders] = useState<string[]>(DEFAULT_FOLDERS);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  // Scheduled live sessions keyed by quiz, so the form can tell whether a quiz
  // already sits in the Live Mock Tests list and prefill / update it.
  const [mockTestByQuizId, setMockTestByQuizId] = useState<Record<string, any>>({});

  // Filter & Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFolderFilter, setSelectedFolderFilter] = useState('ALL');
  const [selectedAccessFilter, setSelectedAccessFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Quiz Builder Modal State (Quiz Details & Settings Only)
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);

  const [isCreatingNewFolder, setIsCreatingNewFolder] = useState(false);
  const [formSubmitError, setFormSubmitError] = useState('');

  // Inspector Modal State
  const [inspectQuiz, setInspectQuiz] = useState<QuizItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuizItem | null>(null);

  // Helper to map API response to local QuizItem format
  const mapApiQuizToLocal = useCallback((apiQuiz: any): QuizItem => {
    return {
      id: apiQuiz.id,
      title: apiQuiz.title,
      category: apiQuiz.category || 'General',
      folderName: (!apiQuiz.folderName || apiQuiz.folderName === 'Root / No Folder' || apiQuiz.folderName === 'Root') ? 'Root' : apiQuiz.folderName,
      description: apiQuiz.description,
      releaseDate: apiQuiz.releaseDate,
      passingScore: apiQuiz.passingMarks,
      bookId: apiQuiz.bookId,
      chapterId: apiQuiz.chapterId,
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

  // Fetch quizzes from the API on mount
  const fetchQuizzes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ApiClient.getQuizzes();
      const mapped = (data as any[]).map(mapApiQuizToLocal);
      setQuizzes(mapped);

      // Build folder list from API data
      const apiFolders = mapped.map((q) => q.folderName).filter((f) => f && f !== 'Root / No Folder' && f !== 'Root');
      const uniqueFolders = Array.from(new Set([...DEFAULT_FOLDERS, ...apiFolders]));
      setFolders(uniqueFolders);
    } catch (err) {
      console.error('Failed to fetch quizzes:', err);
    } finally {
      setLoading(false);
    }
  }, [mapApiQuizToLocal]);

  const fetchMockTests = useCallback(async () => {
    try {
      const mockTests = await ApiClient.getMockTests();
      const now = Date.now();
      const byQuiz: Record<string, any> = {};

      // A quiz can have several sessions. Point at the next upcoming one, or —
      // if they have all run — the most recent, so editing re-times the session
      // the admin is most likely thinking of.
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

  /**
   * Keeps the Live Mock Tests list in step with the quiz's toggle: switching it
   * on schedules the session (or re-times an existing one) so the quiz actually
   * shows up in that list. Switching it off leaves any existing session alone —
   * deleting it would discard participants' scores and ranks.
   */
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
    initialValues: DEFAULT_QUIZ_FORM_VALUES,
    validationSchema: quizSchema,
    onSubmit: async (values, { setSubmitting }) => {
      // Determine target folder
      let targetFolder = values.selectedFolder;
      if (isCreatingNewFolder && values.newFolderName.trim()) {
        targetFolder = values.newFolderName.trim();
        if (!folders.includes(targetFolder)) {
          setFolders((prev) => [...prev, targetFolder]);
        }
      }

      const numericPrice = values.accessType === 'PAID' ? Number(values.price) || 0 : 0;
      const fullReleaseIso = combineDateAndTime(values.releaseDate, values.releaseTime);

      const apiPayload = {
        title: values.title.trim(),
        category: 'General',
        description: values.description || '',
        folderName: (!targetFolder || targetFolder === 'Root / No Folder' || targetFolder === 'Root') ? 'Root' : targetFolder,
        accessType: values.accessType || 'FREE',
        isActive: values.isActive,
        showCorrectAnswerAfterSelection: values.showCorrectAnswerAfterSelection,
        releaseDate: fullReleaseIso || undefined,
        bookId: values.selectedBook || undefined,
        chapterId: values.selectedChapter || undefined,
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
          await Promise.all([fetchQuizzes(), fetchMockTests()]);
          setIsDialogOpen(false);
        } else {
          createdOrUpdated = await ApiClient.createQuiz(apiPayload);
          if (createdOrUpdated?.id) {
            await syncLiveMockTest(createdOrUpdated.id, values);
          }
          setIsDialogOpen(false);
          if (createdOrUpdated?.id) {
            await fetchMockTests();
            router.push(`/admin/quizzes/${createdOrUpdated.id}/questions`);
          } else {
            await Promise.all([fetchQuizzes(), fetchMockTests()]);
          }
        }
      } catch (err: any) {
        setFormSubmitError(err.message || 'Failed to save quiz settings. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
  });

  if (!mounted) {
    return (
      <div className="space-y-6">
        <AdminSkeletonHeader />
        <AdminSkeletonTable rowsCount={4} colsCount={7} />
      </div>
    );
  }

  // Open Creation Settings Builder
  const handleOpenCreateModal = () => {
    setEditingQuizId(null);
    setIsCreatingNewFolder(false);
    setFormSubmitError('');
    formik.resetForm({
      values: {
        ...DEFAULT_QUIZ_FORM_VALUES,
      },
    });
    setIsDialogOpen(true);
  };

  // Open Edit Settings Builder
  const handleOpenEditModal = (quiz: QuizItem) => {
    setEditingQuizId(quiz.id);
    setIsCreatingNewFolder(false);
    setFormSubmitError('');
    const { date: relDate, time: relTime } = splitIsoToDateAndTime(quiz.releaseDate);
    // Prefill from the session this quiz is already scheduled as, so editing
    // re-times that session instead of creating a duplicate.
    const existingMockTest = mockTestByQuizId[quiz.id];
    const { date: mockDate, time: mockTime } = splitIsoToDateAndTime(existingMockTest?.scheduledAt);
    formik.resetForm({
      values: {
        title: quiz.title,
        releaseDate: relDate,
        releaseTime: relTime,
        description: quiz.description || '',
        category: quiz.category || 'General',
        duration: String(quiz.durationMinutes),
        passingScore: quiz.passingScore ? String(quiz.passingScore) : '60',
        selectedBook: quiz.bookId || '',
        selectedChapter: quiz.chapterId || '',
        selectedTopic: quiz.topic || '',
        isActive: quiz.isActive !== undefined ? quiz.isActive : true,
        isLive: quiz.isLiveMock,
        mockTestTitle: existingMockTest?.title || quiz.title,
        mockTestDate: mockDate,
        mockTestTime: mockTime,
        showCorrectAnswerAfterSelection: quiz.showCorrectAnswerAfterSelection ?? true,
        selectedFolder: (!quiz.folderName || quiz.folderName === 'Root / No Folder' || quiz.folderName === 'Root') ? 'Root' : quiz.folderName,
        newFolderName: '',
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

  // Whether the quiz being edited already has a scheduled session, so the form
  // can say it will update that one rather than add another.
  const editingExistingMockTest = !!(editingQuizId && mockTestByQuizId[editingQuizId]);

  /**
   * Premium quizzes are expected to be competitive, so switching to Paid
   * access turns Negative Marking on by default (with the standard 3-wrong
   * = -1 rule); switching back to Free turns it back off. Either way the
   * admin can still override the toggle by hand afterward — this only sets
   * the sensible starting point for the access level they just picked.
   */
  const handleAccessTypeChange = (accessType: 'FREE' | 'PAID') => {
    formik.setFieldValue('accessType', accessType);
    formik.setFieldValue('negativeMarkingEnabled', accessType === 'PAID');
  };

  /**
   * Turning the toggle on seeds the session title from the quiz title and the
   * schedule from the release date, so the common case is one click.
   */
  const handleToggleLiveMock = (enabled: boolean) => {
    formik.setFieldValue('isLive', enabled);
    if (!enabled) return;

    if (!formik.values.mockTestTitle.trim()) {
      formik.setFieldValue('mockTestTitle', formik.values.title.trim());
    }
    if (!formik.values.mockTestDate && formik.values.releaseDate) {
      formik.setFieldValue('mockTestDate', formik.values.releaseDate);
    }
    if (!formik.values.mockTestTime && formik.values.releaseTime) {
      formik.setFieldValue('mockTestTime', formik.values.releaseTime);
    }
  };

  const handleDeleteQuiz = async (id: string) => {
    try {
      await ApiClient.deleteQuiz(id);
      await fetchQuizzes();
    } catch (err: any) {
      alert(err.message || 'Failed to delete quiz.');
    }
  };

  // Filtered Quiz List
  const filteredQuizzes = quizzes.filter((quiz) => {
    const matchesSearch = quiz.title.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFolder =
      selectedFolderFilter === 'ALL' ||
      (selectedFolderFilter === 'ROOT' && (!quiz.folderName || quiz.folderName === 'Root / No Folder' || quiz.folderName === 'Root')) ||
      quiz.folderName === selectedFolderFilter;

    const matchesAccess = selectedAccessFilter === 'ALL' || quiz.accessType === selectedAccessFilter;

    const matchesStatus =
      selectedStatusFilter === 'ALL' ||
      (selectedStatusFilter === 'ACTIVE' && quiz.isActive !== false) ||
      (selectedStatusFilter === 'INACTIVE' && quiz.isActive === false);

    return matchesSearch && matchesFolder && matchesAccess && matchesStatus;
  });

  const totalItems = filteredQuizzes.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedQuizzes = filteredQuizzes.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // The backend refuses to activate a quiz with zero questions (and
  // auto-publishes it the instant the first one is added) — this mirrors
  // that here so the toggle can't promise something the save won't do.
  const editingQuizQuestionsCount = editingQuizId
    ? quizzes.find((q) => q.id === editingQuizId)?.questionsCount ?? 0
    : 0;
  const isActiveToggleLocked = editingQuizQuestionsCount === 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4">
      {/* Fixed Header & Filter Bar */}
      <div className="shrink-0 space-y-3">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Quiz & Question Builder Studio
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
              Build multi-option question sets, set folder placements, enforce Free/Paid access, and publish live mock tests.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Link href="/admin/quizzes/mock-tests">
              <Button variant="outline" className="font-bold flex items-center space-x-1.5 cursor-pointer">
                <Radio className="w-4 h-4" />
                <span>Live Mock Tests</span>
              </Button>
            </Link>
            <Button variant="gold" className="font-bold shadow-md shadow-cyan-500/20 cursor-pointer" onClick={handleOpenCreateModal}>
              + Create New Quiz
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <Card className="p-4 glass-card space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
              <Input
                placeholder="Search quiz title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Folder Filter */}
            <div className="flex items-center space-x-2">
              <Folder className="w-4 h-4 text-cyan-500" />
              <select
                value={selectedFolderFilter}
                onChange={(e) => setSelectedFolderFilter(e.target.value)}
                className="w-full h-11 bg-white/90 dark:bg-[#091124] border border-slate-300 dark:border-[#1e2e56] text-slate-900 dark:text-slate-100 rounded-xl px-3.5 text-sm font-semibold focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 shadow-2xs hover:border-slate-400 dark:hover:border-[#2a3e70] transition-all cursor-pointer"
              >
                <option value="ALL" className="bg-white text-slate-900 dark:bg-[#091124] dark:text-slate-100">All Folders & Root</option>
                <option value="ROOT" className="bg-white text-slate-900 dark:bg-[#091124] dark:text-slate-100">Root Level Only</option>
                {folders
                  .filter((f) => f !== 'Root / No Folder' && f !== 'Root')
                  .map((folder) => (
                    <option key={folder} value={folder} className="bg-white text-slate-900 dark:bg-[#091124] dark:text-slate-100">
                      {folder}
                    </option>
                  ))}
              </select>
            </div>

            {/* Access Type Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-cyan-500" />
              <select
                value={selectedAccessFilter}
                onChange={(e) => setSelectedAccessFilter(e.target.value)}
                className="w-full h-11 bg-white/90 dark:bg-[#091124] border border-slate-300 dark:border-[#1e2e56] text-slate-900 dark:text-slate-100 rounded-xl px-3.5 text-sm font-semibold focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 shadow-2xs hover:border-slate-400 dark:hover:border-[#2a3e70] transition-all cursor-pointer"
              >
                <option value="ALL" className="bg-white text-slate-900 dark:bg-[#091124] dark:text-slate-100">All Access Types (Free & Paid)</option>
                <option value="FREE" className="bg-white text-slate-900 dark:bg-[#091124] dark:text-slate-100">Free Quizzes Only</option>
                <option value="PAID" className="bg-white text-slate-900 dark:bg-[#091124] dark:text-slate-100">Paid / Premium Quizzes Only</option>
              </select>
            </div>

            {/* Active Status Filter */}
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-500" />
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="w-full h-11 bg-white/90 dark:bg-[#091124] border border-slate-300 dark:border-[#1e2e56] text-slate-900 dark:text-slate-100 rounded-xl px-3.5 text-sm font-semibold focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 shadow-2xs hover:border-slate-400 dark:hover:border-[#2a3e70] transition-all cursor-pointer"
              >
                <option value="ALL" className="bg-white text-slate-900 dark:bg-[#091124] dark:text-slate-100">All Statuses (Active & Draft)</option>
                <option value="ACTIVE" className="bg-white text-slate-900 dark:bg-[#091124] dark:text-slate-100">🟢 Active Only (Visible to Students)</option>
                <option value="INACTIVE" className="bg-white text-slate-900 dark:bg-[#091124] dark:text-slate-100">⚪ Draft / Hidden Only</option>
              </select>
            </div>
          </div>
        </Card>
      </div>

      {/* Scrollable Quizzes Table Container */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border border-slate-200/80 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] shadow-sm p-0">
        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 relative">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px] max-w-[300px]">Quiz Title</TableHead>
                <TableHead className="whitespace-nowrap">Folder Assignment</TableHead>
                <TableHead className="whitespace-nowrap">Access Type</TableHead>
                <TableHead className="whitespace-nowrap">Active Status</TableHead>
                <TableHead className="whitespace-nowrap">Questions</TableHead>
                <TableHead className="whitespace-nowrap">Duration</TableHead>
                <TableHead className="whitespace-nowrap">Mock Status</TableHead>
                <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={`skeleton-${idx}`} className="border-b border-slate-200/80 dark:border-slate-800/60">
                    <TableCell className="py-4"><Skeleton className="h-5 w-48 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-32 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-20 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-20 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-16 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-16 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-24 rounded-lg" /></TableCell>
                    <TableCell className="py-4 text-right"><Skeleton className="h-8 w-24 rounded-xl ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : paginatedQuizzes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center space-y-3 max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner">
                        <Search className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">No Quiz Match</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          No quizzes match your selected search or filter criteria. Try adjusting your search term or filters.
                        </p>
                      </div>
                      {(searchTerm || selectedFolderFilter !== 'ALL' || selectedAccessFilter !== 'ALL' || selectedStatusFilter !== 'ALL') && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs font-bold border-amber-500/40 text-amber-500 hover:bg-amber-500/10 mt-1 cursor-pointer"
                          onClick={() => {
                            setSearchTerm('');
                            setSelectedFolderFilter('ALL');
                            setSelectedAccessFilter('ALL');
                            setSelectedStatusFilter('ALL');
                          }}
                        >
                          Reset All Filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedQuizzes.map((quiz) => (
                  <TableRow key={quiz.id}>
                    <TableCell className="max-w-[220px] lg:max-w-[300px] py-4">
                      <div className="relative group/title max-w-full">
                        <span className="block truncate font-bold text-slate-900 dark:text-white text-sm cursor-pointer">
                          {quiz.title}
                        </span>
                        <div className="pointer-events-none absolute left-0 bottom-full mb-1.5 hidden group-hover/title:block z-[90] w-max max-w-xs sm:max-w-md px-3 py-2 rounded-xl bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white text-xs font-semibold shadow-xl border border-slate-700/80 leading-snug break-words">
                          {quiz.title}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-900 dark:text-amber-300 border border-amber-500/25 shadow-2xs">
                        <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>{(!quiz.folderName || quiz.folderName === 'Root / No Folder' || quiz.folderName === 'Root') ? 'Root' : quiz.folderName}</span>
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {quiz.accessType === 'FREE' ? (
                        <Badge variant="success" className="font-extrabold flex items-center w-fit gap-1 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30 px-2.5 py-1">
                          <Unlock className="w-3 h-3" />
                          <span>FREE</span>
                        </Badge>
                      ) : (
                        <Badge variant="gold" className="font-extrabold flex items-center w-fit gap-1 bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border-cyan-500/30 px-2.5 py-1">
                          <Lock className="w-3 h-3 text-cyan-600 dark:text-cyan-300" />
                          <span>PAID {quiz.price ? `(₹${quiz.price})` : ''}</span>
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {quiz.isActive !== false ? (
                        <Badge variant="success" className="font-extrabold flex items-center w-fit gap-1.5 text-[11px] bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 px-2.5 py-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Active</span>
                        </Badge>
                      ) : quiz.questionsCount === 0 ? (
                        <Badge
                          variant="outline"
                          title="Hidden from students until the first question is added — publishes automatically then."
                          className="font-bold flex items-center w-fit gap-1.5 text-[11px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 px-2.5 py-1"
                        >
                          <AlertCircle className="w-3 h-3" />
                          <span>No Questions</span>
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="font-bold flex items-center w-fit gap-1.5 text-[11px] bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 px-2.5 py-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          <span>Draft</span>
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono font-extrabold text-cyan-600 dark:text-cyan-300 whitespace-nowrap">
                      <Link href={`/admin/quizzes/${quiz.id}/questions`}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs font-bold border-cyan-500/40 text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 py-1 px-2.5 rounded-xl flex items-center space-x-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Manage ({quiz.questionsCount || (quiz.questions ? quiz.questions.length : 0)} Qs)</span>
                        </Button>
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-slate-700 dark:text-slate-300 font-semibold whitespace-nowrap">
                      {quiz.durationMinutes} mins
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant={quiz.isLiveMock ? 'gold' : 'default'} className="flex items-center gap-1.5 w-fit px-2.5 py-1 font-bold">
                        {quiz.isLiveMock ? (
                          <>
                            <Flame className="w-3.5 h-3.5 text-cyan-500 fill-cyan-500" />
                            <span className="text-cyan-800 dark:text-cyan-300 font-extrabold">Live Mock</span>
                          </>
                        ) : (
                          <span>Practice</span>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="p-2 rounded-xl border-slate-300 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-300 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all shadow-2xs"
                          title="Inspect Questions"
                          onClick={() => setInspectQuiz(quiz)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="p-2 rounded-xl border-slate-300 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/10 transition-all shadow-2xs"
                          title="Edit Quiz Settings"
                          onClick={() => handleOpenEditModal(quiz)}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          className="p-2 rounded-xl border-slate-300 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-500/50 hover:bg-rose-500/10 transition-all shadow-2xs"
                          title="Delete Quiz"
                          onClick={() => setDeleteTarget(quiz)}
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

      {/* Quiz Details & Settings Only Dialog */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title={editingQuizId ? 'Edit Quiz Settings' : 'Create New Quiz'}
      >
        <form className="flex-1 min-h-0 flex flex-col space-y-4 pt-2" onSubmit={formik.handleSubmit} noValidate>
          {formSubmitError && (
            <div className="shrink-0 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-500 dark:text-rose-400 text-xs font-bold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{formSubmitError}</span>
            </div>
          )}

          <div className="flex-1 min-h-0 space-y-4 overflow-y-auto px-1 py-1">
            <Input
              label="Quiz Title *"
              name="title"
              placeholder="e.g. Kerala History & Constitution Mock 2026"
              value={formik.values.title}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.title && formik.errors.title ? formik.errors.title : undefined}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DatePicker
                label="Release Date"
                value={formik.values.releaseDate}
                onChange={(d) => formik.setFieldValue('releaseDate', d)}
                minDate={new Date().toISOString().split('T')[0]}
              />
              <TimePicker
                label="Release Time"
                value={formik.values.releaseTime}
                onChange={(t) => formik.setFieldValue('releaseTime', t)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Duration (minutes) *"
                name="duration"
                type="number"
                placeholder="30"
                value={formik.values.duration}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.duration && formik.errors.duration ? formik.errors.duration : undefined}
              />

              <Input
                label="Passing Score (%) *"
                name="passingScore"
                type="number"
                placeholder="60"
                value={formik.values.passingScore}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.passingScore && formik.errors.passingScore ? formik.errors.passingScore : undefined}
              />
            </div>

            {/* Folder Placement */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                <Folder className="w-4 h-4 text-cyan-400" />
                <span>Folder Placement</span>
              </label>
              {!isCreatingNewFolder ? (
                <div className="flex gap-2">
                  <select
                    name="selectedFolder"
                    value={formik.values.selectedFolder}
                    onChange={formik.handleChange}
                    className="w-full h-11 bg-slate-100 dark:bg-[#091124] border border-slate-400 dark:border-[#1e2e56] text-slate-900 dark:text-slate-100 rounded-xl px-3 text-sm font-semibold focus:ring-2 focus:ring-cyan-500/50"
                  >
                    {folders.map((f) => (
                      <option key={f} value={f} className="bg-white text-slate-900 dark:bg-[#091124] dark:text-slate-100">
                        {f === 'Root / No Folder' || f === 'Root' ? 'Root' : f}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreatingNewFolder(true)}
                    className="whitespace-nowrap font-bold flex items-center space-x-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Folder</span>
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    name="newFolderName"
                    placeholder="Enter new folder name..."
                    value={formik.values.newFolderName}
                    onChange={formik.handleChange}
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsCreatingNewFolder(false);
                      formik.setFieldValue('newFolderName', '');
                    }}
                    className="whitespace-nowrap font-semibold"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            {/* Mandatory Access Type */}
            <div className="space-y-2 pt-1 p-3.5 rounded-xl border border-cyan-500/30 bg-cyan-500/5">
              <label className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  <Lock className="w-4 h-4 text-cyan-400" />
                  <span>Access Type (Mandatory) *</span>
                </span>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-cyan-600 dark:text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/30">
                  Required Selection
                </span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`relative flex items-center justify-center space-x-2 p-3 rounded-xl border cursor-pointer font-bold text-xs sm:text-sm transition-all ${formik.values.accessType === 'FREE'
                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-500/40'
                      : 'border-slate-200 dark:border-[#1e2e56] bg-white/50 dark:bg-[#091124] text-slate-700 dark:text-slate-300 hover:border-slate-400'
                    }`}
                >
                  <input
                    type="radio"
                    name="accessType"
                    value="FREE"
                    checked={formik.values.accessType === 'FREE'}
                    onChange={() => handleAccessTypeChange('FREE')}
                    className="sr-only cursor-pointer"
                  />
                  <Unlock className="w-4 h-4 text-emerald-500" />
                  <span>FREE ACCESS</span>
                </label>

                <label
                  className={`relative flex items-center justify-center space-x-2 p-3 rounded-xl border cursor-pointer font-bold text-xs sm:text-sm transition-all ${formik.values.accessType === 'PAID'
                      ? 'border-cyan-500 bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 shadow-xs ring-1 ring-cyan-500/40'
                      : 'border-slate-200 dark:border-[#1e2e56] bg-white/50 dark:bg-[#091124] text-slate-700 dark:text-slate-300 hover:border-slate-400'
                    }`}
                >
                  <input
                    type="radio"
                    name="accessType"
                    value="PAID"
                    checked={formik.values.accessType === 'PAID'}
                    onChange={() => handleAccessTypeChange('PAID')}
                    className="sr-only cursor-pointer"
                  />
                  <Lock className="w-4 h-4 text-cyan-400" />
                  <span>PAID / PREMIUM</span>
                </label>
              </div>

              {formik.values.accessType === 'PAID' && (
                <div className="pt-2">
                  <Input
                    label="Price (₹ INR)"
                    name="price"
                    type="number"
                    placeholder="99"
                    value={formik.values.price}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={formik.touched.price && formik.errors.price ? formik.errors.price : undefined}
                  />
                </div>
              )}
            </div>

            {/* Negative Marking */}
            <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5 pr-2">
                  <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20 shrink-0">
                    <MinusCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <label htmlFor="negativeMarkingEnabled" className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white cursor-pointer block">
                      Negative Marking
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                      When ON, wrong answers deduct marks from the student's final score. Auto-enabled for Paid/Premium quizzes.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    id="negativeMarkingEnabled"
                    checked={formik.values.negativeMarkingEnabled}
                    onChange={(e) => formik.setFieldValue('negativeMarkingEnabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-slate-600 peer-checked:bg-rose-500"></div>
                  <span className="ml-2.5 text-xs font-extrabold font-mono text-slate-800 dark:text-slate-200 min-w-[32px]">
                    {formik.values.negativeMarkingEnabled ? 'ON' : 'OFF'}
                  </span>
                </label>
              </div>

              {formik.values.negativeMarkingEnabled && (
                <div className="pt-2 mt-1 border-t border-rose-500/20 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Deduct (marks) *"
                      name="negativeMarkingDeduct"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="1"
                      value={formik.values.negativeMarkingDeduct}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      error={
                        formik.touched.negativeMarkingDeduct && formik.errors.negativeMarkingDeduct
                          ? formik.errors.negativeMarkingDeduct
                          : undefined
                      }
                    />
                    <Input
                      label="For every N wrong *"
                      name="negativeMarkingEvery"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="3"
                      value={formik.values.negativeMarkingEvery}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      error={
                        formik.touched.negativeMarkingEvery && formik.errors.negativeMarkingEvery
                          ? formik.errors.negativeMarkingEvery
                          : undefined
                      }
                    />
                  </div>

                  {/* Rule is spelled out in plain English so the admin never has to
                      mentally translate the two numbers above while configuring it. */}
                  <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-start gap-1.5 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                    <span>
                      Rule: Deduct {formik.values.negativeMarkingDeduct || '0'} mark
                      {Number(formik.values.negativeMarkingDeduct) === 1 ? '' : 's'} for every{' '}
                      {formik.values.negativeMarkingEvery || '0'} wrong answer
                      {Number(formik.values.negativeMarkingEvery) === 1 ? '' : 's'}. Partial groups of wrong answers
                      aren't penalized until the next full group is reached.
                    </span>
                  </p>

                  <div className="flex items-center justify-between pt-1">
                    <div className="pr-2">
                      <label htmlFor="allowNegativeScore" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer block">
                        Allow score to go negative
                      </label>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                        Off by default — a heavily penalized attempt is floored at 0 instead of going below it.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        id="allowNegativeScore"
                        checked={formik.values.allowNegativeScore}
                        onChange={(e) => formik.setFieldValue('allowNegativeScore', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-slate-600 peer-checked:bg-rose-500"></div>
                      <span className="ml-2.5 text-xs font-extrabold font-mono text-slate-800 dark:text-slate-200 min-w-[32px]">
                        {formik.values.allowNegativeScore ? 'ON' : 'OFF'}
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Show Correct Answer After Selection Option */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-slate-100/70 dark:bg-[#091124] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5 pr-2">
                  <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <label htmlFor="showCorrectAnswerAfterSelection" className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white cursor-pointer block">
                      Show Correct Answer After Selection
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                      When ON, students see immediate feedback (correct/wrong) and the correct answer right after clicking an option.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    id="showCorrectAnswerAfterSelection"
                    checked={formik.values.showCorrectAnswerAfterSelection}
                    onChange={(e) => formik.setFieldValue('showCorrectAnswerAfterSelection', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-slate-600 peer-checked:bg-cyan-500"></div>
                  <span className="ml-2.5 text-xs font-extrabold font-mono text-slate-800 dark:text-slate-200 min-w-[32px]">
                    {formik.values.showCorrectAnswerAfterSelection ? 'ON' : 'OFF'}
                  </span>
                </label>
              </div>
            </div>

            {/* Active Status (Visible to Students) */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-slate-100/70 dark:bg-[#091124] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5 pr-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0">
                    <Eye className="w-4 h-4" />
                  </div>
                  <div>
                    <label htmlFor="isActive" className={`text-xs sm:text-sm font-bold text-slate-900 dark:text-white block ${isActiveToggleLocked ? '' : 'cursor-pointer'}`}>
                      Active Status (Visible to Students)
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                      {isActiveToggleLocked
                        ? editingQuizId
                          ? 'This quiz has no questions yet, so it stays hidden from students. Add a question in the Questions Studio and it publishes automatically.'
                          : 'New quizzes start hidden — add the first question after creating it and this switches on by itself.'
                        : 'When ON, this quiz is published and accessible to students.'}
                    </p>
                  </div>
                </div>

                <label className={`relative inline-flex items-center shrink-0 ${isActiveToggleLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActiveToggleLocked ? false : formik.values.isActive}
                    disabled={isActiveToggleLocked}
                    onChange={(e) => formik.setFieldValue('isActive', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-slate-600 peer-checked:bg-emerald-500"></div>
                  <span className="ml-2.5 text-xs font-extrabold font-mono text-slate-800 dark:text-slate-200 min-w-[32px]">
                    {isActiveToggleLocked ? 'OFF' : formik.values.isActive ? 'ON' : 'OFF'}
                  </span>
                </label>
              </div>
            </div>

            {/* Mark as Live Mock Test */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-slate-100/70 dark:bg-[#091124] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5 pr-2">
                  <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                    <Flame className="w-4 h-4 fill-cyan-400 text-cyan-400" />
                  </div>
                  <div>
                    <label htmlFor="isLiveMock" className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white cursor-pointer block">
                      Mark as Live Mock Test
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                      When ON, marks this quiz for live scheduled test sessions and leaderboard tracking.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    id="isLiveMock"
                    checked={formik.values.isLive}
                    onChange={(e) => handleToggleLiveMock(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-slate-600 peer-checked:bg-cyan-500"></div>
                  <span className="ml-2.5 text-xs font-extrabold font-mono text-slate-800 dark:text-slate-200 min-w-[32px]">
                    {formik.values.isLive ? 'ON' : 'OFF'}
                  </span>
                </label>
              </div>

              {/* Live session details — required to place the quiz in the Live Mock Tests list */}
              {formik.values.isLive && (
                <div className="pt-3 mt-1 border-t border-slate-200 dark:border-[#1e2e56] space-y-3">
                  <p className="text-[11px] font-bold text-cyan-700 dark:text-cyan-300 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {editingExistingMockTest
                        ? 'This quiz is already in the Live Mock Tests list — saving updates that session.'
                        : 'Saving adds this quiz to the Live Mock Tests list as a scheduled session.'}
                    </span>
                  </p>

                  <Input
                    label="Mock Test Title *"
                    name="mockTestTitle"
                    placeholder="e.g. Kerala PSC LDC Mega Mock 2026"
                    value={formik.values.mockTestTitle}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={
                      formik.touched.mockTestTitle && formik.errors.mockTestTitle
                        ? formik.errors.mockTestTitle
                        : undefined
                    }
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <DatePicker
                        label="Scheduled Date *"
                        value={formik.values.mockTestDate}
                        onChange={(d) => formik.setFieldValue('mockTestDate', d)}
                        minDate={new Date().toISOString().split('T')[0]}
                      />
                      {formik.touched.mockTestDate && formik.errors.mockTestDate && (
                        <p className="text-xs font-semibold text-rose-500">{formik.errors.mockTestDate}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <TimePicker
                        label="Scheduled Time *"
                        value={formik.values.mockTestTime}
                        onChange={(t) => formik.setFieldValue('mockTestTime', t)}
                      />
                      {formik.touched.mockTestTime && formik.errors.mockTestTime && (
                        <p className="text-xs font-semibold text-rose-500">{formik.errors.mockTestTime}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 pt-3 border-t border-slate-200 dark:border-[#1e2e56]">
            <Button
              type="submit"
              variant="gold"
              className="w-full font-bold shadow-md shadow-cyan-500/20 flex items-center justify-center space-x-2 cursor-pointer"
              disabled={formik.isSubmitting}
            >
              <span>{formik.isSubmitting ? 'Saving Settings...' : editingQuizId ? 'Save Settings' : 'Create Quiz'}</span>
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Questions Inspector Modal */}
      {inspectQuiz && (
        <Dialog
          isOpen={Boolean(inspectQuiz)}
          onClose={() => setInspectQuiz(null)}
          title={`Question Set Inspector: "${inspectQuiz.title}"`}
        >
          <div className="flex-1 min-h-0 space-y-4 pt-2 overflow-y-auto pr-1">
            <div className="flex justify-between items-center p-3 bg-slate-100 dark:bg-[#091124] rounded-xl text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-200">Total Questions: {inspectQuiz.questions ? inspectQuiz.questions.length : 0}</span>
              <span className="font-mono text-cyan-400 font-bold flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 inline mr-1" />
                <span>{inspectQuiz.durationMinutes} mins</span>
              </span>
            </div>

            {(!inspectQuiz.questions || inspectQuiz.questions.length === 0) ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                No questions populated for this quiz yet. Click Edit to add questions!
              </div>
            ) : (
              inspectQuiz.questions.map((q, idx) => (
                <div key={q.id || idx} className="p-3.5 rounded-xl border border-slate-200 dark:border-[#1e2e56] space-y-2 bg-slate-50/50 dark:bg-[#0c152e]/50">
                  <div className="font-bold text-sm text-slate-900 dark:text-white flex items-start space-x-2">
                    <span className="text-cyan-400 font-mono shrink-0">Q{idx + 1}.</span>
                    <span>{q.text}</span>
                  </div>
                  <div className="pl-6 space-y-1.5">
                    {q.options.map((opt, optIdx) => {
                      const isCorrect = q.correctOptionId === opt.id;
                      return (
                        <div
                          key={opt.id || optIdx}
                          className={`text-xs p-2 rounded-lg flex items-center justify-between font-medium ${isCorrect
                              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold'
                              : 'bg-slate-100 dark:bg-[#091124] text-slate-700 dark:text-slate-300'
                            }`}
                        >
                          <span className="flex items-center space-x-2">
                            <span className="font-mono font-bold">{String.fromCharCode(65 + optIdx)}.</span>
                            <span>{opt.text}</span>
                          </span>
                          {isCorrect && (
                            <span className="flex items-center space-x-1 text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-extrabold">
                              <Check className="w-3.5 h-3.5" />
                              <span>Correct</span>
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {q.explanation && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 pt-1 flex items-start space-x-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                        <span><strong>Explanation:</strong> {q.explanation}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            <Button variant="outline" className="w-full font-bold text-xs" onClick={() => setInspectQuiz(null)}>
              Close Inspector
            </Button>
          </div>
        </Dialog>
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete Quiz"
        description={deleteTarget ? `This will permanently delete "${deleteTarget.title}" and all its questions and attempts. This action cannot be undone.` : undefined}
        confirmLabel="Delete"
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
