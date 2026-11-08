import type { NextConfig } from 'next';

/**
 * Files named `*.local.tsx` are private tools for one machine. They are
 * gitignored, never uploaded, and treated as pages only under `next dev`, so
 * no production build can ever contain them.
 */
const LOCAL_PAGES = process.env.NODE_ENV === 'development' ? ['local.tsx'] : [];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  pageExtensions: [...LOCAL_PAGES, 'tsx', 'ts', 'jsx', 'js'],
  // The whole site is static: no database, no backend, no server rendering at
  // request time. `next build` emits plain HTML/JS to out/ for any static host.
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  typedRoutes: true,
};

export default nextConfig;
