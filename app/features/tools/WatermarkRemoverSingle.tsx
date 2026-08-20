"use client";

/* Fluxo unitário da Marca d'Água: uma foto por vez, sobe, remove, baixa.
 * Extraído do antigo WatermarkRemoverWorkspace.tsx quando a ferramenta virou
 * uma escolha entre "uma foto" e "várias fotos (lote)" -- ver
 * WatermarkRemoverWorkspace.tsx (tela de escolha) e WatermarkRemoverBatch.tsx
 * (lote). Lógica de chamada da function agora vive em marca-dagua-helpers.ts,
 * compartilhada com o lote.
 *
 * Botão "Colar da área de transferência": gesto direto de clique ->
 * Clipboard API assíncrona, mais confiável entre navegadores do que depender
 * só do evento passivo de teclado. Ctrl+V continua funcionando como atalho
 * extra em cima do botão.
 *
 * X no preview: fica dentro do <label> do dropzone, então o clique nele
 * precisa de preventDefault -- senão o navegador trata como clique no label
 * e abre o seletor de arquivo por baixo do botão de remover.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { removerMarcaDagua, extensaoDoMime, idCurto, nomeBase } from "./marca-dagua-helpers";

type Resultado =
  | { kind: "blob"; blobUrl: string; nomeArquivo: string }
  | { kind: "externo"; url: string; expiraEm: string };

export function WatermarkRemoverSingle({ onVoltar }: { onVoltar: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removerTexto, setRemoverTexto] = useState(false);
  const [melhorarQualidade, setMelhorarQualidade] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [colando, setColando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [colado, setColado] = useState(false);

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

  const avisarColado = useCallback(() => {
    setColado(true);
    window.setTimeout(() => setColado(false), 1500);
  }, []);

  const colarDoClipboard = useCallback(async () => {
    setErro("");
    if (!navigator.clipboard || !navigator.clipboard.read) {
      setErro("Este navegador não permite colar direto pelo botão. Tente Ctrl+V ou arraste o arquivo.");
      return;
    }
    setColando(true);
    try {
      const itens = await navigator.clipboard.read();
      for (const item of itens) {
        const tipoImagem = item.types.find((t) => t.startsWith("image/"));
        if (tipoImagem) {
          const blob = await item.getType(tipoImagem);
          const file = new File([blob], `colado.${tipoImagem.split("/")[1] || "png"}`, { type: tipoImagem });
          escolherArquivo(file);
          avisarColado();
          return;
        }
      }
      setErro("Não encontrei nenhuma imagem na área de transferência. Copie a foto de novo e tente outra vez.");
    } catch {
      setErro("Não consegui acessar a área de transferência — o navegador pode ter bloqueado a permissão. Tente Ctrl+V ou arraste o arquivo.");
    } finally {
      setColando(false);
    }
  }, [escolherArquivo, avisarColado]);

  useEffect(() => {
    function aoColar(evento: ClipboardEvent) {
      const itens = evento.clipboardData?.items;
      if (!itens) return;
      for (const item of itens) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            evento.preventDefault();
            escolherArquivo(file);
            avisarColado();
          }
          break;
        }
      }
    }
    document.addEventListener("paste", aoColar);
    return () => document.removeEventListener("paste", aoColar);
  }, [escolherArquivo, avisarColado]);

  const processar = useCallback(async () => {
    if (!arquivo) return;
    setProcessando(true);
    setErro("");
    limparResultado();
    try {
      const r = await removerMarcaDagua(arquivo, { removerTexto, melhorarQualidade });
      if (r.kind === "blob") {
        const nomeArquivo = `${nomeBase(arquivo.name)}-sem-marca-dagua-${idCurto()}.${extensaoDoMime(r.mime)}`;
        setResultado({ kind: "blob", blobUrl: URL.createObjectURL(r.blob), nomeArquivo });
      } else {
        setResultado({ kind: "externo", url: r.url, expiraEm: r.expiraEm });
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
          <button type="button" className="wm-voltar" onClick={onVoltar}>← Voltar</button>
          <span>FERRAMENTAS · FOTOS</span>
          <h1>Marca d&apos;Água · Uma foto</h1>
          <p>Suba uma foto solta, remova a marca d&apos;água ou logo, e baixe o resultado. Anexar a um empreendimento é um passo à parte, em Produtos.</p>
        </div>
      </header>

      {erro && <div className="wm-error">{erro}</div>}
      {colado && <div className="wm-aviso-colado">Imagem colada da área de transferência</div>}

      <div className="wm-grid">
        <section className="wm-card">
          <button type="button" className="wm-btn-colar" onClick={() => void colarDoClipboard()} disabled={colando}>
            📋 {colando ? "Colando…" : "Colar da área de transferência"}
          </button>

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
              <div className="wm-preview-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Foto selecionada" />
                <button
                  type="button"
                  className="wm-preview-remover"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    limpar();
                  }}
                  aria-label="Remover foto selecionada"
                  title="Remover foto"
                >
                  ×
                </button>
              </div>
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
              <a className="wm-btn-primary" href={resultado.blobUrl} download={resultado.nomeArquivo}>
                ↓ Baixar foto limpa
              </a>
              <p className="wm-aviso">Arquivo: {resultado.nomeArquivo} · anexar a um empreendimento é feito na tela de Produtos, depois de baixar.</p>
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
