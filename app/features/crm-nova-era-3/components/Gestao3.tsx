"use client";
/**
 * GESTÃO — aba restrita.
 *
 * TUDO o que é operação interna vive AQUI e em lugar nenhum mais: entrada de
 * novos atendimentos, análise automática, reconciliação, adoção, carteira
 * antiga, saúde e desligamento de emergência.
 *
 * Quem atende lead nunca vê esta aba nem os termos dela. É o mesmo conteúdo
 * que já existia na "Visão gerencial" — reaproveitado, não reescrito.
 */
import { useEffect, useState } from "react";
import { GestaoOperacional, CadenciaConfig } from "../../crm-nova-era/components/GestaoOperacional";
import { PainelPiloto, DiagnosticoLegado } from "../../crm-nova-era/components/PainelPiloto";
import { PainelSaraRevisao } from "../../crm-nova-era/components/PainelSaraRevisao";
import { RolloutChecklist, AdocaoPainel } from "../../crm-nova-era/components/RolloutAdocao";
import { AcessoPilotos } from "../../crm-nova-era/components/AcessoPilotos";
import { CarteiraAntiga } from "../../crm-nova-era/components/CarteiraAntiga";
import { SaudeCrm } from "../../crm-nova-era/components/SaudeCrm";
import { FaseBanner } from "../../crm-nova-era/components/FaseBanner";
import { Manual3 } from "./Manual3";

type AbaGestao = "operacao" | "rollout" | "carteira" | "saude";

const ABAS: ReadonlyArray<{ id: AbaGestao; titulo: string; soAdmin: boolean }> = Object.freeze([
  { id: "operacao", titulo: "Operação", soAdmin: false },
  { id: "rollout", titulo: "Rollout e adoção", soAdmin: true },
  { id: "carteira", titulo: "Carteira antiga", soAdmin: true },
  { id: "saude", titulo: "Saúde", soAdmin: true },
]);

export function Gestao3({
  accessToken,
  papel,
  totalNoFunil,
  onDrillCorretor,
}: {
  accessToken: string;
  papel: string;
  totalNoFunil: number;
  onDrillCorretor: (corretorId: number) => void;
}) {
  const [aba, setAba] = useState<AbaGestao>("operacao");
  const ehAdmin = ["admin", "executivo"].includes(papel);
  const visiveis = ABAS.filter((a) => !a.soAdmin || ehAdmin);

  return (
    <div className="ncrm3-gestao">
      <div className="ncrm3-gestao-abas" role="tablist">
        {visiveis.map((a) => (
          <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} className={aba === a.id ? "on" : ""} onClick={() => setAba(a.id)}>
            {a.titulo}
          </button>
        ))}
      </div>

      {aba === "operacao" && (
        <>
          {ehAdmin && <FaseBanner accessToken={accessToken} souAdmin totalLeads={totalNoFunil} />}
          <MetricasGestao accessToken={accessToken} />
          <GestaoOperacional accessToken={accessToken} onDrill={onDrillCorretor} />
          {/* O manual que os corretores leem nos Avisos. Editar é só do admin —
              e quem barra de verdade é o banco (is_admin na função de salvar). */}
          <Manual3 accessToken={accessToken} podeEditar={ehAdmin} />
          {["admin", "executivo", "gerente"].includes(papel) && <DiagnosticoLegado accessToken={accessToken} />}
        </>
      )}

      {aba === "rollout" && ehAdmin && (
        <>
          <RolloutChecklist accessToken={accessToken} />
          <AdocaoPainel accessToken={accessToken} />
          <AcessoPilotos accessToken={accessToken} />
          <CadenciaConfig accessToken={accessToken} />
          {/* ACIMA do PainelPiloto de propósito: é lá que se muda o modo da
              Sara, e o placar precisa estar na frente de quem for encostar
              nesse botão. Julgar sugestão não move lead nenhum. */}
          <PainelSaraRevisao accessToken={accessToken} />
          <PainelPiloto accessToken={accessToken} />
        </>
      )}

      {aba === "carteira" && ehAdmin && <CarteiraAntiga accessToken={accessToken} />}
      {aba === "saude" && ehAdmin && <SaudeCrm accessToken={accessToken} />}
    </div>
  );
}

/** KPIs agregados da carteira autorizada. Mesma rota de métricas de sempre. */
function MetricasGestao({ accessToken }: { accessToken: string }) {
  const [m, setM] = useState<Record<string, number> | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void fetch(`/api/ncrm/metricas`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!vivo) return;
        if (ok) setM(j.metricas as Record<string, number>);
        else setErro((j.error as string) || "Não foi possível carregar as métricas.");
      })
      .catch(() => { if (vivo) setErro("Não foi possível carregar as métricas."); });
    return () => { vivo = false; };
  }, [accessToken]);

  if (erro) return <p className="ncrm3-nota">{erro}</p>;
  if (!m) return <p className="ncrm3-nota">Carregando os números da carteira…</p>;

  const kpis: Array<[string, number | string]> = [
    ["Carteira", m.total], ["Ativos", m.ativos], ["Taxa de resposta", `${m.taxa_resposta_pct}%`],
    ["Visitas agendadas", m.visitas_agendadas], ["Propostas (não venda)", m.propostas], ["Atrasados", m.atrasados],
    ["Sem próxima ação", m.sem_proxima_acao], ["Descartados", m.descartados], ["Nutrição", m.nutricao],
  ];

  return (
    <div className="ncrm3-kpis">
      {kpis.map(([k, v]) => (
        <article key={k} className="ncrm3-kpi"><b>{v}</b><span>{k}</span></article>
      ))}
    </div>
  );
}
