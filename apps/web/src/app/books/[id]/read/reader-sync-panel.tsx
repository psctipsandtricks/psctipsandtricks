'use client';

import React, { useState } from 'react';
import { PdfSyncMap } from '@psc/shared-types';
import {
  SlidersHorizontal,
  Plus,
  Minus,
  Crosshair,
  Trash2,
  RotateCcw,
  Save,
  Check,
  Loader2,
  X,
  Wand2,
} from 'lucide-react';
import {
  OFFSET_NUDGE_MS,
  formatCueTime,
  formatOffset,
} from './pdf-audio-sync';

export type SyncSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface ReaderSyncPanelProps {
  map: PdfSyncMap;
  /** Live playhead, ms — drives the active-cue highlight and cue capture. */
  currentTimeMs: number;
  durationMs: number;
  currentPage: number;
  numPages: number;
  /** The page the map currently resolves to, for the "cued page" readout. */
  resolvedPage: number | null;
  canSaveToLibrary: boolean;
  saveState: SyncSaveState;
  /**
   * Relative, not absolute: deriving `map.offsetMs + delta` here would read a
   * prop that React has not re-rendered yet, so three quick taps would all
   * compute the same value and only the last would survive.
   */
  onOffsetNudge: (deltaMs: number) => void;
  onOffsetReset: () => void;
  onCaptureCue: () => void;
  onRemoveCue: (startMs: number) => void;
  onNudgeCue: (startMs: number, deltaMs: number) => void;
  onSeekToMs: (ms: number) => void;
  onSeedLinear: () => void;
  onResetAll: () => void;
  onSave: () => void;
}

/**
 * Fine-tuning UI for the PDF↔audio timing map.
 *
 * Two levels of correction, because the two failure modes are different:
 *  - A whole track that drifted uniformly (recording started late) → one global
 *    offset nudge fixes every page at once.
 *  - One page that lingers or turns early → capture or nudge that single cue.
 */
