const FALLBACK_COLORS: [string, string] = ['#f59e0b', '#06b6d4'];
const SAMPLE_SIZE = 24;

function toHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Boosts saturation and normalizes lightness of a color while keeping its
 * hue, so the ambient glow reads clearly against both light and dark
 * backgrounds instead of disappearing when a cover's dominant tone is dark.
 */
function vivify(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const s = Math.min(0.85, Math.max(0.5, d === 0 ? 0.55 : d / (1 - Math.abs(2 * l - 1))));
  const lOut = Math.min(0.62, Math.max(0.4, l));

  const c = (1 - Math.abs(2 * lOut - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lOut - c / 2;
  let [rp, gp, bp] = [0, 0, 0];
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];

  return [(rp + m) * 255, (gp + m) * 255, (bp + m) * 255];
}

/**
 * Downsamples an image and buckets its pixels to estimate the two most
 * common non-extreme colors — used for the ambient glow behind book covers.
 * Falls back to a neutral brand palette if the image can't be read
 * (e.g. blocked by CORS) or has no usable pixels.
 */
export function extractDominantColors(url: string): Promise<[string, string]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !url) {
      resolve(FALLBACK_COLORS);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = SAMPLE_SIZE;
        canvas.height = SAMPLE_SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(FALLBACK_COLORS);
          return;
        }

        ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

        const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const alpha = data[i + 3];
          if (alpha < 200) continue;

          const lightness = (Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255;
          if (lightness < 0.12 || lightness > 0.92) continue; // skip near-black / near-white

          const key = `${Math.round(r / 24)}-${Math.round(g / 24)}-${Math.round(b / 24)}`;
          const bucket = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
          bucket.count += 1;
          bucket.r += r;
          bucket.g += g;
          bucket.b += b;
          buckets.set(key, bucket);
        }

        const sorted = Array.from(buckets.values()).sort((a, b) => b.count - a.count);
        if (sorted.length === 0) {
          resolve(FALLBACK_COLORS);
          return;
        }

        const primary = sorted[0];
        const secondary = sorted[1] || primary;
        resolve([
          toHex(...vivify(primary.r / primary.count, primary.g / primary.count, primary.b / primary.count)),
          toHex(...vivify(secondary.r / secondary.count, secondary.g / secondary.count, secondary.b / secondary.count)),
        ]);
      } catch {
        resolve(FALLBACK_COLORS);
      }
    };

    img.onerror = () => resolve(FALLBACK_COLORS);
    img.src = url;
  });
}
