"use client";

/* 16 · FINANCEIRO E COMISSÕES — artboard 20a. Agora lê dado real via
 * /api/inteligencia/financeiro (RPC intel_financeiro). Cascata VGV → contribuição.
 * percentual_comissao é fração no banco (0,04 = 4%). "Comissões calculadas" = o
 * que vai para pessoas (papel ≠ apecerto); contribuição = parte retida − custos.
 * Lucro líquido (impostos/despesas fixas) não existe no banco → segue —.
 * */

import "../../../styles/inteligencia-cascata.css";
import type { PropsTela } from "../CascaInteligencia";
import { BlocoSemDado, fmt, RodapeFontes } from "../dado";
import { EsqueletoAviso, EsqueletoCartoes, EsqueletoTabela } from "../esqueleto";
import { Banner, Cabecalho, Tabela } from "../pecas";
import { useDadosInteligencia } from "../useDadosInteligencia";
import type { FinanceiroPayload } from "../../../lib/inteligencia/tipos";

type Degrau = { chave: string; rotulo: string; tipo: "entra" | "sai" | "sobra"; valor: number | null; largura: number; nota: string };
type Venda = { nome: string; codigo: string; vgv: number | null; percentual: number | null; receita: number | null; comissoes: number | null; custos: number | null; contribuicao: number | null; pagamento: "pago" | "a pagar" | "bloqueado" | "divergente"; semCusto?: boolean };
type Participante = { nome: string; papel: string; calculada: number | null; paga: number | null; pendente: number | null; excedente: number | null };
type Dados = { degraus: Degrau[]; vendas: Venda[]; participantes: Participante[]; totalVendas: number; conciliacaoInconsistente: boolean; excedente: number; vendasDivergentes: number; atualizado: string };

