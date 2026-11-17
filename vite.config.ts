import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// theorygambit.github.io is a GitHub user/org page, so it is always served from the domain root.
export default defineConfig({
  plugins: [react()],
  base: "/",
  build: { target: "es2023", sourcemap: false },
});
