"use client";

/* GERENTES — artboard 17a.
 * Carga, cobertura de horário, coaching e intervenções. Com dois gerentes não
 * existe mediana da casa: a comparação é sempre contra a meta, nunca entre pares.
 *
 * Auditoria de fidelidade: a PÁGINA DO GERENTE do artboard virou a gaveta lateral
 * de 420px — clique na linha da tabela.
 */

import { useState } from "react";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Banner, Cabecalho, GavetaLateral, GradeKpis, ListaComDetalhe, Tabela, type Detalhe, type Kpi } from "../pecas";

type Gerente = {
  nome: string;
  equipe: string;
  pessoas: number | null;
  leads: number | null;
  fechamentos: number | null;
  sla: number | null;
  conversao: number | null;
  capacidade: string;
  sabado: number | null;
  coaching: number | null;
  intervencao: string;
  cor: string;
  det: Detalhe;
};

type Dados = { gerentes: number | null; cargaDesequilibrada: number | null; coberturaSabado: number | null; intervencoes: number | null; lista: Gerente[]; atualizado: string };

export function Gerentes({ recorte }: PropsTela) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [pagina, setPagina] = useState<Gerente | null>(null);
  const d = usarDados();

  const kpis: Kpi[] = [
    { rotulo: "Gerentes", bruto: d.gerentes, texto: fmt.inteiro(d.gerentes), tile: "roxo", icone: "pessoas", foot: "sem mediana da casa: são dois" },
    { rotulo: "Carga desequilibrada", bruto: d.cargaDesequilibrada, texto: fmt.inteiro(d.cargaDesequilibrada), tom: "ruim", tile: "vermelho", foot: "Carlos com 46 de 40" },
    { rotulo: "Cobertura de sábado", bruto: d.coberturaSabado, texto: fmt.porcento(d.coberturaSabado, 0), tom: "ruim", tile: "ambar", foot: "no SLA · escala não integrada" },
    { rotulo: "Intervenções abertas", bruto: d.intervencoes, texto: fmt.inteiro(d.intervencoes), tile: "laranja", foot: "com prazo definido" },
  ];

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="OS DOIS GERENTES" titulo="Comparados com a meta, não entre si" nota={recorte.periodo} />
      <GradeKpis itens={kpis} colunas={4} />

      <Banner
        tom="tint-roxo"
        forte="Escala e ponto não estão integrados."
        texto="Esta tela mostra atividade registrada no ERP, não jornada de trabalho. Ausência de registro não é ausência da pessoa — e nunca vira nota."
      />

      <ListaComDetalhe
        eyebrow="CARGA E COBERTURA"
        titulo="Qual gerente precisa de apoio, e em que exatamente"
        nota="cada gerente vê a própria página; a régua entre pares é do CEO"
        linhas={d.lista.map((g) => ({
          chave: g.nome,
          nome: g.nome,
          meio: `${g.equipe} · ${fmt.inteiro(g.pessoas)} pessoas`,
          fim: `SLA ${fmt.porcento(g.sla, 0)}`,
          cor: g.cor,
          ativa: detalhe?.titulo === g.det.titulo,
          abrir: () => setDetalhe(g.det),
        }))}
        detalhe={detalhe}
        fechar={() => setDetalhe(null)}
      />

      <Cabecalho eyebrow="LADO A LADO" titulo="Cada número com a meta ao lado" cor="#8B00CC" nota="clique na linha para abrir a página do gerente" />
      <Tabela
        colunas={[{ titulo: "Gerente" }, { titulo: "Equipe" }, { titulo: "Capacidade" }, { titulo: "Leads", num: true }, { titulo: "% SLA", num: true }, { titulo: "Conversão", num: true }, { titulo: "Coaching", num: true }]}
        ordenadaEm="Leads"
        linhas={d.lista.map((g) => ({
          chave: g.nome,
          abrir: () => setPagina(g),
          celulas: [
            { texto: g.nome, forte: true },
            { texto: g.equipe },
            { texto: g.capacidade },
            { texto: fmt.inteiro(g.leads), num: true },
            { texto: fmt.porcento(g.sla, 0), num: true, cor: (g.sla ?? 100) < 20 ? "#D93E3E" : undefined },
            { texto: fmt.porcento(g.conversao), num: true },
            { texto: fmt.inteiro(g.coaching), num: true },
          ],
        }))}
        foot="meta de SLA: 60% · capacidade combinada: 40 negócios por pessoa"
      />

      <GavetaLateral
        aberta={!!pagina}
        titulo={pagina ? pagina.nome : ""}
        sub={pagina ? `equipe ${pagina.equipe} · ${fmt.inteiro(pagina.pessoas)} pessoas · capacidade ${pagina.capacidade}` : ""}
        fechar={() => setPagina(null)}
        rodape={
          pagina ? (
            <>
              <button type="button" className="cop-acao" onClick={() => recorte.filtrar(`Gerente: ${pagina.nome}`)}>Filtrar a página por este gerente</button>
              <button type="button" className="cop-acao" onClick={() => recorte.irPara("corretores")}>Ver a equipe →</button>
            </>
          ) : null
        }
      >
        {pagina ? (
          <>
            <div className="intp-grade" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
              <div className="intp-prova-gaveta"><small>leads da equipe</small><b>{fmt.inteiro(pagina.leads)}</b></div>
              <div className="intp-prova-gaveta"><small>fechamentos</small><b>{fmt.inteiro(pagina.fechamentos)}</b></div>
              <div className="intp-prova-gaveta"><small>% no SLA</small><b>{fmt.porcento(pagina.sla, 0)}</b></div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <div className="intp-detalhe-linha"><span>Meta de SLA da casa</span><b>60%</b></div>
              <div className="intp-detalhe-linha"><span>Cobertura de sábado</span><b>{fmt.porcento(pagina.sabado, 0)}</b></div>
              <div className="intp-detalhe-linha"><span>Conversão lead → venda</span><b>{fmt.porcento(pagina.conversao)}</b></div>
              <div className="intp-detalhe-linha"><span>Coaching aberto</span><b>{fmt.inteiro(pagina.coaching)}</b></div>
              <div className="intp-detalhe-linha"><span>Intervenção em curso</span><b>{pagina.intervencao}</b></div>
              <div className="intp-detalhe-linha"><span>Horas de escala planejadas</span><b>—</b></div>
            </div>
            <div className="intp-detalhe-aviso">
              Escala e ponto não estão integrados, por isso a última linha fica com “—”: a cobertura de sábado é inferida pela atividade registrada, não pela jornada. A comparação é sempre contra a meta da casa — com dois gerentes não existe mediana.
            </div>
          </>
        ) : null}
      </GavetaLateral>

      <RodapeFontes
        fontes={["negócios", "leads", "carga por corretor", "intervenções"]}
        pendencias={["escala/ponto não integrado", "mediana da casa não se aplica com dois gerentes"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

function usarDados(): Dados {
  return demo;
}

const demo: Dados = {
  gerentes: 2,
  cargaDesequilibrada: 1,
  coberturaSabado: 18,
  intervencoes: 3,
  lista: [
    {
      nome: "Juliana Prado", equipe: "Venda", pessoas: 4, leads: 261, fechamentos: 13, sla: 31, conversao: 5.0, capacidade: "38 de 40", sabado: 34, coaching: 1, intervencao: "nenhuma", cor: "#1FA85A",
      det: { titulo: "Juliana Prado", sub: "equipe Venda", linhas: [["Leads da equipe", "261"], ["Vendas", "13"], ["Carga máxima", "38 de 40"], ["Coaching aberto", "1"]], aviso: "Cada gerente vê a própria página; a régua entre pares é do CEO." },
    },
    {
      nome: "Marcos Vilela", equipe: "Locação", pessoas: 6, leads: 225, fechamentos: 8, sla: 14, conversao: 3.6, capacidade: "46 de 40", sabado: 18, coaching: 2, intervencao: "plantão de sábado · 7 dias", cor: "#D93E3E",
      det: { titulo: "Marcos Vilela", sub: "equipe Locação", linhas: [["Leads da equipe", "225"], ["Locações", "8"], ["Carlos sobrecarregado", "46 de 40"], ["Sábado no SLA", "18%"]], aviso: "Sugestão de redistribuição depende de carga atualizada." },
    },
  ],
  atualizado: "14:28",
};
