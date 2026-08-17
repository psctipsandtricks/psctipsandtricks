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
    { maxBuffer: 1024 * 1024 * 64 },
  );
}
