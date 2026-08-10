"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/* Painel de Regras do Funil.

   O motor (funil_tick) já lia tudo da tabela funil_regra, mas mudar uma regra
   exigia SQL. Isso deixava a operação refém de quem tem acesso ao banco e
   tornava impossível auditar o que estava ligado. Esta tela é a única porta de
   configuração: cada regra é UM fato do banco -> UMA ação, aplicada na ordem.

   Nada aqui decide permissão: as RPCs recusam sozinhas quem não administra. */

type Opcao = { v: string; t: string; d: string };
type Momento = { codigo: string; rotulo: string; etapa: string };
type Abordagem = { id: number; nome: string; produto_id: number | null };
type Produto = { id: number; nome: string };
type Motor = { ativo: boolean; lote: number };

type Regra = {
  id: number | null;
  nome: string;
  ordem: number;
  ativo: boolean;
  de_momento: string[] | null;
  condicao: string;
  condicao_valor: string | number | null;
  janela_inicio: string | null;
  janela_fim: string | null;
  dias_semana: number[] | null;
  acao: string;
  para_momento: string | null;
  abordagem_ids: number[] | null;
  produto_id: number | null;
  uma_vez_por_card: boolean;
  lote: number;
};

type Dados = {
  motor: Motor | null;
  regras: Regra[];
  momentos: Momento[];
  abordagens: Abordagem[];
  produtos: Produto[];
  condicoes: Opcao[];
  acoes: Opcao[];
};

type CardPrevia = { lead: string | null; corretor: string | null; momento: string | null; tentativas: number | null };
type Previa = { ok: boolean; ativo: boolean; total: number; cards: CardPrevia[] };
type LinhaSimulacao = { regra?: string; acao?: string; cards?: number; lead?: string; corretor?: string; de?: string; para?: string };
type Simulacao = { ok: boolean; simulacao: boolean; total: number; por_regra: LinhaSimulacao[]; detalhe?: LinhaSimulacao[]; falhas?: LinhaSimulacao[] };

/* isodow: 1 = segunda ... 7 = domingo. Mesmo padrão usado em funil_regra_candidatos. */
const DIAS = [
  { v: 1, t: "Seg" }, { v: 2, t: "Ter" }, { v: 3, t: "Qua" }, { v: 4, t: "Qui" },
  { v: 5, t: "Sex" }, { v: 6, t: "Sáb" }, { v: 7, t: "Dom" },
];

function regraVazia(): Regra {
  return {
    id: null, nome: "", ordem: 100, ativo: false, de_momento: [], condicao: "sempre",
    condicao_valor: null, janela_inicio: null, janela_fim: null, dias_semana: [1, 2, 3, 4, 5],
    acao: "mover", para_momento: null, abordagem_ids: [], produto_id: null,
    uma_vez_por_card: false, lote: 50,
  };
}

/* O banco devolve "09:30:00"; <input type="time"> quer "09:30". */
function hhmm(valor: string | null | undefined): string {
  return valor ? String(valor).slice(0, 5) : "";
}

