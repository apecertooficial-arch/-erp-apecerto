"use client";
/**
 * CARD 3.0 — o cartão do funil.
 *
 * Mostra, nesta ordem: avatar, nome, corretor, origem, interesse, temperatura,
 * última interação, tempo, mensagem pendente, próxima ação, SLA, cadência e a
 * orientação curta da Sara.
 *
 * Ações: UM botão principal e um menu "...". Nada de fileira de botões
 * competindo pela atenção de quem atende.
 */
import { useState } from "react";
import type { LeadNova } from "../../crm-nova-era/lib/rules";
import { rotuloCurtoSla, tomDoSla } from "../lib/sla3";
import type { SaidaSla } from "../../crm-nova-era/lib/slaPrimeiraAbordagem";
import type { AnaliseSara } from "../lib/adapter3";

export type AcaoMenu = { chave: string; rotulo: string };

const TEMPERATURA_ROTULO: Record<string, string> = {
  frio: "Frio",
  morno: "Morno",
  quente: "Quente",
  negociando: "Negociando",
};

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
  onAcao,
}: {
  dados: DadosCard;
  selecionado: boolean;
  rotuloPrincipal: string;
  acoes: AcaoMenu[];
  onAbrir: () => void;
  onAcao: (chave: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const { lead, sla } = dados;
  const tom = tomDoSla(sla);
  const temperatura = String(lead.momento ?? "frio");

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

      <div className="ncrm3-chips">
        <span className={`ncrm3-chip temp-${temperatura}`}>{TEMPERATURA_ROTULO[temperatura] ?? "Frio"}</span>
        {dados.interesse && <span className="ncrm3-chip">{dados.interesse}</span>}
        <span className={`ncrm3-chip sla-${tom}`} title="Tempo de resposta esperado da primeira abordagem">
          {rotuloCurtoSla(sla)}
        </span>
      </div>

      {lead.respostaPendenteCorretor && (
        <span className="ncrm3-pendente">💬 Mensagem do cliente aguardando você</span>
      )}

      <div className="ncrm3-card-proxima">
        <b>{lead.proximaAcaoTitulo ?? "Definir próxima ação"}</b>
        <span>{dataCurta(lead.proximaAcaoEm)}</span>
      </div>

      <div className="ncrm3-card-sara">
        <span aria-hidden="true">✦</span>
        {dados.analise?.proxima_acao_sugerida ? (
          <span>
            {dados.analise.justificativa ? <>{dados.analise.justificativa}<br /></> : null}
            <b>→ {dados.analise.proxima_acao_sugerida}</b>
            {dados.analise.prazo_sugerido ? ` · até ${dataCurta(dados.analise.prazo_sugerido)}` : ""}
            <em style={{ display: "block", fontStyle: "normal", opacity: .7 }}>
              Sara analisou {tempoDesde(dados.analise.analisado_em)}
            </em>
          </span>
        ) : (
          <span>{dados.orientacaoSara ?? "Sara ainda não analisou este cliente — abra a ficha para pedir a orientação."}</span>
        )}
      </div>

      <div className="ncrm3-card-rodape">
        <span>Última interação: {tempoDesde(lead.ultimaInteracaoEm)}</span>
        {/* Cadência: só enquanto o cliente NÃO respondeu — depois vira ação
            comercial e as bolinhas mentiriam. Classes nova-crm-dot vêm do CSS
            do Gate, que envolve toda a 3.0. Regressão da entrega anterior. */}
        {!lead.respondeu && (
          <span className="nova-crm-dots" title={`Tentativa ${lead.tentativas.length} de ${dados.maxTentativas ?? 4}`}
            aria-label={`Cadência: ${lead.tentativas.length} de ${dados.maxTentativas ?? 4} tentativas`}>
            {Array.from({ length: dados.maxTentativas ?? 4 }, (_, i) => {
              const t = lead.tentativas[i];
              return <i key={i} className={`nova-crm-dot ${t ? `r-${t.resultado}` : "pend"}`} />;
            })}
          </span>
        )}
      </div>

      <div className="ncrm3-card-acoes" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ncrm3-principal" onClick={onAbrir}>
          {rotuloPrincipal}
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
