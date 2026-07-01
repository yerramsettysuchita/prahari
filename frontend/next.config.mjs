import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export so the app ships as plain files for Firebase Hosting (free,
  // no billing). The app is fully client rendered and talks to the backend API,
  // so no server runtime is needed.
  output: "export",
  images: { unoptimized: true },
  // Pin the workspace root. A stray lockfile in the home dir otherwise
  // confuses Turbopack's root inference.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
