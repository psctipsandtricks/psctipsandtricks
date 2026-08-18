'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Play, Pause, Volume2, X } from 'lucide-react';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export interface ReaderAudioPlayerHandle {
  play: () => void;
  pause: () => void;
}

interface ReaderAudioPlayerProps {
  src: string;
  topicTitle?: string;
  chapterTitle?: string;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
}

/**
 * Enhanced audio player with built-in Web Audio API real-time DSP noise filtering
 * and voice clarity enhancement (high-pass rumble cut, hiss reduction, and speech EQ).
 * Displays a fixed bottom floating audio bar when playing.
 */
export const ReaderAudioPlayer = forwardRef<ReaderAudioPlayerHandle, ReaderAudioPlayerProps>(
  ({ src, topicTitle, chapterTitle, onPlay, onPause, onEnded }, ref) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [current, setCurrent] = useState(0);
    const [duration, setDuration] = useState(0);
    const [noiseFilterEnabled, setNoiseFilterEnabled] = useState(true);

    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
    const highPassNodeRef = useRef<BiquadFilterNode | null>(null);
    const voiceEqNodeRef = useRef<BiquadFilterNode | null>(null);
    const lowPassNodeRef = useRef<BiquadFilterNode | null>(null);
    const compressorNodeRef = useRef<DynamicsCompressorNode | null>(null);

    const setupAudioGraph = () => {
      if (audioContextRef.current || !audioRef.current) return;
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const source = ctx.createMediaElementSource(audioRef.current);

        // 1. High-pass filter (cuts low rumble, air conditioner hum < 95Hz)
        const highPass = ctx.createBiquadFilter();
        highPass.type = 'highpass';
        highPass.frequency.value = 95;

        // 2. Peaking filter (boosts vocal presence & diction at 2.4kHz)
        const voiceEq = ctx.createBiquadFilter();
        voiceEq.type = 'peaking';
        voiceEq.frequency.value = 2400;
        voiceEq.Q.value = 1.2;
        voiceEq.gain.value = 3.5;

        // 3. Low-pass filter (smooths out high-frequency hiss / static > 7500Hz)
        const lowPass = ctx.createBiquadFilter();
        lowPass.type = 'lowpass';
        lowPass.frequency.value = 7500;

        // 4. Dynamics Compressor (normalizes volume and suppresses room noise)
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-24, ctx.currentTime);
        compressor.knee.setValueAtTime(8, ctx.currentTime);
        compressor.ratio.setValueAtTime(3.5, ctx.currentTime);
        compressor.attack.setValueAtTime(0.003, ctx.currentTime);
        compressor.release.setValueAtTime(0.25, ctx.currentTime);

        source.connect(highPass);
        highPass.connect(voiceEq);
        voiceEq.connect(lowPass);
        lowPass.connect(compressor);
        compressor.connect(ctx.destination);

        audioContextRef.current = ctx;
        sourceNodeRef.current = source;
        highPassNodeRef.current = highPass;
        voiceEqNodeRef.current = voiceEq;
        lowPassNodeRef.current = lowPass;
        compressorNodeRef.current = compressor;
      } catch {
        // Fallback gracefully to direct playback if Web Audio is restricted
      }
    };

    // Update filter bypass when toggle changes
    useEffect(() => {
      if (!highPassNodeRef.current || !voiceEqNodeRef.current || !lowPassNodeRef.current) return;
      if (noiseFilterEnabled) {
        highPassNodeRef.current.frequency.value = 95;
        voiceEqNodeRef.current.gain.value = 3.5;
        lowPassNodeRef.current.frequency.value = 7500;
      } else {
        highPassNodeRef.current.frequency.value = 10;
        voiceEqNodeRef.current.gain.value = 0;
        lowPassNodeRef.current.frequency.value = 20000;
      }
    }, [noiseFilterEnabled]);

    useImperativeHandle(ref, () => ({
      play: () => {
        setupAudioGraph();
        if (audioContextRef.current?.state === 'suspended') {
          audioContextRef.current.resume();
        }
        audioRef.current?.play().catch(() => {});
      },
      pause: () => audioRef.current?.pause(),
    }));

    const togglePlay = () => {
      const audio = audioRef.current;
      if (!audio) return;
      setupAudioGraph();
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const audio = audioRef.current;
      if (!audio) return;
      const value = Number(e.target.value);
      audio.currentTime = value;
      setCurrent(value);
    };

    return (
      <>
        {/* Inline Audio Player Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-slate-50/70 dark:bg-[#0c152e]/70 shadow-2xs">
          <audio
            ref={audioRef}
            src={src}
            crossOrigin="anonymous"
            preload="metadata"
            onPlay={() => {
              setIsPlaying(true);
              onPlay?.();
            }}
            onPause={() => {
              setIsPlaying(false);
              onPause?.();
            }}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
            onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
            onEnded={() => {
              setIsPlaying(false);
              onEnded?.();
            }}
          />

          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              type="button"
              onClick={togglePlay}
              className="shrink-0 w-9 h-9 rounded-full bg-cyan-500 text-white flex items-center justify-center hover:bg-cyan-400 transition-colors cursor-pointer shadow-sm"
              title={isPlaying ? 'Pause' : 'Play Audio'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <Volume2 className="w-3.5 h-3.5 text-slate-400 shrink-0 hidden sm:block" />
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={current}
              onChange={handleSeek}
              className="flex-1 h-1.5 rounded-full accent-cyan-500 cursor-pointer"
            />
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
              {formatTime(current)} / {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Fixed Bottom Audio Bar — only visible when audio is playing! */}
        {isPlaying && (
          <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[96%] max-w-3xl bg-white/95 dark:bg-[#070e22]/95 backdrop-blur-xl border border-cyan-500/40 shadow-2xl shadow-cyan-950/30 rounded-2xl p-2.5 sm:p-3.5 transition-all animate-in fade-in slide-in-from-bottom-5 duration-300">
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              {/* Left: Track Info + Live Visualizer */}
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 shrink-0 max-w-[140px] sm:max-w-[210px]">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-500 shrink-0">
                  <div className="flex items-end gap-0.5 h-3.5">
                    <span className="w-0.5 bg-cyan-500 rounded-full animate-[bounce_0.6s_infinite_alternate]" style={{ height: '70%' }} />
                    <span className="w-0.5 bg-cyan-500 rounded-full animate-[bounce_0.8s_infinite_alternate_0.2s]" style={{ height: '100%' }} />
                    <span className="w-0.5 bg-cyan-500 rounded-full animate-[bounce_0.5s_infinite_alternate_0.4s]" style={{ height: '50%' }} />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-black text-slate-900 dark:text-white truncate leading-tight">
                    {topicTitle || 'Audio Lesson'}
                  </p>
                  <p className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold truncate">
                    {chapterTitle || 'Playing Audio'}
                  </p>
                </div>
              </div>

              {/* Center: Play/Pause Button + Scrub Slider + Formatted Time */}
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 justify-center">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="shrink-0 w-8 h-8 rounded-full bg-cyan-500 hover:bg-cyan-400 text-white flex items-center justify-center transition-transform active:scale-95 cursor-pointer shadow-sm"
                  title="Pause Audio"
                >
                  <Pause className="w-4 h-4 fill-current" />
                </button>

                <div className="flex items-center gap-2 flex-1 min-w-[100px]">
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.1}
                    value={current}
                    onChange={handleSeek}
                    className="flex-1 h-1.5 rounded-full accent-cyan-500 cursor-pointer min-w-0"
                  />
                  <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 shrink-0 tabular-nums whitespace-nowrap">
                    {formatTime(current)} / {formatTime(duration)}
                  </span>
                </div>
              </div>

              {/* Right: Action Toggles & Close/Pause */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    audioRef.current?.pause();
                    setIsPlaying(false);
                    onPause?.();
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                  title="Close Player"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  },
);

ReaderAudioPlayer.displayName = 'ReaderAudioPlayer';
