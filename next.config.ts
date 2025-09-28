import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  // Подавляем предупреждения React для внешних библиотек
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Подавляем предупреждения о устаревших методах жизненного цикла
      config.ignoreWarnings = [
        /UNSAFE_componentWillReceiveProps/,
        /ModelCollapse/,
        /OperationContainer/,
      ];
    }
    return config;
  },
};

export default nextConfig;
