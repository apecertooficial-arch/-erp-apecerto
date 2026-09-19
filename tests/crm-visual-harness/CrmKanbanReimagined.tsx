import { useState } from "react";
import logoApecerto from "../../public/brand/logo-cores.png";

const logoApecertoSrc = typeof logoApecerto === "string" ? logoApecerto : logoApecerto.src;

type Negocio = {
  id: string;
  nome: string;
  iniciais: string;
  imovel: string;
  corretor: string;
  acao: string;
  prazo: string;
  risco: "critico" | "atencao" | "ok";
  temperatura: "Quente" | "Morno" | "Negociando";
  valor: string;
  score: number;
};

const estagios: Array<{ nome: string; total: number; valor: string; cor: string; negocios: Negocio[] }> = [
  { nome: "Chegaram", total: 12, valor: "6 sem contato", cor: "#ff7134", negocios: [
    { id: "amanda", nome: "Cliente C", iniciais: "CC", imovel: "Jamariz · 2 dormitórios", corretor: "Corretora A", acao: "Fazer a primeira abordagem", prazo: "vence em 8 min", risco: "atencao", temperatura: "Quente", valor: "R$ 890 mil", score: 81 },
    { id: "marcos", nome: "Cliente F", iniciais: "CF", imovel: "Apartamento em Moema", corretor: "Corretora B", acao: "Confirmar faixa de valor", prazo: "há 14 min", risco: "critico", temperatura: "Morno", valor: "R$ 1,10 mi", score: 67 },
    { id: "luciana", nome: "Cliente G", iniciais: "CG", imovel: "Alphaville · 3 suítes", corretor: "Corretora A", acao: "Responder sobre a entrada", prazo: "vence em 22 min", risco: "atencao", temperatura: "Quente", valor: "R$ 1,68 mi", score: 88 },
  ]},
  { nome: "Conversando", total: 27, valor: "R$ 18,4 mi", cor: "#a953c1", negocios: [
    { id: "ricardo", nome: "Cliente D", iniciais: "CD", imovel: "Reserva Botânica · 110 m²", corretor: "Corretora B", acao: "Enviar duas opções", prazo: "há 2 horas", risco: "critico", temperatura: "Quente", valor: "R$ 1,40 mi", score: 86 },
    { id: "beatriz", nome: "Cliente H", iniciais: "CH", imovel: "Jamariz · unidade 84", corretor: "Corretora A", acao: "Retomar financiamento", prazo: "vence em 48 min", risco: "atencao", temperatura: "Morno", valor: "R$ 970 mil", score: 74 },
    { id: "eduardo", nome: "Cliente I", iniciais: "CI", imovel: "Moema · até R$ 1,4 mi", corretor: "Corretora B", acao: "Enviar cadência do dia 2", prazo: "hoje, 15h30", risco: "ok", temperatura: "Morno", valor: "R$ 1,35 mi", score: 58 },
  ]},
  { nome: "Visitaram", total: 8, valor: "4 sem feedback", cor: "#7656cf", negocios: [
    { id: "ana", nome: "Cliente A", iniciais: "CA", imovel: "Reserva Botânica · un. 112", corretor: "Corretora A", acao: "Registrar feedback completo", prazo: "há 1 dia", risco: "critico", temperatura: "Negociando", valor: "R$ 1,28 mi", score: 92 },
    { id: "paulo", nome: "Cliente E", iniciais: "CE", imovel: "Alphaville · unidade 31", corretor: "Corretora B", acao: "Confirmar a visita", prazo: "vence em 35 min", risco: "atencao", temperatura: "Quente", valor: "R$ 1,12 mi", score: 89 },
    { id: "fernanda", nome: "Cliente J", iniciais: "CJ", imovel: "Jamariz · unidade 63", corretor: "Corretora A", acao: "Decidir segunda visita", prazo: "amanhã, 10h", risco: "ok", temperatura: "Morno", valor: "R$ 940 mil", score: 72 },
  ]},
  { nome: "Negociando", total: 5, valor: "R$ 6,7 mi", cor: "#23936c", negocios: [
    { id: "gabriel", nome: "Cliente B", iniciais: "CB", imovel: "Reserva Botânica · un. 71", corretor: "Corretora B", acao: "Revisar proposta com gestor", prazo: "há 38 min", risco: "critico", temperatura: "Negociando", valor: "R$ 1,74 mi", score: 97 },
    { id: "renata", nome: "Cliente K", iniciais: "CK", imovel: "Alphaville · unidade 18", corretor: "Corretora A", acao: "Receber documentação", prazo: "hoje, 17h", risco: "ok", temperatura: "Negociando", valor: "R$ 1,52 mi", score: 90 },
  ]},
  { nome: "Fechando", total: 3, valor: "R$ 3,2 mi", cor: "#29222c", negocios: [
    { id: "carla", nome: "Cliente L", iniciais: "CL", imovel: "Jamariz · unidade 102", corretor: "Corretora B", acao: "Validar minuta do contrato", prazo: "hoje, 16h", risco: "ok", temperatura: "Negociando", valor: "R$ 1,08 mi", score: 96 },
    { id: "roberto", nome: "Cliente M", iniciais: "CM", imovel: "Moema · unidade 44", corretor: "Corretora A", acao: "Confirmar assinatura", prazo: "amanhã, 9h", risco: "ok", temperatura: "Negociando", valor: "R$ 1,34 mi", score: 94 },
  ]},
];

