import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../utils';

export type ToggleSwitchVariant = 'cyan' | 'emerald' | 'rose' | 'amber';

const VARIANT_CLASSES: Record<ToggleSwitchVariant, { icon: string; peerBg: string }> = {
  cyan: { icon: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20', peerBg: 'peer-checked:bg-cyan-500' },
  emerald: { icon: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', peerBg: 'peer-checked:bg-emerald-500' },
  rose: { icon: 'bg-rose-500/10 text-rose-500 border-rose-500/20', peerBg: 'peer-checked:bg-rose-500' },
  amber: { icon: 'bg-amber-500/10 text-amber-500 border-amber-500/20', peerBg: 'peer-checked:bg-amber-500' },
};

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  variant?: ToggleSwitchVariant;
  badge?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * A settings-row toggle: icon badge + title + description on the left, a
 * pill switch with an ON/OFF readout on the right. Matches the row pattern
 * already used for quiz settings (Negative Marking, Active Status, etc.), so
 * boolean admin options read the same everywhere instead of falling back to
 * a bare checkbox.
 */
export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  label,
  description,
  icon: Icon,
  variant = 'cyan',
  badge,
  disabled,
  className,
}) => {
  const colors = VARIANT_CLASSES[variant];

  return (
    <div
      className={cn(
        'p-3.5 rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-slate-100/70 dark:bg-[#091124] flex items-center justify-between gap-3',
        disabled && 'opacity-60',
        className,
      )}
    >
      <div className="flex items-center space-x-2.5 pr-2 min-w-0">
        {Icon && (
          <div className={cn('p-1.5 rounded-lg border shrink-0', colors.icon)}>
            <Icon className="w-4 h-4" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">{label}</span>
            {badge}
          </div>
          {description && <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">{description}</p>}
        </div>
      </div>

      <label className={cn('relative inline-flex items-center shrink-0', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div
          className={cn(
            "w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-slate-600",
            colors.peerBg,
          )}
        />
        <span className="ml-2.5 text-xs font-extrabold font-mono text-slate-800 dark:text-slate-200 w-8 text-left shrink-0">
          {checked ? 'ON' : 'OFF'}
        </span>
      </label>
    </div>
  );
};
