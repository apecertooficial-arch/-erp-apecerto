"use client";

/* 7 · SARA — artboard 8a, com o BANNER ROXO e as duas colunas do protótipo.
 *
 * Estrutura do desenho:
 *   1. banner roxo: leitura do período à esquerda, três estatísticas à direita
 *   2. faixa 1,15fr · 1fr
 *      ESQUERDA: funil da Sara em ROXO (7 etapas) · KPIs em duas fileiras
 *        (aberturas, buscas, busca concluída, média de resultados / buscas sem
 *        resultado, erros, celular vs. desktop)
 *      DIREITA: o que as pessoas pedem — temas · bairros · finalidade em barra ·
 *        faixas · resultados mais clicados · aviso de privacidade · “Onde a
 *        conversa para”
 *   3. rodapé de fontes
 *
 * O texto digitado nunca aparece: só categoria, tamanho e agregados autorizados.
 */

import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes, Valor } from "../dado";
import { Cabecalho, Funil, type Etapa } from "../pecas";

type Dados = {
  aberturas: number | null;
  buscas: number | null;
  buscaConcluida: number | null;
  mediaResultados: number | null;
  semResultado: number | null;
  erros: number | null;
  dispositivos: { l: string; r: string }[];
  etapas: { nome: string; volume: number | null; largura: number | null; taxa?: string; perda?: string }[];
  temas: { l: string; r: string }[];
  bairros: { l: string; r: string; outros?: boolean }[];
  finalidade: { locacao: number; venda: number };
  faixas: { l: string; r: string }[];
  cliques: { imovel: string; apresentado: number | null; clicado: number | null; intencao: number | null; leads: number | null }[];
  atualizado: string;
};

