"use client";
/**
 * SARA NA FICHA 3.0 — observer/assist. Ela SUGERE; quem decide é o corretor.
 *
 * Exibe o checklist de qualificação (o que ja sabemos e o que falta),
 * evidências, momento sugerido, próxima ação, prazo, roteiro, texto para
 * copiar e risco. Três decisões: usar a orientação, ajustar ou dizer que não
 * faz sentido.
 *
 * "Usar orientação" REGISTRA a ação sugerida — um clique, sem reescrever o que
 * a Sara já escreveu. O momento do cliente muda como consequência da ação
 * registrada, calculada pelo banco; a Sara não escreve etapa em lugar nenhum.
 * Envio de mensagem continua fora: isso é do WhatsApp do corretor.
 */
import { useState } from "react";
import { ACOES_SARA, normalizarSara, type DecisaoSara, type SugestaoBruta } from "../lib/sara3";
import { resumoChecklist } from "../lib/qualificacao";

export function Sara3({
  sugestao,
  carregando,
  aplicando,
  onPedir,
  onDecidir,
}: {
  sugestao: SugestaoBruta | null;
  carregando: boolean;
  /** true enquanto a ação aceita está sendo registrada no banco. */
  aplicando?: boolean;
  onPedir: () => void;
  onDecidir: (decisao: DecisaoSara) => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const s = normalizarSara(sugestao);

  if (!s) {
    return (
      <div className="ncrm3-sara">
        <h4>Sara</h4>
        <p>A Sara lê a conversa real e diz qual é o próximo passo. Ela nunca envia mensagem por você.</p>
        <div className="ncrm3-sara-acoes">
          <button type="button" className="usar" onClick={onPedir} disabled={carregando}>
            {carregando ? "Consultando…" : "Pedir orientação da Sara"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ncrm3-sara">
      <h4>Orientação da Sara</h4>
      <p>Sugestão, não ordem. Nenhuma mensagem é enviada; nada muda até você clicar.</p>

      {!s.evidenciaSuficiente && (
        <p>
          <b>Evidência insuficiente</b> — a conversa ainda não sustenta conclusões fortes. Priorize coletar as
          respostas que faltam.
        </p>
      )}

      {/* Checklist: o que a conversa já respondeu e o que ainda falta. */}
      <div className="ncrm3-checklist">
        <div className="ncrm3-checklist-topo">
          <b>{resumoChecklist(s.checklist)}</b>
          <span className="ncrm3-checklist-barra" aria-hidden="true">
            <i style={{ width: `${s.checklist.completudePct}%` }} />
          </span>
        </div>
        <ul>
          {s.checklist.itens.map((i) => (
            <li key={i.chave} className={i.valor ? "ok" : "falta"}>
              <span aria-hidden="true">{i.valor ? "✓" : "○"}</span>
              <b>{i.rotulo}</b>
              <em>{i.valor ?? "não perguntado"}</em>
            </li>
          ))}
        </ul>
        {s.checklist.proximasPerguntas.length > 0 && (
          <p className="ncrm3-nota">
            Perguntar em seguida: {s.checklist.proximasPerguntas.join(" · ")}
          </p>
        )}
      </div>

      <ul className="ncrm3-sara-campos">
        <li><b>Evidências:</b> {s.evidencias.length ? s.evidencias.join(" · ") : "nenhuma citada"}</li>
        <li><b>Momento sugerido:</b> {s.momentoSugerido ?? "—"}</li>
        <li><b>Próxima ação:</b> {s.proximaAcao ?? "—"}</li>
        <li><b>Prazo:</b> {s.prazo ? new Date(s.prazo).toLocaleString("pt-BR") : "—"}</li>
        <li><b>Risco de abandono:</b> {s.risco ?? "—"} · <b>Confiança:</b> {s.confiancaPct}%</li>
      </ul>

      {s.roteiro.length > 0 && (
        <ol style={{ margin: "0 0 0 18px", padding: 0, color: "var(--ink-soft)", fontSize: 12.5 }}>
          {s.roteiro.map((passo, i) => <li key={i}>{passo}</li>)}
        </ol>
      )}

      {s.textoParaCopiar && (
        <div className="ncrm3-sara-copiar">
          <b>Texto para copiar</b>
          <p style={{ margin: "4px 0 8px" }}>“{s.textoParaCopiar}”</p>
          <button
            type="button"
            className="ncrm3-secundario"
            onClick={() => {
              void navigator.clipboard
                .writeText(s.textoParaCopiar as string)
                .then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1800); })
                .catch(() => { /* sem área de transferência: o texto continua visível */ });
            }}
          >
            {copiado ? "Copiado" : "Copiar texto"}
          </button>
          <p className="ncrm3-nota" style={{ marginTop: 6 }}>
            Você cola no seu WhatsApp e envia. O ERP não envia por você.
          </p>
        </div>
      )}

      <div className="ncrm3-sara-acoes">
        {ACOES_SARA.map((a) => (
          <button
            key={a.decisao}
            type="button"
            className={a.decisao === "aceita" ? "usar" : ""}
            title={a.ajuda}
            disabled={aplicando}
            onClick={() => onDecidir(a.decisao)}
          >
            {a.decisao === "aceita" && aplicando ? "Registrando…" : a.rotulo}
          </button>
        ))}
      </div>
      <p className="ncrm3-nota">
        Ao usar a orientação, a ação fica registrada com o seu nome e o momento do cliente é
        recalculado. Nenhuma mensagem é enviada.
      </p>
    </div>
  );
}
