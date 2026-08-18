"use client";

/* COPILOTO APÊCERTO — função transversal das 17 páginas (wireframes 32a–32l).
 *
 * Três formas de uso, na mesma ordem do desenho:
 *   1. barra ancorada entre a barra de filtros e o primeiro bloco (32a)
 *   2. resumo da aba com os 8 blocos e no máximo 5 descobertas (32b)
 *   3. painel lateral “Pergunte à Inteligência” (32c) + briefing na Visão da
 *      empresa (32f)
 *
 * REGRAS QUE O CÓDIGO GARANTE:
 * — nenhuma ação é executada: recomendação vira pendência, com confirmação (32k)
 * — resposta começa pela conclusão e sempre carrega fonte, período e confiança (32d)
 * — o escopo depende do perfil, e fora dele o agente diz que não alcança (32h)
 * — sem dado, sem fonte ou sem amostra, o Copiloto declara o estado (32g)
 */

import { useState } from "react";
import "../../styles/inteligencia-copiloto.css";
import { conteudoCopiloto, type Achado } from "./copiloto-conteudo";
import type { Recorte } from "./CascaInteligencia";

export type PerfilCopiloto = "CEO" | "Gerente" | "Corretor" | "Marketing";

type Msg =
  | { tipo: "minha"; texto: string }
  | { tipo: "dela"; conclusao: string; blocos: { rot: string; cor: string; texto: string }[]; fonte: string; alvo: string; alvoRotulo: string; acao: string }
  | { tipo: "tabela"; titulo: string; linhas: [string, string][]; fonte: string }
  | { tipo: "aviso"; texto: string };

const tomDoAchado = (tag: Achado["tag"]) => {
  if (tag === "oportunidade" || tag === "referência") return "tom-bom";
  if (tag === "impacto alto" || tag === "risco") return "tom-ruim";
  if (tag === "atenção" || tag === "bloqueio") return "tom-aviso";
  return "tom-neutro";
};

/* Escopo por perfil (32h). O gerente não recebe leitura financeira da empresa; o
   corretor só tem a própria rotina; marketing não abre atendimento nem pessoas. */
const escopoPorPerfil: Record<PerfilCopiloto, { telas: string[] | "todas"; aviso: string }> = {
  CEO: { telas: "todas", aviso: "Você vê a empresa inteira. Toda análise fica registrada em Auditoria com usuário, filtros e fontes." },
  Gerente: { telas: ["atendimento", "equipe", "gerentes", "corretores", "qualidade", "conversao", "alertas"], aviso: "Escopo da sua equipe. Financeiro da empresa e comissão individual não entram nas respostas." },
  Corretor: { telas: ["atendimento", "conversao"], aviso: "Escopo dos seus próprios números. Dados de colegas e da equipe não são exibidos." },
  Marketing: { telas: ["digital", "aquisicao", "comportamento", "imoveis", "proprietarios", "sara", "privacidade"], aviso: "Agregados de campanha e comportamento. Conversa de atendimento e dado pessoal ficam fora." },
};

