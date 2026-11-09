import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";

// Monaco's ESM sources, reached directly so we can import only the parts we use.
const monacoEsm = fileURLToPath(new URL("../../node_modules/monaco-editor/esm/vs", import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Our own service worker, so it can handle push notifications later.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "prompt",
      injectRegister: false,
      injectManifest: {
        // Monaco is large; it is precached so the editor works offline.
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2,ttf}"],
      },
      devOptions: { enabled: false, type: "module" },
      manifest: {
        name: "DSA Atlas",
        short_name: "DSA Atlas",
        description: "Your DSA notebook: brute force → optimal, complexity graphs and language comparisons.",
        theme_color: "#0a0e1a",
        background_color: "#0a0e1a",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  resolve: { alias: [{ find: /^monaco-esm\//, replacement: monacoEsm + "/" }] },
  worker: { format: "es" },
});
