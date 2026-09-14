import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    cpus: 1,
    workerThreads: true,
  },
  typescript: {
    // The build script runs `tsc --noEmit` before Next.js compiles the app.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
