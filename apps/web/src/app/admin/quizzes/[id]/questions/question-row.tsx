'use client';

import React from 'react';
import { useSortable, defaultAnimateLayoutChanges, type AnimateLayoutChanges } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge, Button, TableCell, TableRow } from '@psc/ui';
import { ArrowDown, ArrowUp, ArrowUpDown, Edit3, Eye, GripVertical, Trash2 } from 'lucide-react';
import { type QuizQuestion } from './question-validation';

// dnd-kit only animates a row's position change automatically when it moves
// as a side effect of an active drag elsewhere in the list. The Up/Down
// buttons and "Move to Position" dialog reorder the array directly with no
// drag involved, so without this override they'd just snap — this makes
// every reorder, however it's triggered, slide smoothly into place.
const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  args.wasDragging ? defaultAnimateLayoutChanges(args) : args.index !== args.newIndex;

interface SortableQuestionRowProps {
  question: QuizQuestion;
  actualIndex: number;
  questionsLength: number;
  canReorder: boolean;
  onOpenMoveModal: (actualIndex: number) => void;
  onMoveUp: (actualIndex: number) => void;
  onMoveDown: (actualIndex: number) => void;
  onView: (actualIndex: number) => void;
  onEdit: (actualIndex: number) => void;
  onDelete: (actualIndex: number) => void;
}

