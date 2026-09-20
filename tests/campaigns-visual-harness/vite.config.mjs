import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const aqui = fileURLToPath(new URL(".", import.meta.url));
const repositorio = fileURLToPath(new URL("../..", import.meta.url));
export default defineConfig({ root: aqui, plugins: [react()], server: { host: "127.0.0.1", port: 4195, strictPort: true, fs: { allow: [repositorio] } } });
