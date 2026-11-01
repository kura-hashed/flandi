/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: [
    "192.168.1.248",
    "192.168.1.249",
    "localhost",
    "127.0.0.1",
  ],
  serverExternalPackages: ["tesseract.js", "tesseract.js-core", "sharp"],
  poweredByHeader: false, // Security: Ẩn header X-Powered-By: Next.js
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