export function Copiloto({
  tela,
  recorte,
  perfil = "CEO",
  estado = "normal",
  briefing = false,
}: {
  tela: string;
  recorte: Recorte;
  perfil?: PerfilCopiloto;
  estado?: "normal" | "carregando" | "semdados" | "fonte" | "baixa";
  briefing?: boolean;
}) {
  const [resumoAberto, setResumo] = useState(false);
  const [painelAberto, setPainel] = useState(false);
  const [texto, setTexto] = useState("");
  const [historico, setHistorico] = useState<Msg[]>([]);
  const [pendencia, setPendencia] = useState<string | null>(null);
  const [freq, setFreq] = useState("Diário");
  const [briefLido, setBriefLido] = useState(false);

  const c = conteudoCopiloto[tela];
  const escopo = escopoPorPerfil[perfil];
  const noEscopo = escopo.telas === "todas" || escopo.telas.includes(tela);
  if (!c) return null;

  const achados = (perfil === "Corretor" ? c.achados.slice(0, 2) : c.achados);
  const confianca = estado === "baixa" ? "baixa confiança" : estado === "fonte" ? "confiança média" : "alta confiança";

  const perguntar = (pergunta: string) => {
    const p = pergunta.trim();
    if (!p) return;
    setPainel(true);
    setTexto("");
    if (!noEscopo) {
      setHistorico((h) => [...h, { tipo: "minha", texto: p }, { tipo: "aviso", texto: "Esse dado não está no seu escopo. Como " + perfil + ", esta página não entra nas respostas — e eu não mostro número parcial nem aproximado." }]);
      return;
    }
    const r = c.resposta;
    setHistorico((h) => [
      ...h,
      { tipo: "minha", texto: p },
      {
        tipo: "dela",
        conclusao: r.conclusao,
        blocos: [
          { rot: "EVIDÊNCIA", cor: "#FF7000", texto: r.evidencia },
          { rot: "IMPACTO", cor: "#FF7000", texto: r.impacto },
          { rot: "CAUSA", cor: "#8B00CC", texto: r.causa },
          { rot: "RECOMENDAÇÃO", cor: "#1FA85A", texto: r.recomendacao },
        ],
        fonte: r.fonte,
        alvo: r.alvo,
        alvoRotulo: r.alvoRotulo,
        acao: c.acoes[0],
      },
    ]);
  };

  const verDados = () => setHistorico((h) => [...h, { tipo: "tabela", titulo: "Evidência", linhas: c.resposta.tabela, fonte: c.resposta.fonte }]);

  return (
    <>
      {briefing && !briefLido ? (
        <section className="cop-brief">
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
            <span className="cop-tile" aria-hidden="true">✦</span>
            <div style={{ flex: 1, minWidth: 240 }}>
              <span className="cop-bloco-rot">BRIEFING DE HOJE · COPILOTO APÊCERTO</span>
              <h2 style={{ margin: "2px 0 0", fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em" }}>
                {freq === "Sob demanda" ? "Briefing sob demanda — gerado quando você pedir." : "Bom dia. Estes pontos merecem sua atenção hoje."}
              </h2>
              <small style={{ fontSize: 12, color: "#9A938B" }}>gerado 07:00 · {freq.toLowerCase()} · só mudança relevante entra aqui</small>
            </div>
            <div className="cop-brief-freq">
              {["Diário", "Semanal", "Mensal", "Sob demanda"].map((f) => (
                <button key={f} type="button" className={f === freq ? "ativo" : ""} onClick={() => setFreq(f)}>{f}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {freq === "Sob demanda" ? (
              <div className="cop-brief-ponto">
                <span className="tag tom-neutro">em espera</span>
                <span className="txt">Nenhum briefing agendado. O botão abaixo gera a leitura do momento, com os filtros atuais.</span>
              </div>
            ) : (
              achados.map((a) => (
                <div className="cop-brief-ponto" key={a.titulo}>
                  <span className={`tag ${tomDoAchado(a.tag)}`}>{a.tag}</span>
                  <span className="txt"><b>{a.titulo}</b> — {a.explicacao}</span>
                  <button type="button" className="cop-acao" onClick={() => recorte.irPara(a.alvo)}>{a.alvoRotulo} →</button>
                </div>
              ))
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" className="cop-acao" onClick={() => setBriefLido(true)}>Marcar como lido</button>
            <button type="button" className="cop-btn-primario" onClick={() => setPainel(true)}>Abrir no painel</button>
            <small style={{ marginLeft: "auto", fontSize: 11, color: "#9A938B" }}>nada aqui foi executado — o briefing só lê e aponta</small>
          </div>
        </section>
      ) : null}

      <div className="cop-barra">
        <span className="cop-tile" aria-hidden="true">✦</span>
        <button type="button" className="cop-btn-primario" onClick={() => setResumo((v) => !v)} aria-expanded={resumoAberto}>
          {resumoAberto ? "Fechar resumo" : "Resumir esta aba com IA"}
        </button>
        <button type="button" className="cop-btn-secundario" onClick={() => setPainel(true)}>Pergunte à Inteligência</button>
        <span className="cop-ctx">lê esta aba · {recorte.periodo}{recorte.chips.length ? ` · ${recorte.chips.length} filtro(s)` : ""}</span>
        <small className="cop-fontes">Copiloto ApêCerto · perfil {perfil} · atualizado 14:28</small>
      </div>

      {resumoAberto ? (
        <section className="cop-resumo">
          <div className="cop-resumo-topo">
            <div style={{ flex: 1, minWidth: 240 }}>
              <span className="cop-bloco-rot">COPILOTO · RESUMO DESTA ABA</span>
              <h2>{recorte.periodo}{recorte.compararAnterior ? " vs. período anterior" : ""}</h2>
              <small style={{ fontSize: 12, color: "#9A938B" }}>gerado 14:31 sobre a carga de 14:28 · perfil {perfil}</small>
            </div>
            <span className={`cop-ctx ${estado === "baixa" ? "tom-ruim" : ""}`}>{confianca}</span>
            <button type="button" className="cop-fechar" onClick={() => setResumo(false)} aria-label="Fechar resumo">✕</button>
          </div>

          {estado === "carregando" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <b style={{ fontSize: 14 }}>Lendo os dados desta aba…</b>
              <span className="cop-esqueleto" />
              <span className="cop-esqueleto" style={{ width: "78%" }} />
              <span className="cop-esqueleto" style={{ width: "56%" }} />
              <small style={{ fontSize: 11, color: "#9A938B" }}>a conclusão aparece primeiro; evidência e recomendação vêm em seguida</small>
            </div>
          ) : estado === "semdados" ? (
            <div className="cop-bloco">
              <b style={{ fontSize: 14 }}>Nenhum dado no período e filtro escolhidos.</b>
              <span className="txt">Sem dado não existe resumo. O agente não amplia o período por conta própria — sugere, e você decide.</span>
            </div>
          ) : !noEscopo ? (
            <div className="cop-bloco">
              <b style={{ fontSize: 14 }}>Esta aba está fora do seu escopo.</b>
              <span className="txt">{escopo.aviso}</span>
            </div>
          ) : (
            <>
              {estado === "fonte" ? (
                <div className="cop-descartadas">Uma fonte não respondeu neste período. O resumo saiu com as que responderam e a pendência está declarada — nada foi preenchido por média.</div>
              ) : null}
              {estado === "baixa" ? (
                <div className="cop-descartadas">Amostra abaixo do mínimo neste recorte: o agente descreve o que viu e não conclui. Sem classificar pessoa e sem recomendar coaching.</div>
              ) : null}

              <div className="cop-dois">
                <div className="cop-bloco"><span className="cop-bloco-rot">1 · SITUAÇÃO GERAL</span><span className="txt">{c.geral}</span></div>
                <div className="cop-bloco"><span className="cop-bloco-rot">2 · O QUE MUDOU</span><span className="txt">{c.mudou}</span></div>
              </div>

              <span className="cop-bloco-rot">3 · PRINCIPAIS DESCOBERTAS · {achados.length}</span>
              {achados.map((a) => (
                <div className="cop-achado" key={a.titulo}>
                  <div className="cop-achado-topo">
                    <b>{a.titulo}</b>
                    <span className={`cop-ctx ${tomDoAchado(a.tag)}`}>{a.tag}</span>
                    <span className="cop-ctx">{confianca}</span>
                  </div>
                  <span style={{ fontSize: 12.5, color: "#4D4842", lineHeight: 1.5 }}>{a.explicacao}</span>
                  <div className="cop-provas">
                    <div className="cop-prova"><small>número que comprova</small><br /><b>{a.numero}</b></div>
                    <div className="cop-prova"><small>impacto</small><br /><b>{a.impacto}</b></div>
                    <div className="cop-prova"><small>período</small><br /><b>{recorte.periodo}</b></div>
                  </div>
                  <div className="cop-acoes">
                    <button type="button" className="cop-acao" onClick={() => { setPainel(true); verDados(); }}>Ver evidências</button>
                    <button type="button" className="cop-acao" onClick={() => recorte.irPara(a.alvo)}>{a.alvoRotulo}</button>
                  </div>
                </div>
              ))}
              {c.descartadas ? <div className="cop-descartadas">{c.descartadas}</div> : null}

              <div className="cop-dois">
                <div className="cop-bloco"><span className="cop-bloco-rot">4 · RISCOS</span><span className="txt">{c.riscos}</span></div>
                <div className="cop-bloco"><span className="cop-bloco-rot">5 · OPORTUNIDADES</span><span className="txt">{c.oportunidades}</span></div>
                <div className="cop-bloco"><span className="cop-bloco-rot">6 · POSSÍVEIS CAUSAS</span><span className="txt">{c.causas}</span></div>
                <div className="cop-bloco">
                  <span className="cop-bloco-rot">7 · AÇÕES RECOMENDADAS</span>
                  {c.acoes.map((a, i) => (
                    <div key={a} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                      <span style={{ flex: 1 }}>{i + 1}. {a}</span>
                      <button type="button" className="cop-acao roxa" onClick={() => setPendencia(a)}>Transformar em ação</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="cop-bloco"><span className="cop-bloco-rot">8 · EVIDÊNCIAS UTILIZADAS</span><span className="txt" style={{ color: "#6E6760" }}>{c.evidencias}</span></div>
            </>
          )}
        </section>
      ) : null}

      {pendencia ? (
        <>
          <button type="button" className="cop-modal-fundo" aria-label="Fechar" onClick={() => setPendencia(null)} />
          <div className="cop-modal" role="dialog" aria-modal="true">
            <span className="cop-bloco-rot">CONFIRMAÇÃO NECESSÁRIA</span>
            <h3>{pendencia}</h3>
            <p>O Copiloto não executa nada sozinho. Confirmando, isto vira uma pendência com dono e prazo — nenhuma mensagem é enviada, nenhum lead é atribuído e nenhum dado do ERP é alterado.</p>
            <div className="cop-modal-caixa">
              <span><b>O que muda agora:</b> nada além do registro da pendência.</span>
              <span><b>Quem faz:</b> você, com registro em Auditoria.</span>
              <span><b>Reversão:</b> a pendência pode ser cancelada enquanto não for concluída.</span>
            </div>
            <div className="cop-modal-acoes">
              <button type="button" className="cop-acao" onClick={() => setPendencia(null)}>Cancelar</button>
              <button
                type="button"
                className="cop-confirmar"
                onClick={() => {
                  setHistorico((h) => [...h, { tipo: "aviso", texto: `Pendência criada: ${pendencia}. Registrada em Auditoria; nada foi executado.` }]);
                  setPendencia(null);
                  setPainel(true);
                }}
              >
                Criar pendência
              </button>
            </div>
          </div>
        </>
      ) : null}

      {painelAberto ? (
        <>
          <button type="button" className="cop-fundo" aria-label="Fechar painel" onClick={() => setPainel(false)} />
          <aside className="cop-painel" aria-label="Pergunte à Inteligência">
            <div className="cop-painel-topo">
              <span className="cop-tile" aria-hidden="true">✦</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="cop-bloco-rot">COPILOTO APÊCERTO</span>
                <b>Pergunte à Inteligência</b>
                <small>analisando dados atualizados · 14:28</small>
              </div>
              <button type="button" className="cop-fechar" onClick={() => setPainel(false)} aria-label="Fechar">✕</button>
            </div>

            <div className="cop-ctx" style={{ display: "block", lineHeight: 1.5 }}>
              contexto: esta aba · {recorte.periodo}{recorte.compararAnterior ? " · vs. anterior" : ""}{recorte.chips.length ? ` · ${recorte.chips.join(" · ")}` : " · sem filtro"} · perfil {perfil}
            </div>

            {historico.length === 0 ? (
              <div className="cop-bloco" style={{ textAlign: "center" }}>
                <b style={{ fontSize: 13, color: "#6E6760" }}>Pergunte ou escolha uma sugestão</b>
                <span className="txt" style={{ color: "#9A938B" }}>A resposta vem sempre como conclusão → evidência → impacto → causa → recomendação.</span>
              </div>
            ) : (
              historico.map((m, i) => {
                if (m.tipo === "minha") return <div className="cop-msg minha" key={i}>{m.texto}</div>;
                if (m.tipo === "aviso") return <div className="cop-msg tabela" key={i}>{m.texto}</div>;
                if (m.tipo === "tabela")
                  return (
                    <div className="cop-msg tabela" key={i}>
                      <b>{m.titulo}</b>
                      {m.linhas.map(([k, v]) => (
                        <div key={k} style={{ display: "flex", gap: 8, borderBottom: "1px solid #F2EFEC", paddingBottom: 5, fontWeight: 400 }}>
                          <span style={{ flex: 1, color: "#6E6760" }}>{k}</span>
                          <b style={{ fontVariantNumeric: "tabular-nums" }}>{v}</b>
                        </div>
                      ))}
                      <small style={{ fontSize: 11, color: "#9A938B", fontWeight: 400 }}>{m.fonte}</small>
                    </div>
                  );
                return (
                  <div className="cop-msg dela" key={i}>
                    {m.conclusao}
                    {m.blocos.map((b) => (
                      <div className="cop-msg-bloco" key={b.rot}>
                        <span className="rot" style={{ color: b.cor }}>{b.rot}</span>
                        <span style={{ fontSize: 12, lineHeight: 1.5 }}>{b.texto}</span>
                      </div>
                    ))}
                    <div className="cop-bloco" style={{ padding: "9px 11px" }}>
                      <small style={{ fontSize: 11, color: "#6E6760", fontWeight: 400 }}>{m.fonte}</small>
                    </div>
                    <div className="cop-acoes">
                      <button type="button" className="cop-acao" onClick={verDados}>Ver dados</button>
                      <button type="button" className="cop-acao" onClick={() => { setPainel(false); recorte.irPara(m.alvo); }}>{m.alvoRotulo}</button>
                      <button type="button" className="cop-acao roxa" onClick={() => setPendencia(m.acao)}>Transformar em ação</button>
                    </div>
                  </div>
                );
              })
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <span className="cop-bloco-rot" style={{ color: "#FF7000" }}>SUGESTÕES DESTA ABA</span>
              {c.sugestoes.map((s) => (
                <button type="button" className="cop-sugestao" key={s} onClick={() => perguntar(s)}>{s}</button>
              ))}
            </div>

            <div className="cop-rodape">
              <div className="cop-campo">
                <input
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") perguntar(texto); }}
                  placeholder="Pergunte sobre esta aba…"
                  aria-label="Pergunte sobre esta aba"
                />
                <button type="button" className="cop-btn-primario" onClick={() => perguntar(texto)}>Enviar</button>
              </div>
              <div className="cop-acoes">
                <button type="button" className="cop-acao" onClick={() => { setHistorico([]); setTexto(""); }}>Nova análise</button>
                <button type="button" className="cop-acao" onClick={() => { setResumo(true); setPainel(false); }}>Resumir esta aba</button>
              </div>
              <div className="cop-aviso-perfil">{escopo.aviso}</div>
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}
