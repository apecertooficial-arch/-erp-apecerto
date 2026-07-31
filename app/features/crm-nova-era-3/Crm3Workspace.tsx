"use client";
/**
 * CRM NOVA ERA 3.0 — a casca.
 *
 * IDENTIDADE: cabeçalho, abas, busca, filtros, cards, avatar, cores,
 * tipografia, chips, painel lateral e estados vazios são os do CRM atual. As
 * classes `crm-v2*` vêm do globals.css sem alteração; só o que é novo na 3.0
 * usa o prefixo `ncrm3-`.
 *
 * NAVEGAÇÃO: Meu Dia · Funil · Leads · Visitas · Esteira de Vendas · Agenda ·
 * Avisos · Gestão (restrita).
 *
 * O QUE ESTA TELA NÃO FAZ:
 *  - não envia mensagem (o corretor fala pelo WhatsApp do próprio celular);
 *  - não encerra SLA por clique (quem encerra é o outbound confirmado);
 *  - não move momento por clique no WhatsApp;
 *  - não mostra entrada de atendimentos, análise automática, reconciliação nem
 *    desligamento de emergência fora da aba Gestão.
 *
 * Visitas, Esteira e Agenda são as visões oficiais do CRM atual, montadas como
 * estão (mesma carga, mesmo SLA, mesmas permissões, mesmas ações). Leads passou
 * a ser tela NATIVA da 3.0 (protótipo 03): etapa do funil novo, não os estágios
 * antigos. A navegação 3.0 substitui a barra de visões interna das oficiais.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { CrmWorkspace } from "../crm/CrmWorkspace";
import { CRM3_CSS } from "./estilos";
import { abaDaUrl, abasVisiveis, definicaoDaAba, podeVerGestao, type Aba3 } from "./lib/navegacao";
import type { Momento } from "./lib/momentos";
import { slaDoLead } from "./lib/sla3";
import { analiseDesatualizada, analisesDoBoard, imoveisDoLead, paraExibicao, type AnaliseSara, type EstadoRow3, type ImovelBruto, type LeadExibicao } from "./lib/adapter3";
import { whatsappAbertoEm } from "../crm-nova-era/lib/whatsappAberto";
import type { EventoRow, PropostaRow } from "../crm-nova-era/live/adapter";
import { enriquecerComEventos } from "../crm-nova-era/live/adapter";
import { MeuDia3 } from "./components/MeuDia3";
import { Funil3 } from "./components/Funil3";
import { Ficha3, type ImovelDoLead } from "./components/Ficha3";
import { Avisos3 } from "./components/Avisos3";
import { Perdidos3 } from "./components/Perdidos3";
import { Gestao3 } from "./components/Gestao3";
import { Leads3 } from "./components/Leads3";
import type { AcaoMenu, DadosCard } from "./components/Card3";

type Perfil = { userId: string; role: string; name: string };
type Json = Record<string, unknown>;

const ACOES_CARD: AcaoMenu[] = [
  { chave: "resultado", rotulo: "Registrar o que aconteceu" },
  { chave: "proxima", rotulo: "Definir próxima ação" },
  { chave: "visita", rotulo: "Agendar visita" },
  { chave: "proposta", rotulo: "Registrar proposta" },
];

const CHAVE_SARA = "ncrm3:sara";

/* Orientações da Sara já pedidas NESTE APARELHO. localStorage, não session:
   o resumo no card sobrevive a fechar a aba. A persistência de verdade (para
   todos os aparelhos) exige a análise automática ser gravada no banco. */
function lerCacheSara(): Record<string, string> {
  try {
    const bruto = localStorage.getItem(CHAVE_SARA);
    return bruto ? (JSON.parse(bruto) as Record<string, string>) : {};
  } catch { return {}; }
}

async function api(path: string, token: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = (await res.json().catch(() => ({}))) as Json;
  return { ok: res.ok, status: res.status, json };
}

