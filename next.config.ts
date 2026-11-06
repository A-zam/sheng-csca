import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The whole site is static: no database, no backend, no server rendering at
  // request time. `next build` emits plain HTML/JS to out/ for any static host.
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  typedRoutes: true,
};

export default nextConfig;