export function FunnelRulesPanel({ accessToken }: { accessToken: string }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Regra | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [previa, setPrevia] = useState<{ id: number; dados: Previa } | null>(null);
  const [simulacao, setSimulacao] = useState<Simulacao | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/funil-regras", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const corpo = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(corpo?.error || "Não foi possível carregar as regras.");
      setDados(corpo as Dados);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar as regras.");
    } finally {
      setCarregando(false);
    }
  }, [accessToken]);

  useEffect(() => { void carregar(); }, [carregar]);

  const enviar = useCallback(async (payload: Record<string, unknown>) => {
    const resposta = await fetch("/api/funil-regras", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload),
    });
    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(corpo?.error || "Não foi possível concluir a ação.");
    return (corpo?.resultado ?? {}) as Record<string, unknown>;
  }, [accessToken]);

  const rotuloMomento = useCallback((codigo: string | null) => {
    if (!codigo) return "";
    return dados?.momentos.find((m) => m.codigo === codigo)?.rotulo ?? codigo;
  }, [dados]);

  /* A frase que o gestor lê antes de decidir. Sem ela, a lista vira um monte de
     código em caixa alta e ninguém sabe o que está ligado. */
  const resumo = useCallback((r: Regra) => {
    const de = r.de_momento?.length
      ? r.de_momento.map(rotuloMomento).join(", ")
      : "qualquer momento";
    const cond = dados?.condicoes.find((c) => c.v === r.condicao)?.t ?? r.condicao;
    const condTexto = r.condicao === "tentativas_sem_resposta"
      ? `${r.condicao_valor ?? 3} tentativas sem retorno`
      : cond.toLowerCase();
    let acao = dados?.acoes.find((a) => a.v === r.acao)?.t ?? r.acao;
    if (r.acao === "mover") acao = `mover para ${rotuloMomento(r.para_momento)}`;
    if (r.acao === "enviar_abordagem") {
      const n = r.abordagem_ids?.length ?? 0;
      acao = `enviar abordagem${n > 1 ? ` (${n} opções em rodízio)` : ""}`;
    }
    const janela = r.janela_inicio || r.janela_fim
      ? ` das ${hhmm(r.janela_inicio) || "00:00"} às ${hhmm(r.janela_fim) || "23:59"}`
      : "";
    return `Em ${de}, quando ${condTexto}${janela} → ${acao}.`;
  }, [dados, rotuloMomento]);

  const abordagensDoProduto = useMemo(() => {
    if (!dados) return [] as Abordagem[];
    const produto = rascunho?.produto_id;
    if (!produto) return dados.abordagens;
    return dados.abordagens.filter((a) => Number(a.produto_id) === Number(produto));
  }, [dados, rascunho]);

  async function comAviso(fn: () => Promise<void>, mensagem: string) {
    setErro(null);
    setAviso(null);
    try {
      await fn();
      setAviso(mensagem);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir a ação.");
    }
  }

  async function salvar() {
    if (!rascunho) return;
    setSalvando(true);
    await comAviso(async () => {
      await enviar({
        action: "salvar",
        regra: {
          id: rascunho.id ?? "",
          nome: rascunho.nome,
          ordem: rascunho.ordem,
          ativo: rascunho.ativo,
          de_momento: rascunho.de_momento ?? [],
          condicao: rascunho.condicao,
          condicao_valor: rascunho.condicao_valor ?? "",
          janela_inicio: rascunho.janela_inicio ?? "",
          janela_fim: rascunho.janela_fim ?? "",
          dias_semana: rascunho.dias_semana ?? [1, 2, 3, 4, 5],
          acao: rascunho.acao,
          para_momento: rascunho.para_momento ?? "",
          abordagem_ids: rascunho.abordagem_ids ?? [],
          produto_id: rascunho.produto_id ?? "",
          uma_vez_por_card: rascunho.uma_vez_por_card,
          lote: rascunho.lote,
        },
      });
      setRascunho(null);
      await carregar();
    }, "Regra salva.");
    setSalvando(false);
  }

  async function alternar(r: Regra) {
    await comAviso(async () => {
      await enviar({ action: "salvar", regra: { ...r, id: r.id ?? "", ativo: !r.ativo, condicao_valor: r.condicao_valor ?? "", janela_inicio: hhmm(r.janela_inicio), janela_fim: hhmm(r.janela_fim), para_momento: r.para_momento ?? "", produto_id: r.produto_id ?? "", de_momento: r.de_momento ?? [], abordagem_ids: r.abordagem_ids ?? [] } });
      await carregar();
    }, r.ativo ? "Regra desligada." : "Regra ligada.");
  }

  async function excluir(r: Regra) {
    if (!r.id) return;
    if (!window.confirm(`Excluir a regra "${r.nome}"? Isso não pode ser desfeito.`)) return;
    await comAviso(async () => {
      await enviar({ action: "excluir", id: r.id });
      await carregar();
    }, "Regra excluída.");
  }

  async function verPrevia(r: Regra) {
    if (!r.id) return;
    await comAviso(async () => {
      const resultado = await enviar({ action: "previa", id: r.id });
      setPrevia({ id: r.id as number, dados: resultado as unknown as Previa });
    }, "Prévia gerada.");
  }

  async function simular(rodarDeVerdade: boolean) {
    if (rodarDeVerdade && !window.confirm("Rodar o motor agora move cards de verdade. Confirmar?")) return;
    await comAviso(async () => {
      const resultado = await enviar({ action: rodarDeVerdade ? "rodar" : "simular", lote: 200 });
      setSimulacao(resultado as unknown as Simulacao);
      if (rodarDeVerdade) await carregar();
    }, rodarDeVerdade ? "Motor executado." : "Simulação concluída — nada foi movido.");
  }

  async function ligarMotor(ativo: boolean) {
    await comAviso(async () => {
      await enviar({ action: "motor", ativo });
      await carregar();
    }, ativo ? "Motor ligado." : "Motor desligado.");
  }

  function editar(r: Regra) {
    setPrevia(null);
    setRascunho({
      ...r,
      de_momento: r.de_momento ?? [],
      abordagem_ids: r.abordagem_ids ?? [],
      dias_semana: r.dias_semana ?? [1, 2, 3, 4, 5],
      janela_inicio: hhmm(r.janela_inicio) || null,
      janela_fim: hhmm(r.janela_fim) || null,
    });
  }

  function mexer(campo: keyof Regra, valor: unknown) {
    setRascunho((atual) => (atual ? { ...atual, [campo]: valor } as Regra : atual));
  }

  function alternarLista<T>(lista: T[] | null, item: T): T[] {
    const atual = lista ?? [];
    return atual.includes(item) ? atual.filter((x) => x !== item) : [...atual, item];
  }

  if (carregando) return <div className="fr-wrap"><style>{CSS}</style><p className="fr-vazio">Carregando as regras…</p></div>;

  if (erro && !dados) {
    return (
      <div className="fr-wrap">
        <style>{CSS}</style>
        <div className="fr-erro">{erro}</div>
        <button type="button" className="fr-btn" onClick={() => void carregar()}>Tentar de novo</button>
      </div>
    );
  }

  if (!dados) return null;

  const condicaoAtual = dados.condicoes.find((c) => c.v === rascunho?.condicao);
  const acaoAtual = dados.acoes.find((a) => a.v === rascunho?.acao);

  return (
    <div className="fr-wrap">
      <style>{CSS}</style>

      <header className="fr-cabecalho">
        <div>
          <h2 className="fr-titulo">Regras do funil</h2>
          <p className="fr-legenda">
            Cada regra é um fato que o banco já sabe → uma ação. O motor percorre as regras ligadas
            na ordem e aplica. Nenhuma regra usa IA para decidir: a Sara só entra quando a ação for
            pedir a leitura dela.
          </p>
        </div>
        <div className="fr-motor">
          <span className={`fr-selo ${dados.motor?.ativo ? "fr-selo-on" : "fr-selo-off"}`}>
            Motor {dados.motor?.ativo ? "ligado" : "desligado"}
          </span>
          <button type="button" className="fr-btn" onClick={() => void ligarMotor(!dados.motor?.ativo)}>
            {dados.motor?.ativo ? "Desligar motor" : "Ligar motor"}
          </button>
          <button type="button" className="fr-btn" onClick={() => void simular(false)}>Simular sem mover</button>
          <button type="button" className="fr-btn fr-btn-perigo" onClick={() => void simular(true)}>Rodar agora</button>
        </div>
      </header>

      {erro ? <div className="fr-erro">{erro}</div> : null}
      {aviso ? <div className="fr-aviso">{aviso}</div> : null}

      {!dados.motor?.ativo ? (
        <div className="fr-nota">
          Com o motor desligado nenhuma regra age sozinha, mesmo as que estão ligadas.
          Use “Simular sem mover” para conferir o efeito antes de ligar.
        </div>
      ) : null}

      {simulacao ? (
        <section className="fr-painel">
          <div className="fr-painel-topo">
            <strong>{simulacao.simulacao ? "Simulação" : "Execução"} — {simulacao.total} card(s)</strong>
            <button type="button" className="fr-link" onClick={() => setSimulacao(null)}>fechar</button>
          </div>
          {simulacao.por_regra?.length ? (
            <ul className="fr-lista-simples">
              {simulacao.por_regra.map((linha, i) => (
                <li key={i}><strong>{linha.regra}</strong> — {linha.acao} — {linha.cards} card(s)</li>
              ))}
            </ul>
          ) : <p className="fr-vazio">Nenhuma regra ligada pegaria algum card agora.</p>}
          {simulacao.falhas?.length ? (
            <details className="fr-detalhes">
              <summary>{simulacao.falhas.length} falha(s)</summary>
              <pre className="fr-json">{JSON.stringify(simulacao.falhas, null, 2)}</pre>
            </details>
          ) : null}
        </section>
      ) : null}

      <div className="fr-acoes-topo">
        <button type="button" className="fr-btn fr-btn-principal" onClick={() => { setPrevia(null); setRascunho(regraVazia()); }}>
          Nova regra
        </button>
        <span className="fr-contagem">{dados.regras.length} regra(s) — {dados.regras.filter((r) => r.ativo).length} ligada(s)</span>
      </div>

      {rascunho ? (
        <section className="fr-editor">
          <h3 className="fr-editor-titulo">{rascunho.id ? "Editar regra" : "Nova regra"}</h3>

          <div className="fr-linha">
            <label className="fr-campo fr-campo-largo">
              <span>Nome da regra</span>
              <input type="text" value={rascunho.nome} maxLength={120}
                placeholder="Ex.: Cliente respondeu, vai para atendimento"
                onChange={(e) => mexer("nome", e.target.value)} />
            </label>
            <label className="fr-campo fr-campo-curto">
              <span>Ordem</span>
              <input type="number" value={rascunho.ordem} min={1} max={9999}
                onChange={(e) => mexer("ordem", Number(e.target.value))} />
            </label>
            <label className="fr-campo fr-campo-curto">
              <span>Máx. por rodada</span>
              <input type="number" value={rascunho.lote} min={1} max={500}
                onChange={(e) => mexer("lote", Number(e.target.value))} />
            </label>
          </div>
          <p className="fr-ajuda">A ordem decide quem age primeiro quando duas regras pegam o mesmo card. Menor number = mais cedo.</p>

          <fieldset className="fr-grupo">
            <legend>Onde a regra olha</legend>
            <p className="fr-ajuda">Sem nenhum momento marcado, a regra vale para o funil inteiro.</p>
            <div className="fr-chips">
              {dados.momentos.map((m) => (
                <label key={m.codigo} className={`fr-chip ${rascunho.de_momento?.includes(m.codigo) ? "fr-chip-on" : ""}`}>
                  <input type="checkbox" checked={rascunho.de_momento?.includes(m.codigo) ?? false}
                    onChange={() => mexer("de_momento", alternarLista(rascunho.de_momento, m.codigo))} />
                  {m.rotulo}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="fr-grupo">
            <legend>Quando ela age</legend>
            <div className="fr-linha">
              <label className="fr-campo fr-campo-largo">
                <span>Condição</span>
                <select value={rascunho.condicao} onChange={(e) => mexer("condicao", e.target.value)}>
                  {dados.condicoes.map((c) => <option key={c.v} value={c.v}>{c.t}</option>)}
                </select>
              </label>
              {rascunho.condicao === "tentativas_sem_resposta" ? (
                <label className="fr-campo fr-campo-curto">
                  <span>Quantas tentativas</span>
                  <input type="number" min={1} max={20} value={String(rascunho.condicao_valor ?? "")}
                    onChange={(e) => mexer("condicao_valor", e.target.value)} />
                </label>
              ) : null}
            </div>
            {condicaoAtual ? <p className="fr-ajuda">{condicaoAtual.d}</p> : null}

            <div className="fr-linha">
              <label className="fr-campo fr-campo-curto">
                <span>A partir de</span>
                <input type="time" value={hhmm(rascunho.janela_inicio)}
                  onChange={(e) => mexer("janela_inicio", e.target.value || null)} />
              </label>
              <label className="fr-campo fr-campo-curto">
                <span>Até</span>
                <input type="time" value={hhmm(rascunho.janela_fim)}
                  onChange={(e) => mexer("janela_fim", e.target.value || null)} />
              </label>
              <div className="fr-campo fr-campo-largo">
                <span>Dias da semana</span>
                <div className="fr-chips">
                  {DIAS.map((d) => (
                    <label key={d.v} className={`fr-chip ${rascunho.dias_semana?.includes(d.v) ? "fr-chip-on" : ""}`}>
                      <input type="checkbox" checked={rascunho.dias_semana?.includes(d.v) ?? false}
                        onChange={() => mexer("dias_semana", alternarLista(rascunho.dias_semana, d.v))} />
                      {d.t}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <p className="fr-ajuda">Horário de Brasília. Sem horário preenchido, a regra vale o dia inteiro nos dias marcados.</p>
          </fieldset>

          <fieldset className="fr-grupo">
            <legend>O que ela faz</legend>
            <label className="fr-campo fr-campo-largo">
              <span>Ação</span>
              <select value={rascunho.acao} onChange={(e) => mexer("acao", e.target.value)}>
                {dados.acoes.map((a) => <option key={a.v} value={a.v}>{a.t}</option>)}
              </select>
            </label>
            {acaoAtual ? <p className="fr-ajuda">{acaoAtual.d}</p> : null}

            {rascunho.acao === "mover" || rascunho.acao === "passar_roleta" || rascunho.acao === "enviar_abordagem" ? (
              <label className="fr-campo fr-campo-largo">
                <span>{rascunho.acao === "mover" ? "Move para" : "Depois da ação, move para (opcional)"}</span>
                <select value={rascunho.para_momento ?? ""} onChange={(e) => mexer("para_momento", e.target.value || null)}>
                  <option value="">— manter no mesmo momento —</option>
                  {dados.momentos.map((m) => <option key={m.codigo} value={m.codigo}>{m.rotulo}</option>)}
                </select>
              </label>
            ) : null}

            {rascunho.acao === "enviar_abordagem" ? (
              <>
                <label className="fr-campo fr-campo-largo">
                  <span>Produto (filtra as abordagens)</span>
                  <select value={rascunho.produto_id ?? ""}
                    onChange={(e) => { mexer("produto_id", e.target.value ? Number(e.target.value) : null); mexer("abordagem_ids", []); }}>
                    <option value="">— todos —</option>
                    {dados.produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </label>
                <div className="fr-campo fr-campo-largo">
                  <span>Abordagens</span>
                  <div className="fr-chips">
                    {abordagensDoProduto.length ? abordagensDoProduto.map((a) => (
                      <label key={a.id} className={`fr-chip ${rascunho.abordagem_ids?.includes(a.id) ? "fr-chip-on" : ""}`}>
                        <input type="checkbox" checked={rascunho.abordagem_ids?.includes(a.id) ?? false}
                          onChange={() => mexer("abordagem_ids", alternarLista(rascunho.abordagem_ids, a.id))} />
                        {a.nome}
                      </label>
                    )) : <span className="fr-vazio">Nenhuma abordagem cadastrada para este produto.</span>}
                  </div>
                  <p className="fr-ajuda">Marcando mais de uma, o motor alterna entre elas. O envio sai pela instância do corretor dono do lead.</p>
                </div>
              </>
            ) : null}
          </fieldset>

          <div className="fr-linha fr-linha-fim">
            <label className="fr-marca">
              <input type="checkbox" checked={rascunho.uma_vez_por_card}
                onChange={(e) => mexer("uma_vez_por_card", e.target.checked)} />
              Só uma vez por card
            </label>
            <label className="fr-marca">
              <input type="checkbox" checked={rascunho.ativo}
                onChange={(e) => mexer("ativo", e.target.checked)} />
              Regra ligada
            </label>
          </div>
          <p className="fr-ajuda">“Só uma vez por card” evita que a mesma abordagem seja disparada de novo para quem já recebeu.</p>

          <div className="fr-editor-acoes">
            <button type="button" className="fr-btn fr-btn-principal" disabled={salvando} onClick={() => void salvar()}>
              {salvando ? "Salvando…" : "Salvar regra"}
            </button>
            <button type="button" className="fr-btn" onClick={() => setRascunho(null)}>Cancelar</button>
          </div>
        </section>
      ) : null}

      <ul className="fr-lista">
        {dados.regras.map((r) => (
          <li key={r.id ?? r.nome} className={`fr-item ${r.ativo ? "" : "fr-item-off"}`}>
            <div className="fr-item-topo">
              <div>
                <span className="fr-ordem">#{r.ordem}</span>
                <strong className="fr-item-nome">{r.nome}</strong>
                <span className={`fr-selo ${r.ativo ? "fr-selo-on" : "fr-selo-off"}`}>{r.ativo ? "ligada" : "desligada"}</span>
                {r.uma_vez_por_card ? <span className="fr-selo fr-selo-neutro">uma vez por card</span> : null}
              </div>
              <div className="fr-item-acoes">
                <button type="button" className="fr-link" onClick={() => void verPrevia(r)}>Prévia</button>
                <button type="button" className="fr-link" onClick={() => editar(r)}>Editar</button>
                <button type="button" className="fr-link" onClick={() => void alternar(r)}>{r.ativo ? "Desligar" : "Ligar"}</button>
                <button type="button" className="fr-link fr-link-perigo" onClick={() => void excluir(r)}>Excluir</button>
              </div>
            </div>
            <p className="fr-item-resumo">{resumo(r)}</p>

            {previa && previa.id === r.id ? (
              <div className="fr-previa">
                {!previa.dados.ativo ? (
                  <p className="fr-ajuda">Esta regra está desligada — a prévia só lista candidatos de regras ligadas.</p>
                ) : previa.dados.total === 0 ? (
                  <p className="fr-ajuda">Nenhum card se encaixa nesta regra agora.</p>
                ) : (
                  <>
                    <p className="fr-ajuda">{previa.dados.total} card(s) seriam afetados agora (mostrando até 25):</p>
                    <table className="fr-tabela">
                      <thead><tr><th>Lead</th><th>Corretor</th><th>Momento</th><th>Tentativas</th></tr></thead>
                      <tbody>
                        {previa.dados.cards.map((c, i) => (
                          <tr key={i}>
                            <td>{c.lead ?? "—"}</td>
                            <td>{c.corretor ?? "sem dono"}</td>
                            <td>{rotuloMomento(c.momento)}</td>
                            <td>{c.tentativas ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
                <button type="button" className="fr-link" onClick={() => setPrevia(null)}>fechar prévia</button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {!dados.regras.length ? <p className="fr-vazio">Nenhuma regra criada ainda.</p> : null}
    </div>
  );
}

const CSS = `
.fr-wrap{display:flex;flex-direction:column;gap:16px;padding:8px 0 40px;color:#1f2430;font-size:14px;line-height:1.5}
.fr-cabecalho{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;justify-content:space-between;padding:16px;border:1px solid #e3e6ec;border-radius:12px;background:#fff}
.fr-titulo{margin:0 0 4px;font-size:18px;font-weight:650}
.fr-legenda{margin:0;max-width:62ch;color:#5b6376}
.fr-motor{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.fr-selo{display:inline-block;margin-left:8px;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600}
.fr-selo-on{background:#e6f4ea;color:#1a7f37}
.fr-selo-off{background:#f1f2f5;color:#6b7280}
.fr-selo-neutro{background:#eef2ff;color:#4338ca}
.fr-btn{padding:8px 14px;border:1px solid #d3d8e0;border-radius:8px;background:#fff;font-size:13px;font-weight:600;color:#1f2430;cursor:pointer}
.fr-btn:hover{background:#f6f7f9}
.fr-btn-principal{background:#1f2430;border-color:#1f2430;color:#fff}
.fr-btn-principal:hover{background:#333a4a}
.fr-btn-perigo{border-color:#f0b4b4;color:#b42318}
.fr-btn:disabled{opacity:.6;cursor:not-allowed}
.fr-acoes-topo{display:flex;gap:12px;align-items:center}
.fr-contagem{color:#6b7280;font-size:13px}
.fr-erro{padding:10px 14px;border:1px solid #f0b4b4;background:#fdf2f2;color:#b42318;border-radius:8px}
.fr-aviso{padding:10px 14px;border:1px solid #b7e0c4;background:#f0f9f3;color:#1a7f37;border-radius:8px}
.fr-nota{padding:10px 14px;border:1px dashed #d3d8e0;background:#fafbfc;color:#5b6376;border-radius:8px}
.fr-lista{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.fr-item{padding:14px 16px;border:1px solid #e3e6ec;border-radius:12px;background:#fff}
.fr-item-off{background:#fafbfc}
.fr-item-topo{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between}
.fr-ordem{margin-right:8px;color:#9aa1ae;font-variant-numeric:tabular-nums;font-size:12px}
.fr-item-nome{font-weight:650}
.fr-item-resumo{margin:8px 0 0;color:#5b6376}
.fr-item-acoes{display:flex;gap:14px}
.fr-link{border:0;background:none;padding:0;color:#2563eb;font-size:13px;font-weight:600;cursor:pointer}
.fr-link:hover{text-decoration:underline}
.fr-link-perigo{color:#b42318}
.fr-editor{padding:18px;border:1px solid #c9d2e3;border-radius:12px;background:#fbfcfe;display:flex;flex-direction:column;gap:12px}
.fr-editor-titulo{margin:0;font-size:16px;font-weight:650}
.fr-editor-acoes{display:flex;gap:10px;padding-top:4px}
.fr-grupo{border:1px solid #e3e6ec;border-radius:10px;padding:12px 14px;margin:0;background:#fff}
.fr-grupo legend{padding:0 6px;font-size:13px;font-weight:650;color:#5b6376}
.fr-linha{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end}
.fr-linha-fim{align-items:center}
.fr-campo{display:flex;flex-direction:column;gap:4px}
.fr-campo>span{font-size:12px;font-weight:600;color:#5b6376}
.fr-campo-largo{flex:1 1 280px}
.fr-campo-curto{flex:0 0 140px}
.fr-campo input[type=text],.fr-campo input[type=number],.fr-campo input[type=time],.fr-campo select{padding:8px 10px;border:1px solid #d3d8e0;border-radius:8px;font-size:14px;background:#fff;color:#1f2430;width:100%}
.fr-ajuda{margin:4px 0 0;font-size:12px;color:#6b7280;max-width:78ch}
.fr-chips{display:flex;flex-wrap:wrap;gap:6px}
.fr-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border:1px solid #d3d8e0;border-radius:999px;font-size:12.5px;cursor:pointer;background:#fff}
.fr-chip input{margin:0}
.fr-chip-on{border-color:#1f2430;background:#1f2430;color:#fff}
.fr-marca{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:#1f2430;cursor:pointer}
.fr-previa{margin-top:10px;padding-top:10px;border-top:1px dashed #e3e6ec}
.fr-tabela{width:100%;border-collapse:collapse;margin:6px 0;font-size:13px}
.fr-tabela th,.fr-tabela td{text-align:left;padding:6px 8px;border-bottom:1px solid #eef0f4}
.fr-tabela th{color:#6b7280;font-weight:600;font-size:12px}
.fr-painel{padding:14px 16px;border:1px solid #c9d2e3;border-radius:12px;background:#fbfcfe}
.fr-painel-topo{display:flex;justify-content:space-between;align-items:center;gap:12px}
.fr-lista-simples{margin:8px 0 0;padding-left:18px;color:#5b6376}
.fr-detalhes{margin-top:8px}
.fr-json{max-height:220px;overflow:auto;background:#1f2430;color:#e6e9ef;padding:10px;border-radius:8px;font-size:12px}
.fr-vazio{color:#6b7280}
@media (max-width:640px){.fr-campo-curto{flex:1 1 120px}.fr-item-acoes{width:100%}}
`;
