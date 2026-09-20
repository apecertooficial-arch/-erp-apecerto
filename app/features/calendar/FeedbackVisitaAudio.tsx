"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useRef, useState } from "react";
import { startOpusRecorder, type OpusHandle } from "../../lib/opusMic";

type AudioFeedback = {
  id: string;
  status: "reservado" | "enviado" | "transcrevendo" | "transcrito" | "falhou";
  transcricao?: string | null;
  erro_codigo?: string | null;
  criado_em?: string | null;
  atualizado_em?: string | null;
};

type ConsultaAudio = {
  ok?: boolean;
  disponivel?: boolean;
  audios?: AudioFeedback[];
  error?: string;
};

const rotuloStatus: Record<AudioFeedback["status"], string> = {
  reservado: "Preparando envio",
  enviado: "Aguardando transcrição",
  transcrevendo: "Transcrevendo áudio",
  transcrito: "Transcrição pronta",
  falhou: "A transcrição precisa ser repetida",
};

export function FeedbackVisitaAudio({
  visitId,
  accessToken,
  busy,
  onConfirmarTranscricao,
}: {
  visitId: string;
  accessToken: string;
  busy: boolean;
  onConfirmarTranscricao: (texto: string) => void;
}) {
  const [disponivel, setDisponivel] = useState<boolean | null>(null);
  const [audios, setAudios] = useState<AudioFeedback[]>([]);
  const [gravando, setGravando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const recorder = useRef<OpusHandle | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const context = useRef<AudioContext | null>(null);
  const arquivoInput = useRef<HTMLInputElement | null>(null);
  const consultas = useRef(0);

  const limparGravacao = useCallback(() => {
    const atual = stream.current;
    stream.current = null;
    atual?.getTracks().forEach((track) => track.stop());
    const audioContext = context.current;
    context.current = null;
    if (audioContext) void audioContext.close().catch(() => {});
  }, []);

  const consultar = useCallback(async () => {
    const response = await fetch(`/api/agenda?feedbackAudioVisitaId=${encodeURIComponent(visitId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({})) as ConsultaAudio;
    if (!response.ok) throw new Error(body.error || "Não foi possível consultar o áudio desta visita.");
    setDisponivel(body.disponivel === true);
    setAudios(Array.isArray(body.audios) ? body.audios : []);
    return body;
  }, [accessToken, visitId]);

  useEffect(() => {
    let ativo = true;
    void consultar().catch(() => { if (ativo) setDisponivel(false); });
    return () => { ativo = false; };
  }, [consultar]);

  const maisRecente = audios[0];
  useEffect(() => {
    if (!maisRecente || !["reservado", "enviado", "transcrevendo"].includes(maisRecente.status)) return;
    if (consultas.current >= 20) {
      setAviso("O áudio foi preservado. A transcrição continuará em segundo plano.");
      return;
    }
    const timer = window.setTimeout(() => {
      consultas.current += 1;
      void consultar().catch(() => setErro("O áudio foi enviado, mas não foi possível atualizar o estado agora."));
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [consultar, maisRecente]);

  useEffect(() => () => {
    const handle = recorder.current;
    recorder.current = null;
    if (handle) handle.stop(false);
    limparGravacao();
  }, [limparGravacao]);

  const enviar = useCallback(async (arquivo: File) => {
    setEnviando(true);
    setErro("");
    setAviso("Enviando o áudio com verificação de integridade…");
    try {
      const form = new FormData();
      form.set("action", "uploadVisitFeedbackAudio");
      form.set("visitId", visitId);
      form.set("file", arquivo);
      const response = await fetch("/api/agenda", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });
      const body = await response.json().catch(() => ({})) as { success?: boolean; error?: string };
      if (!response.ok || body.success !== true) throw new Error(body.error || "Não foi possível enviar o áudio.");
      consultas.current = 0;
      setAviso("Áudio preservado. Aguardando a transcrição.");
      await consultar();
    } catch (reason) {
      setAviso("");
      setErro(reason instanceof Error ? reason.message : "Não foi possível enviar o áudio.");
    } finally {
      setEnviando(false);
      if (arquivoInput.current) arquivoInput.current.value = "";
    }
  }, [accessToken, consultar, visitId]);

  const iniciarGravacao = async () => {
    setErro("");
    setAviso("");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const audioContext = new AudioContext();
      context.current = audioContext;
      recorder.current = await startOpusRecorder(
        audioContext.createMediaStreamSource(media),
        (arquivo) => { void enviar(arquivo); },
        limparGravacao,
      );
      setGravando(true);
    } catch (reason) {
      limparGravacao();
      setGravando(false);
      setErro(reason instanceof Error && reason.message.includes("gravador")
        ? reason.message
        : "Autorize o microfone para gravar o resumo da visita.");
    }
  };

  const pararGravacao = (enviarAudio: boolean) => {
    const handle = recorder.current;
    recorder.current = null;
    setGravando(false);
    if (handle) handle.stop(enviarAudio);
    else limparGravacao();
  };

  /* Fail-closed: enquanto a migration não declarar a capacidade, não mostramos
     um controle que pareça funcional e terminaria descartando o áudio. */
  if (disponivel !== true) return null;

  return <section className="resultado-visita-audio" aria-label="Resumo por áudio">
    <div className="resultado-visita-audio-topo">
      <div><strong>Resumo por áudio</strong><small>O áudio fica privado e a transcrição só entra no formulário depois da sua confirmação.</small></div>
      {!gravando ? <button type="button" disabled={busy || enviando} onClick={() => void iniciarGravacao()}>● Gravar áudio</button> : <div className="resultado-visita-audio-gravando"><span>● Gravando</span><button type="button" onClick={() => pararGravacao(true)}>Concluir</button><button type="button" onClick={() => pararGravacao(false)}>Descartar</button></div>}
    </div>
    <input ref={arquivoInput} hidden type="file" accept="audio/ogg,audio/webm,audio/mpeg,audio/mp4,audio/wav" onChange={(evento) => { const arquivo = evento.target.files?.[0]; if (arquivo) void enviar(arquivo); }} />
    {!gravando && <button className="resultado-visita-audio-anexar" type="button" disabled={busy || enviando} onClick={() => arquivoInput.current?.click()}>Usar um áudio já gravado</button>}
    {maisRecente && <div className={`resultado-visita-audio-estado estado-${maisRecente.status}`}>
      <span>{rotuloStatus[maisRecente.status]}</span>
      {maisRecente.status === "transcrito" && maisRecente.transcricao && <><p>{maisRecente.transcricao}</p><button type="button" disabled={busy} onClick={() => { onConfirmarTranscricao(maisRecente.transcricao || ""); setAviso("Transcrição adicionada ao resumo. Revise antes de salvar."); }}>Usar no resumo adicional</button></>}
      {maisRecente.status === "falhou" && <p>O áudio continua preservado. Grave novamente ou aguarde uma nova tentativa automática.</p>}
    </div>}
    {aviso && <p className="resultado-visita-audio-aviso" role="status">{aviso}</p>}
    {erro && <p className="resultado-visita-audio-erro" role="alert">{erro}</p>}
  </section>;
}
