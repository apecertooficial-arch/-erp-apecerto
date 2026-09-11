"use client";

import { useState } from "react";
import {
  MIN_JUSTIFICATIVA_VISITA,
  RESULTADOS_VISITA,
  ROTULO_STATUS_RESULTADO,
  type StatusResultadoVisita,
  validarResultadoVisita,
} from "./resultadoVisita";

export function ResultadoVisitaForm({
  cliente,
  dataHora,
  statusInicial = "realizada",
  busy,
  erro,
  onCancelar,
  onSalvar,
}: {
  cliente: string;
  dataHora: string;
  statusInicial?: StatusResultadoVisita;
  busy: boolean;
  erro?: string;
  onCancelar: () => void;
  onSalvar: (dados: { status: StatusResultadoVisita; resultadoCodigo: string; justificativa: string }) => void;
}) {
  const [status, setStatus] = useState<StatusResultadoVisita>(statusInicial);
  const [resultadoCodigo, setResultadoCodigo] = useState(RESULTADOS_VISITA[statusInicial][0].codigo);
  const [justificativa, setJustificativa] = useState("");
  const erroLocal = validarResultadoVisita(status, resultadoCodigo, justificativa);

  return <form className="resultado-visita-form" onSubmit={(evento) => {
    evento.preventDefault();
    if (!erroLocal) onSalvar({ status, resultadoCodigo, justificativa: justificativa.trim() });
  }}>
    <header>
      <div><small>RESULTADO OBRIGATÓRIO</small><h2>O que aconteceu na visita?</h2><p>{cliente} · {dataHora}</p></div>
      <button type="button" aria-label="Fechar" onClick={onCancelar}>×</button>
    </header>
    <div className="resultado-visita-corpo">
      <fieldset>
        <legend>Desfecho</legend>
        <div className="resultado-visita-status" role="group" aria-label="Desfecho da visita">
          {(Object.keys(ROTULO_STATUS_RESULTADO) as StatusResultadoVisita[]).map((item) => <button
            type="button"
            key={item}
            className={status === item ? "ativo" : ""}
            aria-pressed={status === item}
            disabled={busy}
            onClick={() => { setStatus(item); setResultadoCodigo(RESULTADOS_VISITA[item][0].codigo); }}
          >{ROTULO_STATUS_RESULTADO[item]}</button>)}
        </div>
      </fieldset>
      <label>Resultado
        <select disabled={busy} value={resultadoCodigo} onChange={(evento) => setResultadoCodigo(evento.target.value)}>
          {RESULTADOS_VISITA[status].map((item) => <option value={item.codigo} key={item.codigo}>{item.rotulo}</option>)}
        </select>
      </label>
      <label>Justificativa <small>obrigatória</small>
        <textarea
          disabled={busy}
          value={justificativa}
          onChange={(evento) => setJustificativa(evento.target.value)}
          minLength={MIN_JUSTIFICATIVA_VISITA}
          maxLength={800}
          rows={4}
          placeholder="Conte objetivamente o que ocorreu, a reação do cliente e o próximo passo."
        />
        <em>{justificativa.trim().length}/{MIN_JUSTIFICATIVA_VISITA} caracteres mínimos</em>
      </label>
      {erro && <p className="resultado-visita-erro" role="alert">{erro}</p>}
    </div>
    <footer><button type="button" onClick={onCancelar} disabled={busy}>Voltar</button><button className="confirm" type="submit" disabled={busy || Boolean(erroLocal)}>{busy ? "Salvando…" : "Salvar resultado"}</button></footer>
  </form>;
}
