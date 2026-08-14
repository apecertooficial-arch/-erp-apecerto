"use client";

import { useEffect, useRef, useState } from "react";

type Mensagem = {
  id: string;
  direcao: string | null;
  tipo: string | null;
  conteudo: string | null;
  media_url: string | null;
  enviado_em: string | null;
  criado_em: string | null;
  status: string | null;
  transcricao: string | null;
};

type Instancia = {
  id: string;
  rotulo: string;
  telefone: string | null;
  status: string | null;
  atual: boolean;
};

type Payload = {
  mensagens?: Mensagem[];
  instancias?: Instancia[];
  historicoCompleto?: boolean;
  error?: string;
};

const dataHora = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function Funil2ConversationDrawer({ accessToken, leadId, nome, onClose }: { accessToken: string; leadId: string; nome: string; onClose: () => void }) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [instancias, setInstancias] = useState<Instancia[]>([]);
  const [historicoCompleto, setHistoricoCompleto] = useState(true);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const listaRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const controle = new AbortController();
    setCarregando(true);
    fetch(`/api/funil2/conversa?lead=${encodeURIComponent(leadId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controle.signal,
    }).then(async (resposta) => {
      const payload = await resposta.json().catch(() => ({})) as Payload;
      if (!resposta.ok) throw new Error(payload.error || "Não foi possível carregar a conversa.");
      setMensagens(payload.mensagens ?? []);
      setInstancias(payload.instancias ?? []);
      setHistoricoCompleto(payload.historicoCompleto !== false);
    }).catch((falha) => {
      if (falha instanceof DOMException && falha.name === "AbortError") return;
      setErro(falha instanceof Error ? falha.message : "Não foi possível carregar a conversa.");
    }).finally(() => setCarregando(false));
    return () => controle.abort();
  }, [accessToken, leadId]);

  useEffect(() => {
    if (!carregando && listaRef.current) listaRef.current.scrollTop = listaRef.current.scrollHeight;
  }, [carregando, mensagens]);

  return <div className="f2-conversa-overlay" onMouseDown={(evento) => { if (evento.target === evento.currentTarget) onClose(); }}>
    <aside className="f2-conversa" aria-label={`Conversa de ${nome}`}>
      <header><div><span>HISTÓRICO DO FUNIL 2.0</span><h2>{nome}</h2><p>Somente leitura · responda pelo WhatsApp do celular</p></div><button type="button" onClick={onClose} aria-label="Fechar conversa">×</button></header>
      <div className="f2-conversa-instancias">
        {instancias.map((instancia) => <span className={instancia.atual ? "atual" : ""} key={instancia.id}><i />{instancia.rotulo}{instancia.telefone ? ` · ${instancia.telefone}` : ""}</span>)}
        {!instancias.length && !carregando && <span>Nenhuma instância vinculada ao histórico.</span>}
      </div>
      {!historicoCompleto && <div className="f2-conversa-corte">Este lead foi pescado. O histórico anterior à pesca continua protegido.</div>}
      {erro && <div className="f2-conversa-erro">{erro}</div>}
      <section className="f2-conversa-mensagens" ref={listaRef}>
        {carregando && <p>Carregando conversa real…</p>}
        {!carregando && !erro && mensagens.map((mensagem) => <article className={mensagem.direcao === "enviada" ? "enviada" : "recebida"} key={mensagem.id}>
          <small>{mensagem.tipo || "mensagem"}</small>
          {mensagem.media_url && <a href={mensagem.media_url} target="_blank" rel="noreferrer">Abrir mídia</a>}
          {mensagem.conteudo && <p>{mensagem.conteudo}</p>}
          {mensagem.transcricao && mensagem.transcricao !== mensagem.conteudo && <em>{mensagem.transcricao}</em>}
          <time>{mensagem.criado_em || mensagem.enviado_em ? dataHora.format(new Date(mensagem.criado_em || mensagem.enviado_em!)) : ""}</time>
        </article>)}
        {!carregando && !erro && !mensagens.length && <p>Nenhuma mensagem disponível para este lead.</p>}
      </section>
    </aside>
  </div>;
}
