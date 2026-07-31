"use client";
/**
 * SARA NA FICHA 3.0 — observer/assist. Ela SUGERE; quem decide é o corretor.
 *
 * Exibe evidências, momento sugerido, próxima ação, prazo, perguntas que
 * faltam, roteiro, texto para copiar e risco. Três decisões: usar a
 * orientação, ajustar ou dizer que não faz sentido.
 *
 * Não existe execução aqui: nenhum envio, nenhuma mudança de momento. O
 * `execute` continua bloqueado no backend e esta tela não tem caminho para ele.
 */
import { useState } from "react";
import { ACOES_SARA, normalizarSara, type DecisaoSara, type SugestaoBruta } from "../lib/sara3";

export function Sara3({
  sugestao,
  carregando,
  onPedir,
  onDecidir,
}: {
  sugestao: SugestaoBruta | null;
  carregando: boolean;
  onPedir: () => void;
  onDecidir: (decisao: DecisaoSara) => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const s = normalizarSara(sugestao);

  if (!s) {
    return (
      <div className="ncrm3-sara">
        <h4>Sara</h4>
        <p>A Sara lê a conversa real e sugere o próximo passo. Ela nunca envia mensagem nem muda o momento do cliente.</p>
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
      <p>Sugestão, não ordem. Nada é enviado nem alterado até você confirmar no formulário.</p>

      {!s.evidenciaSuficiente && (
        <p>
          <b>Evidência insuficiente</b> — a conversa ainda não sustenta conclusões fortes. Priorize coletar as
          respostas que faltam.
        </p>
      )}

      <ul className="ncrm3-sara-campos">
        <li><b>Evidências:</b> {s.evidencias.length ? s.evidencias.join(" · ") : "nenhuma citada"}</li>
        <li><b>Momento sugerido:</b> {s.momentoSugerido ?? "—"}</li>
        <li><b>Próxima ação:</b> {s.proximaAcao ?? "—"}</li>
        <li><b>Prazo:</b> {s.prazo ? new Date(s.prazo).toLocaleString("pt-BR") : "—"}</li>
        <li><b>Perguntas que faltam:</b> {s.perguntasFaltantes.length ? s.perguntasFaltantes.join(" · ") : "nenhuma"}</li>
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
            onClick={() => onDecidir(a.decisao)}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}
