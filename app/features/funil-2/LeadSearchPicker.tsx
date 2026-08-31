"use client";

import { useEffect, useRef, useState } from "react";

type LeadEncontrado = {
  id: string;
  nome: string;
  telefoneMascarado: string | null;
  negocioId: number;
  corretorNome: string | null;
};

type RespostaBusca = {
  leads?: LeadEncontrado[];
  pagina?: number;
  temMais?: boolean;
  curta?: boolean;
  error?: string;
};

const MINIMO_BUSCA = 3;

/**
 * Pesquisa clientes sob a sessão/RLS atual sem colocar a carteira inteira no
 * DOM. O componente mantém apenas a página visível e o cliente escolhido.
 */
export function LeadSearchPicker({ accessToken, value, onChange, rotulo = "Buscar cliente" }: {
  accessToken: string;
  value: string;
  onChange: (id: string) => void;
  rotulo?: string;
}) {
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<LeadEncontrado[]>([]);
  const [escolhido, setEscolhido] = useState<LeadEncontrado | null>(null);
  const [pagina, setPagina] = useState(1);
  const [temMais, setTemMais] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const primeiroResultadoRef = useRef<HTMLButtonElement>(null);
  const termo = busca.trim();

  useEffect(() => {
    if (value || termo.length < MINIMO_BUSCA) return;
    const controlador = new AbortController();
    const relogio = window.setTimeout(async () => {
      setCarregando(true); setErro(null);
      try {
        const parametros = new URLSearchParams({ modo: "buscar-funil", q: termo, pagina: String(pagina) });
        const resposta = await fetch(`/api/funil2/carteira?${parametros}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
          signal: controlador.signal,
        });
        const json = await resposta.json().catch(() => ({})) as RespostaBusca;
        if (!resposta.ok) {
          setErro(resposta.status === 401 ? "Sua sessão expirou. Recarregue a página para continuar."
            : resposta.status === 403 ? "Você não tem permissão para pesquisar esta carteira."
              : json.error ?? "Não foi possível pesquisar os clientes.");
          setResultados([]); setTemMais(false); return;
        }
        const recebidos = json.leads ?? [];
        setResultados((atuais) => pagina === 1 ? recebidos : [...atuais, ...recebidos.filter((lead) => !atuais.some((item) => item.id === lead.id))]);
        setTemMais(json.temMais === true);
      } catch (causa) {
        if ((causa as { name?: string }).name !== "AbortError") {
          setErro(navigator.onLine ? "Não foi possível pesquisar os clientes." : "Sem conexão. A pesquisa está indisponível offline.");
          setResultados([]); setTemMais(false);
        }
      } finally {
        if (!controlador.signal.aborted) setCarregando(false);
      }
    }, 280);
    return () => { window.clearTimeout(relogio); controlador.abort(); };
  }, [accessToken, pagina, termo, value]);

  if (value && escolhido) return <div className="f2-lead-escolhido">
    <span>CLIENTE</span>
    <strong>{escolhido.nome}</strong>
    <small>{escolhido.telefoneMascarado ?? "Telefone não informado"} · negócio #{escolhido.negocioId}</small>
    <button type="button" onClick={() => { setEscolhido(null); onChange(""); setBusca(""); setPagina(1); }}>Trocar cliente</button>
  </div>;

  return <div className="f2-lead-picker">
    <label>{rotulo}<input
      type="search"
      value={busca}
      onChange={(evento) => {
        const proxima = evento.target.value;
        setBusca(proxima); setPagina(1);
        if (proxima.trim().length < MINIMO_BUSCA) { setResultados([]); setTemMais(false); setErro(null); setCarregando(false); }
      }}
      onKeyDown={(evento) => {
        if (evento.key === "ArrowDown" && resultados.length > 0) { evento.preventDefault(); primeiroResultadoRef.current?.focus(); }
        if (evento.key === "Escape") { setBusca(""); setResultados([]); setErro(null); }
      }}
      placeholder="Nome, telefone ou nº do negócio"
      autoComplete="off"
      role="combobox"
      aria-autocomplete="list"
      aria-controls="f2-lead-resultados"
      aria-expanded={resultados.length > 0}
    /></label>
    {termo.length < MINIMO_BUSCA && <p>Digite pelo menos três caracteres.</p>}
    {carregando && <p role="status">Buscando clientes…</p>}
    {erro && <p className="f2-modal-erro" role="alert">{erro}</p>}
    {!carregando && !erro && termo.length >= MINIMO_BUSCA && resultados.length === 0 && <p>Nenhum cliente encontrado na sua carteira.</p>}
    {resultados.length > 0 && <div className="f2-lead-resultados" id="f2-lead-resultados" role="listbox" aria-label="Clientes encontrados">
      {resultados.map((lead, indice) => <button
        key={lead.id}
        ref={indice === 0 ? primeiroResultadoRef : undefined}
        type="button"
        role="option"
        aria-selected={false}
        onClick={() => { setEscolhido(lead); onChange(lead.id); }}
      ><strong>{lead.nome}</strong><small>{lead.telefoneMascarado ?? "Sem telefone"} · #{lead.negocioId}{lead.corretorNome ? ` · ${lead.corretorNome}` : ""}</small></button>)}
      {temMais && <button type="button" className="f2-lead-mais" disabled={carregando} onClick={() => setPagina((atual) => atual + 1)}>Mostrar mais resultados</button>}
    </div>}
  </div>;
}
