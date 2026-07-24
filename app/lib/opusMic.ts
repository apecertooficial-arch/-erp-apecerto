// Gravador de áudio em OGG/Opus (formato nativo de voz do WhatsApp).
//
// PROBLEMA QUE RESOLVE: o MediaRecorder do navegador grava em WebM/Opus. Quando
// esse arquivo .webm é enviado pela D-API como nota de voz (ptt), o WhatsApp do
// destinatário exibe o áudio mas NÃO reproduz o som — o container WebM não é
// aceito. O WhatsApp exige OGG/Opus. Este helper grava direto em OGG/Opus usando
// o opus-recorder (auto-hospedado em /public/_vendor/opus).
//
// Reaproveita um AudioContext/sourceNode já existente (para não abrir o microfone
// duas vezes e manter a visualização de onda do componente).

let loadPromise: Promise<unknown> | null = null;

function loadRecorder(): Promise<unknown> {
  if (typeof window === "undefined") return Promise.reject(new Error("Sem janela do navegador."));
  const w = window as unknown as { Recorder?: unknown };
  if (w.Recorder) return Promise.resolve(w.Recorder);
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/_vendor/opus/recorder.min.js";
    script.async = true;
    script.onload = () => { const g = (window as unknown as { Recorder?: unknown }).Recorder; g ? resolve(g) : reject(new Error("Gravador de áudio indisponível.")); };
    script.onerror = () => { loadPromise = null; reject(new Error("Falha ao carregar o gravador de áudio.")); };
    document.head.appendChild(script);
  });
  return loadPromise;
}

export type OpusHandle = { stop: (send: boolean) => void };

// Inicia a gravação OGG/Opus ligada a um sourceNode existente.
// onResult recebe o arquivo .ogg pronto (só quando parado com send=true).
// onFinished sempre roda ao final (para o componente liberar contexto/stream).
export async function startOpusRecorder(
  sourceNode: AudioNode,
  onResult: (file: File) => void,
  onFinished?: () => void,
): Promise<OpusHandle> {
  const RecorderCtor = await loadRecorder() as new (opts: Record<string, unknown>) => {
    ondataavailable: (data: Uint8Array) => void;
    onstop: () => void;
    start: () => Promise<void>;
    stop: () => void;
  };
  const pages: BlobPart[] = [];
  let canceled = false;
  const rec = new RecorderCtor({
    encoderPath: "/_vendor/opus/encoderWorker.min.js",
    sourceNode,
    numberOfChannels: 1,
    encoderApplication: 2048, // VOIP — nota de voz
    encoderSampleRate: 48000,
    streamPages: false,
    monitorGain: 0,
    recordingGain: 1,
  });
  rec.ondataavailable = (data: Uint8Array) => { pages.push(data.slice()); };
  rec.onstop = () => {
    try {
      if (!canceled && pages.length) {
        const blob = new Blob(pages, { type: "audio/ogg" });
        if (blob.size > 0) onResult(new File([blob], `audio-${Date.now()}.ogg`, { type: "audio/ogg" }));
      }
    } finally { onFinished?.(); }
  };
  await rec.start();
  return { stop: (send: boolean) => { canceled = !send; try { rec.stop(); } catch { /* ignore */ } } };
}
