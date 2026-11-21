import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root so a stray package-lock.json in a parent folder
  // (for example C:\Users\you) is never picked up.
  turbopack: { root: root },
};
export default nextConfig;
