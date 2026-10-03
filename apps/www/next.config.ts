import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
