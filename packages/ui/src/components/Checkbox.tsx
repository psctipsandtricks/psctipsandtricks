import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../utils';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * A real (visually hidden) checkbox input drives a styled sibling box via
 * Tailwind's `peer` variants, so keyboard nav, screen readers, and
 * label-click-to-toggle all come from the native element for free — only the
 * paint is custom.
 */
export const Checkbox: React.FC<CheckboxProps> = ({ checked, onChange, label, description, disabled, className }) => {
  return (
    <label
      className={cn(
        'inline-flex items-start gap-2.5 select-none',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        className,
      )}
    >
      <span className="relative mt-0.5 w-5 h-5 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          className={cn(
            'block w-5 h-5 rounded-md border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-[#091124]',
            'transition-all duration-150',
            'peer-hover:border-cyan-500/60',
            'peer-checked:border-transparent peer-checked:bg-gradient-to-r peer-checked:from-cyan-500 peer-checked:to-blue-600 peer-checked:shadow-sm peer-checked:shadow-cyan-500/30',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-500/50 peer-focus-visible:ring-offset-1 dark:peer-focus-visible:ring-offset-[#091124]',
          )}
        />
        <Check
          className="pointer-events-none absolute inset-0 m-auto w-3.5 h-3.5 text-white opacity-0 scale-50 transition-all duration-150 peer-checked:opacity-100 peer-checked:scale-100"
          strokeWidth={3}
        />
      </span>
      {(label || description) && (
        <span className="flex flex-col leading-snug">
          {label && <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</span>}
          {description && <span className="text-xs font-normal text-slate-400">{description}</span>}
        </span>
      )}
    </label>
  );
};