export function FinanceiroComissoes({ accessToken, recorte }: PropsTela) {
  const leitura = useDadosInteligencia<FinanceiroPayload>("financeiro", accessToken, recorte);

  if (leitura.estado === "carregando") {
    return <div className="int-secao"><EsqueletoAviso texto="Conciliando vendas, comissões e pagamentos." /><EsqueletoCartoes colunas={3} linhas={4} /><EsqueletoTabela colunas={8} linhas={4} /></div>;
  }
  if (leitura.estado === "erro") {
    return <div className="int-secao"><BlocoSemDado titulo="Não foi possível atualizar o Financeiro" motivo="fonte" detalhe={`${leitura.erro ?? "A fonte não respondeu."} Saldos não foram estimados nem repetidos.`} /></div>;
  }
  const d = mapearFinanceiro(leitura.payload);

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="CASCATA FINANCEIRA" titulo="Do VGV até o que sobra" nota={`${recorte.periodo}${recorte.compararAnterior ? " · vs. anterior" : ""}`} />
      <div className="intp-casc">
        {d.degraus.map((g) => (
          <div className="intp-casc-linha" key={g.chave}>
            <span className={`intp-casc-rot${g.tipo === "sai" ? " saida" : g.tipo === "sobra" ? " sobra" : ""}`}>{g.rotulo}</span>
            <span className="intp-casc-trilha">
              <span className={`intp-casc-barra ${g.tipo}`} style={{ width: g.valor === null ? "2%" : `${g.largura}%`, opacity: g.valor === null ? 0.35 : 1 }} />
            </span>
            <b className={`intp-casc-valor${g.tipo === "sai" ? " saida" : g.tipo === "sobra" ? " sobra" : ""}`}>{fmt.dinheiro(g.valor)}</b>
            <small className="intp-casc-nota">{g.nota}</small>
            <button type="button" className="intp-casc-abrir" onClick={() => recorte.filtrar(`Degrau: ${g.rotulo}`)}>abrir</button>
          </div>
        ))}
      </div>

      <Banner
        tom="aviso"
        forte="Contribuição estimada não é lucro líquido."
        texto="Lucro líquido existe só depois de impostos e despesas fixas — quando esses dados entrarem, a linha aparece; antes disso, nem zero."
      />

      {d.conciliacaoInconsistente ? (
        <Banner
          tom="aviso"
          forte={`${fmt.dinheiro(d.excedente)} pagos acima da comissão calculada em ${fmt.inteiro(d.vendasDivergentes)} venda.`}
          texto="A divergência continua visível e o pendente fica separado em zero; um pagamento excedente nunca é apresentado como dívida negativa."
        />
      ) : null}

      <div className="intp-fin-duas">
        <Tabela
          colunas={[{ titulo: "Venda" }, { titulo: "VGV", num: true }, { titulo: "%", num: true }, { titulo: "Receita", num: true }, { titulo: "Comissões", num: true }, { titulo: "Custos", num: true }, { titulo: "Contribuição", num: true }, { titulo: "Pagamento" }]}
          linhas={d.vendas.map((v) => ({
            chave: v.codigo,
            destaque: false,
            abrir: () => recorte.filtrar(`Venda: ${v.nome}`),
            celulas: [
              { texto: `${v.nome} · ${v.codigo}`, forte: true },
              { texto: fmt.dinheiro(v.vgv), num: true },
              v.percentual === null
                ? { texto: "sem % válido", num: true, cor: "#D93E3E" }
                : { texto: fmt.porcento(v.percentual), num: true },
              { texto: fmt.dinheiro(v.receita), num: true },
              { texto: fmt.dinheiro(v.comissoes), num: true },
              v.semCusto ? { texto: "sem custo", num: true, cor: "#D93E3E" } : { texto: fmt.dinheiro(v.custos), num: true },
              { texto: fmt.dinheiro(v.contribuicao), num: true, forte: true, cor: v.contribuicao === null ? undefined : "#1E7A46" },
              v.pagamento === "pago"
                ? { texto: "", chip: "pago", chipTom: "bom" as const }
                : v.pagamento === "divergente"
                  ? { texto: "", chip: "divergente", chipTom: "ruim" as const }
                : v.pagamento === "a pagar"
                  ? { texto: "", chip: "a pagar", chipTom: "aviso" as const }
                  : { texto: "", chip: "bloqueado", chipTom: "ruim" as const },
            ],
          }))}
          foot={`mostrando ${d.vendas.length} de ${d.totalVendas} · clique aplica o recorte da venda · vermelho = falta dado para calcular`}
        />

        <div className="intp-cartao">
          <span className="intp-cartao-titulo">Comissões por participante</span>
          <div style={{ overflowX: "auto" }}>
            <table className="intp-tabela">
              <thead>
                <tr>
                  <th><span className="intp-th-btn" style={{ cursor: "default" }}>Participante</span></th>
                  <th><span className="intp-th-btn" style={{ cursor: "default" }}>Papel</span></th>
                  <th className="num"><span className="intp-th-btn" style={{ cursor: "default" }}>Calculada</span></th>
                  <th className="num"><span className="intp-th-btn" style={{ cursor: "default" }}>Paga</span></th>
                  <th className="num"><span className="intp-th-btn" style={{ cursor: "default" }}>Pendente</span></th>
                  <th className="num"><span className="intp-th-btn" style={{ cursor: "default" }}>Excedente</span></th>
                </tr>
              </thead>
              <tbody>
                {d.participantes.map((p) => (
                  <tr key={p.nome} onClick={() => recorte.filtrar(`Pessoa: ${p.nome}`)}>
                    <td data-rotulo="Participante" className="forte">{p.nome}</td>
                    <td data-rotulo="Papel">{p.papel}</td>
                    <td data-rotulo="Calculada" className="num">{fmt.dinheiro(p.calculada)}</td>
                    <td data-rotulo="Paga" className="num">{fmt.dinheiro(p.paga)}</td>
                    <td data-rotulo="Pendente" className="num">{fmt.dinheiro(p.pendente)}</td>
                    <td data-rotulo="Excedente" className="num" style={{ color: (p.excedente ?? 0) > 0 ? "#D93E3E" : undefined }}>{fmt.dinheiro(p.excedente)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <small className="intp-kpi-foot">
            comissão individual só aparece para CEO, diretoria e Financeiro · pessoa sem percentual definido fica com “—”, nunca com zero
          </small>
        </div>
      </div>

      <RodapeFontes
        fontes={["vendas", "comissões", "pagamentos de comissão", "custos diretos"]}
        pendencias={["impostos e despesas fixas não integrados (sem lucro líquido)", "vendas sem % válido aparecem bloqueadas"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

/* PONTO ÚNICO DE TROCA PARA O BANCO — lê a RPC via hook. */
function hhmm(iso: string | null): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

const vazioFinanceiro: Dados = {
  degraus: [
    { chave: "vgv", rotulo: "VGV · imóveis vendidos", tipo: "entra", valor: null, largura: 2, nota: "aguardando conexão" },
    { chave: "receita", rotulo: "Receita bruta de comissão", tipo: "entra", valor: null, largura: 2, nota: "" },
    { chave: "comissoes", rotulo: "− Comissões calculadas", tipo: "sai", valor: null, largura: 2, nota: "" },
    { chave: "custos", rotulo: "− Custos diretos", tipo: "sai", valor: null, largura: 2, nota: "" },
    { chave: "contribuicao", rotulo: "= Contribuição estimada", tipo: "sobra", valor: null, largura: 2, nota: "" },
  ],
  vendas: [], participantes: [], totalVendas: 0, conciliacaoInconsistente: false, excedente: 0, vendasDivergentes: 0, atualizado: "—",
};

function mapearFinanceiro(p: FinanceiroPayload | null): Dados {
  if (!p) return vazioFinanceiro;
  const g = p.degraus;
  const conciliacaoInconsistente = g.excedente > 0;
  const base = 85;
  const larg = (v: number) => (g.receita > 0 ? Math.max(2, Math.round((base * v) / g.receita)) : 2);

  return {
    degraus: [
      { chave: "vgv", rotulo: "VGV · imóveis vendidos", tipo: "entra", valor: g.vgv, largura: 100, nota: `${p.total_vendas} ${p.total_vendas === 1 ? "venda" : "vendas"} no período` },
      { chave: "receita", rotulo: "Receita bruta de comissão", tipo: "entra", valor: g.receita, largura: base, nota: "comissão bruta da imobiliária" },
      { chave: "comissoes", rotulo: "− Comissões calculadas", tipo: "sai", valor: g.comissoes_pessoas, largura: larg(g.comissoes_pessoas), nota: conciliacaoInconsistente ? `pagas ${fmt.dinheiro(g.pagas)} · excedente a conciliar ${fmt.dinheiro(g.excedente)}` : `pagas ${fmt.dinheiro(g.pagas)} · pendentes ${fmt.dinheiro(g.pendente)}` },
      { chave: "custos", rotulo: "− Custos diretos", tipo: "sai", valor: g.custos, largura: larg(g.custos), nota: "custos diretos lançados" },
      { chave: "contribuicao", rotulo: "= Contribuição estimada", tipo: "sobra", valor: g.contribuicao, largura: larg(Math.max(0, g.contribuicao)), nota: g.receita > 0 ? `${Math.round((100 * g.contribuicao) / g.receita)}% da comissão bruta` : "" },
    ],
    vendas: p.vendas.map((v) => ({
      nome: v.nome,
      codigo: v.codigo,
      vgv: v.vgv,
      percentual: v.percentual,
      receita: v.receita,
      comissoes: v.comissoes,
      custos: v.custos,
      contribuicao: v.contribuicao,
      pagamento: v.pagamento,
      semCusto: v.sem_custo,
    })),
    participantes: p.participantes.map((pt) => ({ nome: pt.nome, papel: pt.papel, calculada: pt.calculada, paga: pt.paga, pendente: pt.pendente, excedente: pt.excedente })),
    totalVendas: p.total_vendas,
    conciliacaoInconsistente,
    excedente: g.excedente,
    vendasDivergentes: p.vendas_divergentes,
    atualizado: hhmm(p.atualizado_em),
  };
}
