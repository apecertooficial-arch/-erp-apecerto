import type { AnaliseSara } from "./adapter3.ts";

export type StatusPrazo = "atrasada" | "vence_logo" | "no_prazo" | "sem_prazo";

export const MOMENTOS_PADRAO = Object.freeze([
  { codigo: "novo_lead", ordem: 1, rotulo: "Novo" },
  { codigo: "sem_resposta", ordem: 2, rotulo: "Tentando contato" },
  { codigo: "em_atendimento", ordem: 3, rotulo: "Em atendimento" },
  { codigo: "acompanhamento", ordem: 4, rotulo: "Em acompanhamento" },
] as const);

export const ACOES_OFICIAIS = Object.freeze([
  { codigo: "PRIMEIRA_ABORDAGEM", rotulo: "Fazer a primeira abordagem", objetivo: "Iniciar a conversa em até 5 minutos." },
  { codigo: "ENVIAR_CADENCIA", rotulo: "Enviar a mensagem da cadência", objetivo: "Conseguir uma resposta sem deixar o lead parar." },
  { codigo: "RESPONDER_CLIENTE", rotulo: "Responder o cliente", objetivo: "Manter a conversa ativa e avançar o atendimento." },
  { codigo: "ENTENDER_NECESSIDADE", rotulo: "Entender o que o cliente procura", objetivo: "Descobrir e completar perfil, região, faixa de valor e prazo de compra." },
  { codigo: "BUSCAR_E_ENVIAR_IMOVEIS", rotulo: "Buscar e enviar imóveis", objetivo: "Entregar opções compatíveis e provocar uma resposta." },
  { codigo: "PEDIR_RETORNO", rotulo: "Pedir retorno sobre as opções", objetivo: "Descobrir o que agradou e ajustar a busca." },
  { codigo: "REATIVAR_CONVERSA", rotulo: "Reativar a conversa", objetivo: "Produzir nova interação sem deixar o atendimento parar." },
  { codigo: "AGENDAR_VISITA", rotulo: "Agendar uma visita", objetivo: "Transformar o interesse em visita com data e hora." },
  { codigo: "REGISTRAR_RESULTADO_VISITA", rotulo: "Registrar o resultado da visita", objetivo: "Definir o próximo avanço após a visita." },
  { codigo: "REGISTRAR_PROPOSTA", rotulo: "Registrar proposta", objetivo: "Encaminhar uma proposta real para a Esteira de Vendas." },
] as const);

export type CodigoMomento = typeof MOMENTOS_PADRAO[number]["codigo"];
export type CodigoAcao = typeof ACOES_OFICIAIS[number]["codigo"];

