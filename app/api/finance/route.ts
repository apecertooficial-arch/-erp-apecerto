import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { resolveEffectiveAccess, denyIfCannot } from "../../lib/supabase/authz";
import { papelNoGrupo } from "../../lib/papeis";
import type { Enums } from "../../lib/supabase/database.types";
import { criarVendaAtomica, excluirVendaAtomica } from "./venda-rpc";
import { decidirRepasseAtomico } from "./repasse-rpc";
import { hojeOperacao, somarDias } from "../../lib/timezone";

export const dynamic = "force-dynamic";

async function authClient(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : { supabase, user: data.user };
}

/* PONTE TEMPORARIA DE TIPO — APAGUE AO REGERAR OS TIPOS.

   A migracao repasse_comissao_fonte_unica criou tres colunas em
   pagamentos_comissao: ordem, data_prevista e lancamento_id. O arquivo
   app/lib/supabase/database.types.ts e gerado por `supabase gen types` e ainda
   nao as conhece. Como o cliente do Supabase e tipado, citar essas colunas num
   select vira erro de compilacao.

   Enquanto os tipos nao forem regerados, o select usa "*" (o Postgres devolve
   as colunas de qualquer jeito) e a leitura das tres e tipada aqui.

   Na proxima vez que alguem rodar `supabase gen types`, este bloco perde a
   razao de existir: apague o tipo e volte a listar as colunas no select. */
type RepasseColunasNovas = { ordem: number; data_prevista: string | null; lancamento_id: string | null };

/* PONTE TEMPORARIA DE TIPO — APAGUE AO REGERAR OS TIPOS.

   As tabelas extrato_importacao, extrato_linha e extrato_layout nasceram na
   migracao extrato_bancario_importacao e ainda nao existem em
   app/lib/supabase/database.types.ts, que e gerado por `supabase gen types`.
   Como o cliente do Supabase e tipado pelo esquema, from("extrato_linha")
   nao compila enquanto o arquivo nao for regerado.

   semTipos() devolve o mesmo cliente sem o esquema amarrado — mesma conexao,
   mesma sessao, mesma RLS. Ao regerar os tipos, apague isto e volte a chamar
   auth.supabase direto. */
const semTipos = (cliente: unknown) => cliente as SupabaseClient;

