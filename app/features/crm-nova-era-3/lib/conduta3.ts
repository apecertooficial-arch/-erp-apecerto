import type { AnaliseSara } from "./adapter3.ts";

export type StatusPrazo = "atrasada" | "vence_logo" | "no_prazo" | "sem_prazo";

const MOMENTOS: Record<string, string> = {
  novo: "Novo lead",
  tentando_contato: "Tentando contato",
  em_atendimento: "Em atendimento",
  em_acompanhamento: "Em acompanhamento",
};

export function momentoHumano(etapa: string | null | undefined): string {
  return MOMENTOS[String(etapa ?? "")] ?? "Em análise";
}

export function objetivoDaAcao(acao: string | null | undefined): string {
  const a = String(acao ?? "").toLowerCase();
  if (!a) return "Gerar a próxima interação útil com o cliente.";
  if (a.includes("cadência") || a.includes("cadencia") || a.includes("insist") || a.includes("retomar")) return "Conseguir uma resposta do cliente sem deixar o atendimento parar.";
  if (a.includes("necessidade") || a.includes("qualific") || a.includes("perfil") || a.includes("pergunt")) return "Entender o que o cliente procura para indicar opções compatíveis.";
  if (a.includes("imóvel") || a.includes("imovel") || a.includes("opç") || a.includes("produto") || a.includes("buscar")) return "Apresentar opções aderentes e provocar uma reação do cliente.";
  if (a.includes("visita") || a.includes("agendar") || a.includes("convidar")) return "Transformar o interesse em uma visita com data e hora definidas.";
  if (a.includes("proposta") || a.includes("condiç") || a.includes("negoci")) return "Avançar o cliente para uma proposta formal na Esteira de Vendas.";
  if (a.includes("document")) return "Obter o documento ou retorno necessário para o próximo avanço.";
  if (a.includes("encerr")) return "Encerrar a cadência sem manter um lead falsamente ativo.";
  return "Produzir uma interação que mova o atendimento para o próximo passo.";
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
  const acaoSara = analise?.proxima_acao_sugerida?.trim();
  const acao = acaoSara || estado.proximaAcao?.trim() || "A Sara está definindo a próxima ação";
  const prazo = (acaoSara ? analise?.prazo_sugerido : null) || estado.proximaAcaoEm || null;
  const situacao = estado.respostaPendente
    ? "Cliente respondeu e está aguardando você"
    : estado.respondeu
      ? "Conversa iniciada; é preciso produzir o próximo avanço"
      : "Cliente ainda não respondeu; seguir a cadência oficial";
  return {
    momento: momentoHumano(estado.etapa), situacao, acao, prazo,
    objetivo: objetivoDaAcao(acao), prazoInfo: prazoDaConduta(prazo),
    fonte: acaoSara ? "Sara" as const : "CRM" as const,
    justificativa: analise?.justificativa?.trim() || null,
  };
}
