"use client";

/* INTELIGÊNCIA — base compartilhada das telas da área.
 *
 *   tem(v)   -> distingue "veio zero" de "não veio". Zero é resultado; ausência é
 *               estado, e nenhuma tela da área pode confundir os dois.
 *   pct(...) -> só calcula com as duas pontas confirmadas e base > 0.
 *
 * LIMIARES fixos nesta versão, por decisão de produto (configurável em
 * Configurações fica para uma fase futura):
 *   SLA de primeiro contato: 5 min (verde), 15 min (âmbar), acima disso vermelho.
 *   Negócio parado: 7 dias sem movimento.
 *   Sobrecarga de carteira: acima de 100% do limite do corretor.
 *   Amostra mínima para classificar pessoa: 8 atendimentos.
 */

import { useEffect, useState } from "react";

export const SLA_META_MIN = 5;
export const SLA_ATENCAO_MIN = 15;
export const PARADO_DIAS = 7;
export const SOBRECARGA_PCT = 100;
export const AMOSTRA_MINIMA = 8;

export type Periodo = "hoje" | "7d" | "30d" | "90d";
export type Numero = number | string | null | undefined;

export type Fluxo = {
  leads?: Numero; negocios?: Numero; conversas?: Numero;
  visitasMarcadas?: Numero; visitasRealizadas?: Numero; visitasCanceladas?: Numero;
};

export type Empresa = {
  vendas?: Numero; vgv?: Numero; vendasPendentes?: Numero; vgvPendente?: Numero;
  receitaBruta?: Numero; custos?: Numero; margemContribuicao?: Numero;
  metaVgv?: Numero; metaVendas?: Numero; atingimentoVgvPct?: Numero;
  fluxo?: Fluxo;
  riscos?: { carteira_ativa?: Numero; acoes_vencidas?: Numero; corretores_sobrecarregados?: Numero; visitas_sem_feedback?: Numero };
  pipelineQuente?: { oportunidades?: Numero; com_valor?: Numero; valor_informado?: Numero };
  anterior?: { vendas?: Numero; vgv?: Numero; conversas?: Numero; visitasMarcadas?: Numero; visitasRealizadas?: Numero };
};

export type Corretor = {
  corretorId: number; nome: string; limiteCarteira?: Numero;
  carteiraAtiva?: Numero; acoesVencidas?: Numero; capacidadePct?: Numero; vencidasPct?: Numero;
  minutosErp?: Numero; diasComAcesso?: Numero; ultimoAcesso?: string | null;
  visitasMarcadas?: Numero; visitasRealizadas?: Numero; visitasCanceladas?: Numero; visitasComFeedback?: Numero;
  slaAmostra?: Numero; medianaRespostaMin?: Numero; sla15Pct?: Numero;
  iaAmostra?: Numero; notaAtendimento?: Numero; vendas?: Numero; vgv?: Numero;
  trabalho?: Record<string, Numero | string | null>;
  atendimento?: Record<string, Numero>;
  meuDia?: Record<string, Numero>;
  producao?: Record<string, Numero>;
};

export type QualidadeDado = {
  negocios_operacionais?: Numero; negocios_com_valor?: Numero;
  vendas_total?: Numero; vendas_vinculadas?: Numero;
  visitas_realizadas?: Numero; visitas_com_feedback?: Numero;
  leads_operacionais?: Numero; leads_com_origem?: Numero;
  perdas?: Numero; perdas_com_motivo?: Numero;
};

export type Proprietarios = {
  recebidas?: Numero; comPreco?: Numero; ultimaEm?: string | null;
  porStatus?: Array<{ chave: string; total: number }>;
  porBairro?: Array<{ chave: string; total: number }>;
  porFinalidade?: Array<{ chave: string; total: number }>;
};

export type Estoque = {
  publicados?: Numero; comPreco?: Numero; destaque?: Numero; precoMediano?: number | null;
  porBairro?: Array<{ chave: string; total: number }>;
  porFinalidade?: Array<{ chave: string; total: number }>;
  porStatus?: Array<{ chave: string; total: number }>;
};

/* Leitura do GA4. Cada pedaço pode vir vazio de forma independente: a tela mostra
   o que existe e declara o que faltou. */
