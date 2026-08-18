"use client";

/* 6 · CAPTAÇÃO DE PROPRIETÁRIOS — artboard 7a, com FUNIL E CORTES lado a lado.
 *
 * Estrutura do desenho (1,15fr · 1fr):
 *   ESQUERDA
 *     1. funil do proprietário, 8 etapas (1–4 do site, 5–8 do CRM)
 *     2. quatro indicadores da captação
 *     3. faixa roxa do cruzamento com a demanda sem estoque
 *   DIREITA · CORTES
 *     4. bairros ofertados em barras · tipo e finalidade em tabela · origem e
 *        campanha · captações por corretor · motivos de perda
 *   5. TABELA DE CAPTAÇÕES, largura cheia: etapa em chip e “sem contato há 26 h”
 *      em vermelho; a linha abre a gaveta com a jornada da captação
 *   6. rodapé de fontes
 *
 * Custo por captação nasce “—”: as contas de mídia não estão conectadas e nada é
 * estimado. Captação sem motivo registrado entra como “sem motivo”, não desaparece.
 */

import { useState } from "react";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes, TRACO, Valor } from "../dado";
import { Banner, Cabecalho, Funil, GavetaLateral, Tabela, type Etapa, type Tom } from "../pecas";

type Captacao = {
  recebida: string;
  bairro: string;
  tipo: string;
  finalidade: string;
  origem: string;
  etapa: string;
  etapaTom: Tom;
  corretor: string;
  semResponsavel?: boolean;
  tempo: string;
  atrasada?: boolean;
};

type Dados = {
  recebidas: number | null;
  tempoContato: number | null;
  tempoContatoTexto: string;
  publicados: number | null;
  custoPorCaptacao: number | null;
  etapas: { nome: string; volume: number | null; largura: number | null; taxa?: string; perda?: string }[];
  bairros: { l: string; r: string; largura: number; outros?: boolean }[];
  tipos: { tipo: string; venda: number | null; locacao: number | null }[];
  origens: { l: string; r: string; naoAtribuido?: boolean }[];
  porCorretor: { l: string; r: string }[];
  perdas: { l: string; r: string }[];
  perdidas: number | null;
  captacoes: Captacao[];
  atualizado: string;
};

