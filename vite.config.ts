import { copyFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// theorygambit.github.io is a GitHub user/org page, so it is always served from the domain root.
export default defineConfig({
  plugins: [
    react(),
    {
      // GitHub Pages serves 404.html for unknown paths. Making it a copy of index.html is what
      // lets clean links such as /g/matching-pennies open the app directly.
      name: "spa-404-fallback",
      apply: "build",
      closeBundle() {
        copyFileSync("dist/index.html", "dist/404.html");
      },
    },
  ],
  base: "/",
  build: { target: "es2023", sourcemap: false },
});
