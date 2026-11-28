import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts", "scripts/**/*.test.ts"],
    // Vitest empties CSS by default, even with `?raw`. contrast.test.ts reads the colour tokens.
    css: { include: [/apps\/web\/src\/tokens\.css/] },
  },
});
