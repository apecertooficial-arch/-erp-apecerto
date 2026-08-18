"use client";

/* INTELIGÊNCIA — Visão da empresa, primeira tela com DADO REAL (Fase 1, commit 2).
 *
 * Consome /api/inteligencia (commit 1). Nenhum número desta tela é inventado:
 * cada KPI é lido de um bloco do endpoint e, quando o bloco não veio, o cartão
 * mostra "aguardando dado" — nunca 0, nunca estimativa. É a mesma regra dos 10
 * estados aprovados no canvas (2b e 24a).
 *
 * O selo do topo diz de onde vem o que está na tela: "DADO REAL · hh:mm" com a
 * hora de São Paulo, ou "aguardando dado" quando nenhum bloco foi confirmado.
 * Nunca existe selo de demonstração aqui: a tela de produção mostra real ou vazio.
 */

import { useEffect, useMemo, useState } from "react";

import "../../styles/inteligencia.css";

type Periodo = "hoje" | "7d" | "30d" | "90d";
type Numero = number | string | null | undefined;

type Fluxo = {
  leads?: Numero; negocios?: Numero; conversas?: Numero;
  visitasMarcadas?: Numero; visitasRealizadas?: Numero; visitasCanceladas?: Numero;
};
type Empresa = {
  vendas?: Numero; vgv?: Numero; metaVgv?: Numero; atingimentoVgvPct?: Numero;
  receitaBruta?: Numero; fluxo?: Fluxo;
};
type Resposta = {
  periodo?: { chave: string; inicio: string; fim: string; rotulo: string };
  atualizadoEm?: string;
  empresa?: { empresa?: Empresa | null } | Empresa | null;
  digital?: { leadsDoSite?: Numero } | null;
  pendencias?: Array<{ chave: string; texto: string }>;
  error?: string;
};

const PERIODOS: Array<{ id: Periodo; nome: string }> = [
  { id: "hoje", nome: "Hoje" }, { id: "7d", nome: "7 dias" },
  { id: "30d", nome: "30 dias" }, { id: "90d", nome: "90 dias" },
];

/* `tem` distingue "veio zero" de "não veio": zero é resultado, ausência é estado.
   Confundir os dois é exatamente o que a área não pode fazer. */
