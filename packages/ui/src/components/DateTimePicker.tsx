'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../utils';

export interface DateTimePickerProps {
  label?: string;
  value: string; // ISO string, or '' when unset
  onChange: (isoString: string) => void;
  required?: boolean;
  minDate?: Date;
  placeholder?: string;
  helperText?: string;
  error?: string;
  className?: string;
}

const PANEL_MARGIN = 8;
// The panel's height is effectively constant (a 6-row calendar + time
// columns) regardless of month, so positioning estimates it up front rather
// than measuring-then-correcting via a second effect pass.
const ESTIMATED_PANEL_HEIGHT = 340;
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function startOfDay(d: Date) {
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

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  label,
  value,
  onChange,
  required,
  minDate,
  placeholder = 'Select date & time…',
  helperText,
  error,
  className,
}) => {
  const parsed = value ? new Date(value) : null;
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(parsed || new Date());
  const [position, setPosition] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 280 });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hourColRef = useRef<HTMLDivElement>(null);
  const minuteColRef = useRef<HTMLDivElement>(null);

  const selectedHour24 = parsed ? parsed.getHours() : null;
  const selectedHour12 = selectedHour24 === null ? null : selectedHour24 % 12 === 0 ? 12 : selectedHour24 % 12;
  const selectedMinute = parsed ? parsed.getMinutes() : null;
  const selectedAmPm = selectedHour24 === null ? null : selectedHour24 >= 12 ? 'PM' : 'AM';

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.max(rect.width, 300);
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
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    hourColRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'center' });
    minuteColRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'center' });
  }, [isOpen]);

  const commit = (next: Date) => {
    onChange(next.toISOString());
  };

  const handleOpen = () => {
    setViewDate(parsed || new Date());
    setIsOpen(true);
  };

  const handleSelectDay = (day: Date) => {
    const base = parsed ? new Date(parsed) : new Date();
    base.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    if (!parsed) {
      // Default to the next upcoming half-hour when no time has been chosen yet.
      base.setHours(new Date().getHours(), 0, 0, 0);
    }
    commit(base);
  };

  const handleSelectHour = (hour12: number) => {
    const base = parsed ? new Date(parsed) : new Date(viewDate);
    const isPM = selectedAmPm === 'PM';
    base.setHours((hour12 % 12) + (isPM ? 12 : 0), base.getMinutes(), 0, 0);
    commit(base);
  };

  const handleSelectMinute = (minute: number) => {
    const base = parsed ? new Date(parsed) : new Date(viewDate);
    base.setMinutes(minute, 0, 0);
    commit(base);
  };

  const handleSelectAmPm = (ampm: 'AM' | 'PM') => {
    const base = parsed ? new Date(parsed) : new Date(viewDate);
    const current12 = base.getHours() % 12 === 0 ? 12 : base.getHours() % 12;
    base.setHours((current12 % 12) + (ampm === 'PM' ? 12 : 0), base.getMinutes(), 0, 0);
    commit(base);
  };

  const displayValue = parsed
    ? parsed.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const cells = buildMonthGrid(viewDate);
  const today = startOfDay(new Date());
  const minDay = minDate ? startOfDay(minDate) : null;

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
          'flex h-11 w-full items-center justify-between rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/60 px-3.5 py-2 text-sm text-left transition-all duration-200 shadow-inner cursor-pointer',
          'focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/60',
          isOpen && 'ring-2 ring-cyan-500/40 border-cyan-500/60',
          error && 'border-rose-500 focus:ring-rose-500',
        )}
      >
        <span className={displayValue ? 'text-slate-900 dark:text-slate-100 font-medium' : 'text-slate-400 dark:text-slate-500'}>
          {displayValue || placeholder}
        </span>
        <Calendar className="w-4 h-4 text-amber-500 shrink-0 ml-2" />
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
              maxHeight: `calc(100vh - ${PANEL_MARGIN * 2}px)`,
            }}
            className="z-[999] flex overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-in fade-in slide-in-from-top-2"
          >
            {/* Calendar */}
            <div className="p-3 border-r border-slate-200/80 dark:border-slate-800/80 min-w-[240px]">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
                </span>
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-500 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-500 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-0.5 mb-1">
                {WEEKDAYS.map((w, i) => (
                  <div key={`${w}-${i}`} className="text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 py-1">
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((day, i) => {
                  if (!day) return <div key={i} />;
                  const isSelected = parsed && startOfDay(day).getTime() === startOfDay(parsed).getTime();
                  const isToday = startOfDay(day).getTime() === today.getTime();
                  const isDisabled = minDay ? startOfDay(day).getTime() < minDay.getTime() : false;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleSelectDay(day)}
                      className={cn(
                        'w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer',
                        isSelected
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                          : isToday
                            ? 'border border-amber-500/50 text-amber-600 dark:text-amber-400'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400',
                        isDisabled && 'opacity-30 cursor-not-allowed hover:bg-transparent hover:text-slate-700 dark:hover:text-slate-300',
                      )}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-2 px-1 pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => onChange('')}
                  className="text-[11px] font-bold text-slate-500 hover:text-rose-500 transition-colors cursor-pointer"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setViewDate(now);
                    handleSelectDay(now);
                  }}
                  className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors cursor-pointer"
                >
                  Today
                </button>
              </div>
            </div>

            {/* Time columns */}
            <div className="flex divide-x divide-slate-200/80 dark:divide-slate-800/80 w-[132px]">
              <div ref={hourColRef} className="flex-1 overflow-y-auto max-h-[280px] py-1 scrollbar-none">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                  <button
                    key={h}
                    type="button"
                    data-active={selectedHour12 === h}
                    onClick={() => handleSelectHour(h)}
                    className={cn(
                      'w-full text-center text-xs font-mono font-bold py-1.5 transition-colors cursor-pointer',
                      selectedHour12 === h
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400',
                    )}
                  >
                    {h.toString().padStart(2, '0')}
                  </button>
                ))}
              </div>
              <div ref={minuteColRef} className="flex-1 overflow-y-auto max-h-[280px] py-1 scrollbar-none">
                {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                  <button
                    key={m}
                    type="button"
                    data-active={selectedMinute === m}
                    onClick={() => handleSelectMinute(m)}
                    className={cn(
                      'w-full text-center text-xs font-mono font-bold py-1.5 transition-colors cursor-pointer',
                      selectedMinute === m
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400',
                    )}
                  >
                    {m.toString().padStart(2, '0')}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto max-h-[280px] py-1 scrollbar-none">
                {(['AM', 'PM'] as const).map((ap) => (
                  <button
                    key={ap}
                    type="button"
                    onClick={() => handleSelectAmPm(ap)}
                    className={cn(
                      'w-full text-center text-xs font-mono font-bold py-1.5 transition-colors cursor-pointer',
                      selectedAmPm === ap
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400',
                    )}
                  >
                    {ap}
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
