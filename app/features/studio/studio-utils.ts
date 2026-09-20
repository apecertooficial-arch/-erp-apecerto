import type { StudioData, StudioMetric, StudioPieceVersion } from "./domain";

export type BoardFilters = { campaign?: string; format?: string; status?: string; responsavel?: string; revisor?: string; template?: string; period?: string; now?: Date };

export function filterBoardPieces(data: StudioData, filters: BoardFilters) {
  const now = filters.now ?? new Date();
  return data.pieces.filter((piece) => {
    const task = (data.tasks ?? []).find((item) => item.piece_id === piece.id);
    const version = data.versions.find((item) => item.id === piece.current_version_id);
    const due = task?.prazo_em ? new Date(task.prazo_em) : null;
    const periodOk = !filters.period || filters.period === "todos" || (filters.period === "sem_prazo" && !due) || (filters.period === "vencidos" && Boolean(due && due < now)) || (filters.period === "hoje" && Boolean(due && due.toDateString() === now.toDateString()));
    return (!filters.campaign || filters.campaign === "todos" || piece.campaign_id === filters.campaign) && (!filters.format || filters.format === "todos" || piece.formato === filters.format) && (!filters.status || filters.status === "todos" || piece.status === filters.status) && (!filters.responsavel || filters.responsavel === "todos" || task?.responsavel_id === filters.responsavel) && (!filters.revisor || filters.revisor === "todos" || task?.revisor_id === filters.revisor) && (!filters.template || filters.template === "todos" || version?.template_version_id === filters.template) && periodOk;
  });
}

export function aggregateStudioMetrics(rows: StudioMetric[]) {
  return rows.reduce((a, r) => ({ alcance: a.alcance + Number(r.alcance ?? 0), impressoes: a.impressoes + Number(r.impressoes ?? 0), curtidas: a.curtidas + Number(r.curtidas ?? 0), comentarios: a.comentarios + Number(r.comentarios ?? 0), compartilhamentos: a.compartilhamentos + Number(r.compartilhamentos ?? 0), salvamentos: a.salvamentos + Number(r.salvamentos ?? 0), cliques: a.cliques + Number(r.cliques ?? 0) }), { alcance: 0, impressoes: 0, curtidas: 0, comentarios: 0, compartilhamentos: 0, salvamentos: 0, cliques: 0 });
}

export function validCommentContext(version: StudioPieceVersion, kind: "geral" | "slide" | "cena", index: number | null) {
  if (kind === "geral") return index === null;
  if (!Number.isInteger(index) || index! < 0) return false;
  const key = kind === "slide" ? (Array.isArray(version.conteudo.slides) ? "slides" : "stories") : "cenas";
  const entries = version.conteudo[key];
  return Array.isArray(entries) && index! < entries.length;
}
