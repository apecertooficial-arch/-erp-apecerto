import { notFound } from "next/navigation";
import { StudioVisualClient } from "./StudioVisualClient";
import type { StudioData, StudioFormat } from "../features/studio/domain";

const org = "00000000-0000-4000-8000-000000000001";
const campaignId = "51000000-0000-4000-8000-000000000001";
const snapshotId = "52000000-0000-4000-8000-000000000001";
const formats: StudioFormat[] = ["feed", "carousel", "story", "reel"];
const pieceId = (index: number) => `53000000-0000-4000-8000-00000000000${index + 1}`;
const versionId = (index: number) => `54000000-0000-4000-8000-00000000000${index + 1}`;

const fixture: StudioData = {
  organizationId: org,
  timezone: "America/Sao_Paulo",
  campaigns: [{
    id: campaignId,
    nome: "Moema · setembro",
    objetivo: "Gerar interesse qualificado e visitas para um apartamento pronto para morar.",
    periodo_inicio: "2026-09-01",
    periodo_fim: "2026-09-30",
    status: "em_revisao",
    produto_codigo: "APTESTE-81",
    produto_alterado_em: null,
    produto_alterado_motivo: null,
    snapshot_atual_id: snapshotId,
    budget_usd: 0,
    gasto_usd: 0,
    atualizado_em: "2026-08-27T12:00:00Z",
  }],
  snapshots: [{
    id: snapshotId,
    campaign_id: campaignId,
    versao: 1,
    produto_codigo: "APTESTE-81",
    fatos: { nome: "Apartamento ensolarado", bairro: "Moema", cidade: "São Paulo", area_m2: 87, dormitorios: 2, vagas: 1, preco: 1250000 },
    midias: [
      { storage_path: "homologacao/sala.jpg", is_capa: true },
      { storage_path: "homologacao/fachada.jpg", is_capa: false },
      { storage_path: "homologacao/varanda.jpg", is_capa: false },
    ],
    checksum: "a".repeat(64),
    criado_em: "2026-08-27T12:00:00Z",
  }],
  pieces: formats.map((formato, index) => ({
    id: pieceId(index),
    campaign_id: campaignId,
    formato,
    titulo: formato === "feed" ? "Post de apresentação" : formato === "carousel" ? "Carrossel do imóvel" : formato === "story" ? "Sequência de Stories" : "Reel do imóvel",
    status: index === 0 ? "aprovada" : "em_revisao",
    current_version_id: versionId(index),
    atualizado_em: "2026-08-27T12:00:00Z",
  })),
  versions: formats.map((formato, index) => ({
    id: versionId(index),
    piece_id: pieceId(index),
    versao: 2,
    snapshot_id: snapshotId,
    template_version_id: null,
    conteudo: {
      headline: formato === "reel" ? "Seu próximo apê em movimento" : "Seu próximo apê em Moema",
      legenda: "Um apartamento pronto para morar, com 87 m² e dois dormitórios. Agende sua visita.",
      cta: "Agende sua visita",
      ...(formato === "carousel" ? { slides: [{ titulo: "87 m²", texto: "Ambientes claros" }, { titulo: "2 dormitórios", texto: "Uma suíte" }] } : {}),
      ...(formato === "story" ? { stories: [{ titulo: "Pronto para morar", texto: "Conheça cada detalhe" }] } : {}),
      ...(formato === "reel" ? { cenas: [{ texto_tela: "Moema", duracao_segundos: 3 }] } : {}),
    },
    output_manifest: index === 0 ? {
      renderer: "ffmpeg-worker-v1",
      files: [{ storage_bucket: "social-studio", storage_path: `${org}/derivados/feed.jpg`, checksum: "b".repeat(64), bytes: 61355, width: 1080, height: 1350, mime_type: "image/jpeg", index: 0, role: "single" }],
    } : {},
    checksum: String(index + 1).repeat(64),
    criado_em: "2026-08-27T12:00:00Z",
  })),
  schedules: [{
    id: "55000000-0000-4000-8000-000000000001",
    piece_version_id: versionId(0),
    canal: "instagram",
    agendado_para: "2026-09-03T13:00:00Z",
    timezone: "America/Sao_Paulo",
    status: "agendado",
    conflito: false,
  }],
  jobs: [{
    id: "56000000-0000-4000-8000-000000000001",
    campaign_id: campaignId,
    piece_id: pieceId(3),
    tipo: "render",
    status: "concluido",
    progresso: 100,
    tentativas: 1,
    max_tentativas: 3,
    erro_mensagem: null,
    criado_em: "2026-08-27T12:00:00Z",
  }],
  integrations: [
    { provider: "openai", status: "nao_configurada", config_publica: { external_calls_enabled: false }, verificado_em: null },
    { provider: "figma", status: "nao_configurada", config_publica: { mode: "manifest_import" }, verificado_em: null },
    { provider: "renderer", status: "configurada", config_publica: { engine: "ffmpeg-worker-v1", image_ready: true, video_ready: true }, verificado_em: "2026-08-27T12:00:00Z" },
    { provider: "instagram", status: "nao_configurada", config_publica: { publishing_enabled: false }, verificado_em: null },
  ],
  budgets: [
    { provider: "openai", limite_usd: 0, consumido_usd: 0 },
    { provider: "renderer", limite_usd: 0, consumido_usd: 0 },
    { provider: "instagram", limite_usd: 0, consumido_usd: 0 },
  ],
  briefs: [{ id: "57000000-0000-4000-8000-000000000001", campaign_id: campaignId, versao: 1, publico: { segmento: "Compradores" }, tom: "Jovial, direto e confiável", canais: ["instagram"], restricoes_factuais: [], conteudo: { angulo_editorial: "Vida urbana em Moema", pilares: ["localização", "diferenciais"] }, criado_em: "2026-08-27T12:00:00Z" }],
  templates: formats.flatMap((formato, formatIndex) => Array.from({ length: 5 }, (_, variant) => ({
    id: `58000000-0000-4000-8000-${String(formatIndex * 5 + variant + 1).padStart(12, "0")}`,
    slug: `${formato}-oficial-${variant + 1}`,
    nome: `${formato === "carousel" ? "Carrossel" : formato === "story" ? "Stories" : formato === "reel" ? "Reel" : "Feed"} · ${["Editorial", "Tour", "Prova social", "Comparativo", "Oferta"][variant]}`,
    formato,
    ativo: true,
    versao_publicada: 1,
    origem: variant === 0 ? "figma" : "design_system",
  }))),
};

export default function StudioVisualTestPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <StudioVisualClient fixture={fixture}/>;
}
