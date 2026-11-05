import type { NextConfig } from "next";

import { RESET_PASSWORD_PATH } from "./lib/auth/paths";

const nextConfig: NextConfig = {
  // Supabase redirects recovery links to NEXT_PUBLIC_SITE_URL (127.0.0.1 in E2E),
  // a different origin from `localhost`; without this the dev server blocks
  // that origin's /_next assets and the reset page never hydrates.
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
      {
        // The reset link carries tokens; keep the page out of caches and
        // never leak its URL through the Referer header.
        source: RESET_PASSWORD_PATH,
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
