"use client";
/* PAINEL DE INÍCIO — os números do corretor.
 *
 * O que ele responde, em três segundos: quanto eu tenho, quanto está atrasado,
 * o que é hoje, e como eu estou indo.
 *
 * REGRA DESTA TELA: número que não leva a lugar nenhum é enfeite. Todo card é
 * um atalho — tocar em "atrasados" abre a fila. Sem isso o corretor lê "22
 * atrasados", fica ansioso e não tem o que fazer com a informação.
 *
 * O que NÃO entra aqui: VGV, meta, ranking, funil e comparação com colega.
 * Isso é conversa de gestão e vive no ERP pelo navegador. O app existe para o
 * corretor trabalhar, não para se medir.
 *
 * As duas notas medem coisas diferentes de propósito. A de atendimento vem da
 * IA lendo as conversas (COMO ele atende) e muda de um dia para o outro. O
 * score vem da atividade e resultado do mês (QUANTO ele produz). Corretor
 * educado e parado tem nota alta e score baixo — e o contrário também acontece.
 *
 * ESTILO INLINE, no mesmo padrão de PainelPiloto e PainelSaraRevisao: seis
 * cards não justificam mexer na folha global de 20 KB, e o componente fica
 * isolado para o redesenho.
 */
import { useCallback, useEffect, useState } from "react";

type Painel = {
  leads_novos: number;
  atrasados: number;
  acoes_hoje: number;
  leads_base: number;
  visitas_agendadas: number;
  nota_atendimento: number | null;
  nota_avaliacoes: number;
  score_performance: number | null;
  score_dia: string | null;
};

/** NULL vira "—", nunca 0. Quem nunca foi avaliado leria zero como nota zero. */
const numero = (v: number | null | undefined) =>
  v === null || v === undefined || Number.isNaN(Number(v)) ? "—" : String(v);

const S = {
  wrap: { margin: "0 0 20px" } as const,
  ola: { margin: "0 0 10px", fontSize: 13, color: "var(--muted,#6f6862)" } as const,
  grade: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 } as const,
  card: {
    minHeight: 76, display: "grid", gap: 2, alignContent: "center", textAlign: "left" as const,
    padding: "12px 14px", border: "1px solid var(--line,#e5e7eb)", borderRadius: 14,
    background: "#fff", cursor: "pointer",
  } as const,
  valor: { fontSize: 24, fontWeight: 700, lineHeight: 1.1, color: "var(--ink,#1c1612)" } as const,
  rotulo: { fontSize: 12, color: "var(--muted,#6f6862)" } as const,
  notas: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 8 } as const,
  nota: {
    padding: "12px 14px", border: "1px solid var(--line,#e5e7eb)", borderRadius: 14,
    background: "#fbfaf9", display: "grid", gap: 2,
  } as const,
  rodape: { margin: "12px 0 0", fontSize: 11, color: "var(--muted,#6f6862)", textAlign: "center" as const } as const,
};

export function PainelCorretor({ accessToken, nome, onIr }: {
  accessToken: string;
  nome: string;
  onIr: (destino: string) => void;
}) {
  const [p, setP] = useState<Painel | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  const carregar = useCallback(async (sinal: AbortSignal) => {
    const r = await fetch("/api/ncrm/painel", {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: sinal,
    });
    if (!r.ok) throw new Error(String(r.status));
    return (await r.json()) as Painel;
  }, [accessToken]);

  useEffect(() => {
    const ctrl = new AbortController();
    let vivo = true;
    carregar(ctrl.signal)
      .then((d) => { if (vivo) { setP(d); setErro(false); } })
      .catch((e) => { if (vivo && e?.name !== "AbortError") setErro(true); });
    return () => { vivo = false; ctrl.abort(); };
  }, [carregar, tentativa]);

  const primeiro = (nome || "").trim().split(/\s+/)[0] || "corretor";

  if (erro) {
    return (
      <div className="md-erro" role="alert" style={{ marginBottom: 16 }}>
        <strong>Não foi possível carregar seus números.</strong>
        <button type="button" onClick={() => { setErro(false); setTentativa((n) => n + 1); }}>
          Tentar de novo
        </button>
      </div>
    );
  }

  /* Esqueleto com a MESMA altura dos cards: sem isso a tela pula quando os
     números chegam e o corretor toca no card errado. */
  if (!p) {
    return (
      <div style={{ ...S.wrap, ...S.grade }} aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} style={{ height: 76, borderRadius: 14, background: "#f3f0ee" }} />
        ))}
      </div>
    );
  }

  /* Ordem por urgência, não por beleza: o que cobra ação vem primeiro. */
  const cards = [
    { chave: "novos", valor: p.leads_novos, rotulo: p.leads_novos === 1 ? "lead novo" : "leads novos", destino: "/crm", alerta: p.leads_novos > 0 },
    { chave: "atrasados", valor: p.atrasados, rotulo: "atrasados", destino: "/crm", alerta: p.atrasados > 0 },
    { chave: "hoje", valor: p.acoes_hoje, rotulo: "para hoje", destino: "/crm", alerta: false },
    { chave: "visitas", valor: p.visitas_agendadas, rotulo: p.visitas_agendadas === 1 ? "visita marcada" : "visitas marcadas", destino: "/agenda", alerta: false },
    { chave: "base", valor: p.leads_base, rotulo: "na sua base", destino: "/crm", alerta: false },
  ];

  return (
    <section style={S.wrap} aria-label="Seus números">
      <p style={S.ola}>Olá, {primeiro}</p>

      <div style={S.grade}>
        {cards.map((c) => (
          <button
            key={c.chave}
            type="button"
            style={{
              ...S.card,
              ...(c.alerta ? { borderColor: "var(--orange,#f26a1b)", background: "var(--orange-soft,#fff4ec)" } : null),
            }}
            onClick={() => onIr(c.destino)}
          >
            <b style={{ ...S.valor, ...(c.alerta ? { color: "#b94300" } : null) }}>{c.valor}</b>
            <span style={S.rotulo}>{c.rotulo}</span>
          </button>
        ))}
      </div>

      {/* As notas ficam em faixa separada: são leitura, não fila de trabalho.
          Misturadas com os contadores acima, o corretor acharia que há algo
          para fazer com elas agora. */}
      <div style={S.notas}>
        <div style={S.nota}>
          <b style={S.valor}>{numero(p.nota_atendimento)}</b>
          <span style={S.rotulo}>nota de atendimento</span>
          <small style={{ fontSize: 11, color: "var(--muted,#6f6862)" }}>
            {p.nota_avaliacoes > 0
              ? `${p.nota_avaliacoes} conversas avaliadas em 30 dias`
              : "sem conversa avaliada ainda"}
          </small>
        </div>
        <div style={S.nota}>
          <b style={S.valor}>{numero(p.score_performance)}</b>
          <span style={S.rotulo}>score do mês</span>
          <small style={{ fontSize: 11, color: "var(--muted,#6f6862)" }}>
            {p.score_dia ? "atividade e resultado" : "sem cálculo ainda"}
          </small>
        </div>
      </div>

      <p style={S.rodape}>Relatórios e histórico completos ficam no ERP pelo navegador.</p>
    </section>
  );
}
