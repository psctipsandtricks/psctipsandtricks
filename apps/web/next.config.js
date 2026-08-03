/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@psc/ui', '@psc/shared-types'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
    ],
  },
};

module.exports = nextConfig;
