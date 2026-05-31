// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import vercel from "@astrojs/vercel";

// https://astro.build/config
export default defineConfig({
  // Pages stay static; only the /api/* routes run on-demand (prerender = false).
  output: "static",
  adapter: vercel(),
  integrations: [react()],
  site: "https://strided.dev", // TODO: confirm production domain
});
