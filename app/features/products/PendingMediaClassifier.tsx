"use client";
/* eslint-disable @next/next/no-img-element */

import { useId } from "react";

export type PendingMediaItem = {
  id: string;
  file: File;
  kind: "foto" | "video";
  category: string;
  preview: string;
  cover?: boolean;
};

export function PendingMediaClassifier({
  items,
  categories,
  onCategoryChange,
  onRemove,
  onCoverChange,
}: {
  items: PendingMediaItem[];
  categories: readonly string[];
  onCategoryChange: (id: string, category: string) => void;
  onRemove: (id: string) => void;
  onCoverChange?: (id: string) => void;
}) {
  const coverGroupName = useId();

  if (!items.length) return null;

  return <div className="pmc-wrap">
    <header>
      <div><strong>Confira e classifique as imagens</strong><small>Use a miniatura para identificar cada ambiente antes de cadastrar.</small></div>
      <span>{items.length} {items.length === 1 ? "arquivo" : "arquivos"}</span>
    </header>
    <div className="pmc-grid">
      {items.map((item, index) => <article className={item.cover ? "is-cover" : ""} key={item.id}>
        <div className="pmc-preview">
          {item.kind === "foto"
            ? <img src={item.preview} alt={`Prévia de ${item.file.name}`} />
            : <video src={item.preview} muted playsInline preload="metadata" />}
          <span className={`pmc-kind ${item.kind}`}>{item.kind === "foto" ? "Foto" : "Vídeo"}</span>
          <b>{index + 1}</b>
          {item.cover && <em>★ Capa</em>}
          <button type="button" aria-label={`Remover ${item.file.name}`} onClick={() => onRemove(item.id)}>×</button>
        </div>
        <div className="pmc-fields">
          <label><span>O que aparece nesta imagem?</span><select aria-label={`Classificar ${item.file.name}`} value={item.category} onChange={(event) => onCategoryChange(item.id, event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <div><small title={item.file.name}>{item.file.name}</small><small>{(item.file.size / 1024 / 1024).toFixed(1)} MB</small></div>
          {item.kind === "foto" && onCoverChange && <label className="pmc-cover"><input type="radio" name={coverGroupName} checked={Boolean(item.cover)} onChange={() => onCoverChange(item.id)} /> Usar como capa</label>}
        </div>
      </article>)}
    </div>
  </div>;
}
