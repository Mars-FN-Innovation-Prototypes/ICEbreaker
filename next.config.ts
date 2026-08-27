import type { NextConfig } from "next";

const basePath = process.env.ICEBREAKER_BASE_PATH || "";

const nextConfig: NextConfig = {
  basePath,
};

export default nextConfig;
