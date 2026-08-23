'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { cn } from '../utils';

/**
 * Does a file satisfy one token of an `accept` attribute?
 *
 * Browsers enforce `accept` on the file picker but *not* on drops, so every
 * drop target has to re-check it by hand or a drag-and-drop upload would
 * quietly accept files the click-to-browse path rejects.
 */
function matchesAcceptToken(file: File, token: string): boolean {
  const rule = token.trim().toLowerCase();
  if (!rule) return true;

  const type = (file.type || '').toLowerCase();
  const name = file.name.toLowerCase();

  // ".pdf" — extension rule
  if (rule.startsWith('.')) return name.endsWith(rule);
  // "image/*" — wildcard subtype
  if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
  // "application/pdf" — exact MIME
  return type === rule;
}

/**
 * Some browsers report an empty or generic `file.type` for drops out of
 * archives, network shares, or certain OS file managers. When the MIME check
 * is inconclusive we fall back to the extension rules alone rather than
 * rejecting a file the user plainly meant to attach.
 */
export function fileMatchesAccept(file: File, accept?: string): boolean {
  if (!accept || !accept.trim()) return true;
  const tokens = accept.split(',').map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) return true;
  if (tokens.some((token) => matchesAcceptToken(file, token))) return true;

  const hasUsableType = Boolean(file.type) && file.type !== 'application/octet-stream';
  if (hasUsableType) return false;
  return tokens.filter((t) => t.startsWith('.')).some((token) => matchesAcceptToken(file, token));
}

export interface UseFileDropOptions {
  /** Called with the files the user supplied, already filtered by `accept`. */
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  /** Called when a drop contained files but every one failed the `accept` check. */
  onReject?: (files: File[]) => void;
}

export interface FileDropState {
  /** True while an acceptable drag is hovering this target. */
  isDragActive: boolean;
  /** Spread onto the element that should accept drops. */
  dropProps: {
    onDragEnter: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
}

/**
 * Drag-and-drop file handling for a target whose markup we don't own — an
 * avatar button, a chat composer, a preview tile. `FileDropZone` below wraps
 * this for the common "dashed box you can also click" case.
 */
export function useFileDrop({
  onFiles,
  accept,
  multiple = false,
  disabled = false,
  onReject,
}: UseFileDropOptions): FileDropState {
  const [isDragActive, setIsDragActive] = useState(false);
  // dragenter/dragleave fire for every descendant the pointer crosses, so a
  // boolean flickers off as soon as the cursor moves over a child. Counting
  // enters against leaves keeps the highlight steady across the whole subtree.
  const dragDepth = useRef(0);

  const reset = useCallback(() => {
    dragDepth.current = 0;
    setIsDragActive(false);
  }, []);

  const onDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      // Text selections and dragged links also fire drag events; only react
      // when the payload actually carries files.
      if (!Array.from(e.dataTransfer?.types || []).includes('Files')) return;
      e.preventDefault();
      e.stopPropagation();
      dragDepth.current += 1;
      setIsDragActive(true);
    },
    [disabled],
  );

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      if (!Array.from(e.dataTransfer?.types || []).includes('Files')) return;
      // Without preventDefault on *every* dragover the drop never fires.
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      if (!isDragActive) setIsDragActive(true);
    },
    [disabled, isDragActive],
  );

  const onDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setIsDragActive(false);
    },
    [disabled],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      reset();

      const dropped = Array.from(e.dataTransfer?.files || []);
      if (dropped.length === 0) return;

      const accepted = dropped.filter((file) => fileMatchesAccept(file, accept));
      if (accepted.length === 0) {
        onReject?.(dropped);
        return;
      }
      onFiles(multiple ? accepted : accepted.slice(0, 1));
    },
    [disabled, reset, accept, multiple, onFiles, onReject],
  );

  return { isDragActive, dropProps: { onDragEnter, onDragOver, onDragLeave, onDrop } };
}

export interface FileDropZoneProps extends UseFileDropOptions {
  /** Rendered inside the zone. A function receives the live drag state. */
  children: React.ReactNode | ((state: { isDragActive: boolean }) => React.ReactNode);
  className?: string;
  /** Extra classes applied only while a drag hovers. Defaults to a cyan ring. */
  activeClassName?: string;
  title?: string;
  'aria-label'?: string;
}

/** The highlight every drop target in the app shares, so a drag reads the same everywhere. */
const DEFAULT_ACTIVE_CLASS =
  'border-cyan-500 ring-2 ring-cyan-500/30 bg-cyan-500/10 dark:bg-cyan-500/10';

/**
 * A click-or-drop file target.
 *
 * Renders as a `<label>` wrapping a visually hidden input, so clicking still
 * opens the picker through the browser's native label association — no ref, no
 * synthetic click. Dropped files run through the same `onFiles` callback the
 * picker uses, which is what keeps the two paths from drifting apart.
 */
export const FileDropZone: React.FC<FileDropZoneProps> = ({
  onFiles,
  accept,
  multiple = false,
  disabled = false,
  onReject,
  children,
  className,
  activeClassName,
  title,
  'aria-label': ariaLabel,
}) => {
  const { isDragActive, dropProps } = useFileDrop({ onFiles, accept, multiple, disabled, onReject });

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const picked = Array.from(e.target.files || []);
      // Clear the input so re-picking the same file still fires a change event.
      e.target.value = '';
      if (picked.length === 0) return;
      onFiles(multiple ? picked : picked.slice(0, 1));
    },
    [onFiles, multiple],
  );

  const content = useMemo(
    () => (typeof children === 'function' ? children({ isDragActive }) : children),
    [children, isDragActive],
  );

  return (
    <label
      {...dropProps}
      title={title}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      data-drag-active={isDragActive || undefined}
      className={cn(
        className,
        disabled && 'opacity-60 pointer-events-none',
        isDragActive && (activeClassName ?? DEFAULT_ACTIVE_CLASS),
      )}
    >
      {content}
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={handleChange}
        className="hidden"
      />
    </label>
  );
};
