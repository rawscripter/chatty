import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      cheerio: "cheerio/dist/commonjs/index.js",
    };
    return config;
  },
};

export default nextConfig;
