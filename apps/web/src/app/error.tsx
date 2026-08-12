'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Error:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center text-2xl font-black mb-4">
        !
      </div>
      <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">Something went wrong</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed mb-6">
        An unexpected error occurred. Please try again or return to the homepage.
      </p>
      <div className="flex items-center space-x-3">
        <button
          type="button"
          onClick={() => reset()}
          className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-all shadow-md cursor-pointer"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-900 transition-all cursor-pointer"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
