/**
 * FICHA DO CLIENTE 3.0 — ordem dos blocos e contrato do WhatsApp. PURO.
 *
 * A ordem abaixo é obrigatória e está travada por teste: quem atende lê a
 * ficha de cima para baixo e a primeira coisa acionável tem que ser chamar o
 * cliente, não um formulário.
 *
 * CONTRATO DO WHATSAPP (o mais importante deste arquivo):
 *  - o clique REGISTRA APENAS INTENÇÃO;
 *  - abre `whatsapp://send`, com `https://wa.me/` como alternativa visível;
 *  - NÃO pré-preenche texto;
 *  - o ERP NÃO envia mensagem;
 *  - NÃO encerra o SLA;
 *  - NÃO move o lead de momento.
 * Quem encerra o SLA e move a etapa é o outbound confirmado pelo D-API.
 */
import { prepararAberturaWhatsApp } from "../../crm-nova-era/lib/whatsappNativo.ts";

export type BlocoFicha =
  | "cliente_situacao"
  | "corretor_origem_interesse"
  | "telefone"
  | "chamar_whatsapp"
  | "proxima_acao"
  | "sara"
  | "historico"
  | "dados"
  | "imoveis"
  | "linha_do_tempo"
  | "acoes_avancadas";

/** Ordem obrigatória, de cima para baixo. */
export const ORDEM_FICHA: readonly BlocoFicha[] = Object.freeze([
  "cliente_situacao",
  "corretor_origem_interesse",
  "telefone",
  "chamar_whatsapp",
  "proxima_acao",
  "sara",
  "historico",
  "dados",
  "imoveis",
  "linha_do_tempo",
  "acoes_avancadas",
]);

export const TITULO_BLOCO: Record<BlocoFicha, string> = {
  cliente_situacao: "Cliente e situação",
  corretor_origem_interesse: "Corretor, origem e interesse",
  telefone: "Telefone",
  chamar_whatsapp: "Chamar no WhatsApp",
  proxima_acao: "Próxima ação",
  sara: "Sara",
  historico: "Histórico",
  dados: "Dados",
  imoveis: "Imóveis",
  linha_do_tempo: "Linha do tempo",
  acoes_avancadas: "Ações avançadas",
};

export type AberturaWhatsApp =
  | {
      ok: true;
      /** Esquema do aplicativo instalado. */
      app: string;
      /** Alternativa oficial, sempre visível. */
      fallback: string;
      exibicao: string;
      e164: string;
      /** Sempre false: o ERP nunca manda texto pronto. */
      textoPreenchido: false;
      /** Sempre false: abrir o app não confirma abordagem. */
      encerraSla: false;
      /** Sempre false: o momento muda só com o outbound do D-API. */
      moveMomento: false;
    }
  | { ok: false; explicacao: string; dica: string };

/**
 * Monta a abertura do WhatsApp nativo. Não há endpoint de envio aqui — e não
 * pode haver: a mensagem sai do celular do corretor.
 */
export function prepararChamada(telefone: string | null | undefined): AberturaWhatsApp {
  const p = prepararAberturaWhatsApp(telefone);
  if (!p.ok) {
    return {
      ok: false,
      explicacao: p.explicacao,
      dica: "Corrija o telefone no cadastro do lead para liberar o atendimento.",
    };
  }
  return {
    ok: true,
    app: p.app,
    fallback: p.web,
    exibicao: p.exibicao,
    e164: p.e164,
    textoPreenchido: false,
    encerraSla: false,
    moveMomento: false,
  };
}

/** Situação do cliente em uma frase, sem jargão. */
export function frasedaSituacao(lead: {
  respondeu: boolean;
  respostaPendenteCorretor: boolean;
  visitaAgendadaEm?: string | null;
  proposta?: unknown;
  descartadoMotivo?: string | null;
  nutricao?: boolean;
}): string {
  if (lead.descartadoMotivo) return `Descartado: ${lead.descartadoMotivo}`;
  if (lead.proposta) return "Proposta registrada — acompanhando na Esteira de Vendas";
  if (lead.visitaAgendadaEm) return "Visita agendada — acompanhando no Pipe de Visitas";
  if (lead.nutricao) return "Em nutrição";
  if (lead.respostaPendenteCorretor) return "Cliente respondeu e está aguardando você";
  if (lead.respondeu) return "Em atendimento";
  return "Aguardando a resposta do cliente";
}
