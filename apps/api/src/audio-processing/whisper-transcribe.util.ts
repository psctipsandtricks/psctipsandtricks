import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import { TimedWord } from './audio-processing.types';

const execFileAsync = promisify(execFile);

interface WhisperJsonEntry {
  offsets?: { from: number; to: number };
  text?: string;
}
interface WhisperJsonOutput {
  transcription?: WhisperJsonEntry[];
}

/**
 * Runs whisper.cpp on a 16kHz mono WAV and returns word-level timestamps.
 * Uses `-ml 1` (max-len 1) to force one-word-per-segment output — the
 * long-standing, broadly-supported way to get word timestamps out of
 * whisper.cpp. NOTE: verify these exact flags against the installed
 * binary's `--help` output (whisper.cpp's CLI surface, and even the binary
 * name — `main` vs `whisper-cli` — has changed across versions/forks); this
 * was not validated against a live nixpkgs build.
 *
 * `-bs 1 -bo 1` forces greedy decoding instead of whisper.cpp's default
 * 5-beams-plus-best-of-5 search, which is dramatically cheaper on CPU and
 * memory for long audio — this is best-effort sentence alignment, not a
 * transcript users read directly, so the accuracy trade-off is worth it. A
 * hard `timeout` also ensures a stuck/runaway process gets killed rather
 * than left to consume memory indefinitely.
 */
export async function transcribeWithWhisper(
  wavPath: string,
  options: { binaryPath: string; modelPath: string; language?: string },
): Promise<TimedWord[]> {
  const outputPrefix = wavPath.replace(/\.wav$/i, '');
  await execFileAsync(
    options.binaryPath,
    [
      '-m', options.modelPath,
      '-f', wavPath,
      '-ml', '1',
      '-bs', '1',
      '-bo', '1',
      '-oj',
      '-of', outputPrefix,
      '-l', options.language || 'auto',
      '-nt',
    ],
    { maxBuffer: 1024 * 1024 * 64, timeout: 15 * 60 * 1000 },
  );

  const jsonPath = `${outputPrefix}.json`;
  const raw = await fs.readFile(jsonPath, 'utf-8');
  const parsed: WhisperJsonOutput = JSON.parse(raw);
  await fs.unlink(jsonPath).catch(() => {});

  return (parsed.transcription ?? [])
    .map((entry) => ({
      word: (entry.text ?? '').trim(),
      start: (entry.offsets?.from ?? 0) / 1000,
      end: (entry.offsets?.to ?? 0) / 1000,
    }))
    .filter((w) => w.word.length > 0);
}
