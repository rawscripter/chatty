import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      cheerio: "cheerio/dist/commonjs/index.js",
    },
  },
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
