import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectDirectory = resolve(frontendDirectory, "..");
const source = resolve(projectDirectory, "reference/CRM_ApeCerto_FINAL.html");
const destination = resolve(frontendDirectory, "public/legacy/CRM_ApeCerto_FINAL.html");

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);

console.log("HTML final original sincronizado.");
