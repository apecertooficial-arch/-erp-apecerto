// ============================================================================
// FONTE DA VERDADE de permissões (compartilhada entre UI e servidor).
//
// MODULE_CAPABILITIES define, para cada módulo, QUAIS ações fazem sentido.
// - A tela "Perfis e Permissões" usa isto para desenhar um botão Sim/Não por
//   permissão válida (combinação fora do mapa nem aparece — sem "—").
// - O servidor usa `canDo` para validar uma ação contra as permissões efetivas.
//
// O mapa abaixo foi derivado da UNIÃO das ações realmente usadas pelos 6 perfis
// de sistema (admin, auditor, corretor, financeiro, gestor_comercial,
// gestor_equipe), então nenhuma permissão em uso é perdida. Ao adicionar uma
// ação nova a um módulo, inclua-a aqui primeiro.
// ============================================================================

export type PermissionMap = Record<string, string[]>;

export const MODULE_CAPABILITIES: Record<string, readonly string[]> = {
  dashboard: ["ver", "configurar"],
  crm: ["ver", "criar", "editar", "excluir", "exportar", "visualizar_historico"],
  leads: ["ver", "criar", "editar", "excluir", "importar", "exportar", "atribuir", "atribuir_proprio", "transferir", "visualizar_historico"],
  pipeline: ["ver", "criar", "editar", "excluir", "mover", "reordenar"],
  chat: ["ver", "criar"],
  disparos: ["ver", "criar", "aprovar", "enviar"],
  abordagens: ["ver", "criar", "editar", "excluir", "publicar"],
  produtos: ["ver", "criar", "editar", "excluir"],
  vendas: ["ver", "criar", "editar", "excluir", "aprovar"],
  comissoes: ["ver", "criar", "editar", "excluir"],
  financeiro: ["ver", "criar", "editar", "cancelar", "aprovar", "exportar"],
  fluxo_caixa: ["ver", "criar", "editar", "cancelar", "conciliar"],
  metas: ["ver", "criar", "editar", "excluir"],
  performance: ["ver"],
  calendario: ["ver", "criar", "editar", "excluir"],
  automacoes: ["ver", "criar", "editar", "excluir", "executar", "consultar_execucoes"],
  agentes_ia: ["ver", "criar", "editar", "configurar"],
  notificacoes: ["ver", "configurar"],
  configuracoes: ["ver", "configurar", "ver_conexoes"],
  usuarios: ["ver", "criar", "editar", "excluir", "gerenciar_permissoes"],
  auditoria: ["ver"],
};

export const MODULE_ORDER: string[] = Object.keys(MODULE_CAPABILITIES);

export const MODULE_LABELS: Record<string, string> = {
  dashboard: "Início / Dashboard", crm: "CRM", leads: "Leads", pipeline: "Funil (Pipeline)", chat: "Chat ao Vivo",
  disparos: "Disparos", abordagens: "Abordagens", produtos: "Produtos", vendas: "Vendas", comissoes: "Comissões",
  financeiro: "Financeiro", fluxo_caixa: "Fluxo de caixa", metas: "Metas", performance: "Performance",
  calendario: "Calendário", automacoes: "Automações", agentes_ia: "Agentes de IA", notificacoes: "Notificações",
  configuracoes: "Configurações", usuarios: "Usuários", auditoria: "Auditoria",
};

export const ACTION_LABELS: Record<string, string> = {
  ver: "Ver", criar: "Criar", editar: "Editar", excluir: "Excluir", exportar: "Exportar", importar: "Importar",
  aprovar: "Aprovar", enviar: "Enviar", cancelar: "Cancelar", conciliar: "Conciliar", mover: "Mover", reordenar: "Reordenar",
  atribuir: "Atribuir", atribuir_proprio: "Atribuir (próprio)", transferir: "Transferir", publicar: "Publicar",
  configurar: "Configurar", executar: "Executar", gerenciar_permissoes: "Gerenciar permissões", ver_conexoes: "Ver conexões",
  visualizar_historico: "Ver histórico", consultar_execucoes: "Consultar execuções",
};

// Ordem canônica das colunas de ação (as demais, se surgirem, vão para o fim).
export const ACTION_ORDER: string[] = [
  "ver", "criar", "editar", "excluir", "exportar", "importar", "aprovar", "enviar", "cancelar", "conciliar",
  "mover", "reordenar", "atribuir", "atribuir_proprio", "transferir", "publicar", "configurar", "executar",
  "gerenciar_permissoes", "ver_conexoes", "visualizar_historico", "consultar_execucoes",
];

export const label = (dict: Record<string, string>, key: string) => dict[key] ?? key.replace(/_/g, " ");

/** Uma ação é válida para um módulo? (define quais células viram botão Sim/Não) */
export function isCapability(moduleName: string, action: string): boolean {
  return (MODULE_CAPABILITIES[moduleName] ?? []).includes(action);
}

/** A permissão está concedida no mapa? (presença = concedido; ausência = negado) */
export function hasPermission(perms: PermissionMap | null | undefined, moduleName: string, action: string): boolean {
  return Boolean(perms && (perms[moduleName] ?? []).includes(action));
}

/**
 * Decisão de acesso efetiva.
 * - admin sempre pode (não se tranca fora);
 * - sem NENHUM mapa de permissões definido → libera (fail-open) para não travar
 *   usuários durante o rollout; a trava dura continua sendo o RLS no banco;
 * - caso contrário, exige a ação presente no módulo.
 */
export function canDo(role: string | null | undefined, perms: PermissionMap | null | undefined, moduleName: string, action: string): boolean {
  if (role === "admin") return true;
  if (!perms || Object.keys(perms).length === 0) return true;
  return hasPermission(perms, moduleName, action);
}
