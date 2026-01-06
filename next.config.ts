import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Explicitly set the project root to avoid turbopack picking a parent lockfile.
    root: __dirname,
  },
};

export default nextConfig;
