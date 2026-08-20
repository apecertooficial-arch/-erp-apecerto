"use client";

/* Ferramenta avulsa (FERRAMENTAS > Marca d'Água): o corretor sobe uma foto
 * que AINDA NAO tem vinculo com nenhum empreendimento, remove a marca
 * d'agua/logo via a function remover-marca-dagua (Unwatermark AI, Auto
 * Remover V2.3 sync) e decide DEPOIS se anexa a foto limpa em algum produto.
 *
 * Esta tela nao grava nada no banco nem no Storage -- so chama a function e
 * mostra o resultado. O link que a Unwatermark devolve expira em 24h, entao
 * o aviso de download fica visivel junto do resultado.
 */

import { useCallback, useRef, useState } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";
import "../../styles/marca-dagua.css";

type Resultado = { url: string; expiraEm: string };

export function WatermarkRemoverWorkspace() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removerTexto, setRemoverTexto] = useState(false);
  const [melhorarQualidade, setMelhorarQualidade] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const escolherArquivo = useCallback((file: File | null) => {
    setResultado(null);
    setErro("");
    setArquivo(file);
    setPreview((atual) => {
      if (atual) URL.revokeObjectURL(atual);
      return file ? URL.createObjectURL(file) : null;
    });
  }, []);

  const processar = useCallback(async () => {
    if (!arquivo) return;
    setProcessando(true);
    setErro("");
    setResultado(null);
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
      const r = (data ?? {}) as { ok?: boolean; url?: string; expira_em?: string; error?: string; detail?: string };
      if (!r.ok || !r.url) throw new Error(r.detail || r.error || "A Unwatermark não devolveu um resultado.");
      setResultado({ url: r.url, expiraEm: r.expira_em ?? "24h" });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível remover a marca d'água.");
    } finally {
      setProcessando(false);
    }
  }, [arquivo, removerTexto, melhorarQualidade]);

  const limpar = useCallback(() => {
    escolherArquivo(null);
    setResultado(null);
    setErro("");
    if (inputRef.current) inputRef.current.value = "";
  }, [escolherArquivo]);

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
          {resultado ? (
            <>
              <strong>Pronto</strong>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resultado.url} alt="Foto sem marca d'água" />
              <a className="wm-btn-primary" href={resultado.url} download target="_blank" rel="noreferrer">
                ↓ Baixar foto limpa
              </a>
              <p className="wm-aviso">Esse link expira em {resultado.expiraEm} — baixe agora. Anexar a foto a um empreendimento é feito na tela de Produtos, depois de baixar.</p>
            </>
          ) : (
            <p className="wm-resultado-vazio">{processando ? "Processando na Unwatermark…" : "O resultado aparece aqui depois de remover a marca d'água."}</p>
          )}
        </section>
      </div>
    </div>
  );
}
