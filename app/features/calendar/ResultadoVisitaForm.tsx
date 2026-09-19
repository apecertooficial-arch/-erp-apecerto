"use client";

import { useState } from "react";
import {
  MIN_JUSTIFICATIVA_VISITA,
  RESULTADOS_VISITA,
  ROTULO_STATUS_RESULTADO,
  type StatusResultadoVisita,
  validarResultadoVisita,
} from "./resultadoVisita";
import {
  FEEDBACK_VISITA_VAZIO,
  INTENCOES_VISITA,
  montarJustificativaFeedbackVisita,
  PERCEPCOES_VISITA,
  PRESENCAS_VISITA,
  validarFeedbackVisitaDetalhado,
  type FeedbackVisitaDetalhado,
} from "./feedbackVisita";
import { FeedbackVisitaAudio } from "./FeedbackVisitaAudio";

export function ResultadoVisitaForm({
  cliente,
  dataHora,
  statusInicial = "realizada",
  visitId,
  accessToken,
  busy,
  erro,
  onCancelar,
  onSalvar,
}: {
  cliente: string;
  dataHora: string;
  statusInicial?: StatusResultadoVisita;
  visitId: string;
  accessToken: string;
  busy: boolean;
  erro?: string;
  onCancelar: () => void;
  onSalvar: (dados: { status: StatusResultadoVisita; resultadoCodigo: string; justificativa: string }) => void;
}) {
  const [status, setStatus] = useState<StatusResultadoVisita>(statusInicial);
  const [resultadoCodigo, setResultadoCodigo] = useState(RESULTADOS_VISITA[statusInicial][0].codigo);
  const [justificativa, setJustificativa] = useState("");
  const [feedback, setFeedback] = useState<FeedbackVisitaDetalhado>(FEEDBACK_VISITA_VAZIO);
  const justificativaFinal = status === "realizada"
    ? montarJustificativaFeedbackVisita(feedback, justificativa)
    : justificativa.trim();
  const erroLocal = validarFeedbackVisitaDetalhado(status, feedback)
    ?? validarResultadoVisita(status, resultadoCodigo, justificativaFinal);
  const atualizarFeedback = <K extends keyof FeedbackVisitaDetalhado>(campo: K, valor: FeedbackVisitaDetalhado[K]) => {
    setFeedback((atual) => ({ ...atual, [campo]: valor }));
  };

  return <form className="resultado-visita-form" onSubmit={(evento) => {
    evento.preventDefault();
    if (!erroLocal) onSalvar({ status, resultadoCodigo, justificativa: justificativaFinal });
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
      {status === "realizada" && <section className="resultado-visita-detalhes" aria-label="Feedback estruturado da visita">
        <fieldset>
          <legend>Quem participou <small>obrigatório</small></legend>
          <div className="resultado-visita-opcoes" role="group" aria-label="Quem participou da visita">
            {PRESENCAS_VISITA.map((opcao) => <button type="button" key={opcao.codigo} className={feedback.presenca === opcao.codigo ? "ativo" : ""} aria-pressed={feedback.presenca === opcao.codigo} disabled={busy} onClick={() => atualizarFeedback("presenca", opcao.codigo)}>{opcao.rotulo}</button>)}
          </div>
        </fieldset>
        <label>Nomes ou relação dos acompanhantes <small>opcional</small>
          <input disabled={busy} value={feedback.acompanhantes} maxLength={90} onChange={(evento) => atualizarFeedback("acompanhantes", evento.target.value)} placeholder="Ex.: esposa Ana e dois filhos" />
        </label>
        <fieldset>
          <legend>Percepção do cliente <small>obrigatório</small></legend>
          <div className="resultado-visita-opcoes" role="group" aria-label="Percepção do cliente">
            {PERCEPCOES_VISITA.map((opcao) => <button type="button" key={opcao.codigo} className={feedback.percepcao === opcao.codigo ? "ativo" : ""} aria-pressed={feedback.percepcao === opcao.codigo} disabled={busy} onClick={() => atualizarFeedback("percepcao", opcao.codigo)}>{opcao.rotulo}</button>)}
          </div>
        </fieldset>
        <div className="resultado-visita-dupla">
          <label>Pontos positivos <small>obrigatório</small>
            <textarea disabled={busy} value={feedback.pontosPositivos} maxLength={90} rows={3} onChange={(evento) => atualizarFeedback("pontosPositivos", evento.target.value)} placeholder="O que agradou? Se nada, informe ‘nenhum’." />
          </label>
          <label>Pontos negativos <small>obrigatório</small>
            <textarea disabled={busy} value={feedback.pontosNegativos} maxLength={90} rows={3} onChange={(evento) => atualizarFeedback("pontosNegativos", evento.target.value)} placeholder="O que incomodou? Se nada, informe ‘nenhum’." />
          </label>
        </div>
        <label>Objeções <small>obrigatório</small>
          <textarea disabled={busy} value={feedback.objecoes} maxLength={90} rows={3} onChange={(evento) => atualizarFeedback("objecoes", evento.target.value)} placeholder="Preço, entrada, localização, planta ou nenhuma objeção." />
        </label>
        <label>Alternativas oferecidas <small>opcional</small>
          <input disabled={busy} value={feedback.alternativasOferecidas} maxLength={90} onChange={(evento) => atualizarFeedback("alternativasOferecidas", evento.target.value)} placeholder="Outros imóveis, unidades ou condições apresentadas" />
        </label>
        <label>Definição atual do cliente <small>obrigatório</small>
          <select disabled={busy} value={feedback.intencao} onChange={(evento) => atualizarFeedback("intencao", evento.target.value as FeedbackVisitaDetalhado["intencao"])}>
            <option value="">Escolha a definição</option>
            {INTENCOES_VISITA.map((opcao) => <option value={opcao.codigo} key={opcao.codigo}>{opcao.rotulo}</option>)}
          </select>
        </label>
        <label>Próxima ação combinada <small>obrigatório</small>
          <input disabled={busy} value={feedback.proximaAcao} maxLength={90} onChange={(evento) => atualizarFeedback("proximaAcao", evento.target.value)} placeholder="Ex.: enviar simulação amanhã às 10h" />
        </label>
      </section>}
      {status === "realizada" && <FeedbackVisitaAudio
        visitId={visitId}
        accessToken={accessToken}
        busy={busy}
        onConfirmarTranscricao={(texto) => setJustificativa(texto.trim().slice(0, 800))}
      />}
      <label>{status === "realizada" ? "Resumo adicional" : "Justificativa"} {status !== "realizada" && <small>obrigatória</small>}
        <textarea
          disabled={busy}
          value={justificativa}
          onChange={(evento) => setJustificativa(evento.target.value)}
          minLength={MIN_JUSTIFICATIVA_VISITA}
          maxLength={800}
          rows={4}
          placeholder={status === "realizada" ? "Algum contexto importante que não apareceu nas respostas acima?" : "Conte objetivamente o que ocorreu e o próximo passo."}
        />
        {status !== "realizada" && <em>{justificativa.trim().length}/{MIN_JUSTIFICATIVA_VISITA} caracteres mínimos</em>}
      </label>
      {erro && <p className="resultado-visita-erro" role="alert">{erro}</p>}
    </div>
    <footer><button type="button" onClick={onCancelar} disabled={busy}>Voltar</button><button className="confirm" type="submit" disabled={busy || Boolean(erroLocal)}>{busy ? "Salvando…" : "Salvar resultado"}</button></footer>
  </form>;
}
