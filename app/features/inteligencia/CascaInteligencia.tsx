"use client";

/* Casca comum das telas da área: título, selo de procediência do dado, seletor de
 * período, os grupos e as abas do grupo.
 *
 * Os quatro grupos são os aprovados no canvas (23a): Empresa · Operação comercial
 * · Mercado e digital · Governança. Cada item é um <a href> real — rota de
 * verdade, sem estado escondido, para o navegador voltar e recarregar como
 * qualquer tela.
 *
 * LAYOUT SEMPRE COMPLETO (regra do Romulo): nenhuma seção e nenhum cartão some
 * por falta de dado. Métrica sem dado mostra o rótulo normal e um traço "—" no
 * lugar do número, com "aguardando conexão" pequeno embaixo quando o furo é de
 * integração. Esconder cartão faz a tela mentir por omissão.
 */

import { PERIODOS, horaSp, type Periodo } from "./dados";

export type Grupo = "empresa" | "operacao" | "digital" | "governanca";

export const GRUPOS: Array<{ id: Grupo; nome: string }> = [
  { id: "empresa", nome: "Empresa" },
  { id: "operacao", nome: "Operação comercial" },
  { id: "digital", nome: "Mercado e digital" },
  { id: "governanca", nome: "Governança" },
];

export const TELAS: Array<{ slug: string; nome: string; grupo: Grupo }> = [
  { slug: "", nome: "Visão da empresa", grupo: "empresa" },
  { slug: "vendas", nome: "Vendas e previsão", grupo: "empresa" },
  { slug: "financeiro", nome: "Financeiro e comissões", grupo: "empresa" },
  { slug: "proprietarios", nome: "Captação de proprietários", grupo: "empresa" },
  { slug: "atendimento", nome: "Atendimento e SLA", grupo: "operacao" },
  { slug: "equipe", nome: "Performance da equipe", grupo: "operacao" },
  { slug: "gerentes", nome: "Gerentes", grupo: "operacao" },
  { slug: "corretores", nome: "Corretores", grupo: "operacao" },
  { slug: "conversao", nome: "Conversão e CRM", grupo: "operacao" },
  { slug: "qualidade", nome: "Qualidade e desenvolvimento", grupo: "operacao" },
  { slug: "aquisicao", nome: "Aquisição e campanhas", grupo: "digital" },
  { slug: "comportamento", nome: "Comportamento e conteúdo", grupo: "digital" },
  { slug: "imoveis", nome: "Imóveis e procura", grupo: "digital" },
  { slug: "sara", nome: "Sara", grupo: "digital" },
  { slug: "alertas", nome: "Central de alertas", grupo: "governanca" },
  { slug: "privacidade", nome: "Privacidade e tracking", grupo: "governanca" },
];

const caminho = (slug: string) => (slug ? `/inteligencia/${slug}` : "/inteligencia");

export function CascaInteligencia({
  slug, titulo, apoio, grupo, periodo, onPeriodo, confirmados, atualizadoEm, children,
}: {
  slug: string; titulo: string; apoio: string; grupo: Grupo;
  periodo: Periodo; onPeriodo: (p: Periodo) => void;
  confirmados: number; atualizadoEm?: string; children: React.ReactNode;
}) {
  const grupoAtual = GRUPOS.find((g) => g.id === grupo);
  return (
    <main className="ape-int-wrap">
      <header className="ape-int-topo">
        <div>
          <span>INTELIGÊNCIA · {(grupoAtual?.nome ?? "").toUpperCase()}</span>
          <h1>{titulo}</h1>
          <p>{apoio}</p>
        </div>
        <div className="ape-int-selos">
          {confirmados > 0
            ? <span className="ape-int-selo"><i />DADO REAL · {horaSp(atualizadoEm)}</span>
            : <span className="ape-int-selo aguardando"><i />aguardando dado</span>}
          <div className="ape-int-periodos">
            {PERIODOS.map((p) => (
              <button type="button" key={p.id} className={periodo === p.id ? "ativo" : ""} onClick={() => onPeriodo(p.id)}>{p.nome}</button>
            ))}
          </div>
        </div>
      </header>

      <nav className="ape-int-grupos" aria-label="Grupos da área Inteligência">
        {GRUPOS.map((g) => {
          const primeira = TELAS.find((t) => t.grupo === g.id);
          return (
            <a key={g.id} href={caminho(primeira?.slug ?? "")} className={g.id === grupo ? "ativo" : ""}>{g.nome}</a>
          );
        })}
      </nav>

      <nav className="ape-int-abas" aria-label="Telas do grupo">
        {TELAS.filter((t) => t.grupo === grupo).map((t) => (
          <a key={t.slug || "visao"} href={caminho(t.slug)} className={t.slug === slug ? "ativo" : ""}>{t.nome}</a>
        ))}
      </nav>

      {children}
    </main>
  );
}

