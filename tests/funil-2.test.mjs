import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ui = readFileSync(new URL("../app/features/funil-2/Funil2Workspace.tsx", import.meta.url), "utf8");
const gate = readFileSync(new URL("../app/features/crm-nova-era/CrmNovaEraGate.tsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260810150000_funil_2_isolado.sql", import.meta.url), "utf8");
const clareza = readFileSync(new URL("../supabase/migrations/20260810160000_funil_2_cadencia_clara.sql", import.meta.url), "utf8");
const operacao = readFileSync(new URL("../supabase/migrations/20260810170000_funil_2_operacao_completa.sql", import.meta.url), "utf8");
const pesca = readFileSync(new URL("../supabase/migrations/20260810180000_funil_2_pesca_simples.sql", import.meta.url), "utf8");
const conversaPosPesca = readFileSync(new URL("../supabase/migrations/20260810190000_funil_2_conversa_pos_pesca.sql", import.meta.url), "utf8");
const configOperacao = readFileSync(new URL("../supabase/migrations/20260810200000_funil_2_config_operacao.sql", import.meta.url), "utf8");
const aquarioReal = readFileSync(new URL("../supabase/migrations/20260810220000_funil_2_aquario_real.sql", import.meta.url), "utf8");
const aquarioStage = readFileSync(new URL("../supabase/migrations/20260810230000_funil_2_aquario_stage_canonico.sql", import.meta.url), "utf8");
const promocao = readFileSync(new URL("../supabase/migrations/20260811010000_funil_2_migrar_pipes_antigos.sql", import.meta.url), "utf8");
const correcaoPosVisita = readFileSync(new URL("../supabase/migrations/20260811015000_funil_2_corrigir_pos_visita.sql", import.meta.url), "utf8");
const conversaRoute = readFileSync(new URL("../app/api/funil2/conversa/route.ts", import.meta.url), "utf8");
const modelo = readFileSync(new URL("../app/features/funil-2/modelo.ts", import.meta.url), "utf8");
const respostaInstanciasApp = readFileSync(new URL("../supabase/migrations/20260811037000_funil_2_resposta_instancias_app.sql", import.meta.url), "utf8");
const reinicioPiloto = readFileSync(new URL("../supabase/migrations/20260812010000_funil_2_zerar_com_arquivo_e_fila_independente.sql", import.meta.url), "utf8");

test("Funil 2.0 se apresenta como carteira operacional com origens preservadas", () => {
  assert.match(ui, /OPERAÇÃO OFICIAL/);
  assert.match(ui, /Origens preservadas/);
  assert.match(ui, /Aquário fora da migração/);
  assert.match(promocao, /DROP TRIGGER IF EXISTS f2_lead_limite_dois/);
});

test("promoção migra somente pipes antigos e exclui o Aquário", () => {
  assert.match(promocao, /pipeline_id IN \(2,3,4\)/);
  assert.match(promocao, /stage_id IS DISTINCT FROM public\.aquario_stage_id\(\)/);
  assert.match(promocao, /f2_migracao_invalida:aquario_incluido/);
  assert.match(promocao, /origens_preservadas/);
  assert.doesNotMatch(promocao, /UPDATE public\.(?:negocios|leads|visitas|vendas)/);
  assert.doesNotMatch(promocao, /DELETE FROM public\.(?:negocios|leads|visitas|vendas)/);
});

