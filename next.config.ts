import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**',
          '**/public/photos/**',
          '**/debug_watcher.txt',
          '**/sync_map.json',
          '**/local-service/current_event.json'
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