const clean = (value: unknown, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";

type ErroFinanceiro = { code?: string; message?: string } | null | undefined;
type OpcoesFalhaFinanceiro = {
  parcial?: boolean;
  mensagem?: string;
  erro?: string;
  status?: number;
};

function falhaFinanceiro(error: ErroFinanceiro, operacao: string, opcoes: OpcoesFalhaFinanceiro = {}) {
  const semPermissao = error?.code === "42501" || /permission|policy|acesso negado/i.test(error?.message ?? "");
  const parcial = opcoes.parcial === true;
  console.error("financeiro_operacao_falhou", {
    operacao,
    codigo: error?.code ?? "desconhecido",
    parcial,
  });
  return Response.json({
    error: semPermissao
      ? "Você não tem permissão para concluir esta operação."
      : opcoes.mensagem ?? (parcial
        ? "A operação não foi concluída por inteiro. Não repita a ação; atualize a tela e solicite conferência financeira."
        : "Não foi possível concluir a operação financeira no momento."),
    erro: semPermissao ? "sem_permissao" : opcoes.erro ?? (parcial ? "reconciliacao_necessaria" : "falha_banco"),
    ...(parcial ? { parcial: true } : {}),
  }, { status: semPermissao ? 403 : opcoes.status ?? 502 });
}

export async function GET(request: Request) {
  const auth = await authClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const [sales, details, commissions, receipts, cash, users, brokers, goals, leads, deals, empreendimentos, categorias, rankingVgv, payouts, extratos, extratoLinhas] = await Promise.all([
    auth.supabase.from("vendas").select("id,created_at,data_venda,data_conclusao,empreendimento_id,empreendimento_nome,unidade_id,unidade_rotulo,cliente_nome,proprietario_nome,vgv,custos,forma_pgto,percentual_comissao,status,obs").order("data_venda", { ascending: false }),
    auth.supabase.from("v_vendas_detalhe").select("id,data_venda,empreendimento,unidade,bairro,incorporadora,vgv,percentual_comissao,comissao_bruta,comissao_corretores,comissao_executivo,comissao_apecerto,indicacao,corretores,forma_pgto,status,obs"),
    auth.supabase.from("comissoes").select("id,venda_id,beneficiario_id,papel,valor_calculado,valor_final,override_motivo,created_at"),
    auth.supabase.from("recebimentos").select("id,venda_id,numero_parcela,valor_total,data_prevista,data_recebimento,status,created_at").order("data_prevista", { ascending: true }),
    auth.supabase.from("lancamentos_caixa").select("id,venda_id,recebimento_id,data,tipo,categoria,descricao,valor,origem,papel,beneficiario_id,comissao_id,natureza,created_at").order("data", { ascending: false }).limit(2000),
    auth.supabase.from("usuarios").select("id,nome,role,ativo"),
    auth.supabase.from("corretores").select("id,nome,usuario_id,online,ativo").eq("ativo", true),
    auth.supabase.from("metas_corretor").select("corretor_id,nome,meta_vgv,atualizado_em"),
    auth.supabase.from("leads").select("id,nome,origem,criado_em,corretor_id"),
    auth.supabase.from("negocios").select("id,lead_id,corretor_id,venda_id,status,valor,criado_em"),
    auth.supabase.from("empreendimentos").select("id,nome,bairro,cidade").order("nome", { ascending: true }),
    auth.supabase.from("categorias_caixa").select("id,nome,tipo,natureza,cor,ordem").eq("ativo", true).order("tipo", { ascending: true }).order("ordem", { ascending: true }),
    auth.supabase.from("vw_ranking_vgv").select("corretor_id,corretor,vendas,vgv").order("vgv", { ascending: false }),
    // Agenda de repasse de comissao (fonte unica: pagamentos_comissao).
    auth.supabase.from("pagamentos_comissao").select("*").order("created_at", { ascending: true }),
    semTipos(auth.supabase).from("extrato_importacao").select("*").order("criado_em", { ascending: false }).limit(12),
    semTipos(auth.supabase).from("extrato_linha").select("*").order("data", { ascending: false }).limit(600),
  ]);
  const firstError = [sales, details, commissions, receipts, cash, users, brokers, goals, leads, deals, empreendimentos, categorias, rankingVgv, payouts, extratos, extratoLinhas].find((result) => result.error)?.error;
  if (firstError) return falhaFinanceiro(firstError, "carregar_painel");
  // Segurança: o corretor NUNCA pode ver valores totais/brutos de comissão — apenas a comissão que é dele (comissoes já é filtrada por RLS).
  // Removemos os campos brutos da resposta para que o navegador do corretor nem receba esses números.
  const { data: me, error: meError } = await auth.supabase.from("usuarios").select("role").eq("id", auth.user.id).maybeSingle();
  if (meError) return falhaFinanceiro(meError, "carregar_perfil");
  const hasFullFinanceAccess = papelNoGrupo(me?.role, "financeiro");
  const isBroker = !hasFullFinanceAccess;

  /* Defesa em profundidade: RLS continua obrigatória, mas a API não repassa o
     painel da imobiliária para um corretor mesmo se uma policy remota estiver
     permissiva. O corretor recebe somente as próprias vendas/comissões/repasses;
     caixa, recebimentos da empresa, extratos e cadastros administrativos não
     atravessam a fronteira HTTP. */
  const brokerRows = isBroker ? (brokers.data ?? []).filter((broker) => broker.usuario_id === auth.user.id) : (brokers.data ?? []);
  const brokerIds = new Set(brokerRows.map((broker) => broker.id));
  const brokerNames = new Set(brokerRows.map((broker) => broker.nome.trim().toLocaleLowerCase("pt-BR")));
  const scopedCommissions = isBroker ? (commissions.data ?? []).filter((commission) => commission.beneficiario_id === auth.user.id) : (commissions.data ?? []);
  const scopedPayouts = isBroker ? (payouts.data ?? []).filter((payout) => payout.beneficiario_id === auth.user.id) : (payouts.data ?? []);
  const scopedDeals = isBroker
    ? (deals.data ?? []).filter((deal) => deal.corretor_id !== null && brokerIds.has(deal.corretor_id))
    : (deals.data ?? []);
  const brokerSaleIds = new Set<string>([
    ...scopedCommissions.map((commission) => commission.venda_id),
    ...scopedPayouts.map((payout) => payout.venda_id),
    ...scopedDeals.map((deal) => deal.venda_id).filter((id): id is string => typeof id === "string"),
  ]);
  const scopedSales = isBroker ? (sales.data ?? []).filter((sale) => brokerSaleIds.has(sale.id)) : (sales.data ?? []);
  const scopedDetails = isBroker ? (details.data ?? []).filter((detail) => typeof detail.id === "string" && brokerSaleIds.has(detail.id)) : (details.data ?? []);
  const scopedReceipts = isBroker ? [] : (receipts.data ?? []);
  const scopedCash = isBroker ? [] : (cash.data ?? []);
  const scopedUsers = isBroker ? (users.data ?? []).filter((user) => user.id === auth.user.id) : (users.data ?? []);
  const scopedGoals = isBroker ? (goals.data ?? []).filter((goal) => goal.corretor_id !== null && brokerIds.has(goal.corretor_id)) : (goals.data ?? []);
  const scopedLeads = isBroker ? [] : (leads.data ?? []);
  const scopedEmpreendimentos = isBroker ? [] : (empreendimentos.data ?? []);
  const scopedCategorias = isBroker ? [] : (categorias.data ?? []);
  const scopedRanking = isBroker ? (rankingVgv.data ?? []).filter((row) => {
    const id = String(row.corretor_id ?? "");
    const nome = String(row.corretor ?? "").trim().toLocaleLowerCase("pt-BR");
    return id === auth.user.id || brokerIds.has(Number(id)) || brokerNames.has(nome);
  }) : (rankingVgv.data ?? []);
  const scopedExtratos = isBroker ? [] : (extratos.data ?? []);
  const scopedExtratoLinhas = isBroker ? [] : (extratoLinhas.data ?? []);

  const safeSales = isBroker
    ? scopedSales.map((sale) => ({ ...sale, percentual_comissao: null }))
    : scopedSales;
  const safeDetails = isBroker
    ? scopedDetails.map((detail) => ({ ...detail, percentual_comissao: null, comissao_bruta: null, comissao_corretores: null, comissao_executivo: null, comissao_apecerto: null, indicacao: null }))
    : scopedDetails;
  const saleById = new Map(safeSales.map((sale) => [sale.id, sale]));
  const reconciledReceipts = scopedReceipts.map((receipt) => {
    const sale = saleById.get(receipt.venda_id);
    if (sale?.status !== "pago") return receipt;
    return {
      ...receipt,
      status: "recebido",
      data_recebimento: receipt.data_recebimento || sale.data_venda,
    };
  });
  return Response.json({ sales: safeSales, details: safeDetails, commissions: scopedCommissions, receipts: reconciledReceipts, cash: scopedCash, users: scopedUsers, brokers: brokerRows, goals: scopedGoals, leads: scopedLeads, deals: scopedDeals, empreendimentos: scopedEmpreendimentos, categorias: scopedCategorias, rankingVgv: scopedRanking, payouts: scopedPayouts, extratos: scopedExtratos, extratoLinhas: scopedExtratoLinhas });
}

export async function PATCH(request: Request) {
  const auth = await authClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const action = clean(body.action, 40);

  // Acesso efetivo resolvido uma vez; acesso_total passa e, sem mapa, nega (fail-closed).
  // Observação: a venda iniciada pelo corretor passa por /api/crm/sales — este balcão
  // financeiro (venda manual, caixa, recebimentos) exige permissão financeira.
  const access = await resolveEffectiveAccess(auth.supabase, auth.user.id);
  const guard = (pairs: Array<[string, string]>, msg: string) => denyIfCannot(access, pairs, msg);

  if (action === "createCategory" || action === "renameCategory" || action === "removeCategory") {
    const { data: me, error: meError } = await auth.supabase.from("usuarios").select("role").eq("id", auth.user.id).maybeSingle();
    if (meError) return falhaFinanceiro(meError, "autorizar_categoria");
    if (!me || !papelNoGrupo(me.role, "financeiro")) return Response.json({ error: "Apenas administradores podem gerenciar categorias." }, { status: 403 });
    const validNatureza = (value: string) => ["normal", "comissao_recebida", "comissao_paga"].includes(value) ? value : "normal";
    if (action === "createCategory") {
      const nome = clean(body.nome, 80);
      const tipo = clean(body.tipo, 10);
      if (!nome || !["entrada", "saida", "ambos"].includes(tipo)) return Response.json({ error: "Informe o nome e o tipo da categoria." }, { status: 422 });
      const { error } = await auth.supabase.from("categorias_caixa").insert({ nome, tipo: tipo as "entrada" | "saida", natureza: validNatureza(clean(body.natureza, 30)), cor: clean(body.cor, 20) || null, ordem: 99 } as never);
      if (error && /duplicate|unique/i.test(error.message)) return falhaFinanceiro(error, "criar_categoria", { mensagem: "Já existe uma categoria com esse nome.", erro: "categoria_duplicada", status: 409 });
      return error ? falhaFinanceiro(error, "criar_categoria") : Response.json({ success: true });
    }
    if (action === "renameCategory") {
      const id = clean(body.categoryId, 60);
      const patch: Record<string, unknown> = {};
      if (typeof body.nome === "string" && body.nome.trim()) patch.nome = clean(body.nome, 80);
      if (["entrada", "saida", "ambos"].includes(clean(body.tipo, 10))) patch.tipo = clean(body.tipo, 10);
      if (typeof body.natureza === "string") patch.natureza = validNatureza(clean(body.natureza, 30));
      if (typeof body.cor === "string") patch.cor = clean(body.cor, 20) || null;
      if (!id || Object.keys(patch).length === 0) return Response.json({ error: "Informe a categoria e o que alterar." }, { status: 422 });
      const { error } = await auth.supabase.from("categorias_caixa").update(patch as never).eq("id", id);
      return error ? falhaFinanceiro(error, "renomear_categoria") : Response.json({ success: true });
    }
    const id = clean(body.categoryId, 60);
    if (!id) return Response.json({ error: "Categoria inválida." }, { status: 422 });
    const { error } = await auth.supabase.from("categorias_caixa").update({ ativo: false }).eq("id", id);
    return error ? falhaFinanceiro(error, "remover_categoria") : Response.json({ success: true });
  }

  if (action === "createSale") {
    const dataVenda = clean(body.dataVenda, 10);
    const vgv = Number(body.vgv);
    if (!dataVenda || !Number.isFinite(vgv) || vgv <= 0) return Response.json({ error: "Informe a data e o VGV da venda." }, { status: 422 });
    const denied = guard([["vendas", "criar"], ["financeiro", "criar"]], "Você não tem permissão para lançar vendas no financeiro.");
    if (denied) return denied;
    /* TRANSAÇÃO ÚNICA (Fase 2, set/2026).

       Venda, corretores, comissões, parcelas, repasses e o vínculo com o
       negócio do CRM agora são gravados por venda_criar, dentro do banco, numa
       transação só: ou entra tudo ou não entra nada. Antes eram 6 inserts em
       sequência e uma falha no meio deixava venda pela metade.

       O banco também arredonda para centavos, rejeita negativo, confere o
       rateio (100%), valida o papel contra o enum, calcula a comissão bruta
       (VGV × percentual) e não deixa comissão nem repasse passar dela. O
       carimbo de data_conclusao continua o mesmo: status concluído/pago ->
       data da venda (ver comentário na migration e no histórico desta rota).

       Detalhes em app/api/finance/venda-rpc.ts. */
    const resultado = await criarVendaAtomica(semTipos(auth.supabase), body);
    if (resultado.erroInterno && resultado.status >= 500) console.error("financeiro_venda_rpc_falhou", { operacao: "criar", codigo: resultado.erroInterno.code ?? "desconhecido" });
    return Response.json(resultado.body, { status: resultado.status });
  }

  if (action === "createCash") {
    const type = clean(body.type, 10);
    const category = clean(body.category, 100);
    const date = clean(body.date, 10);
    const value = Number(body.value);
    if (!['entrada', 'saida'].includes(type) || !category || !date || !Number.isFinite(value) || value <= 0) return Response.json({ error: "Preencha tipo, categoria, data e valor." }, { status: 422 });
    const denied = guard([["fluxo_caixa", "criar"], ["financeiro", "criar"]], "Você não tem permissão para lançar no fluxo de caixa.");
    if (denied) return denied;
    const saleId = clean(body.saleId, 50) || null;
    const receiptId = clean(body.receiptId, 50) || null;
    const commissionId = clean(body.commissionId, 60) || null;
    const beneficiarioId = clean(body.beneficiarioId, 60) || null;
    const papelRaw = clean(body.papel, 40);
    const papel = ['corretor', 'executivo', 'indicacao', 'apecerto'].includes(papelRaw) ? papelRaw : null;
    const naturezaRaw = clean(body.natureza, 30);
    const natureza = ["normal", "comissao_recebida", "comissao_paga"].includes(naturezaRaw) ? naturezaRaw : "normal";
    const insert: Record<string, unknown> = { tipo: type as "entrada" | "saida", categoria: category, data: date, valor: value, descricao: clean(body.description, 500) || null, origem: "erp", venda_id: saleId, recebimento_id: receiptId, comissao_id: commissionId, beneficiario_id: beneficiarioId, papel, natureza };
    const { error } = await auth.supabase.from("lancamentos_caixa").insert(insert as never);
    if (error) return falhaFinanceiro(error, "criar_lancamento");
    if (receiptId && body.settleReceipt === true) {
      const { data: baixado, error: settleError } = await auth.supabase.from("recebimentos").update({ status: "recebido", data_recebimento: date }).eq("id", receiptId).neq("status", "recebido").select("id").maybeSingle();
      if (settleError) return falhaFinanceiro(settleError, "baixar_parcela_apos_lancamento", { parcial: true });
      if (!baixado) return Response.json({ error: "Lançamento criado, mas a baixa da parcela não foi confirmada. Confira o caixa antes de repetir.", parcial: true, erro: "reconciliacao_necessaria" }, { status: 409 });
    }
    return Response.json({ success: true });
  }

  /* Editar e excluir lançamento do fluxo de caixa (ago/2026).
     Antes só existia createCash: um lançamento errado ficava no caixa para sempre.

     REGRA DE ESCOPO, deliberada: a edição altera apenas data, tipo, categoria, valor e
     descrição. Os VÍNCULOS (venda, parcela de recebimento, comissão, beneficiário,
     papel, natureza) são imutáveis aqui — mexer neles pela lateral dessincronizaria a
     venda, a comissão e o "A receber" sem que ninguém percebesse. Para trocar vínculo:
     exclua e lance de novo, que é um caminho auditável. */
  if (action === "updateCash" || action === "deleteCash") {
    const cashId = clean(body.cashId, 60);
    if (!cashId) return Response.json({ error: "Lançamento inválido." }, { status: 422 });

    const denied = action === "updateCash"
      ? guard([["fluxo_caixa", "editar"], ["financeiro", "editar"]], "Você não tem permissão para editar lançamentos do fluxo de caixa.")
      : guard([["fluxo_caixa", "cancelar"], ["financeiro", "editar"]], "Você não tem permissão para excluir lançamentos do fluxo de caixa.");
    if (denied) return denied;

    const { data: antes, error: readError } = await auth.supabase.from("lancamentos_caixa")
      .select("id,venda_id,recebimento_id,data,tipo,categoria,descricao,valor,origem,papel,beneficiario_id,comissao_id,natureza,created_at")
      .eq("id", cashId).maybeSingle();
    if (readError) return falhaFinanceiro(readError, "consultar_lancamento");
    if (!antes) return Response.json({ error: "Lançamento não encontrado. Ele pode já ter sido excluído." }, { status: 404 });

    /* Nome de quem fez, para a auditoria significar alguma coisa na leitura. */
    const { data: autor, error: autorError } = await auth.supabase.from("usuarios").select("nome").eq("id", auth.user.id).maybeSingle();
    if (autorError) return falhaFinanceiro(autorError, "consultar_autor_auditoria");
    const autorNome = autor?.nome || auth.user.email || "desconhecido";
    const registrar = async (acao: string, depois: Record<string, unknown> | null) => {
      const { error: auditError } = await auth.supabase.from("erp_auditoria").insert({
        modulo: "Financeiro", acao, entidade: "lancamentos_caixa", entidade_id: cashId,
        usuario_id: auth.user.id, usuario_nome: autorNome,
        detalhe: `${antes.tipo === "entrada" ? "Entrada" : "Saída"} de ${antes.valor} em ${antes.data} · ${antes.categoria}`,
        antes: antes as never, depois: depois as never,
      } as never);
      return auditError;
    };

    if (action === "updateCash") {
      const type = clean(body.type, 10);
      const category = clean(body.category, 100);
      const date = clean(body.date, 10);
      const value = Number(body.value);
      if (!['entrada', 'saida'].includes(type) || !category || !date || !Number.isFinite(value) || value <= 0) return Response.json({ error: "Preencha tipo, categoria, data e valor." }, { status: 422 });
      const patch = { tipo: type as "entrada" | "saida", categoria: category, data: date, valor: value, descricao: clean(body.description, 500) || null };
      const { data: alterado, error } = await auth.supabase.from("lancamentos_caixa").update(patch as never).eq("id", cashId).select("id").maybeSingle();
      if (error) return falhaFinanceiro(error, "editar_lancamento");
      if (!alterado) return Response.json({ error: "O lançamento deixou de existir antes da edição." }, { status: 409 });
      const auditError = await registrar("Editar lançamento", patch);
      if (auditError) return falhaFinanceiro(auditError, "auditar_edicao_lancamento", { parcial: true });
      return Response.json({ success: true });
    }

    /* Excluir. O lançamento é a prova de que a parcela entrou em caixa — sem ele, a
       parcela tem que voltar a aparecer em "A receber", senão o financeiro passa a
       contar duas histórias diferentes sobre o mesmo dinheiro. */
    const { data: alterado, error } = await auth.supabase.from("lancamentos_caixa").delete().eq("id", cashId).select("id").maybeSingle();
    if (error) return falhaFinanceiro(error, "excluir_lancamento");
    if (!alterado) return Response.json({ error: "O lançamento deixou de existir antes da exclusão." }, { status: 409 });
    const auditError = await registrar("Excluir lançamento", null);
    if (antes.recebimento_id) {
      const { error: reopenError } = await auth.supabase.from("recebimentos")
        .update({ status: "pendente", data_recebimento: null }).eq("id", antes.recebimento_id);
      if (reopenError) return falhaFinanceiro(reopenError, "reabrir_parcela_apos_exclusao", { parcial: true });
      if (auditError) return falhaFinanceiro(auditError, "auditar_exclusao_lancamento", { parcial: true });
      return Response.json({ success: true, reopened: true });
    }
    if (auditError) return falhaFinanceiro(auditError, "auditar_exclusao_lancamento", { parcial: true });
    return Response.json({ success: true });
  }

  if (action === "createReceipt") {
    const saleId = clean(body.saleId, 50); const value = Number(body.value); const due = clean(body.due, 10); const installment = Number(body.installment);
    if (!saleId || !Number.isFinite(value) || value <= 0 || !due || !Number.isSafeInteger(installment) || installment < 1) return Response.json({ error: "Informe venda, parcela, vencimento e valor." }, { status: 422 });
    const denied = guard([["financeiro", "criar"], ["fluxo_caixa", "criar"]], "Você não tem permissão para lançar recebimentos.");
    if (denied) return denied;
    const { error } = await auth.supabase.from("recebimentos").insert({ venda_id: saleId, numero_parcela: installment, valor_total: value, data_prevista: due, status: "pendente" });
    return error ? falhaFinanceiro(error, "criar_recebimento") : Response.json({ success: true });
  }

  if (action === "settleReceipt") {
    const receiptId = clean(body.receiptId, 50); const received = body.received !== false;
    if (!receiptId) return Response.json({ error: "Recebimento inválido." }, { status: 422 });
    const denied = guard([["fluxo_caixa", "conciliar"], ["financeiro", "editar"]], "Você não tem permissão para dar baixa em recebimentos.");
    if (denied) return denied;
    const { data: atualizado, error } = await auth.supabase.from("recebimentos").update({ status: received ? "recebido" : "pendente", data_recebimento: received ? hojeOperacao() : null }).eq("id", receiptId).select("id").maybeSingle();
    if (error) return falhaFinanceiro(error, "baixar_recebimento");
    if (!atualizado) return Response.json({ error: "Recebimento não encontrado ou indisponível." }, { status: 404 });
    return Response.json({ success: true });
  }

  if (action === "updateSale") {
    const saleId = clean(body.saleId, 50); const status = clean(body.status, 20); const percent = Number(body.percent);
    if (!saleId || !['pendente', 'concluido', 'pago', 'distrato'].includes(status) || !Number.isFinite(percent) || percent < 0 || percent > 100) return Response.json({ error: "Dados da venda inválidos." }, { status: 422 });
    const denied = guard([["vendas", "editar"], ["financeiro", "editar"]], "Você não tem permissão para editar vendas.");
    if (denied) return denied;
    /* Mesmo buraco do createSale: mudar o status para concluído/pago não
       carimbava a conclusão, então a venda continuava fora do VGV. Aqui o
       carimbo usa a data da venda, pelo mesmo motivo — o resultado pertence ao
       mês em que a venda aconteceu.

       Só carimba se ainda estiver vazio: venda que passou pela Esteira já tem
       a data oficial do gatilho, e sobrescrever mudaria o mês de um resultado
       já fechado. */
    const patchVenda: Record<string, unknown> = {
      status: status as "pendente" | "concluido" | "pago" | "distrato",
      percentual_comissao: percent / 100,
      forma_pgto: clean(body.payment, 100) || null,
      obs: clean(body.notes, 1000) || null,
    };
    /* A ficha da venda virou o mesmo formulario do lancamento (ago/2026), entao
       o updateSale precisa aceitar os mesmos campos. Cada um so entra no patch
       se veio no corpo — assim quem chama so o status continua funcionando. */
    if (typeof body.dataVenda === "string" && clean(body.dataVenda, 10)) patchVenda.data_venda = clean(body.dataVenda, 10);
    if (body.vgv !== undefined) { const vgv = Number(body.vgv); if (!Number.isFinite(vgv) || vgv <= 0) return Response.json({ error: "VGV inválido." }, { status: 422 }); patchVenda.vgv = vgv; }
    if (body.custos !== undefined) { const custos = Number(body.custos); patchVenda.custos = Number.isFinite(custos) && custos >= 0 ? custos : 0; }
    if (body.empreendimentoId !== undefined) patchVenda.empreendimento_id = clean(body.empreendimentoId, 60) || null;
    if (body.empreendimentoNome !== undefined) patchVenda.empreendimento_nome = clean(body.empreendimentoNome, 200) || null;
    if (body.unidade !== undefined) patchVenda.unidade_rotulo = clean(body.unidade, 120) || null;
    if (body.clienteNome !== undefined) patchVenda.cliente_nome = clean(body.clienteNome, 200) || null;
    if (body.proprietarioNome !== undefined) patchVenda.proprietario_nome = clean(body.proprietarioNome, 200) || null;
    if (Array.isArray(body.documentos)) {
      patchVenda.documentos = (body.documentos as unknown[]).filter((doc) => doc && typeof doc === "object").map((doc) => {
        const d = doc as Record<string, unknown>;
        return { nome: clean(d.nome, 200), path: clean(d.path, 1000), bucket: clean(d.bucket, 60) || "esteira-docs" };
      }).filter((doc) => doc.path).slice(0, 30);
    }
    if (status === "concluido" || status === "pago") {
      const { data: atual, error: atualError } = await auth.supabase.from("vendas").select("data_venda,data_conclusao").eq("id", saleId).maybeSingle();
      if (atualError) return falhaFinanceiro(atualError, "consultar_venda_para_atualizacao");
      if (atual && !atual.data_conclusao) patchVenda.data_conclusao = atual.data_venda;
    }
    const { error } = await auth.supabase.from("vendas").update(patchVenda as never).eq("id", saleId);
    if (error) return falhaFinanceiro(error, "atualizar_venda");
    if (status === "pago") {
      const { error: receiptError } = await auth.supabase.from("recebimentos").update({ status: "recebido", data_recebimento: hojeOperacao() }).eq("venda_id", saleId).neq("status", "recebido");
      if (receiptError) return falhaFinanceiro(receiptError, "baixar_parcelas_apos_venda", { parcial: true });
    }
    return Response.json({ success: true });
  }
  /* REPASSE DE COMISSAO - FONTE UNICA (ago/2026).

     Antes deste bloco, "paguei o corretor" so existia como lancamento de caixa
     com natureza='comissao_paga', criado a mao pela aba Fluxo de Caixa. Era um
     caminho escondido: quem estava na ficha da venda nao tinha como registrar,
     e a comissao nunca sabia se tinha sido paga.

     Agora a agenda vive em pagamentos_comissao: uma linha por parcela de
     repasse, com previsao (status='previsto', data_prevista) e baixa
     (status='pago', data_pagamento). O lancamento de caixa passa a ser
     DERIVADO - gerado por settlePayout e apagado quando a baixa e desfeita.
     Nao lance comissao paga a mao no caixa: vira dinheiro contado duas vezes. */

  if (action === "savePayout") {
    const denied = guard([["vendas", "editar"], ["financeiro", "editar"]], "Voce nao tem permissao para lancar repasses de comissao.");
    if (denied) return denied;
    const payoutId = clean(body.payoutId, 50);
    const saleId = clean(body.saleId, 50);
    const valor = Number(body.valor);
    const ordemRaw = Number(body.ordem);
    const dataPrevista = clean(body.dataPrevista, 10) || null;
    const beneficiarioId = clean(body.beneficiarioId, 60);
    const papel = clean(body.papel, 40);
    const papeisValidos = ["corretor", "executivo", "indicacao", "apecerto", "gerente"];
    if (!saleId || !Number.isFinite(valor) || valor <= 0) return Response.json({ error: "Informe a venda e um valor de repasse maior que zero." }, { status: 422 });
    if (!beneficiarioId) return Response.json({ error: "Escolha quem vai receber o repasse." }, { status: 422 });
    if (!papeisValidos.includes(papel)) return Response.json({ error: "Papel invalido para o repasse." }, { status: 422 });
    const linha: Record<string, unknown> = {
      venda_id: saleId,
      comissao_id: clean(body.comissaoId, 60) || null,
      beneficiario_id: beneficiarioId,
      papel,
      valor,
      ordem: Number.isSafeInteger(ordemRaw) && ordemRaw > 0 ? ordemRaw : 1,
      data_prevista: dataPrevista,
      status: "previsto",
      data_pagamento: null,
      observacao: clean(body.observacao, 500) || null,
    };
    if (payoutId) {
      const { data: atualizado, error } = await auth.supabase.from("pagamentos_comissao").update(linha as never).eq("id", payoutId).neq("status", "pago").select("id").maybeSingle();
      if (error) return falhaFinanceiro(error, "atualizar_repasse");
      if (!atualizado) return Response.json({ error: "Repasse pago só pode ser alterado depois de desfazer a baixa.", erro: "repasse_ja_pago" }, { status: 409 });
      return Response.json({ success: true });
    }
    const { data: criado, error } = await auth.supabase.from("pagamentos_comissao").insert(linha as never).select("id").single();
    return error || !criado ? falhaFinanceiro(error, "criar_repasse") : Response.json({ success: true, payoutId: criado.id });
  }

  if (action === "settlePayout") {
    const denied = guard([["fluxo_caixa", "conciliar"], ["financeiro", "editar"]], "Voce nao tem permissao para dar baixa em repasses.");
    if (denied) return denied;
    const payoutId = clean(body.payoutId, 50);
    const pago = body.pago === true;
    const dataPagamento = clean(body.dataPagamento, 10) || hojeOperacao();
    if (!payoutId) return Response.json({ error: "Repasse invalido." }, { status: 422 });
    const resultado = await decidirRepasseAtomico(semTipos(auth.supabase), payoutId, pago, dataPagamento);
    if (resultado.erroInterno && resultado.status >= 500) console.error("financeiro_repasse_rpc_falhou", { codigo: resultado.erroInterno.code ?? "desconhecido" });
    return Response.json(resultado.body, { status: resultado.status });
  }

  if (action === "deletePayout") {
    const denied = guard([["vendas", "editar"], ["financeiro", "editar"]], "Voce nao tem permissao para remover repasses.");
    if (denied) return denied;
    const payoutId = clean(body.payoutId, 50);
    if (!payoutId) return Response.json({ error: "Repasse invalido." }, { status: 422 });
    const { data: lido, error: readError } = await auth.supabase.from("pagamentos_comissao").select("*").eq("id", payoutId).maybeSingle();
    if (readError) return falhaFinanceiro(readError, "consultar_repasse_para_exclusao");
    if (!lido) return Response.json({ error: "Repasse nao encontrado." }, { status: 404 });
    const atual = lido ? lido as typeof lido & RepasseColunasNovas : null;
    let removeuLancamento = false;
    if (atual?.lancamento_id) {
      const { error: cashDeleteError } = await auth.supabase.from("lancamentos_caixa").delete().eq("id", atual.lancamento_id);
      if (cashDeleteError) return falhaFinanceiro(cashDeleteError, "remover_caixa_antes_repasse");
      removeuLancamento = true;
    }
    const { error } = await auth.supabase.from("pagamentos_comissao").delete().eq("id", payoutId);
    return error ? falhaFinanceiro(error, "excluir_repasse", { parcial: removeuLancamento }) : Response.json({ success: true });
  }

  if (action === "saveReceipt") {
    const denied = guard([["vendas", "editar"], ["financeiro", "editar"]], "Voce nao tem permissao para editar recebimentos.");
    if (denied) return denied;
    const receiptId = clean(body.receiptId, 50);
    const saleId = clean(body.saleId, 50);
    const valor = Number(body.valor);
    const parcela = Number(body.numeroParcela);
    if (!Number.isFinite(valor) || valor <= 0) return Response.json({ error: "Informe um valor maior que zero." }, { status: 422 });
    const linha: Record<string, unknown> = {
      numero_parcela: Number.isSafeInteger(parcela) && parcela > 0 ? parcela : 1,
      valor_total: valor,
      data_prevista: clean(body.dataPrevista, 10) || null,
    };
    if (receiptId) {
      const { error } = await auth.supabase.from("recebimentos").update(linha as never).eq("id", receiptId);
      return error ? falhaFinanceiro(error, "atualizar_recebimento") : Response.json({ success: true });
    }
    if (!saleId) return Response.json({ error: "Venda invalida." }, { status: 422 });
    linha.venda_id = saleId;
    linha.status = "pendente";
    const { error } = await auth.supabase.from("recebimentos").insert(linha as never);
    return error ? falhaFinanceiro(error, "criar_recebimento_venda") : Response.json({ success: true });
  }

  if (action === "deleteReceipt") {
    const denied = guard([["vendas", "editar"], ["financeiro", "editar"]], "Voce nao tem permissao para remover recebimentos.");
    if (denied) return denied;
    const receiptId = clean(body.receiptId, 50);
    if (!receiptId) return Response.json({ error: "Recebimento invalido." }, { status: 422 });
    const { error } = await auth.supabase.from("recebimentos").delete().eq("id", receiptId);
    return error ? falhaFinanceiro(error, "excluir_recebimento") : Response.json({ success: true });
  }

  /* IMPORTACAO DE EXTRATO BANCARIO (ago/2026).

     Vale daqui pra frente: sem backfill, sem conciliacao de historico. Cada
     linha do arquivo entra como pendente e espera a decisao do usuario.

     A ORDEM DA SUGESTAO NAO E ARBITRARIA. Foi tirada de um extrato real:
       1. casa com lancamento que ja existe (mesmo valor, data proxima)
       2. senao, e Pix para o proprio titular -> transferencia entre contas
       3. senao, lancamento novo, categoria vinda de caixa_keywords
     Naquele extrato havia um Pix de R$ 9.980 para o proprio titular que era,
     na verdade, uma comissao ja lancada. Se a regra 2 viesse antes da 1, esse
     dinheiro sumiria da conciliacao. */

  if (action === "importarExtrato") {
    const denied = guard([["fluxo_caixa", "conciliar"], ["financeiro", "criar"]], "Voce nao tem permissao para importar extrato.");
    if (denied) return denied;
    const brutas = Array.isArray(body.linhas) ? body.linhas as Array<Record<string, unknown>> : [];
    if (brutas.length === 0) return Response.json({ error: "Nenhum lancamento encontrado no arquivo." }, { status: 422 });
    const titular = clean(body.titular, 200);
    const conta = clean(body.conta, 40);

    const { data: importacao, error: impError } = await semTipos(auth.supabase).from("extrato_importacao").insert({
      banco: clean(body.banco, 20) || null,
      agencia: clean(body.agencia, 20) || null,
      conta: conta || null,
      titular: titular || null,
      periodo_inicio: clean(body.periodoInicio, 10) || null,
      periodo_fim: clean(body.periodoFim, 10) || null,
      saldo_abertura: Number.isFinite(Number(body.saldoAbertura)) ? Number(body.saldoAbertura) : null,
      saldo_fechamento: Number.isFinite(Number(body.saldoFechamento)) ? Number(body.saldoFechamento) : null,
      arquivo_nome: clean(body.arquivoNome, 200) || null,
      linhas_total: brutas.length,
    } as never).select("id").single();
    if (impError || !importacao) return falhaFinanceiro(impError, "registrar_importacao_extrato");
    const importacaoId = importacao.id as string;

    // Contexto para as sugestoes: caixa recente, categorias e palavras-chave.
    const datas = brutas.map((l) => clean(l.data, 10)).filter(Boolean).sort();
    const de = datas[0] || null;
    const ate = datas[datas.length - 1] || null;
    const [caixaContexto, chavesContexto] = await Promise.all([
      auth.supabase.from("lancamentos_caixa").select("id,data,valor,tipo,categoria,descricao")
        .gte("data", de ? (somarDias(de, -5) || "1900-01-01") : "1900-01-01")
        .lte("data", ate ? (somarDias(ate, 5) || "2999-12-31") : "2999-12-31"),
      auth.supabase.from("caixa_keywords").select("categoria,keyword,prioridade").order("prioridade", { ascending: true }),
    ]);
    const contextoError = caixaContexto.error ?? chavesContexto.error;
    if (contextoError) return falhaFinanceiro(contextoError, "carregar_contexto_extrato", { parcial: true });
    const caixaProximo = caixaContexto.data;
    const chaves = chavesContexto.data;

    const semAcento = (texto: string) => texto.normalize("NFD").replace(new RegExp("[" + String.fromCharCode(0x300) + "-" + String.fromCharCode(0x36f) + "]", "g"), "").toLowerCase();
    const titularNormalizado = semAcento(titular).replace(/\b(ltda|me|epp|eireli|s\.?a\.?)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
    const usados = new Set<string>();

    const linhas = brutas.map((bruta) => {
      const data = clean(bruta.data, 10);
      const valor = Number(bruta.valor);
      const descricao = clean(bruta.descricao, 400);
      const saldo = Number.isFinite(Number(bruta.saldo)) ? Number(bruta.saldo) : null;
      const descricaoLimpa = semAcento(descricao);

      // 1. Ja existe no caixa? Mesmo valor absoluto, data a ate 3 dias.
      let sugestao = "novo";
      let sugestaoLancamento: string | null = null;
      const candidato = (caixaProximo ?? []).find((mov) => {
        if (usados.has(mov.id as string)) return false;
        if (Math.abs(Math.abs(Number(mov.valor)) - Math.abs(valor)) > 0.02) return false;
        const dias = Math.abs(new Date(`${mov.data}T12:00:00`).getTime() - new Date(`${data}T12:00:00`).getTime()) / 864e5;
        return dias <= 3;
      });
      if (candidato) { sugestao = "vincular"; sugestaoLancamento = candidato.id as string; usados.add(candidato.id as string); }
      // 2. Transferencia para o proprio titular.
      else if (titularNormalizado.length > 6 && titularNormalizado.split(" ").filter((p) => p.length > 3).every((parte) => descricaoLimpa.includes(parte))) {
        sugestao = "transferencia";
      }

      // 3. Categoria sugerida pelas palavras-chave ja cadastradas.
      const chave = (chaves ?? []).find((k) => descricaoLimpa.includes(semAcento(String(k.keyword || ""))));

      return {
        importacao_id: importacaoId,
        data,
        descricao,
        valor,
        saldo,
        impressao: `${conta}|${data}|${valor}|${saldo ?? ""}|${descricao}`.slice(0, 500),
        situacao: "pendente",
        sugestao,
        sugestao_lancamento_id: sugestaoLancamento,
        categoria_sugerida: chave ? String(chave.categoria) : null,
      };
    }).filter((linha) => linha.data && Number.isFinite(linha.valor));

    // upsert por impressao: reimportar o mesmo periodo nao duplica nada.
    const { error: linhaError } = await semTipos(auth.supabase).from("extrato_linha").upsert(linhas as never, { onConflict: "impressao", ignoreDuplicates: true });
    if (linhaError) return falhaFinanceiro(linhaError, "gravar_linhas_extrato", { parcial: true });
    return Response.json({ success: true, importacaoId, linhas: linhas.length });
  }

  if (action === "resolverLinhaExtrato" || action === "resolverLoteExtrato") {
    const denied = guard([["fluxo_caixa", "conciliar"], ["financeiro", "criar"]], "Voce nao tem permissao para conciliar o extrato.");
    if (denied) return denied;

    const emLote = action === "resolverLoteExtrato";
    let alvos: Array<Record<string, unknown>> = [];
    if (emLote) {
      const importacaoId = clean(body.importacaoId, 50);
      const consulta = semTipos(auth.supabase).from("extrato_linha").select("*").eq("situacao", "pendente");
      const { data, error } = importacaoId ? await consulta.eq("importacao_id", importacaoId) : await consulta;
      if (error) return falhaFinanceiro(error, "consultar_lote_extrato");
      alvos = (data ?? []) as Array<Record<string, unknown>>;
    } else {
      const linhaId = clean(body.linhaId, 50);
      if (!linhaId) return Response.json({ error: "Linha invalida." }, { status: 422 });
      const { data, error } = await semTipos(auth.supabase).from("extrato_linha").select("*").eq("id", linhaId).maybeSingle();
      if (error) return falhaFinanceiro(error, "consultar_linha_extrato");
      if (!data) return Response.json({ error: "Linha nao encontrada." }, { status: 404 });
      alvos = [data as Record<string, unknown>];
    }

    let lancadas = 0, vinculadas = 0, ignoradas = 0, pulou = 0;
    const houveMudanca = () => lancadas + vinculadas + ignoradas > 0;
    for (const linha of alvos) {
      const decisaoPedida = clean(body.decisao, 20);
      const decisao = emLote
        ? (linha.sugestao === "vincular" ? "vincular" : linha.sugestao === "transferencia" ? "ignorar" : "lancar")
        : (["lancar", "vincular", "ignorar"].includes(decisaoPedida) ? decisaoPedida : "lancar");

      if (decisao === "ignorar") {
        const { error: ignoreError } = await semTipos(auth.supabase).from("extrato_linha").update({ situacao: "ignorado", resolvido_por: auth.user.id, resolvido_em: new Date().toISOString() } as never).eq("id", linha.id as string);
        if (ignoreError) return falhaFinanceiro(ignoreError, "ignorar_linha_extrato", { parcial: houveMudanca() });
        ignoradas++;
        continue;
      }
      if (decisao === "vincular" && linha.sugestao_lancamento_id) {
        const { error: vinculoError } = await semTipos(auth.supabase).from("extrato_linha").update({ situacao: "vinculado", lancamento_id: linha.sugestao_lancamento_id, resolvido_por: auth.user.id, resolvido_em: new Date().toISOString() } as never).eq("id", linha.id as string);
        if (vinculoError) return falhaFinanceiro(vinculoError, "vincular_linha_extrato", { parcial: houveMudanca() });
        vinculadas++;
        continue;
      }

      const valor = Number(linha.valor);
      const categoria = (emLote ? "" : clean(body.categoria, 80)) || String(linha.categoria_sugerida || "") || "Outros";
      const descricao = (emLote ? "" : clean(body.descricao, 400)) || String(linha.descricao || "");

      /* Categoria de comissao carrega vinculo, igual ao lancamento manual: sem
         venda (e sem a parte, quando e comissao paga) o dinheiro entra no caixa
         solto e nao aparece no repasse da venda. No lote, linha assim fica
         PENDENTE em vez de virar lancamento incompleto. */
      const { data: catInfo, error: categoriaError } = await auth.supabase.from("categorias_caixa").select("natureza").eq("nome", categoria).maybeSingle();
      if (categoriaError) return falhaFinanceiro(categoriaError, "consultar_categoria_extrato", { parcial: houveMudanca() });
      const natureza = String(catInfo?.natureza || "normal");
      const ehComissao = natureza === "comissao_paga" || natureza === "comissao_recebida";
      const vendaId = emLote ? "" : clean(body.saleId, 60);
      const comissaoId = emLote ? "" : clean(body.commissionId, 60);
      if (ehComissao && !vendaId) {
        if (emLote) { pulou++; continue; }
        return Response.json({ error: "Categoria de comissao exige a venda relacionada." }, { status: 422 });
      }
      let beneficiarioId: string | null = null;
      let papel: string | null = null;
      if (comissaoId) {
        const { data: comissao, error: comissaoError } = await auth.supabase.from("comissoes").select("beneficiario_id,papel").eq("id", comissaoId).maybeSingle();
        if (comissaoError) return falhaFinanceiro(comissaoError, "consultar_comissao_extrato", { parcial: houveMudanca() });
        beneficiarioId = (comissao?.beneficiario_id as string) ?? null;
        papel = (comissao?.papel as string) ?? null;
      }
      if (natureza === "comissao_paga" && vendaId && !comissaoId) {
        const { count, error: countError } = await auth.supabase.from("comissoes").select("id", { count: "exact", head: true }).eq("venda_id", vendaId);
        if (countError) return falhaFinanceiro(countError, "contar_comissoes_extrato", { parcial: houveMudanca() });
        if ((count ?? 0) > 0) return Response.json({ error: "Escolha qual comissao / corretor esta sendo pago." }, { status: 422 });
      }

      const { data: criado, error: caixaError } = await auth.supabase.from("lancamentos_caixa").insert({
        tipo: valor < 0 ? "saida" : "entrada",
        categoria,
        data: linha.data,
        valor: Math.abs(valor),
        descricao,
        origem: "extrato",
        natureza,
        venda_id: vendaId || null,
        comissao_id: comissaoId || null,
        beneficiario_id: beneficiarioId,
        papel,
      } as never).select("id").single();
      if (caixaError || !criado) return falhaFinanceiro(caixaError, "lancar_caixa_extrato", { parcial: houveMudanca() });
      const { error: linhaUpdateError } = await semTipos(auth.supabase).from("extrato_linha").update({ situacao: "lancado", lancamento_id: criado.id, resolvido_por: auth.user.id, resolvido_em: new Date().toISOString() } as never).eq("id", linha.id as string);
      if (linhaUpdateError) return falhaFinanceiro(linhaUpdateError, "marcar_linha_extrato", { parcial: true });
      lancadas++;
    }
    return Response.json({ success: true, lancadas, vinculadas, ignoradas, pulou });
  }

  if (action === "deleteSale") {
    const saleId = clean(body.saleId, 50);
    if (!saleId) return Response.json({ error: "Venda inválida." }, { status: 422 });
    const { data: me, error: meError } = await auth.supabase.from("usuarios").select("role").eq("id", auth.user.id).maybeSingle();
    if (meError) return falhaFinanceiro(meError, "autorizar_exclusao_venda");
    if (!me || !papelNoGrupo(me.role, "financeiro")) return Response.json({ error: "Apenas administradores podem apagar vendas." }, { status: 403 });
    // Transação única no banco (venda_excluir): apaga repasses, comissões,
    // parcelas e corretores, solta o negócio do CRM e os lançamentos de caixa, e
    // grava o retrato completo em erp_auditoria. Falhou qualquer passo, nada muda.
    const resultado = await excluirVendaAtomica(semTipos(auth.supabase), saleId);
    if (resultado.erroInterno && resultado.status >= 500) console.error("financeiro_venda_rpc_falhou", { operacao: "excluir", codigo: resultado.erroInterno.code ?? "desconhecido" });
    return Response.json(resultado.body, { status: resultado.status });
  }
  if (action === "addCommission" || action === "updateCommission" || action === "deleteCommission") {
    const { data: me, error: meError } = await auth.supabase.from("usuarios").select("role").eq("id", auth.user.id).maybeSingle();
    if (meError) return falhaFinanceiro(meError, "autorizar_comissao");
    if (!me || !papelNoGrupo(me.role, "financeiro")) return Response.json({ error: "Apenas administradores podem editar comissões." }, { status: 403 });

    if (action === "addCommission") {
      const vendaId = clean(body.saleId, 50); const papelBruto = clean(body.papel, 40); const valor = Number(body.valor);
      const papeis: Enums<"papel_comissao">[] = ["corretor", "executivo", "indicacao", "apecerto", "gerente"];
      const papel = papeis.find((item) => item === papelBruto);
      const beneficiarioId = clean(body.beneficiarioId, 60) || null;
      if (!vendaId || !papel || !Number.isFinite(valor) || valor < 0) return Response.json({ error: "Informe a venda, o papel e um valor não negativo." }, { status: 422 });
      const { error } = await auth.supabase.from("comissoes").insert({ venda_id: vendaId, papel, valor_final: valor, valor_calculado: valor, beneficiario_id: beneficiarioId });
      return error ? falhaFinanceiro(error, "adicionar_comissao") : Response.json({ success: true });
    }
    if (action === "updateCommission") {
      const id = clean(body.commissionId, 60); const valor = Number(body.valor);
      if (!id || !Number.isFinite(valor) || valor < 0) return Response.json({ error: "Comissão inválida." }, { status: 422 });
      const { error } = await auth.supabase.from("comissoes").update({ valor_final: valor }).eq("id", id);
      return error ? falhaFinanceiro(error, "atualizar_comissao") : Response.json({ success: true });
    }
    const id = clean(body.commissionId, 60);
    if (!id) return Response.json({ error: "Comissão inválida." }, { status: 422 });
    const { error } = await auth.supabase.from("comissoes").delete().eq("id", id);
    return error ? falhaFinanceiro(error, "excluir_comissao") : Response.json({ success: true });
  }

  return Response.json({ error: "Ação financeira desconhecida." }, { status: 400 });
}
