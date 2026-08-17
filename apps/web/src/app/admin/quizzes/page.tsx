'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { ApiClient } from '@/lib/api-client';
import { Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button, Dialog, ConfirmDialog, Input, Badge, Pagination, Skeleton, DatePicker, TimePicker, combineDateAndTime, splitIsoToDateAndTime, getMinMockTestTime, todayLocalDateStr, Select } from '@psc/ui';
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
  ChevronDown,
  Loader2,
  X,
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
  category: '',
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

function nowLocalTimeStr(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/**
 * The same one-minute allowance the API applies, so a form that validated on
 * the client is never rejected by the server for a few seconds of typing.
 */
const RELEASE_GRACE_MS = 60_000;

/**
 * Turns the two pickers into the ISO moment the quiz is released at.
 *
 * A blank time means midnight, which for *today's* date is already hours gone —
 * an admin picking today and no time means "put it out now", not "reject this
 * as a past date". So that one case releases immediately; every other
 * combination is taken literally.
 */
function resolveReleaseIso(releaseDate?: string, releaseTime?: string): string {
  if (!releaseDate) return '';
  const iso = combineDateAndTime(releaseDate, releaseTime);
  return iso || '';
}

/** Formats the quiz release timestamp for table display and detects whether it is upcoming. */
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

/**
 * `originalReleaseIso` is the release moment the quiz already carries when the
 * edit dialog opens. A quiz released last month must stay editable, so the
 * "not in the past" rule applies only once that value actually changes.
 */
const makeQuizSchema = (originalReleaseIso?: string) => Yup.object({
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
    then: (schema) =>
      schema
        .trim()
        .required('Scheduled date is required for a live mock test.')
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
        .required('Scheduled time is required for a live mock test.')
        .test(
          'at-least-1-min-future',
          'Scheduled date and time must be at least 1 minute after the current time.',
          function (time) {
            const date = (this.parent as QuizFormValues).mockTestDate;
            if (!date || !time) return true;
            const iso = combineDateAndTime(date, time);
            if (!iso) return true;
            const minAllowedTime = Date.now() + 60_000 - 5_000;
            return new Date(iso).getTime() >= minAllowedTime;
          },
        ),
    otherwise: (schema) => schema.notRequired(),
  }),
});

const DEFAULT_QUIZ_SCHEMA = makeQuizSchema();

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

interface FolderComboboxProps {
  currentFolder: string;
  folders: string[];
  isUpdating: boolean;
  onSelect: (folderName: string) => void;
  onDeleteFolder?: (folderName: string) => void;
}