export function Sara({ recorte }: PropsTela) {
  const d = usarDados();

  const etapas: Etapa[] = d.etapas.map((e) => ({
    nome: e.nome,
    largura: e.largura,
    volume: e.volume,
    volumeTexto: fmt.inteiro(e.volume),
    taxa: e.taxa,
    perda: e.perda,
    roxo: true,
    detalhes: () => recorte.filtrar(`Etapa da Sara: ${e.nome}`),
  }));

  return (
    <div className="int-secao">
      {/* 1 · BANNER ROXO */}
      <section style={{ background: "#8B00CC", borderRadius: 24, padding: "20px 26px", color: "#fff", display: "flex", gap: 24, alignItems: "center", boxShadow: "0 12px 28px rgba(139,0,204,0.24)", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.75)" }}>SARA · LEITURA DO PERÍODO</span>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, lineHeight: 1.4, letterSpacing: "-0.01em", color: "#fff" }}>
            A Sara respondeu 91% das buscas e gerou 47 leads e 28 negócios. O gargalo: quem abre o imóvel raramente age dentro da conversa — 476 pessoas saíram entre ver e agir.
          </h2>
        </div>
        <div style={{ display: "flex", gap: 18, flex: "none", textAlign: "center" }}>
          {[
            { v: "1.482", l: "buscas" },
            { v: "47", l: "leads" },
            { v: "28", l: "negócios" },
          ].map((s) => (
            <div key={s.l}>
              <strong style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#fff" }}>{s.v}</strong>
              <br />
              <small style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>{s.l}</small>
            </div>
          ))}
        </div>
      </section>

      <div className="int-duas par-115">
        {/* ESQUERDA — funil roxo e as duas fileiras de indicadores */}
        <div className="int-col">
          <Cabecalho eyebrow="FUNIL DA SARA" titulo="Da conversa ao negócio" cor="#8B00CC" />
          <Funil etapas={etapas} foot="taxa sobre a etapa anterior · roxo = funil da Sara, para não confundir com o funil laranja do site · erro de conversa não é contado como abandono da pessoa" />

          <div className="intp-grade" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
            <div className="intp-kpi">
              <span className="intp-kpi-rotulo">Aberturas</span>
              <Valor bruto={d.aberturas} texto={fmt.inteiro(d.aberturas)} />
              <span className="intp-kpi-chip tom-bom">▲ +18%</span>
            </div>
            <div className="intp-kpi">
              <span className="intp-kpi-rotulo">Buscas</span>
              <Valor bruto={d.buscas} texto={fmt.inteiro(d.buscas)} />
              <span className="intp-kpi-chip tom-bom">▲ +11%</span>
            </div>
            <div className="intp-kpi">
              <span className="intp-kpi-rotulo">Busca concluída</span>
              <Valor bruto={d.buscaConcluida} texto={fmt.porcento(d.buscaConcluida, 0)} />
              <small className="intp-kpi-foot">com pelo menos 1 resultado</small>
            </div>
            <div className="intp-kpi">
              <span className="intp-kpi-rotulo">Média de resultados</span>
              <Valor bruto={d.mediaResultados} texto={d.mediaResultados === null ? undefined : d.mediaResultados.toFixed(1).replace(".", ",")} />
              <small className="intp-kpi-foot">imóveis por busca respondida</small>
            </div>
          </div>

          <div className="intp-grade" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <div className="intp-kpi">
              <span className="intp-kpi-rotulo">Buscas sem resultado</span>
              <Valor bruto={d.semResultado} texto={fmt.inteiro(d.semResultado)} tom="ruim" />
              <button type="button" className="int-link" style={{ fontWeight: 700, alignSelf: "flex-start" }} onClick={() => recorte.irPara("proprietarios")}>Vira demanda sem estoque →</button>
            </div>
            <div className="intp-kpi">
              <span className="intp-kpi-rotulo">Erros da Sara</span>
              <Valor bruto={d.erros} texto={fmt.inteiro(d.erros)} tom="atencao" />
              <small className="intp-kpi-foot">timeout 12 · sem resposta 6 · outros 3</small>
            </div>
            <div className="intp-kpi">
              <span className="intp-kpi-rotulo">Celular vs. desktop</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {d.dispositivos.map((x) => (
                  <button key={x.l} type="button" className="intp-linha-btn" onClick={() => recorte.filtrar(`Dispositivo: ${x.l.toLocaleLowerCase("pt-BR")}`)}>
                    <div className="intp-linha-kv">
                      <span>{x.l}</span>
                      <b>{x.r}</b>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* DIREITA — o que as pessoas pedem */}
        <div className="int-col">
          <Cabecalho eyebrow="O QUE AS PESSOAS PEDEM" titulo="Sempre em agregado — nunca o texto digitado" cor="#8B00CC" />
          <div className="intp-grade" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="intp-cartao">
              <span className="intp-cartao-titulo">Temas</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {d.temas.map((t) => (
                  <button key={t.l} type="button" className="intp-linha-btn" onClick={() => recorte.filtrar(`Tema: ${t.l}`)}>
                    <div className="intp-linha-kv">
                      <span>{t.l}</span>
                      <b>{t.r}</b>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="intp-cartao">
              <span className="intp-cartao-titulo">Bairros</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {d.bairros.map((b) => (
                  <button key={b.l} type="button" className="intp-linha-btn" onClick={() => recorte.filtrar(`Bairro: ${b.l}`)}>
                    <div className="intp-linha-kv">
                      <span style={b.outros ? { color: "#9A938B" } : undefined}>{b.l}</span>
                      <b style={b.outros ? { color: "#6E6760" } : undefined}>{b.r}</b>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="intp-cartao">
              <span className="intp-cartao-titulo">Finalidade</span>
              <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", gap: 2, marginTop: 4 }}>
                <span style={{ flex: d.finalidade.locacao, background: "#8B00CC", borderRadius: 999 }} />
                <span style={{ flex: d.finalidade.venda, background: "#FF7000", borderRadius: 999 }} />
              </div>
              <div style={{ display: "flex", gap: 14, fontSize: 12, fontWeight: 600, color: "#6E6760" }}>
                <span><span style={{ color: "#8B00CC" }}>●</span> Locação {d.finalidade.locacao}%</span>
                <span><span style={{ color: "#FF7000" }}>●</span> Venda {d.finalidade.venda}%</span>
              </div>
            </div>

            <div className="intp-cartao">
              <span className="intp-cartao-titulo">Faixas mais pedidas</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {d.faixas.map((f) => (
                  <button key={f.l} type="button" className="intp-linha-btn" onClick={() => recorte.filtrar(`Faixa: ${f.l}`)}>
                    <div className="intp-linha-kv">
                      <span>{f.l}</span>
                      <b>{f.r}</b>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="intp-cartao" style={{ padding: "16px 18px" }}>
            <span className="intp-cartao-titulo">Resultados mais clicados</span>
            <table className="intp-tabela">
              <thead>
                <tr>
                  <th>Imóvel</th>
                  <th className="num">Apresentado</th>
                  <th className="num">Clicado</th>
                  <th className="num">Intenção</th>
                  <th className="num">Leads</th>
                </tr>
              </thead>
              <tbody>
                {d.cliques.map((c) => (
                  <tr key={c.imovel} onClick={() => recorte.irPara("imoveis")}>
                    <td data-rotulo="Imóvel" className="forte">{c.imovel}</td>
                    <td data-rotulo="Apresentado" className="num">{fmt.inteiro(c.apresentado)}</td>
                    <td data-rotulo="Clicado" className="num">{fmt.inteiro(c.clicado)}</td>
                    <td data-rotulo="Intenção" className="num">{fmt.inteiro(c.intencao)}</td>
                    <td data-rotulo="Leads" className="num forte">{fmt.inteiro(c.leads)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ background: "#FAF8F6", border: "1px solid #F2EFEC", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8, alignItems: "flex-start" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#66009A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 2 }} aria-hidden="true">
              <path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <small style={{ fontSize: 11, color: "#6E6760", lineHeight: 1.5 }}>
              O texto digitado pelo usuário é privado e nunca aparece aqui — só a categoria da consulta, o tamanho e agregados autorizados.
            </small>
          </div>

          <div className="intp-cartao" style={{ background: "#F7ECFC", color: "#66009A", boxShadow: "none", padding: "16px 18px", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.3.3.5.7.5 1.1h6c0-.4.2-.8.5-1.1A6 6 0 0 0 12 3Z" />
              </svg>
              <span className="intp-cartao-titulo" style={{ color: "#66009A" }}>Onde a conversa para</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "#66009A", lineHeight: 1.5 }}>
              A maior queda é entre <b>ver o imóvel e agir</b> (−476). As ações de contato ficam fora da conversa — testar WhatsApp e agendamento dentro da própria Sara.
            </p>
          </div>
        </div>
      </div>

      <RodapeFontes
        fontes={["eventos da Sara", "coleta própria", "CRM Funil 2.0"]}
        pendencias={["12 timeouts em investigação", "texto digitado não é armazenado (decisão de privacidade)"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

/* PONTO ÚNICO DE TROCA PARA O BANCO. */
function usarDados(): Dados {
  return demo;
}

const demo: Dados = {
  aberturas: 2_104,
  buscas: 1_482,
  buscaConcluida: 91,
  mediaResultados: 6.4,
  semResultado: 133,
  erros: 21,
  dispositivos: [
    { l: "Celular", r: "1.678 ab. · 38 leads" },
    { l: "Desktop", r: "426 ab. · 9 leads" },
  ],
  etapas: [
    { nome: "1 · Sara aberta", volume: 2_104, largura: 100, taxa: "100%" },
    { nome: "2 · Busca enviada", volume: 1_482, largura: 70, taxa: "70,4%", perda: "−622" },
    { nome: "3 · Resultados apresentados", volume: 1_349, largura: 64, taxa: "91,0%", perda: "−133" },
    { nome: "4 · Imóvel aberto", volume: 864, largura: 41, taxa: "64,0%", perda: "−485" },
    { nome: "5 · Ação de intenção", volume: 388, largura: 18, taxa: "44,9%", perda: "−476" },
    { nome: "6 · Lead gerado", volume: 47, largura: 6, taxa: "12,1%", perda: "−341" },
    { nome: "7 · Negócio criado", volume: 28, largura: 4, taxa: "59,6%", perda: "−19" },
  ],
  temas: [
    { l: "2 dormitórios", r: "512" },
    { l: "mobiliado", r: "448" },
    { l: "perto do metrô", r: "302" },
    { l: "aceita pets", r: "188" },
  ],
  bairros: [
    { l: "Moema Pássaros", r: "44%" },
    { l: "Moema Índios", r: "30%" },
    { l: "Vila Nova Conceição", r: "14%" },
    { l: "Outros", r: "12%", outros: true },
  ],
  finalidade: { locacao: 58, venda: 42 },
  faixas: [
    { l: "R$ 4–6 mil/mês", r: "38%" },
    { l: "R$ 800 mil–1,2 mi", r: "27%" },
    { l: "até R$ 4 mil/mês", r: "21%" },
  ],
  cliques: [
    { imovel: "Apê Canário 71 · MO-104", apresentado: 412, clicado: 186, intencao: 64, leads: 12 },
    { imovel: "Apê Pavão 88 · MO-097", apresentado: 388, clicado: 152, intencao: 51, leads: 9 },
    { imovel: "Apê Andorinha 55 · MO-092", apresentado: 296, clicado: 104, intencao: 32, leads: 6 },
  ],
  atualizado: "14:28",
};
