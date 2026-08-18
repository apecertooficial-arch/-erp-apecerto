"use client";

/* CONTRATO DE DADO AUSENTE — regra do Romulo, decidida antes de qualquer tela.
 *
 * "Se o dado não existe eu não quero que a tela suma. Quero que fique com uma
 * informação de que ainda não tem esse dado, ou que ele é 0, ou até mesmo um
 * tracinho -."
 *
 * Então: NENHUM bloco desta área é condicional ao dado. O layout é sempre
 * completo. O que muda é o VALOR:
 *
 *   número existe .................. mostra o número
 *   número existe e é zero ......... mostra 0 (zero é resposta, não ausência)
 *   fonte não respondeu ............ mostra "—" + selo "aguardando conexão"
 *   fonte não existe ainda ......... mostra "—" + selo com o motivo declarado
 *   sem permissão .................. mostra "—" + selo "sem permissão"
 *
 * O que é proibido: esconder cartão, colapsar seção, estimar por média,
 * repetir o valor de outro período e mostrar zero para dado que não veio.
 */

import type { ReactNode } from "react";

/** Dado que pode não existir. `null` e `undefined` = ausente; 0 = zero de verdade. */
export type Talvez<T> = T | null | undefined;

export const TRACO = "—";

export function existe<T>(valor: Talvez<T>): valor is T {
  return valor !== null && valor !== undefined && !(typeof valor === "number" && Number.isNaN(valor));
}

/** Formatações da área. Todas devolvem o tracinho quando o dado não veio. */
export const fmt = {
  numero(valor: Talvez<number>): string {
    return existe(valor) ? new Intl.NumberFormat("pt-BR").format(valor) : TRACO;
  },
  inteiro(valor: Talvez<number>): string {
    return existe(valor) ? new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(valor) : TRACO;
  },
  porcento(valor: Talvez<number>, casas = 1): string {
    return existe(valor) ? `${valor.toFixed(casas).replace(".", ",")}%` : TRACO;
  },
  pontos(valor: Talvez<number>, casas = 1): string {
    if (!existe(valor)) return TRACO;
    const s = `${Math.abs(valor).toFixed(casas).replace(".", ",")} pp`;
    return valor > 0 ? `▲ +${s}` : valor < 0 ? `▼ −${s}` : s;
  },
  /** Dinheiro curto, como nas telas aprovadas: R$ 18,4 mi · R$ 812,0 mil · R$ 4.200. */
  dinheiro(valor: Talvez<number>): string {
    if (!existe(valor)) return TRACO;
    if (Math.abs(valor) >= 1_000_000) return `R$ ${(valor / 1_000_000).toFixed(1).replace(".", ",")} mi`;
    if (Math.abs(valor) >= 100_000) return `R$ ${(valor / 1_000).toFixed(1).replace(".", ",")} mil`;
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(valor);
  },
  /** Minutos em linguagem de operação: 9 min · 2h10. */
  duracaoMin(valor: Talvez<number>): string {
    if (!existe(valor)) return TRACO;
    if (valor < 60) return `${Math.round(valor)} min`;
    const h = Math.floor(valor / 60);
    const m = Math.round(valor % 60);
    return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
  },
  hora(iso: Talvez<string>): string {
    if (!existe(iso)) return TRACO;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? TRACO : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  },
};

export type MotivoPendencia = "conexao" | "fonte" | "permissao" | "amostra" | "integracao";

const textoPendencia: Record<MotivoPendencia, string> = {
  conexao: "aguardando conexão",
  fonte: "fonte não respondeu",
  permissao: "sem permissão para este dado",
  amostra: "amostra insuficiente",
  integracao: "integração não conectada",
};

/** Selo pequeno que explica POR QUE o valor está com tracinho. */
export function SeloPendencia({ motivo = "conexao", detalhe }: { motivo?: MotivoPendencia; detalhe?: string }) {
  return (
    <span className="int-pendencia" title={detalhe ?? textoPendencia[motivo]}>
      {detalhe ?? textoPendencia[motivo]}
    </span>
  );
}

/* Valor de KPI. Sempre renderiza o bloco: o rótulo e o pé continuam lá mesmo
   sem número. `bruto` só é usado para decidir presença; o texto exibido vem de
   `texto` (já formatado pelo fmt), para a tela não repetir regra de formato. */
export function Valor({
  bruto,
  texto,
  motivo = "conexao",
  detalhe,
  tom,
}: {
  bruto: Talvez<number | string>;
  texto?: string;
  motivo?: MotivoPendencia;
  detalhe?: string;
  tom?: "neutro" | "ruim" | "bom" | "atencao";
}) {
  const tem = existe(bruto);
  return (
    <>
      <strong className={`int-valor${tem && tom && tom !== "neutro" ? ` int-valor-${tom}` : ""}${tem ? "" : " int-valor-vazio"}`}>
        {tem ? (texto ?? String(bruto)) : TRACO}
      </strong>
      {tem ? null : <SeloPendencia motivo={motivo} detalhe={detalhe} />}
    </>
  );
}

/* Bloco que dependeria de uma fonte inteira (tabela, gráfico, lista). O bloco
   NÃO desaparece: mantém título e moldura e explica o que falta. */
export function BlocoSemDado({
  titulo,
  motivo = "conexao",
  detalhe,
  acao,
}: {
  titulo?: string;
  motivo?: MotivoPendencia;
  detalhe?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="int-sem-dado" role="status">
      <strong>{titulo ?? "Ainda não temos esse dado"}</strong>
      <span>{detalhe ?? `${textoPendencia[motivo]} — o bloco fica no lugar e volta a preencher sozinho quando a fonte responder. Nenhum número é estimado.`}</span>
      {acao}
    </div>
  );
}

/** Lista de pendências declaradas no rodapé de cada tela. */
export function RodapeFontes({ fontes, pendencias, atualizado }: { fontes: string[]; pendencias?: string[]; atualizado?: string }) {
  return (
    <div className="int-rodape-fontes">
      <span>
        <b>Fontes:</b> {fontes.length ? fontes.join(" · ") : TRACO}
      </span>
      {pendencias && pendencias.length ? (
        <span className="int-rodape-pendencias">
          <b>Pendências:</b> {pendencias.join(" · ")}
        </span>
      ) : null}
      <span className="int-rodape-hora">atualizado {atualizado ?? TRACO}</span>
    </div>
  );
}
