import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {},
  // The persistent main preview needs reliable invalidation after Git checkouts.
  webpack: (config, { dev }) => {
    if (dev && process.env.PREVIEW_MAIN === "1") {
      config.watchOptions = { ...config.watchOptions, poll: 1000 };
    }
    return config;
  },
  // Moodboards are read from the canonical documents at request time.
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  outputFileTracingIncludes: {
    "/moodboards": ["../../docs/art/moodboards/**/*", "./.moodboards/**/*"],
    "/moodboards/**": ["../../docs/art/moodboards/**/*", "./.moodboards/**/*"],
  },
  // workspace packages ship TypeScript sources without a build step
  transpilePackages: ["@evermore/core", "@evermore/world"],
};

export default nextConfig;
