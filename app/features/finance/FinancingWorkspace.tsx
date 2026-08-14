"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Ficha = {
  id: string;
  comprador_nome: string | null;
  telefone: string | null;
  produto: string | null;
  unidade: string | null;
  status: string;
  renda: number | null;
  valor_imovel: number | null;
  valor_entrada: number | null;
  valor_financiar: number | null;
  link_token: string | null;
  criado_em: string;
  preenchida_em: string | null;
  concluida_em: string | null;
};

const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function statusDaFicha(ficha: Ficha) {
  if (ficha.concluida_em || ficha.status === "concluida") return "Concluída";
  if (ficha.preenchida_em || ficha.renda !== null || ficha.valor_imovel !== null) return "Dados preenchidos";
  return "Aguardando cliente";
}

async function buscarFichas(accessToken: string) {
  const response = await fetch("/api/financiamento", { headers: { Authorization: `Bearer ${accessToken}` } });
  const result = await response.json() as { fichas?: Ficha[]; error?: string };
  if (!response.ok) throw new Error(result.error || "Não foi possível carregar as fichas.");
  return result.fichas ?? [];
}

export function FinancingWorkspace({ accessToken }: { accessToken: string }) {
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [copiado, setCopiado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const result = await buscarFichas(accessToken);
      setFichas(result);
      setSelecionada((atual) => atual && result.some((ficha) => ficha.id === atual) ? atual : result[0]?.id ?? null);
    } catch (reason) {
      setErro(reason instanceof Error ? reason.message : "Não foi possível carregar as fichas.");
    } finally {
      setCarregando(false);
    }
  }, [accessToken]);

  useEffect(() => {
    let ativo = true;
    buscarFichas(accessToken).then((result) => {
      if (!ativo) return;
      setFichas(result);
      setSelecionada(result[0]?.id ?? null);
    }).catch((reason: unknown) => {
      if (ativo) setErro(reason instanceof Error ? reason.message : "Não foi possível carregar as fichas.");
    }).finally(() => {
      if (ativo) setCarregando(false);
    });
    return () => { ativo = false; };
  }, [accessToken]);
  const ficha = useMemo(() => fichas.find((item) => item.id === selecionada) ?? null, [fichas, selecionada]);
  const preenchidas = fichas.filter((item) => statusDaFicha(item) !== "Aguardando cliente").length;

  async function copiarLink(item: Ficha) {
    if (!item.link_token) return;
    await navigator.clipboard.writeText(`${window.location.origin}/ficha/${item.link_token}`);
    setCopiado(item.id);
    window.setTimeout(() => setCopiado(null), 2500);
  }

  return (
    <main className="fin-workspace">
      <header className="fin-head"><div><span>CRÉDITO IMOBILIÁRIO</span><h1>Financiamento</h1><p>Fichas reais recebidas pelo Supabase. O ERP não inventa resultado bancário nem promete aprovação.</p></div><button type="button" onClick={() => void carregar()} disabled={carregando}>Atualizar</button></header>
      <section className="fin-kpis" aria-label="Resumo"><article><strong>{fichas.length}</strong><span>fichas visíveis</span></article><article><strong>{preenchidas}</strong><span>com dados</span></article><article><strong>{fichas.length - preenchidas}</strong><span>aguardando</span></article></section>
      {erro && <div className="fin-erro" role="alert">{erro}<button type="button" onClick={() => void carregar()}>Tentar novamente</button></div>}
      {!erro && carregando && <div className="fin-vazio">Carregando fichas…</div>}
      {!erro && !carregando && fichas.length === 0 && <div className="fin-vazio">Nenhuma ficha de financiamento disponível para seu usuário.</div>}
      {!erro && fichas.length > 0 && <div className="fin-grade">
        <section className="fin-lista" aria-label="Fichas de financiamento">{fichas.map((item) => <button type="button" className={item.id === ficha?.id ? "on" : ""} onClick={() => setSelecionada(item.id)} key={item.id}><strong>{item.comprador_nome || "Comprador não informado"}</strong><span>{[item.produto, item.unidade].filter(Boolean).join(" · ") || "Imóvel não informado"}</span><small>{statusDaFicha(item)}</small></button>)}</section>
        {ficha && <article className="fin-detalhe"><header><div><span>FICHA</span><h2>{ficha.comprador_nome || "Comprador não informado"}</h2><p>{ficha.telefone || "Telefone não informado"}</p></div><b>{statusDaFicha(ficha)}</b></header><dl><div><dt>Imóvel</dt><dd>{[ficha.produto, ficha.unidade].filter(Boolean).join(" · ") || "Não informado"}</dd></div><div><dt>Renda declarada</dt><dd>{ficha.renda === null ? "Não informada" : dinheiro.format(ficha.renda)}</dd></div><div><dt>Valor do imóvel</dt><dd>{ficha.valor_imovel === null ? "Não informado" : dinheiro.format(ficha.valor_imovel)}</dd></div><div><dt>Entrada</dt><dd>{ficha.valor_entrada === null ? "Não informada" : dinheiro.format(ficha.valor_entrada)}</dd></div><div><dt>Valor a financiar</dt><dd>{ficha.valor_financiar === null ? "Não informado" : dinheiro.format(ficha.valor_financiar)}</dd></div><div><dt>Criada em</dt><dd>{new Date(ficha.criado_em).toLocaleDateString("pt-BR")}</dd></div></dl>{ficha.link_token ? <button className="fin-link" type="button" onClick={() => void copiarLink(ficha)}>{copiado === ficha.id ? "Link copiado" : "Copiar link seguro da ficha"}</button> : <p className="fin-sem-link">Esta ficha não possui link público ativo.</p>}<aside>As simulações bancárias ainda não possuem integração persistida. Por isso esta tela mostra somente dados verdadeiros da ficha.</aside></article>}
      </div>}
    </main>
  );
}
