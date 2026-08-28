import { notFound } from "next/navigation";
import { StudioVisualClient } from "./StudioVisualClient";
import type { StudioData, StudioFormat } from "../features/studio/domain";

const org = "00000000-0000-4000-8000-000000000001";
const campaignId = "51000000-0000-4000-8000-000000000001";
const snapshotId = "52000000-0000-4000-8000-000000000001";
const formats: StudioFormat[] = ["feed", "carousel", "story", "reel"];
const pieceId = (index: number) => `53000000-0000-4000-8000-00000000000${index + 1}`;
const versionId = (index: number) => `54000000-0000-4000-8000-00000000000${index + 1}`;

const fixtureBase: StudioData = {
  organizationId: org,
  timezone: "America/Sao_Paulo",
  campaigns: [{
    id: campaignId,
    nome: "AP0358 · Moema · setembro",
    objetivo: "Gerar interesse qualificado e visitas para um apartamento pronto para morar.",
    periodo_inicio: "2026-09-01",
    periodo_fim: "2026-09-30",
    status: "em_revisao",
    produto_codigo: "AP0358",
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
    produto_codigo: "AP0358",
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

// Dois cenários sanitizados, com os mesmos códigos usados na homologação, sem
// consultar nem mutar o ERP. O segundo conjunto recebe IDs próprios para que
// deep links, filtros e versões continuem determinísticos no isolamento.
const cloneForCampaign = (value: unknown) => {
  const text = JSON.stringify(value)
    .replaceAll("51000000-0000-4000-8000-000000000001", "61000000-0000-4000-8000-000000000001")
    .replaceAll("52000000-0000-4000-8000-000000000001", "62000000-0000-4000-8000-000000000001")
    .replaceAll("53000000-0000-4000-8000-00000000000", "63000000-0000-4000-8000-00000000000")
    .replaceAll("54000000-0000-4000-8000-00000000000", "64000000-0000-4000-8000-00000000000")
    .replaceAll("55000000-0000-4000-8000-000000000001", "65000000-0000-4000-8000-000000000001")
    .replaceAll("56000000-0000-4000-8000-000000000001", "66000000-0000-4000-8000-000000000001")
    .replaceAll("57000000-0000-4000-8000-000000000001", "67000000-0000-4000-8000-000000000001")
    .replaceAll("58000000-0000-4000-8000-", "68000000-0000-4000-8000-");
  return JSON.parse(text);
};
const secondCampaign = cloneForCampaign(fixtureBase.campaigns[0]);
secondCampaign.id = "61000000-0000-4000-8000-000000000001";
secondCampaign.nome = "AP0348 · Moema · setembro";
secondCampaign.produto_codigo = "AP0348";
secondCampaign.objetivo = "Demonstrar um apartamento de dois dormitórios para famílias que valorizam espaço e mobilidade.";
const secondSnapshot = cloneForCampaign(fixtureBase.snapshots[0]);
secondSnapshot.id = "62000000-0000-4000-8000-000000000001";
secondSnapshot.campaign_id = secondCampaign.id;
secondSnapshot.produto_codigo = "AP0348";
secondSnapshot.fatos = { ...secondSnapshot.fatos, nome: "Apartamento familiar ensolarado", dormitorios: 2, area_m2: 92 };
const secondPieces = cloneForCampaign(fixtureBase.pieces);
const secondVersions = cloneForCampaign(fixtureBase.versions);
const secondSchedules = cloneForCampaign(fixtureBase.schedules);
const secondJobs = cloneForCampaign(fixtureBase.jobs);
const secondBriefs = cloneForCampaign(fixtureBase.briefs);
for (const item of [...secondPieces, ...secondVersions, ...secondSchedules, ...secondJobs, ...secondBriefs]) {
  if ("campaign_id" in item) item.campaign_id = secondCampaign.id;
  if ("snapshot_id" in item) item.snapshot_id = secondSnapshot.id;
}
const fixture: StudioData = {
  ...fixtureBase,
  campaigns: [fixtureBase.campaigns[0], secondCampaign],
  snapshots: [fixtureBase.snapshots[0], secondSnapshot],
  pieces: [...fixtureBase.pieces, ...secondPieces],
  versions: [...fixtureBase.versions, ...secondVersions],
  schedules: [...fixtureBase.schedules, ...secondSchedules],
  jobs: [...fixtureBase.jobs, ...secondJobs],
  briefs: [...fixtureBase.briefs, ...secondBriefs],
};

export default function StudioVisualTestPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <StudioVisualClient fixture={fixture}/>;
}
