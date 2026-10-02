import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // The HTTP tests talk to a loopback server; a corporate/agent proxy in the
    // environment would otherwise intercept those requests and fail them.
    env: { NO_PROXY: "*", no_proxy: "*" },
  },
});
