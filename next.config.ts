import type { NextConfig } from "next";
// `output: 'standalone'` lets the self-hosted Docker image ship a minimal
// server bundle (see self-host/). Vercel ignores it, so this is safe for both.
// `outputFileTracingIncludes` makes sure Nessie's persona markdown (/nessie)
// is bundled with the server routes that read it at runtime.
const nextConfig: NextConfig = {
  output: "standalone",
  images: { unoptimized: true },
  outputFileTracingIncludes: {
    "/api/**/*": ["./nessie/**/*.md"],
  },
};
export default nextConfig;
