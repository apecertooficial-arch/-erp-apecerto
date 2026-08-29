import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const aqui = fileURLToPath(new URL(".", import.meta.url));
const repositorio = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  root: aqui,
  plugins: [react()],
  resolve: {
    alias: {
      "next/link": fileURLToPath(new URL("./next-link.tsx", import.meta.url)),
      "next/navigation": fileURLToPath(new URL("./next-navigation.ts", import.meta.url)),
    },
  },
  define: {
    "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify("http://127.0.0.1.invalid"),
    "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": JSON.stringify("harness-public-key"),
  },
  server: {
    host: "127.0.0.1",
    port: 4180,
    strictPort: true,
    fs: { allow: [repositorio] },
  },
});
