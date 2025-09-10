import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Silence workspace root inference warning by explicitly setting tracing root
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
