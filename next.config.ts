import type { NextConfig } from "next";
// `output: 'standalone'` lets the self-hosted Docker image ship a minimal
// server bundle (see self-host/). Vercel ignores it, so this is safe for both.
const nextConfig: NextConfig = { output: "standalone", images: { unoptimized: true } };
export default nextConfig;
