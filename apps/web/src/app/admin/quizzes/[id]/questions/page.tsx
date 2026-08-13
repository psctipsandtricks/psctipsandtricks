'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Button,
  Card,
  Input,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Dialog,
  ConfirmDialog,
  Pagination,
} from '@psc/ui';
import { ApiClient } from '@/lib/api-client';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type DragMoveEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit3,
  Check,
  AlertCircle,
  Sparkles,
  ListChecks,
  CheckCircle2,
  HelpCircle,
  Search,
  GripVertical,
  Award,
  X,
} from 'lucide-react';

import { optionLetter, validateQuestionForm, type QuizQuestion } from './question-validation';
import { SortableQuestionRow, QuestionDragPreviewCard } from './question-row';

/** Shared by the initial load and the post-save reconciliation, so both read a server question the same way. */
function mapApiQuestionsToLocal(apiQuestions: any[]): QuizQuestion[] {
  return (apiQuestions || []).map((q: any) => ({
    id: q.id || `q-${Math.random()}`,
    text: q.text || '',
    marks: q.marks ?? 1,
    explanation: q.explanation ?? '',
    options: Array.isArray(q.options)
      ? q.options.map((o: any, idx: number) => ({
        id: typeof o === 'string' ? `opt-${idx}` : o.id || `opt-${idx}`,
        text: typeof o === 'string' ? o : o.text || '',
        explanation: typeof o === 'object' && o ? o.explanation || '' : '',
      }))
      : [],
    correctOptionId:
      Array.isArray(q.options) && q.options[q.correctOptionIndex]
        ? typeof q.options[q.correctOptionIndex] === 'string'
          ? `opt-${q.correctOptionIndex}`
          : q.options[q.correctOptionIndex].id
        : '',
  }));
}

