import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    globals: false,
    testTimeout: 60_000, // real Groth16 proofs and Poseidon setup are slow on small CPUs
    hookTimeout: 60_000, // beforeAll builds Poseidon and deals keys; slow CPUs need headroom
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
