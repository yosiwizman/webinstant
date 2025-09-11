import type { NextConfig } from "next";
import path from "path";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep tracing root as before
  outputFileTracingRoot: path.join(__dirname),
  // Do not set assetPrefix in dev; leave undefined
  // assetPrefix: isProd ? undefined : undefined,
  experimental: {
    appDir: true,
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
  // If you add headers or middleware, ensure they skip /_next/* and /api/*
};

export default nextConfig;
