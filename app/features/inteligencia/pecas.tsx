"use client";

/* PEÇAS DAS TELAS DA INTELIGÊNCIA — a biblioteca aprovada no artboard 30b.
 *
 * As 17 telas são compostas destas peças. Toda peça respeita o contrato de dado
 * ausente (dado.tsx): o bloco existe sempre; quando o número não veio, aparece
 * "—" com o motivo. Nenhuma peça se esconde sozinha.
 */

import type { ReactNode } from "react";
import "../../styles/inteligencia-pecas.css";
import { BlocoSemDado, existe, TRACO, Valor, type MotivoPendencia, type Talvez } from "./dado";

export type Tom = "bom" | "ruim" | "aviso" | "roxo" | "neutro";
export type Tile = "laranja" | "roxo" | "verde" | "vermelho" | "ambar";

export function Cabecalho({ eyebrow, titulo, nota, cor = "#FF7000" }: { eyebrow: string; titulo: string; nota?: string; cor?: string }) {
  return (
    <div className="intp-cab">
      <div>
        <span className="intp-cab-eyebrow" style={{ color: cor }}>{eyebrow}</span>
        <h2>{titulo}</h2>
      </div>
      {nota ? <span className="intp-cab-nota">{nota}</span> : null}
    </div>
  );
}

export type Kpi = {
  rotulo: string;
  /** Valor cru: null/undefined = ausente; 0 = zero de verdade. */
  bruto: Talvez<number | string>;
  /** Texto já formatado (use o fmt de dado.tsx). */
  texto?: string;
  chip?: string;
  chipTom?: Tom;
  foot?: string;
  tom?: "neutro" | "ruim" | "bom" | "atencao";
  tile?: Tile;
  icone?: string;
  motivo?: MotivoPendencia;
  detalhe?: string;
};

export function GradeKpis({ itens, colunas = 4 }: { itens: Kpi[]; colunas?: number }) {
  return (
    <div className="intp-grade" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }}>
      {itens.map((k) => (
        <div className="intp-kpi" key={k.rotulo}>
          <div className="intp-kpi-topo">
            {k.tile ? <span className={`intp-tile tile-${k.tile}`} aria-hidden="true">{k.icone ?? ""}</span> : null}
            <span className="intp-kpi-rotulo">{k.rotulo}</span>
          </div>
          <Valor bruto={k.bruto} texto={k.texto} tom={k.tom} motivo={k.motivo} detalhe={k.detalhe} />
          {k.chip ? <span className={`intp-kpi-chip tom-${k.chipTom ?? "neutro"}`}>{k.chip}</span> : null}
          {k.foot ? <small className="intp-kpi-foot">{k.foot}</small> : null}
        </div>
      ))}
    </div>
  );
}

export type Etapa = {
  nome: string;
  /** 0–100. Ausente = barra vazia, texto "—". */
  largura: Talvez<number>;
  volume: Talvez<number>;
  volumeTexto?: string;
  taxa?: string;
  perda?: string;
  roxo?: boolean;
  perdaFinal?: boolean;
  detalhes?: () => void;
};

export function Funil({ etapas, foot }: { etapas: Etapa[]; foot?: string }) {
  const semNenhum = etapas.every((e) => !existe(e.volume));
  return (
    <div className="intp-funil">
      {etapas.map((e) => (
        <div className={`intp-etapa${e.perdaFinal ? " intp-etapa-final" : ""}`} key={e.nome}>
          <span className="intp-etapa-nome">{e.nome}</span>
          <span>
            <span
              className={`intp-etapa-barra${e.roxo ? " roxo" : ""}${e.perdaFinal ? " perda" : ""}`}
              style={{ width: existe(e.largura) ? `${Math.max(2, Math.min(100, e.largura))}%` : "2%", opacity: existe(e.largura) ? 1 : 0.35 }}
            />
          </span>
          <b className="intp-etapa-vol">{existe(e.volume) ? (e.volumeTexto ?? String(e.volume)) : TRACO}</b>
          <span className="intp-etapa-taxa">{e.taxa ?? TRACO}</span>
          <span className="intp-etapa-perda">{e.perda ?? ""}</span>
          {e.detalhes ? (
            <button type="button" onClick={e.detalhes}>detalhes</button>
          ) : (
            <span />
          )}
        </div>
      ))}
      {semNenhum ? (
        <BlocoSemDado titulo="Funil sem dado no recorte atual" detalhe="As etapas continuam listadas, com “—” em cada uma. Nenhuma etapa foi removida e nada foi estimado." />
      ) : null}
      {foot ? <small className="intp-kpi-foot">{foot}</small> : null}
    </div>
  );
}