export function CaptacaoProprietarios({ recorte }: PropsTela) {
  const d = usarDados();
  const [aberta, setAberta] = useState<Captacao | null>(null);

  const etapas: Etapa[] = d.etapas.map((e) => ({
    nome: e.nome,
    largura: e.largura,
    volume: e.volume,
    volumeTexto: fmt.inteiro(e.volume),
    taxa: e.taxa,
    perda: e.perda,
    detalhes: () => recorte.filtrar(`Etapa da captação: ${e.nome}`),
  }));

  return (
    <div className="int-secao">
      <div className="int-duas par-115">
        {/* ESQUERDA — funil, indicadores e o cruzamento com a demanda */}
        <div className="int-col">
          <Cabecalho eyebrow="FUNIL DO PROPRIETÁRIO" titulo="Do clique no site ao anúncio publicado" cor="#8B00CC" />
          <Funil etapas={etapas} foot="taxa sobre a etapa anterior · etapas 5–8 vêm do CRM; 1–4 vêm do site · etapa sem registro aparece com “—”, sem herdar o número da anterior" />

          <div className="intp-grade" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
            <div className="intp-kpi">
              <span className="intp-kpi-rotulo">Captações recebidas</span>
              <Valor bruto={d.recebidas} texto={fmt.inteiro(d.recebidas)} />
              <span className="intp-kpi-chip tom-bom">▲ +5 vs. anterior</span>
            </div>
            <div className="intp-kpi">
              <span className="intp-kpi-rotulo">Tempo até contato</span>
              <Valor bruto={d.tempoContato} texto={d.tempoContatoTexto} />
              <small className="intp-kpi-foot">mediana · meta 24 h</small>
            </div>
            <div className="intp-kpi">
              <span className="intp-kpi-rotulo">Imóveis publicados</span>
              <Valor bruto={d.publicados} texto={fmt.inteiro(d.publicados)} />
              <small className="intp-kpi-foot">26% do total captado</small>
            </div>
            <div className="intp-kpi">
              <span className="intp-kpi-rotulo">Custo por captação</span>
              <Valor bruto={d.custoPorCaptacao} texto={fmt.dinheiro(d.custoPorCaptacao)} motivo="integracao" detalhe="mídias não conectadas" />
              <small className="intp-kpi-foot">Aparece quando Google Ads e Meta Ads estiverem conectados.</small>
            </div>
          </div>

          <Banner
            tom="tint-roxo"
            forte="Cruzamento com a demanda sem estoque:"
            texto="74 buscas por 2 dorms mobiliado até R$ 6.500/mês em Moema Índios — e nenhuma das 23 captações do mês atende. É o alvo número 1 da captação ativa."
            botao={{ rotulo: "Ver em Imóveis →", go: () => recorte.irPara("imoveis") }}
          />
        </div>

        {/* DIREITA — os cortes da captação */}
        <div className="int-col">
          <Cabecalho eyebrow="CORTES" titulo="De onde vêm e o que oferecem" cor="#8B00CC" />
          <div className="intp-grade" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="intp-cartao">
              <span className="intp-cartao-titulo">Bairros ofertados</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {d.bairros.map((b) => (
                  <button key={b.l} type="button" className="intp-linha-btn" onClick={() => recorte.filtrar(`Bairro ofertado: ${b.l}`)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                      <span style={{ width: 104, fontWeight: 600, color: b.outros ? "#9A938B" : "#4D4842" }}>{b.l}</span>
                      <span style={{ flex: 1, height: 8, borderRadius: 999, background: "#F2EFEC" }}>
                        <span style={{ display: "block", height: "100%", borderRadius: 999, background: b.outros ? "#C9C2BA" : "#FF9A4D", width: `${b.largura}%` }} />
                      </span>
                      <b style={b.outros ? { color: "#6E6760" } : undefined}>{b.r}</b>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="intp-cartao">
              <span className="intp-cartao-titulo">Tipo e finalidade</span>
              <table className="intp-tabela">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th className="num">Venda</th>
                    <th className="num">Locação</th>
                  </tr>
                </thead>
                <tbody>
                  {d.tipos.map((t) => (
                    <tr key={t.tipo} onClick={() => recorte.filtrar(`Tipo ofertado: ${t.tipo}`)}>
                      <td data-rotulo="Tipo" className="forte">{t.tipo}</td>
                      <td data-rotulo="Venda" className="num">{fmt.inteiro(t.venda)}</td>
                      <td data-rotulo="Locação" className="num">{fmt.inteiro(t.locacao)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="intp-cartao">
              <span className="intp-cartao-titulo">Origem e campanha</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {d.origens.map((o) => (
                  <button key={o.l} type="button" className="intp-linha-btn" onClick={() => recorte.filtrar(`Origem: ${o.l}`)}>
                    <div className="intp-linha-kv">
                      <span style={o.naoAtribuido ? { color: "#9A938B" } : undefined}>{o.l}</span>
                      <b style={o.naoAtribuido ? { color: "#6E6760" } : undefined}>{o.r}</b>
                    </div>
                  </button>
                ))}
              </div>
              <small className="intp-kpi-foot" style={{ marginTop: "auto" }}>não atribuído aparece, nunca é diluído nos outros</small>
            </div>

            <div className="intp-cartao">
              <span className="intp-cartao-titulo">Captações por corretor</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {d.porCorretor.map((c) => (
                  <button key={c.l} type="button" className="intp-linha-btn" onClick={() => recorte.filtrar(`Corretor: ${c.l}`)}>
                    <div className="intp-linha-kv">
                      <span>{c.l}</span>
                      <b>{c.r}</b>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="intp-cartao" style={{ padding: "16px 18px" }}>
            <span className="intp-cartao-titulo">
              Motivos de perda <small style={{ fontWeight: 600, color: "#9A938B" }}>· {fmt.inteiro(d.perdidas)} captações</small>
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {d.perdas.map((p) => (
                <button key={p.l} type="button" className="intp-linha-btn" onClick={() => recorte.filtrar(`Motivo da perda: ${p.l}`)}>
                  <div className="intp-linha-kv">
                    <span>{p.l}</span>
                    <b>{p.r}</b>
                  </div>
                </button>
              ))}
            </div>
            <small className="intp-kpi-foot">captação sem motivo registrado entra como “sem motivo”, não desaparece</small>
          </div>
        </div>
      </div>

      {/* 5 · TABELA DE CAPTAÇÕES */}
      <Cabecalho eyebrow="TABELA DE CAPTAÇÕES" titulo="Cada captação, da entrada ao anúncio" />
      <div className="int-tabela-vermelha">
        <Tabela
          colunas={[{ titulo: "Recebida" }, { titulo: "Bairro" }, { titulo: "Tipo" }, { titulo: "Finalidade" }, { titulo: "Origem" }, { titulo: "Etapa" }, { titulo: "Corretor" }, { titulo: "Tempo até contato", num: true }]}
          linhas={d.captacoes.map((c) => ({
            chave: c.recebida,
            destaque: !!c.atrasada,
            abrir: () => setAberta(c),
            celulas: [
              { texto: c.recebida },
              { texto: c.bairro, forte: true },
              { texto: c.tipo },
              { texto: c.finalidade },
              { texto: c.origem },
              { texto: "", chip: c.etapa, chipTom: c.etapaTom },
              { texto: c.corretor, forte: !c.semResponsavel, cor: c.semResponsavel ? "#9A938B" : undefined },
              { texto: c.tempo, num: true, forte: !!c.atrasada, cor: c.atrasada ? "#D93E3E" : undefined },
            ],
          }))}
          foot="mostrando 5 de 23 captações · a linha abre o drawer com a jornada da captação · vermelho = acima da meta de contato em 24 h"
          acaoFinal={<button type="button" className="int-link" style={{ fontWeight: 700 }}>Ver todas →</button>}
        />
      </div>

      {/* GAVETA DA CAPTAÇÃO */}
      <GavetaLateral
        aberta={!!aberta}
        titulo={aberta ? `Captação · ${aberta.bairro}` : ""}
        sub={aberta ? `recebida ${aberta.recebida} · ${aberta.tipo} · ${aberta.finalidade.toLocaleLowerCase("pt-BR")}` : undefined}
        selo={aberta?.etapa}
        fechar={() => setAberta(null)}
        rodape={
          aberta ? (
            <>
              <button type="button" className="int-btn" onClick={() => recorte.filtrar(`Captação: ${aberta.bairro} · ${aberta.recebida}`)}>Filtrar a página por esta captação</button>
              <button type="button" className="int-btn" onClick={() => recorte.irPara("imoveis")}>Ver imóveis do bairro →</button>
            </>
          ) : null
        }
      >
        {aberta ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <div className="intp-detalhe-linha"><span>Origem</span><b>{aberta.origem}</b></div>
              <div className="intp-detalhe-linha"><span>Etapa atual</span><b>{aberta.etapa}</b></div>
              <div className="intp-detalhe-linha"><span>Responsável</span><b>{aberta.semResponsavel ? "sem responsável" : aberta.corretor}</b></div>
              <div className="intp-detalhe-linha"><span>Tempo até contato</span><b style={aberta.atrasada ? { color: "#D93E3E" } : undefined}>{aberta.tempo}</b></div>
              <div className="intp-detalhe-linha"><span>Avaliação do imóvel</span><b>{TRACO}</b></div>
              <div className="intp-detalhe-linha"><span>Nome e telefone do proprietário</span><b>{TRACO}</b></div>
            </div>
            <div className="intp-detalhe-aviso">
              Nome e telefone do proprietário dependem de permissão de dados pessoais e ficam com “—” aqui. A avaliação aparece quando a etapa 6 for registrada no CRM — nada é estimado.
            </div>
          </>
        ) : null}
      </GavetaLateral>

      <RodapeFontes
        fontes={["coleta própria", "captações do portal", "CRM Funil 2.0", "buscas agregadas"]}
        pendencias={["custo por captação (mídias não conectadas)", "1 captação sem responsável há 26 h"]}
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
  recebidas: 23,
  tempoContato: 192,
  tempoContatoTexto: "3,2 h",
  publicados: 6,
  custoPorCaptacao: null,
  perdidas: 7,
  etapas: [
    { nome: "1 · Página de captação acessada", volume: 1_108, largura: 100, taxa: "100%" },
    { nome: "2 · Clique em “Anunciar meu apê”", volume: 74, largura: 52, taxa: "6,7%", perda: "−1.034" },
    { nome: "3 · Formulário iniciado", volume: 41, largura: 38, taxa: "55,4%", perda: "−33" },
    { nome: "4 · Captação enviada", volume: 23, largura: 28, taxa: "56,1%", perda: "−18" },
    { nome: "5 · Proprietário contatado", volume: 19, largura: 24, taxa: "82,6%", perda: "−4" },
    { nome: "6 · Imóvel avaliado", volume: 12, largura: 16, taxa: "63,2%", perda: "−7" },
    { nome: "7 · Autorização / contrato", volume: 8, largura: 11, taxa: "66,7%", perda: "−4" },
    { nome: "8 · Imóvel publicado", volume: 6, largura: 8, taxa: "75,0%", perda: "−2" },
  ],
  bairros: [
    { l: "Moema Pássaros", r: "9", largura: 100 },
    { l: "Moema Índios", r: "6", largura: 67 },
    { l: "Campo Belo", r: "4", largura: 44 },
    { l: "Vila Mariana", r: "3", largura: 33 },
    { l: "Outros", r: "1", largura: 11, outros: true },
  ],
  tipos: [
    { tipo: "Apartamento", venda: 8, locacao: 10 },
    { tipo: "Cobertura", venda: 2, locacao: 0 },
    { tipo: "Studio", venda: 1, locacao: 2 },
  ],
  origens: [
    { l: "Instagram orgânico", r: "8" },
    { l: "Google orgânico", r: "6" },
    { l: "Meta Ads · anuncie-seu-ape", r: "5" },
    { l: "Direto", r: "3" },
    { l: "Não atribuído", r: "1", naoAtribuido: true },
  ],
  porCorretor: [
    { l: "Ana Beatriz", r: "8" },
    { l: "Carlos Mendes", r: "6" },
    { l: "Fernanda Lima", r: "5" },
    { l: "Rafael Souza", r: "4" },
  ],
  perdas: [
    { l: "Preferiu exclusividade em outra imobiliária", r: "3" },
    { l: "Avaliação abaixo do esperado", r: "2" },
    { l: "Desistiu de anunciar", r: "2" },
  ],
  captacoes: [
    { recebida: "16 ago, 12:40", bairro: "Moema Índios", tipo: "Apto 2 dorms", finalidade: "Locação", origem: "Instagram orgânico", etapa: "recebida", etapaTom: "aviso", corretor: "sem responsável", semResponsavel: true, tempo: "sem contato há 26 h", atrasada: true },
    { recebida: "15 ago, 09:12", bairro: "Moema Pássaros", tipo: "Apto 3 dorms", finalidade: "Venda", origem: "Meta Ads · anuncie-seu-ape", etapa: "contatado", etapaTom: "roxo", corretor: "Ana Beatriz", tempo: "2,1 h" },
    { recebida: "14 ago, 17:55", bairro: "Campo Belo", tipo: "Studio", finalidade: "Locação", origem: "Google orgânico", etapa: "avaliado", etapaTom: "roxo", corretor: "Carlos Mendes", tempo: "4,8 h" },
    { recebida: "11 ago, 10:20", bairro: "Moema Pássaros", tipo: "Apto 2 dorms", finalidade: "Venda", origem: "Direto", etapa: "autorização", etapaTom: "bom", corretor: "Fernanda Lima", tempo: "1,4 h" },
    { recebida: "8 ago, 15:03", bairro: "Moema Índios", tipo: "Cobertura", finalidade: "Venda", origem: "Instagram orgânico", etapa: "publicado", etapaTom: "bom", corretor: "Ana Beatriz", tempo: "0,9 h" },
  ],
  atualizado: "14:28",
};
