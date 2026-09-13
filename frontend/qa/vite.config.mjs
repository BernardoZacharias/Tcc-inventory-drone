import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Separate, local-only visual fixture server. The normal build never uses these aliases.
export default defineConfig({
  plugins: [
    {
      name: "isolated-ui-fixtures",
      enforce: "pre",
      resolveId(source) {
        if (/\/services\/api(?:\.js)?$/.test(source)) return fileURLToPath(new URL("./api.js", import.meta.url));
        if (/\/utils\/auth(?:\.js)?$/.test(source)) return fileURLToPath(new URL("./auth.js", import.meta.url));
      },
    },
    react(),
  ],
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
});
