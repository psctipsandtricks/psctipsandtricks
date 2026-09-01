// pdfjs-dist's worker is normally referenced via `new URL(..., import.meta.url)`,
// which makes webpack emit it as a build asset and — for reasons specific to
// this repo's webpack config (pdfjs-dist aliased to its own pre-minified
// bundle) — also run it through Terser during production builds. Terser
// chokes on the worker's `import.meta` usage ("cannot be used outside of
// module code"), failing the production build entirely.
//
// Sidestepping that: copy the worker straight into public/ at install/build
// time and reference it as a plain static path (see reader-pdf-viewer.tsx),
// so it's served as-is and never touched by webpack's JS optimizer.
//
// The CMaps and standard fonts are copied for a different reason: they must
// come from the *same* pdfjs-dist version as the worker. Sourcing them from a
// CDN at a hardcoded version silently drifts every time this package is
// upgraded, and a mismatch shows up as missing glyphs rather than an error.
// Copying them from the installed package keeps all three locked together.
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const pdfjsRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));

fs.mkdirSync(publicDir, { recursive: true });

const workerSrc = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs');
const workerDest = path.join(publicDir, 'pdf.worker.min.mjs');
fs.copyFileSync(workerSrc, workerDest);
console.log(`Copied pdf.worker.min.mjs -> ${path.relative(process.cwd(), workerDest)}`);

// Character maps (non-Latin scripts) and the 14 standard PDF fonts, fetched by
// pdf.js on demand — only for documents that actually reference them.
for (const asset of ['cmaps', 'standard_fonts']) {
  const src = path.join(pdfjsRoot, asset);
  if (!fs.existsSync(src)) {
    throw new Error(
      `pdfjs-dist is missing its "${asset}" directory at ${src}. The reader ` +
        `serves these itself, so a build without them would render some PDFs ` +
        `with missing glyphs instead of failing outright.`
    );
  }
  const dest = path.join(publicDir, 'pdfjs', asset);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log(`Copied ${asset}/ -> ${path.relative(process.cwd(), dest)}`);
}
