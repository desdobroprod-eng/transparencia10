import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/transparencia10",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
