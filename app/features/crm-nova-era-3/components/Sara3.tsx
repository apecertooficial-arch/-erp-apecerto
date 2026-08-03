"use client";
/**
 * SARA NA FICHA 3.0 — determina a conduta dentro do catálogo oficial.
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
        <h4>✦ Sara está definindo a conduta</h4>
        <p>Ela lê a conversa real e escolhe a próxima ação dentro do padrão da operação.</p>
        <div className="ncrm3-sara-acoes">
          <button type="button" className="usar" onClick={onPedir} disabled={carregando}>
            {carregando ? "Analisando conversa…" : "Analisar agora"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ncrm3-sara ncrm3-sara-simples">
      <div className="ncrm3-sara-topo">
        <h4>✦ Sara</h4>
        <span className={`ncrm3-sara-status nivel-${s.politica.nivel}`}>{s.politica.texto}</span>
      </div>

      <div className="ncrm3-sara-agora">
        <span>ORDEM DA SARA</span>
        <strong>{s.politica.podeUsar ? (s.proximaAcao ?? "Defina o próximo passo") : "Revise a conversa e defina o próximo passo"}</strong>
        <small>{s.prazo ? `Até ${new Date(s.prazo).toLocaleString("pt-BR")}` : "Defina um prazo para concluir"}</small>
      </div>

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
            disabled={aplicando || (a.decisao === "aceita" && !s.politica.podeUsar)}
            onClick={() => onDecidir(a.decisao)}
          >
            {a.decisao === "aceita" && aplicando
              ? "Registrando…"
              : a.decisao === "aceita"
                ? "Confirmar conduta"
                : a.decisao === "ajustada"
                  ? "Reportar exceção"
                  : "Análise incorreta"}
          </button>
        ))}
      </div>

      <details className="ncrm3-sara-detalhes">
        <summary>Ver análise completa</summary>
        <div className="ncrm3-checklist">
          <div className="ncrm3-checklist-topo">
            <b>{resumoChecklist(s.checklist)}</b>
            <span className="ncrm3-checklist-barra" aria-hidden="true"><i style={{ width: `${s.checklist.completudePct}%` }} /></span>
          </div>
          <ul>
            {s.checklist.itens.map((i) => (
              <li key={i.chave} className={i.valor ? "ok" : "falta"}>
                <span aria-hidden="true">{i.valor ? "✓" : "○"}</span><b>{i.rotulo}</b><em>{i.valor ?? "não perguntado"}</em>
              </li>
            ))}
          </ul>
          {s.checklist.proximasPerguntas.length > 0 && <p className="ncrm3-nota"><b>Pergunte em seguida:</b> {s.checklist.proximasPerguntas.join(" · ")}</p>}
        </div>
        <ul className="ncrm3-sara-campos">
          <li><b>Evidências:</b> {s.evidencias.length ? s.evidencias.join(" · ") : "nenhuma citada"}</li>
          <li><b>Momento sugerido:</b> {s.momentoSugerido ?? "—"}</li>
          <li><b>Risco:</b> {s.risco ?? "—"} · <b>Confiança:</b> {s.confiancaPct}%</li>
        </ul>
        {s.roteiro.length > 0 && <ol>{s.roteiro.map((passo, i) => <li key={i}>{passo}</li>)}</ol>}
        <p className="ncrm3-nota">A Sara não envia mensagens. A ação só muda depois da confirmação do corretor.</p>
      </details>
    </div>
  );
}
