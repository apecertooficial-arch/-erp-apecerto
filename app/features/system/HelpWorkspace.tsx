import Link from "next/link";

const itens = [
  ["Operação comercial", "Leads ativos, pesca e atendimento vivem no Funil 2.0.", "/crm"],
  ["Visitas", "Crie e acompanhe compromissos pela Agenda canônica.", "/agenda"],
  ["WhatsApp", "Conecte ou reconecte sua instância em Configurações.", "/configuracoes"],
  ["Sara e agentes", "Treinamento, fontes, ferramentas e testes ficam em Agentes de IA.", "/agentes-ia"],
  ["Automações", "Monte fluxos independentes e escolha funil/etapa dentro de cada bloco.", "/automacoes"],
] as const;

export function HelpWorkspace() {
  return <main className="help-workspace"><header><span>CENTRAL NATIVA</span><h1>Ajuda</h1><p>Atalhos para a estrutura oficial do ERP, sem instruções das versões antigas.</p></header><section>{itens.map(([titulo, texto, href]) => <article key={titulo}><h2>{titulo}</h2><p>{texto}</p><Link href={href}>Abrir módulo</Link></article>)}</section><aside><strong>Encontrou um problema?</strong><p>Registre o caso com a tela, horário, usuário e o que esperava acontecer. Isso permite localizar o evento na Auditoria sem adivinhar.</p><Link href="/auditoria">Abrir Auditoria</Link></aside></main>;
}