const EMPTY_QUESTION = (): QuizQuestion => {
  const qId = `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const opt1 = `opt-${Date.now()}-1`;
  const opt2 = `opt-${Date.now()}-2`;
  const opt3 = `opt-${Date.now()}-3`;
  const opt4 = `opt-${Date.now()}-4`;
  return {
    id: qId,
    text: '',
    marks: 1,
    explanation: '',
    options: [
      { id: opt1, text: '' },
      { id: opt2, text: '' },
      { id: opt3, text: '' },
      { id: opt4, text: '' },
    ],
    // Left unset on purpose: marking the correct answer is a required decision,
    // so it must not default to option A behind the admin's back.
    correctOptionId: '',
  };
};

export default function QuizQuestionsStudioPage() {
  const params = useParams();
  const router = useRouter();
  const quizId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Single Question Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [currentForm, setCurrentForm] = useState<QuizQuestion>(EMPTY_QUESTION());
  const [modalError, setModalError] = useState('');
  // Field errors stay hidden until the first save attempt, then update live as
  // the admin fixes each one.
  const [showFieldErrors, setShowFieldErrors] = useState(false);

  // Auto-expanding Container Ref
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const modalScrollRef = useRef<HTMLDivElement>(null);

  // Delete Confirm State
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  // Read-only "View Question" Modal State
  const [viewIndex, setViewIndex] = useState<number | null>(null);

  // Drag-to-Reorder State — the dragged item's id is tracked, and every swap
  // is applied to the full `questions` array (never the paginated/filtered
  // view), so a drop always lands in the right place regardless of search or
  // page.
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  // Snapshot of `questions` at drag-start, used at drag-end to tell whether
  // the order actually changed (and so is worth persisting) and to restore
  // it if the drag is cancelled (e.g. Escape).
  const dragStartOrderRef = useRef<QuizQuestion[] | null>(null);
  const dragHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragHoverPageRef = useRef<number | null>(null);

  // Custom Move to Position Dialog State
  const [moveTargetQuestionIndex, setMoveTargetQuestionIndex] = useState<number | null>(null);
  const [targetPositionInput, setTargetPositionInput] = useState<string>('');

  // Page Alerts State
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Recomputed every render so errors clear the moment a field is corrected.
  const formErrors = validateQuestionForm(currentForm);
  const hasFieldErrors = showFieldErrors && formErrors.summary.length > 0;

  const fetchQuiz = useCallback(async () => {
    if (!quizId) return;
    try {
      setLoading(true);
      const data = await ApiClient.getQuizById(quizId);
      setQuiz(data);
      setQuestions(mapApiQuestionsToLocal(data.questions || []));
    } catch (err: any) {
      console.error('Failed to load quiz:', err);
      setPageError(err.message || 'Failed to load quiz details.');
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    fetchQuiz();
  }, [fetchQuiz]);

  // Auto-expand all textareas inside the modal container on open or content update
  useEffect(() => {
    if (isModalOpen && modalContainerRef.current) {
      const textareas = modalContainerRef.current.querySelectorAll('textarea');
      textareas.forEach((ta) => {
        ta.style.height = 'auto';
        ta.style.height = `${ta.scrollHeight}px`;
      });
    }
  }, [isModalOpen, currentForm]);

  // Open Modal for Creating a New Question
  const handleOpenCreateModal = () => {
    setEditingIndex(null);
    setCurrentForm(EMPTY_QUESTION());
    setModalError('');
    setShowFieldErrors(false);
    setIsModalOpen(true);
  };

  // Open Modal for Editing an Existing Question
  const handleOpenEditModal = (questionIndex: number) => {
    setEditingIndex(questionIndex);
    const targetQ = questions[questionIndex];
    setCurrentForm(JSON.parse(JSON.stringify(targetQ)));
    setModalError('');
    setShowFieldErrors(false);
    setIsModalOpen(true);
  };

  // Helpers for Question Form inside Modal
  const handleUpdateFormText = (text: string) => {
    setCurrentForm((prev) => ({ ...prev, text }));
  };

  const handleUpdateFormExplanation = (explanation: string) => {
    setCurrentForm((prev) => ({ ...prev, explanation }));
  };

  const handleAddOption = () => {
    if (currentForm.options.length >= 6) {
      setModalError('Maximum 6 options allowed per question.');
      return;
    }
    setModalError('');
    const newOptId = `opt-${Date.now()}-${currentForm.options.length + 1}`;
    setCurrentForm((prev) => ({
      ...prev,
      options: [...prev.options, { id: newOptId, text: '' }],
    }));
  };

  const handleUpdateOptionText = (optIdx: number, text: string) => {
    setCurrentForm((prev) => ({
      ...prev,
      options: prev.options.map((o, idx) => (idx === optIdx ? { ...o, text } : o)),
    }));
  };

  const handleUpdateOptionExplanation = (optIdx: number, explanation: string) => {
    setCurrentForm((prev) => ({
      ...prev,
      options: prev.options.map((o, idx) => (idx === optIdx ? { ...o, explanation } : o)),
    }));
  };

  const handleDeleteOption = (optIdx: number) => {
    if (currentForm.options.length <= 2) {
      setModalError('Each question must have at least 2 options.');
      return;
    }
    setModalError('');
    const optToDelete = currentForm.options[optIdx];
    setCurrentForm((prev) => {
      const filtered = prev.options.filter((_, idx) => idx !== optIdx);
      const isSelectedDeleted = prev.correctOptionId === optToDelete.id;
      return {
        ...prev,
        options: filtered,
        // Clear rather than silently promote the next option — deleting the
        // correct answer must force a fresh, deliberate choice.
        correctOptionId: isSelectedDeleted ? '' : prev.correctOptionId,
      };
    });
  };

  const handleSetCorrectOption = (optionId: string) => {
    setCurrentForm((prev) => ({ ...prev, correctOptionId: optionId }));
  };

  // Persist Updated Questions List to Backend API
  const saveQuestionsToBackend = async (updatedQuestionsList: QuizQuestion[]) => {
    // Optimistic update: the table reflects the change the instant the admin
    // saves, rather than waiting on the network round-trip. Previously the
    // list only updated once the PUT resolved — and was then immediately
    // overwritten by a *second* full GET refetch, which is what made adding a
    // question feel like it took several seconds.
    const previousQuestions = questions;
    setQuestions(updatedQuestionsList);
    setSaving(true);
    setPageError('');
    try {
      const formatted = updatedQuestionsList.map((q) => {
        const correctIndex = q.options.findIndex((o) => o.id === q.correctOptionId);
        return {
          text: q.text.trim(),
          options: q.options.map((o) => ({
            id: o.id,
            text: o.text.trim(),
            explanation: o.explanation || undefined,
          })),
          correctOptionIndex: correctIndex >= 0 ? correctIndex : 0,
          explanation: q.explanation || undefined,
          marks: q.marks || 1,
        };
      });

      const totalMarks = formatted.reduce((sum, q) => sum + (q.marks || 1), 0);

      // The PUT response already carries the authoritative, DB-assigned
      // question list, so reconciling from it replaces the old second GET
      // round-trip entirely instead of stacking on top of it.
      const updatedQuiz = await ApiClient.updateQuiz(quizId, {
        questions: formatted,
        totalMarks,
      });

      // The backend force-hides a questionless quiz and auto-publishes it the
      // instant the first question lands — surface that state change here
      // rather than leaving the admin to notice it only from the quiz list.
      const justPublished = previousQuestions.length === 0 && updatedQuestionsList.length > 0 && updatedQuiz?.isActive;
      const justHidden = previousQuestions.length > 0 && updatedQuestionsList.length === 0;

      if (updatedQuiz && Array.isArray(updatedQuiz.questions)) {
        setQuiz(updatedQuiz);
        const serverMapped = mapApiQuestionsToLocal(updatedQuiz.questions);
        const reconciled = updatedQuestionsList.map((q, idx) => {
          if (serverMapped[idx]) {
            return { ...serverMapped[idx], id: q.id };
          }
          return q;
        });
        setQuestions(reconciled.length > 0 ? reconciled : serverMapped);
      }

      setSuccessMsg(
        justPublished
          ? '🎉 First question added — this quiz is now live and visible to students!'
          : justHidden
            ? 'Last question removed — this quiz is hidden from students until you add another.'
            : 'Questions saved successfully!',
      );
      setTimeout(() => setSuccessMsg(''), justPublished || justHidden ? 6000 : 4000);
    } catch (err: any) {
      console.error('Failed to save questions:', err);
      setPageError(err.message || 'Failed to save question to server.');
      // The server never got the change — undo the optimistic update so the
      // table doesn't show a question that doesn't actually exist yet.
      setQuestions(previousQuestions);
    } finally {
      setSaving(false);
    }
  };

  // Save Modal Action
  const handleSaveQuestionModal = async () => {
    setModalError('');
    setShowFieldErrors(true);

    if (formErrors.summary.length > 0) {
      // Bring the summary banner back into view — the offending field may be
      // far down the scrolled option list.
      modalScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    let nextQuestions: QuizQuestion[];
    if (editingIndex !== null && editingIndex >= 0 && editingIndex < questions.length) {
      nextQuestions = questions.map((q, idx) => (idx === editingIndex ? currentForm : q));
    } else {
      nextQuestions = [...questions, currentForm];
    }

    setIsModalOpen(false);
    await saveQuestionsToBackend(nextQuestions);
  };

  // Reordering Questions
  const handleMoveQuestion = async (index: number, direction: 'UP' | 'DOWN') => {
    if (saving) return;
    if (index < 0 || index >= questions.length) return;
    if ((direction === 'UP' && index === 0) || (direction === 'DOWN' && index === questions.length - 1)) return;
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    const nextQuestions = [...questions];
    const temp = nextQuestions[index];
    nextQuestions[index] = nextQuestions[targetIndex];
    nextQuestions[targetIndex] = temp;

    await saveQuestionsToBackend(nextQuestions);
  };

  // Drag-to-Reorder Questions — a faster alternative to repeated Up/Down
  // clicks when moving a question a long distance. Disabled while a search
  // filter is active, since dragging a filtered subset can't unambiguously
  // express a position in the full list.
  const canReorder = !searchTerm.trim();

  // Mouse needs to actually move a few pixels before a press counts as a
  // drag (so a plain click still reaches its button); touch gets a short
  // hold instead, so a swipe-to-scroll on the table isn't hijacked.
  const dragSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const activeQuestion = activeQuestionId ? questions.find((q) => q.id === activeQuestionId) ?? null : null;
  const activeQuestionIndex = activeQuestion ? questions.findIndex((q) => q.id === activeQuestionId) : -1;

  const clearDragHoverTimer = () => {
    if (dragHoverTimer.current) {
      clearTimeout(dragHoverTimer.current);
      dragHoverTimer.current = null;
    }
    dragHoverPageRef.current = null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    dragStartOrderRef.current = questions;
    setActiveQuestionId(String(event.active.id));
    document.body.style.cursor = 'grabbing';
    document.body.classList.add('select-none');
  };

  // Swap semantics (not shift/insert): hovering the dragged question over
  // another question exchanges just those two positions — every other row
  // stays exactly where it was.
  const handleDragOverSort = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setQuestions((prev) => {
      const fromIndex = prev.findIndex((q) => q.id === active.id);
      const toIndex = prev.findIndex((q) => q.id === over.id);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return prev;
      const next = [...prev];
      [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
      return next;
    });
  };

  // Cross-page hover switching during drag-to-reorder — hovering the lifted
  // row over a page number (or Prev/Next) for a beat jumps there, so a
  // question can be dragged onto a page it isn't currently on.
  const handleDragMove = (event: DragMoveEvent) => {
    const rect = event.active.rect.current.translated;
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const target = document.elementFromPoint(cx, cy)?.closest('[data-page-target]') as HTMLElement | null;
    const targetPage = target ? Number(target.dataset.pageTarget) : null;

    if (!targetPage || targetPage === currentPage) {
      clearDragHoverTimer();
      return;
    }
    if (dragHoverPageRef.current === targetPage) return;

    clearDragHoverTimer();
    dragHoverPageRef.current = targetPage;
    dragHoverTimer.current = setTimeout(() => {
      setCurrentPage(targetPage);
      dragHoverTimer.current = null;
      dragHoverPageRef.current = null;
    }, 400);
  };

  const resetDragUiState = () => {
    document.body.style.cursor = '';
    document.body.classList.remove('select-none');
    clearDragHoverTimer();
    setActiveQuestionId(null);
  };

  const handleDragEndSort = async (_event: DragEndEvent) => {
    const startOrder = dragStartOrderRef.current;
    dragStartOrderRef.current = null;
    resetDragUiState();

    if (!startOrder) return;
    const changed = startOrder.some((q, idx) => q.id !== questions[idx]?.id);
    if (!changed) return;

    await saveQuestionsToBackend(questions);
  };

  const handleDragCancel = () => {
    const startOrder = dragStartOrderRef.current;
    dragStartOrderRef.current = null;
    resetDragUiState();
    if (startOrder) setQuestions(startOrder);
  };

  // Open "Move to Position" Dialog
  const handleOpenMoveModal = (actualIndex: number) => {
    setMoveTargetQuestionIndex(actualIndex);
    setTargetPositionInput(String(actualIndex + 1));
  };

  // Confirm custom position move
  const handleConfirmMoveToPosition = async (customPosition?: number) => {
    if (moveTargetQuestionIndex === null) return;
    const targetPos = customPosition !== undefined ? customPosition : parseInt(targetPositionInput, 10);

    if (isNaN(targetPos) || targetPos < 1 || targetPos > questions.length) {
      setPageError(`Please enter a valid position between 1 and ${questions.length}.`);
      return;
    }

    const fromIndex = moveTargetQuestionIndex;
    const toIndex = targetPos - 1;

    setMoveTargetQuestionIndex(null);

    if (fromIndex === toIndex) return;

    const nextQuestions = [...questions];
    const [moved] = nextQuestions.splice(fromIndex, 1);
    nextQuestions.splice(toIndex, 0, moved);

    // Calculate target page so UI navigates directly to where the moved question lands
    const newTargetPage = Math.ceil(targetPos / pageSize);
    setCurrentPage(newTargetPage);

    await saveQuestionsToBackend(nextQuestions);
  };

  // Delete Question
  const handleDeleteQuestionConfirm = async () => {
    if (deleteIndex === null) return;
    const nextQuestions = questions.filter((_, idx) => idx !== deleteIndex);
    setDeleteIndex(null);
    await saveQuestionsToBackend(nextQuestions);
  };

  // Filtered Questions List for Table Search
  const filteredQuestions = questions.filter((q) =>
    q.text.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const totalItems = filteredQuestions.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedQuestions = filteredQuestions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  if (loading) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4 animate-pulse">
        {/* Fixed Top Header & Search Bar */}
        <div className="shrink-0 space-y-3">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div className="space-y-2">
              <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-800 rounded-lg" />
              <div className="h-8 w-72 bg-slate-200 dark:bg-slate-800 rounded-xl" />
              <div className="h-3.5 w-56 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            </div>
            <div className="h-10 w-36 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          </div>

          <Card className="p-4 glass-card">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="h-10 w-full sm:w-80 bg-slate-200 dark:bg-slate-800 rounded-xl" />
              <div className="h-7 w-48 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            </div>
          </Card>
        </div>

        {/* Scrollable Questions Table Container */}
        <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border border-slate-200/80 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] shadow-sm p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-12 w-full bg-slate-200 dark:bg-slate-800 rounded-xl" />
          ))}
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4">
      {/* Fixed Top Header & Search Bar */}
      <div className="shrink-0 space-y-3">
        {/* Top Header Navigation */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <Link
              href="/admin/quizzes"
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline mb-2 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Quizzes List</span>
            </Link>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                Questions & Options Studio
              </h1>
              <Badge variant="gold" className="font-extrabold text-xs">
                {questions.length} Questions
              </Badge>
              {quiz && (
                quiz.isActive ? (
                  questions.length === 0 ? (
                    <Badge
                      title="Active status is checked, but no questions have been added yet."
                      className="font-bold text-xs flex items-center gap-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                    >
                      <AlertCircle className="w-3 h-3" />
                      <span>No Questions</span>
                    </Badge>
                  ) : (
                    <Badge className="font-bold text-xs flex items-center gap-1.5 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Active</span>
                    </Badge>
                  )
                ) : (
                  <Badge className="font-bold text-xs flex items-center gap-1.5 bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    <span>Inactive</span>
                  </Badge>
                )
              )}
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 flex items-center space-x-2">
              <span className="font-bold text-slate-800 dark:text-slate-200">{quiz?.title}</span>
              <span>•</span>
              <span className="font-mono">{quiz?.durationMinutes || 30} mins</span>
              <span>•</span>
              <span className="font-semibold text-emerald-500">{quiz?.accessType || 'FREE'}</span>
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Button
              type="button"
              variant="gold"
              className="font-bold text-xs shadow-md shadow-cyan-500/20 flex items-center space-x-1.5 cursor-pointer px-4 py-2.5"
              onClick={handleOpenCreateModal}
            >
              <Plus className="w-4 h-4" />
              <span>Add Question</span>
            </Button>
          </div>
        </div>

        {/* Search & Info Bar */}
        <Card className="p-4 glass-card">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
              <Input
                placeholder="Search question text..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex items-center space-x-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span className="bg-slate-100 dark:bg-[#091124] border border-slate-200 dark:border-[#1e2e56] px-3 py-1.5 rounded-xl font-mono">
                Showing {filteredQuestions.length} of {questions.length} Questions
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Top-Right Floating Toast Notifications */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col space-y-2.5 pointer-events-none max-w-sm sm:max-w-md w-full px-4 sm:px-0">
        {successMsg && (
          <div className="pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-950/95 dark:bg-[#080e1e]/95 border border-emerald-500/40 text-emerald-400 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span className="text-xs font-extrabold leading-relaxed text-slate-100">{successMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMsg('')}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800 shrink-0 cursor-pointer"
              title="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {pageError && (
          <div className="pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-950/95 dark:bg-[#080e1e]/95 border border-rose-500/40 text-rose-400 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
              <span className="text-xs font-extrabold leading-relaxed text-slate-100">{pageError}</span>
            </div>
            <button
              type="button"
              onClick={() => setPageError('')}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800 shrink-0 cursor-pointer"
              title="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Active Drag Status Banner */}
      {activeQuestionId !== null && activeQuestionIndex >= 0 && (
        <div className="shrink-0 mb-1 p-3 rounded-2xl bg-cyan-500/10 border-2 border-dashed border-cyan-500/50 text-cyan-700 dark:text-cyan-300 text-xs font-bold flex items-center gap-2 shadow-sm">
          <GripVertical className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>
            Moving <strong>Question #{activeQuestionIndex + 1}</strong> — hover it over another question to swap places, or over a page number to jump pages.
          </span>
        </div>
      )}

      {/* Scrollable Questions Table Container */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border border-slate-200/80 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] shadow-sm p-0">
        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 relative">
          <DndContext
            sensors={dragSensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOverSort}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEndSort}
            onDragCancel={handleDragCancel}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Q.No</TableHead>
                  <TableHead className="min-w-[260px]">Question Prompt</TableHead>
                  <TableHead className="whitespace-nowrap">Options</TableHead>
                  <TableHead className="min-w-[200px]">Correct Answer</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <SortableContext items={paginatedQuestions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                <TableBody>
                  {paginatedQuestions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12">
                        <div className="flex flex-col items-center justify-center space-y-3 max-w-sm mx-auto">
                          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
                            <ListChecks className="w-6 h-6" />
                          </div>
                          <div className="space-y-1">
                            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                              {searchTerm ? 'No Matching Questions' : 'No Questions Added Yet'}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                              {searchTerm
                                ? 'No questions match your search query. Try clearing the search.'
                                : 'Click the "+ Add Question" button to create questions for this quiz.'}
                            </p>
                          </div>
                          {!searchTerm ? (
                            <Button
                              variant="gold"
                              size="sm"
                              className="text-xs font-bold shadow-md shadow-cyan-500/20 mt-2 cursor-pointer"
                              onClick={handleOpenCreateModal}
                            >
                              + Add First Question
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs font-bold mt-2 cursor-pointer"
                              onClick={() => setSearchTerm('')}
                            >
                              Clear Search
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedQuestions.map((q, idx) => {
                      const foundIndex = questions.findIndex((item) => item.id === q.id || (item.text && item.text === q.text));
                      const actualIndex = foundIndex >= 0 ? foundIndex : (currentPage - 1) * pageSize + idx;

                      return (
                        <SortableQuestionRow
                          key={q.id || `q-${actualIndex}`}
                          question={q}
                          actualIndex={actualIndex}
                          questionsLength={questions.length}
                          canReorder={canReorder}
                          onOpenMoveModal={handleOpenMoveModal}
                          onMoveUp={(i) => handleMoveQuestion(i, 'UP')}
                          onMoveDown={(i) => handleMoveQuestion(i, 'DOWN')}
                          onView={setViewIndex}
                          onEdit={handleOpenEditModal}
                          onDelete={setDeleteIndex}
                        />
                      );
                    })
                  )}
                </TableBody>
              </SortableContext>
            </Table>

            {/* Portaled straight to <body> — the table sits inside a
                backdrop-blur card, and `backdrop-filter` (like `transform`)
                creates a new containing block for `position: fixed`
                descendants, which is exactly what DragOverlay relies on to
                track the pointer. Left un-portaled, the overlay was
                positioning itself relative to that blurred card instead of
                the viewport. */}
            {typeof document !== 'undefined' &&
              createPortal(
                <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
                  {activeQuestion ? (
                    <QuestionDragPreviewCard question={activeQuestion} actualIndex={activeQuestionIndex} />
                  ) : null}
                </DragOverlay>,
                document.body,
              )}
          </DndContext>
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

      {/* Expanded Width Single Question Modal */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingIndex !== null ? `Edit Question #${editingIndex + 1}` : 'Add New Question'}
        className="max-w-3xl sm:max-w-4xl lg:max-w-5xl w-full"
      >
        <div ref={modalContainerRef} className="flex-1 min-h-0 flex flex-col space-y-4 pt-2">
          {modalError && (
            <div className="shrink-0 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-500 dark:text-rose-400 text-xs font-bold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          {hasFieldErrors && (
            <div
              role="alert"
              className="shrink-0 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-400 flex items-start space-x-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-extrabold">
                  {formErrors.summary.length === 1
                    ? 'Fix this before saving the question:'
                    : `Fix these ${formErrors.summary.length} issues before saving the question:`}
                </p>
                <ul className="list-disc pl-4 space-y-0.5 text-xs font-semibold">
                  {formErrors.summary.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div ref={modalScrollRef} className="flex-1 min-h-0 space-y-5 overflow-y-auto px-1 py-1">
            {/* Auto-expanding Question Prompt Textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Question Prompt *
              </label>
              <textarea
                placeholder="e.g. Which river is the longest in Kerala?"
                value={currentForm.text}
                aria-invalid={showFieldErrors && !!formErrors.text}
                onChange={(e) => {
                  handleUpdateFormText(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                rows={3}
                className={`w-full min-h-[90px] p-3 text-sm rounded-xl border bg-slate-50/70 dark:bg-[#091124] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 resize-none overflow-hidden transition-all font-medium leading-relaxed ${showFieldErrors && formErrors.text
                  ? 'border-rose-500 focus:ring-rose-500/50 focus:border-rose-500 bg-rose-500/5'
                  : 'border-slate-300 dark:border-[#1e2e56] focus:ring-cyan-500/50 focus:border-cyan-500'
                  }`}
              />
              {showFieldErrors && formErrors.text && (
                <p className="text-xs font-semibold text-rose-500 flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{formErrors.text}</span>
                </p>
              )}
            </div>

            {/* Answer Options List */}
            <div className="space-y-3 pt-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Answer Options (Click Letter Radio Button to Mark Correct Answer) *
                </label>
                {currentForm.options.length < 6 && (
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="text-xs font-bold text-cyan-700 dark:text-cyan-400 hover:text-cyan-300 transition-colors flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Choice ({currentForm.options.length}/6)</span>
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {currentForm.options.map((opt, optIdx) => {
                  const letter = optionLetter(optIdx);
                  const isCorrect = currentForm.correctOptionId === opt.id;
                  const optionError = showFieldErrors ? formErrors.options[optIdx] : undefined;

                  return (
                    <div
                      key={opt.id || optIdx}
                      className={`space-y-2 bg-slate-100/60 dark:bg-[#0c152e]/60 p-3.5 rounded-xl border ${optionError ? 'border-rose-500/60' : 'border-slate-200 dark:border-[#1e2e56]'
                        }`}
                    >
                      <div className="flex items-start space-x-3">
                        {/* Correct Answer Radio Selector */}
                        <button
                          type="button"
                          onClick={() => handleSetCorrectOption(opt.id)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-mono font-extrabold text-xs transition-all shrink-0 cursor-pointer mt-1 ${isCorrect
                            ? 'bg-emerald-500 text-white ring-4 ring-emerald-500/20 shadow-sm'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
                            }`}
                          title={isCorrect ? 'Correct Answer' : 'Click to Mark as Correct Answer'}
                        >
                          {isCorrect ? <Check className="w-4 h-4 text-white" /> : letter}
                        </button>

                        {/* Option Text Auto-expanding Textarea */}
                        <textarea
                          rows={1}
                          placeholder={`Option ${letter} text...`}
                          value={opt.text}
                          aria-invalid={!!optionError}
                          onChange={(e) => {
                            handleUpdateOptionText(optIdx, e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = `${e.target.scrollHeight}px`;
                          }}
                          className={`flex-1 min-h-[42px] py-2 px-3 text-sm rounded-xl border bg-white dark:bg-[#091124] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 resize-none overflow-hidden transition-all font-medium ${optionError
                            ? 'border-rose-500 focus:ring-rose-500/50 focus:border-rose-500 bg-rose-500/5'
                            : 'border-slate-300 dark:border-[#1e2e56] focus:ring-cyan-500/50 focus:border-cyan-500'
                            }`}
                        />

                        {/* Delete Option */}
                        {currentForm.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteOption(optIdx)}
                            className="text-slate-400 hover:text-rose-500 transition-colors p-2 cursor-pointer rounded-lg hover:bg-rose-500/10 mt-0.5"
                            title="Remove Option"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {optionError && (
                        <p className="pl-11 text-xs font-semibold text-rose-500 flex items-center space-x-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{optionError}</span>
                        </p>
                      )}

                      {/* Per-Option Explanation Auto-expanding Textarea */}
                      <div className="pl-11 pr-7 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          <span>Explanation for Option {letter}:</span>
                          {quiz?.accessType === 'PAID' && (
                            <span className="text-[10px] font-extrabold text-cyan-400 uppercase tracking-wider">
                              ★ Included in Premium Solution PDF
                            </span>
                          )}
                        </div>
                        <textarea
                          rows={1}
                          placeholder={`Explanation for Option ${letter} (Why it is correct/incorrect)...`}
                          value={opt.explanation || ''}
                          onChange={(e) => {
                            handleUpdateOptionExplanation(optIdx, e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = `${e.target.scrollHeight}px`;
                          }}
                          className="w-full min-h-[38px] text-xs bg-white dark:bg-[#091124] border border-slate-300 dark:border-[#1e2e56] text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500 italic placeholder:not-italic resize-none overflow-hidden transition-all"
                        />
                      </div>
                    </div>
                  );
                })}

                {showFieldErrors && formErrors.correctOption && (
                  <p className="text-xs font-semibold text-rose-500 flex items-center space-x-1 pt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{formErrors.correctOption}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Overall Answer Key Explanation Auto-expanding Textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Answer Key Explanation (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Provide rationale displayed to students during review..."
                value={currentForm.explanation || ''}
                onChange={(e) => {
                  handleUpdateFormExplanation(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                className="w-full min-h-[64px] p-3 text-xs bg-white dark:bg-[#091124] border border-slate-300 dark:border-[#1e2e56] text-slate-800 dark:text-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500 italic placeholder:not-italic resize-none overflow-hidden transition-all"
              />
            </div>
          </div>

          <div className="shrink-0 flex gap-3 pt-3 border-t border-slate-200 dark:border-[#1e2e56]">
            <Button
              type="button"
              variant="outline"
              className="w-1/3 font-semibold cursor-pointer"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="gold"
              className="w-2/3 font-bold shadow-md shadow-cyan-500/20 flex items-center justify-center space-x-2 cursor-pointer"
              disabled={saving}
              onClick={handleSaveQuestionModal}
            >
              <span>{saving ? 'Saving Question...' : editingIndex !== null ? 'Save Question Changes' : 'Add Question'}</span>
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Read-only View Question Modal */}
      <Dialog
        isOpen={viewIndex !== null}
        onClose={() => setViewIndex(null)}
        title={viewIndex !== null ? `Question #${viewIndex + 1}` : undefined}
        className="max-w-2xl w-full"
      >
        {viewIndex !== null &&
          questions[viewIndex] &&
          (() => {
            const q = questions[viewIndex];
            const correctOptIndex = q.options.findIndex((o) => o.id === q.correctOptionId);

            return (
              <div className="flex-1 min-h-0 flex flex-col space-y-5">
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="gold" className="font-bold text-xs flex items-center gap-1">
                    <Award className="w-3 h-3" />
                    <span>
                      {q.marks || 1} Mark{(q.marks || 1) === 1 ? '' : 's'}
                    </span>
                  </Badge>
                  <Badge variant="outline" className="font-bold text-xs">
                    {q.options.length} Choices
                  </Badge>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto space-y-5 px-1 py-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Question
                    </label>
                    <p className="text-base font-bold text-slate-900 dark:text-white leading-relaxed whitespace-pre-wrap">
                      {q.text}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Answer Options
                    </label>
                    {q.options.map((opt, optIdx) => {
                      const letter = optionLetter(optIdx);
                      const isCorrect = optIdx === correctOptIndex;
                      return (
                        <div
                          key={opt.id || optIdx}
                          className={`p-3.5 rounded-xl border space-y-1.5 ${isCorrect
                            ? 'border-emerald-500/50 bg-emerald-500/10'
                            : 'border-slate-200 dark:border-[#1e2e56] bg-slate-100/60 dark:bg-[#0c152e]/60'
                            }`}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={`w-7 h-7 rounded-full flex items-center justify-center font-mono font-extrabold text-xs shrink-0 ${isCorrect
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}
                            >
                              {isCorrect ? <Check className="w-4 h-4" /> : letter}
                            </span>
                            <span className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed pt-0.5 flex-1">
                              {opt.text}
                            </span>
                            {isCorrect && (
                              <Badge variant="success" className="shrink-0 text-[10px] font-bold">
                                Correct
                              </Badge>
                            )}
                          </div>
                          {opt.explanation && (
                            <p className="pl-10 text-xs text-slate-500 dark:text-slate-400 italic leading-relaxed">
                              {opt.explanation}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Answer Key Explanation
                      </label>
                      <p className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed bg-slate-100/60 dark:bg-[#0c152e]/60 border border-slate-200 dark:border-[#1e2e56] rounded-xl p-3">
                        {q.explanation}
                      </p>
                    </div>
                  )}
                </div>

                <div className="shrink-0 flex gap-3 pt-3 border-t border-slate-200 dark:border-[#1e2e56]">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-1/2 font-semibold cursor-pointer"
                    onClick={() => setViewIndex(null)}
                  >
                    Close
                  </Button>
                  <Button
                    type="button"
                    variant="gold"
                    className="w-1/2 font-bold flex items-center justify-center space-x-2 cursor-pointer"
                    onClick={() => {
                      const idx = viewIndex;
                      setViewIndex(null);
                      if (idx !== null) handleOpenEditModal(idx);
                    }}
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Edit Question</span>
                  </Button>
                </div>
              </div>
            );
          })()}
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteIndex !== null}
        title="Delete Question"
        description={
          deleteIndex !== null
            ? `Are you sure you want to delete Question #${deleteIndex + 1}? This action cannot be undone.`
            : undefined
        }
        confirmLabel="Delete Question"
        variant="danger"
        onConfirm={handleDeleteQuestionConfirm}
        onCancel={() => setDeleteIndex(null)}
      />

      {/* Custom Move to Position Dialog */}
      <Dialog
        isOpen={moveTargetQuestionIndex !== null}
        onClose={() => setMoveTargetQuestionIndex(null)}
        title={
          moveTargetQuestionIndex !== null
            ? `Move Question #${moveTargetQuestionIndex + 1} to Custom Position`
            : undefined
        }
        className="max-w-md w-full"
      >
        {moveTargetQuestionIndex !== null && (
          <div className="space-y-4 pt-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Currently at position <strong className="text-slate-900 dark:text-white font-mono">#{moveTargetQuestionIndex + 1}</strong> of <strong className="text-slate-900 dark:text-white font-mono">{questions.length}</strong>. Enter the target position to instantly move this question across pages.
            </p>

            <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-[#0c152e]/70 border border-slate-200 dark:border-[#1e2e56] text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-2">
              "{questions[moveTargetQuestionIndex]?.text}"
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Target Position Number (1 to {questions.length})
              </label>
              <Input
                type="number"
                min={1}
                max={questions.length}
                value={targetPositionInput}
                onChange={(e) => setTargetPositionInput(e.target.value)}
                placeholder={`1 - ${questions.length}`}
                autoFocus
              />
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <button
                type="button"
                onClick={() => handleConfirmMoveToPosition(1)}
                className="flex-1 py-1.5 text-xs font-extrabold rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 cursor-pointer transition-colors"
              >
                Top (#1)
              </button>
              <button
                type="button"
                onClick={() => handleConfirmMoveToPosition(questions.length)}
                className="flex-1 py-1.5 text-xs font-extrabold rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 cursor-pointer transition-colors"
              >
                End (#{questions.length})
              </button>
            </div>

            <div className="flex gap-3 pt-3 border-t border-slate-200 dark:border-[#1e2e56]">
              <Button
                type="button"
                variant="outline"
                className="w-1/3 font-semibold cursor-pointer"
                onClick={() => setMoveTargetQuestionIndex(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="gold"
                className="w-2/3 font-bold shadow-md shadow-cyan-500/20 cursor-pointer"
                onClick={() => handleConfirmMoveToPosition()}
              >
                Move Question
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
