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
import { useCallback, useEffect, useState } from "react";
import { montarTimeline, type LeadNova } from "../../crm-nova-era/lib/rules";
import { marcarWhatsappAberto } from "../../crm-nova-era/lib/whatsappAberto";
import { frasedaSituacao, prepararChamada, TITULO_BLOCO } from "../lib/ficha3";
import { rotuloCurtoSla } from "../lib/sla3";
import type { SaidaSla } from "../../crm-nova-era/lib/slaPrimeiraAbordagem";
import { proximaAcaoSugerida, type DecisaoSara, type SugestaoBruta } from "../lib/sara3";
import { Sara3 } from "./Sara3";
import { FormAcao3, type TipoForm } from "./FormAcao3";
import { iniciais, tempoDesde } from "./Card3";

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

const AVANCADAS: ReadonlyArray<{ tipo: TipoForm; rotulo: string }> = Object.freeze([
  { tipo: "visita", rotulo: "Agendar visita" },
  { tipo: "proposta", rotulo: "Registrar proposta" },
  { tipo: "nutricao", rotulo: "Enviar para nutrição" },
  { tipo: "descarte", rotulo: "Descartar" },
]);

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

export function Ficha3({
  lead, versao, leadId, accessToken, busy, sla, origem, interesse, email, fotoUrl, imoveis,
  onFechar, onExecutar, onCriarVisita, onAviso, onSaraCarregada,
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
  onFechar: () => void;
  onExecutar: (payload: Record<string, unknown>) => void | Promise<void>;
  onCriarVisita: (data: string, hora: string) => void | Promise<void>;
  onAviso: (texto: string) => void;
  onSaraCarregada: (negocioId: string, orientacao: string | null) => void;
}) {
  const [form, setForm] = useState<TipoForm | null>(null);
  const [inicial, setInicial] = useState<{ proximaTipo?: string; prazo?: string }>({});
  const [sara, setSara] = useState<SugestaoBruta | null>(null);
  const [saraCarregando, setSaraCarregando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const chamada = prepararChamada(lead.telefone);
  const emSaida = Boolean(lead.visitaAgendadaEm || lead.proposta || lead.descartadoMotivo || lead.nutricao);
  const timeline = montarTimeline(lead);

  const pedirSara = useCallback(async () => {
    setSaraCarregando(true);
    const r = await fetch(`/api/ncrm/sara?negocio=${lead.id}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    setSaraCarregando(false);
    if (!r.ok) { onAviso((j.error as string) || "A Sara está indisponível agora."); return; }
    const sugestao = (j.sugestao ?? j) as SugestaoBruta;
    setSara(sugestao);
    onSaraCarregada(lead.id, typeof sugestao.proxima_acao === "string" ? sugestao.proxima_acao : null);
  }, [accessToken, lead.id, onAviso, onSaraCarregada]);

  const decidirSara = useCallback(async (decisao: DecisaoSara) => {
    if (!sara) return;
    // "ajustar" é decisão humana de recusar o texto e escrever o próprio:
    // registra como rejeitada (é isso que o contrato de feedback aceita) e
    // abre o formulário em branco.
    const registrar: DecisaoSara = decisao === "aceita" ? "aceita" : "rejeitada";
    const r = await fetch(`/api/ncrm/sara`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ negocioId: Number(lead.id), baseVersao: versao, decisao: registrar, sugestao: sara }),
    });
    if (!r.ok) { onAviso("Não foi possível registrar a sua decisão — tente de novo."); return; }
    if (decisao === "aceita") {
      const prazo = typeof sara.prazo_sugerido === "string" ? sara.prazo_sugerido.slice(0, 16) : undefined;
      setInicial({ proximaTipo: proximaAcaoSugerida(sara), prazo });
      setForm("resultado");
      return;
    }
    if (decisao === "ajustada") { setInicial({}); setForm("resultado"); return; }
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
          <div className="ncrm3-chips" style={{ marginTop: 6 }}>
            <span className={`ncrm3-chip temp-${lead.momento}`}>{lead.momento}</span>
            <span className="ncrm3-chip">{rotuloCurtoSla(sla)}</span>
          </div>
        </div>
        <button type="button" className="ncrm3-ficha-fechar" onClick={onFechar} aria-label="Fechar ficha">✕</button>
      </div>

      {/* 2. Corretor, origem e interesse */}
      <section className="ncrm3-bloco">
        <h3>{TITULO_BLOCO.corretor_origem_interesse}</h3>
        <div className="ncrm3-linhas">
          <div className="ncrm3-linha"><span>Corretor</span><b>{lead.corretorNome}</b></div>
          <div className="ncrm3-linha"><span>Origem</span><b>{origem || "não informada"}</b></div>
          <div className="ncrm3-linha"><span>Interesse</span><b>{interesse || "não informado"}</b></div>
        </div>
      </section>

      {/* 3. Telefone */}
      <section className="ncrm3-bloco">
        <h3>{TITULO_BLOCO.telefone}</h3>
        {chamada.ok ? (
          <div className="ncrm3-fone">
            <span>{chamada.exibicao}</span>
            <button
              type="button" className="ncrm3-secundario"
              onClick={() => {
                void navigator.clipboard.writeText(chamada.exibicao)
                  .then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1600); })
                  .catch(() => { /* o número continua visível na tela */ });
              }}
            >
              {copiado ? "Copiado" : "Copiar"}
            </button>
          </div>
        ) : (
          <div className="ncrm3-erro" role="alert">
            <b>Não dá para chamar este cliente.</b> {chamada.explicacao} {chamada.dica}
          </div>
        )}
      </section>

      {/* 4. Chamar no WhatsApp — intenção, nunca envio */}
      <section className="ncrm3-bloco">
        <h3>{TITULO_BLOCO.chamar_whatsapp}</h3>
        {chamada.ok && (
          <>
            <a
              className="ncrm3-principal"
              href={chamada.app}
              data-e164={chamada.e164}
              onClick={() => marcarWhatsappAberto(lead.id)}
            >
              <span aria-hidden="true">💬</span>
              {lead.ultimaInteracaoEm ? "Responder no WhatsApp" : "Chamar no WhatsApp"}
            </a>
            <a className="ncrm3-secundario" href={chamada.fallback} target="_blank" rel="noopener noreferrer" onClick={() => marcarWhatsappAberto(lead.id)}>
              Não abriu? Abrir pelo WhatsApp Web
            </a>
            <p className="ncrm3-nota">
              A mensagem sai do WhatsApp do seu celular, escrita por você. O ERP não envia nada. Abrir aqui não
              encerra o prazo nem muda o momento do cliente — isso acontece quando a mensagem enviada é confirmada.
            </p>
          </>
        )}
      </section>

      {/* 5. Próxima ação */}
      <section className="ncrm3-bloco">
        <h3>{TITULO_BLOCO.proxima_acao}</h3>
        <div className="ncrm3-linhas">
          <div className="ncrm3-linha"><span>O que fazer</span><b>{lead.proximaAcaoTitulo ?? "Definir próxima ação"}</b></div>
          <div className="ncrm3-linha"><span>Para quando</span><b>{dataLonga(lead.proximaAcaoEm)}</b></div>
        </div>
        {!emSaida && (
          <div className="ncrm3-avancadas">
            <button type="button" className="ncrm3-principal" onClick={() => { setInicial({}); setForm("resultado"); }}>
              Registrar o que aconteceu
            </button>
            <button type="button" className="ncrm3-secundario" onClick={() => { setInicial({}); setForm("proxima"); }}>
              Definir próxima ação
            </button>
          </div>
        )}
      </section>

      {/* 6. Sara */}
      <section className="ncrm3-bloco">
        <h3>{TITULO_BLOCO.sara}</h3>
        <Sara3 sugestao={sara} carregando={saraCarregando} onPedir={() => void pedirSara()} onDecidir={(d) => void decidirSara(d)} />
      </section>

      {/* 7. Histórico — a conversa real, como voltou pelo WhatsApp */}
      <section className="ncrm3-bloco">
        <h3>{TITULO_BLOCO.historico}</h3>
        <Conversa3 accessToken={accessToken} negocioId={Number(lead.id)} />
      </section>

      {/* 8. Dados */}
      <section className="ncrm3-bloco">
        <h3>{TITULO_BLOCO.dados}</h3>
        <div className="ncrm3-linhas">
          <div className="ncrm3-linha"><span>E-mail</span><b>{email || "não informado"}</b></div>
          <div className="ncrm3-linha"><span>Entrou em</span><b>{dataLonga(lead.criadoEm)}</b></div>
          <div className="ncrm3-linha"><span>Última interação</span><b>{tempoDesde(lead.ultimaInteracaoEm)}</b></div>
          <div className="ncrm3-linha"><span>Abordagens confirmadas</span><b>{lead.tentativas.length}</b></div>
        </div>
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

      {/* 11. Ações avançadas */}
      <section className="ncrm3-bloco">
        <h3>{TITULO_BLOCO.acoes_avancadas}</h3>
        {emSaida ? (
          <p className="ncrm3-nota">
            {lead.visitaAgendadaEm && "Este cliente está no Pipe de Visitas."}
            {lead.proposta && "Este cliente está na Esteira de Vendas (proposta registrada — não é venda)."}
            {lead.descartadoMotivo && `Descartado: ${lead.descartadoMotivo}.`}
            {lead.nutricao && "Em nutrição."}
          </p>
        ) : (
          <div className="ncrm3-avancadas">
            {AVANCADAS.map((a) => (
              <button key={a.tipo} type="button" className="ncrm3-secundario" onClick={() => { setInicial({}); setForm(a.tipo); }}>
                {a.rotulo}
              </button>
            ))}
          </div>
        )}
      </section>

      {form && (
        <FormAcao3
          tipo={form} lead={lead} versao={versao} leadId={leadId} busy={busy} accessToken={accessToken} inicial={inicial}
          onCancelar={() => { setForm(null); setInicial({}); }}
          onCriarVisita={async (d, h) => { await onCriarVisita(d, h); setForm(null); }}
          onEnviar={async (p) => { await onExecutar(p); setForm(null); setInicial({}); }}
        />
      )}
    </aside>
  );
}
