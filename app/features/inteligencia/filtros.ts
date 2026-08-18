"use client";

/* INTELIGÊNCIA — estado dos filtros globais (artboard 11a).
 *
 * A URL É A FONTE DA VERDADE. Um link colado reproduz exatamente a mesma visão,
 * e trocar de página mantém os filtros porque cada aba da casca é um <a href>
 * real que carrega a query atual. O localStorage é só espelho, com validade de
 * 24 h — se a URL disser algo, ela ganha.
 *
 * ARQUIVO SEM DEPENDÊNCIA INTERNA de propósito (não importa dados.ts): é folha da
 * árvore, então dados.ts pode importar daqui para semear o período inicial sem
 * criar ciclo.
 *
 * O QUE ESTA CAMADA NÃO FAZ: aplicar filtro em número nenhum. Ela guarda a
 * seleção e a expõe. Cada tela passa a consumir `filtros` no commit do seu grupo.
 * Enquanto uma seleção não é consumida por ninguém, a barra diz isso na cara do
 * usuário — seleção guardada não pode passar por filtro aplicado.
 */

import { useCallback, useEffect, useState } from "react";

export type ChaveFiltro =
  | "comparacao" | "origem" | "midia" | "campanha" | "dispositivo"
  | "pagina" | "imovel" | "bairro" | "finalidade" | "tipoLead" | "consentimento";

export type Filtros = Partial<Record<ChaveFiltro, string>>;

/* De onde saem as opções de cada controle:
 *   vocabulario — lista fechada, definida pelo próprio Design (11a). Selecionável hoje.
 *   agregado    — lista aberta que vem do endpoint já agregado (bairro, origem…).
 *                 Selecionável quando a tela passa `fontes`; sem isso, declara ausência.
 *   pendente    — não existe fonte no ERP. Nunca fica selecionável, e explica por quê. */
export type Origem = "vocabulario" | "agregado" | "pendente";

export type Controle = {
  chave: ChaveFiltro;
  rotulo: string;
  origem: Origem;
  opcoes?: string[];
  pendencia?: string;
};

/* Os 13 controles do 11a. Período e comparação abrem a barra; os outros 11 seguem
   a ordem do artboard. Período é o único que não vive aqui: ele já é estado da
   leitura (dados.ts) porque o endpoint o recebe. */
export const CONTROLES: readonly Controle[] = [
  { chave: "comparacao", rotulo: "Comparar", origem: "vocabulario", opcoes: ["período anterior", "mesmo período do ano anterior"] },
  { chave: "origem", rotulo: "Origem", origem: "agregado" },
  { chave: "midia", rotulo: "Mídia", origem: "pendente", pendencia: "Mídia paga depende de Google Ads e Meta Ads conectados." },
  { chave: "campanha", rotulo: "Campanha", origem: "pendente", pendencia: "A lista de campanhas chega junto com a conexão de mídia." },
  { chave: "dispositivo", rotulo: "Dispositivo", origem: "vocabulario", opcoes: ["desktop", "tablet", "celular"] },
  { chave: "pagina", rotulo: "Página / tipo", origem: "agregado" },
  { chave: "imovel", rotulo: "Imóvel", origem: "pendente", pendencia: "Busca por imóvel exige telemetria por item no ERP." },
  { chave: "bairro", rotulo: "Bairro", origem: "agregado" },
  { chave: "finalidade", rotulo: "Finalidade", origem: "vocabulario", opcoes: ["venda", "locação"] },
  { chave: "tipoLead", rotulo: "Tipo de lead", origem: "vocabulario", opcoes: ["comprador", "locatário", "proprietário"] },
  { chave: "consentimento", rotulo: "Consentimento", origem: "vocabulario", opcoes: ["essencial", "Analytics", "Marketing"] },
];

/* Cada página oculta o que não se aplica a ela (11a) — ocultar, nunca desabilitar
   sem explicar. Comparação aparece em toda página que mostra número de período. */
export const APLICAVEIS: Record<string, ChaveFiltro[]> = {
  "": ["comparacao", "origem", "dispositivo", "bairro", "finalidade"],
  vendas: ["comparacao", "bairro", "finalidade"],
  financeiro: ["comparacao"],
  proprietarios: ["comparacao", "bairro", "finalidade", "tipoLead"],
  atendimento: ["comparacao"],
  equipe: ["comparacao"],
  gerentes: ["comparacao"],
  corretores: ["comparacao"],
  conversao: ["comparacao", "origem", "tipoLead"],
  qualidade: ["comparacao"],
  aquisicao: ["comparacao", "origem", "midia", "campanha", "dispositivo"],
  comportamento: ["comparacao", "pagina", "dispositivo"],
  imoveis: ["comparacao", "bairro", "finalidade", "imovel"],
  sara: ["comparacao"],
  alertas: [],
  privacidade: ["consentimento"],
};

/* Nenhuma tela consome `filtros` ainda além do período: a barra precisa dizer
   isso. Esta lista encolhe a cada commit de grupo de telas. */
export const CONSUMIDOS_PELAS_TELAS: ChaveFiltro[] = [];

/* Fonte das opções abertas, na forma mínima que o endpoint já devolve. Tipo
   estrutural para não depender do módulo de dados. */
export type FonteOpcoes = {
  analytics?: { origens?: Array<{ origem: string }>; paginas?: Array<{ pagina: string }> } | null;
  proprietarios?: { porBairro?: Array<{ chave: string }> } | null;
  estoque?: { porBairro?: Array<{ chave: string }> } | null;
};

