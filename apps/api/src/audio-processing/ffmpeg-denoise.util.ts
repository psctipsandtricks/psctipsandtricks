import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Denoises + resamples audio in one ffmpeg pass: a gentle highpass to cut
 * rumble, RNNoise (`arnndn`) as the AI denoiser, and downmix/resample to
 * 16kHz mono (what whisper.cpp expects). Deliberately conservative filtering
 * — a single arnndn pass — to avoid the robotic/over-processed artifacts a
 * more aggressive chain can introduce.
 */
export async function denoiseAudio(
  inputPath: string,
  outputPath: string,
  options: { ffmpegPath: string; rnnoiseModelPath: string },
): Promise<void> {
  const filter = `highpass=f=80,arnndn=m=${options.rnnoiseModelPath}`;
  await execFileAsync(
    options.ffmpegPath,
    ['-y', '-i', inputPath, '-af', filter, '-ar', '16000', '-ac', '1', outputPath],
    { maxBuffer: 1024 * 1024 * 64, timeout: 10 * 60 * 1000 },
  );
}

/**
 * Encodes the denoised WAV down to a compressed MP3 for storage/playback.
 * The WAV itself stays uncompressed on disk for whisper.cpp (which wants
 * raw PCM) — this is a separate output purely for what gets uploaded and
 * served to listeners. 96kbps mono is more than sufficient for spoken-word
 * audio and keeps even a very long (20+ minute) recording well under
 * typical object storage size limits (a 21-minute WAV is ~40MB uncompressed
 * vs. ~15MB at 96kbps), which previously caused upload failures for long
 * chapters.
 */
export async function encodeForPlayback(
  wavPath: string,
  outputPath: string,
  options: { ffmpegPath: string },
): Promise<void> {
  await execFileAsync(
    options.ffmpegPath,
    ['-y', '-i', wavPath, '-c:a', 'libmp3lame', '-b:a', '96k', '-ac', '1', outputPath],
    { maxBuffer: 1024 * 1024 * 64, timeout: 10 * 60 * 1000 },
  );
}
