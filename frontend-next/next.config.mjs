/** @type {import('next').NextConfig} */
const backendUrl = (process.env.BACKEND_URL || 'http://localhost:9753').replace(/\/$/, '');
const isDevelopment = process.env.NODE_ENV !== 'production';

const nextConfig = {
  ...(isDevelopment ? {} : { output: 'export' }),
  ...(isDevelopment
    ? { trailingSlash: false, skipTrailingSlashRedirect: true }
    : { trailingSlash: true, skipTrailingSlashRedirect: true }),
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  ...(isDevelopment
    ? {
        async rewrites() {
          return [
            {
              source: '/api/:path*',
              destination: `${backendUrl}/api/:path*`,
            },
            {
              source: '/socket.io',
              destination: `${backendUrl}/socket.io/`,
            },
            {
              source: '/socket.io/',
              destination: `${backendUrl}/socket.io`,
            },
            {
              source: '/socket.io/:path*',
              destination: `${backendUrl}/socket.io/:path*`,
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;
