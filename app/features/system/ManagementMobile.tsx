"use client";

import Link from "next/link";
import type { ModuleName } from "./module-map";
import { existeNoApp, pathDoModulo, podeVer } from "./erp-routes";
import { useErpSession } from "./ErpSession";

/* Icones em tracado, nao glifo de texto.
 * Antes cada linha usava um caractere ("👥", "↗", "✦", "▥", "▦"): o desenho
 * dependia da fonte do aparelho e saia diferente em cada celular -- no Chrome
 * do teste, dois deles viraram retangulos hachurados. Tracado de 1.8 com canto
 * redondo, igual ao resto do app. */
function IconeGestao({ nome }: { nome: string }) {
  const c = { width: 19, height: 19, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (nome === "equipe") return <svg {...c}><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 21v-2a5 5 0 0 1 10 0v2M14 21v-1.5a4 4 0 0 1 7-2.6" /></svg>;
  if (nome === "agenda") return <svg {...c}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></svg>;
  if (nome === "avisos") return <svg {...c}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4" /></svg>;
  if (nome === "esteira") return <svg {...c}><path d="M3 4h18l-7 8v7l-4 2v-9Z" /></svg>;
  return <svg {...c}><path d="m3 17 6-6 4 4 8-9" /><path d="M15 6h6v6" /></svg>;
}

/* A LISTA DA GESTAO NO CELULAR.
 *
 * Antes daqui passavam "Distribuicao de leads" (Usuarios) e "Regras da Sara"
 * (Automacoes): dois modulos que existem somente no formato computador. Tocar
 * neles abria uma tela de escritorio comprimida em 390px -- e quem toca conclui
 * que o botao nao funciona. Ficaram de fora, e voltam no dia em que tiverem
 * tela de celular.
 *
 * O que sobrou e o que o gestor faz de fato pelo telefone: ver quem esta
 * trabalhando, olhar a agenda da equipe, conferir os avisos, acompanhar a
 * esteira e ler os relatorios. */
const itens = [
  { modulo: "Minha Equipe", icone: "equipe", titulo: "Quem está trabalhando", texto: "Presença, carteira e resposta no prazo" },
  { modulo: "Calendário", icone: "agenda", titulo: "Agenda da equipe", texto: "Visitas e compromissos do dia" },
  { modulo: "Notificações", icone: "avisos", titulo: "Avisos", texto: "O que está pedindo ação agora" },
  { modulo: "CRM", icone: "esteira", titulo: "Esteira de vendas", texto: "Atendimentos e oportunidades" },
  /* Relatorios e a OUTRA leitura de /performance (?vista=relatorios): trabalho,
     atendimento, funil e receita do periodo. O Inicio do gestor ja e a primeira
     leitura, e sem o parametro as duas linhas abririam a mesma tela. */
  { modulo: "Performance", icone: "relatorios", titulo: "Relatórios", texto: "Trabalho, atendimento, funil e receita", vista: "relatorios" },
] satisfies Array<{ modulo: ModuleName; icone: string; titulo: string; texto: string; vista?: string }>;

export function ManagementMobile() {
  const { role, permissoes, perfilCarregado, isManager } = useErpSession();
  const visiveis = itens.filter((item) =>
    existeNoApp(item.modulo) && podeVer(item.modulo, { role, permissoes, carregado: perfilCarregado, isManager }));
  return <main className="ape-gestao">
    <p>Área restrita a gestor e administrador. Nada disso aparece na rotina do corretor.</p>
    <section>{visiveis.map((item) => {
      const href = item.vista ? `${pathDoModulo(item.modulo)}?vista=${item.vista}` : pathDoModulo(item.modulo);
      return <Link href={href} key={item.titulo}><span aria-hidden="true"><IconeGestao nome={item.icone} /></span><span><strong>{item.titulo}</strong><small>{item.texto}</small></span><b aria-hidden="true">›</b></Link>;
    })}</section>
    <p className="ape-gestao-nota">Financeiro, Usuários, Permissões, Automações e Auditoria ficam no ERP do computador.</p>
  </main>;
}
