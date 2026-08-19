"use client";

/* 16 · FINANCEIRO E COMISSÕES — artboard 20a. Agora lê dado real via
 * /api/inteligencia/financeiro (RPC intel_financeiro). Cascata VGV → contribuição.
 * percentual_comissao é fração no banco (0,04 = 4%). "Comissões calculadas" = o
 * que vai para pessoas (papel ≠ apecerto); contribuição = parte retida − custos.
 * Lucro líquido (impostos/despesas fixas) não existe no banco → segue —.
 * Demo virou fixture. */

import { useState } from "react";
import "../../../styles/inteligencia-cascata.css";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Banner, Cabecalho, Tabela } from "../pecas";
import { useDadosInteligencia } from "../useDadosInteligencia";
import type { FinanceiroPayload } from "../../../lib/inteligencia/tipos";

type Degrau = { chave: string; rotulo: string; tipo: "entra" | "sai" | "sobra"; valor: number | null; largura: number; nota: string };
type Venda = { nome: string; codigo: string; vgv: number | null; percentual: number | null; receita: number | null; comissoes: number | null; custos: number | null; contribuicao: number | null; pagamento: "pago" | "a pagar" | "bloqueado"; semCusto?: boolean };
type Participante = { nome: string; papel: string; calculada: number | null; paga: number | null; pendente: number | null };
type Dados = { degraus: Degrau[]; vendas: Venda[]; participantes: Participante[]; totalVendas: number; atualizado: string };

const cortes = ["Por venda", "Corretor", "Gerente", "Equipe", "Empreendimento", "Canal"] as const;

export function FinanceiroComissoes({ accessToken, recorte }: PropsTela) {
  const [corte, setCorte] = useState<string>("Por venda");
  const leitura = useDadosInteligencia<FinanceiroPayload>("financeiro", accessToken, recorte);
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

      <div className="intp-cortes">
        {cortes.map((c) => (
          <button key={c} type="button" className={`intp-corte${c === corte ? " ativo" : ""}`} onClick={() => setCorte(c)} aria-pressed={c === corte}>
            {c}
          </button>
        ))}
      </div>

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
                : v.pagamento === "a pagar"
                  ? { texto: "", chip: "a pagar", chipTom: "aviso" as const }
                  : { texto: "", chip: "bloqueado", chipTom: "ruim" as const },
            ],
          }))}
          foot={`mostrando ${d.vendas.length} de ${d.totalVendas} · a linha abre a ficha da venda com o rateio · vermelho = falta dado para calcular`}
          acaoFinal={<button type="button" className="int-link" style={{ fontWeight: 700 }}>Ver todas →</button>}
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
  vendas: [], participantes: [], totalVendas: 0, atualizado: "—",
};

function mapearFinanceiro(p: FinanceiroPayload | null): Dados {
  if (!p) return vazioFinanceiro;
  const g = p.degraus;
  const base = 85;
  const larg = (v: number) => (g.receita > 0 ? Math.max(2, Math.round((base * v) / g.receita)) : 2);

  return {
    degraus: [
      { chave: "vgv", rotulo: "VGV · imóveis vendidos", tipo: "entra", valor: g.vgv, largura: 100, nota: `${p.total_vendas} ${p.total_vendas === 1 ? "venda" : "vendas"} no período` },
      { chave: "receita", rotulo: "Receita bruta de comissão", tipo: "entra", valor: g.receita, largura: base, nota: "comissão bruta da imobiliária" },
      { chave: "comissoes", rotulo: "− Comissões calculadas", tipo: "sai", valor: g.comissoes_pessoas, largura: larg(g.comissoes_pessoas), nota: `pagas ${fmt.dinheiro(g.pagas)} · pendentes ${fmt.dinheiro(g.pendente)}` },
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
      pagamento: v.pagamento as "pago" | "a pagar" | "bloqueado",
      semCusto: v.sem_custo,
    })),
    participantes: p.participantes.map((pt) => ({ nome: pt.nome, papel: pt.papel, calculada: pt.calculada, paga: pt.paga, pendente: pt.pendente })),
    totalVendas: p.total_vendas,
    atualizado: hhmm(p.atualizado_em),
  };
}

/* Fixture — só Storybook/teste. NUNCA usado na rota de produção. */
export const demoFinanceiro: Dados = {
  degraus: [
    { chave: "vgv", rotulo: "VGV · imóveis vendidos", tipo: "entra", valor: 18_400_000, largura: 100, nota: "21 vendas no período" },
    { chave: "receita", rotulo: "Receita bruta de comissão", tipo: "entra", valor: 920_000, largura: 85, nota: "comissão bruta da imobiliária" },
    { chave: "comissoes", rotulo: "− Comissões calculadas", tipo: "sai", valor: 488_000, largura: 45, nota: "pagas R$ 361 mil · pendentes R$ 127 mil" },
    { chave: "custos", rotulo: "− Custos diretos", tipo: "sai", valor: 74_000, largura: 7, nota: "mídia, cartório, brindes" },
    { chave: "contribuicao", rotulo: "= Contribuição estimada", tipo: "sobra", valor: 358_000, largura: 33, nota: "39% da comissão bruta" },
  ],
  totalVendas: 21,
  vendas: [
    { nome: "Apê Canário 71", codigo: "MO-104", vgv: 890_000, percentual: 5.0, receita: 44_500, comissoes: 23_600, custos: 3_400, contribuicao: 17_500, pagamento: "pago" },
    { nome: "Apê Colibri 90", codigo: "MO-127", vgv: 1_450_000, percentual: null, receita: null, comissoes: null, custos: null, contribuicao: null, pagamento: "bloqueado", semCusto: true },
  ],
  participantes: [
    { nome: "Ana Beatriz", papel: "corretora", calculada: 96_400, paga: 78_000, pendente: 18_400 },
    { nome: "Luiza Braga", papel: "corretora", calculada: 10_800, paga: 10_800, pendente: null },
  ],
  atualizado: "14:32",
};
