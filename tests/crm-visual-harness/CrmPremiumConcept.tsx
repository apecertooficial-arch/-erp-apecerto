import { useEffect, useMemo, useState, type ReactNode } from "react";

type LeadConceito = {
  id: string;
  nome: string;
  iniciais: string;
  produto: string;
  corretor: string;
  temperatura: "Quente" | "Morno" | "Frio" | "Negociando";
  temperaturaClasse: string;
  proximaAcao: string;
  prazo: string;
  prazoClasse: "critico" | "atencao" | "ok";
  etapa: string;
  momento: string;
  qualidade: number;
  resumo: string;
  ultimaInteracao: string;
};

const colunas: Array<{ titulo: string; total: number; valor: string; tom: string; leads: LeadConceito[] }> = [
  {
    titulo: "Leads novos", total: 12, valor: "há menos de 24h", tom: "laranja",
    leads: [
      { id: "amanda", nome: "Cliente C", iniciais: "CC", produto: "Jamariz · 2 dormitórios", corretor: "Corretora A", temperatura: "Quente", temperaturaClasse: "quente", proximaAcao: "Fazer primeira abordagem", prazo: "vence em 8 min", prazoClasse: "atencao", etapa: "Lead novo", momento: "Primeira abordagem", qualidade: 0, resumo: "Lead recém-chegado da campanha Jamariz. Ainda não existe conversa suficiente para avaliação.", ultimaInteracao: "Cadastro recebido agora" },
      { id: "marcos", nome: "Cliente F", iniciais: "CF", produto: "Apartamento em Moema", corretor: "Corretora B", temperatura: "Morno", temperaturaClasse: "morno", proximaAcao: "Confirmar interesse e faixa de valor", prazo: "há 14 min", prazoClasse: "critico", etapa: "Lead novo", momento: "Aguardando contato", qualidade: 0, resumo: "Novo cadastro com interesse amplo. A Sara aguarda o primeiro contato para definir o próximo passo.", ultimaInteracao: "Cadastro recebido há 14 min" },
      { id: "luciana", nome: "Cliente G", iniciais: "CG", produto: "Alphaville · 3 suítes", corretor: "Corretora A", temperatura: "Quente", temperaturaClasse: "quente", proximaAcao: "Responder pergunta sobre entrada", prazo: "vence em 22 min", prazoClasse: "atencao", etapa: "Lead novo", momento: "Primeira resposta", qualidade: 8.2, resumo: "A cliente perguntou sobre entrada e disponibilidade. Resposta rápida aumenta a chance de visita.", ultimaInteracao: "Mensagem recebida há 3 min" },
    ],
  },
  {
    titulo: "Em atendimento", total: 27, valor: "R$ 18,4 mi", tom: "roxo",
    leads: [
      { id: "ricardo", nome: "Cliente D", iniciais: "CD", produto: "Reserva Botânica · 110 m²", corretor: "Corretora B", temperatura: "Quente", temperaturaClasse: "quente", proximaAcao: "Enviar duas opções compatíveis", prazo: "há 2h", prazoClasse: "critico", etapa: "Em atendimento", momento: "Escolhendo produto", qualidade: 7.8, resumo: "Cliente respondeu sobre localização e orçamento, mas ainda não recebeu as duas opções prometidas.", ultimaInteracao: "Cliente respondeu hoje, 09:42" },
      { id: "beatriz", nome: "Cliente H", iniciais: "CH", produto: "Jamariz · unidade 84", corretor: "Corretora A", temperatura: "Morno", temperaturaClasse: "morno", proximaAcao: "Retomar conversa sobre financiamento", prazo: "vence em 48 min", prazoClasse: "atencao", etapa: "Em atendimento", momento: "Analisando condições", qualidade: 8.9, resumo: "Bom atendimento. Falta confirmar o valor disponível para entrada antes de indicar nova unidade.", ultimaInteracao: "Conversa pausada há 1h" },
      { id: "eduardo", nome: "Cliente I", iniciais: "CI", produto: "Moema · até R$ 1,4 mi", corretor: "Corretora B", temperatura: "Frio", temperaturaClasse: "frio", proximaAcao: "Enviar cadência do dia 2", prazo: "hoje, 15:30", prazoClasse: "ok", etapa: "Em atendimento", momento: "Sem resposta", qualidade: 9.1, resumo: "A primeira abordagem foi correta e completa. Cliente ainda não respondeu; manter cadência sem antecipar descarte.", ultimaInteracao: "Mensagem enviada ontem, 16:10" },
    ],
  },
  {
    titulo: "Visita e pós-visita", total: 8, valor: "4 sem feedback", tom: "vinho",
    leads: [
      { id: "ana", nome: "Cliente A", iniciais: "CA", produto: "Reserva Botânica · unidade 112", corretor: "Corretora A", temperatura: "Negociando", temperaturaClasse: "negociando", proximaAcao: "Registrar feedback completo da visita", prazo: "há 1 dia", prazoClasse: "critico", etapa: "Pós-visita", momento: "Aguardando feedback", qualidade: 6.4, resumo: "A visita aconteceu ontem com acompanhante. O casal gostou da planta, mas a objeção sobre entrada ainda não foi registrada com clareza.", ultimaInteracao: "Visita realizada ontem, 16:00" },
      { id: "paulo", nome: "Cliente E", iniciais: "CE", produto: "Alphaville · unidade 31", corretor: "Corretora B", temperatura: "Quente", temperaturaClasse: "quente", proximaAcao: "Confirmar presença na visita", prazo: "vence em 35 min", prazoClasse: "atencao", etapa: "Visita", momento: "Visita agendada", qualidade: 9.3, resumo: "Cliente confirmou interesse e irá acompanhado. Falta apenas a confirmação final do horário e local de encontro.", ultimaInteracao: "Visita hoje, 18:30" },
      { id: "fernanda", nome: "Cliente J", iniciais: "CJ", produto: "Jamariz · unidade 63", corretor: "Corretora A", temperatura: "Morno", temperaturaClasse: "morno", proximaAcao: "Cobrar decisão sobre segunda visita", prazo: "amanhã, 10:00", prazoClasse: "ok", etapa: "Pós-visita", momento: "Comparando opções", qualidade: 8.7, resumo: "Cliente gostou do imóvel, mas quer comparar com outra unidade. Próxima conversa deve buscar uma decisão explícita.", ultimaInteracao: "Feedback registrado hoje, 08:20" },
    ],
  },
  {
    titulo: "Negociação", total: 5, valor: "R$ 6,7 mi", tom: "verde",
    leads: [
      { id: "gabriel", nome: "Cliente B", iniciais: "CB", produto: "Reserva Botânica · unidade 71", corretor: "Corretora B", temperatura: "Negociando", temperaturaClasse: "negociando", proximaAcao: "Revisar proposta com o gerente", prazo: "há 38 min", prazoClasse: "critico", etapa: "Negociação", momento: "Proposta enviada", qualidade: 9.5, resumo: "Proposta formal enviada. Cliente sinalizou limite de entrada; gestor deve revisar a condição antes do próximo contato.", ultimaInteracao: "Proposta recebida hoje, 10:18" },
      { id: "renata", nome: "Cliente K", iniciais: "CK", produto: "Alphaville · unidade 18", corretor: "Corretora A", temperatura: "Negociando", temperaturaClasse: "negociando", proximaAcao: "Receber documentação pendente", prazo: "hoje, 17:00", prazoClasse: "ok", etapa: "Negociação", momento: "Documentação", qualidade: 9.2, resumo: "Negociação evoluindo. Falta comprovante de renda para enviar o dossiê completo à análise.", ultimaInteracao: "Documento recebido hoje, 11:06" },
      { id: "carlos", nome: "Cliente L", iniciais: "CL", produto: "Jamariz · unidade 102", corretor: "Corretora B", temperatura: "Quente", temperaturaClasse: "quente", proximaAcao: "Confirmar aceite da contraproposta", prazo: "amanhã, 09:00", prazoClasse: "ok", etapa: "Negociação", momento: "Contraproposta", qualidade: 8.6, resumo: "O cliente recebeu a contraproposta e pediu prazo até amanhã. Não antecipar contato antes do combinado.", ultimaInteracao: "Conversa encerrada hoje, 11:32" },
    ],
  },
];

