'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { ApiClient } from '@/lib/api-client';
import { Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button, Dialog, Input, Badge, Pagination, Skeleton } from '@psc/ui';
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
  BookOpen,
  Home,
  Flame,
  Check,
  Send,
  FileText,
  Settings,
  ListChecks,
  History,
  Radio,
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
  questions: QuizQuestion[];
}

const DEFAULT_FOLDERS = [
  'Root / No Folder',
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
  description: string;
  category: string;
  duration: string;
  passingScore: string;
  selectedBook: string;
  selectedChapter: string;
  selectedTopic: string;
  isActive: boolean;
  isLive: boolean;
  showCorrectAnswerAfterSelection: boolean;
  selectedFolder: string;
  newFolderName: string;
  accessType: 'FREE' | 'PAID' | '';
  price: string;
  questions: QuizQuestion[];
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
  description: '',
  category: '',
  duration: '30',
  passingScore: '60',
  selectedBook: '',
  selectedChapter: '',
  selectedTopic: '',
  isActive: true,
  isLive: false,
  showCorrectAnswerAfterSelection: true,
  selectedFolder: 'Root / No Folder',
  newFolderName: '',
  accessType: 'FREE',
  price: '99',
  questions: [],
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
  questions: Yup.array()
    .min(1, 'You must add at least 1 question to the quiz.')
    .of(
      Yup.object({
        text: Yup.string().trim().required('Question text cannot be empty.'),
        options: Yup.array()
          .min(2, 'Each question must have at least 2 options.')
          .of(
            Yup.object({
              text: Yup.string().trim().required('Option text cannot be empty.'),
            }),
          )
          .test('unique-options', 'Each option must have unique content within a question.', (options) => {
            if (!options) return true;
            const texts = options.map((o) => o?.text?.trim().toLowerCase()).filter(Boolean);
            return new Set(texts).size === texts.length;
          }),
        correctOptionId: Yup.string().required('Each question must have exactly one correct answer selected.'),
      }),
    ),
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

export default function AdminQuizzesPage() {
  const [mounted, setMounted] = useState(false);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [folders, setFolders] = useState<string[]>(DEFAULT_FOLDERS);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFolderFilter, setSelectedFolderFilter] = useState('ALL');
  const [selectedAccessFilter, setSelectedAccessFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedFolderFilter, selectedAccessFilter, selectedStatusFilter]);

  // Quiz Builder Modal State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<'SETTINGS' | 'QUESTIONS'>('SETTINGS');

  const [isCreatingNewFolder, setIsCreatingNewFolder] = useState(false);
  const [formSubmitError, setFormSubmitError] = useState('');

  // Inspector Modal State
  const [inspectQuiz, setInspectQuiz] = useState<QuizItem | null>(null);

  // Helper to map API response to local QuizItem format
  const mapApiQuizToLocal = useCallback((apiQuiz: any): QuizItem => {
    return {
      id: apiQuiz.id,
      title: apiQuiz.title,
      category: apiQuiz.category,
      folderName: apiQuiz.folderName || 'Root / No Folder',
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
      const apiFolders = mapped.map((q) => q.folderName).filter((f) => f && f !== 'Root / No Folder');
      const uniqueFolders = Array.from(new Set([...DEFAULT_FOLDERS, ...apiFolders]));
      setFolders(uniqueFolders);
    } catch (err) {
      console.error('Failed to fetch quizzes:', err);
    } finally {
      setLoading(false);
    }
  }, [mapApiQuizToLocal]);

  useEffect(() => {
    setMounted(true);
    fetchQuizzes();
  }, [fetchQuizzes]);

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

      const apiPayload = {
        title: values.title.trim(),
        category: values.category.trim() || 'General',
        description: values.description || '',
        folderName: targetFolder,
        accessType: values.accessType || 'FREE',
        isActive: values.isActive,
        showCorrectAnswerAfterSelection: values.showCorrectAnswerAfterSelection,
        releaseDate: values.releaseDate || undefined,
        bookId: values.selectedBook || undefined,
        chapterId: values.selectedChapter || undefined,
        topic: values.selectedTopic || undefined,
        durationMinutes: Number(values.duration) || 30,
        isLiveMock: values.isLive,
        isPremium: values.accessType === 'PAID',
        price: numericPrice,
        passingMarks: Number(values.passingScore) || 40,
        totalMarks: values.questions.reduce((sum, q) => sum + (q.marks || 1), 0) || 100,
        questions: values.questions.map((q) => {
          const correctIndex = q.options.findIndex((o) => o.id === q.correctOptionId);
          return {
            text: q.text,
            options: q.options.map((o) => ({ id: o.id, text: o.text, explanation: o.explanation || undefined })),
            correctOptionIndex: correctIndex >= 0 ? correctIndex : 0,
            explanation: q.explanation || undefined,
            marks: q.marks || 1,
          };
        }),
      };

      try {
        if (editingQuizId) {
          await ApiClient.updateQuiz(editingQuizId, apiPayload);
        } else {
          await ApiClient.createQuiz(apiPayload);
        }
        await fetchQuizzes();
        setIsDialogOpen(false);
      } catch (err: any) {
        setFormSubmitError(err.message || 'Failed to save quiz. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
  });

  // Submits the form, and if validation fails, jumps to whichever step has the first error.
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitError('');
    const errors = await formik.validateForm();
    if (Object.keys(errors).length > 0) {
      const hasSettingsError = SETTINGS_FIELD_KEYS.some((k) => (errors as any)[k]);
      setActiveStep(hasSettingsError ? 'SETTINGS' : 'QUESTIONS');
    }
    formik.handleSubmit(e as any);
  };

  // Advances to the Questions step, but only after confirming the Settings step itself is valid.
  const handleNextStep = async () => {
    const errors = await formik.validateForm();
    const settingsTouched: Record<string, boolean> = {};
    SETTINGS_FIELD_KEYS.forEach((k) => (settingsTouched[k] = true));
    formik.setTouched({ ...formik.touched, ...settingsTouched });
    const hasSettingsError = SETTINGS_FIELD_KEYS.some((k) => (errors as any)[k]);
    if (!hasSettingsError) {
      setActiveStep('QUESTIONS');
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

  // Open Creation Builder
  const handleOpenCreateModal = () => {
    setEditingQuizId(null);
    setActiveStep('SETTINGS');
    setIsCreatingNewFolder(false);
    setFormSubmitError('');
    formik.resetForm({
      values: {
        ...DEFAULT_QUIZ_FORM_VALUES,
        questions: [EMPTY_QUESTION()],
      },
    });
    setIsDialogOpen(true);
  };

  // Open Edit Builder
  const handleOpenEditModal = (quiz: QuizItem) => {
    setEditingQuizId(quiz.id);
    setActiveStep('SETTINGS');
    setIsCreatingNewFolder(false);
    setFormSubmitError('');
    formik.resetForm({
      values: {
        title: quiz.title,
        releaseDate: quiz.releaseDate || '',
        description: quiz.description || '',
        category: quiz.category || '',
        duration: String(quiz.durationMinutes),
        passingScore: quiz.passingScore ? String(quiz.passingScore) : '60',
        selectedBook: quiz.bookId || '',
        selectedChapter: quiz.chapterId || '',
        selectedTopic: quiz.topic || '',
        isActive: quiz.isActive !== undefined ? quiz.isActive : true,
        isLive: quiz.isLiveMock,
        showCorrectAnswerAfterSelection: quiz.showCorrectAnswerAfterSelection ?? true,
        selectedFolder: quiz.folderName || 'Root / No Folder',
        newFolderName: '',
        accessType: quiz.accessType,
        price: quiz.price ? String(quiz.price) : '99',
        questions: quiz.questions && quiz.questions.length > 0 ? JSON.parse(JSON.stringify(quiz.questions)) : [],
      },
    });
    setIsDialogOpen(true);
  };

  // Question Management Helpers — all operate on formik.values.questions
  const questions = formik.values.questions;

  const handleAddQuestion = () => {
    formik.setFieldValue('questions', [...questions, EMPTY_QUESTION()]);
  };

  const handleUpdateQuestionText = (index: number, text: string) => {
    const updated = questions.map((q, i) => (i === index ? { ...q, text } : q));
    formik.setFieldValue('questions', updated);
  };

  const handleUpdateQuestionExplanation = (index: number, exp: string) => {
    const updated = questions.map((q, i) => (i === index ? { ...q, explanation: exp } : q));
    formik.setFieldValue('questions', updated);
  };

  const handleDeleteQuestion = (index: number) => {
    if (questions.length <= 1) {
      alert('A quiz must contain at least one question.');
      return;
    }
    formik.setFieldValue('questions', questions.filter((_, i) => i !== index));
  };

  const handleMoveQuestion = (index: number, direction: 'UP' | 'DOWN') => {
    if ((direction === 'UP' && index === 0) || (direction === 'DOWN' && index === questions.length - 1)) return;
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    const updated = [...questions];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    formik.setFieldValue('questions', updated);
  };

  // Option Management Helpers
  const handleAddOption = (questionIndex: number) => {
    const q = questions[questionIndex];
    if (q.options.length >= 6) {
      alert('Maximum 6 options allowed per question.');
      return;
    }
    const newOptId = `opt-${Date.now()}-${q.options.length + 1}`;
    const updated = questions.map((quest, i) =>
      i === questionIndex ? { ...quest, options: [...quest.options, { id: newOptId, text: '' }] } : quest,
    );
    formik.setFieldValue('questions', updated);
  };

  const handleUpdateOptionText = (questionIndex: number, optionIndex: number, text: string) => {
    const updated = questions.map((quest, i) =>
      i === questionIndex
        ? { ...quest, options: quest.options.map((o, j) => (j === optionIndex ? { ...o, text } : o)) }
        : quest,
    );
    formik.setFieldValue('questions', updated);
  };

  const handleUpdateOptionExplanation = (questionIndex: number, optionIndex: number, explanation: string) => {
    const updated = questions.map((quest, i) =>
      i === questionIndex
        ? { ...quest, options: quest.options.map((o, j) => (j === optionIndex ? { ...o, explanation } : o)) }
        : quest,
    );
    formik.setFieldValue('questions', updated);
  };

  const handleDeleteOption = (questionIndex: number, optionIndex: number) => {
    const q = questions[questionIndex];
    if (q.options.length <= 2) {
      alert('Each question must have at least 2 options.');
      return;
    }
    const deletedOptId = q.options[optionIndex].id;
    const updated = questions.map((quest, i) => {
      if (i !== questionIndex) return quest;
      const nextOptions = quest.options.filter((_, j) => j !== optionIndex);
      return {
        ...quest,
        options: nextOptions,
        correctOptionId: quest.correctOptionId === deletedOptId ? '' : quest.correctOptionId,
      };
    });
    formik.setFieldValue('questions', updated);
  };

  const handleSetCorrectOption = (questionIndex: number, optionId: string) => {
    const updated = questions.map((q, i) => (i === questionIndex ? { ...q, correctOptionId: optionId } : q));
    formik.setFieldValue('questions', updated);
  };

  const handleDeleteQuiz = async (id: string) => {
    if (confirm('Are you sure you want to delete this quiz?')) {
      try {
        await ApiClient.deleteQuiz(id);
        await fetchQuizzes();
      } catch (err: any) {
        alert(err.message || 'Failed to delete quiz.');
      }
    }
  };

  // Filtered Quiz List
  const filteredQuizzes = quizzes.filter((quiz) => {
    const matchesSearch =
      quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quiz.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFolder =
      selectedFolderFilter === 'ALL' ||
      (selectedFolderFilter === 'ROOT' && (quiz.folderName === 'Root / No Folder' || !quiz.folderName)) ||
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

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Quiz & Question Builder Studio
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Build multi-option question sets, set folder placements, enforce Free/Paid access, and publish live mock tests.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Link href="/admin/quizzes/mock-tests">
            <Button variant="outline" className="font-bold flex items-center space-x-1.5">
              <Radio className="w-4 h-4" />
              <span>Live Mock Tests</span>
            </Button>
          </Link>
          <Button variant="gold" className="font-bold shadow-md shadow-cyan-500/20" onClick={handleOpenCreateModal}>
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
              placeholder="Search quiz title or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Folder Filter */}
          <div className="flex items-center space-x-2">
            <Folder className="w-4 h-4 text-cyan-400" />
            <select
              value={selectedFolderFilter}
              onChange={(e) => setSelectedFolderFilter(e.target.value)}
              className="w-full h-11 bg-slate-100/80 dark:bg-[#091124] border border-slate-200 dark:border-[#1e2e56] text-slate-900 dark:text-slate-100 rounded-xl px-3 text-sm font-semibold focus:ring-2 focus:ring-cyan-500/50 cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900 text-slate-100 dark:bg-[#091124] dark:text-slate-100">All Folders & Root</option>
              <option value="ROOT" className="bg-slate-900 text-slate-100 dark:bg-[#091124] dark:text-slate-100">Root Level Only (No Folder)</option>
              {folders
                .filter((f) => f !== 'Root / No Folder')
                .map((folder) => (
                  <option key={folder} value={folder} className="bg-slate-900 text-slate-100 dark:bg-[#091124] dark:text-slate-100">
                    {folder}
                  </option>
                ))}
            </select>
          </div>

          {/* Access Type Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-cyan-400" />
            <select
              value={selectedAccessFilter}
              onChange={(e) => setSelectedAccessFilter(e.target.value)}
              className="w-full h-11 bg-slate-100/80 dark:bg-[#091124] border border-slate-200 dark:border-[#1e2e56] text-slate-900 dark:text-slate-100 rounded-xl px-3 text-sm font-semibold focus:ring-2 focus:ring-cyan-500/50 cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900 text-slate-100 dark:bg-[#091124] dark:text-slate-100">All Access Types (Free & Paid)</option>
              <option value="FREE" className="bg-slate-900 text-slate-100 dark:bg-[#091124] dark:text-slate-100">Free Quizzes Only</option>
              <option value="PAID" className="bg-slate-900 text-slate-100 dark:bg-[#091124] dark:text-slate-100">Paid / Premium Quizzes Only</option>
            </select>
          </div>

          {/* Active Status Filter */}
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full h-11 bg-slate-100/80 dark:bg-[#091124] border border-slate-200 dark:border-[#1e2e56] text-slate-900 dark:text-slate-100 rounded-xl px-3 text-sm font-semibold focus:ring-2 focus:ring-cyan-500/50 cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900 text-slate-100 dark:bg-[#091124] dark:text-slate-100">All Statuses (Active & Draft)</option>
              <option value="ACTIVE" className="bg-slate-900 text-slate-100 dark:bg-[#091124] dark:text-slate-100">🟢 Active Only (Visible to Students)</option>
              <option value="INACTIVE" className="bg-slate-900 text-slate-100 dark:bg-[#091124] dark:text-slate-100">⚪ Draft / Hidden Only</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Quizzes Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quiz Title</TableHead>
              <TableHead>Folder Assignment</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Access Type</TableHead>
              <TableHead>Active Status</TableHead>
              <TableHead>Questions</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Mock Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={`skeleton-${idx}`} className="border-b border-slate-200/80 dark:border-slate-800/60">
                  <TableCell className="py-4"><Skeleton className="h-5 w-48 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-32 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-24 rounded-lg" /></TableCell>
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
                <TableCell colSpan={9} className="text-center py-12">
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
                  <TableCell className="font-bold text-slate-900 dark:text-white">{quiz.title}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      <Folder className="w-3.5 h-3.5 text-amber-500" />
                      <span>{quiz.folderName || 'Root / No Folder'}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-slate-700 dark:text-slate-300 font-medium">{quiz.category}</TableCell>
                  <TableCell>
                    {quiz.accessType === 'FREE' ? (
                      <Badge variant="success" className="font-bold flex items-center w-fit gap-1">
                        <Unlock className="w-3 h-3" />
                        <span>FREE</span>
                      </Badge>
                    ) : (
                      <Badge variant="gold" className="font-bold flex items-center w-fit gap-1">
                        <Lock className="w-3 h-3 text-cyan-700 dark:text-cyan-300" />
                        <span>PAID {quiz.price ? `(₹${quiz.price})` : ''}</span>
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {quiz.isActive !== false ? (
                      <Badge variant="success" className="font-bold flex items-center w-fit gap-1.5 text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Active</span>
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="font-bold flex items-center w-fit gap-1.5 text-[11px] bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        <span>Draft</span>
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono font-bold text-cyan-400">
                    {quiz.questionsCount || (quiz.questions ? quiz.questions.length : 0)} Qs
                  </TableCell>
                  <TableCell className="font-mono text-slate-700 dark:text-slate-300">
                    {quiz.durationMinutes} mins
                  </TableCell>
                  <TableCell>
                    <Badge variant={quiz.isLiveMock ? 'gold' : 'default'} className="flex items-center gap-1.5 w-fit">
                      {quiz.isLiveMock ? (
                        <>
                          <Flame className="w-3 h-3 text-cyan-400 fill-cyan-400" />
                          <span>Live Mock</span>
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
                        className="p-2 rounded-xl hover:text-amber-600 dark:hover:text-amber-400 transition-all shadow-sm"
                        title="Inspect Questions"
                        onClick={() => setInspectQuiz(quiz)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="p-2 rounded-xl hover:text-amber-600 dark:hover:text-amber-400 transition-all shadow-sm"
                        title="Edit Quiz"
                        onClick={() => handleOpenEditModal(quiz)}
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        className="p-2 rounded-xl transition-all shadow-sm"
                        title="Delete Quiz"
                        onClick={() => handleDeleteQuiz(quiz.id)}
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

        <div className="px-4 pb-4">
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

      {/* Main Builder Studio Dialog */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title={editingQuizId ? 'Edit Quiz & Question Set' : 'Create New Quiz & Question Set'}
      >
        <form className="flex flex-col flex-1 overflow-hidden space-y-4 pt-2" onSubmit={handleFormSubmit} noValidate>
          {formSubmitError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-500 dark:text-rose-400 text-xs font-bold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{formSubmitError}</span>
            </div>
          )}
          {!formSubmitError && formik.submitCount > 0 && getFirstFormikError(formik.errors) && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-500 dark:text-rose-400 text-xs font-bold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{getFirstFormikError(formik.errors)}</span>
            </div>
          )}

          {/* Builder Step Switcher Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-1">
            <button
              type="button"
              onClick={() => setActiveStep('SETTINGS')}
              className={`py-2.5 px-4 font-semibold text-xs sm:text-sm border-b-2 transition-all flex items-center space-x-2 rounded-t-lg ${activeStep === 'SETTINGS'
                  ? 'border-cyan-400 text-cyan-700 dark:text-cyan-300 font-extrabold bg-cyan-500/10 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#0c152e]/40'
                }`}
            >
              <Layers className="w-4 h-4" />
              <span>1. Quiz Details & Settings</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveStep('QUESTIONS')}
              className={`py-2.5 px-4 font-semibold text-xs sm:text-sm border-b-2 transition-all flex items-center space-x-2 rounded-t-lg ${activeStep === 'QUESTIONS'
                  ? 'border-cyan-400 text-cyan-700 dark:text-cyan-300 font-extrabold bg-cyan-500/10 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#0c152e]/40'
                }`}
            >
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>2. Questions & Options ({questions.length})</span>
            </button>
          </div>

          {/* STEP 1: Quiz Settings & Folder */}
          {activeStep === 'SETTINGS' && (
            <div className="space-y-4 flex-1 overflow-y-auto max-h-[58vh] px-1.5 py-1">
              <Input
                label="Quiz Title *"
                name="title"
                placeholder="e.g. Kerala History & Constitution Mock 2026"
                value={formik.values.title}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.title && formik.errors.title ? formik.errors.title : undefined}
              />

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span>Release Date</span>
                </label>
                <input
                  type="date"
                  name="releaseDate"
                  value={formik.values.releaseDate}
                  onChange={formik.handleChange}
                  className="w-full h-11 bg-slate-100/80 dark:bg-[#091124] border border-slate-200 dark:border-[#1e2e56] text-slate-900 dark:text-slate-100 rounded-xl px-3 text-sm font-semibold focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span>Description</span>
                </label>
                <textarea
                  rows={3}
                  name="description"
                  placeholder="Enter detailed quiz description..."
                  value={formik.values.description}
                  onChange={formik.handleChange}
                  className="w-full bg-slate-100/80 dark:bg-[#091124] border border-slate-200 dark:border-[#1e2e56] text-slate-900 dark:text-slate-100 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-cyan-500/50 resize-y"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Category (Optional)"
                  name="category"
                  placeholder="e.g. LDC / Tenth Level"
                  value={formik.values.category}
                  onChange={formik.handleChange}
                />

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
              </div>

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

              {/* Book (Optional) */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                  <BookOpen className="w-4 h-4 text-cyan-400" />
                  <span>Book (Optional)</span>
                </label>
                <select
                  name="selectedBook"
                  value={formik.values.selectedBook}
                  onChange={formik.handleChange}
                  className="w-full h-11 bg-slate-100/80 dark:bg-[#091124] border border-slate-200 dark:border-[#1e2e56] text-slate-900 dark:text-slate-100 rounded-xl px-3 text-sm font-semibold focus:ring-2 focus:ring-cyan-500/50 cursor-pointer"
                >
                  <option value="" className="bg-slate-900 text-slate-400 dark:bg-[#091124] dark:text-slate-400">Select Book (Optional)...</option>
                  <option value="PSC HOT TOPICS." className="bg-slate-900 text-slate-100 dark:bg-[#091124] dark:text-slate-100">PSC HOT TOPICS.</option>
                  <option value="Kerala History Special Guide" className="bg-slate-900 text-slate-100 dark:bg-[#091124] dark:text-slate-100">Kerala History Special Guide</option>
                  <option value="Indian Constitution & Polity Guide" className="bg-slate-900 text-slate-100 dark:bg-[#091124] dark:text-slate-100">Indian Constitution & Polity Guide</option>
                  <option value="General Science Masterclass" className="bg-slate-900 text-slate-100 dark:bg-[#091124] dark:text-slate-100">General Science Masterclass</option>
                </select>
              </div>

              {/* Chapter (Optional) */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                  <BookOpen className="w-4 h-4 text-cyan-400" />
                  <span>Chapter (Optional)</span>
                </label>
                <select
                  name="selectedChapter"
                  value={formik.values.selectedChapter}
                  onChange={formik.handleChange}
                  className="w-full h-11 bg-slate-100/80 dark:bg-[#091124] border border-slate-200 dark:border-[#1e2e56] text-slate-900 dark:text-slate-100 rounded-xl px-3 text-sm font-semibold focus:ring-2 focus:ring-cyan-500/50 cursor-pointer"
                >
                  <option value="" className="bg-slate-900 text-slate-400 dark:bg-[#091124] dark:text-slate-400">Select Chapter (Optional)...</option>
                  <option value="കേരള ചരിത്രം" className="bg-slate-900 text-slate-100 dark:bg-[#091124] dark:text-slate-100">കേരള ചരിത്രം (Kerala History)</option>
                  <option value="ഭരണഘടന ആമുഖം" className="bg-slate-900 text-slate-100 dark:bg-[#091124] dark:text-slate-100">ഭരണഘടന ആമുഖം (Preamble & Polity)</option>
                  <option value="നവോത്ഥാന പ്രസ്ഥാനങ്ങൾ" className="bg-slate-900 text-slate-100 dark:bg-[#091124] dark:text-slate-100">നവോത്ഥാന പ്രസ്ഥാനങ്ങൾ (Renaissance)</option>
                  <option value="ഭൂമിശാസ്ത്രം" className="bg-slate-900 text-slate-100 dark:bg-[#091124] dark:text-slate-100">ഭൂമിശാസ്ത്രം (Geography)</option>
                </select>
              </div>

              {/* Topic (Optional) */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                  <BookOpen className="w-4 h-4 text-cyan-400" />
                  <span>Topic (Optional)</span>
                </label>
                <select
                  name="selectedTopic"
                  value={formik.values.selectedTopic}
                  onChange={formik.handleChange}
                  className="w-full h-11 bg-slate-100/80 dark:bg-[#091124] border border-slate-200 dark:border-[#1e2e56] text-slate-900 dark:text-slate-100 rounded-xl px-3 text-sm font-semibold focus:ring-2 focus:ring-cyan-500/50 cursor-pointer"
                >
                  <option value="" className="bg-slate-900 text-slate-400 dark:bg-[#091124] dark:text-slate-400">Select Topic (Optional)...</option>
                  <option value="പോർച്ചുഗീസുകാർ" className="bg-slate-900 text-slate-100 dark:bg-[#091124] dark:text-slate-100">പോർച്ചുഗീസുകാർ (Portuguese Arrival)</option>
                  <option value="ഡച്ചുകാർ" className="bg-slate-900 text-slate-100 dark:bg-[#091124] dark:text-slate-100">ഡച്ചുകാർ (Dutch Rule)</option>
                  <option value="മൗലിക അവകാശങ്ങൾ" className="bg-slate-900 text-slate-100 dark:bg-[#091124] dark:text-slate-100">മൗലിക അവകാശങ്ങൾ (Fundamental Rights)</option>
                  <option value="നദികളും കായലുകളും" className="bg-slate-900 text-slate-100 dark:bg-[#091124] dark:text-slate-100">നദികളും കായലുകളും (Rivers & Lakes)</option>
                </select>
              </div>

              {/* Folder Assignment */}
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
                      className="w-full h-11 bg-slate-100/80 dark:bg-[#091124] border border-slate-200 dark:border-[#1e2e56] text-slate-900 dark:text-slate-100 rounded-xl px-3 text-sm font-semibold focus:ring-2 focus:ring-cyan-500/50"
                    >
                      {folders.map((f) => (
                        <option key={f} value={f} className="bg-slate-900 text-slate-100 dark:bg-[#091124] dark:text-slate-100">
                          {f === 'Root / No Folder' ? 'Root Level (No Folder)' : f}
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
                      onChange={() => formik.setFieldValue('accessType', 'FREE')}
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
                      onChange={() => formik.setFieldValue('accessType', 'PAID')}
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
                      <label htmlFor="isActive" className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white cursor-pointer block">
                        Active Status (Visible to Students)
                      </label>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                        When ON, this quiz is published and accessible to students.
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formik.values.isActive}
                      onChange={(e) => formik.setFieldValue('isActive', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-slate-600 peer-checked:bg-emerald-500"></div>
                    <span className="ml-2.5 text-xs font-extrabold font-mono text-slate-800 dark:text-slate-200 min-w-[32px]">
                      {formik.values.isActive ? 'ON' : 'OFF'}
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
                      onChange={(e) => formik.setFieldValue('isLive', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-slate-600 peer-checked:bg-cyan-500"></div>
                    <span className="ml-2.5 text-xs font-extrabold font-mono text-slate-800 dark:text-slate-200 min-w-[32px]">
                      {formik.values.isLive ? 'ON' : 'OFF'}
                    </span>
                  </label>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="button"
                  variant="gold"
                  className="w-full font-bold shadow-md shadow-cyan-500/20 flex items-center justify-center space-x-2"
                  onClick={handleNextStep}
                >
                  <span>Next: Add Questions & Options ({questions.length})</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: Question & Options Builder */}
          {activeStep === 'QUESTIONS' && (
            <div className="space-y-6 max-h-[60vh] overflow-y-auto px-1.5 py-1">
              <div className="flex justify-between items-center bg-slate-100 dark:bg-[#091124] p-3 rounded-xl border border-slate-200 dark:border-[#1e2e56]">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center space-x-1.5">
                    <ListChecks className="w-4 h-4 text-cyan-400" />
                    <span>Questions Builder ({questions.length} Questions)</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Add options (2-6), mark the correct answer radio button, and reorder questions.
                  </p>
                </div>
                <Button type="button" variant="gold" size="sm" className="font-bold text-xs flex items-center space-x-1" onClick={handleAddQuestion}>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Question</span>
                </Button>
              </div>

              {questions.map((quest, qIdx) => (
                <Card key={quest.id} className="p-4 space-y-4 border border-slate-200 dark:border-[#1e2e56] relative bg-white/60 dark:bg-[#091124]">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1e2e56] pb-2">
                    <span className="font-mono text-xs font-bold text-cyan-700 dark:text-cyan-300 uppercase tracking-wider">
                      Question #{qIdx + 1}
                    </span>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => handleMoveQuestion(qIdx, 'UP')}
                        disabled={qIdx === 0}
                        className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 transition-colors"
                        title="Move Up"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveQuestion(qIdx, 'DOWN')}
                        disabled={qIdx === questions.length - 1}
                        className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 transition-colors"
                        title="Move Down"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(qIdx)}
                        className="p-1 text-rose-500 hover:text-rose-600 transition-colors ml-2"
                        title="Delete Question"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Question Text */}
                  <Input
                    label="Question Prompt *"
                    placeholder="e.g. Which river is the longest in Kerala?"
                    value={quest.text}
                    onChange={(e) => handleUpdateQuestionText(qIdx, e.target.value)}
                    required
                  />

                  {/* Answer Options List */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Answer Options (Select 1 Correct Answer Radio Button) *
                      </label>
                      {quest.options.length < 6 && (
                        <button
                          type="button"
                          onClick={() => handleAddOption(qIdx)}
                          className="text-xs font-bold text-cyan-700 dark:text-cyan-400 hover:text-cyan-300 transition-colors flex items-center space-x-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Option ({quest.options.length}/6)</span>
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {(() => {
                        const optionTexts = quest.options.map((o) => o.text.trim().toLowerCase());
                        const hasDuplicates = optionTexts.some((t, i) => t !== '' && optionTexts.indexOf(t) !== i);

                        return (
                          <>
                            {quest.options.map((opt, optIdx) => {
                              const optionLetter = String.fromCharCode(65 + optIdx);
                              const isCorrect = quest.correctOptionId === opt.id;
                              const normalized = opt.text.trim().toLowerCase();
                              const isDuplicate = normalized !== '' && optionTexts.filter((t) => t === normalized).length > 1;

                              return (
                                <div key={opt.id} className="space-y-1.5 bg-slate-100/40 dark:bg-[#0c152e]/60 p-2.5 rounded-xl border border-slate-200/60 dark:border-[#1e2e56]">
                                  <div className="flex items-center space-x-2">
                                    {/* Correct Answer Radio Button */}
                                    <button
                                      type="button"
                                      onClick={() => handleSetCorrectOption(qIdx, opt.id)}
                                      className={`w-7 h-7 rounded-full flex items-center justify-center font-mono font-bold text-xs transition-all shrink-0 ${isCorrect
                                          ? 'bg-emerald-500 text-white ring-2 ring-emerald-500/50 shadow-xs'
                                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
                                        }`}
                                      title={isCorrect ? 'Correct Answer' : 'Mark as Correct Answer'}
                                    >
                                      {isCorrect ? <Check className="w-4 h-4 text-white" /> : optionLetter}
                                    </button>

                                    {/* Option Text Input */}
                                    <Input
                                      placeholder={`Option ${optionLetter} text...`}
                                      value={opt.text}
                                      onChange={(e) => handleUpdateOptionText(qIdx, optIdx, e.target.value)}
                                      className={`flex-1 ${isDuplicate ? 'border-rose-500 text-rose-600 dark:text-rose-400 focus:ring-rose-500/50 bg-rose-500/5' : ''}`}
                                    />

                                    {/* Delete Option */}
                                    {quest.options.length > 2 && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteOption(qIdx, optIdx)}
                                        className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                                        title="Remove Option"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>

                                  {/* Per-Option Explanation / Rationale Input */}
                                  <div className="pl-9 pr-6 space-y-1">
                                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                      <span>Explanation for Option {optionLetter}:</span>
                                      {formik.values.accessType === 'PAID' && (
                                        <span className="text-[10px] font-extrabold text-cyan-400 uppercase tracking-wider">★ Included in Premium Solution PDF</span>
                                      )}
                                    </div>
                                    <input
                                      type="text"
                                      placeholder={`Explanation for Option ${optionLetter} (Why it is correct/incorrect)...`}
                                      value={opt.explanation || ''}
                                      onChange={(e) => handleUpdateOptionExplanation(qIdx, optIdx, e.target.value)}
                                      className="w-full text-xs bg-white dark:bg-[#091124] border border-slate-200 dark:border-[#1e2e56] text-slate-800 dark:text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 italic placeholder:not-italic"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                            {hasDuplicates && (
                              <p className="text-xs font-semibold text-rose-500 flex items-center space-x-1 pt-1">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>Options must be unique. Each option within a question must have distinct content.</span>
                              </p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Explanation */}
                  <Input
                    label="Answer Key Explanation (Optional)"
                    placeholder="Provide rationale displayed to students during review..."
                    value={quest.explanation || ''}
                    onChange={(e) => handleUpdateQuestionExplanation(qIdx, e.target.value)}
                  />
                </Card>
              ))}

              <Button
                type="button"
                variant="outline"
                className="w-full font-bold border-dashed border-2 border-slate-300 dark:border-[#1e2e56] flex items-center justify-center space-x-1.5"
                onClick={handleAddQuestion}
              >
                <Plus className="w-4 h-4" />
                <span>Add Another Question</span>
              </Button>

              <div className="pt-4 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-1/3 font-semibold flex items-center justify-center space-x-1.5"
                  onClick={() => setActiveStep('SETTINGS')}
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Settings</span>
                </Button>
                <Button
                  type="submit"
                  variant="gold"
                  className="w-2/3 font-bold shadow-md shadow-cyan-500/20 flex items-center justify-center space-x-2"
                  isLoading={formik.isSubmitting}
                >
                  <Send className="w-4 h-4" />
                  <span>{editingQuizId ? 'Save Quiz & Questions' : 'Publish Quiz & Questions'}</span>
                </Button>
              </div>
            </div>
          )}
        </form>
      </Dialog>

      {/* Questions Inspector Modal */}
      {inspectQuiz && (
        <Dialog
          isOpen={Boolean(inspectQuiz)}
          onClose={() => setInspectQuiz(null)}
          title={`Question Set Inspector: "${inspectQuiz.title}"`}
        >
          <div className="space-y-4 pt-2 max-h-[60vh] overflow-y-auto pr-1">
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
    </div>
  );
}
