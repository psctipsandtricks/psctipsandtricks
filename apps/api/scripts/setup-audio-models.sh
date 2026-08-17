#!/usr/bin/env bash
# Downloads the AI models used by the audio-processing pipeline (noise
# removal + transcription for audio-to-PDF sync) into apps/api/models/, so
# they ship inside the built image and are available at runtime with no
# network dependency. Skips a download if the file is already present (e.g.
# a cached build layer), so re-running this is cheap.
#
# - RNNoise (.rnnn) model: used by ffmpeg's `arnndn` filter for AI noise
#   removal. Sourced from GregorR/rnnoise-models, whose README states none of
#   the models are subject to copyright.
# - whisper.cpp (ggml) model: used for transcription. Multilingual (not the
#   `.en`-suffixed variant) because book audio is expected to mix English and
#   Malayalam.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODEL_DIR="${AUDIO_MODEL_DIR:-$SCRIPT_DIR/../models}"
mkdir -p "$MODEL_DIR"

download_if_missing() {
  local url="$1" path="$2"
  if [ -f "$path" ]; then
    echo "model already present at $path — skipping download."
    return
  fi
  echo "downloading $(basename "$path") ..."
  curl -fL --retry 3 -o "$path.tmp" "$url"
  mv "$path.tmp" "$path"
  echo "done: $path"
}

RNNOISE_MODEL_NAME="${RNNOISE_MODEL_NAME:-rnnoise-model.rnnn}"
RNNOISE_MODEL_URL="${RNNOISE_MODEL_URL:-https://raw.githubusercontent.com/GregorR/rnnoise-models/master/somnolent-hogwash-2018-09-01/sh.rnnn}"
download_if_missing "$RNNOISE_MODEL_URL" "$MODEL_DIR/$RNNOISE_MODEL_NAME"

WHISPER_MODEL_NAME="${WHISPER_MODEL_NAME:-ggml-small.bin}"
WHISPER_MODEL_URL="${WHISPER_MODEL_URL:-https://huggingface.co/ggerganov/whisper.cpp/resolve/main/$WHISPER_MODEL_NAME}"
download_if_missing "$WHISPER_MODEL_URL" "$MODEL_DIR/$WHISPER_MODEL_NAME"
