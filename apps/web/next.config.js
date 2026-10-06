/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  compress: true,
  transpilePackages: ['@psc/ui', '@psc/shared-types'],
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
      // Book covers, group images, and other uploads served from Supabase
      // Storage — required before any page can adopt next/image for them.
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
      // The admin shell is a client layout and can't export `robots` metadata,
      // so keep it out of the index at the header level.
      {
        source: '/admin/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/admin',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/:file(icon-192.png|icon-512.png|apple-touch-icon.png|favicon.ico|favicon-16x16.png|favicon-32x32.png|icon.svg|logo.svg)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }],
      },
    ];
  },
  experimental: {
    // lucide-react and recharts are both barrel-exported packages; this
    // rewrites imports so only the icons/chart pieces actually used are
    // pulled into each route's bundle instead of the whole package graph.
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
  webpack: (config, { isServer }) => {
    // react-pdf/pdfjs-dist pull in a Node "canvas" fallback that isn't needed (and isn't installed) in the browser bundle.
    if (!isServer) {
      config.resolve.alias.canvas = false;
      config.resolve.alias.encoding = false;
      config.resolve.alias['pdfjs-dist$'] = 'pdfjs-dist/build/pdf.min.mjs';
    }
    return config;
  },
};

module.exports = nextConfig;
