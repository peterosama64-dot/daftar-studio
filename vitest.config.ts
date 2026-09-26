import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Same "@/…" import alias as tsconfig, so route files can be tested directly.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