export function ReaderSyncPanel({
  map,
  currentTimeMs,
  durationMs,
  currentPage,
  numPages,
  resolvedPage,
  canSaveToLibrary,
  saveState,
  onOffsetNudge,
  onOffsetReset,
  onCaptureCue,
  onRemoveCue,
  onNudgeCue,
  onSeekToMs,
  onSeedLinear,
  onResetAll,
  onSave,
}: ReaderSyncPanelProps) {
  const [open, setOpen] = useState(false);

  const activeCueIndex = map.cues.findIndex(
    (c) => currentTimeMs - map.offsetMs >= c.startMs && currentTimeMs - map.offsetMs < c.endMs,
  );

  const isDrifted = resolvedPage !== null && resolvedPage !== currentPage;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer shadow-xs border ${
          open || map.cues.length > 0
            ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'
            : 'bg-slate-100/90 dark:bg-[#0c152e] text-slate-500 dark:text-slate-400 border-slate-200/90 dark:border-[#1e2e56]'
        }`}
        title="PDF Sync — map audio timestamps to PDF pages"
        aria-expanded={open}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">PDF Sync</span>
        {map.cues.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-[10px] font-mono tabular-nums">
            {map.cues.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-[min(92vw,26rem)] z-50 rounded-2xl border border-slate-200 dark:border-[#1e2e56] bg-white dark:bg-[#070e22] shadow-2xl p-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150"
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/80 dark:border-[#1e2e56]">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white">
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />
              <span>PDF Sync Timing</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Close sync panel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Live readout */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-[#0c152e] border border-slate-200/60 dark:border-slate-800">
              <p className="text-[9px] font-bold text-slate-400 uppercase">Audio</p>
              <p className="text-[11px] font-black font-mono text-slate-900 dark:text-white tabular-nums">
                {formatCueTime(currentTimeMs)}
              </p>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-[#0c152e] border border-slate-200/60 dark:border-slate-800">
              <p className="text-[9px] font-bold text-slate-400 uppercase">Cued page</p>
              <p className="text-[11px] font-black font-mono text-indigo-600 dark:text-indigo-400 tabular-nums">
                {resolvedPage ?? '—'}
              </p>
            </div>
            <div
              className={`p-2 rounded-xl border ${
                isDrifted
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-slate-50 dark:bg-[#0c152e] border-slate-200/60 dark:border-slate-800'
              }`}
            >
              <p className="text-[9px] font-bold text-slate-400 uppercase">On screen</p>
              <p
                className={`text-[11px] font-black font-mono tabular-nums ${
                  isDrifted ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
                }`}
              >
                {currentPage}
              </p>
            </div>
          </div>

          {/* Global offset */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Global offset
              </label>
              <span className="text-[11px] font-black font-mono text-slate-900 dark:text-white tabular-nums">
                {formatOffset(map.offsetMs)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onOffsetNudge(-OFFSET_NUDGE_MS)}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                title="Pages turn earlier"
              >
                <Minus className="w-3 h-3" /> {OFFSET_NUDGE_MS}ms
              </button>
              <button
                type="button"
                onClick={onOffsetReset}
                className="px-2 py-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Reset offset to zero"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => onOffsetNudge(OFFSET_NUDGE_MS)}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                title="Pages turn later"
              >
                <Plus className="w-3 h-3" /> {OFFSET_NUDGE_MS}ms
              </button>
            </div>
            <p className="text-[10px] text-slate-400 leading-snug">
              Shifts every page turn at once. Use when the whole track is early or late.
            </p>
          </div>

          {/* Capture */}
          <button
            type="button"
            onClick={onCaptureCue}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black bg-indigo-500 text-white hover:bg-indigo-400 transition-colors cursor-pointer shadow-sm"
            title="Mark that the current PDF page belongs at the current audio timestamp"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>
              Set page {currentPage} at {formatCueTime(currentTimeMs)}
            </span>
          </button>

          {/* Cue list */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Cues ({map.cues.length})
              </label>
              {map.cues.length === 0 && numPages > 0 && durationMs > 0 && (
                <button
                  type="button"
                  onClick={onSeedLinear}
                  className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  title="Create one evenly-spaced cue per page as a starting point"
                >
                  <Wand2 className="w-3 h-3" /> Seed evenly
                </button>
              )}
            </div>

            {map.cues.length === 0 ? (
              <p className="text-[10px] text-slate-400 leading-snug py-2">
                No cues yet. Play the audio and press the button above each time the page should
                turn — or seed an even split and correct it from there.
              </p>
            ) : (
              <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200/80 dark:border-[#1e2e56] divide-y divide-slate-100 dark:divide-slate-800">
                {map.cues.map((cue, i) => (
                  <div
                    key={`${cue.startMs}-${cue.page}`}
                    className={`flex items-center gap-1.5 px-2 py-1.5 text-[11px] ${
                      i === activeCueIndex ? 'bg-indigo-500/10' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSeekToMs(cue.startMs + map.offsetMs)}
                      className="font-mono font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 tabular-nums cursor-pointer shrink-0"
                      title="Seek the audio to this cue"
                    >
                      {formatCueTime(cue.startMs)}
                    </button>
                    <span className="text-slate-300 dark:text-slate-600">→</span>
                    <span className="font-black text-slate-900 dark:text-white shrink-0">
                      p{cue.page}
                    </span>
                    <div className="flex items-center gap-0.5 ml-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => onNudgeCue(cue.startMs, -OFFSET_NUDGE_MS)}
                        className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        title={`Move this cue ${OFFSET_NUDGE_MS}ms earlier`}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onNudgeCue(cue.startMs, OFFSET_NUDGE_MS)}
                        className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        title={`Move this cue ${OFFSET_NUDGE_MS}ms later`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveCue(cue.startMs)}
                        className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                        title="Delete this cue"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Persist */}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-200/80 dark:border-[#1e2e56]">
            <button
              type="button"
              onClick={onResetAll}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Discard all cues and offset for this topic"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saveState === 'saving'}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-60 transition-colors cursor-pointer shadow-sm"
            >
              {saveState === 'saving' ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
              ) : saveState === 'saved' ? (
                <><Check className="w-3.5 h-3.5" /> Saved</>
              ) : (
                <><Save className="w-3.5 h-3.5" /> {canSaveToLibrary ? 'Save for everyone' : 'Save my timing'}</>
              )}
            </button>
          </div>
          {saveState === 'error' && (
            <p className="text-[10px] font-bold text-rose-500">
              Could not save to the library — your timing is still stored on this device.
            </p>
          )}
          <p className="text-[10px] text-slate-400 leading-snug">
            {canSaveToLibrary
              ? 'Saved timing is used for every student reading this topic.'
              : 'Saved on this device and reused next time you open this topic.'}
          </p>
        </div>
      )}
    </div>
  );
}
