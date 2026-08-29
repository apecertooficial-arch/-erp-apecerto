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
  onOrdenacao: (valor: "urgente" | "nome") => void;
  onPeriodo: (valor: "30" | "90" | "todos") => void;
  onTemperatura: (valor: TemperaturaFiltro) => void;
  onVisao: (valor: Props["visao"]) => void;
};

export function Funil2BoardToolbar(props: Props) {
  return <section className="f2-v3-toolbar" aria-label="Busca, filtros e ações do quadro">
    <label className="f2-v3-pipeline"><span>Pipeline</span><select aria-label="Pipeline" value="comercial" onChange={() => undefined}><option value="comercial">Comercial</option></select></label>
    <span className="f2-v3-separador" aria-hidden="true" />
    <div className="f2-v3-visoes" role="group" aria-label="Situação dos negócios">
      <button type="button" className={props.visao === "andamento" ? "ativo" : ""} onClick={() => props.onVisao("andamento")}>Em andamento <b>{props.negociosVisiveis}</b></button>
      <button type="button" className={props.visao === "ganhos" ? "ativo" : ""} onClick={() => props.onVisao("ganhos")}>Ganhos <b>{props.ganhos}</b></button>
      <button type="button" className={props.visao === "perdidos" ? "ativo" : ""} onClick={() => props.onVisao("perdidos")}>Perdidos <b>{props.perdidos}</b></button>
      <button type="button" className={props.visao === "triagem" ? "ativo" : ""} onClick={() => props.onVisao("triagem")}>Triagem <b>{props.aquario}</b></button>
    </div>
    <label className="f2-v3-busca"><span>Buscar</span><input type="search" value={props.busca} onChange={(evento) => props.onBusca(evento.target.value)} placeholder="Lead, telefone, nº ou interesse" /></label>
    <details className="f2-v3-filtros" open={props.filtrosAbertos} onToggle={(evento) => props.onFiltrosAbertos(evento.currentTarget.open)}><summary>Filtros{props.temperatura !== "todas" ? " · 1" : ""}</summary>{props.filtrosAbertos && <div className="f2-v3-filtro-painel">
      <FiltrosTemperatura leads={props.leads} valor={props.temperatura} onChange={props.onTemperatura} />
      <label><span>Ordenação</span><select aria-label="Ordenar negócios" value={props.ordenacao} onChange={(evento) => props.onOrdenacao(evento.target.value as Props["ordenacao"])}><option value="urgente">Atividade mais urgente</option><option value="nome">Nome do lead</option></select></label>
      <label><span>Período</span><select aria-label="Período do quadro" value={props.periodo} onChange={(evento) => props.onPeriodo(evento.target.value as Props["periodo"])}><option value="30">Últimos 30 dias · movimentação</option><option value="90">Últimos 90 dias · movimentação</option><option value="todos">Todo o período</option></select></label>
      <div className="f2-v3-filtro-acoes"><button type="button" onClick={props.onAbrirEsteira}>Abrir Esteira</button><button type="button" onClick={props.onAbrirSara}>Abrir Sara</button></div>
    </div>}</details>
  </section>;
}
