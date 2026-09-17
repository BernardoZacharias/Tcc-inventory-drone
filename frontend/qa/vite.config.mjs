import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
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
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (!req.url.startsWith("/__qa/api/")) return next();
          // No credentials are read, persisted or forwarded. All writes fail.
          const error = req.url.includes("/error/");
          const login = req.url.endsWith("/auth/login");
          const timer = setTimeout(() => {
            res.statusCode = error ? 503 : login ? 401 : req.method === "GET" ? 200 : 405;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: res.statusCode === 200, data: [] }));
          }, req.url.includes("/loading/") ? 12000 : 300);
          res.on("close", () => clearTimeout(timer));
        });
      },
    },
    react(),
    tailwindcss(),
  ],
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
});
