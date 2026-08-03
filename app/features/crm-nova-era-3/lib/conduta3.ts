import type { AnaliseSara } from "./adapter3.ts";

export type StatusPrazo = "atrasada" | "vence_logo" | "no_prazo" | "sem_prazo";

export const MOMENTOS_PADRAO = Object.freeze([
  { codigo: "novo_lead", ordem: 1, rotulo: "Novo lead" },
  { codigo: "sem_resposta", ordem: 2, rotulo: "Em cadência" },
  { codigo: "qualificando", ordem: 3, rotulo: "Entendendo necessidade" },
  { codigo: "buscando_opcoes", ordem: 4, rotulo: "Buscando imóveis" },
  { codigo: "opcoes_enviadas", ordem: 5, rotulo: "Opções enviadas" },
  { codigo: "visita", ordem: 6, rotulo: "Visita" },
  { codigo: "acompanhamento", ordem: 7, rotulo: "Acompanhamento" },
] as const);

export const ACOES_OFICIAIS = Object.freeze([
  { codigo: "PRIMEIRA_ABORDAGEM", rotulo: "Fazer a primeira abordagem", objetivo: "Iniciar a conversa em até 5 minutos." },
  { codigo: "ENVIAR_CADENCIA", rotulo: "Enviar a mensagem da cadência", objetivo: "Conseguir uma resposta sem deixar o lead parar." },
  { codigo: "RESPONDER_CLIENTE", rotulo: "Responder o cliente", objetivo: "Manter a conversa ativa e avançar o atendimento." },
  { codigo: "QUALIFICAR_NECESSIDADE", rotulo: "Entender o que o cliente procura", objetivo: "Descobrir perfil, região, faixa de valor e prazo de compra." },
  { codigo: "BUSCAR_IMOVEIS", rotulo: "Buscar imóveis compatíveis", objetivo: "Separar opções aderentes ao pedido do cliente." },
  { codigo: "ENVIAR_OPCOES", rotulo: "Enviar opções ao cliente", objetivo: "Provocar uma reação com imóveis compatíveis." },
  { codigo: "COBRAR_RETORNO", rotulo: "Pedir retorno sobre as opções", objetivo: "Descobrir o que agradou e ajustar a busca." },
  { codigo: "AGENDAR_OU_CONFIRMAR_VISITA", rotulo: "Agendar ou confirmar a visita", objetivo: "Transformar o interesse em visita com data e hora." },
  { codigo: "REGISTRAR_RESULTADO_VISITA", rotulo: "Registrar o resultado da visita", objetivo: "Definir o próximo avanço após a visita." },
  { codigo: "REATIVAR_OU_ENCERRAR", rotulo: "Reativar ou encerrar o atendimento", objetivo: "Evitar lead parado ou falsamente ativo." },
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
  if (/resultado.*visita|pos[- ]?visita|visita.*realiz/.test(texto)) return "REGISTRAR_RESULTADO_VISITA";
  if (/visita|agendar|confirmar.*horario/.test(texto)) return "AGENDAR_OU_CONFIRMAR_VISITA";
  if (/buscar|procurar|separar|outro produto|outra regiao|imoveis compativeis/.test(texto)) return "BUSCAR_IMOVEIS";
  if (/enviar.*(op|imovel)|apresentar.*(op|imovel)/.test(texto)) return "ENVIAR_OPCOES";
  if (/retorno.*(op|imovel)|feedback|o que achou|cobrar retorno/.test(texto)) return "COBRAR_RETORNO";
  if (/qualific|necessidade|perfil|orcamento|faixa de valor|forma de pagamento|prazo de compra/.test(texto)) return "QUALIFICAR_NECESSIDADE";
  if (/reativ|encerr|nutri/.test(texto)) return "REATIVAR_OU_ENCERRAR";
  if (respostaPendente || (/respond/.test(texto) && respondeu)) return "RESPONDER_CLIENTE";
  if (etapa === "novo") return "PRIMEIRA_ABORDAGEM";
  if (!respondeu || /cadencia|insist|sem resposta|novo contato|retomar/.test(texto)) return "ENVIAR_CADENCIA";
  return "QUALIFICAR_NECESSIDADE";
}

function classificarMomento(etapa: string, texto: string, acao: CodigoAcao, respondeu: boolean): CodigoMomento {
  if (acao === "REGISTRAR_RESULTADO_VISITA" || acao === "AGENDAR_OU_CONFIRMAR_VISITA") return "visita";
  if (acao === "COBRAR_RETORNO" || /opcoes enviadas|aguardando.*op/.test(texto)) return "opcoes_enviadas";
  if (acao === "BUSCAR_IMOVEIS" || acao === "ENVIAR_OPCOES") return "buscando_opcoes";
  if (acao === "REATIVAR_OU_ENCERRAR" || etapa === "em_acompanhamento") return "acompanhamento";
  if (etapa === "novo") return "novo_lead";
  if (!respondeu || acao === "ENVIAR_CADENCIA") return "sem_resposta";
  return "qualificando";
}

export function momentoHumano(etapa: string | null | undefined): string {
  const mapa: Record<string, CodigoMomento> = {
    novo: "novo_lead", tentando_contato: "sem_resposta", em_atendimento: "qualificando", em_acompanhamento: "acompanhamento",
  };
  const codigo = mapa[String(etapa ?? "")] ?? "qualificando";
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
