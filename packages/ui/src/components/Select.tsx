'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { cn } from '../utils';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  description?: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: (SelectOption | string)[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  searchable?: boolean;
  className?: string;
  triggerClassName?: string;
  dropdownClassName?: string;
  name?: string;
  id?: string;
  onBlur?: (e: any) => void;
}

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  label,
  error,
  helperText,
  icon,
  disabled = false,
  searchable = false,
  className,
  triggerClassName,
  dropdownClassName,
  name,
  id,
  onBlur,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Normalize options to SelectOption[]
  const normalizedOptions: SelectOption[] = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt };
      }
      return opt;
    });
  }, [options]);

  const selectedOption = useMemo(() => {
    return normalizedOptions.find((opt) => String(opt.value) === String(value));
  }, [normalizedOptions, value]);

  // Filter options if searchable
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return normalizedOptions;
    const q = searchQuery.toLowerCase().trim();
    return normalizedOptions.filter((opt) => {
      const labelText = typeof opt.label === 'string' ? opt.label : String(opt.value);
      return (
        labelText.toLowerCase().includes(q) ||
        String(opt.value).toLowerCase().includes(q) ||
        (opt.description && opt.description.toLowerCase().includes(q))
      );
    });
  }, [normalizedOptions, searchQuery]);

  // Auto-enable search if more than 10 options
  const isSearchEnabled = searchable || normalizedOptions.length > 10;

  const computePosition = useCallback(() => {
    if (!triggerRef.current) return null;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownHeight = 280;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const placeAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

    return {
      top: placeAbove ? Math.max(8, rect.top - dropdownHeight - 6) : rect.bottom + 6,
      left: rect.left,
      width: rect.width,
    };
  }, []);

  const openDropdown = useCallback(() => {
    if (disabled) return;
    const pos = computePosition();
    if (pos) {
      setPosition(pos);
    }
    setIsOpen(true);
  }, [disabled, computePosition]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
    if (onBlur) onBlur({ target: { name } });
  }, [onBlur, name]);

  const toggleDropdown = useCallback(() => {
    if (disabled) return;
    if (!isOpen) {
      openDropdown();
    } else {
      closeDropdown();
    }
  }, [disabled, isOpen, openDropdown, closeDropdown]);

  // Update position synchronously right before paint when opened
  useIsomorphicLayoutEffect(() => {
    if (isOpen) {
      const pos = computePosition();
      if (pos) setPosition(pos);
    }
  }, [isOpen, computePosition]);

  // Handle click outside & scroll/resize repositioning
  useEffect(() => {
    if (!isOpen) return;

    const handleUpdate = () => {
      const pos = computePosition();
      if (pos) setPosition(pos);
    };

    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        closeDropdown();
      }
    }

    function handleKeyDownOutside(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeDropdown();
      }
    }

    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDownOutside);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDownOutside);
    };
  }, [isOpen, computePosition, closeDropdown]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen && isSearchEnabled) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen, isSearchEnabled]);

  const handleSelect = (option: SelectOption) => {
    if (option.disabled) return;
    if (onChange) {
      onChange(option.value);
    }
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      if (!isOpen) {
        e.preventDefault();
        openDropdown();
      }
    } else if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        closeDropdown();
      }
    }
  };

  return (
    <div className={cn('w-full space-y-1.5 relative', className)} ref={containerRef} id={id}>
      {label && (
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          {label}
        </label>
      )}

      {/* Hidden input for form integrations if name provided */}
      {name && <input type="hidden" name={name} value={value || ''} />}

      {/* Custom Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          'flex h-11 w-full items-center justify-between rounded-xl border border-slate-300 dark:border-[#1e2e56] bg-white/90 dark:bg-[#091124] px-3.5 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 transition-all duration-200 shadow-2xs hover:border-slate-400 dark:hover:border-[#2a3e70] focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/60 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
          isOpen && 'ring-2 ring-cyan-500/40 border-cyan-500/60 dark:border-cyan-500/60',
          error && 'border-rose-500 focus:ring-rose-500',
          triggerClassName
        )}
      >
        <div className="flex items-center space-x-2.5 min-w-0 flex-1 text-left">
          {icon && <span className="shrink-0 text-slate-400 dark:text-slate-500">{icon}</span>}
          {selectedOption ? (
            <div className="flex items-center space-x-2 truncate">
              {selectedOption.icon && <span className="shrink-0">{selectedOption.icon}</span>}
              <span className="truncate">{selectedOption.label}</span>
            </div>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 truncate font-normal">
              {placeholder}
            </span>
          )}
        </div>

        <ChevronDown
          className={cn(
            'w-4 h-4 shrink-0 transition-transform duration-200 text-slate-400 dark:text-slate-400',
            isOpen && 'rotate-180 text-cyan-500 dark:text-cyan-400'
          )}
        />
      </button>

      {/* Custom Animated Floating Dropdown Portal */}
      {isOpen &&
        isMounted &&
        position.width > 0 &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownRef}
            role="listbox"
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              width: position.width,
            }}
            className={cn(
              'z-[99999] rounded-2xl border border-slate-200 dark:border-[#1e2e56] bg-white/95 dark:bg-[#091124]/95 shadow-2xl backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150',
              dropdownClassName
            )}
          >
            {/* Optional Search Input */}
            {isSearchEnabled && (
              <div className="p-2 border-b border-slate-200/80 dark:border-[#1e2e56] bg-slate-50/80 dark:bg-slate-900/60">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-3 text-slate-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search options..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-8 pl-8 pr-7 text-xs font-semibold rounded-lg bg-white dark:bg-[#070c1a] border border-slate-300 dark:border-[#1e2e56] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                    onClick={(e) => e.stopPropagation()}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Options List */}
            <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
              {filteredOptions.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400 font-medium">
                  No matching options
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = String(option.value) === String(value);

                  return (
                    <button
                      key={String(option.value)}
                      type="button"
                      disabled={option.disabled}
                      onClick={() => handleSelect(option)}
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-between gap-2 cursor-pointer',
                        isSelected
                          ? 'bg-cyan-500/15 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-bold'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/90 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white',
                        option.disabled && 'opacity-40 cursor-not-allowed'
                      )}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                        {option.icon && <span className="shrink-0">{option.icon}</span>}
                        <div className="min-w-0">
                          <div className="truncate">{option.label}</div>
                          {option.description && (
                            <div className="text-[11px] font-normal text-slate-400 truncate">
                              {option.description}
                            </div>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <Check className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 font-bold" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}

      {error ? (
        <p className="text-xs text-rose-500 font-medium">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
      ) : null}
    </div>
  );
};