export type Celula = { texto: string; forte?: boolean; sub?: string; num?: boolean; chip?: string; chipTom?: Tom; cor?: string };
export type LinhaTabela = { chave: string; celulas: Celula[]; destaque?: boolean; abrir?: () => void };

export function Tabela({
  colunas,
  linhas,
  foot,
  ordenadaEm,
  acaoFinal,
}: {
  colunas: { titulo: string; num?: boolean }[];
  linhas: LinhaTabela[];
  foot?: string;
  ordenadaEm?: string;
  acaoFinal?: ReactNode;
}) {
  return (
    <div className="intp-tabela-caixa">
      <table className="intp-tabela">
        <thead>
          <tr>
            {colunas.map((c) => (
              <th key={c.titulo} className={`${c.num ? "num" : ""}${c.titulo === ordenadaEm ? " ordenada" : ""}`}>
                {c.titulo}
                {c.titulo === ordenadaEm ? " ↓" : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.chave} className={l.destaque ? "destaque" : ""} onClick={l.abrir}>
              {l.celulas.map((c, i) => (
                <td key={`${l.chave}-${i}`} className={`${c.num ? "num" : ""}${c.forte ? " forte" : ""}`} style={c.cor ? { color: c.cor } : undefined}>
                  {c.chip ? <span className={`intp-cartao-chip tom-${c.chipTom ?? "neutro"}`}>{c.chip}</span> : c.texto}
                  {c.sub ? <small> {c.sub}</small> : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {linhas.length === 0 ? (
        <BlocoSemDado titulo="Nenhuma linha no recorte atual" detalhe="A tabela continua na tela com as colunas declaradas. Ajuste período ou filtros — nada foi ocultado." />
      ) : null}
      <div className="intp-tabela-foot">
        <span>{foot ?? ""}</span>
        {acaoFinal ? <span style={{ marginLeft: "auto" }}>{acaoFinal}</span> : null}
      </div>
    </div>
  );
}

export type LinhaCartao = { l: string; r: string; sub?: string; corR?: string; abrir?: () => void };
export type CartaoLista = {
  titulo: string;
  chip?: string;
  chipTom?: Tom;
  linhas: LinhaCartao[];
  foot?: string;
  link?: { rotulo: string; go: () => void };
  fundo?: "branco" | "roxo" | "tint-roxo";
};

export function CartoesLista({ cartoes, colunas = 3 }: { cartoes: CartaoLista[]; colunas?: number }) {
  return (
    <div className="intp-grade" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }}>
      {cartoes.map((c) => {
        const escuro = c.fundo === "roxo";
        return (
          <div
            className="intp-cartao"
            key={c.titulo}
            style={
              escuro
                ? { background: "#8B00CC", color: "#fff", boxShadow: "0 12px 28px rgba(139,0,204,0.24)" }
                : c.fundo === "tint-roxo"
                  ? { background: "#F7ECFC", color: "#66009A", boxShadow: "none" }
                  : undefined
            }
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="intp-cartao-titulo">{c.titulo}</span>
              {c.chip ? <span className={`intp-cartao-chip tom-${c.chipTom ?? "neutro"}`}>{c.chip}</span> : null}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {c.linhas.length === 0 ? (
                <span className="intp-linha-sub">sem dado no recorte — {TRACO}</span>
              ) : (
                c.linhas.map((r) =>
                  r.abrir ? (
                    <button className="intp-linha-btn" type="button" key={r.l} onClick={r.abrir}>
                      <div className="intp-linha-kv">
                        <span style={escuro ? { color: "rgba(255,255,255,0.85)" } : undefined}>{r.l}</span>
                        <b style={escuro ? { color: "#fff" } : r.corR ? { color: r.corR } : undefined}>{r.r}</b>
                      </div>
                      {r.sub ? <small className="intp-linha-sub">{r.sub}</small> : null}
                    </button>
                  ) : (
                    <div key={r.l}>
                      <div className="intp-linha-kv">
                        <span style={escuro ? { color: "rgba(255,255,255,0.85)" } : undefined}>{r.l}</span>
                        <b style={escuro ? { color: "#fff" } : r.corR ? { color: r.corR } : undefined}>{r.r}</b>
                      </div>
                      {r.sub ? <small className="intp-linha-sub">{r.sub}</small> : null}
                    </div>
                  ),
                )
              )}
            </div>
            {c.foot ? <small className="intp-cartao-foot" style={escuro ? { color: "rgba(255,255,255,0.75)" } : undefined}>{c.foot}</small> : null}
            {c.link ? (
              <button className="int-link" type="button" onClick={c.link.go} style={{ marginTop: "auto", alignSelf: "flex-start", color: escuro ? "#fff" : undefined, fontWeight: 700 }}>
                {c.link.rotulo}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function Banner({
  tom = "aviso",
  forte,
  texto,
  botao,
  stats,
}: {
  tom?: "aviso" | "roxo" | "tint-roxo";
  forte: string;
  texto: string;
  botao?: { rotulo: string; go?: () => void };
  stats?: { v: string; l: string }[];
}) {
  return (
    <div className={`intp-banner ${tom}`}>
      <span className="intp-banner-texto">
        <b>{forte}</b> {texto}
      </span>
      {(stats ?? []).map((s) => (
        <span className="intp-banner-stat" key={s.l}>
          <strong>{s.v}</strong>
          <small>{s.l}</small>
        </span>
      ))}
      {botao ? (
        <button type="button" onClick={botao.go} style={{ color: tom === "roxo" ? "#66009A" : tom === "tint-roxo" ? "#66009A" : "#7A5E12" }}>
          {botao.rotulo}
        </button>
      ) : null}
    </div>
  );
}

export function ChipsEventos({ titulo, itens, foot }: { titulo: string; itens: string[]; foot?: string }) {
  return (
    <div className="intp-cartao">
      <span className="intp-cartao-titulo">{titulo}</span>
      <div className="intp-chips">
        {itens.length ? itens.map((i) => <span className="intp-chip-mono" key={i}>{i}</span>) : <span className="intp-linha-sub">{TRACO} nenhum evento declarado</span>}
      </div>
      {foot ? <small className="intp-kpi-foot">{foot}</small> : null}
    </div>
  );
}

export type Detalhe = { titulo: string; sub: string; linhas: [string, string][]; aviso: string };

/** Linhas clicáveis + detalhe ao lado — o par das telas de operação (15a–21a). */
export function ListaComDetalhe({
  eyebrow,
  titulo,
  nota,
  linhas,
  detalhe,
  fechar,
  rodape,
}: {
  eyebrow: string;
  titulo: string;
  nota?: string;
  linhas: { chave: string; nome: string; meio: string; fim: string; cor: string; abrir: () => void; ativa?: boolean }[];
  detalhe: Detalhe | null;
  fechar: () => void;
  rodape?: ReactNode;
}) {
  return (
    <div className="intp-duas">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Cabecalho eyebrow={eyebrow} titulo={titulo} cor="#8B00CC" />
        <div className="intp-cartao">
          {linhas.length === 0 ? (
            <BlocoSemDado titulo="Nada a listar no recorte atual" detalhe="A seção continua aqui. Sem item, o certo é dizer isso — não esconder o bloco." />
          ) : (
            linhas.map((l) => (
              <button className="intp-linha-btn" type="button" key={l.chave} onClick={l.abrir} style={{ background: l.ativa ? "#FFF9F4" : undefined, borderRadius: 12, padding: "8px 6px", minHeight: 44 }}>
                <div className="intp-linha-kv" style={{ alignItems: "center" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 9, fontWeight: 700, color: "#1F1C1A" }}>
                    <span style={{ width: 9, height: 9, borderRadius: 999, background: l.cor, flex: "none" }} />
                    {l.nome}
                  </span>
                  <span style={{ flex: "none", color: "#6E6760", fontWeight: 400 }}>{l.meio}</span>
                  <b style={{ width: 92, textAlign: "right" }}>{l.fim}</b>
                </div>
              </button>
            ))
          )}
          {nota ? <small className="intp-kpi-foot">{nota}</small> : null}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {detalhe ? (
          <div className="intp-detalhe">
            <div className="intp-detalhe-topo">
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="rot">DETALHE</span>
                <b>{detalhe.titulo}</b>
                <small>{detalhe.sub}</small>
              </div>
              <button className="intp-detalhe-fechar" type="button" onClick={fechar} aria-label="Fechar detalhe">✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {detalhe.linhas.map(([k, v]) => (
                <div className="intp-detalhe-linha" key={k}>
                  <span>{k}</span>
                  <b>{v}</b>
                </div>
              ))}
            </div>
            <div className="intp-detalhe-aviso">{detalhe.aviso}</div>
          </div>
        ) : (
          <div className="intp-vazio-detalhe">
            <b>Clique em uma linha</b>
            <small>O detalhe abre aqui, com a evidência e o aviso de privacidade da tela.</small>
          </div>
        )}
        {rodape}
      </div>
    </div>
  );
}
