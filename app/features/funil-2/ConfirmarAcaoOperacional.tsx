"use client";

import { useState } from "react";
import type { LeadFunil2, MomentoFunil2 } from "./modelo";

type ResultadoConfirmacao = {
  versao?: number;
  prazo?: string;
  cadencia_passo?: number;
  sara_em_fila?: boolean;
  fila_id?: number;
  idempotente?: boolean;
};

export function ConfirmarAcaoOperacional({
  accessToken,
  lead,
  momento,
  onConfirmada,
  modo = "desktop",
}: {
  accessToken: string;
  lead: LeadFunil2;
  momento: MomentoFunil2;
  onConfirmada: (resultado: ResultadoConfirmacao | null) => void;
  modo?: "desktop" | "mobile";
}) {
  const [aberto, setAberto] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  if (momento.exige_dapi) {
    return <div className={`f2-confirmar-acao estado dapi ${modo}`} role="status">
      <strong>Confirmação automática</strong>
      <span>Esta ação só é confirmada automaticamente pelo D-API depois da evidência real de envio.</span>
    </div>;
  }

  if (!lead.pode_confirmar_acao) {
    return <div className={`f2-confirmar-acao estado bloqueada ${modo}`} role="note">
      <strong>Acompanhamento</strong>
      <span>Somente o corretor responsável pode registrar esta ação como realizada.</span>
    </div>;
  }

  async function confirmar() {
    setSalvando(true);
    setErro("");
    try {
      const resposta = await fetch("/api/funil2", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirmarAcao",
          id: lead.id,
          versao: lead.versao,
          fonte: "registro_operacional",
          observacao: observacao.trim() || null,
        }),
      });
      const json = await resposta.json().catch(() => ({})) as { error?: string; resultado?: ResultadoConfirmacao };
      if (!resposta.ok) throw new Error(json.error || "Não foi possível confirmar a ação.");
      setAberto(false);
      setObservacao("");
      setSucesso(json.resultado?.sara_em_fila
        ? "Ação registrada. A Sara está analisando a próxima orientação."
        : "Ação registrada com segurança.");
      onConfirmada(json.resultado ?? null);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível confirmar a ação.");
    } finally {
      setSalvando(false);
    }
  }

  return <div className={`f2-confirmar-acao ${modo}`}>
    {sucesso && !aberto ? <div className="f2-confirmar-acao-sucesso" role="status">
      <strong>{sucesso}</strong>
      <span>A leitura anterior permanece identificada até o processamento terminar.</span>
    </div> : null}
    {!aberto && !sucesso ? <button
      type="button"
      className="f2-confirmar-acao-abrir"
      onClick={() => { setSucesso(""); setAberto(true); }}
    >Registrar ação realizada</button> : aberto ? <div
      className="f2-confirmar-acao-confirmacao"
      role="group"
      aria-label="Confirmar ação realizada"
    >
      <strong>Você realmente executou esta ação?</strong>
      <span>O registro guarda a evidência e pede uma nova leitura à Sara. Até ela concluir, o banco mantém um prazo provisório seguro. Não use para uma mensagem ainda não enviada.</span>
      <label>Observação opcional<textarea
        value={observacao}
        onChange={(evento) => setObservacao(evento.target.value)}
        maxLength={500}
        placeholder="Resultado ou contexto útil para a próxima leitura da Sara"
      /></label>
      {erro && <em role="alert">{erro}</em>}
      <div>
        <button type="button" onClick={() => { setAberto(false); setErro(""); }} disabled={salvando}>Cancelar</button>
        <button type="button" className="primario" onClick={() => void confirmar()} disabled={salvando}>
          {salvando ? "Confirmando…" : "Confirmar execução"}
        </button>
      </div>
    </div> : null}
  </div>;
}
