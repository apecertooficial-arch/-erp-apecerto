"use client";

/* 16 · FINANCEIRO E COMISSÕES — artboard 20a, idêntico ao protótipo.
 *
 * A cascata do desenho é uma ESCADA DE BARRAS, não uma lista de KPI:
 *
 *   VGV · imóveis vendidos ....... barra cheia laranja
 *   Receita bruta de comissão .... barra laranja proporcional (VGV × 5% médio)
 *   − Comissões calculadas ....... barra rosa (sai)
 *   − Custos diretos ............. barra rosa (sai)
 *   = Contribuição estimada ...... barra verde (sobra)
 *
 * Cada degrau traz valor, nota curta e “abrir”. Depois vem o aviso de que
 * contribuição NÃO é lucro líquido, os cortes da tabela, a tabela por venda — com
 * a linha bloqueada em vermelho — e as comissões por participante ao lado.
 */

import { useState } from "react";
import "../../../styles/inteligencia-cascata.css";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Banner, Cabecalho, Tabela } from "../pecas";

type Degrau = {
  chave: string;
  rotulo: string;
  tipo: "entra" | "sai" | "sobra";
  valor: number | null;
  largura: number;
  nota: string;
};

type Venda = {
  nome: string;
  codigo: string;
  vgv: number | null;
  percentual: number | null;
  receita: number | null;
  comissoes: number | null;
  custos: number | null;
  contribuicao: number | null;
  pagamento: "pago" | "a pagar" | "bloqueado";
  semCusto?: boolean;
};

type Participante = { nome: string; papel: string; calculada: number | null; paga: number | null; pendente: number | null };

type Dados = { degraus: Degrau[]; vendas: Venda[]; participantes: Participante[]; totalVendas: number; atualizado: string };

const cortes = ["Por venda", "Corretor", "Gerente", "Equipe", "Empreendimento", "Canal"] as const;

export function FinanceiroComissoes({ recorte }: PropsTela) {
  const [corte, setCorte] = useState<string>("Por venda");
  const d = usarDados();

  return (
    <div className="int-secao">
      {/* CASCATA — a escada de barras do artboard */}
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

      {/* CORTES + TABELA POR VENDA, com o cartão de participantes ao lado */}
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
        fontes={["contratos", "repasses", "comissões", "custos diretos"]}
        pendencias={["impostos e despesas fixas não integrados (sem lucro líquido)", "1 venda sem % válido de comissão", "1 repasse sem data"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

/* Ponto único de troca para a conexão com o banco. Campo nulo cai no contrato de
   dado ausente sem mexer no layout. */
function usarDados(): Dados {
  return demo;
}

const demo: Dados = {
  degraus: [
    { chave: "vgv", rotulo: "VGV · imóveis vendidos", tipo: "entra", valor: 18_400_000, largura: 100, nota: "21 vendas no período" },
    { chave: "receita", rotulo: "Receita bruta de comissão", tipo: "entra", valor: 920_000, largura: 55, nota: "VGV × 5% médio" },
    { chave: "comissoes", rotulo: "− Comissões calculadas", tipo: "sai", valor: 488_000, largura: 29, nota: "pagas R$ 361 mil · pendentes R$ 127 mil" },
    { chave: "custos", rotulo: "− Custos diretos", tipo: "sai", valor: 74_000, largura: 8, nota: "mídia, cartório, brindes" },
    { chave: "contribuicao", rotulo: "= Contribuição estimada", tipo: "sobra", valor: 358_000, largura: 22, nota: "39% da receita bruta" },
  ],
  totalVendas: 21,
  vendas: [
    { nome: "Apê Canário 71", codigo: "MO-104", vgv: 890_000, percentual: 5.0, receita: 44_500, comissoes: 23_600, custos: 3_400, contribuicao: 17_500, pagamento: "pago" },
    { nome: "Apê Tico-tico 33", codigo: "MO-089", vgv: 1_240_000, percentual: 5.0, receita: 62_000, comissoes: 33_500, custos: 5_100, contribuicao: 23_400, pagamento: "a pagar" },
    { nome: "Apê Bem-te-vi 12", codigo: "MO-102", vgv: 980_000, percentual: 4.5, receita: 44_100, comissoes: 23_800, custos: 2_900, contribuicao: 17_400, pagamento: "pago" },
    { nome: "Apê Colibri 90", codigo: "MO-127", vgv: 1_450_000, percentual: null, receita: null, comissoes: null, custos: null, contribuicao: null, pagamento: "bloqueado", semCusto: true },
    { nome: "Apê Sabiá 12", codigo: "MO-121", vgv: 1_150_000, percentual: 5.5, receita: 63_300, comissoes: 34_200, custos: 4_200, contribuicao: 24_900, pagamento: "a pagar" },
  ],
  participantes: [
    { nome: "Ana Beatriz", papel: "corretora", calculada: 96_400, paga: 78_000, pendente: 18_400 },
    { nome: "Carlos Mendes", papel: "corretor", calculada: 62_100, paga: 44_000, pendente: 18_100 },
    { nome: "Rafael Souza", papel: "corretor", calculada: 34_200, paga: 22_800, pendente: 11_400 },
    { nome: "Juliana Prado", papel: "gerente", calculada: 44_800, paga: 33_600, pendente: 11_200 },
    { nome: "Marcos Vilela", papel: "gerente", calculada: 28_800, paga: 21_600, pendente: 7_200 },
    { nome: "Fernanda Lima", papel: "corretora", calculada: 48_600, paga: 36_000, pendente: 12_600 },
    { nome: "Luiza Braga", papel: "corretora", calculada: 10_800, paga: 10_800, pendente: null },
  ],
  atualizado: "14:32",
};
