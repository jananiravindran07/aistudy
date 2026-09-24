import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Keep native Node packages un-bundled so they run via require at runtime
  // (the `pg` driver, Prisma's pg adapter, and PDF text extraction).
  serverExternalPackages: ['pg', '@prisma/adapter-pg', 'pdf-parse', 'pdfjs-dist'],
};

export default nextConfig;