import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // workspace packages ship TypeScript sources without a build step
  transpilePackages: ["@evermore/core", "@evermore/world"],
};

export default nextConfig;
