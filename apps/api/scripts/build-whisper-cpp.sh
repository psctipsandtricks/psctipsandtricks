#!/usr/bin/env bash
# Compiles whisper.cpp from source into apps/api/whisper.cpp/build/bin/whisper-cli.
#
# whisper.cpp isn't a reliable apt package across Debian/Ubuntu versions (it
# only landed in Ubuntu 26.04's repos as of this writing), so building from
# source is the portable option — see build-essential/cmake/git in
# railpack.json's buildAptPackages. Skips the build if the binary already
# exists (cached build layer), and if the build tools aren't present for any
# reason, skips gracefully rather than failing the whole deploy: the app
# still runs and does AI noise removal (ffmpeg) without the transcription/
# PDF-sync half of the pipeline, which needs this binary.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WHISPER_DIR="${WHISPER_CPP_SRC_DIR:-$SCRIPT_DIR/../whisper.cpp}"
BINARY_PATH="$WHISPER_DIR/build/bin/whisper-cli"

if [ -f "$BINARY_PATH" ]; then
  echo "whisper.cpp already built at $BINARY_PATH — skipping."
  exit 0
fi

if ! command -v cmake >/dev/null 2>&1 || ! command -v git >/dev/null 2>&1; then
  echo "cmake/git not available — skipping whisper.cpp build. Transcription/PDF-sync will be unavailable; AI noise removal is unaffected."
  exit 0
fi

echo "Building whisper.cpp from source..."
rm -rf "$WHISPER_DIR"
git clone --depth 1 https://github.com/ggml-org/whisper.cpp.git "$WHISPER_DIR"
cmake -B "$WHISPER_DIR/build" -S "$WHISPER_DIR" -DCMAKE_BUILD_TYPE=Release
cmake --build "$WHISPER_DIR/build" -j"$(nproc)" --config Release
echo "Built whisper.cpp: $BINARY_PATH"
