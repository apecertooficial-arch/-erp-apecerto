import React from "react";
import { createRoot } from "react-dom/client";
import "../../app/globals.css";
import "../../app/styles/apecerto-identidade.css";
import "../../app/styles/redesign-apecerto.css";
import "../../app/styles/produtos-v3-detail.css";
import { PhotoAiOrganizer } from "../../app/features/products/PhotoAiOrganizer";

const requests: Array<{ method: string; path: string; blocked: boolean }> = [];
const evidence = document.createElement("script");
evidence.id = "photo-ai-harness-evidence";
evidence.type = "application/json";
evidence.textContent = "[]";
document.head.append(evidence);

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = input instanceof Request ? input : null;
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.href);
  requests.push({ method: String(init?.method ?? request?.method ?? "GET").toUpperCase(), path: url.pathname, blocked: true });
  evidence.textContent = JSON.stringify(requests);
  return new Response(JSON.stringify({ error: "Harness visual: mutações bloqueadas." }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
};

const svg = (title: string, start: string, end: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="440"><defs><linearGradient id="g"><stop stop-color="${start}"/><stop offset="1" stop-color="${end}"/></linearGradient></defs><rect width="640" height="440" rx="28" fill="url(#g)"/><path d="M0 360 180 190l120 105 110-85 230 190H0Z" fill="rgba(255,255,255,.24)"/><text x="34" y="62" fill="white" font-family="sans-serif" font-size="28" font-weight="700">${title}</text></svg>`)}`;
const photos = [
  { id: "photo-1", url: svg("Sala", "#fd7138", "#7526f2"), categoria: "Sala", nome: "Sala", alt_text: "Sala de demonstração", is_capa: true, ordem: 0 },
  { id: "photo-2", url: svg("Cozinha", "#1b91ff", "#5b34da"), categoria: "Cozinha", nome: "Cozinha", alt_text: "Cozinha de demonstração", is_capa: false, ordem: 1 },
  { id: "photo-3", url: svg("Varanda", "#ff9b3d", "#db3974"), categoria: "Varanda", nome: "Varanda", alt_text: "Varanda de demonstração", is_capa: false, ordem: 2 },
];

document.documentElement.dataset.visualHarness = "photo-ai-sanitizado";
createRoot(document.getElementById("root")!).render(
  <main className="visual-photo-page">
    <header><span>Produtos · Galeria</span><h1>Organização assistida</h1><p>Ambiente local sanitizado; nenhuma imagem sai deste navegador.</p></header>
    <PhotoAiOrganizer productId="00000000-0000-4000-8000-000000000001" propertyType="apartamento" photos={photos} accessToken="fixture" onApplied={async () => undefined} />
  </main>,
);
