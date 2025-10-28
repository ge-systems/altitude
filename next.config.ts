import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
    serverSourceMaps: false,
    browserDebugInfoInTerminal: true,
    webpackMemoryOptimizations: true,
  },
  devIndicators: false,
  compress: true,
  poweredByHeader: false,
  generateEtags: false,
};

export default nextConfig;
