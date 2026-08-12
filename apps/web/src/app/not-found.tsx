'use client';

import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center text-2xl font-black mb-4">
        404
      </div>
      <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">Page Not Found</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed mb-6">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="px-5 py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-extrabold text-sm hover:bg-cyan-400 transition-all shadow-md cursor-pointer"
      >
        Return to Home
      </Link>
    </div>
  );
}
