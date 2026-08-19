"use client";

/* 6 · CAPTAÇÃO DE PROPRIETÁRIOS — artboard 7a. Agora lê dado real via
 * /api/inteligencia/proprietarios (RPC intel_proprietarios). O que existe hoje no
 * banco são as VENDAS por empreendimento (reais) e os eventos de CTA de
 * proprietário no site. O funil de captação (página → contato → imóvel publicado)
 * e os cortes ainda NÃO são rastreados como pipeline — então aparecem com —, não
 * com número inventado. Demo virou fixture. */

import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes, Valor } from "../dado";
import { Banner, Cabecalho, Funil, Tabela, type Etapa } from "../pecas";
import { useDadosInteligencia } from "../useDadosInteligencia";
import type { ProprietariosPayload } from "../../../lib/inteligencia/tipos";

type Dados = {
  recebidas: number | null; publicados: number | null; proprietarios: number | null; custoPorCaptacao: number | null;
  etapas: { nome: string; volume: number | null; largura: number | null; taxa?: string }[];
  empreendimentos: { nome: string; vendas: number | null; vgv: number | null }[];
  atualizado: string;
};

const ETAPAS_NOMES = [
  "1 · Página de captação acessada", "2 · Clique em “Anunciar meu apê”", "3 · Formulário iniciado", "4 · Captação enviada",
  "5 · Proprietário contatado", "6 · Imóvel avaliado", "7 · Autorização / contrato", "8 · Imóvel publicado",
];

export function CaptacaoProprietarios({ accessToken, recorte }: PropsTela) {
  const leitura = useDadosInteligencia<ProprietariosPayload>("proprietarios", accessToken, recorte);
  const d = mapearProprietarios(leitura.payload);

  const etapas: Etapa[] = d.etapas.map((e) => ({
    nome: e.nome, largura: e.largura, volume: e.volume, volumeTexto: fmt.inteiro(e.volume), taxa: e.taxa,
    detalhes: () => recorte.filtrar(`Etapa da captação: ${e.nome}`),
  }));

  return (
    <div className="int-secao">
      <div className="int-duas par-115">
        <div className="int-col">
          <Cabecalho eyebrow="FUNIL DO PROPRIETÁRIO" titulo="Do clique no site ao anúncio publicado" cor="#8B00CC" nota="a captação ainda não é rastreada como funil — as etapas ficam com — até os eventos/etapas serem registrados" />
          <Funil etapas={etapas} foot="etapa sem registro aparece com “—”, sem herdar o número da anterior · nada é estimado" />

          <div className="intp-grade" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
            <div className="intp-kpi"><span className="intp-kpi-rotulo">CTA de proprietário (site)</span><Valor bruto={d.recebidas} texto={fmt.inteiro(d.recebidas)} /><small className="intp-kpi-foot">eventos owner_cta / owner_portal</small></div>
            <div className="intp-kpi"><span className="intp-kpi-rotulo">Vendas com proprietário</span><Valor bruto={d.publicados} texto={fmt.inteiro(d.publicados)} motivo="fonte" detalhe="nome do proprietário não preenchido nas vendas" /><small className="intp-kpi-foot">com proprietário cadastrado</small></div>
            <div className="intp-kpi"><span className="intp-kpi-rotulo">Proprietários distintos</span><Valor bruto={d.proprietarios} texto={fmt.inteiro(d.proprietarios)} motivo="fonte" /><small className="intp-kpi-foot">nas vendas do período</small></div>
            <div className="intp-kpi"><span className="intp-kpi-rotulo">Custo por captação</span><Valor bruto={d.custoPorCaptacao} texto={fmt.dinheiro(d.custoPorCaptacao)} motivo="integracao" detalhe="mídias não conectadas" /><small className="intp-kpi-foot">aparece com Google/Meta Ads conectados</small></div>
          </div>

          <Banner
            tom="tint-roxo"
            forte="A captação de proprietários ainda não é um funil rastreado."
            texto="Página de captação, cliques em “Anunciar meu apê”, contato e avaliação precisam ser registrados como eventos/etapas. Enquanto isso, o que já é real são as vendas por empreendimento ao lado — e o cruzamento com a demanda sem estoque nasce na tela de Imóveis."
            botao={{ rotulo: "Ver demanda em Imóveis →", go: () => recorte.irPara("imoveis") }}
          />
        </div>

        <div className="int-col">
          <Cabecalho eyebrow="EMPREENDIMENTOS" titulo="Vendas por empreendimento (real)" cor="#8B00CC" />
          <div className="int-tabela-roxa">
            <Tabela
              colunas={[{ titulo: "Empreendimento" }, { titulo: "Vendas", num: true }, { titulo: "VGV", num: true }]}
              ordenadaEm="VGV"
              linhas={d.empreendimentos.map((e) => ({
                chave: e.nome, abrir: () => recorte.filtrar(`Empreendimento: ${e.nome}`),
                celulas: [{ texto: e.nome, forte: true }, { texto: fmt.inteiro(e.vendas), num: true }, { texto: fmt.dinheiro(e.vgv), num: true }],
              }))}
              foot="vendas e VGV por empreendimento vêm da tabela de vendas · a captação (origem, corretor, motivo de perda) entra quando o funil de proprietário for registrado"
            />
          </div>
        </div>
      </div>

      <RodapeFontes
        fontes={["vendas (empreendimento)", "eventos de CTA de proprietário (site)"]}
        pendencias={["funil de captação não registrado (página → contato → publicação)", "nome do proprietário não preenchido nas vendas", "custo por captação (mídias não conectadas)"]}
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

const vazioProprietarios: Dados = {
  recebidas: null, publicados: null, proprietarios: null, custoPorCaptacao: null,
  etapas: ETAPAS_NOMES.map((n, i) => ({ nome: n, volume: null, largura: i === 0 ? 100 : null })),
  empreendimentos: [], atualizado: "—",
};

function mapearProprietarios(p: ProprietariosPayload | null): Dados {
  if (!p) return vazioProprietarios;
  return {
    recebidas: p.owner_events,
    publicados: p.vendas_com_proprietario,
    proprietarios: p.proprietarios_distintos,
    custoPorCaptacao: null,
    etapas: ETAPAS_NOMES.map((n, i) => ({
      nome: n,
      volume: i === 0 ? p.owner_events : null,
      largura: i === 0 ? (p.owner_events > 0 ? 100 : 2) : null,
    })),
    empreendimentos: p.empreendimentos.map((e) => ({ nome: e.nome, vendas: e.vendas, vgv: e.vgv })),
    atualizado: hhmm(p.atualizado_em),
  };
}

/* Fixture — só Storybook/teste. NUNCA usado na rota de produção. */
export const demoProprietarios: Dados = {
  recebidas: 23, publicados: 6, proprietarios: 21, custoPorCaptacao: null,
  etapas: [{ nome: "1 · Página de captação acessada", volume: 1_108, largura: 100, taxa: "100%" }, { nome: "8 · Imóvel publicado", volume: 6, largura: 8 }],
  empreendimentos: [{ nome: "Terrare Trisul", vendas: 5, vgv: 2_149_694 }, { nome: "Claris", vendas: 3, vgv: 1_617_100 }],
  atualizado: "14:28",
};