const todos = estagios.flatMap((estagio) => estagio.negocios);

export function CrmKanbanReimagined() {
  const [selecionadoId, setSelecionado] = useState("ana");
  const selecionado = todos.find((item) => item.id === selecionadoId) ?? todos[0]!;

  return <div className="reimagined-shell kanban-shell">
    <header className="reimagined-nav">
      <a className="reimagined-logo" href="#inicio" aria-label="apêcerto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoApecertoSrc} alt="apêcerto" />
      </a>
      <nav aria-label="Módulos do ERP"><button type="button" className="ativo">Operação</button><button type="button">Clientes</button><button type="button">Agenda</button><button type="button">Imóveis</button><button type="button">Financeiro</button><button type="button">Studio</button></nav>
      <div className="reimagined-nav-actions"><button type="button" className="reimagined-command-trigger"><span>⌕</span> Buscar em tudo <kbd>⌘ K</kbd></button><button type="button" className="reimagined-bell" aria-label="Notificações">♧<b>9</b></button><button type="button" className="reimagined-profile"><i>GT</i><span>Gestor teste<small>Gestor</small></span><b>⌄</b></button></div>
    </header>

    <main className="kanban-main">
      <header className="kanban-page-head">
        <div><span>CRM · PIPELINE ATIVO</span><h1>Jornada comercial</h1><p>Movimente negócios sem perder de vista o próximo passo.</p></div>
        <div className="kanban-page-actions"><button type="button">⚙ Configurar jornada</button><button type="button" className="primary">＋ Novo negócio</button></div>
      </header>

      <section className="kanban-kpis" aria-label="Indicadores do funil">
        <article className="wide"><header><span>VALOR DO PIPELINE</span><em>+12,4%</em></header><strong>R$ 28,3 mi</strong><p>55 negócios ativos</p><div className="kanban-spark"><i /><i /><i /><i /><i /><i /><i /><i /></div></article>
        <article><header><span>PRIMEIRA RESPOSTA</span><em className="warn">6 agora</em></header><div className="kanban-ring ring-orange"><strong>08<small>min</small></strong></div><p>meta: até 10 min</p></article>
        <article><header><span>VISITAS</span><em>+3</em></header><strong>8</strong><p>4 aguardam feedback</p><div className="kanban-mini-people"><i>AM</i><i>PR</i><i>FC</i><i>+5</i></div></article>
        <article><header><span>CONVERSÃO</span><em>+4,8%</em></header><strong>18,6%</strong><p>lead → visita</p><div className="kanban-progress"><i style={{ width: "74%" }} /></div></article>
        <article className="health"><header><span>Saúde do funil</span><i className="live-dot" /></header><div><strong>84</strong><small>/100</small></div><p>Boa · 9 ações vencidas</p></article>
      </section>

      <section className="kanban-toolbar">
        <div className="kanban-pipeline"><small>PIPELINE</small><button type="button">Comercial principal <span>⌄</span></button></div>
        <nav><button type="button" className="ativo">Quadro</button><button type="button">Foco <b>8</b></button><button type="button">Lista</button></nav>
        <div><button type="button">Hoje⌄</button><button type="button">Todos os corretores⌄</button><button type="button">Filtros <b>2</b></button></div>
      </section>

      <section className="kanban-selected-bar" aria-label={`Negócio selecionado: ${selecionado.nome}`} key={selecionado.id}>
        <span className="kanban-selected-person"><i>{selecionado.iniciais}</i><span><small>EM FOCO</small><strong>{selecionado.nome}</strong></span></span>
        <span><small>PRÓXIMA AÇÃO</small><strong>{selecionado.acao}</strong></span>
        <span><small>CHANCE DE AVANÇO</small><strong>{selecionado.score}%</strong></span>
        <span><small>VALOR</small><strong>{selecionado.valor}</strong></span>
        <div><button type="button" className="whatsapp">● WhatsApp</button><button type="button">Abrir atendimento ↗</button></div>
      </section>

      <section className="kanban-stage-grid" aria-label="Kanban comercial">
        {estagios.map((estagio) => <article className="kanban-stage" key={estagio.nome} style={{ "--stage-color": estagio.cor } as React.CSSProperties}>
          <header><span className="kanban-stage-mark"><i /><span><strong>{estagio.nome}</strong><small>{estagio.valor}</small></span></span><b>{estagio.total}</b><button type="button" aria-label={`Adicionar em ${estagio.nome}`}>＋</button></header>
          <div className="kanban-card-list">
            {estagio.negocios.map((negocio) => <button type="button" key={negocio.id} className={`kanban-card${selecionado.id === negocio.id ? " selecionado" : ""}`} onClick={() => setSelecionado(negocio.id)} aria-pressed={selecionado.id === negocio.id}>
              <div className="kanban-card-person"><i>{negocio.iniciais}</i><span><strong>{negocio.nome}</strong><small>{negocio.imovel}</small></span><em className={`risk-${negocio.risco}`}>{negocio.prazo}</em></div>
              <div className="kanban-next"><small>PRÓXIMA AÇÃO</small><strong>{negocio.acao}</strong></div>
              <footer><span>{negocio.corretor}</span><em>{negocio.temperatura}</em><b>{negocio.valor}</b></footer>
            </button>)}
            <button type="button" className="kanban-more">Ver mais {Math.max(0,estagio.total - estagio.negocios.length)}</button>
          </div>
        </article>)}
      </section>
    </main>
  </div>;
}
