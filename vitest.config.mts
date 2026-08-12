import { defineConfig } from "vitest/config";

// Keep date-sensitive tests in a known non-UTC local frame. WhatsApp exports
// contain naive wall-clock timestamps, so production code must never infer UTC.
process.env.TZ = "Asia/Kolkata";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.spec.ts"],
  },
});