export type Analytics = {
  totais: { sessoes: number; visualizacoes: number; sessoesEngajadas: number; taxaEngajamento: number | null } | null;
  paginas: Array<{ pagina: string; visualizacoes: number; entradas: number }>;
  origens: Array<{ origem: string; sessoes: number; engajadas: number }>;
  dispositivos: Array<{ dispositivo: string; sessoes: number }>;
};

export type Resposta = {
  periodo?: { chave: string; inicio: string; fim: string; rotulo: string; fuso?: string };
  atualizadoEm?: string;
  empresa?: { empresa?: Empresa | null } | Empresa | null;
  corretores?: Corretor[];
  qualidadeDado?: QualidadeDado | null;
  digital?: { leadsDoSite?: Numero; primeiroEm?: string | null; ultimoEm?: string | null } | null;
  proprietarios?: Proprietarios | null;
  estoque?: Estoque | null;
  analytics?: Analytics | null;
  pendencias?: Array<{ chave: string; texto: string }>;
  error?: string;
};

export const PERIODOS: Array<{ id: Periodo; nome: string }> = [
  { id: "hoje", nome: "Hoje" }, { id: "7d", nome: "7 dias" },
  { id: "30d", nome: "30 dias" }, { id: "90d", nome: "90 dias" },
];

export const tem = (v: Numero) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
export const num = (v: Numero) => Number(v) || 0;
export const inteiro = (v: Numero) => Math.round(num(v)).toLocaleString("pt-BR");
export const decimal = (v: Numero) => num(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
export const dinheiro = (v: Numero) => num(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const duracao = (v: Numero) => (num(v) >= 60 ? `${decimal(num(v) / 60)} h` : `${inteiro(v)} min`);
export const dataCurta = (v?: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "sem registro");
export const horaSp = (iso?: string) =>
  iso ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "";

/* Percentual com as duas pontas confirmadas; senão null (a tela mostra o estado). */
export const pct = (parte: Numero, base: Numero): string | null =>
  tem(parte) && tem(base) && num(base) > 0 ? `${decimal((100 * num(parte)) / num(base))}%` : null;

export const somar = (lista: Corretor[], ler: (c: Corretor) => Numero) =>
  lista.reduce((total, c) => total + num(ler(c)), 0);

export const mediaPonderada = (lista: Corretor[], valor: (c: Corretor) => Numero, peso: (c: Corretor) => Numero) => {
  const total = somar(lista, peso);
  return total ? lista.reduce((acc, c) => acc + num(valor(c)) * num(peso(c)), 0) / total : null;
};

/* A RPC canônica devolve { periodo, empresa, corretores }; o endpoint repassa o
   bloco inteiro. Aceitamos as duas formas para a tela não depender do envelope. */
export function lerEmpresa(bloco: Resposta["empresa"]): Empresa | null {
  if (!bloco) return null;
  const aninhado = (bloco as { empresa?: Empresa | null }).empresa;
  return (aninhado ?? (bloco as Empresa)) || null;
}

export type Leitura = {
  dados: Resposta | null;
  estado: "carregando" | "pronto" | "falhou";
  periodo: Periodo;
  trocarPeriodo: (p: Periodo) => void;
  tentarNovamente: () => void;
};

/* Mesma forma de leitura do PerformanceWorkspace: aborta na saída, guarda o dado
   anterior quando falha e nunca mostra a mensagem crua do backend. */
export function useInteligencia(accessToken: string, inicial: Periodo = "30d"): Leitura {
  const [periodo, setPeriodo] = useState<Periodo>(inicial);
  const [dados, setDados] = useState<Resposta | null>(null);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "falhou">("carregando");
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    const controller = new AbortController();
    fetch(`/api/inteligencia?periodo=${periodo}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    })
      .then(async (r) => ({ ok: r.ok, body: (await r.json()) as Resposta }))
      .then(({ ok, body }) => {
        if (!ativo) return;
        if (!ok || body.error) throw new Error(body.error || "Falha HTTP");
        setDados(body);
        setEstado("pronto");
      })
      .catch((erro: unknown) => {
        if (!ativo || controller.signal.aborted) return;
        console.error("[inteligencia] falha na consulta:", erro);
        setEstado("falhou");
      });
    return () => { ativo = false; controller.abort(); };
  }, [accessToken, periodo, tentativa]);

  return {
    dados, estado, periodo,
    trocarPeriodo: (p: Periodo) => { setEstado("carregando"); setPeriodo(p); },
    tentarNovamente: () => { setEstado("carregando"); setTentativa((v) => v + 1); },
  };
}
