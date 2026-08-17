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
const fs = require('fs');
const path = require('path');

const src = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs');
const destDir = path.join(__dirname, '..', 'public');
const dest = path.join(destDir, 'pdf.worker.min.mjs');

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`Copied pdf.worker.min.mjs -> ${path.relative(process.cwd(), dest)}`);
