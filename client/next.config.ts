import type { NextConfig } from "next";

/** Địa chỉ server khi deploy, vd https://kanban-api.onrender.com — để trống khi chạy dev. */
const apiProxyTarget = process.env.API_PROXY_TARGET;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Trình duyệt gọi /api/... trên chính domain của client → Next.js chuyển tiếp sang server.
    // Cookie đăng nhập vì thế là cookie cùng domain, trình duyệt không chặn.
    if (!apiProxyTarget) return [];
    return [
      { source: "/api/:path*", destination: `${apiProxyTarget}/api/:path*` },
    ];
  },
};

export default nextConfig;
