"use client";

/* Fluxo em lote da Marca d'Água: corretor dá um nome pra leva, sobe várias
 * fotos de uma vez, a ferramenta remove a marca d'água de cada uma (em
 * sequência -- mais previsível na tela e não sobrecarrega a Unwatermark com
 * chamadas em paralelo) e devolve tudo junto num .zip, com os arquivos
 * nomeados "<nome-da-leva>-imagem-1.jpg", "-imagem-2.jpg" etc.
 *
 * O zip é montado no navegador com JSZip, importado por CDN em tempo de uso
 * (import dinâmico) -- evita adicionar dependência nova no package.json só
 * pra isso; mesmo padrão de carregar recurso externo que o projeto já usa
 * pra a fonte Quicksand em globals.css.
 *
 * A URL do CDN fica numa variável (não como string literal dentro do
 * import()): string literal ali faz o TypeScript tentar resolver como
 * módulo instalado e quebrar o typecheck. Com variável, o import() é tratado
 * como valor dinâmico (Promise<any>), sem passar por resolução de módulo. O
 * comentário mágico correto pro bundler deste projeto é @vite-ignore (aqui é
 * Vite/vinext, não Webpack).
 */

import { useCallback, useRef, useState } from "react";
import { removerMarcaDagua, extensaoDoMime, nomeBase } from "./marca-dagua-helpers";

type StatusItem = "pendente" | "processando" | "pronto" | "erro";

type ItemLote = {
  id: string;
  arquivo: File;
  status: StatusItem;
  blob?: Blob;
  mime?: string;
  erro?: string;
};

function idItem(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

const rotuloStatus: Record<StatusItem, string> = {
  pendente: "Aguardando",
  processando: "Removendo…",
  pronto: "✓ Pronto",
  erro: "Erro",
};

const JSZIP_CDN_URL = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm";

export function WatermarkRemoverBatch({ onVoltar }: { onVoltar: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [prefixo, setPrefixo] = useState("");
  const [itens, setItens] = useState<ItemLote[]>([]);
  const [processando, setProcessando] = useState(false);
  const [zipando, setZipando] = useState(false);
  const [erroGeral, setErroGeral] = useState("");

  const adicionarArquivos = useCallback((lista: FileList | File[]) => {
    const novos: ItemLote[] = Array.from(lista)
      .filter((f) => f.type.startsWith("image/"))
      .map((arquivo) => ({ id: idItem(), arquivo, status: "pendente" as const }));
    if (novos.length) setItens((atual) => [...atual, ...novos]);
  }, []);

  const removerItem = useCallback((id: string) => {
    setItens((atual) => atual.filter((i) => i.id !== id));
  }, []);

  const processarTodos = useCallback(async () => {
    setProcessando(true);
    setErroGeral("");
    // Sequencial de propósito: corretor acompanha item por item na lista, e
    // não bombardeia a Unwatermark com N chamadas simultâneas.
    for (const item of itens) {
      if (item.status === "pronto") continue;
      setItens((atual) => atual.map((i) => (i.id === item.id ? { ...i, status: "processando", erro: undefined } : i)));
      try {
        const r = await removerMarcaDagua(item.arquivo, { removerTexto: false, melhorarQualidade: false });
        if (r.kind === "blob") {
          setItens((atual) => atual.map((i) => (i.id === item.id ? { ...i, status: "pronto", blob: r.blob, mime: r.mime } : i)));
        } else {
          setItens((atual) => atual.map((i) => (i.id === item.id ? { ...i, status: "erro", erro: "sem preview nesse modo, tenta de novo" } : i)));
        }
      } catch (e) {
        setItens((atual) => atual.map((i) => (i.id === item.id ? { ...i, status: "erro", erro: e instanceof Error ? e.message : "falhou" } : i)));
      }
    }
    setProcessando(false);
  }, [itens]);

  const prontos = itens.filter((i): i is ItemLote & { blob: Blob } => i.status === "pronto" && !!i.blob);
  const podeBaixar = prontos.length > 0 && !processando;

  const baixarZip = useCallback(async () => {
    setZipando(true);
    setErroGeral("");
    try {
      const modulo: { default: new () => { file: (nome: string, blob: Blob) => void; generateAsync: (opts: { type: "blob" }) => Promise<Blob> } } =
        await import(/* @vite-ignore */ JSZIP_CDN_URL);
      const JSZip = modulo.default;
      const zip = new JSZip();
      const base = nomeBase(prefixo || "fotos");
      prontos.forEach((item, indice) => {
        const ext = extensaoDoMime(item.mime || "image/jpeg");
        zip.file(`${base}-imagem-${indice + 1}.${ext}`, item.blob);
      });
      const conteudo = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(conteudo);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${base}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch {
      setErroGeral("Não consegui montar o arquivo .zip. Tenta baixar de novo.");
    } finally {
      setZipando(false);
    }
  }, [prontos, prefixo]);

  const limparTudo = useCallback(() => {
    setItens([]);
    setErroGeral("");
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  return (
    <div className="wm-workspace">
      <header>
        <div>
          <button type="button" className="wm-voltar" onClick={onVoltar}>← Voltar</button>
          <span>FERRAMENTAS · FOTOS</span>
          <h1>Marca d&apos;Água · Várias fotos</h1>
          <p>Dê um nome pra essa leva, suba as fotos e remova a marca d&apos;água de todas de uma vez.</p>
        </div>
      </header>

      {erroGeral && <div className="wm-error">{erroGeral}</div>}

      <div className="wm-card wm-lote-card">
        <label className="wm-campo">
          <span>Nome desta leva</span>
          <input
            type="text"
            value={prefixo}
            onChange={(e) => setPrefixo(e.target.value)}
            placeholder="Ex.: Empreendimento Aurora - fachada"
            disabled={processando}
          />
        </label>

        <label
          className="wm-dropzone wm-dropzone-lote"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.length) adicionarArquivos(e.dataTransfer.files);
          }}
        >
          <strong>Arraste as fotos aqui</strong>
          <span>ou clique para escolher várias de uma vez · JPG, PNG ou WebP</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => {
              if (e.target.files?.length) adicionarArquivos(e.target.files);
              e.target.value = "";
            }}
          />
        </label>

        {itens.length > 0 && (
          <ul className="wm-lote-lista">
            {itens.map((item, indice) => (
              <li key={item.id} className={`wm-lote-item wm-lote-${item.status}`}>
                <span className="wm-lote-num">{indice + 1}</span>
                <span className="wm-lote-nome">{item.arquivo.name}</span>
                <span className="wm-lote-status">{rotuloStatus[item.status]}{item.status === "erro" && item.erro ? ` · ${item.erro}` : ""}</span>
                {item.status !== "processando" && (
                  <button type="button" className="wm-lote-remover" onClick={() => removerItem(item.id)} aria-label={`Remover ${item.arquivo.name} da lista`}>×</button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="wm-acoes">
          <button type="button" className="wm-btn-primary" disabled={itens.length === 0 || processando} onClick={() => void processarTodos()}>
            {processando ? "Removendo…" : `Remover marca d'água de todas (${itens.length})`}
          </button>
          <button type="button" className="wm-btn-primary" disabled={!podeBaixar || zipando} onClick={() => void baixarZip()}>
            {zipando ? "Preparando…" : `↓ Baixar tudo (.zip) · ${prontos.length}`}
          </button>
          {itens.length > 0 && (
            <button type="button" className="wm-btn-secondary" disabled={processando} onClick={limparTudo}>Limpar lista</button>
          )}
        </div>
      </div>
    </div>
  );
}
