'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, Unlock, Lock, ChevronDown, ListChecks } from 'lucide-react';
import { Badge } from '@psc/ui';

export interface QuizPickerOption {
  id: string;
  title: string;
  accessType?: 'FREE' | 'PAID' | string;
  isPremium?: boolean;
  price?: number;
  durationMinutes?: number;
  totalQuestions?: number;
  questions?: unknown[];
}

export interface QuizPickerProps {
  quizzes: QuizPickerOption[];
  value: string;
  onChange: (id: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
}

const PANEL_MARGIN = 8;
const ESTIMATED_PANEL_HEIGHT = 340;

/** Searchable "select a quiz" field — a plain <select> becomes unusable once
 * there are hundreds of quizzes, and it can't show which ones are free vs
 * premium at a glance. */
export const QuizPicker: React.FC<QuizPickerProps> = ({ quizzes, value, onChange, onBlur, error, placeholder = 'Select a quiz…' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 280 });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selected = quizzes.find((q) => q.id === value) || null;

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = rect.width;
    const left = Math.max(PANEL_MARGIN, Math.min(rect.left, window.innerWidth - width - PANEL_MARGIN));

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const top =
      spaceBelow < ESTIMATED_PANEL_HEIGHT + PANEL_MARGIN && spaceAbove > spaceBelow
        ? Math.max(PANEL_MARGIN, rect.top - ESTIMATED_PANEL_HEIGHT - PANEL_MARGIN)
        : rect.bottom + PANEL_MARGIN;

    setPosition({ top, left, width });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    searchInputRef.current?.focus();

    const handleOutside = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        onBlur?.();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        onBlur?.();
      }
    };

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, updatePosition, onBlur]);

  const handleOpen = () => {
    setSearch('');
    setIsOpen(true);
  };

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
    onBlur?.();
  };

  const filtered = quizzes.filter((q) => q.title.toLowerCase().includes(search.trim().toLowerCase()));

  const renderAccessBadge = (q: QuizPickerOption) => {
    const isPaid = q.accessType === 'PAID' || q.isPremium || (q.price ?? 0) > 0;
    return isPaid ? (
      <Badge variant="gold" className="font-extrabold flex items-center w-fit gap-1 shrink-0 text-[10px] px-2 py-0.5">
        <Lock className="w-2.5 h-2.5" />
        <span>PAID{q.price ? ` ₹${q.price}` : ''}</span>
      </Badge>
    ) : (
      <Badge variant="success" className="font-extrabold flex items-center w-fit gap-1 shrink-0 text-[10px] px-2 py-0.5">
        <Unlock className="w-2.5 h-2.5" />
        <span>FREE</span>
      </Badge>
    );
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Quiz</label>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : handleOpen())}
        className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm text-left transition-all cursor-pointer focus:outline-none focus:ring-2 ${
          isOpen ? 'ring-2 ring-cyan-500/40 border-cyan-500/60' : 'border-slate-300 dark:border-slate-700 hover:border-cyan-500/40'
        } ${error ? 'border-rose-500 focus:ring-rose-500/50' : 'focus:ring-cyan-500/50'}`}
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0">
            <span className="truncate font-semibold text-slate-900 dark:text-slate-100">{selected.title}</span>
            {renderAccessBadge(selected)}
          </span>
        ) : (
          <span className="text-slate-400">{placeholder}</span>
        )}
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: 'fixed', top: position.top, left: position.left, width: position.width }}
            className="z-[9999] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-in fade-in slide-in-from-top-2 overflow-hidden"
          >
            <div className="p-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchInputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search quizzes by title…"
                  className="w-full pl-8 pr-2.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                />
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-1.5 py-6 text-center px-4">
                  <ListChecks className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                  <p className="text-xs text-slate-400 font-medium">No quizzes match "{search}"</p>
                </div>
              ) : (
                filtered.map((q) => {
                  const isSelected = q.id === value;
                  const questionCount = q.totalQuestions ?? q.questions?.length ?? 0;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => handleSelect(q.id)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 font-bold'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{q.title}</span>
                        <span className="block text-[11px] text-slate-400 font-mono">
                          {questionCount} Qs · {q.durationMinutes ?? 30} min
                        </span>
                      </span>
                      {renderAccessBadge(q)}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
