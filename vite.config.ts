import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Icons are intentionally missing: the logo/wordmark is a design task (docs/questions.md Q147).
      // Until then the app works as a website; it becomes installable once icons exist.
      manifest: {
        name: "Gitara",
        short_name: "Gitara",
        description: "All-in-one jamming utility app for guitarists.",
        theme_color: "#0B1014",
        background_color: "#0B1014",
        display: "standalone",
        orientation: "any",
        start_url: "/",
      },
      workbox: {
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,woff2,svg}"],
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
