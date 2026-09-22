import { FiltrosTemperatura, type TemperaturaFiltro } from "./Funil2BoardPrimitives";
import type { LeadFunil2 } from "./modelo";

type Props = {
  aquario: number;
  busca: string;
  filtrosAbertos: boolean;
  ganhos: number;
  leads: LeadFunil2[];
  negociosVisiveis: number;
  ordenacao: "urgente" | "nome";
  perdidos: number;
  periodo: "30" | "90" | "todos";
  temperatura: TemperaturaFiltro;
  visao: "andamento" | "ganhos" | "perdidos" | "triagem";
  onAbrirEsteira: () => void;
  onAbrirSara: () => void;
  onBusca: (valor: string) => void;
  onFiltrosAbertos: (aberto: boolean) => void;
  onLimparFiltros: () => void;
  onOrdenacao: (valor: "urgente" | "nome") => void;
  onPeriodo: (valor: "30" | "90" | "todos") => void;
  onTemperatura: (valor: TemperaturaFiltro) => void;
  onVisao: (valor: Props["visao"]) => void;
};

export function Funil2BoardToolbar(props: Props) {
  const filtrosAtivos = Number(props.temperatura !== "todas") + Number(props.periodo !== "30");
  return <section className="f2-v3-toolbar" aria-label="Busca, filtros e ações do quadro">
    <div className="f2-v3-pipeline"><span>Pipeline</span><strong>Comercial</strong></div>
    <span className="f2-v3-separador" aria-hidden="true" />
    <div className="f2-v3-visoes" role="group" aria-label="Resumo acionável do pipeline">
      <button type="button" aria-pressed={props.visao === "andamento"} className={props.visao === "andamento" ? "ativo" : ""} onClick={() => props.onVisao("andamento")}><span>Em andamento</span><b>{props.negociosVisiveis}</b><small>etapas visíveis</small></button>
      <button type="button" aria-pressed={props.visao === "ganhos"} className={props.visao === "ganhos" ? "ativo" : ""} onClick={() => props.onVisao("ganhos")}><span>Ganhos</span><b>{props.ganhos}</b><small>fechados</small></button>
      <button type="button" aria-pressed={props.visao === "perdidos"} className={props.visao === "perdidos" ? "ativo" : ""} onClick={() => props.onVisao("perdidos")}><span>Perdidos</span><b>{props.perdidos}</b><small>encerrados</small></button>
      <button type="button" aria-pressed={props.visao === "triagem"} className={props.visao === "triagem" ? "ativo" : ""} onClick={() => props.onVisao("triagem")}><span>Triagem</span><b>{props.aquario}</b><small>aguardando análise</small></button>
    </div>
    {props.visao === "andamento" && <>
      <label className="f2-v3-busca"><span>Buscar</span><input type="search" value={props.busca} onChange={(evento) => props.onBusca(evento.target.value)} placeholder="Lead, telefone, nº ou interesse" /></label>
      {(props.busca || props.temperatura !== "todas" || props.periodo !== "30") && <button type="button" className="f2-v3-limpar" onClick={props.onLimparFiltros}>Limpar filtros</button>}
      <details className="f2-v3-filtros" open={props.filtrosAbertos} onToggle={(evento) => props.onFiltrosAbertos(evento.currentTarget.open)}><summary>Filtros{filtrosAtivos > 0 ? ` · ${filtrosAtivos}` : ""}</summary>{props.filtrosAbertos && <div className="f2-v3-filtro-painel">
        <FiltrosTemperatura leads={props.leads} valor={props.temperatura} onChange={props.onTemperatura} />
        <label><span>Ordenação</span><select aria-label="Ordenar negócios" value={props.ordenacao} onChange={(evento) => props.onOrdenacao(evento.target.value as Props["ordenacao"])}><option value="urgente">Atividade mais urgente</option><option value="nome">Nome do lead</option></select></label>
        <label><span>Período</span><select aria-label="Período do quadro" value={props.periodo} onChange={(evento) => props.onPeriodo(evento.target.value as Props["periodo"])}><option value="30">Últimos 30 dias · movimentação</option><option value="90">Últimos 90 dias · movimentação</option><option value="todos">Todo o período</option></select></label>
        <div className="f2-v3-filtro-acoes"><button type="button" onClick={props.onAbrirEsteira}>Abrir Esteira</button><button type="button" onClick={props.onAbrirSara}>Abrir Sara</button></div>
      </div>}</details>
    </>}
  </section>;
}
