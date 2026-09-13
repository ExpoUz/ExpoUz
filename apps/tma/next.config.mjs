/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" is required for the Docker build; on Vercel it breaks route→lambda mapping, so skip it there.
  output: process.env.VERCEL ? undefined : "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "t.me" },
    ],
  },
};

export default nextConfig;
