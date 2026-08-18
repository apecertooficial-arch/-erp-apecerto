"use client";

import { useMemo, useState } from "react";

type Instantaneo = { metricas: string[]; pendencias: string[] };

function lerTela(): Instantaneo {
  if (typeof document === "undefined") return { metricas: [], pendencias: [] };
  const metricas = [...document.querySelectorAll<HTMLElement>(".ape-int-kpi")]
    .map((no) => {
      const rotulo = no.querySelector(".ape-int-kpi-topo > span")?.textContent?.trim();
      const valor = no.querySelector("strong")?.textContent?.trim();
      const nota = no.querySelector(":scope > small")?.textContent?.trim();
      return rotulo && valor ? `${rotulo}: ${valor}${nota ? ` (${nota})` : ""}` : "";
    }).filter(Boolean).slice(0, 8);
  const pendencias = [...document.querySelectorAll<HTMLElement>(".ape-int-pendencia")]
    .map((no) => `${no.querySelector("b")?.textContent?.trim() ?? "Pendência"}: ${no.querySelector("span")?.textContent?.trim() ?? ""}`)
    .filter(Boolean).slice(0, 5);
  return { metricas, pendencias };
}

function textoResposta(valor: unknown): string | null {
  if (!valor || typeof valor !== "object") return null;
  const o = valor as Record<string, unknown>;
  for (const chave of ["resposta", "output", "text", "mensagem"]) {
    if (typeof o[chave] === "string" && o[chave]) return o[chave] as string;
  }
  return null;
}

export function CopilotoInteligencia({ accessToken, titulo, atualizadoEm }: { accessToken: string; titulo: string; atualizadoEm?: string }) {
  const [aberto, setAberto] = useState(false);
  const [instantaneo, setInstantaneo] = useState<Instantaneo>({ metricas: [], pendencias: [] });
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const resumo = useMemo(() => {
    if (!instantaneo.metricas.length) return "Esta tela ainda não tem indicadores confirmados. Use as pendências abaixo como plano de conexão.";
    const alertas = instantaneo.metricas.filter((linha) => /—|vencid|crític|atenção|acima/i.test(linha));
    return alertas.length
      ? `${instantaneo.metricas.length} indicadores visíveis; ${alertas.length} pedem leitura ou ação. Abra a conversa para priorizar com o contexto desta tela.`
      : `${instantaneo.metricas.length} indicadores visíveis e nenhuma sinalização textual crítica encontrada nesta leitura.`;
  }, [instantaneo]);

  const perguntar = async (texto: string) => {
    const entrada = texto.trim();
    if (!entrada || ocupado) return;
    setOcupado(true); setErro(null); setResposta(null);
    const contexto = [
      `Tela: ${titulo}. Atualização: ${atualizadoEm ?? "não informada"}.`,
      `Indicadores agregados: ${instantaneo.metricas.join(" | ") || "nenhum confirmado"}.`,
      `Pendências: ${instantaneo.pendencias.join(" | ") || "nenhuma listada"}.`,
      `Pergunta do gestor: ${entrada}`,
      "Responda em português claro, separe fato de recomendação, não invente número e proponha no máximo três ações priorizadas.",
    ].join("\n").slice(0, 2000);
    try {
      const chamada = await fetch("/api/agentes", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "testar", slug: "inteligencia-ceo", input: contexto }),
      });
      const corpo = await chamada.json().catch(() => ({})) as Record<string, unknown>;
      if (!chamada.ok) throw new Error(typeof corpo.error === "string" ? corpo.error : "O agente não respondeu.");
      const textoFinal = textoResposta(corpo);
      if (!textoFinal) throw new Error("O agente respondeu sem texto utilizável.");
      setResposta(textoFinal);
      setPergunta("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "O agente não respondeu agora.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <>
      <button className="ape-int-copiloto-botao" type="button" onClick={() => { setInstantaneo(lerTela()); setAberto(true); }} aria-haspopup="dialog">
        <i aria-hidden="true">✦</i><span>Resumir com IA</span>
      </button>
      {aberto && (
        <div className="ape-int-copiloto-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setAberto(false)}>
          <aside className="ape-int-copiloto" role="dialog" aria-modal="true" aria-label="Copiloto de Inteligência">
            <header>
              <span><i>✦</i><small>COPILOTO DE INTELIGÊNCIA</small><b>{titulo}</b></span>
              <button type="button" onClick={() => setAberto(false)} aria-label="Fechar copiloto">×</button>
            </header>
            <section className="ape-int-copiloto-resumo">
              <small>LEITURA INSTANTÂNEA · DADOS VISÍVEIS</small>
              <strong>{resumo}</strong>
              <ul>{instantaneo.metricas.slice(0, 4).map((linha) => <li key={linha}>{linha}</li>)}</ul>
            </section>
            {!!instantaneo.pendencias.length && (
              <section className="ape-int-copiloto-pendencias">
                <b>Limites desta análise</b>
                {instantaneo.pendencias.slice(0, 3).map((linha) => <small key={linha}>{linha}</small>)}
              </section>
            )}
            {resposta && <div className="ape-int-copiloto-fala"><small>RESPOSTA DO AGENTE</small><p>{resposta}</p></div>}
            {erro && <div className="ape-int-copiloto-erro" role="alert"><b>Agente indisponível</b><span>{erro} O resumo local continua válido; publique e teste o agente “inteligencia-ceo” em Agentes de IA para liberar a conversa.</span></div>}
            <div className="ape-int-copiloto-atalhos">
              {["O que exige ação hoje?", "Onde estamos perdendo resultado?", "Quais dados ainda faltam?"].map((texto) => (
                <button key={texto} type="button" disabled={ocupado} onClick={() => void perguntar(texto)}>{texto}</button>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); void perguntar(pergunta); }}>
              <label htmlFor="ape-int-pergunta">Converse com os dados desta tela</label>
              <textarea id="ape-int-pergunta" value={pergunta} onChange={(e) => setPergunta(e.target.value)} maxLength={600} rows={3} placeholder="Ex.: o que eu deveria cobrar do gerente hoje?" />
              <button type="submit" disabled={ocupado || pergunta.trim().length < 3}>{ocupado ? "Analisando…" : "Perguntar ao agente"}</button>
            </form>
            <footer>Usa apenas agregados exibidos nesta tela. Não envia nome, telefone nem texto de conversa.</footer>
          </aside>
        </div>
      )}
    </>
  );
}
