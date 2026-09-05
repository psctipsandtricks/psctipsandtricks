'use client';

import React from 'react';
import { useSortable, defaultAnimateLayoutChanges, type AnimateLayoutChanges } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TableRow } from '@psc/ui';

// dnd-kit only animates a row's position change automatically when it moves as
// a side effect of an active drag elsewhere in the list. The Up/Down buttons
// and "Move to Position" dialog reorder the array directly with no drag
// involved, so without this override they'd snap — this makes every reorder,
// however it's triggered, slide into place. Matches the Questions table.
const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  args.wasDragging ? defaultAnimateLayoutChanges(args) : args.index !== args.newIndex;

interface SortableTableRowProps {
  id: string;
  canReorder: boolean;
  children: React.ReactNode;
}

/**
 * A table row that can be dragged to a new position — shared by the quiz table
 * and the folder table.
 *
 * Only the row's own surface (and the grip in the first cell) starts a drag;
 * the controls inside stop the activation events themselves, so clicking Edit
 * or Delete never reads as the beginning of a drag.
 */
export const SortableTableRow: React.FC<SortableTableRowProps> = ({ id, canReorder, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !canReorder,
    animateLayoutChanges,
  });

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
          : `border-b border-slate-100 dark:border-[#1e2e56]/40 hover:bg-slate-50/60 dark:hover:bg-[#0c152e]/40 transition-colors${
              canReorder ? ' touch-none' : ''
            }`
      }
    >
      {children}
    </TableRow>
  );
};

/** Stops a control inside a draggable row from being read as a drag start. */
export const stopDragActivationProps = {
  onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
  onTouchStart: (e: React.TouchEvent) => e.stopPropagation(),
};
