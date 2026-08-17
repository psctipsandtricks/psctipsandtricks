import { BadRequestException } from '@nestjs/common';

/**
 * A YouTube id is always exactly 11 characters from the URL-safe alphabet.
 * Matching the exact length matters: `youtu.be/abc` would otherwise be
 * accepted and stored as a video that can never load.
 */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Path prefixes that carry the id as the next segment — `/embed/ID`, `/shorts/ID`, `/live/ID`, `/v/ID`. */
const PATH_PREFIXES = ['embed', 'shorts', 'live', 'v'];

/**
 * Pulls the video id out of any of the link shapes an admin might paste:
 * a full watch URL, a `youtu.be` share link, an embed/shorts/live URL, or the
 * bare 11-character id. Query strings (`?t=`, `&list=`) are ignored.
 *
 * Returns null rather than throwing so callers can decide between a 400 and a
 * silent skip; `parseYoutubeLink` is the throwing wrapper used on writes.
 */
export function extractYoutubeVideoId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // A bare id, pasted straight from the address bar's `v=` value.
  if (VIDEO_ID.test(raw)) return raw;

  let url: URL;
  try {
    // Links are routinely pasted without a scheme ("youtu.be/…"), which the
    // URL parser rejects outright.
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./i, '').toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be') {
    const id = segments[0];
    return id && VIDEO_ID.test(id) ? id : null;
  }

  if (host !== 'youtube.com' && host !== 'm.youtube.com' && host !== 'youtube-nocookie.com') {
    return null;
  }

  if (segments[0] === 'watch') {
    const id = url.searchParams.get('v');
    return id && VIDEO_ID.test(id) ? id : null;
  }

  if (segments.length >= 2 && PATH_PREFIXES.includes(segments[0])) {
    return VIDEO_ID.test(segments[1]) ? segments[1] : null;
  }

  return null;
}

/**
 * `hqdefault` is the one thumbnail size YouTube generates for every video —
 * `maxresdefault` is missing on anything never uploaded above 720p and would
 * render as a broken image. The web client optimistically tries the higher
 * resolution and falls back to this one.
 */
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/** Canonical watch URL, so every stored link is in one predictable form. */
export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export interface ParsedYoutubeLink {
  youtubeUrl: string;
  youtubeVideoId: string;
  thumbnailUrl: string;
}

/** Validates and expands a pasted link into the three fields a Video row stores. */
export function parseYoutubeLink(input: string): ParsedYoutubeLink {
  const videoId = extractYoutubeVideoId(input);
  if (!videoId) {
    throw new BadRequestException(
      'That is not a valid YouTube link. Paste a watch, youtu.be, shorts, or embed URL.',
    );
  }
  return {
    youtubeUrl: youtubeWatchUrl(videoId),
    youtubeVideoId: videoId,
    thumbnailUrl: youtubeThumbnailUrl(videoId),
  };
}