/* Cartão de indicador. `valor === null` NÃO esconde nada: mostra o rótulo e um
   traço. `aguardando` troca a nota de baixo pelo aviso de integração pendente. */
export function Kpi({
  rotulo, valor, nota, tom, aguardando,
}: { rotulo: string; valor: string | null; nota: string; tom?: "bom" | "alerta"; aguardando?: boolean }) {
  const vazio = valor === null;
  return (
    <article className={vazio ? "ape-int-kpi vazio" : `ape-int-kpi${tom ? ` ${tom}` : ""}`}>
      <span>{rotulo}</span>
      <strong>{vazio ? "—" : valor}</strong>
      <small>{vazio && aguardando ? "aguardando conexão" : nota}</small>
    </article>
  );
}

export function Estados({
  estado, temDado, onTentar,
}: { estado: "carregando" | "pronto" | "falhou"; temDado: boolean; onTentar: () => void }) {
  return (
    <>
      {estado === "falhou" && (
        <div className="ape-int-erro" role="alert">
          <div>
            <b>Não foi possível confirmar os dados agora.</b>{" "}
            <span>{temDado ? "A última consulta válida continua visível." : "Nenhum número foi exibido sem confirmação."}</span>
          </div>
          <button type="button" onClick={onTentar}>Tentar novamente</button>
        </div>
      )}
      {estado === "carregando" && !temDado && (
        <div className="ape-int-skeleton"><i /><i style={{ width: "72%" }} /><i style={{ width: "54%" }} /></div>
      )}
    </>
  );
}

export function Pendencias({ lista }: { lista: Array<{ chave: string; texto: string }> }) {
  if (!lista.length) return null;
  return (
    <section className="ape-int-secao">
      <span>O QUE AINDA NÃO ESTÁ LIGADO</span>
      <h2>Aguardando conexão</h2>
      <div className="ape-int-pendencias">
        {lista.map((p) => (
          <article className="ape-int-pendencia" key={p.chave}>
            <b>{p.chave}</b>
            <span>{p.texto}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

export function Vazio({ titulo, apoio }: { titulo: string; apoio: string }) {
  return <div className="ape-int-vazio"><b>{titulo}</b><span>{apoio}</span></div>;
}

/* Linha de lista com traço quando o número não existe — a linha continua na tela. */
export function Linha({
  nome, valor, extra, roxa, largura,
}: { nome: string; valor: string | null; extra?: string | null; roxa?: boolean; largura?: number }) {
  return (
    <div className="ape-int-linha">
      <span>{nome}</span>
      <span className={roxa ? "ape-int-barra roxa" : "ape-int-barra"}><i style={{ width: `${Math.max(0, Math.min(100, largura ?? 0))}%` }} /></span>
      <b>{valor ?? "—"}</b>
      <em>{extra ?? "—"}</em>
    </div>
  );
}

export function Tabela({ colunas, children }: { colunas: string[]; children: React.ReactNode }) {
  return (
    <div className="ape-int-tabela-wrap">
      <table className="ape-int-tabela">
        <thead><tr>{colunas.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
