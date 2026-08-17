'use client';

import React, { useEffect, useState } from 'react';
import { ListTree, X, CheckCircle2, ChevronRight, ChevronDown, Youtube, Play, Pause, Music, FileText, PlayCircle } from 'lucide-react';
import { ChapterSummary } from './reader-types';
import { extractYoutubeId } from './reader-youtube-embed';

interface ReaderProgressSidebarProps {
  bookTitle?: string;
  chapters: ChapterSummary[];
  activeUnitIndex: number;
  totalUnits: number;
  playingUnitIndex?: number | null;
  isPlayingAudio?: boolean;
  onJumpToUnit: (unitIndex: number) => void;
  onTogglePlayAudio?: (unitIndex: number) => void;
  onPlayYoutubeVideo?: (unitIndex: number) => void;
}

export function ReaderProgressSidebar({
  bookTitle,
  chapters,
  activeUnitIndex,
  totalUnits,
  playingUnitIndex,
  isPlayingAudio,
  onJumpToUnit,
  onTogglePlayAudio,
  onPlayYoutubeVideo,
}: ReaderProgressSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedChapterIds, setExpandedChapterIds] = useState<Set<string>>(new Set());

  // Auto-expand current active chapter
  useEffect(() => {
    const currentChapter = chapters.find(
      (c) => activeUnitIndex >= c.unitStart && activeUnitIndex <= c.unitEnd
    );
    if (currentChapter) {
      setExpandedChapterIds((prev) => new Set(prev).add(currentChapter.chapterId));
    }
  }, [activeUnitIndex, chapters]);

  const toggleChapter = (chapterId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedChapterIds((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  };

  const overallPercent = totalUnits > 0 ? Math.round(((activeUnitIndex + 1) / totalUnits) * 100) : 0;

  const panel = (
    <div className="space-y-2 overflow-y-auto flex-1 min-h-0 px-3 pb-3 custom-scrollbar">
      {chapters.map((chapter, idx) => {
        const isDone = activeUnitIndex > chapter.unitEnd;
        const isActive = activeUnitIndex >= chapter.unitStart && activeUnitIndex <= chapter.unitEnd;
        const unitsInChapter = chapter.unitEnd - chapter.unitStart + 1;
        const unitsPassed = Math.min(unitsInChapter, Math.max(0, activeUnitIndex - chapter.unitStart + 1));
        const chapterPercent = Math.round((unitsPassed / unitsInChapter) * 100);
        const isExpanded = expandedChapterIds.has(chapter.chapterId);
        const hasTopics = chapter.topics && chapter.topics.length > 0;

        return (
          <div key={chapter.chapterId} className="space-y-1">
            <div
              onClick={() => {
                onJumpToUnit(chapter.unitStart);
                setIsOpen(false);
              }}
              title={chapter.title}
              className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer select-none group ${
                isActive
                  ? 'border-cyan-500/60 bg-cyan-500/10 shadow-xs'
                  : 'border-slate-200 dark:border-[#1e2e56] bg-slate-50/70 dark:bg-[#0c152e]/60 hover:border-cyan-500/30'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="font-mono text-[11px] font-extrabold text-cyan-600 dark:text-cyan-400 shrink-0 w-5 mt-0.5">
                  {idx + 1}
                </span>
                <span className="text-xs font-extrabold text-slate-900 dark:text-white leading-snug flex-1 break-words">
                  {chapter.title}
                </span>

                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                  {chapter.hasYoutube && (
                    <span title="Contains YouTube video lessons" className="text-rose-500">
                      <Youtube className="w-3.5 h-3.5" />
                    </span>
                  )}
                  {chapter.hasAudio && (
                    <span title="Contains Audio" className="text-cyan-500">
                      <Music className="w-3.5 h-3.5" />
                    </span>
                  )}
                  {chapter.hasPdf && (
                    <span title="Contains PDF" className="text-amber-500">
                      <FileText className="w-3.5 h-3.5" />
                    </span>
                  )}
                  {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-1" />}

                  {hasTopics && (
                    <button
                      type="button"
                      onClick={(e) => toggleChapter(chapter.chapterId, e)}
                      className="p-1 rounded hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer ml-0.5"
                      title={isExpanded ? 'Collapse Topics' : 'Show Topics'}
                    >
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-cyan-500' : ''}`} />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-2 h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                  style={{ width: `${isDone ? 100 : chapterPercent}%` }}
                />
              </div>
            </div>

            {/* Nested Topics List with YouTube Thumbnails */}
            {isExpanded && hasTopics && (
              <div className="ml-3 pl-2.5 border-l-2 border-cyan-500/20 space-y-1.5 py-1 animate-in fade-in duration-200">
                {chapter.topics!.map((topic, tIdx) => {
                  const isTopicActive = activeUnitIndex === topic.unitIndex;
                  const isTopicDone = activeUnitIndex > topic.unitIndex;
                  const videoId = topic.youtubeUrl ? extractYoutubeId(topic.youtubeUrl) : null;

                  return (
                    <div
                      key={topic.id}
                      onClick={() => {
                        onJumpToUnit(topic.unitIndex);
                        setIsOpen(false);
                      }}
                      title={topic.title}
                      className={`w-full text-left p-2 rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer ${
                        isTopicActive
                          ? 'bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 font-bold border border-cyan-500/30 shadow-2xs'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-transparent'
                      } ${topic.kind === 'subtopic' ? 'pl-4' : ''}`}
                    >
                      {/* Chapter Subdivision Badge (e.g. 1.1, 1.2, 1.3) */}
                      <span className={`font-mono text-[10px] font-black shrink-0 px-1.5 py-0.5 rounded-md min-w-[26px] text-center ${
                        isTopicActive
                          ? 'bg-cyan-500/25 text-cyan-700 dark:text-cyan-300'
                          : 'bg-slate-200/80 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>
                        {topic.kind === 'subtopic' ? '↳' : `${chapter.chapterNumber}.${topic.topicNumber}`}
                      </span>

                      {/* Clickable YouTube Thumbnail */}
                      {videoId && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            onPlayYoutubeVideo?.(topic.unitIndex);
                            setIsOpen(false);
                          }}
                          className="relative w-10 h-7 rounded overflow-hidden shrink-0 border border-slate-300 dark:border-slate-700 bg-black group/thumb shadow-2xs hover:scale-105 hover:ring-2 hover:ring-rose-500 transition-all cursor-pointer"
                          title="Click to play video lesson in reader"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`}
                            alt=""
                            className="w-full h-full object-cover group-hover/thumb:opacity-90 transition-opacity"
                          />
                          <span className="absolute inset-0 bg-black/30 group-hover/thumb:bg-black/10 flex items-center justify-center transition-colors">
                            <Play className="w-2.5 h-2.5 text-white fill-white" />
                          </span>
                        </div>
                      )}

                      <span className="flex-1 text-[11px] font-medium leading-snug break-words min-w-0">
                        {topic.title}
                      </span>

                      {/* Right-aligned action buttons container */}
                      <div className="flex items-center gap-1.5 shrink-0 ml-auto self-center pl-1">
                        {/* Topic Audio Play/Pause Button */}
                        {topic.audioUrl && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onTogglePlayAudio?.(topic.unitIndex);
                              setIsOpen(false);
                            }}
                            className={`w-7 h-7 rounded-lg transition-all flex items-center justify-center cursor-pointer ${
                              playingUnitIndex === topic.unitIndex && isPlayingAudio
                                ? 'bg-cyan-500 text-white shadow-xs animate-pulse ring-2 ring-cyan-400/50'
                                : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500 hover:text-white border border-cyan-500/20'
                            }`}
                            title={
                              playingUnitIndex === topic.unitIndex && isPlayingAudio
                                ? 'Pause Audio Lesson'
                                : 'Play Audio Lesson'
                            }
                          >
                            {playingUnitIndex === topic.unitIndex && isPlayingAudio ? (
                              <Pause className="w-3.5 h-3.5 fill-current" />
                            ) : (
                              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                            )}
                          </button>
                        )}

                        {/* Completed Checkmark */}
                        {isTopicDone && (
                          <span title="Completed" className="shrink-0 text-emerald-500">
                            <CheckCircle2 className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="lg:hidden fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-xl shadow-cyan-500/40 flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-all"
        title="Chapter Progress & Video Lessons"
      >
        <ListTree className="w-5 h-5" />
      </button>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col w-80 xl:w-84 shrink-0 max-h-[calc(100vh-5.5rem)] sticky top-[72px] border border-slate-200/80 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] shadow-sm overflow-hidden">
        <div className="p-3.5 pb-2.5 mb-1 border-b border-slate-200 dark:border-[#1e2e56] space-y-1.5">
          {bookTitle && (
            <p className="text-[11px] font-black text-cyan-600 dark:text-cyan-400 truncate uppercase tracking-wide leading-tight">
              {bookTitle}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <ListTree className="w-4 h-4 text-cyan-500" />
              <span className="text-xs font-black text-slate-900 dark:text-white">Chapters & Lessons</span>
            </div>
            <span className="text-[11px] font-mono font-extrabold px-2 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              {overallPercent}%
            </span>
          </div>
        </div>
        {panel}
      </div>

      {/* Mobile drawer */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setIsOpen(false)} />
          <div className="relative w-full max-w-sm h-full bg-white dark:bg-[#091124] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 pb-3 mb-1 border-b border-slate-200 dark:border-[#1e2e56] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-wide truncate">
                  {bookTitle ?? 'E-Book'}
                </span>
                <button type="button" onClick={() => setIsOpen(false)} className="cursor-pointer text-slate-400 hover:text-slate-900 dark:hover:text-white p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-slate-900 dark:text-white">Chapters & Lessons</span>
                <span className="text-xs font-mono font-bold text-cyan-500">{overallPercent}%</span>
              </div>
            </div>
            {panel}
          </div>
        </div>
      )}
    </>
  );
}
