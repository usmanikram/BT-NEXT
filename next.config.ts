import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Legacy month-scoped pages → unified transactions list
      { source: "/income", destination: "/transactions?kind=income", permanent: false },
      { source: "/income/new", destination: "/transactions/new?kind=income", permanent: false },
      { source: "/expenses", destination: "/transactions?kind=expense", permanent: false },
      { source: "/expenses/new", destination: "/transactions/new?kind=expense", permanent: false },
    ];
  },
};

export default nextConfig;