test("reinício do piloto arquiva as cópias, preserva os originais e mantém os 99 programados", () => {
  assert.match(reinicioPiloto, /f2_arquivo_batch/);
  assert.match(reinicioPiloto, /f2_arquivo_item/);
  assert.match(reinicioPiloto, /f2_restaurar_arquivo/);
  assert.match(reinicioPiloto, /rename column funil_lead_id to funil_lead_arquivo_id/i);
  assert.match(reinicioPiloto, /add column if not exists funil_lead_id uuid null/i);
  assert.match(reinicioPiloto, /insert into public\.f2_lead/);
  assert.match(reinicioPiloto, /codigo='PRIMEIRA_ABORDAGEM'/);
  assert.match(reinicioPiloto, /v_fila<>99/);
  assert.match(reinicioPiloto, /f2_distribuicao_controle/);
  assert.match(reinicioPiloto, /pausado_pelo_gestor/);
  assert.match(reinicioPiloto, /cron\.unschedule\('f2-distribuicao-programada-20260805'\)/);
  assert.match(reinicioPiloto, /f2_cron_nao_foi_desagendado/);
  assert.doesNotMatch(reinicioPiloto, /delete from public\.(?:leads|negocios|wa_mensagens|visitas|vendas)/i);
  assert.doesNotMatch(reinicioPiloto, /update public\.(?:visitas|vendas)/i);
});

test("quadro deixa etapa, momento, ação e prazo explícitos", () => {
  for (const texto of ["MOMENTO", "FAÇA AGORA", "O QUE FAZER AGORA", "Próxima ação", "Prazo padrão"]) assert.match(ui, new RegExp(texto));
  assert.match(ui, /<select value=\{codigo\}/);
});

test("Funil 2.0 inclui mapa interativo de etapas, momentos, ações e prazos", () => {
  assert.match(ui, /function MapaOperacao/);
  assert.match(ui, /MAPA DA OPERAÇÃO/);
  assert.match(ui, /Etapa organiza\. Momento explica\. Ação e prazo movem o dia\./);
  assert.match(ui, /aria-label="Etapas oficiais do funil"/);
  assert.match(ui, /onClick=\{\(\) => onEtapa\(etapa\.codigo\)\}/);
  assert.match(ui, /momento\.acao_rotulo/);
  assert.match(ui, /momento\.prazo_rotulo/);
});

