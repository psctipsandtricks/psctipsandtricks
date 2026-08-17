'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../utils';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface DatePickerProps {
  label?: string;
  value: string; // YYYY-MM-DD format or empty
  onChange: (dateString: string) => void;
  required?: boolean;
  minDate?: string; // YYYY-MM-DD
  placeholder?: string;
  helperText?: string;
  error?: string;
  className?: string;
}

const PANEL_MARGIN = 8;
const ESTIMATED_PANEL_HEIGHT = 310;
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parseDateStr(str?: string): Date | null {
  if (!str) return null;
  const parts = str.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

function buildMonthGrid(viewDate: Date): (Date | null)[] {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = firstDay.getDay();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  label,
  value,
  onChange,
  required,
  minDate,
  placeholder = 'Select date…',
  helperText,
  error,
  className,
}) => {
  const parsedValue = parseDateStr(value);
  const minDateParsed = parseDateStr(minDate);

  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(parsedValue || new Date());
  const [position, setPosition] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const computePosition = useCallback(() => {
    if (!triggerRef.current) return null;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.max(rect.width, 270);
    const left = Math.max(PANEL_MARGIN, Math.min(rect.left, window.innerWidth - width - PANEL_MARGIN));

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const top =
      spaceBelow < ESTIMATED_PANEL_HEIGHT + PANEL_MARGIN && spaceAbove > spaceBelow
        ? Math.max(PANEL_MARGIN, rect.top - ESTIMATED_PANEL_HEIGHT - PANEL_MARGIN)
        : rect.bottom + PANEL_MARGIN;

    return { top, left, width };
  }, []);

  const handleOpen = () => {
    const pos = computePosition();
    if (pos) setPosition(pos);
    setViewDate(parsedValue || new Date());
    setIsOpen(true);
  };

  useIsomorphicLayoutEffect(() => {
    if (isOpen) {
      const pos = computePosition();
      if (pos) setPosition(pos);
    }
  }, [isOpen, computePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleUpdate = () => {
      const pos = computePosition();
      if (pos) setPosition(pos);
    };

    const handleOutside = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, computePosition]);

  const handleSelectDay = (day: Date) => {
    onChange(formatDateStr(day));
    setIsOpen(false);
  };

  const displayValue = parsedValue
    ? parsedValue.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  const cells = buildMonthGrid(viewDate);
  const today = startOfDay(new Date());
  const minDay = minDateParsed ? startOfDay(minDateParsed) : null;

  return (
    <div className={cn('w-full space-y-1.5', className)}>
      {label && (
        <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className={cn(
          'flex h-11 w-full items-center justify-between rounded-xl border border-slate-300 dark:border-[#1e2e56] bg-white dark:bg-[#091124] px-3.5 py-2 text-sm text-left transition-all duration-200 shadow-2xs cursor-pointer',
          'focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/60 hover:border-slate-400 dark:hover:border-[#2a3e70]',
          isOpen && 'ring-2 ring-cyan-500/40 border-cyan-500/60',
          error && 'border-rose-500 focus:ring-rose-500',
        )}
      >
        <span className={displayValue ? 'text-slate-900 dark:text-slate-100 font-semibold' : 'text-slate-400 dark:text-slate-500'}>
          {displayValue || placeholder}
        </span>
        <Calendar className="w-4 h-4 text-cyan-500 shrink-0 ml-2 pointer-events-none" />
      </button>

      {error ? (
        <p className="text-xs text-rose-500 font-medium">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
      ) : null}

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              width: position.width,
            }}
            className="z-[9999] p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-in fade-in slide-in-from-top-2"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
              </span>
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-cyan-500/10 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-cyan-500/10 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Weekdays */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map((w, i) => (
                <div key={`${w}-${i}`} className="text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 py-1">
                  {w}
                </div>
              ))}
            </div>

            {/* Month Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (!day) return <div key={`blank-${i}`} />;
                const isSelected = parsedValue && startOfDay(day).getTime() === startOfDay(parsedValue).getTime();
                const isToday = startOfDay(day).getTime() === today.getTime();
                const isDisabled = minDay ? startOfDay(day).getTime() < minDay.getTime() : false;

                return (
                  <button
                    key={`day-${i}`}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleSelectDay(day)}
                    className={cn(
                      'w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all cursor-pointer',
                      isSelected
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold shadow-md'
                        : isToday
                          ? 'border border-cyan-500/60 text-cyan-600 dark:text-cyan-400 font-bold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-600 dark:hover:text-cyan-400',
                      isDisabled && 'opacity-25 cursor-not-allowed hover:bg-transparent hover:text-slate-700 dark:hover:text-slate-300',
                    )}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-between mt-3 px-1 pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                className="text-xs font-bold text-slate-500 hover:text-rose-500 transition-colors cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={minDay ? today.getTime() < minDay.getTime() : false}
                onClick={() => {
                  const now = new Date();
                  setViewDate(now);
                  handleSelectDay(now);
                }}
                className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Today
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