const limpar = (lista: string[]) =>
  [...new Set(lista.filter((v) => v && v !== "não informado"))].slice(0, 12);

export function opcoesAbertas(chave: ChaveFiltro, fontes?: FonteOpcoes): string[] {
  if (!fontes) return [];
  if (chave === "origem") return limpar((fontes.analytics?.origens ?? []).map((o) => o.origem));
  if (chave === "pagina") return limpar((fontes.analytics?.paginas ?? []).map((p) => p.pagina));
  if (chave === "bairro") {
    return limpar([
      ...(fontes.estoque?.porBairro ?? []).map((b) => b.chave),
      ...(fontes.proprietarios?.porBairro ?? []).map((b) => b.chave),
    ]);
  }
  return [];
}

/* ---------------- URL ---------------- */

export const PERIODOS_ACEITOS = ["hoje", "7d", "30d", "90d"] as const;

const CHAVES: ChaveFiltro[] = CONTROLES.map((c) => c.chave);

function params(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

export function lerPeriodoDaUrl(): string | null {
  const v = params().get("periodo");
  return v && (PERIODOS_ACEITOS as readonly string[]).includes(v) ? v : null;
}

export function lerFiltrosDaUrl(): Filtros {
  const p = params();
  const saida: Filtros = {};
  for (const chave of CHAVES) {
    const valor = p.get(chave);
    if (valor) saida[chave] = valor;
  }
  return saida;
}

/* Query atual em forma de string, para a casca pendurar em cada <a href> das abas:
   é o que faz o filtro sobreviver à troca de página sem estado escondido. */
export function queryAtual(): string {
  const busca = params().toString();
  return busca ? `?${busca}` : "";
}

/* Único escritor do sistema externo (URL + espelho). Chamado de um efeito de
   sincronização, nunca de dentro de um setState: quem manda é o estado, e a URL
   apenas o reflete. */
function sincronizar(periodo: string | null, filtros: Filtros) {
  if (typeof window === "undefined") return;
  const p = new URLSearchParams();
  if (periodo) p.set("periodo", periodo);
  for (const chave of CHAVES) {
    const valor = filtros[chave];
    if (valor) p.set(chave, valor);
  }
  const busca = p.toString();
  const url = `${window.location.pathname}${busca ? `?${busca}` : ""}`;
  /* replaceState, não pushState: mexer em filtro não é navegar. O botão voltar
     continua servindo para voltar de página, que é o que a pessoa espera. */
  window.history.replaceState(window.history.state, "", url);
  espelhar(periodo, filtros);
}

/* ---------------- espelho local (24 h) ---------------- */

const VALIDADE_MS = 24 * 60 * 60 * 1000;

type Espelho = { em: number; periodo: string | null; filtros: Filtros };

function espelhar(periodo: string | null, filtros: Filtros) {
  try {
    const corpo: Espelho = { em: Date.now(), periodo, filtros };
    localStorage.setItem("apecerto-int-filtros", JSON.stringify(corpo));
  } catch { /* modo privado pode barrar o storage: a URL continua valendo */ }
}

export function lerEspelho(): Espelho | null {
  try {
    const cru = localStorage.getItem("apecerto-int-filtros");
    if (!cru) return null;
    const corpo = JSON.parse(cru) as Espelho;
    if (!corpo || typeof corpo.em !== "number" || Date.now() - corpo.em > VALIDADE_MS) return null;
    return corpo;
  } catch {
    return null;
  }
}

/* ---------------- hook ---------------- */

export type EstadoFiltros = {
  filtros: Filtros;
  ativos: Array<{ chave: ChaveFiltro; rotulo: string; valor: string }>;
  definir: (chave: ChaveFiltro, valor: string | null) => void;
  limpar: () => void;
};

/* Estado inicial resolvido no próprio useState (lazy): URL primeiro, espelho
   válido como reserva. Semear em efeito obrigaria um setState no primeiro render
   — renderização em cascata, e a regra do lint está certa em barrar.

   O Único efeito daqui é de SINCRONIZAÇÃO: leva o estado atual para a URL e para
   o espelho. Ele não chama setState, e por isso `definir` e `limpar` só mexem no
   estado — sem escrever na URL por fora, sem dois donos da mesma verdade. */
export function useFiltros(periodo: string): EstadoFiltros {
  const [filtros, setFiltros] = useState<Filtros>(() => {
    const daUrl = lerFiltrosDaUrl();
    if (Object.keys(daUrl).length) return daUrl;
    return lerEspelho()?.filtros ?? {};
  });

  useEffect(() => { sincronizar(periodo, filtros); }, [periodo, filtros]);

  const definir = useCallback((chave: ChaveFiltro, valor: string | null) => {
    setFiltros((atual) => {
      const proximo: Filtros = { ...atual };
      if (valor) proximo[chave] = valor; else delete proximo[chave];
      return proximo;
    });
  }, []);

  /* Limpar zera os filtros e PRESERVA o período (regra explícita do 11a): o
     período não mora neste estado, então a sincronização o reescreve intacto. */
  const limparTudo = useCallback(() => { setFiltros({}); }, []);

  const ativos = CHAVES
    .filter((chave) => filtros[chave])
    .map((chave) => ({
      chave,
      rotulo: CONTROLES.find((c) => c.chave === chave)?.rotulo ?? chave,
      valor: String(filtros[chave]),
    }));

  return { filtros, ativos, definir, limpar: limparTudo };
}
