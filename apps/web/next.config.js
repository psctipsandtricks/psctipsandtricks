/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@psc/ui', '@psc/shared-types'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
    ],
  },
  webpack: (config) => {
    // react-pdf/pdfjs-dist pull in a Node "canvas" fallback that isn't needed (and isn't installed) in the browser bundle.
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    // pdfjs-dist's default build (build/pdf.mjs) is itself a webpack bundle
    // that declares its own top-level `var __webpack_require__ = {}` — inside
    // Next's own webpack that name is already the module wrapper's injected
    // parameter, so pdfjs's declaration silently clobbers it and later calls
    // like `__webpack_require__.r(exports)` blow up with "Object.
    // defineProperty called on non-object". The minified build renames that
    // internal variable, so the collision disappears.
    config.resolve.alias['pdfjs-dist$'] = 'pdfjs-dist/build/pdf.min.mjs';
    return config;
  },
};

module.exports = nextConfig;
