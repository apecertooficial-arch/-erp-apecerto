"use client";

/* Ferramenta avulsa "Remover Marca d'Água".
 *
 * Corretor sobe uma foto recebida de construtora parceira (chegou por
 * WhatsApp, e-mail etc.), a foto vai DIRETO da tela para a Edge Function
 * (multipart, sem passar pelo Storage antes -- por isso nao ha midia_id
 * aqui) e a function chama a Unwatermark AI. O corretor baixa o resultado
 * na hora: o link devolvido pela Unwatermark expira em 24h e esta tela
 * nao persiste nada em midias -- essa e a diferenca central para o modo
 * "integrado" (url/midia_id), que a mesma function tambem aceita.
 */

import { useRef, useState } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";
import "../../styles/ferramenta-marca-dagua.css";

type Formato = "jpg" | "png" | "webp";

type Resultado = { url: string; salvoEmMidia: boolean; expiraEm?: string };

export function WatermarkRemover() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removerLogo, setRemoverLogo] = useState(true);
  const [removerTexto, setRemoverTexto] = useState(false);
  const [melhorarQualidade, setMelhorarQualidade] = useState(false);
  const [formato, setFormato] = useState<Formato>("jpg");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  function escolherArquivo(escolhido: File | null | undefined) {
    if (!escolhido) return;
    if (!escolhido.type.startsWith("image/")) {
      setErro("Selecione um arquivo de imagem (jpg, png ou webp).");
      return;
    }
    setFile(escolhido);
    setPreviewUrl(URL.createObjectURL(escolhido));
    setResultado(null);
    setErro(null);
  }

  async function processar() {
    if (!file) return;
    setLoading(true);
    setErro(null);
    setResultado(null);
    try {
      const supabase = getBrowserSupabaseClient();
      const form = new FormData();
      form.append("original_image_file", file, file.name);
      form.append("remover_logo", String(removerLogo));
      form.append("remover_texto", String(removerTexto));
      form.append("melhorar_qualidade", String(melhorarQualidade));
      form.append("formato", formato);

      const { data, error } = await supabase.functions.invoke("remover-marca-dagua", { body: form });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.detail ? String(data.detail) : data?.error ? String(data.error) : "Não foi possível processar a imagem.");

      setResultado({ url: data.url, salvoEmMidia: Boolean(data.salvo_em_midia), expiraEm: data.expira_em });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErro(
        msg.includes("nao_configurado") || msg.includes("503")
          ? "A ferramenta ainda não está configurada (falta a chave da Unwatermark no Supabase)."
          : "Não foi possível remover a marca d'água agora. Tente novamente em instantes.",
      );
    } finally {
      setLoading(false);
    }
  }

  function recomecar() {
    setFile(null);
    setPreviewUrl(null);
    setResultado(null);
    setErro(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="wm-tool">
      <header className="topbar">
        <div>
          <h1>Remover Marca d'Água</h1>
          <p>Envie uma foto recebida de construtora parceira e receba a versão sem a marca original.</p>
        </div>
      </header>

      <section className="form-section wm-tool-body">
        <div
          className={`media-dropzone${dragging ? " dragging" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            escolherArquivo(event.dataTransfer.files?.[0]);
          }}
        >
          <div className="media-dz-head">
            <span className="media-dz-icon">⬆</span>
            <div>
              <strong>Arraste aqui ou selecione a foto</strong>
              <small>JPG, PNG ou WebP — uma foto por vez</small>
            </div>
          </div>
        </div>

        <div className="media-upload-actions">
          <label className="upload-button">
            ＋ Escolher foto
            <input ref={inputRef} type="file" accept="image/*" onChange={(event) => escolherArquivo(event.target.files?.[0])} />
          </label>
          {file && <button className="ghost-action" type="button" onClick={recomecar}>Trocar foto</button>}
        </div>

        {previewUrl && (
          <div className="wm-tool-grid">
            <figure className="wm-tool-preview">
              <img src={previewUrl} alt="Foto original" />
              <figcaption>Original</figcaption>
            </figure>
            <figure className="wm-tool-preview">
              {resultado ? <img src={resultado.url} alt="Foto sem marca d'água" /> : <div className="wm-tool-placeholder">{loading ? "Processando…" : "O resultado aparece aqui"}</div>}
              <figcaption>Sem marca d'água</figcaption>
            </figure>
          </div>
        )}

        <div className="wm-tool-flags">
          <label><input type="checkbox" checked={removerLogo} onChange={(event) => setRemoverLogo(event.target.checked)} /> Remover logo/marca</label>
          <label><input type="checkbox" checked={removerTexto} onChange={(event) => setRemoverTexto(event.target.checked)} /> Remover marca de texto</label>
          <label>
            <input type="checkbox" checked={melhorarQualidade} onChange={(event) => setMelhorarQualidade(event.target.checked)} /> Melhorar qualidade
            <small>Não recomendado para foto de imóvel: pode alterar cor/exposição e distorcer o ambiente.</small>
          </label>
          <label className="wm-tool-formato">
            Formato de saída
            <select value={formato} onChange={(event) => setFormato(event.target.value as Formato)}>
              <option value="jpg">JPG</option>
              <option value="png">PNG</option>
              <option value="webp">WebP</option>
            </select>
          </label>
        </div>

        {erro && <div className="form-message" role="alert">{erro}</div>}

        {resultado && (
          <div className="wm-tool-expira" role="status">
            <strong>Baixe agora.</strong> O link do resultado expira em {resultado.expiraEm ?? "24h"} e não fica salvo automaticamente no ERP.
          </div>
        )}

        <div className="media-upload-actions">
          <button className="primary-action" type="button" disabled={!file || loading} onClick={() => void processar()}>{loading ? "Processando..." : "Remover marca d'água"}</button>
          {resultado && <a className="secondary-action" href={resultado.url} download target="_blank" rel="noreferrer">↓ Baixar resultado</a>}
        </div>
      </section>
    </div>
  );
}
