import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Explicitly set the project root to avoid turbopack picking a parent lockfile.
    root: __dirname,
  },

  // 旧URL → 新URL へのリダイレクト（308: 恒久リダイレクト）
  async redirects() {
    return [
      // Chef旧URL
      {
        source: '/recipes',
        destination: '/app/chef/recipes',
        permanent: true,
      },
      {
        source: '/planning',
        destination: '/app/chef/planning',
        permanent: true,
      },
      {
        source: '/daily-menu',
        destination: '/app/chef/daily-menu',
        permanent: true,
      },
      {
        source: '/feedback',
        destination: '/app/chef/feedback',
        permanent: true,
      },
      {
        source: '/feedback-summary',
        destination: '/app/chef/feedback/summary',
        permanent: true,
      },
      {
        source: '/procurement',
        destination: '/app/chef/procurement',
        permanent: true,
      },

      // Manager旧URL
      {
        source: '/manager/dashboard',
        destination: '/app/manager/dashboard',
        permanent: true,
      },
      {
        source: '/manager/vessels',
        destination: '/app/manager/vessels',
        permanent: true,
      },
      {
        source: '/manager/vessels/:vesselId',
        destination: '/app/manager/vessels/:vesselId',
        permanent: true,
      },
      {
        source: '/manager/insights',
        destination: '/app/manager/insights',
        permanent: true,
      },
      {
        source: '/manager/executive/summary',
        destination: '/app/manager/executive/summary',
        permanent: true,
      },
      {
        source: '/manager/settings',
        destination: '/app/manager/settings',
        permanent: true,
      },
      {
        source: '/manager/settings/users',
        destination: '/app/manager/settings/users',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

