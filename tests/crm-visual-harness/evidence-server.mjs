import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const porta = 4181;
const rodada = process.env.CRM_HARNESS_EVIDENCE_DIR ?? "visual-round-2";
if (!/^visual-round-[a-z0-9-]+$/i.test(rodada)) throw new Error("Diretório de evidência inválido.");
const destino = fileURLToPath(new URL(`../../deliverables/crm-correcao-6-2-para-10/${rodada}/`, import.meta.url));
await mkdir(destino, { recursive: true });

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${porta}`);
  const nome = url.searchParams.get("name") ?? "";
  const cors = { "Access-Control-Allow-Origin": "http://127.0.0.1:4180" };
  if (request.method === "OPTIONS") {
    response.writeHead(204, { ...cors, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" }).end();
    return;
  }
  if (request.method !== "POST" || !/^[a-z0-9][a-z0-9._-]{0,119}$/i.test(nome)) {
    response.writeHead(400, cors).end("requisição inválida");
    return;
  }
  const partes = [];
  for await (const parte of request) partes.push(parte);
  const conteudo = Buffer.concat(partes);
  if (conteudo.length > 12_000_000) {
    response.writeHead(413, cors).end("evidência excede 12 MB");
    return;
  }
  await writeFile(path.join(destino, nome), conteudo);
  response.writeHead(201, { ...cors, "Content-Type": "application/json" });
  response.end(JSON.stringify({ nome, bytes: conteudo.length }));
}).listen(porta, "127.0.0.1", () => {
  process.stdout.write(`Evidence sink: http://127.0.0.1:${porta}\n`);
});
