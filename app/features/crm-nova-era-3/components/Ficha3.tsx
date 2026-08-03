"use client";
/**
 * FICHA DO CLIENTE 3.0 — painel lateral no desktop, tela cheia no celular.
 *
 * Ordem obrigatória (travada em `lib/ficha3.ts` e por teste):
 *  1 cliente e situação · 2 corretor/origem/interesse · 3 telefone
 *  4 Chamar no WhatsApp · 5 próxima ação · 6 Sara · 7 histórico
 *  8 dados · 9 imóveis · 10 linha do tempo · 11 ações avançadas
 *
 * O botão do WhatsApp registra INTENÇÃO e abre o aplicativo do celular. Ele
 * não envia, não encerra o SLA e não muda o momento — quem faz isso é o
 * outbound confirmado pelo D-API.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { montarTimeline, type LeadNova } from "../../crm-nova-era/lib/rules";
import { marcarWhatsappAberto, whatsappAbertoEm } from "../../crm-nova-era/lib/whatsappAberto";
import { frasedaSituacao, prepararChamada, TITULO_BLOCO } from "../lib/ficha3";
import type { SaidaSla } from "../../crm-nova-era/lib/slaPrimeiraAbordagem";
import { normalizarSara, proximaAcaoSugerida, type DecisaoSara, type SugestaoBruta } from "../lib/sara3";
import { Sara3 } from "./Sara3";
import { FormAcao3, type TipoForm } from "./FormAcao3";
import { iniciais, tempoDesde } from "./Card3";
import type { AnaliseSara } from "../lib/adapter3";
import { condutaOficial, momentosDaEtapa } from "../lib/conduta3";

export type ImovelDoLead = { id: string; nome: string; bairro: string | null; cidade: string | null };

type Mensagem = {
  id: string;
  direcao: string | null;
  tipo: string | null;
  conteudo: string | null;
  media_url: string | null;
  enviado_em: string | null;
  criado_em: string | null;
  transcricao: string | null;
};

/** (11) 9 ****-2869 — como no protótipo. O botão Copiar copia o número real. */
function mascararFone(exibicao: string): string {
  const d = exibicao.replace(/\D/g, "");
  if (d.length < 8) return exibicao;
  const fim = d.slice(-4);
  const ddd = d.length >= 10 ? d.slice(-11, -9) || d.slice(0, 2) : "";
  const nono = d.length >= 11 ? `${d.slice(-9, -8)} ` : "";
  return ddd ? `(${ddd}) ${nono}****-${fim}` : `****-${fim}`;
}

function dataLonga(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR");
}

function Conversa3({ accessToken, negocioId }: { accessToken: string; negocioId: number }) {
  const [msgs, setMsgs] = useState<Mensagem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    void fetch(`/api/ncrm/conversa?negocio=${negocioId}&limit=60`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!vivo) return;
        if (ok) setMsgs((j.mensagens as Mensagem[]) ?? []);
        else setErro((j.error as string) || "Conversa indisponível.");
      })
      .catch(() => { if (vivo) setErro("Conversa indisponível."); });
    return () => { vivo = false; };
  }, [accessToken, negocioId]);

  if (erro) return <p className="ncrm3-nota">{erro}</p>;
  if (!msgs) return <p className="ncrm3-nota">Carregando a conversa…</p>;
  if (msgs.length === 0) return <p className="ncrm3-nota">Nenhuma mensagem trocada com este cliente ainda.</p>;

  return (
    <div className="ncrm3-conversa">
      {msgs.map((m) => {
        const doCliente = ["recebida", "entrada", "in", "inbound", "received"].includes(String(m.direcao ?? "").toLowerCase());
        return (
          <div key={m.id} className={`ncrm3-msg ${doCliente ? "cliente" : "corretor"}`}>
            <em>{doCliente ? "Cliente" : "Corretor"} · {dataLonga(m.enviado_em ?? m.criado_em)}</em>
            {m.tipo === "audio" && m.media_url && <audio controls preload="none" src={m.media_url} style={{ maxWidth: "100%" }} />}
            {(m.tipo === "imagem" || m.tipo === "foto") && m.media_url && (
              <a href={m.media_url} target="_blank" rel="noreferrer">ver imagem</a>
            )}
            {m.conteudo && <div>{m.conteudo}</div>}
            {m.transcricao && <div style={{ fontStyle: "italic", color: "var(--muted)" }}>transcrição: “{m.transcricao}”</div>}
          </div>
        );
      })}
    </div>
  );
}

