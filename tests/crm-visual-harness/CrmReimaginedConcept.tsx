import { useEffect, useMemo, useState } from "react";
import logoApecerto from "../../public/brand/logo-cores.png";

const logoApecertoSrc = typeof logoApecerto === "string" ? logoApecerto : logoApecerto.src;

type Prioridade = {
  id: string;
  nome: string;
  iniciais: string;
  acao: string;
  contexto: string;
  prazo: string;
  corretor: string;
  etapa: string;
  temperatura: string;
  tom: "vermelho" | "laranja" | "roxo" | "verde";
  score: number;
  valor: string;
  resumo: string;
};

const prioridades: Prioridade[] = [
  { id: "ana", nome: "Cliente A", iniciais: "CA", acao: "Registrar o feedback da visita", contexto: "Visitou o Reserva Botânica com acompanhante", prazo: "1 dia em atraso", corretor: "Corretora A", etapa: "Pós-visita", temperatura: "Negociando", tom: "vermelho", score: 92, valor: "R$ 1,28 mi", resumo: "O casal gostou da planta, mas a objeção sobre a entrada ainda não foi registrada. A Sara recomenda transformar a conversa em uma decisão explícita hoje." },
  { id: "gabriel", nome: "Cliente B", iniciais: "CB", acao: "Revisar a proposta com o gerente", contexto: "Contraproposta pronta para aprovação", prazo: "38 min em atraso", corretor: "Corretora B", etapa: "Negociação", temperatura: "Muito quente", tom: "laranja", score: 97, valor: "R$ 1,74 mi", resumo: "O cliente sinalizou o limite de entrada e aguarda retorno. Há alta intenção e risco de perda se a condição não for validada ainda nesta manhã." },
  { id: "amanda", nome: "Cliente C", iniciais: "CC", acao: "Fazer a primeira abordagem", contexto: "Lead novo da campanha Jamariz", prazo: "vence em 8 min", corretor: "Corretora A", etapa: "Lead novo", temperatura: "Quente", tom: "roxo", score: 81, valor: "R$ 890 mil", resumo: "Lead recém-chegado com interesse definido. A primeira resposta dentro do prazo preserva a chance de agendar uma visita ainda neste fim de semana." },
  { id: "ricardo", nome: "Cliente D", iniciais: "CD", acao: "Enviar as duas opções prometidas", contexto: "Procura 110 m² próximo de Moema", prazo: "2 horas em atraso", corretor: "Corretora B", etapa: "Atendimento", temperatura: "Quente", tom: "vermelho", score: 86, valor: "R$ 1,40 mi", resumo: "O cliente respondeu localização e orçamento. As opções prometidas ainda não foram enviadas, então a conversa perdeu ritmo." },
  { id: "paulo", nome: "Cliente E", iniciais: "CE", acao: "Confirmar presença na visita", contexto: "Visita hoje às 18h30 em Alphaville", prazo: "vence em 35 min", corretor: "Corretora B", etapa: "Visita", temperatura: "Quente", tom: "verde", score: 89, valor: "R$ 1,12 mi", resumo: "O cliente confirmou interesse e irá acompanhado. Falta apenas validar o horário e enviar o ponto de encontro." },
];

const etapas = [
  { nome: "Chegaram", total: 12, detalhe: "6 aguardam contato", tom: "#ff7635" },
  { nome: "Conversando", total: 27, detalhe: "9 ações vencidas", tom: "#b56bd1" },
  { nome: "Visitaram", total: 8, detalhe: "4 sem feedback", tom: "#7656cf" },
  { nome: "Negociando", total: 5, detalhe: "R$ 6,7 mi", tom: "#21946b" },
  { nome: "Fechando", total: 3, detalhe: "documentos e contrato", tom: "#24202a" },
];

