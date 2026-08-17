/**
 * Client-side mirror of the API's YouTube link parsing (apps/api/src/videos/youtube.ts).
 *
 * The server remains the authority — it re-parses and rejects bad links on
 * write — but the admin form needs to preview the thumbnail as the link is
 * typed, and the student player needs to build an embed URL, neither of which
 * can wait on a round trip.
 */

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const PATH_PREFIXES = ['embed', 'shorts', 'live', 'v'];

/** Returns the 11-character video id from any YouTube link shape, or null if there isn't one. */
export function extractYoutubeVideoId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (VIDEO_ID.test(raw)) return raw;

  let url: URL;
  try {
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
 * Only ever generated for a video that has been uploaded in at least 720p, so
 * anything using it needs a fallback to `hqdefault` — see `THUMBNAIL_FALLBACK`.
 */
export function youtubeMaxResThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
}

/** The one thumbnail size YouTube generates for every video. */
export function youtubeFallbackThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * `youtube-nocookie.com` so watching inside the app doesn't set ad-tracking
 * cookies for students who never left the site.
 */
export function youtubeEmbedUrl(videoId: string, autoplay = true): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1${autoplay ? '&autoplay=1' : ''}`;
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