function FolderCombobox({ currentFolder, folders, isUpdating, onSelect, onDeleteFolder }: FolderComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const displayFolder = (!currentFolder || currentFolder === 'Root / No Folder' || currentFolder === 'Root') ? 'Root' : currentFolder;

  // Filter folder options
  const filtered = folders.filter((f) => {
    const name = f === 'Root / No Folder' ? 'Root' : f;
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const hasExactMatch = folders.some(
    (f) => (f === 'Root / No Folder' ? 'Root' : f).toLowerCase() === search.trim().toLowerCase()
  );

  return (
    <div className="relative inline-block text-left" ref={popoverRef}>
      {isUpdating ? (
        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-900 dark:text-amber-300 border border-amber-500/25 shadow-2xs">
          <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
          <span>Updating...</span>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title="Click to select or search folder assignment"
          className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-500/25 hover:border-amber-500/50 shadow-2xs cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/40"
        >
          <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="max-w-[140px] truncate">{displayFolder}</span>
          <ChevronDown className="w-3 h-3 text-amber-500/80 shrink-0" />
        </button>
      )}

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-64 z-[999] bg-white dark:bg-[#0c162d] border border-slate-200 dark:border-[#1e2e56] rounded-2xl shadow-2xl overflow-hidden p-2 animate-in fade-in zoom-in-95 duration-150">
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Type to search or create folder..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && search.trim()) {
                  e.preventDefault();
                  onSelect(search.trim());
                  setIsOpen(false);
                  setSearch('');
                }
              }}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-[#091124] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 font-semibold"
            />
          </div>

          <div className="max-h-48 overflow-y-auto space-y-0.5 custom-scrollbar">
            {filtered.map((f) => {
              const folderName = (!f || f === 'Root / No Folder' || f === 'Root') ? 'Root' : f;
              const isSelected = folderName === displayFolder;
              const isRoot = folderName === 'Root';
              return (
                <div
                  key={f}
                  className={`w-full group/item flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    isSelected
                      ? 'bg-amber-500/15 text-amber-900 dark:text-amber-300'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(folderName);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className="flex-1 text-left flex items-center space-x-2 truncate min-w-0 cursor-pointer"
                  >
                    <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="truncate">{folderName}</span>
                  </button>

                  <div className="flex items-center space-x-1 shrink-0 ml-1">
                    {isSelected && <Check className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                    {!isRoot && onDeleteFolder && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteFolder(folderName);
                        }}
                        title={`Delete folder "${folderName}"`}
                        className="opacity-0 group-hover/item:opacity-100 hover:bg-rose-500/15 text-slate-400 hover:text-rose-500 p-1 rounded-lg transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && !search.trim() && (
              <div className="text-center py-3 text-xs text-slate-400">No folders found</div>
            )}

            {search.trim() && !hasExactMatch && (
              <button
                type="button"
                onClick={() => {
                  const newFolder = search.trim();
                  onSelect(newFolder);
                  setIsOpen(false);
                  setSearch('');
                }}
                className="w-full text-left flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-colors cursor-pointer mt-1"
              >
                <div className="flex items-center space-x-2 truncate min-w-0">
                  <Plus className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                  <span className="truncate">Create & Assign "{search.trim()}"</span>
                </div>
                <span className="text-[10px] text-cyan-500/70 ml-2 font-mono shrink-0">↵ Enter</span>
              </button>
            )}
          </div>

          {!search.trim() && (
            <div className="pt-1.5 mt-1.5 border-t border-slate-200/80 dark:border-slate-800/80 px-1">
              <p className="text-[10px] text-slate-400 text-center font-medium">
                💡 Type any new name in the search box above to create a folder
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function QuizAdminPage() {
  const router = useRouter();

  // Data state
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [folders, setFolders] = useState<string[]>(['Root']);
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
  // Release moment the quiz being edited already had, so re-saving an
  // already-released quiz isn't blocked by the "no past dates" rule.
  const [originalReleaseIso, setOriginalReleaseIso] = useState<string | undefined>(undefined);

  const [isCreatingNewFolder, setIsCreatingNewFolder] = useState(false);
  const [formSubmitError, setFormSubmitError] = useState('');

  const currentEditingQuiz = editingQuizId ? quizzes.find((q) => q.id === editingQuizId) : null;
  const isAlreadyReleased = Boolean(
    editingQuizId &&
      currentEditingQuiz &&
      (!currentEditingQuiz.releaseDate || new Date(currentEditingQuiz.releaseDate).getTime() <= Date.now()),
  );

  // Inspector Modal State
  const [inspectQuiz, setInspectQuiz] = useState<QuizItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuizItem | null>(null);
  const [folderDeleteTarget, setFolderDeleteTarget] = useState<string | null>(null);

  // Quick Inline Edit State
  const [updatingFolderQuizId, setUpdatingFolderQuizId] = useState<string | null>(null);
  const [updatingStatusQuizId, setUpdatingStatusQuizId] = useState<string | null>(null);

  // Floating Toast Notification State
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => setToastMsg(null), 4000);
    return () => clearTimeout(timer);
  }, [toastMsg]);

  // Helper to map API response to local QuizItem format
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

  const [totalCount, setTotalCount] = useState(0);

  // Fetch quizzes from the API with server-side pagination and filters
  const fetchQuizzes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await ApiClient.getQuizzes({
        page: currentPage,
        limit: pageSize,
        search: searchTerm.trim() || undefined,
        folder: selectedFolderFilter !== 'ALL' ? selectedFolderFilter : undefined,
        access: selectedAccessFilter !== 'ALL' ? selectedAccessFilter : undefined,
        status: selectedStatusFilter !== 'ALL' ? selectedStatusFilter : undefined,
      });

      const data = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      const total = typeof res?.total === 'number' ? res.total : data.length;
      setTotalCount(total);

      const mapped = data.map(mapApiQuizToLocal);
      setQuizzes(mapped);

      // Build folder list from API data
      const apiFolders = mapped.map((q: QuizItem) => q.folderName).filter((f: string | null | undefined): f is string => Boolean(f && f !== 'Root / No Folder' && f !== 'Root'));
      const uniqueFolders = Array.from(new Set(['Root', ...apiFolders]));
      setFolders((prev) => Array.from(new Set([...prev, ...uniqueFolders])));
    } catch (err) {
      console.error('Failed to fetch quizzes:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchTerm, selectedFolderFilter, selectedAccessFilter, selectedStatusFilter, mapApiQuizToLocal]);

  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => {
      fetchQuizzes();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchQuizzes]);

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

  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 10_000);
    return () => clearInterval(interval);
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
    validationSchema: originalReleaseIso ? makeQuizSchema(originalReleaseIso) : DEFAULT_QUIZ_SCHEMA,
    onSubmit: async (values, { setSubmitting }) => {
      // Determine target folder
      let targetFolder = values.selectedFolder;
      if (isCreatingNewFolder && values.newFolderName.trim()) {
        targetFolder = values.newFolderName.trim();
        if (!folders.includes(targetFolder)) {
          setFolders((prev) => [...prev, targetFolder]);
        }
      }

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
        category: 'General',
        folderName: (!targetFolder || targetFolder === 'Root / No Folder' || targetFolder === 'Root') ? 'Root' : targetFolder,
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
    setOriginalReleaseIso(undefined);
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
    // Recombined rather than taken raw, so it matches exactly what the form
    // will submit when the admin leaves the pickers untouched.
    setOriginalReleaseIso(combineDateAndTime(relDate, relTime) || undefined);
    // Prefill from the session this quiz is already scheduled as, so editing
    // re-times that session instead of creating a duplicate.
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
    const today = todayLocalDateStr();
    const minTime = getMinMockTestTime(today) || '10:00';
    if (!formik.values.mockTestDate) {
      formik.setFieldValue('mockTestDate', today);
    }
    if (!formik.values.mockTestTime) {
      formik.setFieldValue('mockTestTime', minTime);
    }
  };

  const handleDeleteQuiz = async (id: string) => {
    const previousQuizzes = quizzes;
    setQuizzes((prev) => prev.filter((q) => q.id !== id));
    try {
      await ApiClient.deleteQuiz(id);
      setToastMsg({ type: 'success', text: 'Quiz deleted successfully.' });
    } catch (err: any) {
      setQuizzes(previousQuizzes);
      setToastMsg({ type: 'error', text: err.message || 'Failed to delete quiz.' });
    }
  };

  const confirmDeleteFolder = async (folderToDelete: string) => {
    if (!folderToDelete || folderToDelete === 'Root' || folderToDelete === 'Root / No Folder') {
      setToastMsg({ type: 'warning', text: 'Root folder cannot be deleted.' });
      return;
    }

    const quizzesInFolder = quizzes.filter((q) => q.folderName === folderToDelete);

    // 1. Remove folder from local folders state
    setFolders((prev) => prev.filter((f) => f !== folderToDelete));

    // 2. If filter was selected to this folder, reset filter to 'ALL'
    if (selectedFolderFilter === folderToDelete) {
      setSelectedFolderFilter('ALL');
    }

    // 3. Move all quizzes in this folder to 'Root'
    if (quizzesInFolder.length > 0) {
      const previousQuizzes = quizzes;
      setQuizzes((prev) =>
        prev.map((q) => (q.folderName === folderToDelete ? { ...q, folderName: 'Root' } : q))
      );

      try {
        await Promise.all(
          quizzesInFolder.map((q) => ApiClient.updateQuiz(q.id, { folderName: 'Root' }))
        );
        setToastMsg({
          type: 'success',
          text: `Folder "${folderToDelete}" deleted. ${quizzesInFolder.length} quiz(zes) moved to Root.`,
        });
      } catch (err: any) {
        setQuizzes(previousQuizzes);
        setFolders((prev) => Array.from(new Set([...prev, folderToDelete])));
        setToastMsg({ type: 'error', text: err.message || 'Failed to reassign quizzes to Root.' });
      }
    } else {
      setToastMsg({ type: 'success', text: `Folder "${folderToDelete}" deleted.` });
    }
  };

  const handleQuickUpdateFolder = async (quiz: QuizItem, newFolder: string) => {
    const targetFolder = (!newFolder || newFolder === 'Root / No Folder' || newFolder === 'Root') ? 'Root' : newFolder;
    if (quiz.folderName === targetFolder) return;

    const previousQuizzes = quizzes;
    setQuizzes((prev) =>
      prev.map((q) => (q.id === quiz.id ? { ...q, folderName: targetFolder } : q))
    );
    setUpdatingFolderQuizId(quiz.id);

    try {
      await ApiClient.updateQuiz(quiz.id, { folderName: targetFolder });
      setToastMsg({ type: 'success', text: `Folder updated to "${targetFolder}"` });
    } catch (err: any) {
      setQuizzes(previousQuizzes);
      setToastMsg({ type: 'error', text: err.message || 'Failed to update folder assignment.' });
    } finally {
      setUpdatingFolderQuizId(null);
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

    const previousQuizzes = quizzes;
    setQuizzes((prev) =>
      prev.map((q) => (q.id === quiz.id ? { ...q, isActive: nextIsActive } : q))
    );
    setUpdatingStatusQuizId(quiz.id);

    try {
      await ApiClient.updateQuiz(quiz.id, { isActive: nextIsActive });
      setToastMsg({
        type: 'success',
        text: `Status updated to ${nextIsActive ? 'Active' : 'Inactive'}`,
      });
    } catch (err: any) {
      setQuizzes(previousQuizzes);
      setToastMsg({ type: 'error', text: err.message || 'Failed to update quiz active status.' });
    } finally {
      setUpdatingStatusQuizId(null);
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

    const rel = formatReleaseDateTime(quiz.releaseDate);
    const matchesStatus =
      selectedStatusFilter === 'ALL' ||
      (selectedStatusFilter === 'ACTIVE' && quiz.isActive !== false && !rel.isUpcoming) ||
      (selectedStatusFilter === 'UPCOMING' && rel.isUpcoming) ||
      (selectedStatusFilter === 'INACTIVE' && quiz.isActive === false && !rel.isUpcoming);

    return matchesSearch && matchesFolder && matchesAccess && matchesStatus;
  });

  const totalItems = totalCount;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const paginatedQuizzes = Array.isArray(quizzes) ? quizzes : [];

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
            <Select
              value={selectedFolderFilter}
              onChange={(val) => setSelectedFolderFilter(val)}
              icon={<Folder className="w-4 h-4 text-cyan-500" />}
              searchable
              options={[
                { value: 'ALL', label: 'All Folders & Root' },
                { value: 'ROOT', label: 'Root Level Only' },
                ...folders
                  .filter((f) => f !== 'Root / No Folder' && f !== 'Root')
                  .map((folder) => ({ value: folder, label: folder })),
              ]}
            />

            {/* Access Type Filter */}
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

            {/* Active Status Filter */}
            <Select
              value={selectedStatusFilter}
              onChange={(val) => setSelectedStatusFilter(val)}
              icon={<CheckCircle2 className="w-4 h-4 text-cyan-500" />}
              options={[
                { value: 'ALL', label: 'All Statuses (Active, Upcoming & Draft)' },
                { value: 'ACTIVE', label: '🟢 Active Only (Released & Visible)' },
                { value: 'UPCOMING', label: '⏰ Upcoming Only (Scheduled)' },
                { value: 'INACTIVE', label: '⚪ Draft / Hidden Only' },
              ]}
            />
          </div>
        </Card>
      </div>

      {/* Scrollable Quizzes Table Container */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border border-slate-200/80 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] shadow-sm p-0">
        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 relative">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px] max-w-[280px]">Quiz Title</TableHead>
                <TableHead className="whitespace-nowrap">Folder Assignment</TableHead>
                <TableHead className="whitespace-nowrap">Access Type</TableHead>
                <TableHead className="whitespace-nowrap">Release Schedule</TableHead>
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
                    <TableCell className="py-4"><Skeleton className="h-5 w-28 rounded-lg" /></TableCell>
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
                paginatedQuizzes.map((quiz) => {
                  const rel = formatReleaseDateTime(quiz.releaseDate);

                  return (
                  <TableRow key={quiz.id}>
                    <TableCell className="max-w-[200px] lg:max-w-[280px] py-4">
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
                      <FolderCombobox
                        currentFolder={quiz.folderName}
                        folders={folders}
                        isUpdating={updatingFolderQuizId === quiz.id}
                        onSelect={(newFolder) => handleQuickUpdateFolder(quiz, newFolder)}
                        onDeleteFolder={(folder) => setFolderDeleteTarget(folder)}
                      />
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
                      {rel.isImmediate ? (
                        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                          Immediate
                        </span>
                      ) : (
                        <div className="flex flex-col text-xs space-y-0.5">
                          <div className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-200">
                            <Clock className={`w-3 h-3 shrink-0 ${rel.isUpcoming ? 'text-amber-500' : 'text-slate-400'}`} />
                            <span>{rel.formattedDate}</span>
                          </div>
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 pl-4">
                            {rel.formattedTime}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {(() => {
                        const qCount = quiz.questionsCount ?? (quiz.questions?.length ?? 0);
                        const isUpdating = updatingStatusQuizId === quiz.id;

                        if (isUpdating) {
                          return (
                            <Badge variant="outline" className="font-extrabold flex items-center w-fit gap-1.5 text-[11px] bg-slate-500/10 text-slate-600 dark:text-slate-300 border border-slate-500/30 px-2.5 py-1">
                              <Loader2 className="w-3 h-3 animate-spin text-cyan-500" />
                              <span>Updating...</span>
                            </Badge>
                          );
                        }

                        if (rel.isUpcoming) {
                          return (
                            <div
                              className="cursor-not-allowed select-none"
                              title={`Upcoming: Scheduled for release on ${rel.fullFormatted}. Cannot be activated manually.`}
                            >
                              <Badge
                                variant="outline"
                                className="font-extrabold flex items-center w-fit gap-1.5 text-[11px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40 px-2.5 py-1 shadow-sm"
                              >
                                <Clock className="w-3 h-3 text-amber-500 animate-pulse" />
                                <span>Upcoming</span>
                                <Lock className="w-2.5 h-2.5 opacity-60 ml-0.5 text-amber-600 dark:text-amber-400" />
                              </Badge>
                            </div>
                          );
                        }

                        if (quiz.isActive) {
                          if (qCount === 0) {
                            return (
                              <button
                                type="button"
                                onClick={() => handleQuickToggleActive(quiz)}
                                title="Click to toggle status (Warning: No questions added)"
                                className="cursor-pointer transition-all hover:scale-105 active:scale-95 focus:outline-none"
                              >
                                <Badge
                                  variant="outline"
                                  className="font-extrabold flex items-center w-fit gap-1.5 text-[11px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 px-2.5 py-1 hover:border-amber-500/60"
                                >
                                  <AlertCircle className="w-3 h-3" />
                                  <span>No Questions</span>
                                  <Edit3 className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                                </Badge>
                              </button>
                            );
                          }
                          return (
                            <button
                              type="button"
                              onClick={() => handleQuickToggleActive(quiz)}
                              title="Click to toggle status to Inactive"
                              className="cursor-pointer transition-all hover:scale-105 active:scale-95 focus:outline-none"
                            >
                              <Badge
                                variant="success"
                                className="font-extrabold flex items-center w-fit gap-1.5 text-[11px] bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 px-2.5 py-1 hover:bg-emerald-500/25 hover:border-emerald-500/50"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span>Active</span>
                                <Edit3 className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                              </Badge>
                            </button>
                          );
                        }
                        return (
                          <button
                            type="button"
                            onClick={() => handleQuickToggleActive(quiz)}
                            title="Click to toggle status to Active"
                            className="cursor-pointer transition-all hover:scale-105 active:scale-95 focus:outline-none"
                          >
                            <Badge
                              variant="outline"
                              className="font-extrabold flex items-center w-fit gap-1.5 text-[11px] bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30 px-2.5 py-1 hover:bg-rose-500/20 hover:border-rose-500/50"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              <span>Inactive</span>
                              <Edit3 className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                            </Badge>
                          </button>
                        );
                      })()}
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
                  );
                })
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
        <form className="space-y-4 pt-1" onSubmit={formik.handleSubmit} noValidate>
          {formSubmitError && (
            <div className="shrink-0 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-500 dark:text-rose-400 text-xs font-bold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{formSubmitError}</span>
            </div>
          )}

          <div className="space-y-4">
            <Input
              label="Quiz Title *"
              name="title"
              placeholder="e.g. Kerala History & Constitution Mock 2026"
              value={formik.values.title}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.title && formik.errors.title ? formik.errors.title : undefined}
            />

            {!isAlreadyReleased ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DatePicker
                  label="Release Date"
                  value={formik.values.releaseDate}
                  onChange={(d) => formik.setFieldValue('releaseDate', d)}
                  minDate={todayLocalDateStr()}
                  helperText="Students see this quiz only from this moment on. Leave empty to release immediately."
                />
                <TimePicker
                  label="Release Time"
                  value={formik.values.releaseTime}
                  onChange={(t) => formik.setFieldValue('releaseTime', t)}
                  minTime={
                    formik.values.releaseDate === todayLocalDateStr() ? nowLocalTimeStr() : undefined
                  }
                  error={formik.errors.releaseTime}
                  helperText={
                    !formik.errors.releaseTime
                      ? 'Blank = 12:00 AM on that date, or right away if the date is today.'
                      : undefined
                  }
                />
              </div>
            ) : (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Release Status: <strong>Live / Already Released</strong></span>
                </div>
                <Badge variant="success" className="text-[10px] font-extrabold px-2 py-0.5">
                  Live
                </Badge>
              </div>
            )}

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
                <div className="flex gap-2 items-center">
                  <div className="flex-1 min-w-0">
                    <Select
                      value={formik.values.selectedFolder}
                      onChange={(val) => formik.setFieldValue('selectedFolder', val)}
                      searchable
                      options={folders.map((f) => ({
                        value: f,
                        label: f === 'Root / No Folder' || f === 'Root' ? 'Root' : f,
                      }))}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreatingNewFolder(true)}
                    className="whitespace-nowrap font-bold flex items-center space-x-1 h-11"
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
                  <span className="ml-2.5 text-xs font-extrabold font-mono text-slate-800 dark:text-slate-200 w-8 text-left shrink-0">
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
                      <span className="ml-2.5 text-xs font-extrabold font-mono text-slate-800 dark:text-slate-200 w-8 text-left shrink-0">
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
                  <span className="ml-2.5 text-xs font-extrabold font-mono text-slate-800 dark:text-slate-200 w-8 text-left shrink-0">
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
                    <div className="flex items-center space-x-2 whitespace-nowrap">
                      <label htmlFor="isActive" className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white cursor-pointer whitespace-nowrap shrink-0">
                        Active Status (Visible to Students)
                      </label>
                      {formik.values.isActive ? (
                        editingQuizQuestionsCount === 0 ? (
                          <Badge variant="warning" className="font-extrabold text-[10px] px-2 py-0.5 inline-flex items-center gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 whitespace-nowrap shrink-0">
                            <AlertCircle className="w-3 h-3" />
                            <span>No Questions</span>
                          </Badge>
                        ) : (
                          <Badge variant="success" className="font-extrabold text-[10px] px-2 py-0.5 inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 whitespace-nowrap shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Active</span>
                          </Badge>
                        )
                      ) : (
                        <Badge variant="outline" className="font-extrabold text-[10px] px-2 py-0.5 inline-flex items-center gap-1 bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30 whitespace-nowrap shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          <span>Inactive</span>
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal mt-0.5">
                      {formik.values.isActive
                        ? editingQuizQuestionsCount === 0
                          ? 'When ON, makes quiz visible to students (requires at least 1 question).'
                          : 'When ON, quiz is published and visible to students.'
                        : 'When OFF, quiz is hidden from students.'}
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formik.values.isActive}
                    onChange={(e) => formik.setFieldValue('isActive', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-slate-600 peer-checked:bg-emerald-500"></div>
                  <span className="ml-2.5 text-xs font-extrabold font-mono text-slate-800 dark:text-slate-200 w-8 text-left shrink-0">
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
                    onChange={(e) => handleToggleLiveMock(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-slate-600 peer-checked:bg-cyan-500"></div>
                  <span className="ml-2.5 text-xs font-extrabold font-mono text-slate-800 dark:text-slate-200 w-8 text-left shrink-0">
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
                        minDate={todayLocalDateStr()}
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
                        minTime={getMinMockTestTime(formik.values.mockTestDate)}
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
          <div className="space-y-4 pt-1">
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

      <ConfirmDialog
        isOpen={folderDeleteTarget !== null}
        title="Delete Folder"
        description={
          folderDeleteTarget
            ? `Are you sure you want to delete folder "${folderDeleteTarget}"? Any quizzes inside this folder will automatically be moved to "Root".`
            : undefined
        }
        confirmLabel="Delete Folder"
        variant="danger"
        onConfirm={() => {
          if (folderDeleteTarget) confirmDeleteFolder(folderDeleteTarget);
          setFolderDeleteTarget(null);
        }}
        onCancel={() => setFolderDeleteTarget(null)}
      />

      {/* Top-Right Floating Toast Notifications */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-[9999] flex flex-col space-y-2.5 pointer-events-none max-w-sm sm:max-w-md w-full px-4 sm:px-0">
          <div className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-950/95 dark:bg-[#080e1e]/95 border ${
            toastMsg.type === 'success'
              ? 'border-emerald-500/40 text-emerald-400'
              : toastMsg.type === 'warning'
              ? 'border-amber-500/40 text-amber-400'
              : 'border-rose-500/40 text-rose-400'
          } shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300`}>
            <div className="flex items-center space-x-3 min-w-0">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                toastMsg.type === 'success'
                  ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                  : toastMsg.type === 'warning'
                  ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
                  : 'bg-rose-500/20 border border-rose-500/30 text-rose-400'
              }`}>
                {toastMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
              </div>
              <span className="text-xs font-extrabold leading-relaxed text-slate-100">{toastMsg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMsg(null)}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800 shrink-0 cursor-pointer"
              title="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
