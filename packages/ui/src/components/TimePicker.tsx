'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Clock } from 'lucide-react';
import { cn } from '../utils';

export interface TimePickerProps {
  label?: string;
  value: string; // HH:mm format (24-hour) or empty
  onChange: (timeString: string) => void;
  required?: boolean;
  placeholder?: string;
  helperText?: string;
  error?: string;
  className?: string;
}

const PANEL_MARGIN = 8;
const ESTIMATED_PANEL_HEIGHT = 260;

function parseTimeStr(timeStr?: string): { hour12: number; minute: number; ampm: 'AM' | 'PM' } | null {
  if (!timeStr) return null;
  const parts = timeStr.split(':').map(Number);
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
  const hour24 = parts[0];
  const minute = parts[1];
  const ampm: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, minute, ampm };
}

function formatTime24(hour12: number, minute: number, ampm: 'AM' | 'PM'): string {
  let h24 = hour12 % 12;
  if (ampm === 'PM') h24 += 12;
  const hStr = String(h24).padStart(2, '0');
  const mStr = String(minute).padStart(2, '0');
  return `${hStr}:${mStr}`;
}

function formatDisplayTime(parsed: { hour12: number; minute: number; ampm: 'AM' | 'PM' } | null): string {
  if (!parsed) return '';
  const hStr = String(parsed.hour12).padStart(2, '0');
  const mStr = String(parsed.minute).padStart(2, '0');
  return `${hStr}:${mStr} ${parsed.ampm}`;
}

export const TimePicker: React.FC<TimePickerProps> = ({
  label,
  value,
  onChange,
  required,
  placeholder = 'Select time…',
  helperText,
  error,
  className,
}) => {
  const parsed = parseTimeStr(value);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 220 });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hourColRef = useRef<HTMLDivElement>(null);
  const minuteColRef = useRef<HTMLDivElement>(null);

  const selectedHour12 = parsed ? parsed.hour12 : 12;
  const selectedMinute = parsed ? parsed.minute : 0;
  const selectedAmPm: 'AM' | 'PM' = parsed ? parsed.ampm : 'AM';

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.max(rect.width, 220);
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

  const handleSelectHour = (h12: number) => {
    onChange(formatTime24(h12, selectedMinute, selectedAmPm));
  };

  const handleSelectMinute = (m: number) => {
    onChange(formatTime24(selectedHour12, m, selectedAmPm));
  };

  const handleSelectAmPm = (ampm: 'AM' | 'PM') => {
    onChange(formatTime24(selectedHour12, selectedMinute, ampm));
  };

  const handleOpen = () => {
    setIsOpen(true);
  };

  const displayVal = formatDisplayTime(parsed);

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
        <span className={displayVal ? 'text-slate-900 dark:text-slate-100 font-semibold font-mono' : 'text-slate-400 dark:text-slate-500'}>
          {displayVal || placeholder}
        </span>
        <Clock className="w-4 h-4 text-cyan-500 shrink-0 ml-2 pointer-events-none" />
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
            {/* Columns Container */}
            <div className="flex divide-x divide-slate-200/80 dark:divide-slate-800/80 max-h-[200px]">
              {/* Hour Column */}
              <div ref={hourColRef} className="flex-1 overflow-y-auto max-h-[190px] py-1 scrollbar-none space-y-0.5">
                <div className="text-[10px] uppercase font-mono font-bold text-center text-slate-400 pb-1">Hour</div>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                  <button
                    key={`h-${h}`}
                    type="button"
                    data-active={selectedHour12 === h}
                    onClick={() => handleSelectHour(h)}
                    className={cn(
                      'w-full text-center text-xs font-mono font-bold py-1.5 rounded-lg transition-colors cursor-pointer',
                      selectedHour12 === h
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-xs'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-600 dark:hover:text-cyan-400',
                    )}
                  >
                    {h.toString().padStart(2, '0')}
                  </button>
                ))}
              </div>

              {/* Minute Column */}
              <div ref={minuteColRef} className="flex-1 overflow-y-auto max-h-[190px] py-1 scrollbar-none space-y-0.5 px-1">
                <div className="text-[10px] uppercase font-mono font-bold text-center text-slate-400 pb-1">Min</div>
                {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                  <button
                    key={`m-${m}`}
                    type="button"
                    data-active={selectedMinute === m}
                    onClick={() => handleSelectMinute(m)}
                    className={cn(
                      'w-full text-center text-xs font-mono font-bold py-1.5 rounded-lg transition-colors cursor-pointer',
                      selectedMinute === m
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-xs'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-600 dark:hover:text-cyan-400',
                    )}
                  >
                    {m.toString().padStart(2, '0')}
                  </button>
                ))}
              </div>

              {/* AM / PM Column */}
              <div className="flex-1 overflow-y-auto max-h-[190px] py-1 scrollbar-none space-y-0.5 px-1">
                <div className="text-[10px] uppercase font-mono font-bold text-center text-slate-400 pb-1">Period</div>
                {(['AM', 'PM'] as const).map((ap) => (
                  <button
                    key={`ampm-${ap}`}
                    type="button"
                    onClick={() => handleSelectAmPm(ap)}
                    className={cn(
                      'w-full text-center text-xs font-mono font-bold py-2 rounded-lg transition-colors cursor-pointer mb-1',
                      selectedAmPm === ap
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-xs'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-600 dark:hover:text-cyan-400',
                    )}
                  >
                    {ap}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
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
                onClick={() => {
                  const now = new Date();
                  const h24 = now.getHours();
                  const m = now.getMinutes();
                  const ampm: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
                  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
                  onChange(formatTime24(h12, m, ampm));
                  setIsOpen(false);
                }}
                className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors cursor-pointer"
              >
                Now
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export function combineDateAndTime(dateStr?: string, timeStr?: string): string {
  if (!dateStr) return '';
  const time = timeStr || '00:00';
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const d = new Date(year, month - 1, day, hours || 0, minutes || 0, 0, 0);
  return d.toISOString();
}

export function splitIsoToDateAndTime(isoStr?: string): { date: string; time: string } {
  if (!isoStr) return { date: '', time: '' };
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return { date: '', time: '' };
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return {
      date: `${year}-${month}-${day}`,
      time: `${hours}:${minutes}`,
    };
  } catch {
    return { date: '', time: '' };
  }
}