export function Crm3Workspace({ accessToken, profile }: { accessToken: string; profile: Perfil }) {
  const gestaoLiberada = podeVerGestao(profile.role);
  const [aba, setAba] = useState<Aba3>(() =>
    abaDaUrl(typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("aba"), profile.role),
  );
  const [busca, setBusca] = useState("");
  const [momento, setMomento] = useState<Momento>("novo");
  const [itens, setItens] = useState<EstadoRow3[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<LeadExibicao | null>(null);
  const [imoveis, setImoveis] = useState<ImovelDoLead[]>([]);
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [drillCorretor, setDrillCorretor] = useState<number | null>(null);
  const [formPedido, setFormPedido] = useState<"resultado" | "proxima" | "visita" | "proposta" | null>(null);
  const [saraCache, setSaraCache] = useState<Record<string, string>>({});
  const [analises, setAnalises] = useState<Record<number, AnaliseSara>>({});

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSaraCache(lerCacheSara()); }, []);

  const guardarSara = useCallback((negocioId: string, orientacao: string | null) => {
    setSaraCache((atual) => {
      const proximo = { ...atual };
      if (orientacao) proximo[negocioId] = orientacao; else delete proximo[negocioId];
      try { localStorage.setItem(CHAVE_SARA, JSON.stringify(proximo)); } catch { /* sessão sem storage: só perde o resumo do card */ }
      return proximo;
    });
  }, []);

  /* O funil é a única aba que carrega o quadro. Visitas, Esteira e Agenda são
     as visões oficiais e carregam os próprios dados; Leads 3.0 também carrega
     o próprio recorte paginado. */
  const precisaDoQuadro = aba === "funil" || aba === "gestao";

  const carregarQuadro = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const { ok, json } = await api(`/api/ncrm?scope=board&limit=120`, accessToken);
    setCarregando(false);
    if (!ok) { setErro((json.error as string) || "Não foi possível carregar o funil."); return; }
    setItens((json.itens as EstadoRow3[]) ?? []);
    setAnalises(analisesDoBoard(json.analises));
  }, [accessToken]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (precisaDoQuadro) void carregarQuadro(); }, [precisaDoQuadro, carregarQuadro]);

  /* ATUALIZAÇÃO AUTOMÁTICA, do jeito barato: só reanalisa quem tem MENSAGEM
     mais nova que a última análise, no máximo 2 por carregamento, com
     cooldown de 30min por lead (localStorage). Sem evento novo, custo zero.
     A análise persiste no banco, então UM aparelho analisando serve todos. */
  useEffect(() => {
    if (itens.length === 0) return;
    const CD_CHAVE = "ncrm3:sara:cooldown";
    let cooldown: Record<string, number> = {};
    try { cooldown = JSON.parse(localStorage.getItem(CD_CHAVE) ?? "{}"); } catch { /* ok */ }
    const agoraMs = Date.now();
    const candidatos = itens
      .filter((i) => !i.saida)
      .filter((i) => analiseDesatualizada(analises[i.negocio_id], i.ultima_interacao_em))
      .filter((i) => (cooldown[String(i.negocio_id)] ?? 0) < agoraMs - 30 * 60 * 1000)
      .slice(0, 2);
    if (candidatos.length === 0) return;
    for (const c of candidatos) cooldown[String(c.negocio_id)] = agoraMs;
    try { localStorage.setItem(CD_CHAVE, JSON.stringify(cooldown)); } catch { /* ok */ }
    let vivo = true;
    void (async () => {
      for (const c of candidatos) {
        const { ok } = await api(`/api/ncrm/sara?negocio=${c.negocio_id}`, accessToken);
        if (!vivo) return;
        if (ok) {
          const { ok: ok2, json: j2 } = await api(`/api/ncrm?scope=board&limit=120`, accessToken);
          if (vivo && ok2) setAnalises(analisesDoBoard(j2.analises));
        }
      }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, accessToken]);

  // Adoção: registra a abertura do CRM (idempotente por dia). Nada comercial muda.
  useEffect(() => {
    void fetch("/api/ncrm/acesso", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } }).catch(() => {});
  }, [accessToken]);

  const trocarAba = useCallback((nova: Aba3) => {
    setAba(nova);
    setSelId(null);
    setDetalhe(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("aba", nova);
      window.history.replaceState(null, "", url.toString());
    } catch { /* deep-link é conveniência, não requisito */ }
  }, []);

  const abrirAtendimento = useCallback(async (negocioId: string) => {
    setSelId(negocioId);
    const { ok, json } = await api(`/api/ncrm?negocio=${negocioId}`, accessToken);
    if (!ok) { setAviso((json.error as string) || "Não foi possível abrir este atendimento."); return; }
    const exib = paraExibicao(json.estado as EstadoRow3);
    setDetalhe({
      ...exib,
      lead: enriquecerComEventos(exib.lead, (json.eventos as EventoRow[]) ?? [], (json.propostas as PropostaRow[]) ?? []),
    });
    setImoveis(imoveisDoLead(json.imoveis as ImovelBruto[]));
  }, [accessToken]);

  const executar = useCallback(async (payload: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true);
    setAviso(null);
    const { ok, status, json } = await api(`/api/ncrm`, accessToken, { method: "PATCH", body: JSON.stringify(payload) });
    setBusy(false);
    if (!ok) {
      setAviso((json.mensagem as string) || (json.error as string) || "Esta ação não foi permitida.");
      if (status === 409) { await carregarQuadro(); if (selId) await abrirAtendimento(selId); }
      return;
    }
    setAviso("Registrado.");
    await carregarQuadro();
    if (selId) await abrirAtendimento(selId);
  }, [accessToken, busy, carregarQuadro, selId, abrirAtendimento]);

  const criarVisita = useCallback(async (data: string, hora: string) => {
    if (!detalhe?.leadId) { setAviso("Este atendimento não tem cliente vinculado para agendar visita."); return; }
    await executar({
      action: "agendarVisita",
      negocioId: Number(detalhe.lead.id),
      versao: detalhe.versao,
      leadId: detalhe.leadId,
      data,
      horaInicio: hora,
      idem: `ui3:agendarVisita:${detalhe.lead.id}:${data}:${hora}`,
    });
  }, [detalhe, executar]);

  const agora = useMemo(() => new Date(), []);

  const cartoes = useMemo<DadosCard[]>(() => {
    const termo = busca.trim().toLowerCase();
    return itens
      .map(paraExibicao)
      .filter((e) => !e.lead.visitaAgendadaEm && !e.lead.proposta && !e.lead.descartadoMotivo && !e.lead.nutricao)
      .filter((e) => !termo || e.lead.nome.toLowerCase().includes(termo) || (e.origem ?? "").toLowerCase().includes(termo))
      .map((e) => ({
        lead: e.lead,
        origem: e.origem,
        interesse: e.interesse,
        fotoUrl: e.fotoUrl,
        orientacaoSara: saraCache[e.lead.id] ?? null,
        analise: analises[Number(e.lead.id)] ?? null,
        maxTentativas: e.maxTentativas,
        sla: slaDoLead(
          {
            momento: e.lead.coluna,
            criadoEm: e.lead.criadoEm,
            ultimaInteracaoEm: e.lead.ultimaInteracaoEm,
            tentativasFeitas: e.tentativasFeitas,
            telefone: e.lead.telefone,
          },
          whatsappAbertoEm(e.lead.id),
          agora,
        ),
      }));
  }, [itens, busca, saraCache, analises, agora]);

  const porMomento = useMemo(() => {
    const m: Record<Momento, DadosCard[]> = { novo: [], tentando_contato: [], em_atendimento: [], em_acompanhamento: [] };
    for (const c of cartoes) m[c.lead.coluna].push(c);
    return m;
  }, [cartoes]);

  const slaDetalhe = useMemo(() => {
    if (!detalhe) return null;
    return slaDoLead(
      {
        momento: detalhe.lead.coluna,
        criadoEm: detalhe.lead.criadoEm,
        ultimaInteracaoEm: detalhe.lead.ultimaInteracaoEm,
        tentativasFeitas: detalhe.tentativasFeitas,
        telefone: detalhe.lead.telefone,
      },
      whatsappAbertoEm(detalhe.lead.id),
      agora,
    );
  }, [detalhe, agora]);

  const cabecalho = definicaoDaAba(aba);
  const abas = abasVisiveis(profile.role);
  /* Nas telas 3.0 a busca fica no cabeçalho e filtra a fila, o funil e a
     tabela de leads. Nas visões oficiais quem busca é a busca do próprio CRM
     atual, que já existe e procura em toda a base. */
  const buscaNoCabecalho = aba === "meu_dia" || aba === "funil" || aba === "leads";
  /* Aba -> visão oficial do CRM atual. "Visitas" é o Pipe que já existe dentro
     da Agenda: o mesmo dado, as mesmas ações (editar, concluir) e o mesmo CSS.
     Aqui só recortamos a tela para o painel de visitas — nada é duplicado. */
  const VISAO_OFICIAL: Record<string, { view: "leads" | "sales" | "agenda"; recorte?: string }> = {
    /* Leads deixou de montar a tabela antiga: a 3.0 tem a própria (protótipo 03). */
    visitas: { view: "agenda", recorte: "ncrm3-so-visitas" },
    esteira: { view: "sales" },
    agenda: { view: "agenda" },
  };
  const oficial = VISAO_OFICIAL[aba];

  return (
    <div className="crm-v2 ncrm3">
      <style>{CRM3_CSS}</style>

      {/* Nas visões oficiais o cabeçalho é o do próprio CRM atual — exceto na
          aba Visitas, onde o oficial diria "Agenda" e o da 3.0 assume. */}
      {(!oficial || aba === "visitas") && (
        <header className="crm-v2-header">
          <div>
            <span className="crm-eyebrow">GESTÃO COMERCIAL</span>
            <h1>CRM · {cabecalho.titulo}</h1>
            <p>{cabecalho.subtitulo}</p>
          </div>
          <div className="crm-header-actions">
            {buscaNoCabecalho && (
              <label className="crm-search-v2">
                <span>⌕</span>
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente" />
              </label>
            )}
          </div>
        </header>
      )}

      <section className="crm-command-bar">
        <nav aria-label="Visões do CRM">
          {abas.map((a) => (
            <button key={a.chave} type="button" className={aba === a.chave ? "active" : ""} onClick={() => trocarAba(a.chave)}>
              <span>{a.simbolo}</span> {a.titulo}
            </button>
          ))}
        </nav>
      </section>

      {aviso && <div className="ncrm3-aviso" role="status" onClick={() => setAviso(null)}>{aviso}</div>}

      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        {oficial ? (
          <div className={`ncrm3-oficial ${oficial.recorte ?? ""}`}>
            <CrmWorkspace
              key={aba}
              accessToken={accessToken}
              initialView={oficial.view}
              sessionRole={profile.role === "admin" ? "admin" : gestaoLiberada ? "gestor" : "corretor"}
              canReassign={gestaoLiberada}
              canAssign={gestaoLiberada}
            />
          </div>
        ) : (
          <>
            <div className="ncrm3-conteudo">
              {aba === "meu_dia" && (
                <MeuDia3
                  accessToken={accessToken}
                  corretorFiltro={drillCorretor}
                  busca={busca}
                  nome={profile.name}
                  onAbrir={(id) => { setFormPedido(null); void abrirAtendimento(id); }}
                  onIrParaVisitas={() => trocarAba("visitas")}
                />
              )}

              {aba === "funil" && (
                <>
                  {erro && <div className="ncrm3-erro">{erro}</div>}
                  {carregando && <div className="ncrm3-carregando">Carregando o funil…</div>}
                  {!carregando && !erro && (
                    <Funil3
                      porMomento={porMomento}
                      momentoAtivo={momento}
                      selecionadoId={selId}
                      acoes={ACOES_CARD}
                      onTrocarMomento={setMomento}
                      onAbrir={(id) => { setFormPedido(null); void abrirAtendimento(id); }}
                      onAcao={(id, chave) => {
                        /* O menu "..." agora cumpre o que o rotulo promete: a
                           ficha abre ja com o formulario escolhido. */
                        setFormPedido(chave as "resultado" | "proxima" | "visita" | "proposta");
                        void abrirAtendimento(id);
                      }}
                    />
                  )}
                  {!carregando && !erro && (
                    <Perdidos3 accessToken={accessToken} onAbrir={(id) => { setFormPedido(null); void abrirAtendimento(id); }} />
                  )}
                </>
              )}

              {aba === "leads" && (
                <Leads3 accessToken={accessToken} busca={busca} onAbrir={(id) => { setFormPedido(null); void abrirAtendimento(id); }} />
              )}

              {aba === "avisos" && <Avisos3 accessToken={accessToken} onAbrir={(id) => { setFormPedido(null); void abrirAtendimento(id); }} />}

              {aba === "gestao" && gestaoLiberada && (
                <Gestao3
                  accessToken={accessToken}
                  papel={profile.role}
                  totalNoFunil={cartoes.length}
                  onDrillCorretor={(cid) => { setDrillCorretor(cid); trocarAba("meu_dia"); }}
                />
              )}
            </div>

            {detalhe && slaDetalhe && (
              <Ficha3
                key={`${detalhe.lead.id}:${formPedido ?? ""}`}
                formInicial={formPedido}
                lead={detalhe.lead}
                versao={detalhe.versao}
                leadId={detalhe.leadId}
                accessToken={accessToken}
                busy={busy}
                sla={slaDetalhe}
                origem={detalhe.origem}
                interesse={detalhe.interesse}
                email={detalhe.email}
                fotoUrl={detalhe.fotoUrl}
                imoveis={imoveis}
                visitaId={detalhe.visitaId}
                onFechar={() => { setSelId(null); setDetalhe(null); setImoveis([]); setFormPedido(null); }}
                onExecutar={executar}
                onCriarVisita={criarVisita}
                onAviso={setAviso}
                onSaraCarregada={guardarSara}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
