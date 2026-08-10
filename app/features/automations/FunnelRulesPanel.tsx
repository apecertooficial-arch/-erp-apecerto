"use client";

/* eslint-disable react-hooks/set-state-in-effect -- carga inicial assíncrona, mesmo padrão do AquarioConfig/MomentosConfig */
import { useCallback, useEffect, useMemo, useState } from "react";

/* Painel de Regras do Funil.

   O motor (funil_tick) já lia tudo da tabela funil_regra, mas mudar uma regra
   exigia SQL. Isso deixava a operação refém de quem tem acesso ao banco e
   tornava impossível auditar o que estava ligado.

   A leitura da regra é sempre a mesma em toda a tela — ONDE olha, QUANDO age,
   ENTÃO faz — e o editor usa exatamente essa ordem, em três passos. Foi a
   forma de a tela explicar sozinha o que a regra faz, sem manual.

   Todo o visual vive em app/styles/tela-regras-funil.css, sobre os tokens da
   marca. Aqui não entra cor nem tamanho.

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

/* isodow: 1 = segunda ... 7 = domingo. Mesmo padrão de funil_regra_candidatos. */
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

function textoJanela(r: Regra): string {
  const dias = r.dias_semana ?? [];
  let quando: string;
  if (dias.length === 0 || dias.length === 7) quando = "Todos os dias";
  else if (dias.length === 5 && [1, 2, 3, 4, 5].every((d) => dias.includes(d))) quando = "De segunda a sexta";
  else quando = DIAS.filter((d) => dias.includes(d.v)).map((d) => d.t).join(", ");
  const inicio = hhmm(r.janela_inicio);
  const fim = hhmm(r.janela_fim);
  if (inicio || fim) return `${quando}, das ${inicio || "00:00"} às ${fim || "23:59"}`;
  return `${quando}, a qualquer hora`;
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

  /* Nenhum setState antes do primeiro await: setState síncrono dentro de um
     efeito dispara render em cascata. "carregando" já nasce true. */
  const carregar = useCallback(async () => {
    try {
      const resposta = await fetch("/api/funil-regras", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const corpo = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(corpo?.error || "Não foi possível carregar as regras.");
      setDados(corpo as Dados);
      setErro(null);
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

  const textoOnde = useCallback((r: Regra) => (
    r.de_momento?.length ? r.de_momento.map(rotuloMomento).join(", ") : "Qualquer momento do funil"
  ), [rotuloMomento]);

  const textoQuando = useCallback((r: Regra) => {
    if (r.condicao === "tentativas_sem_resposta") return `${r.condicao_valor ?? 3} tentativas sem retorno`;
    return dados?.condicoes.find((c) => c.v === r.condicao)?.t ?? r.condicao;
  }, [dados]);

  const textoEntao = useCallback((r: Regra) => {
    if (r.acao === "mover") return `Mover para ${rotuloMomento(r.para_momento)}`;
    if (r.acao === "enviar_abordagem") {
      const n = r.abordagem_ids?.length ?? 0;
      return `Enviar abordagem${n > 1 ? ` (${n} em rodízio)` : ""}`;
    }
    return dados?.acoes.find((a) => a.v === r.acao)?.t ?? r.acao;
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
    if (rodarDeVerdade && !window.confirm("Rodar agora move cards de verdade. Confirmar?")) return;
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

  if (carregando) return <div className="fr-wrap"><p className="fr-vazio">Carregando as regras…</p></div>;

  if (erro && !dados) {
    return (
      <div className="fr-wrap">
        <div className="fr-erro">{erro}</div>
        <div><button type="button" className="fr-btn" onClick={() => { setCarregando(true); void carregar(); }}>Tentar de novo</button></div>
      </div>
    );
  }

  if (!dados) return null;

  const motorLigado = dados.motor?.ativo === true;
  const condicaoAtual = dados.condicoes.find((c) => c.v === rascunho?.condicao);
  const acaoAtual = dados.acoes.find((a) => a.v === rascunho?.acao);
  const ligadas = dados.regras.filter((r) => r.ativo).length;

  return (
    <div className="fr-wrap">
      <header className="fr-topo">
        <div>
          <h2>Regras do funil</h2>
          <p>
            Cada regra é uma frase pronta: <b>onde</b> ela olha, <b>quando</b> ela age e{" "}
            <b>o que</b> ela faz. O sistema confere de tempos em tempos e aplica as regras
            ligadas, de cima para baixo. Nenhuma delas adivinha nada — só usa fato que o
            banco já tem.
          </p>
        </div>
      </header>

      <section className="fr-motor">
        <div className="fr-motor-estado">
          <span className={`fr-farol ${motorLigado ? "fr-farol-on" : "fr-farol-off"}`} />
          <div>
            <strong>{motorLigado ? "Motor ligado" : "Motor desligado"}</strong>
            <small>
              {motorLigado
                ? "As regras ligadas estão agindo sozinhas agora."
                : "Nada acontece sozinho, mesmo com regras ligadas. É o interruptor geral."}
            </small>
          </div>
        </div>
        <div className="fr-motor-botoes">
          <button type="button" className="fr-btn" onClick={() => void simular(false)}>Simular sem mover</button>
          <button type="button" className="fr-btn fr-btn-perigo" onClick={() => void simular(true)}>Rodar agora</button>
          <button type="button" className={`fr-btn ${motorLigado ? "" : "fr-btn-primario"}`} onClick={() => void ligarMotor(!motorLigado)}>
            {motorLigado ? "Desligar motor" : "Ligar motor"}
          </button>
        </div>
      </section>

      {erro ? <div className="fr-erro">{erro}</div> : null}
      {aviso ? <div className="fr-ok">{aviso}</div> : null}

      {!motorLigado ? (
        <div className="fr-nota">
          Antes de ligar o motor, use <b>Simular sem mover</b>: ele percorre todas as regras
          ligadas e mostra o que faria, sem tocar em card nenhum.
        </div>
      ) : null}

      {simulacao ? (
        <section className="fr-painel">
          <div className="fr-painel-topo">
            <strong>{simulacao.simulacao ? "Simulação" : "Execução"} — {simulacao.total} card(s)</strong>
            <button type="button" className="fr-link" onClick={() => setSimulacao(null)}>fechar</button>
          </div>
          {simulacao.por_regra?.length ? (
            <ul>
              {simulacao.por_regra.map((linha, i) => (
                <li key={i}><b>{linha.regra}</b> — {linha.cards} card(s)</li>
              ))}
            </ul>
          ) : <p className="fr-vazio">Nenhuma regra ligada pegaria algum card agora.</p>}
          {simulacao.falhas?.length ? (
            <details>
              <summary>{simulacao.falhas.length} falha(s)</summary>
              <pre className="fr-json">{JSON.stringify(simulacao.falhas, null, 2)}</pre>
            </details>
          ) : null}
        </section>
      ) : null}

      <div className="fr-barra">
        <span className="fr-contagem">{dados.regras.length} regras · {ligadas} ligada(s)</span>
        <button type="button" className="fr-btn fr-btn-primario" onClick={() => { setPrevia(null); setRascunho(regraVazia()); }}>
          Nova regra
        </button>
      </div>

      {rascunho ? (
        <section className="fr-editor">
          <div className="fr-editor-topo">
            <h3>{rascunho.id ? "Editar regra" : "Nova regra"}</h3>
            <button type="button" className="fr-link" onClick={() => setRascunho(null)}>cancelar</button>
          </div>

          <div className="fr-linha">
            <label className="fr-campo">
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

          <div className="fr-passo">
            <span className="fr-passo-num">1</span>
            <div className="fr-passo-corpo">
              <h4>Onde a regra olha</h4>
              <p className="fr-ajuda">Os momentos do funil que ela vigia. Sem nenhum marcado, ela vale para o funil inteiro.</p>
              <div className="fr-chips">
                {dados.momentos.map((m) => (
                  <label key={m.codigo} className={`fr-chip ${rascunho.de_momento?.includes(m.codigo) ? "fr-chip-on" : ""}`}>
                    <input type="checkbox" checked={rascunho.de_momento?.includes(m.codigo) ?? false}
                      onChange={() => mexer("de_momento", alternarLista(rascunho.de_momento, m.codigo))} />
                    {m.rotulo}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="fr-passo">
            <span className="fr-passo-num">2</span>
            <div className="fr-passo-corpo">
              <h4>Quando ela age</h4>
              <div className="fr-linha">
                <label className="fr-campo">
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
                <div className="fr-campo">
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
              <p className="fr-ajuda">Horário de Brasília. Sem horário preenchido, vale o dia inteiro nos dias marcados.</p>
            </div>
          </div>

          <div className="fr-passo">
            <span className="fr-passo-num">3</span>
            <div className="fr-passo-corpo">
              <h4>O que ela faz</h4>
              <div className="fr-linha">
                <label className="fr-campo">
                  <span>Ação</span>
                  <select value={rascunho.acao} onChange={(e) => mexer("acao", e.target.value)}>
                    {dados.acoes.map((a) => <option key={a.v} value={a.v}>{a.t}</option>)}
                  </select>
                </label>
                {rascunho.acao === "mover" || rascunho.acao === "passar_roleta" || rascunho.acao === "enviar_abordagem" ? (
                  <label className="fr-campo">
                    <span>{rascunho.acao === "mover" ? "Move para" : "Depois da ação, move para"}</span>
                    <select value={rascunho.para_momento ?? ""} onChange={(e) => mexer("para_momento", e.target.value || null)}>
                      <option value="">— manter no mesmo momento —</option>
                      {dados.momentos.map((m) => <option key={m.codigo} value={m.codigo}>{m.rotulo}</option>)}
                    </select>
                  </label>
                ) : null}
              </div>
              {acaoAtual ? <p className="fr-ajuda">{acaoAtual.d}</p> : null}

              {rascunho.acao === "enviar_abordagem" ? (
                <>
                  <div className="fr-linha">
                    <label className="fr-campo">
                      <span>Produto (filtra as abordagens)</span>
                      <select value={rascunho.produto_id ?? ""}
                        onChange={(e) => { mexer("produto_id", e.target.value ? Number(e.target.value) : null); mexer("abordagem_ids", []); }}>
                        <option value="">— todos —</option>
                        {dados.produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                      </select>
                    </label>
                  </div>
                  <p className="fr-ajuda">Marcando mais de uma abordagem, o motor alterna entre elas. O envio sai pela instância do corretor dono do lead.</p>
                  <div className="fr-chips">
                    {abordagensDoProduto.length ? abordagensDoProduto.map((a) => (
                      <label key={a.id} className={`fr-chip ${rascunho.abordagem_ids?.includes(a.id) ? "fr-chip-on" : ""}`}>
                        <input type="checkbox" checked={rascunho.abordagem_ids?.includes(a.id) ?? false}
                          onChange={() => mexer("abordagem_ids", alternarLista(rascunho.abordagem_ids, a.id))} />
                        {a.nome}
                      </label>
                    )) : <span className="fr-vazio">Nenhuma abordagem cadastrada para este produto.</span>}
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <div className="fr-editor-rodape">
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
            <button type="button" className="fr-btn fr-btn-primario" disabled={salvando} onClick={() => void salvar()}>
              {salvando ? "Salvando…" : "Salvar regra"}
            </button>
            <button type="button" className="fr-btn" onClick={() => setRascunho(null)}>Cancelar</button>
          </div>
        </section>
      ) : null}

      <ul className="fr-lista">
        {dados.regras.map((r) => (
          <li key={r.id ?? r.nome} className={`fr-regra ${r.ativo ? "" : "fr-regra-off"}`}>
            <div className="fr-regra-topo">
              <span className="fr-ordem">{r.ordem}</span>
              <div className="fr-regra-id">
                <strong>{r.nome}</strong>
                <div className="fr-tags">
                  <span className={`fr-pill ${r.ativo ? "fr-pill-on" : "fr-pill-off"}`}>{r.ativo ? "ligada" : "desligada"}</span>
                  {r.uma_vez_por_card ? <span className="fr-pill fr-pill-info">uma vez por card</span> : null}
                </div>
              </div>
              <div className="fr-regra-acoes">
                <button type="button" className="fr-btn" onClick={() => void verPrevia(r)}>Prévia</button>
                <button type="button" className="fr-btn" onClick={() => editar(r)}>Editar</button>
                <button type="button" className="fr-btn" onClick={() => void alternar(r)}>{r.ativo ? "Desligar" : "Ligar"}</button>
                <button type="button" className="fr-btn fr-btn-perigo" onClick={() => void excluir(r)}>Excluir</button>
              </div>
            </div>

            <div className="fr-frase">
              <div className="fr-bloco">
                <span className="fr-rotulo">Onde</span>
                <p>{textoOnde(r)}</p>
              </div>
              <span className="fr-seta" aria-hidden="true">→</span>
              <div className="fr-bloco">
                <span className="fr-rotulo">Quando</span>
                <p>{textoQuando(r)}</p>
              </div>
              <span className="fr-seta" aria-hidden="true">→</span>
              <div className="fr-bloco fr-bloco-acao">
                <span className="fr-rotulo">Então</span>
                <p>{textoEntao(r)}</p>
              </div>
            </div>
            <p className="fr-janela">{textoJanela(r)}</p>

            {previa && previa.id === r.id ? (
              <div className="fr-previa">
                {!previa.dados.ativo ? (
                  <p className="fr-vazio">Esta regra está desligada — a prévia só lista candidatos de regra ligada.</p>
                ) : previa.dados.total === 0 ? (
                  <p className="fr-vazio">Nenhum card se encaixa nesta regra agora.</p>
                ) : (
                  <>
                    <p className="fr-vazio">{previa.dados.total} card(s) seriam afetados agora (mostrando até 25):</p>
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
