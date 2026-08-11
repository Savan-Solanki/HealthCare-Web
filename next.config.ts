import type { NextConfig } from "next";

const productionApiOrigin = "http://13.205.6.9:5001";

const normalizeApiOrigin = (value?: string) => {
  const configured = value?.trim();

  if (!configured || configured.startsWith("/")) {
    return productionApiOrigin;
  }

  return configured.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");
};

const backendOrigin = normalizeApiOrigin(process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL);
const backendWsOrigin = backendOrigin.replace(/^http/, 'ws');

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "**.s3.**.amazonaws.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googleapis.com https://*.gstatic.com https://challenges.cloudflare.com https://accounts.google.com https://*.google.com https://play.google.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "media-src 'self' data: blob:",
              `img-src 'self' data: blob: https://*.amazonaws.com https://s3.amazonaws.com ${backendOrigin}`,
              `connect-src 'self' http://localhost:* https://localhost:* ws://localhost:* wss://localhost:* ${backendOrigin} ${backendWsOrigin} https://*.amazonaws.com https://s3.amazonaws.com https://*.googleapis.com https://fcm.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://challenges.cloudflare.com https://accounts.google.com https://play.google.com https://*.google.com`,
              "frame-src 'self' https://challenges.cloudflare.com https://accounts.google.com https://play.google.com https://*.google.com",
              "worker-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/super-admin",
        destination: "/medkwik-control-center",
        permanent: false,
      },
      {
        source: "/super-admin/:path*",
        destination: "/medkwik-control-center/:path*",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendOrigin}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
