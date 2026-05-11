import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim();

const config: NextConfig = {
  basePath: basePath && basePath !== "/" ? basePath : undefined,
  experimental: {
    typedRoutes: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "images.beehiiv.com" },
    ],
  },
};

export default config;