const RESULTADOS_VISITA: ReadonlyArray<{ valor: string; rotulo: string }> = Object.freeze([
  { valor: "fara_proposta", rotulo: "Vai fazer proposta" },
  { valor: "interessado", rotulo: "Gostou — seguir o contato" },
  { valor: "quer_outra_opcao", rotulo: "Quer outra opção" },
  { valor: "precisa_conversar", rotulo: "Precisa conversar em casa" },
  { valor: "remarcar", rotulo: "Remarcar a visita" },
  { valor: "nao_compareceu", rotulo: "Não compareceu" },
  { valor: "nao_gostou", rotulo: "Não gostou" },
]);

export function Ficha3({
  lead, versao, leadId, accessToken, busy, origem, interesse, email, fotoUrl, imoveis, visitaId,
  momentoCodigo, tentativasFeitas,
  analiseInicial, formInicial, onFechar, onExecutar, onCriarVisita, onAviso, onSaraCarregada,
}: {
  lead: LeadNova;
  versao: number;
  leadId: number | null;
  accessToken: string;
  busy: boolean;
  sla: SaidaSla;
  origem: string | null;
  interesse: string | null;
  email: string | null;
  fotoUrl: string | null;
  imoveis: ImovelDoLead[];
  /** Visita em aberto no Pipe — habilita registrar o desfecho aqui mesmo. */
  visitaId?: string | null;
  momentoCodigo?: string | null;
  tentativasFeitas?: number;
  /** Última leitura persistida: a ficha não pode "esquecer" a Sara ao fechar. */
  analiseInicial?: AnaliseSara | null;
  /* Formulario que deve abrir junto com a ficha (menu "..." do card).
     Antes, as quatro opcoes do menu faziam a mesma coisa: so abriam a ficha.
     Botao que promete uma acao e entrega outra ensina o corretor a nao clicar. */
  formInicial?: TipoForm | null;
  onFechar: () => void;
  onExecutar: (payload: Record<string, unknown>) => boolean | Promise<boolean>;
  onCriarVisita: (data: string, hora: string) => void | Promise<void>;
  onAviso: (texto: string) => void;
  onSaraCarregada: (negocioId: string, orientacao: string | null) => void;
}) {
  const [form, setForm] = useState<TipoForm | null>(formInicial ?? null);
  const [inicial, setInicial] = useState<{ proximaTipo?: string; prazo?: string }>({});
  const [sara, setSara] = useState<SugestaoBruta | null>(() => analiseInicial ? {
    evidencias: [],
    evidencia_suficiente: true,
    etapa_sugerida: analiseInicial.etapa_sugerida,
    temperatura: analiseInicial.etapa_sugerida,
    proxima_acao: analiseInicial.proxima_acao_sugerida,
    prazo_sugerido: analiseInicial.prazo_sugerido,
    justificativa: analiseInicial.justificativa,
    confianca: analiseInicial.confianca ?? 0,
  } : null);
  const [saraCarregando, setSaraCarregando] = useState(false);
  const aplicandoSara = false;
  const [copiado, setCopiado] = useState(false);
  /* WhatsApp honesto (prints 12-14): clicar só ABRE o app. O estado fica âmbar
     "aguardando sincronização" e vira verde quando a integração oficial
     identifica uma mensagem enviada DEPOIS do clique. */
  const [waAbertoAgora, setWaAbertoAgora] = useState(false);
  const [menuAtualizarAberto, setMenuAtualizarAberto] = useState(false);
  const menuAtualizarRef = useRef<HTMLDetailsElement>(null);
  const waAbertoEm = whatsappAbertoEm(lead.id) ?? (waAbertoAgora ? new Date() : null);
  const waConfirmadoEm = (() => {
    if (!waAbertoEm) return null;
    for (const t of lead.tentativas) {
      const em = Date.parse(t.em);
      if (Number.isFinite(em) && em > waAbertoEm.getTime()) return t.em;
    }
    return null;
  })();

  const chamada = prepararChamada(lead.telefone);
  const checklistSara = normalizarSara(sara)?.checklist ?? null;
  const emSaida = Boolean(lead.proposta || lead.descartadoMotivo || lead.nutricao);
  const visitaAgendada = Boolean(lead.visitaAgendadaEm && visitaId);
  const timeline = montarTimeline(lead);
  const conduta = condutaOficial({
    etapa: lead.coluna, momentoCodigo,
    proximaAcao: lead.proximaAcaoTitulo, proximaAcaoEm: lead.proximaAcaoEm,
    respondeu: lead.respondeu, respostaPendente: lead.respostaPendenteCorretor,
    tentativasFeitas,
  }, analiseInicial ?? null);

  const fecharMenuAtualizar = useCallback(() => {
    setMenuAtualizarAberto(false);
    if (menuAtualizarRef.current) menuAtualizarRef.current.open = false;
  }, []);

  const pedirSara = useCallback(async () => {
    setSaraCarregando(true);
    const r = await fetch(`/api/ncrm/sara?negocio=${lead.id}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    setSaraCarregando(false);
    if (!r.ok) { onAviso((j.error as string) || "A Sara está indisponível agora."); return; }
    const sugestao: SugestaoBruta = { ...((j.sugestao ?? j) as SugestaoBruta), conduta_aplicada: j.aplicada === true };
    setSara(sugestao);
    onSaraCarregada(lead.id, typeof sugestao.proxima_acao === "string" ? sugestao.proxima_acao : null);
  }, [accessToken, lead.id, onAviso, onSaraCarregada]);

  /* Um lead aberto sem leitura não pode ficar sem direção. A consulta é
     automática e persistida; não depende de o corretor descobrir um botão. */
  useEffect(() => {
    if (!sara && !saraCarregando) {
      const timer = window.setTimeout(() => void pedirSara(), 0);
      return () => window.clearTimeout(timer);
    }
    // A abertura do atendimento é o gatilho; não repetir durante a mesma ficha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  /** Fecha o ciclo operacional: humano cumpre -> banco recalcula -> Sara relê. */
  const executarEReavaliar = useCallback(async (payload: Record<string, unknown>) => {
    const gravou = await onExecutar(payload);
    if (!gravou) return false;
    onAviso("Ação concluída. A Sara está conferindo e preparando o próximo passo…");
    await pedirSara();
    return true;
  }, [onExecutar, onAviso, pedirSara]);

  const decidirSara = useCallback(async (decisao: DecisaoSara) => {
    if (!sara) return;
    /* O feedback aceita "aceita" ou "rejeitada". "Ajustar" é o corretor
       recusando o texto para escrever o próprio — do ponto de vista do
       aprendizado da Sara, isso é uma rejeição, e é assim que fica registrado. */
    const registrar: DecisaoSara = decisao === "aceita" ? "aceita" : "rejeitada";
    const r = await fetch(`/api/ncrm/sara`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ negocioId: Number(lead.id), baseVersao: versao, decisao: registrar, sugestao: sara }),
    });
    if (!r.ok) { onAviso("Não foi possível registrar a sua decisão — tente de novo."); return; }

    /* Feedback positivo NÃO significa concluir a ação. A execução só é
       registrada em "Ação feita", com evidência do D-API quando aplicável. */
    if (decisao === "aceita") {
      onAviso("Leitura confirmada. Execute a ação indicada e use “Ação feita”; o CRM só conclui após a evidência real.");
      return;
    }

    if (decisao === "ajustada") {
      const prazo = typeof sara.prazo_sugerido === "string" ? sara.prazo_sugerido.slice(0, 16) : undefined;
      setInicial({ proximaTipo: proximaAcaoSugerida(sara), prazo });
      setForm("resultado");
      return;
    }

    setSara(null);
    onSaraCarregada(lead.id, null);
    onAviso("Orientação descartada — a Sara recebeu o retorno.");
  }, [accessToken, lead.id, onAviso, onSaraCarregada, sara, versao]);

  return (
    <aside className="ncrm3-ficha" aria-label={`Ficha de ${lead.nome}`}>
      {/* 1. Cliente e situação */}
      <div className="ncrm3-ficha-topo">
        <span className="lead-avatar">
          {fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fotoUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
          ) : (
            iniciais(lead.nome)
          )}
        </span>
        <div style={{ minWidth: 0 }}>
          <h2>{lead.nome}</h2>
          <span className="ncrm3-situacao">{frasedaSituacao(lead)}</span>
          <span className="ncrm3-ficha-contexto">{lead.corretorNome} · {interesse || origem || "interesse não informado"}</span>
        </div>
        <button type="button" className="ncrm3-ficha-fechar" onClick={onFechar} aria-label="Fechar ficha">✕</button>
      </div>

      {/* Barra de trabalho: as ações que movem a operação ficam sempre no topo. */}
      <section className="ncrm3-acoes-topo" aria-label="Ações do atendimento">
        {chamada.ok && waConfirmadoEm && (
          <div className="ncrm3-wa-confirmado" role="status">
            ✓ Mensagem identificada no histórico
            <small>{new Date(waConfirmadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · confirmado pela integração oficial</small>
          </div>
        )}
        {chamada.ok && !waConfirmadoEm && waAbertoEm && (
          <div className="ncrm3-wa-aguardando" role="status">
            WhatsApp aberto — aguardando sincronização
            <i aria-hidden="true" />
          </div>
        )}
        {chamada.ok && !waConfirmadoEm && (
          <a
            className="ncrm3-acao-rapida principal"
            href={chamada.app}
            data-e164={chamada.e164}
            onClick={() => { marcarWhatsappAberto(lead.id); setWaAbertoAgora(true); }}
          >
            <span aria-hidden="true">💬</span> WhatsApp
          </a>
        )}
        {!chamada.ok && <button type="button" className="ncrm3-acao-rapida principal" disabled>WhatsApp indisponível</button>}
        <button type="button" className="ncrm3-acao-rapida" disabled={busy || emSaida}
          onClick={() => { setInicial({}); setForm("visita"); }}>
          <span aria-hidden="true">◇</span> Agendar visita
        </button>
        <button type="button" className="ncrm3-acao-rapida" disabled={busy || emSaida}
          onClick={() => { setInicial({}); setForm("proposta"); }}>
          <span aria-hidden="true">$</span> Lançar negociação
        </button>
        <details ref={menuAtualizarRef} className="ncrm3-atualizar-menu" onToggle={(e) => setMenuAtualizarAberto(e.currentTarget.open)}>
          <summary aria-expanded={menuAtualizarAberto}>Atualizar <span aria-hidden="true">⌄</span></summary>
          <div>
            {!emSaida && <button type="button" onClick={() => { fecharMenuAtualizar(); setInicial({}); setForm("resultado"); }}>Marcar ação como feita</button>}
            <button type="button" disabled={saraCarregando} onClick={() => { fecharMenuAtualizar(); void pedirSara(); }}>Reavaliar conversa com a Sara</button>
            {!emSaida && <button type="button" onClick={() => { fecharMenuAtualizar(); setInicial({}); setForm("nutricao"); }}>Enviar para nutrição</button>}
            {!emSaida && <button type="button" className="perigo" onClick={() => { fecharMenuAtualizar(); setInicial({}); setForm("descarte"); }}>Descartar atendimento</button>}
          </div>
        </details>
        {!emSaida && (
          <details className="ncrm3-momento-menu">
            <summary>Momento: {conduta.momento} <span aria-hidden="true">⌄</span></summary>
            <div>
              <p>Em qual situação este cliente está agora?</p>
              {momentosDaEtapa(lead.coluna).map((momento) => (
                <button
                  key={momento.codigo}
                  type="button"
                  className={momento.codigo === conduta.momentoCodigo ? "selecionado" : ""}
                  disabled={busy || momento.codigo === conduta.momentoCodigo}
                  onClick={() => void onExecutar({
                    action: "atualizarMomento",
                    negocioId: Number(lead.id),
                    versao,
                    momentoCodigo: momento.codigo,
                    observacao: "Momento atualizado pelo corretor",
                  })}
                >
                  <strong>{momento.rotulo}</strong>
                  <span>{momento.objetivo}</span>
                </button>
              ))}
            </div>
          </details>
        )}
        <details className="ncrm3-contato-detalhes">
          <summary>Telefone e alternativas</summary>
          <div>
            {chamada.ok ? <>
              <span>{mascararFone(chamada.exibicao)}</span>
              <button type="button" onClick={() => {
                void navigator.clipboard.writeText(chamada.exibicao)
                  .then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1600); })
                  .catch(() => undefined);
              }}>{copiado ? "Copiado" : "Copiar número"}</button>
              <a href={chamada.fallback} target="_blank" rel="noopener noreferrer" onClick={() => { marcarWhatsappAberto(lead.id); setWaAbertoAgora(true); }}>Abrir WhatsApp Web</a>
            </> : <span>{chamada.explicacao} {chamada.dica}</span>}
          </div>
        </details>
      </section>

      {/* Uma única ordem operacional. A análise extensa não compete com ela. */}
      <section className="ncrm3-bloco ncrm3-conduta-ficha">
        <h3>O QUE FAZER AGORA</h3>
        <div className={`ncrm3-conduta prazo-${conduta.prazoInfo.status}`}>
          <span className="ncrm3-conduta-label">MOMENTO {conduta.momentoOrdem}/10 · {conduta.momento}</span>
          <small>{conduta.situacao}</small>
          <span className="ncrm3-conduta-label">PRÓXIMA AÇÃO</span>
          <b>{conduta.acao}</b>
          <span className="ncrm3-conduta-prazo">{conduta.prazoInfo.rotulo}{conduta.prazo ? ` · até ${dataLonga(conduta.prazo)}` : ""}</span>
          <em>Objetivo: {conduta.objetivo}</em>
        </div>
        <details className="ncrm3-sara-explicacao">
          <summary>Por que esta conduta foi definida?</summary>
          {conduta.justificativa && <p>{conduta.justificativa}</p>}
          <Sara3 sugestao={sara} carregando={saraCarregando} aplicando={aplicandoSara}
            onPedir={() => void pedirSara()} onDecidir={(d) => void decidirSara(d)} />
        </details>
      </section>

      {/* A conversa continua acessível, mas não empurra a ordem operacional para baixo. */}
      <details className="ncrm3-ficha-extras ncrm3-historico-recolhido">
        <summary>Ver conversa e histórico</summary>
        <div className="ncrm3-historico-conteudo"><Conversa3 accessToken={accessToken} negocioId={Number(lead.id)} /></div>
      </details>

      <details className="ncrm3-ficha-extras">
        <summary>Dados e informações do cliente</summary>
        <div>
      {/* 8. Dados */}
      <section className="ncrm3-bloco">
        <h3>{TITULO_BLOCO.dados}</h3>
        <div className="ncrm3-linhas">
          <div className="ncrm3-linha"><span>E-mail</span><b>{email || "não informado"}</b></div>
          <div className="ncrm3-linha"><span>Entrou em</span><b>{dataLonga(lead.criadoEm)}</b></div>
          <div className="ncrm3-linha"><span>Última interação</span><b>{tempoDesde(lead.ultimaInteracaoEm)}</b></div>
          <div className="ncrm3-linha"><span>Abordagens confirmadas</span><b>{lead.tentativas.length}</b></div>
        </div>
        {/* O que o cliente já disse sobre o que procura. Sai da conversa real,
            pela análise da Sara — não é um formulário que alguém preenche. */}
        {checklistSara && (
          <div className="ncrm3-linhas" style={{ marginTop: 4 }}>
            {checklistSara.descobertos.map((i) => (
              <div key={i.chave} className="ncrm3-linha"><span>{i.rotulo}</span><b>{i.valor}</b></div>
            ))}
            {checklistSara.descobertos.length === 0 && (
              <p className="ncrm3-nota">A conversa ainda não revelou o que este cliente procura.</p>
            )}
          </div>
        )}
      </section>

      {/* 9. Imóveis */}
      <section className="ncrm3-bloco">
        <h3>{TITULO_BLOCO.imoveis}</h3>
        {imoveis.length === 0 ? (
          <p className="ncrm3-nota">Nenhum imóvel vinculado a este cliente ainda.</p>
        ) : (
          <div className="ncrm3-linhas">
            {imoveis.map((i) => (
              <div key={i.id} className="ncrm3-linha">
                <span>{i.nome}</span>
                <b>{[i.bairro, i.cidade].filter(Boolean).join(" · ") || "—"}</b>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 10. Linha do tempo */}
      <section className="ncrm3-bloco">
        <h3>{TITULO_BLOCO.linha_do_tempo}</h3>
        {timeline.length === 0 ? (
          <p className="ncrm3-nota">Ainda não há registros de atendimento.</p>
        ) : (
          <ul className="ncrm3-tempo">
            {timeline.map((e, i) => (
              <li key={i}>
                <span>{dataLonga(e.em)}</span>
                <b>{e.tipo.replace(/_/g, " ")}{e.numero ? ` #${e.numero}` : ""}{e.resultado ? ` — ${e.resultado}` : ""}</b>
              </li>
            ))}
          </ul>
        )}
      </section>

        </div>
      </details>

      {/* Visita é uma visão paralela do mesmo atendimento, não uma saída. */}
      {(emSaida || visitaAgendada) && <section className="ncrm3-bloco">
        <h3>{visitaAgendada ? "VISITA AGENDADA" : "ANDAMENTO FORA DO FUNIL"}</h3>
        {emSaida ? (
          <>
            <p className="ncrm3-nota">
              {lead.visitaAgendadaEm && "Este cliente está no Pipe de Visitas."}
              {lead.proposta && "Este cliente está na Esteira de Vendas (proposta registrada — não é venda)."}
              {lead.descartadoMotivo && `Descartado: ${lead.descartadoMotivo}.`}
              {lead.nutricao && "Em nutrição."}
            </p>
            {/* O que aconteceu na visita? Cada desfecho leva o cliente a algum
                lugar — quem decide o destino é o banco, nunca a tela. */}
          </>
        ) : null}
        {visitaAgendada && visitaId && (
          <div className="ncrm3-avancadas" style={{ marginTop: 8 }}>
            <p className="ncrm3-nota">O cliente continua em atendimento e também aparece em Visitas. Depois do horário, registre o que aconteceu.</p>
            {RESULTADOS_VISITA.map((r) => (
              <button key={r.valor} type="button" className="ncrm3-secundario" disabled={busy}
                onClick={() => void onExecutar({
                  action: "registrarResultadoVisita",
                  negocioId: Number(lead.id), versao, visitaId, resultado: r.valor,
                  idem: `ui3:resultadoVisita:${visitaId}:${r.valor}`,
                })}>
                {r.rotulo}
              </button>
            ))}
          </div>
        )}
      </section>}

      {form && (
        <FormAcao3
          tipo={form} lead={lead} versao={versao} leadId={leadId} busy={busy} accessToken={accessToken} inicial={inicial}
          onCancelar={() => { setForm(null); setInicial({}); }}
          onCriarVisita={async (d, h) => { await onCriarVisita(d, h); setForm(null); }}
          onEnviar={async (p) => {
            const gravou = form === "resultado" ? await executarEReavaliar(p) : await onExecutar(p);
            if (gravou) { setForm(null); setInicial({}); }
          }}
        />
      )}
    </aside>
  );
}
