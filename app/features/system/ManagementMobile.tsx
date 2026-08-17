"use client";

import Link from "next/link";
import type { ModuleName } from "./module-map";
import { pathDoModulo, podeVer } from "./erp-routes";
import { useErpSession } from "./ErpSession";

/* Icones em tracado, nao glifo de texto.
 * Antes cada linha usava um caractere ("👥", "↗", "✦", "▥", "▦"): o desenho
 * dependia da fonte do aparelho e saia diferente em cada celular -- no Chrome
 * do teste, dois deles viraram retangulos hachurados. Tracado de 1.8 com canto
 * redondo, igual ao resto do app. */
function IconeGestao({ nome }: { nome: string }) {
  const c = { width: 19, height: 19, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (nome === "leads") return <svg {...c}><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 21v-2a5 5 0 0 1 10 0v2M14 21v-1.5a4 4 0 0 1 7-2.6" /></svg>;
  if (nome === "esteira") return <svg {...c}><path d="m3 17 6-6 4 4 8-9" /><path d="M15 6h6v6" /></svg>;
  if (nome === "sara") return <svg {...c}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="M18 17l.9 2.1L21 20l-2.1.9L18 23l-.9-2.1L15 20l2.1-.9L18 17Z" /></svg>;
  if (nome === "produtos") return <svg {...c}><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M3 21h18M10 7h.01M14 7h.01M10 11h.01M14 11h.01M10 15h.01M14 15h.01" /></svg>;
  return <svg {...c}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
}

const itens = [
  { modulo: "Usuários", icone: "leads", titulo: "Distribuição de leads", texto: "Equipe, responsáveis e plantão" },
  { modulo: "CRM", icone: "esteira", titulo: "Esteira de vendas", texto: "Atendimentos e oportunidades" },
  { modulo: "Automações", icone: "sara", titulo: "Regras da Sara", texto: "Prazos, prioridades e automações" },
  { modulo: "Produtos", icone: "produtos", titulo: "Cadastro de produtos", texto: "Empreendimentos e unidades" },
  { modulo: "Performance", icone: "relatorios", titulo: "Relatórios", texto: "Trabalho, atendimento, funil e receita" },
] satisfies Array<{ modulo: ModuleName; icone: string; titulo: string; texto: string }>;

export function ManagementMobile() {
  const { role, permissoes, perfilCarregado, isManager } = useErpSession();
  const visiveis = itens.filter((item) => podeVer(item.modulo, { role, permissoes, carregado: perfilCarregado, isManager }));
  return <main className="ape-gestao">
    <p>Área restrita a gestor e administrador. Nada disso aparece na rotina do corretor.</p>
    <section>{visiveis.map((item) => <Link href={pathDoModulo(item.modulo)} key={item.modulo}><span aria-hidden="true"><IconeGestao nome={item.icone} /></span><span><strong>{item.titulo}</strong><small>{item.texto}</small></span><b aria-hidden="true">›</b></Link>)}</section>
  </main>;
}
