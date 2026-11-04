import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  // Dynamic's wallet SDK ships native .node MPC binaries — keep it out of the
  // webpack bundle so it's require()'d directly from node_modules at runtime.
  serverExternalPackages: ["@dynamic-labs-wallet/node", "@dynamic-labs-wallet/node-evm"],
  // The disclosure routes read the registry from disk at runtime (src/disclosure/config.ts),
  // which file tracing can't see. Ship it with them.
  outputFileTracingIncludes: {
    "/api/v1/disclosure/**": ["./config/zquent-registry.json"],
  },
  webpack: (config, { isServer }) => {
    // Only stub these for the browser bundle (snarkjs/circomlibjs pull them in
    // transitively). The server needs the real fs/path/crypto.
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
