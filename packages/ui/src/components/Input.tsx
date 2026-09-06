'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  showPasswordToggle?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, error, helperText, id, showPasswordToggle = true, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    const isPasswordType = type === 'password';
    const computedType = isPasswordType && showPasswordToggle && showPassword ? 'text' : type;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <input
            type={computedType}
            id={inputId}
            ref={ref}
            className={cn(
              'flex h-11 w-full rounded-xl border border-slate-400 dark:border-slate-800 bg-slate-100 dark:bg-[#070b18]/70 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/60 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 shadow-xs',
              isPasswordType && showPasswordToggle && 'pr-11',
              error && 'border-rose-500 focus:ring-rose-500',
              className
            )}
            {...props}
          />
          {isPasswordType && showPasswordToggle && (
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
              className="absolute right-3.5 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200 transition-colors p-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
        {error ? (
          <p className="text-xs text-rose-500 font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
