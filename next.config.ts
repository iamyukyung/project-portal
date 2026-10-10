import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    // The dev-only route indicator defaults to bottom-left, which is exactly
    // where the desktop minimap sits. Moved rather than disabled so it is
    // still there when it is useful.
    position: "bottom-right",
  },
};

export default nextConfig;