const tem = (v: Numero) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
const num = (v: Numero) => Number(v) || 0;
const inteiro = (v: Numero) => Math.round(num(v)).toLocaleString("pt-BR");
const dinheiro = (v: Numero) => num(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const umaCasa = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const horaSp = (iso?: string) => iso
  ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
  : "";

/* A RPC canônica devolve { periodo, empresa, corretores }; o endpoint repassa o
   bloco inteiro. Aceitamos as duas formas para a tela não depender do envelope. */
function lerEmpresa(bloco: Resposta["empresa"]): Empresa | null {
  if (!bloco) return null;
  const aninhado = (bloco as { empresa?: Empresa | null }).empresa;
  return (aninhado ?? (bloco as Empresa)) || null;
}

function Kpi({ rotulo, valor, nota }: { rotulo: string; valor: string | null; nota: string }) {
  return (
    <article className={valor === null ? "ape-int-kpi vazio" : "ape-int-kpi"}>
      <span>{rotulo}</span>
      <strong>{valor === null ? "aguardando dado" : valor}</strong>
      <small>{nota}</small>
    </article>
  );
}

export function VisaoEmpresa({ accessToken }: { accessToken: string }) {
  const [periodo, setPeriodo] = useState<Periodo>("30d");
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

  const empresa = useMemo(() => lerEmpresa(dados?.empresa), [dados]);
  const fluxo = empresa?.fluxo ?? {};
  const leadsDoSite = dados?.digital?.leadsDoSite;
  const pendencias = dados?.pendencias ?? [];

  /* Conversões só existem com as DUAS pontas confirmadas e a base maior que zero:
     dividir por ausência produziria um percentual que ninguém pode auditar. */
  const conversao = (parte: Numero, base: Numero) =>
    tem(parte) && tem(base) && num(base) > 0 ? `${umaCasa((100 * num(parte)) / num(base))}%` : null;

  const kpis: Array<{ rotulo: string; valor: string | null; nota: string }> = [
    { rotulo: "Leads recebidos", valor: tem(fluxo.leads) ? inteiro(fluxo.leads) : null, nota: "fora do Bolsão" },
    { rotulo: "Leads do site", valor: tem(leadsDoSite) ? inteiro(leadsDoSite) : null, nota: "registros confirmados em site_leads" },
    { rotulo: "Negócios criados", valor: tem(fluxo.negocios) ? inteiro(fluxo.negocios) : null, nota: "vinculados no Funil 2.0" },
    { rotulo: "Visitas marcadas", valor: tem(fluxo.visitasMarcadas) ? inteiro(fluxo.visitasMarcadas) : null, nota: tem(fluxo.visitasRealizadas) ? `${inteiro(fluxo.visitasRealizadas)} realizadas` : "realizadas aguardando dado" },
    { rotulo: "Vendas e locações", valor: tem(empresa?.vendas) ? inteiro(empresa?.vendas) : null, nota: "somente concluídas" },
    { rotulo: "VGV assinado", valor: tem(empresa?.vgv) ? dinheiro(empresa?.vgv) : null, nota: "não é receita" },
    { rotulo: "Lead → negócio", valor: conversao(fluxo.negocios, fluxo.leads), nota: "negócios ÷ leads do período" },
    { rotulo: "Cobertura da meta", valor: tem(empresa?.metaVgv) && num(empresa?.metaVgv) > 0 ? `${umaCasa(num(empresa?.atingimentoVgvPct))}%` : null, nota: tem(empresa?.metaVgv) && num(empresa?.metaVgv) > 0 ? `meta de ${dinheiro(empresa?.metaVgv)}` : "meta não cadastrada no ERP" },
  ];

  const confirmados = kpis.filter((k) => k.valor !== null).length;
  const etapas: Array<{ nome: string; valor: Numero; base: Numero; nota: string }> = [
    { nome: "Leads recebidos", valor: fluxo.leads, base: fluxo.leads, nota: "base do período" },
    { nome: "Negócios criados", valor: fluxo.negocios, base: fluxo.leads, nota: "sobre os leads" },
    { nome: "Visitas marcadas", valor: fluxo.visitasMarcadas, base: fluxo.negocios, nota: "sobre os negócios" },
    { nome: "Visitas realizadas", valor: fluxo.visitasRealizadas, base: fluxo.visitasMarcadas, nota: "sobre as marcadas" },
    { nome: "Vendas e locações", valor: empresa?.vendas, base: fluxo.visitasRealizadas, nota: "sobre as visitas" },
  ];
  const topoFunil = etapas.reduce((maior, e) => Math.max(maior, num(e.valor)), 0);
  const funilTemDado = etapas.some((e) => tem(e.valor));

  return (
    <main className="ape-int-wrap">
      <header className="ape-int-topo">
        <div>
          <span>INTELIGÊNCIA · EMPRESA</span>
          <h1>Visão da empresa</h1>
          <p>A operação inteira num lugar. Cada número vem do ERP — o que não veio aparece como pendência, não como zero.</p>
        </div>
        <div className="ape-int-selos">
          {confirmados > 0
            ? <span className="ape-int-selo"><i />DADO REAL · {horaSp(dados?.atualizadoEm)}</span>
            : <span className="ape-int-selo aguardando"><i />aguardando dado</span>}
          <div className="ape-int-periodos">
            {PERIODOS.map((p) => (
              <button type="button" key={p.id} className={periodo === p.id ? "ativo" : ""}
                onClick={() => { setEstado("carregando"); setPeriodo(p.id); }}>{p.nome}</button>
            ))}
          </div>
        </div>
      </header>

      {estado === "falhou" && (
        <div className="ape-int-erro" role="alert">
          <div>
            <b>Não foi possível confirmar os dados agora.</b>{" "}
            <span>{dados ? "A última consulta válida continua visível." : "Nenhum número foi exibido sem confirmação."}</span>
          </div>
          <button type="button" onClick={() => { setEstado("carregando"); setTentativa((v) => v + 1); }}>Tentar novamente</button>
        </div>
      )}

      {estado === "carregando" && !dados && (
        <div className="ape-int-skeleton"><i /><i style={{ width: "72%" }} /><i style={{ width: "54%" }} /></div>
      )}

      {dados && (
        <>
          <section className="ape-int-secao">
            <span>OS NÚMEROS DO PERÍODO</span>
            <h2>Como a imobiliária está girando</h2>
            <div className="ape-int-kpis">
              {kpis.map((k) => <Kpi key={k.rotulo} rotulo={k.rotulo} valor={k.valor} nota={k.nota} />)}
            </div>
          </section>

          <section className="ape-int-secao">
            <span>DO LEAD À CHAVE NA MÃO</span>
            <h2>Onde as pessoas param</h2>
            {funilTemDado ? (
              <div className="ape-int-linhas">
                {etapas.map((e) => (
                  <div className="ape-int-linha" key={e.nome}>
                    <span>{e.nome}</span>
                    <span className="ape-int-barra">
                      <i style={{ width: `${topoFunil > 0 ? Math.min(100, (100 * num(e.valor)) / topoFunil) : 0}%` }} />
                    </span>
                    <b>{tem(e.valor) ? inteiro(e.valor) : "—"}</b>
                    <em>{conversao(e.valor, e.base) ?? "—"}</em>
                  </div>
                ))}
                <small>Taxa sempre sobre a etapa anterior. Volume do período, não coorte das mesmas pessoas.</small>
              </div>
            ) : (
              <div className="ape-int-vazio">
                <b>Sem movimento neste período</b>
                <span>Nenhuma etapa do funil registrou volume entre {dados.periodo?.inicio} e {dados.periodo?.fim}.</span>
              </div>
            )}
          </section>

          {pendencias.length > 0 && (
            <section className="ape-int-secao">
              <span>O QUE AINDA NÃO ESTÁ LIGADO</span>
              <h2>Pendências declaradas</h2>
              <div className="ape-int-pendencias">
                {pendencias.map((p) => (
                  <article className="ape-int-pendencia" key={p.chave}>
                    <b>{p.chave}</b>
                    <span>{p.texto}</span>
                  </article>
                ))}
              </div>
            </section>
          )}

          {dados.periodo && (
            <small style={{ fontSize: 11, color: "#9A938B" }}>
              Período: {dados.periodo.inicio} até {dados.periodo.fim} (fim exclusivo) · fuso America/Sao_Paulo · {confirmados} de {kpis.length} indicadores confirmados.
            </small>
          )}
        </>
      )}
    </main>
  );
}
