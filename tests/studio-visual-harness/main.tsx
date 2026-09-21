import React from "react";
import { createRoot } from "react-dom/client";
import "../../app/globals.css";
import "../../app/styles/apecerto-identidade.css";
import "../../app/styles/apecerto-studio.css";
import { StudioModule } from "../../app/features/studio/StudioModule";
import { STUDIO_ORGANIZATION_ID, STUDIO_TIMEZONE, type StudioData } from "../../app/features/studio/domain";

const evidence = document.createElement("script");
evidence.id = "studio-harness-evidence";
evidence.type = "application/json";
evidence.textContent = "[]";
document.head.append(evidence);

const blocked: Array<{ kind: string; action: string }> = [];
const record = (kind: string, action: string) => {
  blocked.push({ kind, action });
  evidence.textContent = JSON.stringify(blocked);
};

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = input instanceof Request ? input : null;
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.href);
  record("fetch", `${String(init?.method ?? request?.method ?? "GET").toUpperCase()} ${url.pathname}`);
  return new Response(JSON.stringify({ error: "Harness visual: rede bloqueada." }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
};

const ids = {
  campaign: "00000000-0000-4000-8000-000000000101",
  snapshot: "00000000-0000-4000-8000-000000000102",
  brief: "00000000-0000-4000-8000-000000000103",
  feed: "00000000-0000-4000-8000-000000000111",
  carousel: "00000000-0000-4000-8000-000000000112",
  story: "00000000-0000-4000-8000-000000000113",
  reel: "00000000-0000-4000-8000-000000000114",
  feedVersion: "00000000-0000-4000-8000-000000000121",
  carouselVersion: "00000000-0000-4000-8000-000000000122",
  storyVersion: "00000000-0000-4000-8000-000000000123",
  reelVersion: "00000000-0000-4000-8000-000000000124",
};

const svg = (label: string, start: string, end: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><defs><linearGradient id="g"><stop stop-color="${start}"/><stop offset="1" stop-color="${end}"/></linearGradient></defs><rect width="1080" height="1350" fill="url(#g)"/><path d="M0 1080 320 700l190 170 190-120 380 390v210H0Z" fill="rgba(255,255,255,.2)"/><text x="70" y="120" fill="white" font-family="sans-serif" font-size="58" font-weight="700">${label}</text></svg>`)}`;

const cover = svg("Residencial Horizonte", "#7b35dc", "#f9733d");
const versions = [
  [ids.feedVersion, ids.feed, "feed"],
  [ids.carouselVersion, ids.carousel, "carousel"],
  [ids.storyVersion, ids.story, "story"],
  [ids.reelVersion, ids.reel, "reel"],
] as const;

const data: StudioData = {
  organizationId: STUDIO_ORGANIZATION_ID,
  timezone: STUDIO_TIMEZONE,
  externalActionsEnabled: false,
  campaigns: [{
    id: ids.campaign,
    nome: "Lançamento Residencial Horizonte",
    objetivo: "Apresentar o imóvel com clareza e gerar conversas qualificadas.",
    periodo_inicio: "2026-09-21",
    periodo_fim: "2026-10-20",
    status: "em_producao",
    produto_codigo: "DEMO-101",
    produto_alterado_em: null,
    produto_alterado_motivo: null,
    snapshot_atual_id: ids.snapshot,
    budget_usd: 0,
    gasto_usd: 0,
    atualizado_em: "2026-09-21T12:00:00Z",
  }],
  snapshots: [{
    id: ids.snapshot,
    campaign_id: ids.campaign,
    versao: 1,
    produto_codigo: "DEMO-101",
    fatos: { titulo: "Residencial Horizonte", bairro: "Bairro demonstrativo", dormitorios: 3, vagas: 2, preco: "Sob consulta" },
    midias: [{ url: cover, tipo: "imagem", descricao: "Imagem sanitizada de demonstração" }],
    checksum: "a".repeat(64),
    criado_em: "2026-09-21T12:00:00Z",
  }],
  pieces: [
    { id: ids.feed, campaign_id: ids.campaign, formato: "feed", titulo: "Apresentação do imóvel", status: "aprovada", current_version_id: ids.feedVersion, atualizado_em: "2026-09-21T13:00:00Z" },
    { id: ids.carousel, campaign_id: ids.campaign, formato: "carousel", titulo: "Destaques em sequência", status: "em_revisao", current_version_id: ids.carouselVersion, atualizado_em: "2026-09-21T13:05:00Z" },
    { id: ids.story, campaign_id: ids.campaign, formato: "story", titulo: "Convite para conhecer", status: "rascunho", current_version_id: ids.storyVersion, atualizado_em: "2026-09-21T13:10:00Z" },
    { id: ids.reel, campaign_id: ids.campaign, formato: "reel", titulo: "Visita em 30 segundos", status: "em_producao", current_version_id: ids.reelVersion, atualizado_em: "2026-09-21T13:15:00Z" },
  ],
  versions: versions.map(([id, pieceId, format], index) => ({
    id,
    piece_id: pieceId,
    versao: 1,
    snapshot_id: ids.snapshot,
    template_version_id: null,
    conteudo: { headline: format === "feed" ? "Seu próximo capítulo começa aqui" : "Um imóvel pensado para viver bem", legenda: "Conteúdo fictício para validação visual segura.", cta: "Conheça os detalhes" },
    output_manifest: { preview_url: cover },
    checksum: String(index + 1).repeat(64),
    criado_em: "2026-09-21T13:00:00Z",
  })),
  schedules: [{ id: "00000000-0000-4000-8000-000000000131", piece_version_id: ids.feedVersion, canal: "instagram", agendado_para: "2026-09-23T14:00:00Z", timezone: STUDIO_TIMEZONE, status: "agendado", conflito: false }],
  jobs: [{ id: "00000000-0000-4000-8000-000000000141", campaign_id: ids.campaign, piece_id: ids.carousel, tipo: "revisao", status: "concluido", progresso: 100, tentativas: 1, max_tentativas: 3, erro_mensagem: null, criado_em: "2026-09-21T13:00:00Z" }],
  integrations: [
    { provider: "openai", status: "configurada", config_publica: {}, verificado_em: "2026-09-21T12:00:00Z" },
    { provider: "figma", status: "nao_configurada", config_publica: {}, verificado_em: null },
    { provider: "instagram", status: "nao_configurada", config_publica: {}, verificado_em: null },
    { provider: "renderer", status: "nao_configurada", config_publica: {}, verificado_em: null },
  ],
  budgets: [{ provider: "openai", limite_usd: 0, consumido_usd: 0 }],
  briefs: [{ id: ids.brief, campaign_id: ids.campaign, versao: 1, publico: { perfil: "Famílias em busca de espaço" }, tom: "claro, elegante e objetivo", canais: ["instagram"], restricoes_factuais: ["Não inventar condições comerciais"], conteudo: { mensagem: "Destaque conforto e localização" }, criado_em: "2026-09-21T12:00:00Z" }],
  templates: [{ id: "00000000-0000-4000-8000-000000000151", slug: "editorial-premium", nome: "Editorial premium", formato: "feed", ativo: true, versao_publicada: 1, origem: "design_system", manifesto: {} }],
  tasks: [{ id: "00000000-0000-4000-8000-000000000161", piece_id: ids.carousel, responsavel_id: "00000000-0000-4000-8000-000000000171", revisor_id: null, prazo_em: "2026-09-22T18:00:00Z", status: "pendente", pendencia: "Revisar sequência", atualizado_em: "2026-09-21T13:00:00Z" }],
  comments: [{ id: "00000000-0000-4000-8000-000000000181", piece_id: ids.carousel, piece_version_id: ids.carouselVersion, slide_index: 1, cena_index: null, comentario: "Simplificar a chamada do segundo slide.", autor_id: "00000000-0000-4000-8000-000000000171", resolvido_em: null, criado_em: "2026-09-21T13:20:00Z" }],
  metrics: [{ id: "00000000-0000-4000-8000-000000000191", campaign_id: ids.campaign, piece_id: ids.feed, template_version_id: null, periodo_inicio: "2026-09-01", periodo_fim: "2026-09-20", fonte: "demonstracao", alcance: 1240, impressoes: 1680, curtidas: 86, comentarios: 9, compartilhamentos: 12, salvamentos: 21, cliques: 43, observacao: "Métrica fictícia" }],
  members: [{ id: "00000000-0000-4000-8000-000000000171", nome: "Equipe de demonstração", role: "gestor", ativo: true }],
};

document.documentElement.dataset.visualHarness = "studio-sanitizado";
createRoot(document.getElementById("root")!).render(
  <StudioModule
    accessToken="fixture"
    initialData={data}
    mutationHandler={async (body) => {
      record("mutation", String(body.action ?? "unknown"));
      throw new Error("Harness visual: mutação bloqueada.");
    }}
  />,
);
