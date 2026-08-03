"use client";
/**
 * CARD 3.0 — o cartão do funil.
 *
 * Mostra somente a ordem de trabalho que o corretor precisa compreender sem
 * interpretar a tela: MOMENTO -> AÇÃO -> PRAZO. Contexto e inteligência mais
 * detalhados ficam na ficha; a conversa real abre direto pelo botão Chat.
 *
 * Ações: Chat, atendimento e menu "...". São dois destinos diferentes e
 * explícitos: ler a conversa ou trabalhar a ficha.
 */
import { useState } from "react";
import type { LeadNova } from "../../crm-nova-era/lib/rules";
import { tomDoSla } from "../lib/sla3";
import type { SaidaSla } from "../../crm-nova-era/lib/slaPrimeiraAbordagem";
import type { AnaliseSara } from "../lib/adapter3";
import { condutaOficial } from "../lib/conduta3";

export type AcaoMenu = { chave: string; rotulo: string };

export function iniciais(nome: string | null | undefined): string {
  return (nome || "Lead")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
}

export function tempoDesde(iso: string | null | undefined, agora: number = Date.now()): string {
  if (!iso) return "sem interação";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "sem interação";
  const min = Math.max(0, Math.floor((agora - t) / 60000));
  if (min < 60) return `há ${min} min`;
  if (min < 60 * 24) return `há ${Math.floor(min / 60)}h`;
  const dias = Math.floor(min / (60 * 24));
  if (dias < 30) return `há ${dias}d`;
  return `há ${Math.floor(dias / 30)} ${Math.floor(dias / 30) === 1 ? "mês" : "meses"}`;
}

function dataCurta(iso: string | null | undefined): string {
  if (!iso) return "sem prazo";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "sem prazo";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export type DadosCard = {
  lead: LeadNova;
  /** Origem e interesse vêm do cadastro do lead (mesma fonte do CRM atual). */
  origem: string | null;
  interesse: string | null;
  fotoUrl: string | null;
  sla: SaidaSla;
  /** Orientação da Sara já carregada neste aparelho. null = ainda não analisou. */
  orientacaoSara: string | null;
  /** Análise persistida no banco — vale para todos os aparelhos. */
  analise?: AnaliseSara | null;
  /** Máximo de tentativas da régua deste lead (workflow versionado). */
  maxTentativas?: number;
};

export function Card3({
  dados,
  selecionado,
  rotuloPrincipal,
  acoes,
  onAbrir,
  onChat,
  onAcao,
}: {
  dados: DadosCard;
  selecionado: boolean;
  rotuloPrincipal: string;
  acoes: AcaoMenu[];
  onAbrir: () => void;
  onChat: () => void;
  onAcao: (chave: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const { lead, sla } = dados;
  const tom = tomDoSla(sla);
  const conduta = condutaOficial({
    etapa: lead.coluna, proximaAcao: lead.proximaAcaoTitulo, proximaAcaoEm: lead.proximaAcaoEm,
    respondeu: lead.respondeu, respostaPendente: lead.respostaPendenteCorretor,
  }, dados.analise);

  return (
    <article
      className={`ncrm3-card tom-${tom} ${selecionado ? "sel" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={`Abrir ${lead.nome}`}
      onClick={onAbrir}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAbrir();
        }
      }}
    >
      <div className="ncrm3-card-topo">
        {/* Mesmo avatar do CRM atual: foto do contato ou as iniciais. */}
        <span className="lead-avatar">
          {dados.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dados.fotoUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
          ) : (
            iniciais(lead.nome)
          )}
        </span>
        <div className="ncrm3-card-nome">
          <strong>{lead.nome}</strong>
          <span>
            {lead.corretorNome}
            {dados.origem ? ` · ${dados.origem}` : ""}
          </span>
        </div>
      </div>

      {lead.respostaPendenteCorretor && (
        <span className="ncrm3-pendente">💬 Mensagem do cliente aguardando você</span>
      )}

      <div className={`ncrm3-ordem-card prazo-${conduta.prazoInfo.status}`}>
        <div className="ncrm3-ordem-momento">
          <span>MOMENTO {conduta.momentoOrdem}/4</span>
          <strong>{conduta.momento}</strong>
        </div>
        <div className="ncrm3-ordem-acao">
          <span>PRÓXIMA AÇÃO</span>
          <strong>{conduta.acao}</strong>
        </div>
        <div className="ncrm3-ordem-prazo">
          <span>PRAZO</span>
          <b>{conduta.prazoInfo.rotulo}{conduta.prazo ? ` · ${dataCurta(conduta.prazo)}` : ""}</b>
        </div>
      </div>

      <div className="ncrm3-card-rodape">
        <span>Último contato: {tempoDesde(lead.ultimaInteracaoEm)}</span>
        {!lead.respondeu && (
          <span>Cadência {lead.tentativas.length}/{dados.maxTentativas ?? 4}</span>
        )}
      </div>

      <div className="ncrm3-card-acoes" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ncrm3-chat-card" onClick={onChat}>
          💬 Chat
        </button>
        <button type="button" className="ncrm3-principal" onClick={onAbrir}>
          {rotuloPrincipal === "Abrir atendimento" ? "Ver atendimento" : rotuloPrincipal}
        </button>
        <div className="ncrm3-mais">
          <button type="button" aria-haspopup="menu" aria-expanded={menu} aria-label="Mais ações" onClick={() => setMenu((v) => !v)}>
            ⋯
          </button>
          {menu && (
            <div className="ncrm3-menu" role="menu">
              {acoes.map((a) => (
                <button
                  key={a.chave}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(false);
                    onAcao(a.chave);
                  }}
                >
                  {a.rotulo}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
