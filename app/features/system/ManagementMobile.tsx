"use client";

import Link from "next/link";
import type { ModuleName } from "./module-map";
import { pathDoModulo, podeVer } from "./erp-routes";
import { useErpSession } from "./ErpSession";

const itens = [
  { modulo: "Usuários", icone: "👥", titulo: "Distribuição de leads", texto: "Equipe, responsáveis e plantão" },
  { modulo: "CRM", icone: "↗", titulo: "Esteira de vendas", texto: "Atendimentos e oportunidades" },
  { modulo: "Automações", icone: "✦", titulo: "Regras da Sara", texto: "Prazos, prioridades e automações" },
  { modulo: "Produtos", icone: "▥", titulo: "Cadastro de produtos", texto: "Empreendimentos e unidades" },
  { modulo: "Performance", icone: "▦", titulo: "Relatórios", texto: "Trabalho, atendimento, funil e receita" },
] satisfies Array<{ modulo: ModuleName; icone: string; titulo: string; texto: string }>;

export function ManagementMobile() {
  const { role, permissoes, perfilCarregado, isManager } = useErpSession();
  const visiveis = itens.filter((item) => podeVer(item.modulo, { role, permissoes, carregado: perfilCarregado, isManager }));
  return <main className="ape-gestao">
    <p>Área restrita a gestor e administrador. Nada disso aparece na rotina do corretor.</p>
    <section>{visiveis.map((item) => <Link href={pathDoModulo(item.modulo)} key={item.modulo}><span aria-hidden="true">{item.icone}</span><span><strong>{item.titulo}</strong><small>{item.texto}</small></span><b aria-hidden="true">›</b></Link>)}</section>
  </main>;
}
