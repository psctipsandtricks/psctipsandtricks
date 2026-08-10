'use client';

import React from 'react';

/**
 * A group's profile picture. Falls back to the group's initials on a gradient
 * when no image has been uploaded, so rows never render an empty box.
 */
export function GroupAvatar({
  name,
  imageUrl,
  coverGradient,
  className = 'w-11 h-11 rounded-2xl',
  textClassName = 'text-sm',
}: {
  name: string;
  imageUrl?: string | null;
  coverGradient?: string;
  className?: string;
  textClassName?: string;
}) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={`${className} object-cover border border-amber-500/30 shadow-sm shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${className} bg-gradient-to-br ${
        coverGradient || 'from-amber-500/20 to-orange-600/20'
      } border border-amber-500/30 flex items-center justify-center font-black text-slate-800 dark:text-white shadow-sm shrink-0 ${textClassName}`}
    >
      {initials || '#'}
    </div>
  );
}
