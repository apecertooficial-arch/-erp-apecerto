"use client";

import { useState } from "react";
import {
  RESULTADOS_VISITA,
  ROTULO_STATUS_RESULTADO,
  type StatusResultadoVisita,
  validarResultadoVisita,
} from "./resultadoVisita";
import {
  avaliarQualidadeFeedbackVisita,
  FEEDBACK_VISITA_VAZIO,
  INTENCOES_VISITA,
  montarJustificativaFeedbackVisita,
  montarJustificativaResultadoVisita,
  NOTA_MINIMA_FEEDBACK_VISITA,
  PERCEPCOES_VISITA,
  PRESENCAS_VISITA,
  validarEncaminhamentoResultadoVisita,
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
  const [proximaAcaoEncerramento, setProximaAcaoEncerramento] = useState("");
  const [feedback, setFeedback] = useState<FeedbackVisitaDetalhado>(FEEDBACK_VISITA_VAZIO);
  const justificativaFinal = status === "realizada"
    ? montarJustificativaFeedbackVisita(feedback, justificativa)
    : montarJustificativaResultadoVisita(status, resultadoCodigo, proximaAcaoEncerramento, justificativa);
  const avaliacaoQualidade = avaliarQualidadeFeedbackVisita(feedback);
  const erroLocal = validarFeedbackVisitaDetalhado(status, feedback)
    ?? validarEncaminhamentoResultadoVisita(status, proximaAcaoEncerramento)
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
      {status !== "realizada" && <label>Próxima ação <small>obrigatória</small>
        <input
          disabled={busy}
          value={proximaAcaoEncerramento}
          maxLength={90}
          onChange={(evento) => setProximaAcaoEncerramento(evento.target.value)}
          placeholder={status === "cancelada" ? "Ex.: ligar amanhã às 10h para remarcar" : "Ex.: retomar hoje às 18h e propor nova data"}
        />
      </label>}
      {status === "realizada" && <section className="resultado-visita-detalhes" aria-label="Feedback estruturado da visita">
        <fieldset>
          <legend>Quem participou <small>obrigatório</small></legend>
          <div className="resultado-visita-opcoes" role="group" aria-label="Quem participou da visita">
            {PRESENCAS_VISITA.map((opcao) => <button type="button" key={opcao.codigo} className={feedback.presenca === opcao.codigo ? "ativo" : ""} aria-pressed={feedback.presenca === opcao.codigo} disabled={busy} onClick={() => atualizarFeedback("presenca", opcao.codigo)}>{opcao.rotulo}</button>)}
          </div>
        </fieldset>
        <label>Nomes ou relação dos acompanhantes <small>se houver</small>
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
        <label>Alternativas oferecidas <small>informe ou escreva “nenhuma”</small>
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
        <section className={`resultado-visita-qualidade ${avaliacaoQualidade.nota >= NOTA_MINIMA_FEEDBACK_VISITA ? "aprovada" : "pendente"}`} aria-live="polite">
          <header><small>QUALIDADE DO FEEDBACK</small><strong>{avaliacaoQualidade.nota}/10</strong></header>
          <span aria-hidden="true"><i style={{ width: `${avaliacaoQualidade.nota * 10}%` }} /></span>
          <p>{avaliacaoQualidade.nota >= NOTA_MINIMA_FEEDBACK_VISITA
            ? "Padrão operacional atingido. O gerente receberá um registro claro para acompanhar o cliente."
            : `Para chegar a ${NOTA_MINIMA_FEEDBACK_VISITA}/10: ${avaliacaoQualidade.pendencias.slice(0, 2).join("; ")}.`}</p>
        </section>
      </section>}
      {status === "realizada" && <FeedbackVisitaAudio
        visitId={visitId}
        accessToken={accessToken}
        busy={busy}
        onConfirmarTranscricao={(texto) => setJustificativa(texto.trim().slice(0, 800))}
      />}
      <label>{status === "realizada" ? "Resumo adicional" : "Contexto adicional"} <small>opcional</small>
        <textarea
          disabled={busy}
          value={justificativa}
          onChange={(evento) => setJustificativa(evento.target.value)}
          maxLength={800}
          rows={4}
          placeholder={status === "realizada" ? "Algum contexto importante que não apareceu nas respostas acima?" : "Algum contexto importante além do motivo e da próxima ação?"}
        />
      </label>
      {erro && <p className="resultado-visita-erro" role="alert">{erro}</p>}
    </div>
    <footer><button type="button" onClick={onCancelar} disabled={busy}>Voltar</button><button className="confirm" type="submit" disabled={busy || Boolean(erroLocal)}>{busy ? "Salvando…" : "Salvar resultado"}</button></footer>
  </form>;
}
