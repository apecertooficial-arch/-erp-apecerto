"use client";

/* Ferramenta avulsa (FERRAMENTAS > Marca d'Água): o corretor sobe uma foto
 * que AINDA NAO tem vinculo com nenhum empreendimento, remove a marca
 * d'agua/logo via a function remover-marca-dagua (Unwatermark AI, Auto
 * Remover V2.3 sync) e decide DEPOIS se anexa a foto limpa em algum produto.
 *
 * Esta tela nao grava nada no banco nem no Storage -- so chama a function e
 * mostra o resultado.
 *
 * v2 -- a function agora devolve os BYTES prontos (base64), nao mais um link
 * pro CDN da Unwatermark: o link direto nao carregava no <img> (a Unwatermark
 * bloqueia hotlink/CORS de fora do site deles) e o atributo download nao
 * funcionava num link cross-origin (so abria aba nova em vez de baixar). Os
 * bytes viram um Blob local -- preview e download instantaneo, sem depender
 * de nada externo. Se a function cair no modo de fallback (raw url), avisamos
 * que so abre em nova aba.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";
import "../../styles/marca-dagua.css";

type Resultado =
  | { kind: "blob"; blobUrl: string; extensao: string }
  | { kind: "externo"; url: string; expiraEm: string };

function extensaoDoMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

function base64ParaBlob(base64: string, mime: string): Blob {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function WatermarkRemoverWorkspace() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removerTexto, setRemoverTexto] = useState(false);
  const [melhorarQualidade, setMelhorarQualidade] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const limparResultado = useCallback(() => {
    setResultado((atual) => {
      if (atual?.kind === "blob") URL.revokeObjectURL(atual.blobUrl);
      return null;
    });
  }, []);

  const escolherArquivo = useCallback((file: File | null) => {
    limparResultado();
    setErro("");
    setArquivo(file);
    setPreview((atual) => {
      if (atual) URL.revokeObjectURL(atual);
      return file ? URL.createObjectURL(file) : null;
    });
  }, [limparResultado]);

  const processar = useCallback(async () => {
    if (!arquivo) return;
    setProcessando(true);
    setErro("");
    limparResultado();
    try {
      const form = new FormData();
      form.append("arquivo", arquivo);
      form.append("remover_logo", "true");
      form.append("remover_texto", String(removerTexto));
      form.append("melhorar_qualidade", String(melhorarQualidade));
      const { data, error } = await getBrowserSupabaseClient().functions.invoke("remover-marca-dagua", { body: form });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        const detalhe = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
        throw new Error((detalhe as { detail?: string })?.detail || (detalhe as { error?: string })?.error || error.message);
      }
      const r = (data ?? {}) as { ok?: boolean; base64?: string; mime?: string; url?: string; expira_em?: string; error?: string; detail?: string };
      if (!r.ok) throw new Error(r.detail || r.error || "A Unwatermark não devolveu um resultado.");
      if (r.base64 && r.mime) {
        const blob = base64ParaBlob(r.base64, r.mime);
        setResultado({ kind: "blob", blobUrl: URL.createObjectURL(blob), extensao: extensaoDoMime(r.mime) });
      } else if (r.url) {
        setResultado({ kind: "externo", url: r.url, expiraEm: r.expira_em ?? "24h" });
      } else {
        throw new Error("A Unwatermark não devolveu um resultado.");
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível remover a marca d'água.");
    } finally {
      setProcessando(false);
    }
  }, [arquivo, removerTexto, melhorarQualidade, limparResultado]);

  const limpar = useCallback(() => {
    escolherArquivo(null);
    setErro("");
    if (inputRef.current) inputRef.current.value = "";
  }, [escolherArquivo]);

  // Libera os blobs (preview e resultado) quando a tela fecha.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
      setResultado((atual) => {
        if (atual?.kind === "blob") URL.revokeObjectURL(atual.blobUrl);
        return atual;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="wm-workspace">
      <header>
        <div>
          <span>FERRAMENTAS · FOTOS</span>
          <h1>Marca d&apos;Água</h1>
          <p>Suba uma foto solta, remova a marca d&apos;água ou logo, e baixe o resultado. Anexar a um empreendimento é um passo à parte, em Produtos.</p>
        </div>
      </header>

      {erro && <div className="wm-error">{erro}</div>}

      <div className="wm-grid">
        <section className="wm-card">
          <label
            className="wm-dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) escolherArquivo(file);
            }}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Foto selecionada" />
            ) : (
              <>
                <strong>Arraste uma foto aqui</strong>
                <span>ou clique para escolher · JPG, PNG ou WebP</span>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => escolherArquivo(e.target.files?.[0] ?? null)}
            />
          </label>

          <div className="wm-opcoes">
            <label className="wm-check">
              <span><input type="checkbox" checked={removerTexto} onChange={(e) => setRemoverTexto(e.target.checked)} /> Também remover texto (marca d&apos;água escrita)</span>
            </label>
            <label className="wm-check">
              <span><input type="checkbox" checked={melhorarQualidade} onChange={(e) => setMelhorarQualidade(e.target.checked)} /> Melhorar qualidade automaticamente</span>
              <small>Pode alterar cor/exposição da foto — evite se a cor real do ambiente importa.</small>
            </label>
          </div>

          <div className="wm-acoes">
            <button type="button" className="wm-btn-primary" disabled={!arquivo || processando} onClick={() => void processar()}>
              {processando ? "Removendo…" : "Remover marca d'água"}
            </button>
            {arquivo && <button type="button" className="wm-btn-secondary" disabled={processando} onClick={limpar}>Limpar</button>}
          </div>
        </section>

        <section className="wm-card wm-resultado">
          {resultado?.kind === "blob" ? (
            <>
              <strong>Pronto</strong>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resultado.blobUrl} alt="Foto sem marca d'água" />
              <a className="wm-btn-primary" href={resultado.blobUrl} download={`foto-sem-marca-dagua.${resultado.extensao}`}>
                ↓ Baixar foto limpa
              </a>
              <p className="wm-aviso">Anexar a foto a um empreendimento é feito na tela de Produtos, depois de baixar.</p>
            </>
          ) : resultado?.kind === "externo" ? (
            <>
              <strong>Pronto (sem preview)</strong>
              <p className="wm-aviso">Não deu pra carregar o preview aqui dentro desta vez, mas o resultado está pronto.</p>
              <a className="wm-btn-primary" href={resultado.url} target="_blank" rel="noreferrer">
                ↗ Abrir resultado em nova aba
              </a>
              <p className="wm-aviso">Esse link expira em {resultado.expiraEm} — baixe agora.</p>
            </>
          ) : (
            <p className="wm-resultado-vazio">{processando ? "Processando na Unwatermark…" : "O resultado aparece aqui depois de remover a marca d'água."}</p>
          )}
        </section>
      </div>
    </div>
  );
}