export function CrmReimaginedConcept() {
  const [selecionadoId, setSelecionado] = useState("ana");
  const [commandOpen, setCommandOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const selecionado = prioridades.find((item) => item.id === selecionadoId) ?? prioridades[0]!;
  const resultados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return prioridades.filter((item) => !termo || `${item.nome} ${item.acao} ${item.corretor}`.toLocaleLowerCase("pt-BR").includes(termo));
  }, [busca]);

  useEffect(() => {
    const atalho = (evento: KeyboardEvent) => {
      if ((evento.metaKey || evento.ctrlKey) && evento.key.toLowerCase() === "k") {
        evento.preventDefault();
        setCommandOpen(true);
      }
      if (evento.key === "Escape") setCommandOpen(false);
    };
    window.addEventListener("keydown", atalho);
    return () => window.removeEventListener("keydown", atalho);
  }, []);

  return <div className="reimagined-shell">
    <header className="reimagined-nav">
      <a className="reimagined-logo" href="#inicio" aria-label="apêcerto">
        {/* Harness Vite isolado: a otimização de imagem pertence à integração posterior no app Next. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoApecertoSrc} alt="apêcerto" />
      </a>
      <nav aria-label="Módulos do ERP">
        <button type="button" className="ativo">Operação</button>
        <button type="button">Clientes</button>
        <button type="button">Agenda</button>
        <button type="button">Imóveis</button>
        <button type="button">Financeiro</button>
        <button type="button">Studio</button>
      </nav>
      <div className="reimagined-nav-actions">
        <button type="button" className="reimagined-command-trigger" onClick={() => setCommandOpen(true)}><span>⌕</span> Buscar em tudo <kbd>⌘ K</kbd></button>
        <button type="button" className="reimagined-bell" aria-label="Notificações">♧<b>9</b></button>
        <button type="button" className="reimagined-profile"><i>GT</i><span>Gestor teste<small>Gestor</small></span><b>⌄</b></button>
      </div>
    </header>

    <main className="reimagined-main">
      <section className="reimagined-hero">
        <div className="reimagined-hero-copy">
          <span className="reimagined-eyebrow">CRM · SÁBADO, 19 DE SETEMBRO</span>
          <h1>Bom dia, Gestor.<br /><em>Vamos fechar o que ficou aberto.</em></h1>
        </div>
        <div className="reimagined-hero-live">
          <span className="reimagined-orbit"><i>✦</i><b /></span>
          <div><small>SARA ESTÁ ACOMPANHANDO</small><strong>3 movimentos agora</strong><p>Uma proposta, uma visita e um lead novo pedem atenção.</p></div>
          <button type="button" aria-label="Ouvir resumo da Sara">▶</button>
        </div>
      </section>

      <div className="reimagined-viewbar">
        <nav aria-label="Visualização do CRM"><button type="button" className="ativo"><i>✦</i> Central de foco <b>8</b></button><button type="button">Jornada</button><button type="button">Carteira</button><button type="button">Visitas</button></nav>
        <div><span className="reimagined-online"><i /> Operação ao vivo</span><button type="button">Hoje⌄</button><button type="button">Todos os corretores⌄</button><button type="button" className="reimagined-new">＋ Novo cliente</button></div>
      </div>

      <section className="reimagined-focus-grid">
        <article className="reimagined-queue">
          <header>
            <div><span>O QUE NÃO PODE ESPERAR</span><h2>8 prioridades pedem decisão</h2><p>Ordenadas por risco, intenção de compra e tempo sem resposta.</p></div>
            <button type="button">Ver todas <b>→</b></button>
          </header>
          <div className="reimagined-queue-list">
            {prioridades.map((item, indice) => <button type="button" key={item.id} className={`reimagined-queue-item tom-${item.tom}${selecionado.id === item.id ? " selecionado" : ""}`} onClick={() => setSelecionado(item.id)} aria-pressed={selecionado.id === item.id}>
              <span className="reimagined-rank">{String(indice + 1).padStart(2, "0")}</span>
              <i className="reimagined-person">{item.iniciais}</i>
              <span className="reimagined-queue-person"><strong>{item.nome}</strong><small>{item.contexto}</small></span>
              <span className="reimagined-queue-action"><small>PRÓXIMA AÇÃO</small><strong>{item.acao}</strong></span>
              <span className="reimagined-deadline"><i />{item.prazo}</span>
              <b className="reimagined-arrow">↗</b>
            </button>)}
          </div>
        </article>

        <aside className="reimagined-side-stack">
          <article className="reimagined-spotlight" key={selecionado.id}>
            <header><span>ATENDIMENTO EM FOCO</span><button type="button">•••</button></header>
            <div className="reimagined-spotlight-person"><i>{selecionado.iniciais}</i><div><h2>{selecionado.nome}</h2><p>{selecionado.corretor} · {selecionado.etapa}</p></div><em>{selecionado.temperatura}</em></div>
            <div className="reimagined-sara-summary"><span><i>✦</i> Resumo da Sara</span><p>{selecionado.resumo}</p></div>
            <div className="reimagined-spotlight-stats"><span><small>CHANCE DE AVANÇO</small><strong>{selecionado.score}%</strong></span><span><small>VALOR EM JOGO</small><strong>{selecionado.valor}</strong></span></div>
            <footer><button type="button" className="whatsapp">● Chamar no WhatsApp</button><button type="button" aria-label="Abrir atendimento">↗</button></footer>
          </article>

          <article className="reimagined-pulse-card">
            <header><div><span>Pulso da operação</span><small>atualizado agora</small></div><button type="button">Detalhes ↗</button></header>
            <div className="reimagined-pulse-body">
              <div className="reimagined-score"><span><strong>84</strong><small>/100</small></span></div>
              <div className="reimagined-pulse-lines"><span><small>Velocidade de resposta</small><i><b style={{ width: "91%" }} /></i><em>91</em></span><span><small>Feedback de visitas</small><i><b style={{ width: "63%" }} /></i><em>63</em></span><span><small>Próximas ações em dia</small><i><b style={{ width: "78%" }} /></i><em>78</em></span></div>
            </div>
          </article>
        </aside>
      </section>

      <section className="reimagined-journey">
        <header><div><span>Jornada comercial</span><h2>Onde os negócios estão — e onde travaram</h2></div><button type="button">Abrir visão completa ↗</button></header>
        <div className="reimagined-journey-track">
          <div className="reimagined-track-line"><b /></div>
          {etapas.map((etapa, indice) => <article key={etapa.nome} style={{ "--stage-tone": etapa.tom } as React.CSSProperties}>
            <span className="reimagined-stage-node"><i>{indice + 1}</i></span>
            <div><small>{etapa.nome}</small><strong>{etapa.total}</strong><p>{etapa.detalhe}</p></div>
            <span className="reimagined-mini-people"><i>{prioridades[indice]?.iniciais ?? "SN"}</i><i>+{Math.max(1, etapa.total - 1)}</i></span>
          </article>)}
        </div>
      </section>
    </main>

    {commandOpen && <div className="reimagined-command-layer" onMouseDown={(evento) => { if (evento.target === evento.currentTarget) setCommandOpen(false); }}>
      <section className="reimagined-command" role="dialog" aria-modal="true" aria-label="Busca global reimaginada">
        <header><span>⌕</span><input autoFocus value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Cliente, corretor, imóvel ou ação…" /><kbd>ESC</kbd></header>
        <div><small>{busca ? "RESULTADOS" : "PRECISAM DE VOCÊ AGORA"}</small>{resultados.map((item) => <button type="button" key={item.id} onClick={() => { setSelecionado(item.id); setCommandOpen(false); setBusca(""); }}><i>{item.iniciais}</i><span><strong>{item.nome}</strong><small>{item.acao}</small></span><em>{item.prazo}</em><b>↗</b></button>)}</div>
      </section>
    </div>}
  </div>;
}
