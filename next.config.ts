import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // A memo and its attachments arrive as one Server Action request, and the
      // default ceiling for those is 1 MB — well under the 4 MB per file this
      // app accepts, so every real attachment was rejected with a 413 before any
      // of our own validation ran. 4.5 MB is as high as this is worth setting:
      // Vercel refuses a larger request body at the platform edge regardless.
      bodySizeLimit: '4.5mb',
    },
  },
};

export default nextConfig;
