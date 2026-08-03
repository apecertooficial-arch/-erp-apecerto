"use client";
/**
 * VISITAS 3.0 — a agenda comercial dos imóveis, no desenho do protótipo:
 * selo laranja + contagem, botão preto "+ Nova visita", lista com a data em
 * destaque, cliente · empreendimento, local · hora e a situação em chip.
 * Editar e criar continuam na Agenda oficial — aqui é o retrato comercial.
 */
import { useCallback, useEffect, useState } from "react";

type Visita = {
  id: string;
  negocio_id: number | null;
  cliente_nome: string | null;
  produto: string | null;
  local: string | null;
  data: string | null;
  hora_inicio: string | null;
  status: string | null;
  resultado: string | null;
};

const STATUS_ROTULO: Record<string, { txt: string; classe: string }> = {
  confirmada: { txt: "confirmada", classe: "ok" },
  agendada: { txt: "a confirmar", classe: "espera" },
  realizada: { txt: "realizada", classe: "feita" },
  nao_compareceu: { txt: "não compareceu", classe: "falta" },
  cancelada: { txt: "cancelada", classe: "feita" },
};

export function Visitas3({ accessToken, onIrParaAgenda, onAbrirAtendimento }: { accessToken: string; onIrParaAgenda: () => void; onAbrirAtendimento: (negocioId: string) => void }) {
  const [visitas, setVisitas] = useState<Visita[] | null>(null);
  const [total, setTotal] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/ncrm/visitas`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) { setErro((j.error as string) || "Não foi possível carregar as visitas."); return; }
      setVisitas((j.visitas as Visita[]) ?? []);
      setTotal((j.total as number) ?? 0);
    } catch { setErro("Não foi possível carregar as visitas."); }
  }, [accessToken]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);

  return (
    <div className="ncrm3-visitas">
      <section className="ncrm3-visitas-explicacao">
        <div>
          <span>PIPE PARALELO DE VISITAS</span>
          <h2>A visita aparece aqui sem tirar o cliente do atendimento.</h2>
          <p>Depois do horário, registre o resultado. O CRM devolve o cliente ao acompanhamento ou inicia a Esteira de Vendas quando houver proposta.</p>
        </div>
        <div className="ncrm3-visitas-fluxo" aria-label="Fluxo de uma visita">
          <article><i>1</i><b>Agendada</b><small>confirmar presença</small></article>
          <span>→</span>
          <article><i>2</i><b>Realizada</b><small>registrar resultado</small></article>
          <span>→</span>
          <article><i>3</i><b>Próximo destino</b><small>acompanhamento ou proposta</small></article>
        </div>
      </section>
      <div className="ncrm3-visitas-topo">
        <div className="ncrm3-visitas-selo">
          <span>AGENDA COMERCIAL DOS IMÓVEIS</span>
          <b>{total} agendadas</b>
        </div>
        <button type="button" className="ncrm3-preto" onClick={onIrParaAgenda}>+ Nova visita</button>
      </div>

      {erro && <div className="ncrm3-erro">{erro}</div>}
      {!visitas && !erro && <div className="ncrm3-carregando">Carregando as visitas…</div>}
      {visitas && visitas.length === 0 && (
        <div className="ncrm3-vazio"><strong>Nenhuma visita por aqui.</strong>Agende pela ficha do cliente ou pela Agenda.</div>
      )}

      {visitas && visitas.length > 0 && (
        <div className="ncrm3-visitas-pipe">
          {([
            { chave: "agendadas", titulo: "Agendadas e a confirmar", filtro: (v: Visita) => !["realizada", "cancelada", "nao_compareceu"].includes(String(v.status)) },
            { chave: "resultado", titulo: "Realizadas · registrar resultado", filtro: (v: Visita) => v.status === "realizada" && !v.resultado },
            { chave: "concluidas", titulo: "Concluídas e canceladas", filtro: (v: Visita) => ["cancelada", "nao_compareceu"].includes(String(v.status)) || Boolean(v.resultado) },
          ] as const).map((grupo) => {
            const lista = visitas.filter(grupo.filtro);
            return <section key={grupo.chave} className="ncrm3-visitas-coluna">
              <h3>{grupo.titulo} <b>{lista.length}</b></h3>
              {lista.length === 0 && <p className="ncrm3-nota">Nenhuma visita aqui.</p>}
              <div className="ncrm3-visitas-lista">{lista.map((v) => {
            const d = v.data ? new Date(`${v.data}T12:00:00`) : null;
            const st = STATUS_ROTULO[String(v.status ?? "agendada")] ?? STATUS_ROTULO.agendada;
            return (
              <article key={v.id} className="ncrm3-visita">
                <span className="ncrm3-visita-data">
                  <b>{d ? d.getDate() : "—"}</b>
                  <small>{d ? d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase() : ""}</small>
                </span>
                <span className="ncrm3-visita-corpo">
                  <b>{v.cliente_nome ?? "Cliente"}{v.produto ? ` · ${v.produto}` : ""}</b>
                  <small>📍 {v.local || "Local a confirmar"}{v.hora_inicio ? ` · ${String(v.hora_inicio).slice(0, 5)}` : ""}</small>
                </span>
                <i className={`ncrm3-visita-status ${st.classe}`}>{st.txt}</i>
                {v.negocio_id ? (
                  <button type="button" className={grupo.chave === "resultado" ? "ncrm3-principal" : "ncrm3-secundario"} onClick={() => onAbrirAtendimento(String(v.negocio_id))}>
                    {grupo.chave === "resultado" ? "Registrar resultado" : "Abrir cliente"}
                  </button>
                ) : <button type="button" className="ncrm3-secundario" onClick={onIrParaAgenda}>Editar</button>}
              </article>
            );
          })}</div></section>})}
        </div>
      )}
    </div>
  );
}
