"use client";
/* FICHA DO LEAD NO CELULAR — desenho do print 06.
 *
 * POR QUE ESTA TELA EXISTE
 * Tocar num lead no CRM do celular não abria nada. O caminho antigo fazia
 * `window.location.assign('/crm?lead=N')`: recarga completa do documento,
 * queda no CRM de desktop e download de ~1,8 MB de /api/crm antes de
 * qualquer pixel — e, se o negócio não estivesse naquele payload, um
 * `if (!deal) return;` engolia tudo em silêncio. Do lado do corretor:
 * "cliquei e não aconteceu nada".
 *
 * Aqui a ficha é uma tela do próprio aplicativo. Sem recarga, sem
 * /api/crm, e sem falha muda: o que não carrega diz que não carregou.
 *
 * O QUE PINTA NA HORA (zero espera)
 * Nome, interesse, etapa, tempo de espera, bloco da Sara, prazo,
 * evidência e o botão do WhatsApp saem do `ItemTela` que a lista já tem
 * em mãos. Na rua, com 4G ruim, a informação que decide a próxima ação
 * não pode depender de uma chamada nova.
 *
 * O QUE BUSCA
 *   - GET /api/ncrm?negocio=N          → Dados e Histórico
 *   - GET /api/ncrm/conversa?negocio=N → aba Conversa (só ao abrir a aba)
 *
 * REGRAS DE PRODUTO (README do pacote de design, §57-64)
 *   1. WhatsApp honesto: o botão ABRE o WhatsApp. O contato não é dado
 *      como feito — fica âmbar "aguardando sincronização" até a
 *      integração confirmar a mensagem no histórico.
 *   2. A Sara orienta, nunca envia.
 *   3. Histórico é somente leitura.
 *   4. Sem vocabulário técnico na tela do corretor.
 */

import { useCallback, useEffect, useState } from "react";
import { espera, type ItemTela } from "../home/telaCorretor.logica";
import {
  ABAS_FICHA, ABA_INICIAL, estadoWhatsapp, etapaHumana, evidencia,
  lerConversa, lerDetalhe, linhasDeDados, oQueFazerAgora, porQueAgora,
  prazoHumano, telefoneExibicao,
  type AbaFicha, type DetalheFicha, type MensagemFicha,
} from "./fichaLead.logica";
import { limparWhatsappAberto, marcarWhatsappAberto, whatsappAbertoEm } from "./lib/whatsappAberto";

/* A casca do app desenha cabeçalho fixo e barra inferior. A ficha é tela
   cheia — as duas coisas ao mesmo tempo dariam cabeçalho em dobro e uma
   barra que o botão do WhatsApp cobriria pela metade. Mesmo gesto que
   `body.conversa-leitura` já usa neste repositório. */
const CLASSE_CORPO = "ficha-lead-aberta";

