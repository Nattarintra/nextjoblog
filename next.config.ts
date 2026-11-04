import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Supabase redirects recovery links to NEXT_PUBLIC_SITE_URL (127.0.0.1 in E2E),
  // a different origin from `localhost`; without this the dev server blocks
  // that origin's /_next assets and the reset page never hydrates.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
