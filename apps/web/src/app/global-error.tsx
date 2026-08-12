'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#060b18] text-white flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center text-3xl font-black mx-auto">
            ⚠
          </div>
          <h1 className="text-2xl font-black">Application Error</h1>
          <p className="text-sm text-slate-400">
            A critical error occurred while loading this page.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="px-5 py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-extrabold text-sm hover:bg-cyan-400 transition-all cursor-pointer"
          >
            Reload Page
          </button>
        </div>
      </body>
    </html>
  );
}
