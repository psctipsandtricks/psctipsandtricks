/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@psc/ui', '@psc/shared-types'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
      // Book covers, group images, and other uploads served from Supabase
      // Storage — required before any page can adopt next/image for them.
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
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
