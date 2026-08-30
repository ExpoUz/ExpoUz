/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOW-FROM https://web.telegram.org' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self' https://web.telegram.org" },
        ],
      },
    ];
  },
};

export default nextConfig;
