/**
 * Image dimension and aspect-ratio validation utility for Book covers.
 */

export interface ImageDimensionResult {
  valid: boolean;
  width: number;
  height: number;
  detectedRatio: string;
  errorMessage?: string;
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function formatAspectRatio(width: number, height: number): string {
  if (!width || !height) return '';
  const divisor = gcd(Math.round(width), Math.round(height));
  const rW = Math.round(width / divisor);
  const rH = Math.round(height / divisor);

  // If simplified numbers are small enough (<= 20), show direct ratio
  if (rW <= 20 && rH <= 20) {
    return `${rW}:${rH}`;
  }

  // Check known standard ratios
  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.04) return '16:9';
  if (Math.abs(ratio - 2 / 3) < 0.04) return '2:3';
  if (Math.abs(ratio - 3 / 2) < 0.04) return '3:2';
  if (Math.abs(ratio - 4 / 3) < 0.04) return '4:3';
  if (Math.abs(ratio - 1) < 0.04) return '1:1';
  if (Math.abs(ratio - 9 / 16) < 0.04) return '9:16';

  return `${ratio.toFixed(2)}:1`;
}

/**
 * Loads an image file and retrieves its natural pixel dimensions.
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    // Check supported MIME type
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Selected file is not an image. Please upload a JPG, PNG, or WEBP file.'));
    }

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      } else {
        reject(new Error('Invalid image dimensions detected.'));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not process image. Please make sure the file is a valid JPG, PNG, or WEBP image.'));
    };

    img.src = url;
  });
}

/**
 * Validates Catalog Cover:
 * - 16:9 landscape aspect ratio (tolerance +/- 0.035)
 * - Recommended: 1280 x 720 px
 * - Max size: 5MB
 */
export async function validateCatalogCover(file: File): Promise<ImageDimensionResult> {
  if (file.size > MAX_IMAGE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      width: 0,
      height: 0,
      detectedRatio: '',
      errorMessage: `File size (${sizeMb} MB) exceeds the 5MB limit.`,
    };
  }

  try {
    const { width, height } = await getImageDimensions(file);
    const ratio = width / height;
    const targetRatio = 16 / 9; // ~1.7777
    const detectedRatio = formatAspectRatio(width, height);

    // Tolerance for minor pixel rounding (e.g. 1920x1080 is 1.7777, 1280x720 is 1.7777)
    if (Math.abs(ratio - targetRatio) > 0.035) {
      return {
        valid: false,
        width,
        height,
        detectedRatio,
        errorMessage: `Detected ${width} × ${height} px (${detectedRatio}). Required: 16:9 landscape aspect ratio (Recommended 1280 × 720 px).`,
      };
    }

    return {
      valid: true,
      width,
      height,
      detectedRatio: '16:9',
    };
  } catch (err: any) {
    return {
      valid: false,
      width: 0,
      height: 0,
      detectedRatio: '',
      errorMessage: err.message || 'Failed to inspect image dimensions.',
    };
  }
}

/**
 * Validates Book Size Hero Cover:
 * - 2:3 portrait aspect ratio (tolerance +/- 0.035)
 * - Recommended: 1024 x 1536 px
 * - Max size: 5MB
 */
export async function validateHeroCover(file: File): Promise<ImageDimensionResult> {
  if (file.size > MAX_IMAGE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      width: 0,
      height: 0,
      detectedRatio: '',
      errorMessage: `File size (${sizeMb} MB) exceeds the 5MB limit.`,
    };
  }

  try {
    const { width, height } = await getImageDimensions(file);
    const ratio = width / height;
    const targetRatio = 2 / 3; // ~0.6666
    const detectedRatio = formatAspectRatio(width, height);

    // Tolerance for minor pixel rounding (e.g. 1024x1536 is 0.6666, 600x900 is 0.6666)
    if (Math.abs(ratio - targetRatio) > 0.035) {
      return {
        valid: false,
        width,
        height,
        detectedRatio,
        errorMessage: `Detected ${width} × ${height} px (${detectedRatio}). Required: 2:3 portrait aspect ratio (Recommended 1024 × 1536 px).`,
      };
    }

    return {
      valid: true,
      width,
      height,
      detectedRatio: '2:3',
    };
  } catch (err: any) {
    return {
      valid: false,
      width: 0,
      height: 0,
      detectedRatio: '',
      errorMessage: err.message || 'Failed to inspect image dimensions.',
    };
  }
}

/**
 * Validates Quiz Cover:
 * - 16:9 landscape aspect ratio (tolerance +/- 0.035)
 * - Recommended: 1280 x 720 px
 * - Max size: 5MB
 */
export async function validateQuizCover(file: File): Promise<ImageDimensionResult> {
  return validateCatalogCover(file);
}