test("sandbox não escreve em tabelas operacionais e tem dez momentos", () => {
  const criacoes = [...migration.matchAll(/CREATE TABLE public\.(\w+)/g)].map((m) => m[1]);
  assert.deepEqual(criacoes, ["f2_momento_config", "f2_lead", "f2_evento"]);
  assert.equal((migration.match(/^ \('[A-Z_]+','/gm) ?? []).length, 10);
  assert.doesNotMatch(migration, /UPDATE public\.(?:ncrm_estado|negocios|leads|visitas|vendas)/);
  assert.doesNotMatch(migration, /DELETE FROM public\.(?:ncrm_estado|negocios|leads|visitas|vendas)/);
});

test("acesso visual é explícito e administrativo; RLS repete a regra", () => {
  assert.match(gate, /pedeFunil2/);
  assert.match(gate, /podeFunil2/);
  assert.match(gate, /Funil2Workspace/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/g);
  assert.match(migration, /CREATE POLICY f2_lead_admin_select/);
  assert.match(migration, /REVOKE ALL ON public\.f2_momento_config,public\.f2_lead,public\.f2_evento FROM PUBLIC,anon/);
});

test("mensagem precisa de confirmação D-API e toda mudança gera histórico", () => {
  assert.match(migration, /confirmacao_dapi_obrigatoria/);
  assert.match(migration, /'acao_confirmada'/);
  assert.match(migration, /'sara_reavaliou'/);
  assert.match(ui, /Simular evidência confirmada/);
  assert.match(ui, /o webhook do D-API executará esta confirmação/);
});

test("cadência mostra com honestidade o passo oficial em implementação", () => {
  assert.match(modelo, /TOTAL_TENTATIVAS_CADENCIA = 6/);
  assert.match(modelo, /FOLGA_ENTRE_TENTATIVAS = \[0, 1, 1, 1, 2, 1\]/);
  assert.match(ui, /CADÊNCIA OFICIAL/);
  assert.match(ui, /Enviar tentativa/);
  assert.match(ui, /f2-em-obra/);
  assert.match(ui, /passo exato que deve ser executado agora/);
});

test("card e ficha oferecem conversa e atalhos operacionais", () => {
  assert.match(ui, />💬 Chat</);
  assert.match(ui, /LeadChatDrawer/);
  assert.match(ui, /readOnly/);
  assert.match(ui, /WhatsApp/);
  assert.match(ui, /Agendar visita/);
  assert.match(ui, /Gerar negociação/);
});

test("chat identifica a instância D-API atual e diferencia histórico com mais de uma", () => {
  assert.match(ui, /LeadChatDrawer/);
  assert.match(ui, /leadChat/);
  assert.match(ui, /negocioChat/);
  assert.match(ui, /corretorNome=\{lead\.corretor_nome/);
});

test("corretor usa o Funil 2.0 no celular sem ganhar acesso ao desktop administrativo", () => {
  assert.match(gate, /entrouNoFunil2[\s\S]*!podeLive \|\| !podeFunil2/);
  assert.match(gate, /ehCelular === true[\s\S]*<Funil2Workspace/);
  assert.match(respostaInstanciasApp, /f2_lead_corretor_select/);
  assert.match(respostaInstanciasApp, /f2_corretor_atual/);
  assert.match(respostaInstanciasApp, /REVOKE INSERT,UPDATE,DELETE,TRUNCATE/);
});

test("tentando contato é impossível depois de uma resposta real do cliente", () => {
  assert.match(respostaInstanciasApp, /f\.momento_codigo='CADENCIA_SEM_RESPOSTA'/);
  assert.match(respostaInstanciasApp, /wm\.direcao='recebida'/);
  assert.match(respostaInstanciasApp, /momento_codigo='CONVERSANDO_QUALIFICANDO'/);
  assert.match(respostaInstanciasApp, /Resposta do cliente encontrada — cadencia encerrada/);
  assert.match(respostaInstanciasApp, /v_status:=''revisao_humana''/);
});

test("Pós-visita exige evidência real e corrige o estado antigo sem tocar nas origens", () => {
  assert.match(correcaoPosVisita, /sem_visita_realizada/);
  assert.match(correcaoPosVisita, /fv\.status='realizada'/);
  assert.match(correcaoPosVisita, /promover_visita_realizada/);
  assert.match(correcaoPosVisita, /origens_preservadas/);
  assert.doesNotMatch(correcaoPosVisita, /UPDATE public\.(?:negocios|leads|visitas|vendas)/);
  assert.doesNotMatch(correcaoPosVisita, /DELETE FROM public\.(?:negocios|leads|visitas|vendas)/);
});

test("lead pescado nasce sem expor o histórico anterior no Funil 2.0", () => {
  assert.match(conversaPosPesca, /corte_conversa_em timestamptz/);
  assert.match(conversaPosPesca, /COALESCE\(corte_conversa_em, criado_em\)/);
  assert.match(conversaRoute, /from\("f2_lead"\)/);
  assert.match(conversaRoute, /historico_completo/);
  assert.match(conversaRoute, /\.gte\("criado_em", corte\)/);
  assert.match(ui, /histórico anterior fica oculto/);
  assert.doesNotMatch(ui, /O histórico permanece disponível/);
});

test("card e ficha separam etapa, momento e próxima ação", () => {
  assert.match(ui, /f2-card-trio/);
  assert.match(ui, /f2-agora-grid/);
  assert.match(ui, /className="etapa"/);
  assert.match(ui, /className="momento"/);
  assert.match(ui, /className="acao"/);
  assert.match(ui, /PRÓXIMA AÇÃO/);
});

test("central de atenção lista obrigações acionáveis e não apenas contadores", () => {
  assert.match(ui, /function CentralAtencao/);
  assert.match(ui, /f2-avisos-lista/);
  assert.match(ui, /Abrir Meu Dia completo/);
  /* Era "leads novos". A lista passou a incluir o pescado que ainda não foi
     chamado — a coluna dele continua sendo Pescado, mas o atalho para chamar
     mora aqui —, então o rótulo virou "para chamar", que é o que a lista é. */
  assert.match(ui, /para chamar/);
  assert.match(ui, /esperandoPrimeiraChamada/);
});

test("Esteira mantém kanban comercial e adiciona visão gerencial do funil antigo", () => {
  assert.match(ui, /f2-vendas-kpis/);
  assert.match(ui, /valor em acompanhamento/);
  assert.match(ui, /vendas concluídas/);
  assert.match(ui, /f2-pipe f2-pipe-vendas/);
});

test("mesmo momento pode ser revalidado sem reiniciar a cadência", () => {
  assert.match(ui, /Continua neste momento · atualizar prazo/);
  assert.match(clareza, /'momento_alterado'/);
  assert.match(clareza, /'mesmo_momento',v_mesmo/);
  assert.match(clareza, /v_atual\.momento_codigo<>'CADENCIA_SEM_RESPOSTA'/);
  assert.match(clareza, /v_dias_cadencia\[v_passo\+1\]-v_dias_cadencia\[v_passo\]/);
});

test("Meu Dia mostra cliente, etapa, momento, tempo e central de atenção", () => {
  for (const texto of ["SEU PLANO DE TRABALHO", "Cliente", "Etapa", "Momento", "Tempo", "CENTRAL DE ATENÇÃO"]) assert.match(ui, new RegExp(texto));
  assert.match(ui, /ações atrasadas/);
  assert.match(ui, /vencem em até 2h/);
});

test("laboratório entrega abas operacionais e pesca sem tocar no legado", () => {
  for (const texto of ["Todos os Leads", "Pipe de Visitas", "Esteira de Vendas", "Configurações da operação", "Pescar um lead"]) assert.match(ui, new RegExp(texto));
  for (const objeto of ["f2_etapa_config", "f2_visita", "f2_negociacao", "f2_config_audit"]) assert.match(operacao, new RegExp(`CREATE TABLE public\\.${objeto}`));
  assert.match(operacao, /f2_pescar_negocio/);
  assert.doesNotMatch(operacao, /UPDATE public\.(?:ncrm_estado|negocios|leads|visitas|vendas)/);
  assert.doesNotMatch(operacao, /DELETE FROM public\.(?:ncrm_estado|negocios|leads|visitas|vendas)/);
});

test("pesca é simples para o usuário e reinicia a cópia em primeira abordagem", () => {
  assert.match(ui, /Pescar lead/);
  assert.match(ui, /Novo · Primeira abordagem/);
  assert.match(ui, /Prazo de 5 minutos/);
  assert.doesNotMatch(ui, /Cópia a substituir|Substituir cópia e pescar/);
  assert.match(pesca, /pg_advisory_xact_lock/);
  assert.match(pesca, /ORDER BY criado_em ASC,id ASC/);
  assert.match(pesca, /etapa='novo'/);
  assert.match(pesca, /momento_codigo='PRIMEIRA_ABORDAGEM'/);
  assert.match(pesca, /proxima_acao_em=now\(\)\+interval '5 minutes'/);
  assert.doesNotMatch(pesca, /UPDATE public\.(?:ncrm_estado|negocios|leads|visitas|vendas)/);
  assert.doesNotMatch(pesca, /DELETE FROM public\.(?:ncrm_estado|negocios|leads|visitas|vendas)/);
});

test("etapas e momentos são configuráveis com proteção administrativa", () => {
  assert.match(ui, /Horas permitidas/);
  assert.match(ui, /Salvar momento e prazo/);
  assert.match(operacao, /f2_configurar_etapa/);
  assert.match(operacao, /f2_configurar_momento/);
  assert.match(operacao, /etapa_em_uso/);
  assert.match(operacao, /momento_em_uso/);
});

test("Todos os Leads filtra pelas etapas do vocabulário oficial", () => {
  assert.match(ui, /const \[filtro, setFiltro\] = useState\("todos"\)/);
  assert.match(ui, /const \[busca, setBusca\]/);
  assert.match(ui, /Nome ou telefone/);
  assert.match(ui, /Situação do prazo/);
  assert.match(ui, /exibidos\.map/);
  assert.match(ui, /Página \{paginaSegura\} de \{totalPaginas\}/);
});

test("Todos os Leads usa linhas compactas com leitura e ações rápidas", () => {
  assert.match(ui, /f2-tabela-compacta/);
  assert.match(ui, /f2-lead-linha/);
  assert.match(ui, /f2-lead-chip etapa/);
  assert.match(ui, /f2-lead-chip momento/);
  assert.match(ui, /f2-lead-acao/);
  assert.match(ui, /f2-lead-acoes/);
});

test("Performance separa disciplina controlável de resultado comercial", () => {
  assert.match(ui, /Performance de Atendimento/);
  assert.match(ui, /PAINEL DO DONO/);
  assert.match(ui, /NOTA DE EXECUÇÃO/);
  assert.match(ui, /SAÚDE DA CARTEIRA/);
  assert.match(ui, /CONVERSÃO COMERCIAL/);
  assert.match(ui, /Resultado comercial não altera a nota disciplinar/);
  for (const peso of ["peso_primeira_abordagem", "peso_acoes_prazo", "peso_feedback_visita", "peso_presenca_dapi", "peso_coerencia_sara"]) {
    assert.match(ui, new RegExp(peso));
  }
});

test("Performance explica a nota, aponta intervenção e compara corretores sem inventar amostra", () => {
  for (const texto of ["QUEM PRECISA DE INTERVENÇÃO", "PLACAR POR CORRETOR", "Carteira em dia", "SLA inicial", "Evidência D-API", "Feedback de visitas", "Coerência Sara", "Sem amostra"]) {
    assert.match(ui, new RegExp(texto));
  }
  assert.match(ui, /eventos=\{eventos\}/);
  assert.match(ui, /evento\.tipo === "acao_confirmada"/);
  assert.match(ui, /Uma métrica sem amostra é retirada do cálculo/);
});

test("configuração única persiste roleta manual, disciplina e pesos sem ligar disparo automático", () => {
  assert.match(ui, /REGRAS DA OPERAÇÃO/);
  assert.match(ui, /Distribuição manual/);
  assert.match(ui, /nunca liga abordagem automática/);
  assert.match(ui, /Abrir distribuição em Automações/);
  assert.match(configOperacao, /CREATE TABLE IF NOT EXISTS public\.f2_operacao_config/);
  assert.match(configOperacao, /f2_configurar_operacao/);
  assert.match(configOperacao, /peso_primeira_abordagem \+ peso_acoes_prazo \+ peso_feedback_visita \+ peso_presenca_dapi \+ peso_coerencia_sara = 100/);
  assert.match(configOperacao, /SECURITY DEFINER SET search_path TO ''/);
  assert.match(configOperacao, /sem_permissao/);
  assert.doesNotMatch(configOperacao, /motor_envia_abordagem|dapi-enviar|enviar-whatsapp/);
});

test("pesca lista somente a base canônica do Aquário e não herda corretor ou histórico", () => {
  assert.match(aquarioReal, /s\.chave='operacao_aquario'/);
  assert.match(aquarioStage, /n\.stage_id=public\.aquario_stage_id\(\)/);
  assert.match(aquarioReal, /n\.corretor_id IS NULL/);
  assert.match(aquarioReal, /l\.corretor_id IS NULL/);
  assert.match(aquarioReal, /'novo','PRIMEIRA_ABORDAGEM'/);
  assert.match(aquarioReal, /NULL,NULL/);
  assert.match(aquarioReal, /corte_conversa_em/);
  assert.doesNotMatch(aquarioReal, /UPDATE public\.(?:ncrm_estado|negocios|leads|visitas|vendas)/);
  assert.doesNotMatch(ui, /c\.corretor_nome/);
});

test("interface declara com honestidade o papel e o estado da Sara no Funil 2.0", () => {
  assert.match(ui, /PAPEL DA SARA/);
  assert.match(ui, /Ela lê, classifica e fiscaliza/);
  assert.match(ui, /Reavaliação automática do Funil 2\.0 ainda não conectada/);
  assert.match(ui, /não envia por você/i);
});