export function FichaLeadMobile({ item, accessToken, onVoltar, onAbrirNoCrm }: {
  item: ItemTela;
  accessToken: string;
  onVoltar: () => void;
  onAbrirNoCrm?: (negocioId: number) => void;
}) {
  const [aba, setAba] = useState<AbaFicha>(ABA_INICIAL);
  const [detalhe, setDetalhe] = useState<DetalheFicha | null>(null);
  const [erroDetalhe, setErroDetalhe] = useState(false);
  const [conversa, setConversa] = useState<MensagemFicha[] | null>(null);
  const [erroConversa, setErroConversa] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [menu, setMenu] = useState(false);

  /* sessionStorage não é reativo: sem este tick o aviso âmbar só
     apareceria na próxima navegação, e o corretor volta do WhatsApp
     esperando ver alguma coisa ter mudado. */
  const [, setTick] = useState(0);

  useEffect(() => {
    document.body.classList.add(CLASSE_CORPO);
    return () => document.body.classList.remove(CLASSE_CORPO);
  }, []);

  /* Voltar do aparelho fecha a ficha em vez de sair do CRM. Sem isto o
     gesto de voltar do Android joga o corretor para fora do aplicativo. */
  useEffect(() => {
    window.history.pushState({ ficha: item.negocio_id }, "");
    const sair = () => onVoltar();
    window.addEventListener("popstate", sair);
    return () => window.removeEventListener("popstate", sair);
  }, [item.negocio_id, onVoltar]);

  useEffect(() => {
    const ctrl = new AbortController();
    let vivo = true;
    fetch(`/api/ncrm?negocio=${item.negocio_id}`, {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: ctrl.signal,
    })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((j) => { if (vivo) { setDetalhe(lerDetalhe(j)); setErroDetalhe(false); } })
      .catch((e) => { if (vivo && e?.name !== "AbortError") setErroDetalhe(true); });
    return () => { vivo = false; ctrl.abort(); };
  }, [item.negocio_id, accessToken]);

  /* A conversa só é buscada quando a aba é aberta: são mensagens de
     verdade, e baixar isso para todo lead que o corretor espia é gastar
     o 4G dele à toa. */
  useEffect(() => {
    if (aba !== "conversa" || conversa !== null) return;
    const ctrl = new AbortController();
    let vivo = true;
    fetch(`/api/ncrm/conversa?negocio=${item.negocio_id}&limit=60`, {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: ctrl.signal,
    })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((j) => { if (vivo) { setConversa(lerConversa(j)); setErroConversa(false); } })
      .catch((e) => { if (vivo && e?.name !== "AbortError") setErroConversa(true); });
    return () => { vivo = false; ctrl.abort(); };
  }, [aba, conversa, item.negocio_id, accessToken]);

  const abriuLocal = whatsappAbertoEm(item.negocio_id) != null;
  if (item.outbound_real_confirmado && abriuLocal) limparWhatsappAberto(item.negocio_id);
  const estadoWa = estadoWhatsapp(item, abriuLocal);

  const marcou = useCallback(() => {
    marcarWhatsappAberto(item.negocio_id);
    setTick((t) => t + 1);
  }, [item.negocio_id]);

  const telefone = telefoneExibicao(item.telefone_normalizado);

  const copiar = useCallback(() => {
    if (!telefone) return;
    void navigator.clipboard?.writeText(telefone).then(() => {
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1800);
    }).catch(() => { /* sem área de transferência: o número está na tela */ });
  }, [telefone]);

  const acao = oQueFazerAgora(item);
  const porque = porQueAgora(item);
  const linhas = linhasDeDados(item, detalhe);

  return (
    <div className="fl-wrap" role="dialog" aria-label={`Ficha de ${item.nome ?? "cliente"}`}>
      <header className="fl-topo">
        <button type="button" className="fl-voltar" onClick={onVoltar}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Fila
        </button>
        <span className="fl-espaco" />
        {onAbrirNoCrm && (
          <button type="button" className="fl-mais" aria-label="Mais opções" onClick={() => setMenu((m) => !m)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
            </svg>
          </button>
        )}
        {menu && onAbrirNoCrm && (
          <div className="fl-menu">
            <button type="button" onClick={() => { setMenu(false); onAbrirNoCrm(item.negocio_id); }}>
              Abrir no CRM completo
            </button>
          </div>
        )}
      </header>

      <div className="fl-corpo">
        <h1 className="fl-nome">{item.nome ?? `Negócio ${item.negocio_id}`}</h1>
        {item.interesse_resumo && <p className="fl-sub">{item.interesse_resumo}</p>}
        <div className="fl-chips">
          <span className="fl-chip">{etapaHumana(item.etapa)}</span>
          <span className="fl-chip tempo">{espera(item.tempo_espera)} esperando</span>
        </div>

        {/* BLOCO DA SARA. Lugar fixo, sempre o mesmo, no card e na ficha:
            previsibilidade é o que faz o corretor confiar nela. */}
        <section className="fl-sara" aria-label="O que fazer agora">
          <p className="fl-sara-topo">O que fazer agora</p>
          <p className="fl-sara-acao">{acao}</p>
          {porque && <p className="fl-sara-porque">{porque}</p>}
          <div className="fl-sara-rodape">
            <div>
              <span>Para quando</span>
              <b>{prazoHumano(item.proxima_acao_prazo)}</b>
            </div>
            <div>
              <span>Evidência</span>
              <b>{evidencia(item)}</b>
            </div>
          </div>
        </section>

        <div className="fl-abas" role="tablist" aria-label="Detalhes do cliente">
          {ABAS_FICHA.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={aba === a.id}
              className={`fl-aba${aba === a.id ? " on" : ""}`}
              onClick={() => setAba(a.id)}
            >
              {a.rotulo}
            </button>
          ))}
        </div>

        {aba === "dados" && (
          <div className="fl-cartao">
            <div className="fl-tel">
              <div>
                <span className="fl-rotulo">Telefone</span>
                <b className="fl-tel-num">{telefone ?? "Sem telefone cadastrado"}</b>
              </div>
              {telefone && (
                <button type="button" className="fl-copiar" onClick={copiar}>
                  {copiado ? "Copiado" : "Copiar"}
                </button>
              )}
            </div>
            {linhas.map((l) => (
              <div className="fl-linha" key={l.k}>
                <span>{l.k}</span>
                <b>{l.v}</b>
              </div>
            ))}
            {erroDetalhe && <p className="fl-aviso">Alguns dados não carregaram. O telefone e a orientação acima são os da fila.</p>}
          </div>
        )}

        {aba === "sara" && (
          <div className="fl-cartao fl-cartao-texto">
            <p className="fl-sara-longa">{acao}</p>
            {porque && <p className="fl-sara-porque escuro">{porque}</p>}
            <p className="fl-nota">A Sara orienta. Ela não envia mensagem nem move o cliente de etapa por você.</p>
          </div>
        )}

        {aba === "historico" && (
          <div className="fl-tempo-linha">
            {detalhe === null && !erroDetalhe && <div className="fl-esqueleto" aria-hidden="true"><span /><span /><span /></div>}
            {erroDetalhe && <p className="fl-aviso">Não foi possível carregar o histórico.</p>}
            {detalhe?.eventos.length === 0 && <p className="fl-vazio">Nada registrado ainda.</p>}
            {detalhe?.eventos.map((e) => (
              <div className="fl-evento" key={e.id}>
                <b>{e.rotulo}</b>
                <span>{e.quando}</span>
              </div>
            ))}
          </div>
        )}

        {aba === "conversa" && (
          <div className="fl-conversa">
            <p className="fl-nota">Somente leitura. Toda mensagem sai do seu WhatsApp — o aplicativo não envia nada por você.</p>
            {conversa === null && !erroConversa && <div className="fl-esqueleto" aria-hidden="true"><span /><span /><span /></div>}
            {erroConversa && <p className="fl-aviso">Não foi possível carregar a conversa.</p>}
            {conversa?.length === 0 && <p className="fl-vazio">Nenhuma mensagem por aqui.</p>}
            {conversa?.map((m) => (
              <div className={`fl-msg${m.minha ? " minha" : ""}`} key={m.id}>
                <span className="fl-msg-texto">{m.texto}</span>
                <span className="fl-msg-hora">{m.quando}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AÇÃO FIXA NA BASE. É o motivo de a tela existir: o polegar chega
          nela sem rolar, em qualquer aba. */}
      <div className="fl-base">
        {item.telefone_normalizado ? (
          <>
            <a
              className="fl-cta"
              href={`whatsapp://send?phone=${item.telefone_normalizado}`}
              data-e164={item.telefone_normalizado}
              onClick={marcou}
            >
              Responder no WhatsApp
            </a>
            <a
              className="fl-fallback"
              href={`https://wa.me/${item.telefone_normalizado}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={marcou}
            >
              Não abriu? WhatsApp Web
            </a>
          </>
        ) : (
          <p className="fl-sem-tel">Este cliente não tem telefone válido cadastrado.</p>
        )}

        {estadoWa === "aguardando" && (
          <p className="fl-aguardando">WhatsApp aberto — aguardando sincronização.</p>
        )}
        {estadoWa === "confirmado" && (
          <p className="fl-confirmado">Mensagem confirmada pela integração.</p>
        )}
      </div>
    </div>
  );
}
