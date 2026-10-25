/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ["192.168.1.248", "localhost", "127.0.0.1"],
};

export default nextConfig;
