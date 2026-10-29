import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  // A new service worker per deploy (public/sw.js?v=...), which drops the previous offline cache.
  env: { NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? String(Date.now()) },
  // Basic hardening (docs/lgpd/ripd.md, R8): no framing, no MIME sniffing, no referrer to the source
  // sites, and only the microphone (voice dictation) among the powerful browser features.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