/** A single Q&A table row that can be picked up and dragged to reorder. */
export const SortableQuestionRow: React.FC<SortableQuestionRowProps> = ({
  question: q,
  actualIndex,
  questionsLength,
  canReorder,
  onOpenMoveModal,
  onMoveUp,
  onMoveDown,
  onView,
  onEdit,
  onDelete,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: q.id,
    disabled: !canReorder,
    animateLayoutChanges,
  });

  const correctOptIndex = q.options.findIndex((o) => o.id === q.correctOptionId);
  const correctOpt = q.options[correctOptIndex];
  const correctLetter = correctOptIndex >= 0 ? String.fromCharCode(65 + correctOptIndex) : 'A';

  // Stop interactive controls from ever being read as the start of a drag —
  // only the row's inert surface (and the grip handle) hands off to dnd-kit.
  // The row's drag listeners activate on mousedown/touchstart (the sensors
  // configured on the page), so both must be intercepted here.
  const stopDragActivationProps = {
    onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
    onTouchStart: (e: React.TouchEvent) => e.stopPropagation(),
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
        zIndex: isDragging ? 10 : undefined,
      }}
      {...(canReorder ? attributes : {})}
      {...(canReorder ? listeners : {})}
      className={
        isDragging
          ? 'opacity-30 bg-cyan-500/5 border-2 border-dashed border-cyan-500/40 select-none'
          : canReorder
          ? 'touch-none'
          : undefined
      }
    >
      <TableCell className="font-mono font-bold text-xs text-cyan-600 dark:text-cyan-400 whitespace-nowrap py-4">
        <div className="flex items-center gap-1.5">
          <span
            title={canReorder ? 'Drag to reorder' : 'Clear search to reorder'}
            className={
              canReorder
                ? 'text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 cursor-grab active:cursor-grabbing touch-none'
                : 'text-slate-200 dark:text-slate-700 cursor-not-allowed'
            }
          >
            <GripVertical className="w-3.5 h-3.5" />
          </span>
          <button
            type="button"
            {...stopDragActivationProps}
            onClick={() => onOpenMoveModal(actualIndex)}
            className="hover:underline hover:text-cyan-400 font-mono font-extrabold text-xs cursor-pointer flex items-center space-x-1"
            title="Click to move question to custom position"
          >
            <span>Q{actualIndex + 1}</span>
          </button>
        </div>
      </TableCell>

      <TableCell className="max-w-[320px] lg:max-w-[480px] py-4">
        <div className="relative group/qtext">
          <span className="block truncate font-bold text-slate-900 dark:text-white text-sm">{q.text}</span>
          {q.explanation && (
            <span className="block truncate text-xs text-slate-400 italic mt-0.5">Exp: {q.explanation}</span>
          )}
          <div className="pointer-events-none absolute left-0 bottom-full mb-1.5 hidden group-hover/qtext:block z-[90] w-max max-w-xs sm:max-w-md px-3 py-2 rounded-xl bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white text-xs font-semibold shadow-xl border border-slate-700/80 leading-snug break-words">
            {q.text}
          </div>
        </div>
      </TableCell>

      <TableCell className="whitespace-nowrap py-4">
        <Badge variant="outline" className="font-mono text-xs font-bold">
          {q.options.length} Choices
        </Badge>
      </TableCell>

      <TableCell className="max-w-[220px] py-4">
        {correctOpt ? (
          <div className="flex items-center space-x-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 rounded-xl text-xs font-bold truncate">
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-mono text-[10px] shrink-0 font-black">
              {correctLetter}
            </span>
            <span className="truncate">{correctOpt.text}</span>
          </div>
        ) : (
          <span className="text-xs text-rose-500 italic">Not set</span>
        )}
      </TableCell>

      <TableCell className="text-right whitespace-nowrap py-4" {...stopDragActivationProps}>
        <div className="flex items-center justify-end space-x-1">
          <button
            type="button"
            onClick={() => onMoveUp(actualIndex)}
            disabled={actualIndex === 0}
            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 transition-colors cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Move Question Up"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onMoveDown(actualIndex)}
            disabled={actualIndex === questionsLength - 1}
            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 transition-colors cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Move Question Down"
          >
            <ArrowDown className="w-4 h-4" />
          </button>

          <Button
            size="sm"
            variant="outline"
            className="p-2 rounded-xl border-slate-300 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all shadow-2xs ml-1 cursor-pointer"
            title="Move Question to Custom Position"
            onClick={() => onOpenMoveModal(actualIndex)}
          >
            <ArrowUpDown className="w-4 h-4" />
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="p-2 rounded-xl border-slate-300 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all shadow-2xs ml-1 cursor-pointer"
            title="View Question"
            onClick={() => onView(actualIndex)}
          >
            <Eye className="w-4 h-4" />
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="p-2 rounded-xl border-slate-300 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/10 transition-all shadow-2xs cursor-pointer"
            title="Edit Question"
            onClick={() => onEdit(actualIndex)}
          >
            <Edit3 className="w-4 h-4" />
          </Button>

          <Button
            size="sm"
            variant="danger"
            className="p-2 rounded-xl border-slate-300 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-500/50 hover:bg-rose-500/10 transition-all shadow-2xs cursor-pointer"
            title="Delete Question"
            onClick={() => onDelete(actualIndex)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

/** The floating, cursor-following clone shown while a row is lifted — a Keep-style elevated card, detached from the table's layout. */
export const QuestionDragPreviewCard: React.FC<{ question: QuizQuestion; actualIndex: number }> = ({
  question: q,
  actualIndex,
}) => {
  const correctOptIndex = q.options.findIndex((o) => o.id === q.correctOptionId);
  const correctOpt = q.options[correctOptIndex];
  const correctLetter = correctOptIndex >= 0 ? String.fromCharCode(65 + correctOptIndex) : 'A';

  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5 w-[min(92vw,640px)] rounded-2xl bg-white dark:bg-[#0c152e] border-2 border-cyan-500/60 shadow-2xl shadow-cyan-500/20 scale-[1.02] cursor-grabbing select-none"
    >
      <GripVertical className="w-4 h-4 text-cyan-400 shrink-0" />
      <span className="font-mono font-extrabold text-xs text-cyan-600 dark:text-cyan-400 shrink-0">
        Q{actualIndex + 1}
      </span>
      <span className="flex-1 min-w-0 truncate font-bold text-slate-900 dark:text-white text-sm">{q.text}</span>
      <Badge variant="outline" className="font-mono text-xs font-bold shrink-0 hidden sm:inline-flex">
        {q.options.length} Choices
      </Badge>
      {correctOpt && (
        <div className="hidden sm:flex items-center space-x-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 rounded-xl text-xs font-bold truncate shrink-0 max-w-[160px]">
          <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-mono text-[10px] shrink-0 font-black">
            {correctLetter}
          </span>
          <span className="truncate">{correctOpt.text}</span>
        </div>
      )}
    </div>
  );
};
