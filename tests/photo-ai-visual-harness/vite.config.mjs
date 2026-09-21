import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const here = fileURLToPath(new URL(".", import.meta.url));
const repository = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  root: here,
  plugins: [react()],
  resolve: {
    alias: {
      "../../lib/supabase/browser": fileURLToPath(new URL("./mock-supabase.ts", import.meta.url)),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 4195,
    strictPort: true,
    fs: { allow: [repository] },
  },
});
