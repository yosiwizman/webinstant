import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep tracing root as before
  outputFileTracingRoot: path.join(__dirname),
  // Do not set assetPrefix in dev; leave undefined
  // assetPrefix: undefined,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
    ],
  },
  async redirects() {
    return [
      { source: '/', destination: '/admin', permanent: false },
    ];
  },
  async rewrites() {
    // No catch-all rewrites; do not touch /_next or /api
    return [];
  },
  async headers() {
    const previewCsp = [
      "default-src 'self'",
      "img-src * data: blob:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "frame-ancestors 'self'",
    ].join('; ');
    return [
      {
        source: "/preview/:path*",
        headers: [
          { key: "Content-Security-Policy", value: previewCsp },
        ],
      },
    ];
  },
};

export default nextConfig;
