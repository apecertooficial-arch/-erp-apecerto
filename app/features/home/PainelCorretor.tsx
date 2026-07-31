"use client";
/* PAINEL DE INÍCIO — os números do corretor.
 *
 * O que ele responde, em três segundos: quanto eu tenho, quanto está atrasado,
 * o que é hoje, e como eu estou indo.
 *
 * REGRA DESTA TELA: número que não leva a lugar nenhum é enfeite. Todo card é
 * um atalho — tocar em "atrasados" abre a fila já filtrada. Sem isso o corretor
 * lê "22 atrasados", fica ansioso e não tem o que fazer com a informação.
 *
 * O que NÃO entra aqui: VGV, meta, ranking, funil e comparação com colega.
 * Isso é conversa de gestão e vive no ERP pelo navegador. O app existe para o
 * corretor trabalhar, não para se medir.
 *
 * As duas notas medem coisas diferentes de propósito. A de atendimento vem da
 * IA lendo as conversas (como ele atende) e muda de um dia para o outro. O
 * score vem da atividade e resultado do mês (quanto ele produz). Corretor
 * educado e parado tem nota alta e score baixo — e o contrário também acontece.
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
      <div className="pc-erro" role="alert">
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
      <div className="pc-grade" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className="pc-esq" />)}
      </div>
    );
  }

  /* Ordem por urgência, não por beleza: o que cobra ação vem primeiro. */
  const cards: Array<{ chave: string; valor: string; rotulo: string; destino: string; alerta?: boolean }> = [
    { chave: "novos", valor: String(p.leads_novos), rotulo: p.leads_novos === 1 ? "lead novo" : "leads novos", destino: "/crm", alerta: p.leads_novos > 0 },
    { chave: "atrasados", valor: String(p.atrasados), rotulo: "atrasados", destino: "/crm", alerta: p.atrasados > 0 },
    { chave: "hoje", valor: String(p.acoes_hoje), rotulo: "para hoje", destino: "/crm" },
    { chave: "visitas", valor: String(p.visitas_agendadas), rotulo: p.visitas_agendadas === 1 ? "visita marcada" : "visitas marcadas", destino: "/agenda" },
    { chave: "base", valor: String(p.leads_base), rotulo: "na sua base", destino: "/crm" },
  ];

  return (
    <section className="pc-wrap" aria-label="Seus números">
      <p className="pc-ola">Olá, {primeiro}</p>

      <div className="pc-grade">
        {cards.map((c) => (
          <button
            key={c.chave}
            type="button"
            className={`pc-card${c.alerta ? " alerta" : ""}`}
            onClick={() => onIr(c.destino)}
          >
            <b>{c.valor}</b>
            <span>{c.rotulo}</span>
          </button>
        ))}
      </div>

      {/* As notas ficam em uma faixa separada: são leitura, não fila de
          trabalho. Misturar com os contadores acima faria o corretor achar
          que há algo para fazer com elas agora. */}
      <div className="pc-notas">
        <div className="pc-nota">
          <b>{numero(p.nota_atendimento)}</b>
          <span>nota de atendimento</span>
          <small>
            {p.nota_avaliacoes > 0
              ? `${p.nota_avaliacoes} conversas avaliadas nos últimos 30 dias`
              : "sem conversa avaliada ainda"}
          </small>
        </div>
        <div className="pc-nota">
          <b>{numero(p.score_performance)}</b>
          <span>score do mês</span>
          <small>{p.score_dia ? "atividade e resultado" : "sem cálculo ainda"}</small>
        </div>
      </div>

      <p className="pc-rodape">
        Números completos, relatórios e histórico ficam no ERP pelo navegador.
      </p>
    </section>
  );
}