function textoBase(valor: string | null | undefined): string {
  return String(valor ?? "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function acaoPorCodigo(codigo: CodigoAcao) {
  return ACOES_OFICIAIS.find((item) => item.codigo === codigo)!;
}

function classificarAcao(
  etapa: string,
  texto: string,
  respondeu: boolean,
  respostaPendente: boolean,
): CodigoAcao {
  if (/proposta/.test(texto)) return "REGISTRAR_PROPOSTA";
  if (/resultado.*visita|pos[- ]?visita|visita.*realiz/.test(texto)) return "REGISTRAR_RESULTADO_VISITA";
  if (/visita|agendar|confirmar.*horario/.test(texto)) return "AGENDAR_VISITA";
  if (/buscar|procurar|separar|enviar.*(op|imovel)|outro produto|outra regiao|imoveis compativeis/.test(texto)) return "BUSCAR_E_ENVIAR_IMOVEIS";
  if (/retorno.*(op|imovel)|feedback|o que achou|cobrar retorno/.test(texto)) return "PEDIR_RETORNO";
  if (/regiao|tipo de imovel|dormitorio|orcamento|faixa de valor|forma de pagamento|prazo de compra|metragem|vaga/.test(texto)) return "ENTENDER_NECESSIDADE";
  if (/reativ|retomar|parou de responder/.test(texto)) return "REATIVAR_CONVERSA";
  if (/qualific|necessidade|perfil/.test(texto)) return "ENTENDER_NECESSIDADE";
  if (respostaPendente || (/respond/.test(texto) && respondeu)) return "RESPONDER_CLIENTE";
  if (etapa === "novo") return "PRIMEIRA_ABORDAGEM";
  if (!respondeu || /cadencia|insist|sem resposta|novo contato|retomar/.test(texto)) return "ENVIAR_CADENCIA";
  return "ENTENDER_NECESSIDADE";
}

function classificarMomento(etapa: string, texto: string, acao: CodigoAcao, respondeu: boolean): CodigoMomento {
  if (etapa === "em_acompanhamento" || acao === "REGISTRAR_RESULTADO_VISITA" || acao === "REGISTRAR_PROPOSTA") return "acompanhamento";
  if (etapa === "novo") return "novo_lead";
  if (!respondeu || acao === "ENVIAR_CADENCIA") return "sem_resposta";
  return "em_atendimento";
}

export function momentoHumano(etapa: string | null | undefined): string {
  const mapa: Record<string, CodigoMomento> = {
    novo: "novo_lead", tentando_contato: "sem_resposta", em_atendimento: "em_atendimento", em_acompanhamento: "acompanhamento",
  };
  const codigo = mapa[String(etapa ?? "")] ?? "em_atendimento";
  return MOMENTOS_PADRAO.find((item) => item.codigo === codigo)!.rotulo;
}

export function prazoDaConduta(prazo: string | null | undefined, agora = new Date()): { status: StatusPrazo; rotulo: string } {
  if (!prazo) return { status: "sem_prazo", rotulo: "Prazo sendo definido" };
  const fim = Date.parse(prazo);
  if (!Number.isFinite(fim)) return { status: "sem_prazo", rotulo: "Prazo sendo definido" };
  const minutos = Math.round((fim - agora.getTime()) / 60000);
  if (minutos < 0) {
    const atraso = Math.abs(minutos);
    return { status: "atrasada", rotulo: atraso < 60 ? `Atrasada há ${atraso} min` : `Atrasada há ${Math.floor(atraso / 60)}h` };
  }
  if (minutos < 60) return { status: "vence_logo", rotulo: `Faltam ${Math.max(1, minutos)} min` };
  if (minutos < 24 * 60) return { status: "no_prazo", rotulo: `Faltam ${Math.floor(minutos / 60)}h` };
  return { status: "no_prazo", rotulo: `Faltam ${Math.floor(minutos / 1440)}d` };
}

export function condutaOficial(
  estado: { etapa?: string | null; proximaAcao?: string | null; proximaAcaoEm?: string | null; respondeu?: boolean; respostaPendente?: boolean },
  analise?: AnaliseSara | null,
) {
  const textoLivre = analise?.proxima_acao_sugerida?.trim() || estado.proximaAcao?.trim() || "";
  const texto = textoBase(textoLivre);
  const etapa = String(estado.etapa ?? "");
  const respondeu = Boolean(estado.respondeu);
  const respostaPendente = Boolean(estado.respostaPendente);
  const acaoCodigo = classificarAcao(etapa, texto, respondeu, respostaPendente);
  const acao = acaoPorCodigo(acaoCodigo);
  const momentoCodigo = classificarMomento(etapa, texto, acaoCodigo, respondeu);
  const momento = MOMENTOS_PADRAO.find((item) => item.codigo === momentoCodigo)!;
  const prazo = (analise?.proxima_acao_sugerida?.trim() ? analise.prazo_sugerido : null) || estado.proximaAcaoEm || null;
  const situacao = respostaPendente
    ? "Cliente respondeu e está aguardando você"
    : respondeu
      ? "Conversa iniciada; produza o próximo avanço"
      : etapa === "novo"
        ? "Lead recebido; faça o primeiro contato"
        : "Cliente ainda não respondeu; siga a cadência";
  return {
    momento: momento.rotulo, momentoCodigo, momentoOrdem: momento.ordem,
    situacao, acao: acao.rotulo, acaoCodigo, prazo, objetivo: acao.objetivo,
    prazoInfo: prazoDaConduta(prazo), fonte: analise ? "Sara" as const : "CRM" as const,
    justificativa: analise?.justificativa?.trim() || textoLivre || null,
  };
}
