import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lane E owns stacks/nextjs only. Everything the app needs lives here.
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
