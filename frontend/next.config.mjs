import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output so the app ships as a self-contained server for Cloud Run.
  output: "standalone",
  // Pin the workspace root. A stray lockfile in the home dir otherwise
  // confuses Turbopack's root inference.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