function Icone({ children }: { children: ReactNode }) {
  return <span className="premium-icon" aria-hidden="true">{children}</span>;
}

export function CrmPremiumConcept() {
  const todos = useMemo(() => colunas.flatMap((coluna) => coluna.leads), []);
  const [selecionadoId, setSelecionado] = useState("ana");
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const selecionado = todos.find((lead) => lead.id === selecionadoId) ?? todos[0]!;
  const resultadosCommand = useMemo(() => {
    const termo = commandQuery.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return todos.slice(0, 5);
    return todos.filter((lead) => `${lead.nome} ${lead.produto} ${lead.corretor} ${lead.etapa}`.toLocaleLowerCase("pt-BR").includes(termo)).slice(0, 5);
  }, [commandQuery, todos]);

  useEffect(() => {
    const abrirBusca = (evento: KeyboardEvent) => {
      if ((evento.metaKey || evento.ctrlKey) && evento.key.toLowerCase() === "k") {
        evento.preventDefault(); setCommandOpen(true);
      }
      if (evento.key === "Escape") setCommandOpen(false);
    };
    window.addEventListener("keydown", abrirBusca);
    return () => window.removeEventListener("keydown", abrirBusca);
  }, []);

  return <div className="premium-crm-shell">
    <aside className="premium-rail" aria-label="Navegação principal">
      <button type="button" className="premium-brand" aria-label="ApeCerto">a</button>
      <nav>
        <button type="button" aria-label="Início"><Icone>⌂</Icone></button>
        <button type="button" className="ativo" aria-label="CRM"><Icone>◇</Icone><i /></button>
        <button type="button" aria-label="Agenda"><Icone>□</Icone></button>
        <button type="button" aria-label="Produtos"><Icone>⌑</Icone></button>
        <button type="button" aria-label="Inteligência"><Icone>✦</Icone></button>
        <button type="button" aria-label="Financeiro"><Icone>◫</Icone></button>
      </nav>
      <div className="premium-rail-bottom">
        <button type="button" aria-label="Avisos"><Icone>♧</Icone><b>9</b></button>
        <button type="button" aria-label="Configurações"><Icone>⚙</Icone></button>
        <span className="premium-user">S</span>
      </div>
    </aside>

    <main className="premium-workspace">
      <header className="premium-topbar">
        <div>
          <span className="premium-kicker">CRM · OPERAÇÃO COMERCIAL</span>
          <h1>Central comercial</h1>
          <p>O que precisa de atenção para nenhum negócio ser esquecido.</p>
        </div>
        <div className="premium-top-actions">
          <span className="premium-live-status"><i />Operação ao vivo <b>3</b></span>
          <label className="premium-search"><span aria-hidden="true">⌕</span><input aria-label="Buscar cliente" readOnly onFocus={() => setCommandOpen(true)} placeholder="Buscar cliente, produto ou corretor" /><kbd>⌘ K</kbd></label>
          <button type="button" className="premium-notification" aria-label="Notificações">♧<b>9</b></button>
          <button type="button" className="premium-avatar" aria-label="Perfil do gestor de teste">GT</button>
        </div>
      </header>

      <section className="premium-priorities" aria-label="Prioridades operacionais">
        <article className="critico"><span>PRIMEIRA RESPOSTA</span><div><span className="premium-kpi-ring"><strong>6</strong></span><p>leads esperando<br />há mais de 10 minutos</p></div><button type="button">Atender agora <b>→</b></button></article>
        <article className="atrasado"><span>PRÓXIMAS AÇÕES</span><div><span className="premium-kpi-ring"><strong>9</strong></span><p>compromissos vencidos<br />exigem decisão</p></div><button type="button">Ver fila <b>→</b></button></article>
        <article className="visita"><span>VISITAS SEM FEEDBACK</span><div><span className="premium-kpi-ring"><strong>4</strong></span><p>clientes visitaram<br />e continuam sem direção</p></div><button type="button">Cobrar corretores <b>→</b></button></article>
        <article className="proposta"><span>NEGOCIAÇÕES</span><div><span className="premium-kpi-ring"><strong>3</strong></span><p>propostas aguardam<br />movimento do gerente</p></div><button type="button">Acompanhar <b>→</b></button></article>
      </section>

      <section className="premium-board-section">
        <header className="premium-board-toolbar">
          <div className="premium-pipeline-select"><small>PIPELINE</small><button type="button">Comercial principal <span>⌄</span></button></div>
          <nav aria-label="Situação dos negócios"><button type="button" className="ativo">Em andamento <b>52</b></button><button type="button">Ganhos <b>8</b></button><button type="button">Perdidos <b>3</b></button></nav>
          <div className="premium-board-actions"><button type="button">Últimos 30 dias⌄</button><button type="button">Filtros <b>2</b></button><button type="button" className="novo">＋ Novo negócio</button></div>
        </header>

        <div className="premium-board" aria-label="Quadro comercial">
          {colunas.map((coluna) => <section className={`premium-column tom-${coluna.tom}`} key={coluna.titulo}>
            <header><i /><div><h2>{coluna.titulo}</h2><span>{coluna.valor}</span></div><b>{coluna.total}</b><button type="button" aria-label={`Adicionar em ${coluna.titulo}`}>＋</button></header>
            <div className="premium-column-list">
              {coluna.leads.map((lead) => <button type="button" className={`premium-lead-card${selecionado.id === lead.id ? " selecionado" : ""}`} onClick={() => setSelecionado(lead.id)} key={lead.id} aria-pressed={selecionado.id === lead.id}>
                <div className="premium-card-head"><span className="premium-card-avatar">{lead.iniciais}</span><div><strong>{lead.nome}</strong><small>{lead.produto}</small></div><em className={`prazo-${lead.prazoClasse}`}>{lead.prazo}</em></div>
                <div className="premium-card-next"><span>PRÓXIMA AÇÃO</span><strong>{lead.proximaAcao}</strong></div>
                <footer><span>{lead.corretor}</span><i className={`temperatura-${lead.temperaturaClasse}`}>{lead.temperatura}</i><b aria-hidden="true">›</b></footer>
              </button>)}
              <button type="button" className="premium-more">Ver mais {Math.max(0, coluna.total - coluna.leads.length)} negócios</button>
            </div>
          </section>)}
        </div>
      </section>
    </main>

    <aside className="premium-detail" aria-label={`Ficha de ${selecionado.nome}`}>
      <header className="premium-detail-head">
        <div className="premium-detail-caption"><span>CLIENTE SELECIONADO</span><button type="button" aria-label="Fechar ficha">×</button></div>
        <div className="premium-detail-person"><span>{selecionado.iniciais}</span><div><h2>{selecionado.nome}</h2><p>{selecionado.produto}</p></div></div>
        <div className="premium-detail-actions"><button type="button" className="whatsapp">● WhatsApp</button><button type="button">Agendar visita</button><button type="button" aria-label="Mais ações">•••</button></div>
      </header>

      <div className="premium-detail-scroll" key={selecionado.id}>
        <section className="premium-sara">
          <header><div><i>✦</i><span><b>Leitura da Sara</b><small>atualizada agora</small></span></div><em>IA operacional</em></header>
          <p>{selecionado.resumo}</p>
          <div className="premium-sara-grid">
            <span><small>ETAPA</small><b>{selecionado.etapa}</b></span>
            <span><small>MOMENTO</small><b>{selecionado.momento}</b></span>
            <span><small>TEMPERATURA</small><b className={`temperatura-${selecionado.temperaturaClasse}`}>{selecionado.temperatura}</b></span>
            <span><small>QUALIDADE DO ATENDIMENTO</small><b>{selecionado.qualidade ? `${selecionado.qualidade.toFixed(1)} / 10` : "Aguardando conversa"}</b></span>
          </div>
        </section>

        <section className={`premium-next-action acao-${selecionado.prazoClasse}`}>
          <div><span>PRÓXIMA AÇÃO RECOMENDADA</span><h3>{selecionado.proximaAcao}</h3><p>{selecionado.prazo}</p></div>
          <button type="button">Concluir ação</button>
        </section>

        <section className="premium-context">
          <header><h3>Contexto do atendimento</h3><button type="button">Ver conversa</button></header>
          <dl>
            <div><dt>Última interação</dt><dd>{selecionado.ultimaInteracao}</dd></div>
            <div><dt>Corretor responsável</dt><dd>{selecionado.corretor}</dd></div>
            <div><dt>Contato</dt><dd>WhatsApp conectado · final ••42</dd></div>
          </dl>
        </section>

        <section className="premium-timeline">
          <header><h3>Linha do tempo</h3><button type="button">Ver tudo</button></header>
          <article><i className="humano" /><div><strong>{selecionado.ultimaInteracao}</strong><span>Atualização registrada na operação</span></div></article>
          <article><i className="sara" /><div><strong>Sara avaliou a conversa</strong><span>Momento, temperatura e próxima ação atualizados</span></div></article>
          <article><i /><div><strong>Lead entrou no pipeline Comercial</strong><span>Origem e campanha preservadas</span></div></article>
        </section>
      </div>

      <footer className="premium-detail-footer"><button type="button">Abrir atendimento completo</button></footer>
    </aside>

    {commandOpen && <div className="premium-command-layer" onMouseDown={(evento) => { if (evento.target === evento.currentTarget) setCommandOpen(false); }}>
      <section className="premium-command" role="dialog" aria-modal="true" aria-label="Busca global">
        <header><span>⌕</span><input autoFocus value={commandQuery} onChange={(evento) => setCommandQuery(evento.target.value)} placeholder="Busque cliente, produto, corretor ou ação…" /><kbd>ESC</kbd></header>
        <div className="premium-command-quick"><span>AÇÕES RÁPIDAS</span><nav><button type="button">＋ Novo negócio</button><button type="button">□ Agendar visita</button><button type="button">◉ Registrar feedback</button></nav></div>
        <div className="premium-command-results">
          <span>{commandQuery ? "RESULTADOS" : "CLIENTES RECENTES"}</span>
          {resultadosCommand.map((lead) => <button type="button" key={lead.id} onClick={() => { setSelecionado(lead.id); setCommandOpen(false); setCommandQuery(""); }}><i>{lead.iniciais}</i><div><strong>{lead.nome}</strong><small>{lead.produto} · {lead.corretor}</small></div><em className={`temperatura-${lead.temperaturaClasse}`}>{lead.temperatura}</em><b>↵</b></button>)}
          {resultadosCommand.length === 0 && <p>Nenhum cliente encontrado nesta busca.</p>}
        </div>
        <footer><span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>↵</kbd> abrir</span><span><kbd>esc</kbd> fechar</span></footer>
      </section>
    </div>}
  </div>;
}
