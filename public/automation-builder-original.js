/* eslint-disable */
/* Extraído sem alterações de reference/CRM_ApeCerto_FINAL.html. */
window.ApeCertoAutomationBuilder = (function(){
"use strict";
var ROOT=null, MAIN=null, _ctx={}, mounted=false, _teardown=[];
var BUILDER_HTML = "<div class=\"app\">\n  <!-- ============ SIDEBAR ============ -->\n  <aside class=\"sidebar\">\n    <div class=\"sb-head\"><h1>Automações</h1><button class=\"sb-collapse-btn\" id=\"sbCollapse\" title=\"Recolher menu\"><svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"m15 18-6-6 6-6\"/></svg></button></div>\n    <div class=\"sb-search\">\n      <svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"color:#94a3b8\"><circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m20 20-3.5-3.5\"/></svg>\n      <input id=\"sbSearch\" placeholder=\"Pesquisar\" />\n    </div>\n    <button class=\"sb-add\" id=\"btnAddAutomation\">\n      <svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\"><path d=\"M12 5v14M5 12h14\"/></svg>\n      Adicionar automação\n    </button>\n    <button class=\"sb-add\" id=\"btnAbordagens\" style=\"background:var(--surface);color:var(--brand);border:1px solid var(--brand);margin-top:0\">\n      <svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M4 4h16v12H5.2L4 17.2V4z\"/></svg>\n      Abordagens (produtos)\n    </button>\n    \n    <button class=\"sb-add\" id=\"btnEscritorio\" style=\"background:var(--surface);color:var(--ink-soft);border:1px solid var(--line);margin-top:0;font-size:12px\">\n      <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M3 21h18M6 21V7l6-4 6 4v14M10 9h4M10 13h4M10 17h4\"/></svg>\n      IP do escritório\n    </button>\n    <div class=\"sb-list\" id=\"sbList\"></div>\n  </aside>\n\n  <!-- ============ MAIN ============ -->\n  <main class=\"main\">\n    <button class=\"sb-open-btn\" id=\"sbOpen\" title=\"Mostrar lista de automações\"><svg width=\"19\" height=\"19\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M3 6h18M3 12h18M3 18h18\"/></svg></button>\n    <div class=\"flow-title\">\n      <h2 id=\"flowName\">CLARIS | Entrada</h2>\n      <p id=\"flowSub\">Contato Inicial</p>\n    </div>\n\n    <button class=\"palette-toggle\" id=\"paletteToggle\" title=\"Blocos básicos\">\n      <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><rect x=\"3\" y=\"3\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\" rx=\"1.5\"/></svg>\n    </button>\n\n    <!-- Toolbar -->\n    <div class=\"toolbar\">\n      <button class=\"tb-btn\" id=\"tbHide\" title=\"Ativar/Desativar\">\n        <svg width=\"17\" height=\"17\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><path d=\"M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"m3 3 18 18\"/></svg>\n      </button>\n      <button class=\"tb-btn\" id=\"tbSave\" title=\"Salvar\">\n        <svg width=\"17\" height=\"17\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><path d=\"M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z\"/><path d=\"M17 21v-8H7v8M7 3v5h8\"/></svg>\n      </button>\n      <button class=\"tb-btn\" id=\"tbEdit\" title=\"Renomear\">\n        <svg width=\"17\" height=\"17\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><path d=\"M12 20h9\"/><path d=\"M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z\"/></svg>\n      </button>\n      <button class=\"tb-btn\" id=\"tbDup\" title=\"Duplicar nó\">\n        <svg width=\"17\" height=\"17\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><rect x=\"9\" y=\"9\" width=\"12\" height=\"12\" rx=\"2\"/><path d=\"M5 15V5a2 2 0 0 1 2-2h10\"/></svg>\n      </button>\n      <button class=\"tb-btn\" id=\"tbDownload\" title=\"Exportar\">\n        <svg width=\"17\" height=\"17\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/><path d=\"M7 10l5 5 5-5M12 15V3\"/></svg>\n      </button>\n      <button class=\"tb-btn\" id=\"tbNote\" title=\"Adicionar nota\">\n        <svg width=\"17\" height=\"17\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><path d=\"M14 3v5h5\"/><path d=\"M4 4a1 1 0 0 1 1-1h9l6 6v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z\"/></svg>\n      </button>\n      <div class=\"tb-sep\"></div>\n      <button class=\"tb-btn danger\" id=\"tbTrash\" title=\"Excluir nó\">\n        <svg width=\"17\" height=\"17\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><path d=\"M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6\"/></svg>\n      </button>\n      <button class=\"tb-btn\" id=\"tbNext\" title=\"Próximo\">\n        <svg width=\"17\" height=\"17\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><path d=\"m9 18 6-6-6-6\"/></svg>\n      </button>\n    </div>\n\n    <!-- Painel Blocos básicos -->\n    <div class=\"palette\" id=\"palette\">\n      <div class=\"palette-h\">\n        <h3>Blocos básicos</h3>\n        <button id=\"paletteClose\" title=\"Fechar\">\n          <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"m18 6-12 12M6 6l12 12\"/></svg>\n        </button>\n      </div>\n      <div class=\"palette-body\" id=\"paletteBody\"></div>\n    </div>\n\n    <!-- Canvas -->\n    <div class=\"canvas\" id=\"canvas\">\n      <div class=\"empty-tip\" id=\"emptyTip\">Clique em um bloco no painel <b>Blocos básicos</b> para começar.</div>\n      <div class=\"world\" id=\"world\">\n        <svg id=\"edges\"></svg>\n      </div>\n    </div>\n\n    <div class=\"zoombar\">\n      <button id=\"zoomIn\" title=\"Aproximar\">+</button>\n      <button id=\"zoomOut\" title=\"Afastar\">–</button>\n      <button id=\"zoomFit\" title=\"Ajustar\" style=\"font-size:13px\">⤢</button>\n    </div>\n  </main>\n</div>\n\n<!-- Drawer lateral -->\n<div class=\"drawer\" id=\"drawer\">\n  <div class=\"dw-head\">\n    <button id=\"drawerBack\" title=\"Voltar\">\n      <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"m15 18-6-6 6-6\"/></svg>\n    </button>\n    <h4 id=\"drawerTitle\">Título</h4>\n  </div>\n  <div class=\"dw-sub\" id=\"drawerSub\"></div>\n  <div class=\"dw-body\" id=\"drawerBody\"></div>\n</div>\n\n<!-- Modal -->\n<div class=\"scrim\" id=\"scrim\">\n  <div class=\"modal\">\n    <div class=\"rail\" id=\"modalRail\"></div>\n    <div class=\"content\">\n      <div class=\"c-head\">\n        <div>\n          <h4 id=\"modalTitle\">Título</h4>\n          <p id=\"modalSub\">Subtítulo</p>\n        </div>\n        <button class=\"x\" id=\"modalClose\">\n          <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"m18 6-12 12M6 6l12 12\"/></svg>\n        </button>\n      </div>\n      <div class=\"c-list\" id=\"modalList\"></div>\n    </div>\n  </div>\n</div>";

function __run(){

/* =====================================================================
   ApeCerto — Construtor de Automações v2
   Edição INLINE dentro de cada bloco. Ligado ao Supabase + motor_rodar.
   Contrato: automacoes.mapa = { editor, automation } (motor lê automation.blocks)
   ===================================================================== */

const SUPA_URL = 'https://diaegvfveqezispcthwk.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpYWVndmZ2ZXFlemlzcGN0aHdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5OTU4MjIsImV4cCI6MjA5ODU3MTgyMn0.312n8BuI-loQrQ20x9j1hNjKZs2UO71ey9gvIo0eY0I';
const REST = SUPA_URL + '/rest/v1';
/* Segurança: usa o token do usuário logado (repassado pela casca do ERP via _ctx.authToken).
   Sem login (ex.: teste isolado) cai para a chave anon. Assim o banco pode exigir
   sessão autenticada (RLS) sem quebrar quando a chave pública deixa de ter acesso. */
function authBearer(){ try{ return (typeof _ctx!=='undefined' && _ctx && _ctx.authToken) ? _ctx.authToken : SUPA_KEY; }catch(_e){ return SUPA_KEY; } }
const H = { apikey: SUPA_KEY, get Authorization(){ return 'Bearer ' + authBearer(); }, 'Content-Type': 'application/json' };
async function sbGet(p){ const r=await fetch(REST+p,{headers:H}); if(!r.ok) throw new Error('GET '+p+' → '+r.status+' '+(await r.text()).slice(0,160)); return r.json(); }
async function sbPatch(p,b){ const r=await fetch(REST+p,{method:'PATCH',headers:{...H,Prefer:'return=representation'},body:JSON.stringify(b)}); if(!r.ok) throw new Error('PATCH '+p+' → '+r.status+' '+(await r.text()).slice(0,160)); return r.json(); }
async function sbPost(p,b){ const r=await fetch(REST+p,{method:'POST',headers:{...H,Prefer:'return=representation'},body:JSON.stringify(b)}); if(!r.ok) throw new Error('POST '+p+' → '+r.status+' '+(await r.text()).slice(0,160)); return r.json(); }
async function sbRpc(fn,a){ const r=await fetch(REST+'/rpc/'+fn,{method:'POST',headers:H,body:JSON.stringify(a||{})}); if(!r.ok) throw new Error('RPC '+fn+' → '+r.status+' '+(await r.text()).slice(0,160)); return r.json(); }
async function sbDelete(p){ const r=await fetch(REST+p,{method:'DELETE',headers:{...H,Prefer:'return=minimal'}}); if(!r.ok) throw new Error('DELETE '+p+' → '+r.status+' '+(await r.text()).slice(0,160)); return true; }

/* estilos movidos para apeab_styles.css */

/* ---------- ícones ---------- */
function ico(n,s=16,c='currentColor',sw=1.8){const p={
 trigger:'<path d="M13 2 3 14h7l-1 8 10-12h-7z"/>',field:'<rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="16" width="18" height="4" rx="1"/>',
 condition:'<path d="M3 3v6l7 5v7l4-2v-5l7-5V3z"/>',action:'<path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/>',
 random:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.4" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.4" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.4" fill="currentColor"/>',
 message:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',wait:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 api:'<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
 flow:'<circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M9 6h6a3 3 0 0 1 3 3v6"/>',play:'<path d="M5 3l16 9-16 9z"/>',monitor:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',x:'<path d="m18 6-12 12M6 6l12 12"/>',trash:'<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
 brief:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/>',insta:'<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>',
 cart:'<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M2 3h3l2.3 11.3a2 2 0 0 0 2 1.7h7.5a2 2 0 0 0 2-1.6L21.5 7H6"/>',gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',clip:'<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>',
 mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 19v3"/>',attach:'<path d="M21 8l-9.2 9.2a3.5 3.5 0 0 1-5-5L15 4a2.3 2.3 0 0 1 3.3 3.3L9.6 16"/>',link:'<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',wa:'<path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2z"/>'
}[n]||'';return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;}

/* ---------- tipos / catálogos ---------- */
const TYPES={
 trigger:{fam:'gatilho',label:'Início',vis:'trigger',cvar:'--c-trigger'},
 'field-operation':{fam:'mapeamento',label:'Operações de campos',vis:'field',cvar:'--c-field'},
 condition:{fam:'condicao',label:'Condição',vis:'condition',cvar:'--c-condition'},
 action:{fam:'acao',label:'Ação',vis:'action',cvar:'--c-action'},
 randomizer:{fam:'randomizador',label:'Randomizador',vis:'random',cvar:'--c-random'},
 distribution:{fam:'distribuicao',label:'Distribuir leads (roleta)',vis:'random',cvar:'--c-ai'},
 chat:{fam:'mensagem',label:'Mensagem',vis:'message',cvar:'--c-message'},
 'send-approach':{fam:'mensagem',label:'Enviar abordagem (corretor do lead)',vis:'message',cvar:'--c-ai'},
 time:{fam:'espera',label:'Espera',vis:'wait',cvar:'--c-wait'},
 api:{fam:'api',label:'API',vis:'api',cvar:'--c-api'}
};
const FAM2TYPE={}; Object.entries(TYPES).forEach(([t,m])=>FAM2TYPE[m.fam]=t);
const ACTIONS=[['create-lead-action','Criar lead','lead'],['create-business-action','Criar negócio','business'],['move-business-action','Mover negócio','business'],['add-attendant-on-business-action','Atribuir corretor','business'],['clean-attendant-on-business-action','Remover corretor','business'],['add-tag-action','Adicionar tag','lead'],['start-another-automation-action','Iniciar outra automação','system']];
const CONDITIONS=[['lead-exists-condition','Lead existe','lead'],['lead-has-business-on-pipeline-condition','Lead tem negócio no funil','business'],['lead-has-business-on-stage-condition','Lead tem negócio na etapa','business'],['business-has-attendants-condition','Negócio tem corretor','business']];
const BETA_TAG='<span style="font-size:8px;font-weight:800;color:#92700a;background:#fef9c3;border-radius:4px;padding:1px 5px;margin-left:5px">INTEGRAÇÃO</span>';
const CONDICOES={
 'Negócios':[['business-has-attendants','Negócio possui atendentes','Verifica se o negócio possui atendentes','none',false],['business-no-attendants','Negócio sem atendentes','Verifica se o negócio não possui atendentes','none',false],['business-won','Negócio está ganho','Verifica se o negócio está ganho','none',false],['business-lost','Negócio está perdido','Verifica se o negócio está perdido','none',false],['business-pending','Negócio está pendente','Verifica se o negócio está pendente','none',false],['business-has-product','Negócio possui o produto','Verifica se o negócio possui um produto','none',true],['business-external-id-exists','Negócio com ID externo existente','Verifica se o negócio com o ID externo informado existe','none',true],['business-search-additional-field','Procura negócio com campo adicional','Verifica/procura um negócio com o campo adicional informado','campo_valor',true]],
 'Leads':[['lead-exists','Lead existente','Verifica se o lead já está cadastrado','none',false],['lead-has-business-on-pipeline','Lead possui negócio na pipeline','Verifica se o lead possui um negócio na pipeline','pipeline',false],['lead-has-business-on-stage','Lead possui negócio na etapa','Verifica se o lead possui um negócio em uma etapa','pipeline_stage',false],['lead-email-exists','Lead com email existente','Verifica se o lead já está cadastrado com um email','none',false],['lead-name-exists','Lead com nome existente','Verifica se o lead já está cadastrado com um nome','none',false],['lead-phone-exists','Lead com telefone existente','Verifica se o lead já está cadastrado com um telefone','none',false],['lead-cpf-exists','Lead com CPF existente','Verifica se o lead já está cadastrado com um CPF','none',false],['lead-has-tag','Verifica se o lead possui uma tag','Verifica se o lead possui uma das tags informadas','tag',false],['lead-has-attendant','Lead possui atendente responsável','Verifica se o lead possui atendente responsável (deixe em branco = qualquer; ou escolha um específico)','corretor',false],['lead-search-additional-field','Procura lead com campo adicional','Verifica/procura um lead com o campo adicional informado','campo_valor',true]],
 'Tempo':[['time-day-hour','Hora atual em intervalo de dia/hora','Verifica se a hora atual está dentro dos dias e horários selecionados','time',false]],
 'Mensagens':[['lead-respondeu','Lead respondeu (WhatsApp)','Verdadeiro se o lead enviou mensagem recebida nas últimas X horas — use depois de um bloco de Espera para separar quem respondeu de quem não respondeu','horas',false],['conversation-has-attendant','Conversa possui atendente responsável','Verifica se a conversa possui atendente responsável','none',true],['conversation-finished','Conversa finalizada','Verifica se a conversa foi finalizada','none',true],['chat-automations-enabled','Automações de chat estão habilitadas','Verifica se as automações de chat estão habilitadas','none',true],['conversation-in-department','Conversa em departamento','Verifica se a conversa está atribuída a um departamento','none',true],['conversation-window-open','Janela de conversa está aberta','Verifica se a última mensagem está dentro da janela','none',true]],
 'Instagram':[['instagram-follower','Seguidor do Instagram','Verifica se o contato é um seguidor do Instagram','none',true]],
 'Campos':[['field-equals','Campo com valor igual','Verifica se um campo possui um valor exatamente igual','campo_valor',false],['field-contains','Campo contém valor','Verifica se um campo contém um valor','campo_valor',false],['field-has-value','Campo possui valor','Verifica se um campo possui um valor','campo',false],['field-between','Campo possui um valor entre dois valores','Verifica se um campo numérico está entre dois valores','campo_between',false]]
};
function condMeta(name){const n=String(name||'').replace(/-condition$/,'');for(const c in CONDICOES){const f=CONDICOES[c].find(x=>x[0]===n);if(f)return f;}return [n,n,'','none',false];}
const ACOES={
 'Negócios':[['create-business-action','Criar negócio','Cria um novo negócio para o lead','pipeline_stage',false],['move-business-action','Mover negócio de etapa','Move um negócio para outra etapa (mesma ou outra pipeline)','pipeline_stage',false],['business-win-action','Ganhar negócio','Altere o negócio para ganho','none',false],['business-restore-action','Restaurar negócio','Restaurar status do negócio','none',false],['business-lose-action','Perder negócio','Altere o negócio para perdido','motivo',false],['add-attendant-on-business-action','Transferir um atendente ao negócio','Transfere um atendente ao negócio (substitui o atual)','corretor',false],['clean-attendant-on-business-action','Remover o atendente do negócio','Remove o atendente do negócio','none',false],['duplicate-business-action','Duplicar negócio','Cria um novo negócio com as mesmas informações','none',true],['add-product-to-business-action','Adicionar um produto ao negócio','Adiciona um produto ao negócio','none',true],['remove-product-from-business-action','Remover um produto do negócio','Remove um produto do negócio ou reduz sua quantidade','none',true],['add-discount-business-action','Adicionar descontos, acréscimo, frete e cupom','Adicionar desconto, acréscimo, frete e cupom ao negócio','none',true],['remove-business-action','Remover negócio','Remove o negócio','none',true]],
 'Leads':[['create-lead-action','Criar lead','Cria o lead com as informações da sessão. Se já existir, não cria novo','none',false],['delete-lead-action','Deletar lead','Deleta o lead. Se não existir, nada é feito','none',true],['create-tags-action','Criar tags','Crie uma ou mais tags para o lead','tag',false],['add-tag-action','Adicionar tags','Adicione uma ou mais tags ao lead','tag',false],['remove-tag-action','Remover tags','Remova uma ou mais tags do lead','tag',false],['add-lists-action','Adicionar listas','Adicione uma ou mais listas ao lead','none',true],['remove-lists-action','Remover listas','Remova uma ou mais listas do lead','none',true],['create-lists-action','Criar listas','Crie uma ou mais listas para o lead','none',true],['add-comment-lead-action','Adicionar comentário no lead','Adiciona um comentário no lead','none',true],['assign-lead-attendant-action','Transferir um atendente ao lead','Transferir o atendente responsável do lead','corretor',false],['clean-lead-attendant-action','Remover atendente do lead','Remover o atendente responsável do lead','none',false]],
 'Mensagens':[['start-service-action','Iniciar o atendimento','Inicia o atendimento da conversa','none',true],['end-service-action','Finalizar o atendimento','Finaliza o atendimento da conversa','none',true],['add-reply-suggestion-action','Adicionar sugestão de resposta','Adicione uma sugestão de resposta para a conversa','none',true],['transfer-conversation-attendant-action','Transferir atendente da conversa','Transfere o atendente da conversa','none',true],['transfer-conversation-department-action','Transferir departamento da conversa','Transfere a conversa para um departamento','none',true],['disable-chat-automations-action','Desativar as automações de chat na conversa','Desativa as automações de chat para a conversa','none',true],['enable-chat-automations-action','Ativar as automações de chat na conversa','Ativa as automações de chat para a conversa','none',true]],
 'Produtos':[],
 'Sistema':[['return-tool-result-action','Retornar resultado da tool','Define o conteúdo retornado como resultado da tool para a IA','none',true],['send-notification-action','Enviar notificação','Envia uma notificação para os usuários','none',true],['start-another-automation-action','Iniciar outra automação','Inicia outra automação passando parâmetros da sessão','automacao',false]],
 'Atividades':[['create-activity-action','Criar atividade','Cria uma atividade vinculada a um lead ou negócio','none',true]]
};
function acaoMeta(name){const n=String(name||'');for(const c in ACOES){const f=ACOES[c].find(x=>x[0]===n);if(f)return f;}return [n,n,'','none',false];}
const CAT_ACAO_ICON={'Negócios':'brief','Leads':'user','Mensagens':'message','Produtos':'cart','Sistema':'gear','Atividades':'clip'};
const ESPERAS={
 'Tempo':[['wait-day-hour-interval','Espera de um intervalo de hora nos dias da semana','Espera um intervalo de hora nos dias da semana selecionados para continuar a execução','intervalo',true],['wait-minutes','Espera de alguns minutos','Espera uma quantidade informada de minutos para continuar a execução','dur:minutos',false],['wait-days','Espera de alguns dias','Espera uma quantidade informada de dias para continuar a execução','dur:dias',false],['wait-hours','Espera de algumas horas','Espera uma quantidade informada de horas para continuar a execução','dur:horas',false],['wait-seconds','Espera de alguns segundos','Espera uma quantidade informada de segundos para continuar a execução','dur:segundos',false],['wait-until-datetime','Espera o dia/horário','Espera um dia e horário para continuar a execução','datetime',true]],
 'Mensagens':[['wait-user-stopped','Usuário parou de responder','Quando o usuário parar de responder','none',true]]
};
function esperaMeta(name){for(const c in ESPERAS){const f=ESPERAS[c].find(x=>x[0]===name);if(f)return f;}return [name,name,'','none',false];}
const CAT_ESPERA_ICON={'Tempo':'wait','Mensagens':'message'};
const ESPERA_SUB={'Tempo':'Adicione espera com base em intervalos de horas','Mensagens':'Adicione espera com base em mensagens'};
function applyEspera(n,name){const m=esperaMeta(name),cfg=m[3];n.opts.wait_type=name;const durMap={'wait-seconds':'segundos','wait-minutes':'minutos','wait-hours':'horas','wait-days':'dias'};if(cfg.indexOf('dur:')===0){n.opts.unidade=durMap[name]||cfg.slice(4);n.opts.valor=n.opts.valor||5;}}
const TRIGGERS=[['json-http-request-trigger','Webhook (HTTP)','system'],['initiated-by-another-automation-trigger','Iniciada por outra automação','system'],['manually-lead-trigger','Manual','system'],['tag-added-trigger','Tag adicionada','lead'],['lead-entered-stage-trigger','Entrou na etapa','business'],['lead-moved-stage-trigger','Mudou de etapa','business']];
const CAMPOS=['{nome}','{primeiro_nome}','{telefone}','{email}','{origem}','{corretor}','{corretor_primeiro_nome}','{produto}'];
// rastreia a posição do cursor no textarea para inserir a variável exatamente onde o usuário parou
function _trackCaret(ta){if(!ta)return;const upd=()=>{ta._caret=ta.selectionStart;};ta.addEventListener('keyup',upd);ta.addEventListener('click',upd);ta.addEventListener('input',upd);ta.addEventListener('blur',upd);}
function insertAtCaret(ta,tok){const p=(typeof ta._caret==='number'&&ta._caret>=0&&ta._caret<=ta.value.length)?ta._caret:ta.value.length;ta.value=ta.value.slice(0,p)+tok+ta.value.slice(p);const np=p+tok.length;ta._caret=np;try{ta.focus();ta.setSelectionRange(np,np);}catch(e){}return ta.value;}
const CAMPOS_DEST={
 'Campos do lead':[['lead_extra.id','ID do lead','#'],['lead.nome','Nome do lead','T'],['lead_extra.primeiro_nome','Primeiro nome do lead','T'],['lead_extra.cep','CEP do lead','T'],['lead_extra.endereco','Endereço do lead','T'],['lead_extra.bairro','Bairro do lead','T'],['lead_extra.numero','Número de residência do lead','T'],['lead_extra.cidade','Cidade do lead','T'],['lead_extra.complemento','Complemento do lead','T'],['lead_extra.estado','Estado do lead','T'],['lead_extra.empresa','Empresa do lead','T'],['lead.email','Email do lead','T'],['lead.telefone','Telefone do lead','T'],['lead_extra.cpf_cnpj','CPF/CNPJ do lead','T'],['lead_extra.site','Site do lead','T'],['lead_extra.referral_source_id','Referral Source Id','T'],['lead_extra.referral_source_url','Referral Source Url','T'],['lead_extra.referral_ctwa_id','Referral Ctwa Id','T'],['lead_extra.notas','Notas do lead','T'],['lead_extra.atendente','Atendente do lead','T'],['lead.instagram','Nome do Instagram','T'],['lead.origem','Origem do lead','T'],['lead_extra.data_nascimento','Data de nascimento','D']],
 'Campos do negócio':[['negocio.id_negocio','ID do negócio','#'],['negocio.valor','Total do negócio','#'],['negocio.codigo','Código do negócio','#'],['negocio.id_externo','ID externo do negócio','T'],['negocio.atendente','Atendente do negócio','T'],['negocio.json_produtos','JSON de produtos do negócio','T'],['negocio.status','Status do negócio','T'],['negocio.motivo_perda','Motivo da perda','T']],
 'Campos do produto':[['produto.nome','Nome do produto','T'],['produto.sku','SKU do produto','T'],['produto.preco','Preço do produto','#']],
 'Campos da conversa':[['conversa.id','ID da conversa','#'],['conversa.atendente','Atendente da conversa','T'],['conversa.codigo','Código da conversa','#'],['conversa.departamento','Departamento','T']],
 'Campos adicionais do lead':[['lead_extra.ad','AD','T'],['lead_extra.campanha','Campanha','T'],['lead_extra.carteira','Carteira','T'],['lead_extra.conjunto_ad','Conjunto de AD','T'],['lead_extra.imovel_interessado','Imovel Interessado','T'],['lead_extra.interesse_botao','interesse botao','L'],['lead_extra.mensagem','Mensagem','T'],['lead_extra.qualificacao','Qualificação','T'],['lead_extra.testeclaudia','TesteClaudia','T']],
 'Campos adicionais do negócio':[['negocio.qualificao_perfil_tempo','qualificao perfil de tempo','T']],
 'Campos adicionais da empresa':[['empresa.qualificao_perfil_tempo','qualificao perfil de tempo','T']],
 'Campos do sistema':[['lead.status','Status do lead','T'],['sistema.data_atual','Data atual','D'],['sistema.hora_atual','Hora atual','T'],['sistema.automacao','Nome da automação','T']],
 'Entrada de dados':[['entrada.api_request_1','Api-request-1','{}']]
};
function _pretty(s){return String(s||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());}
function campoLabel(k){for(const c in CAMPOS_DEST){const f=CAMPOS_DEST[c].find(x=>x[0]===k);if(f)return f[1];}if(!k)return '';const i=k.indexOf('.');return i<0?k:_pretty(k.slice(i+1));}
const grpOf=(a,n)=>(a.find(x=>x[0]===n)||[,,'system'])[2];
const labelOf=(a,n)=>(a.find(x=>x[0]===n)||[,n])[1];

/* ---------- estado ---------- */
const ref={pipelines:[],stages:[],corretores:[],instancias:[],automacoes:[],tags:[],produtos:[],abordagens:[]};
let cur=null, selectedId=null, dirty=false;
const view={x:120,y:120,scale:0.8};
const worldEl=document.getElementById('world'), edgesEl=document.getElementById('edges'), canvasEl=document.getElementById('canvas'), emptyTip=document.getElementById('emptyTip');

/* status bar */
const sb=document.createElement('div');
sb.style.cssText='position:absolute;top:14px;right:16px;z-index:41;display:flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:6px 11px;box-shadow:0 6px 18px rgba(15,23,42,.10);font-size:12px;color:var(--ink-soft)';
sb.innerHTML='<span id="dot" style="width:8px;height:8px;border-radius:50%;background:#cbd5e1"></span><span id="stTxt">Conectando…</span>';
MAIN.appendChild(sb);
function setStatus(t,c){document.getElementById('stTxt').textContent=t;document.getElementById('dot').style.background=c||'#cbd5e1';}
let toastT=null;
function toast(m,k){let t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';ROOT.appendChild(t);t.style.cssText='position:fixed;left:50%;bottom:28px;transform:translateX(-50%);color:#fff;padding:10px 16px;border-radius:9px;font-size:12.5px;font-weight:600;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.28);opacity:0;transition:opacity .18s;max-width:80vw';}t.style.background=k==='err'?'#dc2626':(k==='ok'?'#059669':'#0f172a');t.textContent=m;t.style.opacity='1';clearTimeout(toastT);toastT=setTimeout(()=>t.style.opacity='0',k==='err'?5200:2600);}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function setDirty(){dirty=true;setStatus('Alterações não salvas','#f59e0b');scheduleAutosave();scheduleHistory();}

/* ---------- transform ---------- */
function applyTransform(){worldEl.style.transform=`translate(${view.x}px,${view.y}px) scale(${view.scale})`;scheduleEdges();}
canvasEl.addEventListener('wheel',e=>{e.preventDefault();const f=e.deltaY<0?1.1:.9;const ns=Math.min(2,Math.max(.3,view.scale*f));const r=canvasEl.getBoundingClientRect();const mx=e.clientX-r.left,my=e.clientY-r.top;view.x=mx-(mx-view.x)*(ns/view.scale);view.y=my-(my-view.y)*(ns/view.scale);view.scale=ns;applyTransform();},{passive:false});
let panning=false,panStart=null;
canvasEl.addEventListener('mousedown',e=>{if(e.target.closest('.node')||e.target.closest('.port-dot'))return;panning=true;canvasEl.classList.add('panning');panStart={x:e.clientX-view.x,y:e.clientY-view.y};});
window.addEventListener('mousemove',e=>{if(panning){view.x=e.clientX-panStart.x;view.y=e.clientY-panStart.y;applyTransform();}});
window.addEventListener('mouseup',()=>{panning=false;canvasEl.classList.remove('panning');});
document.getElementById('zoomIn').onclick=()=>{view.scale=Math.min(2,view.scale*1.15);applyTransform();};
document.getElementById('zoomOut').onclick=()=>{view.scale=Math.max(.3,view.scale*.87);applyTransform();};
document.getElementById('zoomFit').onclick=fitView;
function fitView(){const ns=Object.values(cur?cur.nodes:{});if(!ns.length){view.x=160;view.y=140;view.scale=.8;applyTransform();return;}const xs=ns.map(n=>n.x),ys=ns.map(n=>n.y);const minX=Math.min(...xs),maxX=Math.max(...xs)+340,minY=Math.min(...ys),maxY=Math.max(...ys)+260;const cw=canvasEl.clientWidth,ch=canvasEl.clientHeight;const s=Math.min(1,Math.min((cw-120)/(maxX-minX),(ch-120)/(maxY-minY)));view.scale=Math.max(.3,s);view.x=(cw-(maxX-minX)*view.scale)/2-minX*view.scale;view.y=(ch-(maxY-minY)*view.scale)/2-minY*view.scale;applyTransform();}

/* ---------- boot ---------- */
async function boot(){
 try{setStatus('Carregando…','#f59e0b');
  const [pi,stg,co,ins,au]=await Promise.all([
   sbGet('/pipelines?select=id,nome&order=id'),
   sbGet('/pipeline_stages?select=id,pipeline_id,nome,ordem&order=pipeline_id,ordem'),
   sbGet('/corretores?select=id,nome,ativo,peso,online,ordem&order=ordem,nome'),
   sbGet('/instancias?select=id,nome,ativa&order=id'),
   sbGet('/automacoes?select=id,nome,grupo,ativa,status,arquivada,atualizada_em&order=grupo,id')]);
  ref.pipelines=pi;ref.stages=stg;ref.corretores=co;ref.instancias=ins;ref.automacoes=au;if(_ctx&&_ctx.onAutomationsLoaded){try{_ctx.onAutomationsLoaded(au);}catch(_e){}}
  try{ref.tags=await sbRpc('automacao_tags')||[];}catch(_t){ref.tags=[];}
  try{const [pr,ab]=await Promise.all([sbGet('/produtos?select=id,nome,ativo&order=nome'),sbGet('/abordagens?select=id,produto_id,nome,ordem,ativo,mensagens&order=ordem')]);ref.produtos=pr||[];ref.abordagens=ab||[];}catch(_p){ref.produtos=[];ref.abordagens=[];}
  setStatus('Conectado — '+au.length+' automações','#10b981');renderSidebar();
 }catch(e){console.error(e);setStatus('Falha de conexão','#dc2626');toast('Erro ao conectar: '+e.message,'err');}
}
let sbFilter='todas';
function passFilter(a){const arch=!!a.arquivada;if(sbFilter==='arquivadas')return arch;if(arch)return false;if(sbFilter==='ativas')return a.ativa===true;if(sbFilter==='publicadas')return (a.status||'publicado')==='publicado';if(sbFilter==='rascunhos')return (a.status||'publicado')==='rascunho';return true;}
function sbItem(a){const dotc=a.ativa?'#10b981':((a.status||'publicado')==='rascunho'?'#f59e0b':'#94a3b8');const tt=a.arquivada?'arquivada':((a.status||'publicado')+(a.ativa?' · ativa':' · inativa'));
 return `<div class="sb-item ${a.ativa!==true?'off':''} ${cur&&cur.id===a.id?'active':''}" data-id="${a.id}" draggable="true"><span class="flow-ico">${ico('flow',15)}</span><span class="nm">${esc(a.nome)}</span><span title="${tt}" style="width:8px;height:8px;border-radius:50%;background:${dotc};flex:0 0 auto;margin-left:auto"></span><button data-menu style="border:0;background:transparent;color:var(--ink-faint);padding:0 3px;font-size:15px;line-height:1">⋯</button></div>`;}
function renderSidebar(f=''){
 const wrap=document.getElementById('sbList');f=(f||'').trim().toLowerCase();const g={};
 ref.automacoes.filter(a=>passFilter(a)&&(!f||a.nome.toLowerCase().includes(f)||(a.grupo||'').toLowerCase().includes(f))).forEach(a=>{const k=a.grupo||'Sem grupo';(g[k]=g[k]||[]).push(a);});
 wrap.innerHTML=Object.keys(g).map(k=>`<div class="sb-group" data-group="${esc(k)}"><div class="sb-group-h">${ico('flow',13,'var(--ink-faint)')}<span style="flex:1">${esc(k)}</span><button class="sb-grp-add" data-addgrp="${esc(k)}" title="Nova automação neste grupo" style="border:0;background:transparent;color:var(--ink-faint);cursor:pointer;font-size:16px;line-height:1;padding:0 4px">+</button></div>${g[k].map(a=>sbItem(a)).join('')}</div>`).join('')||'<div style="padding:16px;color:var(--ink-faint);font-size:12px">Nada aqui.</div>';
 wrap.querySelectorAll('.sb-item').forEach(el=>{
   el.onclick=e=>{if(e.target.closest('[data-menu]'))return;openAutomacao(+el.dataset.id);};
   const mb=el.querySelector('[data-menu]');if(mb)mb.onclick=e=>{e.stopPropagation();sbMenu(e.clientX,e.clientY,+el.dataset.id);};
   el.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',el.dataset.id);e.dataTransfer.effectAllowed='move';el.style.opacity='.4';});
   el.addEventListener('dragend',()=>{el.style.opacity='';});
 });
 wrap.querySelectorAll('.sb-group').forEach(gp=>{
   gp.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='move';gp.style.background='var(--brand-soft)';gp.style.borderRadius='10px';});
   gp.addEventListener('dragleave',()=>{gp.style.background='';});
   gp.addEventListener('drop',async e=>{e.preventDefault();gp.style.background='';const id=+e.dataTransfer.getData('text/plain');const destino=gp.dataset.group;const grupo=(destino==='Sem grupo')?null:destino;const a=ref.automacoes.find(z=>z.id===id);if(!a||((a.grupo||null)===(grupo||null)))return;try{await sbPatch('/automacoes?id=eq.'+id,{grupo});a.grupo=grupo;if(cur&&cur.id===id)cur.grupo=grupo;renderSidebar(document.getElementById('sbSearch').value);toast('Movida para '+(grupo||'Sem grupo'),'ok');}catch(err){toast('Erro ao mover: '+err.message,'err');}});
 });
 wrap.querySelectorAll('[data-addgrp]').forEach(b=>b.onclick=e=>{e.stopPropagation();const gk=b.dataset.addgrp;createAutomation(gk==='Sem grupo'?null:gk);});
}

/* ---------- abrir / hidratar ---------- */
async function openAutomacao(id){
 if(dirty&&!confirm('Há alterações não salvas. Descartar e abrir outra?'))return;
 try{setStatus('Abrindo…','#f59e0b');
  const rows=await sbGet('/automacoes?id=eq.'+id+'&select=id,nome,grupo,ativa,status,publicado_em,arquivada,mapa');const row=rows[0];
  if(!row){toast('Automação não encontrada','err');return;}
  cur=hydrate(row);selectedId=null;dirty=false;
  document.getElementById('flowName').textContent=cur.nome;
  document.getElementById('flowSub').textContent=(cur.grupo?cur.grupo+' · ':'')+Object.keys(cur.nodes).length+' blocos'+(cur.ativa===false?' · inativa':'');
  renderSidebar(document.getElementById('sbSearch').value);renderNodes();fitView();loadMonitor();historyInit();cancelAutosave();renderStateBadges();
  setStatus('Conectado','#10b981');emptyTip.style.display='none';
  // menu NÃO é recolhido automaticamente — o usuário decide via botões ◀ / ☰
 }catch(e){console.error(e);setStatus('Erro','#dc2626');toast('Erro ao abrir: '+e.message,'err');}
}
function hydrate(row){
 const mapa=row.mapa||{},ed=mapa.editor||{blocks:{},wires:[]},au=mapa.automation||{blocks:[]};
 const optById={};(au.blocks||[]).forEach(b=>optById[b.id]=b);
 const edB=ed.blocks||{};const ids=Object.keys(edB).length?Object.keys(edB):(au.blocks||[]).map(b=>b.id);
 const nodes={};
 ids.forEach(id=>{const eb=edB[id]||{},ab=optById[id]||{};const type=ab.type||FAM2TYPE[eb.fam]||'action';
  const o=JSON.parse(JSON.stringify(ab.options||{}));
  ['nextBlockId','errorNextBlockId','trueNextBlockId','falseNextBlockId','timeoutNextBlockId','respondeuNextBlockId','naoRespondeuNextBlockId'].forEach(k=>delete o[k]);
  let ramos=(eb.ramos&&eb.ramos.length)?eb.ramos.map(r=>({id:r.id,name:r.name,perc:r.perc})):(o.randomizers||[]).map(r=>({id:r.id,name:r.name,perc:r.perc}));
  if(type==='randomizer')delete o.randomizers;
  if(type==='chat'&&!o.messages)o.messages=[{name:'send-text-message',options:{text:''}}];
  nodes[id]={id,type,sub:eb.sub||'',x:(eb.x??(ab.presentation&&ab.presentation.x)??80),y:(eb.y??(ab.presentation&&ab.presentation.y)??80),note:eb.note||'',ramos,opts:o,sourceBlockId:ab.sourceBlockId||(eb.extra&&eb.extra.sourceBlockId)||undefined};
 });
 let wires=(ed.wires||[]).slice();
 if(!wires.length){(au.blocks||[]).forEach(b=>{const o=b.options||{};if(o.nextBlockId)wires.push({from:b.id,port:'out',to:o.nextBlockId});if(o.trueNextBlockId)wires.push({from:b.id,port:'true',to:o.trueNextBlockId});if(o.falseNextBlockId)wires.push({from:b.id,port:'false',to:o.falseNextBlockId});if(o.errorNextBlockId)wires.push({from:b.id,port:'err',to:o.errorNextBlockId});if(o.timeoutNextBlockId)wires.push({from:b.id,port:'timeout',to:o.timeoutNextBlockId});if(o.respondeuNextBlockId)wires.push({from:b.id,port:'respondeu',to:o.respondeuNextBlockId});if(o.naoRespondeuNextBlockId)wires.push({from:b.id,port:'naoRespondeu',to:o.naoRespondeuNextBlockId});(o.randomizers||[]).forEach(r=>{if(r.nextBlockId)wires.push({from:b.id,port:r.id,to:r.nextBlockId});});(o.conditions||[]).forEach(c=>{if(c.id&&c.trueNextBlockId)wires.push({from:b.id,port:c.id,to:c.trueNextBlockId});});});}
 wires=wires.filter(w=>nodes[w.from]&&nodes[w.to]);
 return {id:row.id,nome:row.nome,grupo:row.grupo,ativa:row.ativa,status:row.status||'publicado',publicado_em:row.publicado_em,arquivada:!!row.arquivada,name:au.name||row.nome,provider:au.provider||'apecerto-erp',anotacoes:au.anotacoes||[],uid:ed.uid||100,notes:ed.notes||{},nodes,wires};
}

/* =====================================================================
   RENDER NÓS (edição inline)
   ===================================================================== */
function pipeOpts(v){return '<option value="">— funil —</option>'+ref.pipelines.map(p=>`<option value="${p.id}" ${String(p.id)===String(v)?'selected':''}>${esc(p.nome)}</option>`).join('');}
function stageOpts(v,pid){return '<option value="">— etapa —</option>'+ref.stages.filter(s=>!pid||String(s.pipeline_id)===String(pid)).map(s=>`<option value="${s.id}" ${String(s.id)===String(v)?'selected':''}>${esc(s.nome)}</option>`).join('');}
function corOpts(v){return '<option value="">— corretor —</option>'+ref.corretores.map(c=>`<option ${c.nome===v?'selected':''}>${esc(c.nome)}</option>`).join('');}
function instOpts(v){return '<option value="">— instância —</option>'+ref.instancias.map(i=>`<option ${i.nome===v?'selected':''}>${esc(i.nome)}</option>`).join('');}
function autoOpts(v){return '<option value="">— automação —</option>'+ref.automacoes.map(a=>`<option ${a.nome===v?'selected':''}>${esc(a.nome)}</option>`).join('');}
function selOpts(list,v){return list.map(x=>`<option value="${esc(x[0])}" ${x[0]===v?'selected':''}>${esc(x[1])}</option>`).join('');}
function portRow(port,lbl,kind){return `<div class="ne-port ${kind==='err'?'err':''}"><span class="lbl">${esc(lbl)}</span><span class="port-dot dot ${kind}" data-port="${port}"></span></div>`;}

function renderNodes(){
 [...worldEl.querySelectorAll('.node')].forEach(e=>e.remove());
 if(!cur)return;
 Object.values(cur.nodes).forEach(n=>{
  const meta=TYPES[n.type]||TYPES.action,col=`var(${meta.cvar})`;
  const el=document.createElement('div');
  el.className='node editable'+(selectedId===n.id?' selected':'');el.dataset.id=n.id;el.style.left=n.x+'px';el.style.top=n.y+'px';
  const inDot=n.type==='trigger'?'':'<span class="in-dot" data-in></span>';
  el.innerHTML=`<div class="bar" style="background:${col}"></div>${inDot}
   <div class="hd" data-drag><div class="nic" style="background:${col}22;color:${col}">${ico(meta.vis,16,col)}</div><div class="ttl">${meta.label}</div>
    <button data-delnode class="ne-del" style="margin-left:auto" title="Excluir bloco">${ico('trash',13)}</button></div>
   ${n.note?`<div class="node-note">${ico('trigger',12,'#92700a',2)}<span>${esc(n.note)}</span></div>`:''}
   <div class="ne" data-body></div>
   <div class="foot" data-foot><div class="st"><b style="color:var(--ok)" data-c="ok">0</b><span>Sucesso</span></div><div class="st"><b style="color:var(--warn)" data-c="alerta">0</b><span>Alerta</span></div><div class="st"><b style="color:var(--err)" data-c="erro">0</b><span>Erro</span></div></div>`;
  el.querySelector('[data-body]').innerHTML=bodyHtml(n);
  worldEl.appendChild(el);
  el.addEventListener('mousedown',e=>{if(e.target.closest('.port-dot')||e.target.closest('input')||e.target.closest('select')||e.target.closest('textarea'))return;selectedId=n.id;markSel();});
  el.querySelector('[data-drag]').addEventListener('mousedown',e=>startDrag(e,n));
  el.querySelector('[data-delnode]').addEventListener('click',e=>{e.stopPropagation();delNode(n.id);});
  bindBody(n,el);
  el.querySelectorAll('.port-dot').forEach(d=>d.addEventListener('mousedown',e=>startWire(e,n,d.dataset.port)));
  el.querySelectorAll('[data-foot] .st').forEach(st=>{st.style.cursor='pointer';st.title='Ver logs deste bloco';st.addEventListener('click',e=>{e.stopPropagation();const b=st.querySelector('[data-c]');openBlockLogs(n,(b&&b.dataset.c)||'ok');});});
 });
 applyCounts();drawEdges();
}
/* ---- Logs do bloco (Entraram / Sucessos / Alertas / Erros) ---- */
const _LOGTABS=[['entrou','Entraram'],['ok','Sucessos'],['alerta','Alertas'],['erro','Erros']];
function _logMatch(r,tab){const s=String(r.status||'').toLowerCase();if(tab==='entrou')return s==='entrou'||s==='in'||s==='iniciado'||s==='started'||r.evento==='entrou';if(tab==='ok')return s==='ok'||s==='sucesso'||s==='success'||s==='concluido';if(tab==='alerta')return s==='alerta'||s==='warning'||s==='warn';if(tab==='erro')return s==='erro'||s==='error'||s==='failed'||s==='falha';return false;}
async function openBlockLogs(n,tab){
 tab=tab||'ok';
 showPanel('Logs do bloco',`<div style="font-size:12px;color:var(--ink-faint);padding:8px 0">Carregando…</div>`);
 let rows=[];
 try{ rows=await sbGet('/motor_execucoes?bloco_id=eq.'+encodeURIComponent(n.id)+'&select=*&order=criado_em.desc&limit=200'); }
 catch(e){ showPanel('Logs do bloco',`<div style="color:var(--err);font-size:12.5px;padding:6px 0">Erro ao carregar logs: ${esc(e.message)}</div>`); return; }
 function paint(active){
  const tabsH=_LOGTABS.map(([k,l])=>{const cnt=rows.filter(r=>_logMatch(r,k)).length;const on=k===active;return `<button data-logtab="${k}" style="border:0;background:${on?'var(--brand-soft)':'transparent'};color:${on?'var(--brand)':'var(--ink-soft)'};font-weight:${on?700:500};border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer">${l}${cnt?` <span style="font-size:10px;opacity:.7">(${cnt})</span>`:''}</button>`;}).join('');
  const list=rows.filter(r=>_logMatch(r,active));
  const cor=active==='erro'?'var(--err)':(active==='alerta'?'var(--warn)':(active==='entrou'?'var(--ink-faint)':'var(--ok)'));
  const item=r=>{const dt=r.criado_em?new Date(r.criado_em).toLocaleString('pt-BR'):'';const lead=r.lead_nome||r.lead||r.contato_nome||'';const tel=r.lead_telefone||r.telefone||r.contato_telefone||'';const neg=r.negocio||r.negocio_nome||'';const det=r.detalhe||r.mensagem||r.descricao||'';
   return `<div style="border:1px solid var(--line);border-radius:10px;padding:9px 11px;margin-bottom:7px;background:#fff"><div style="display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--ink-soft)"><span style="width:8px;height:8px;border-radius:50%;background:${cor};flex:0 0 auto"></span>${esc(dt)}</div>${det?`<div style="font-size:12px;color:var(--ink);margin-top:4px;line-height:1.35">${esc(det)}</div>`:''}${lead?`<div style="font-size:11px;color:var(--ink-faint);margin-top:4px"><b style="color:var(--ink-soft)">Lead:</b> ${esc(lead)}${tel?' · '+esc(tel):''}</div>`:''}${neg?`<div style="font-size:11px;color:var(--ink-faint)"><b style="color:var(--ink-soft)">Negócio:</b> ${esc(neg)}</div>`:''}</div>`;};
  const html=`<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px;border-bottom:1px solid var(--line-soft);padding-bottom:8px">${tabsH}</div><div>${list.length?list.map(item).join(''):'<div style="color:var(--ink-faint);font-size:12px;padding:10px 0;text-align:center">Nenhum registro nesta aba.</div>'}</div>`;
  showPanel('Logs do bloco · '+(TYPES[n.type]||TYPES.action).label,html);
  document.querySelectorAll('[data-logtab]').forEach(b=>b.onclick=()=>paint(b.dataset.logtab));
 }
 paint(tab);
}
function markSel(){worldEl.querySelectorAll('.node').forEach(el=>el.classList.toggle('selected',el.dataset.id===selectedId));}
function reNode(n){renderNodes();markSel();}

function bodyHtml(n){
 if(n.type==='trigger'){const t=(n.opts.triggers||[])[0]||{name:'json-http-request-trigger',options:{}},o=t.options||{};let ex='';
  if(t.name==='initiated-by-another-automation-trigger')ex=`<div class="ne-lb">Fonte de dados</div><div><span style="display:inline-block;background:var(--brand-soft);color:var(--brand);font-size:11px;font-weight:600;padding:3px 9px;border-radius:6px">Api-request-1</span></div><div style="font-size:11px;color:var(--ink-faint);margin-top:6px;line-height:1.4">Esta automação é iniciada por <b>outra</b>. Quem escolhe iniciá-la é a automação chamadora, na ação <b>"Iniciar outra automação"</b>.</div>`;
  if(t.name==='tag-added-trigger')ex=`<div class="ne-lb">Tag</div><input class="ne-inp" data-tk="tag" value="${esc(o.tag||'')}">`;
  if(t.name==='lead-entered-stage-trigger'||t.name==='lead-moved-stage-trigger')ex=`<div class="ne-lb">Funil</div><select class="ne-sel" data-tk="pipeline">${pipeOpts(o.pipeline_id)}</select><div class="ne-lb">Etapa</div><select class="ne-sel" data-tk="etapa">${stageOpts(o.etapa_id,o.pipeline_id)}</select>`;
  const hook=t.name==='json-http-request-trigger'?`<div class="ne-lb">URL do webhook (deste produto)</div><div class="hookbox"><code data-hook>${cur.id?SUPA_URL+'/functions/v1/entrada?auto='+cur.id:'salve para gerar'}</code><button class="hookbtn" data-copyhook>${ico('copy',12)} copiar</button></div>`:'';
  return `<div class="ne-lb">Tipo de gatilho</div><select class="ne-sel" data-trig>${selOpts(TRIGGERS,t.name)}</select>${ex}${hook}${portRow('out','Quando ocorrer','ok')}`;
 }
 if(n.type==='condition'){const cs=n.opts.conditions||[];cs.forEach(c=>{if(!c.id)c.id='k'+(cur.uid++);});
  return `<div style="font-size:11px;color:var(--ink-faint);padding:2px 0">Faça filtros para seguir caminhos diferentes.</div>${cs.map((c,i)=>condRow(c,i)).join('')}<button class="ne-add" data-addcond>${ico('plus',14)} adicionar condição</button>${portRow('true','Todas as condições verdadeiras','branch')}${portRow('false','Quando não atender a nenhuma','err')}`;
 }
 if(n.type==='action'){const as=n.opts.actions||[];
  return `<div style="font-size:11px;color:var(--ink-faint);padding:2px 0">Execute ações no sistema.</div>${as.map((a,i)=>actRow(a,i)).join('')}<button class="ne-add" data-addact>${ico('plus',14)} adicionar ação</button>${portRow('out','Próximo passo','ok')}${portRow('err','Caso ocorrer erro','err')}`;
 }
 if(n.type==='randomizer'){const rs=n.ramos||[];
  return `${rs.map((r,i)=>ramoRow(r,i)).join('')}<button class="ne-add" data-addramo>${ico('plus',14)} adicionar caminho</button>`;
 }
 if(n.type==='distribution'){const d=(n.opts&&n.opts.distribuicao)||{items:[],onlineOnly:false,tambemNegocio:false};const its=d.items||[];const totPeso=its.filter(x=>x.on!==false).reduce((s,x)=>s+(+x.peso||0),0)||0;
  const linhas=its.map((it,i)=>{const pct=totPeso>0&&it.on!==false?Math.round((+it.peso||0)/totPeso*100):0;
    return `<div class="ne-row" data-distrow="${i}" style="padding:8px 9px"><div style="display:flex;align-items:center;gap:8px">`+
     `<input type="checkbox" data-diston ${it.on!==false?'checked':''} title="Participa da distribuição" style="width:15px;height:15px;flex:0 0 auto">`+
     `<span style="flex:1;font-size:12.5px;font-weight:600;color:${it.on!==false?'var(--ink)':'var(--ink-faint)'}">${esc(it.corretor||'—')}</span>`+
     `<span style="font-size:10px;color:var(--ink-faint)">peso</span>`+
     `<input class="ne-inp" type="number" min="0" step="1" data-distpeso value="${esc(it.peso!=null?it.peso:1)}" style="width:56px;text-align:center">`+
     `<span style="font-size:11px;font-weight:700;color:var(--brand);width:38px;text-align:right">${pct}%</span>`+
     `</div></div>`;}).join('');
  return `<div style="font-size:11px;color:var(--ink-faint);padding:2px 0 6px;line-height:1.4">Distribui o lead entre os corretores por <b>peso</b> (roleta). Quem tem peso maior recebe mais leads.</div>`+
   (its.length?linhas:'<div style="font-size:11px;color:var(--ink-faint);padding:4px 0">Nenhum corretor. Recarregue a página para listar.</div>')+
   `<label style="display:flex;align-items:center;gap:7px;margin-top:8px;font-size:12px;color:var(--ink);cursor:pointer"><input type="checkbox" data-distonline ${d.onlineOnly===true?'checked':''} style="width:15px;height:15px"> Só distribuir para quem está <b>online</b></label>`+
   `<label style="display:flex;align-items:center;gap:7px;margin-top:5px;font-size:12px;color:var(--ink);cursor:pointer"><input type="checkbox" data-distneg ${d.tambemNegocio?'checked':''} style="width:15px;height:15px"> Atribuir também no negócio do lead</label>`+
   (function(){const dprod=d.produtoId||0;const abList=(ref.abordagens||[]).filter(a=>(a.produto_id||0)===dprod);const selAb=d.abordagemIds||[];
    return `<div style="height:1px;background:var(--line-soft);margin:11px 0 6px"></div><div class="ne-lb" style="margin-top:0">Abordagem a enviar (opcional)</div>`+
     `<select class="ne-sel" data-distprod><option value="0" ${dprod===0?'selected':''}>— Modelos gerais (sem produto) —</option>${(ref.produtos||[]).map(p=>`<option value="${p.id}" ${p.id===dprod?'selected':''}>${esc(p.nome)}</option>`).join('')}</select>`+
     `<div style="font-size:11px;color:var(--ink-faint);margin:6px 0 3px">Marque quais abordagens serão enviadas pelo número do corretor (o sistema alterna entre elas):</div>`+
     (abList.length?abList.map(a=>`<label style="display:flex;align-items:center;gap:7px;font-size:12px;padding:3px 0;cursor:pointer"><input type="checkbox" data-distab="${a.id}" ${selAb.indexOf(a.id)>=0?'checked':''} style="width:15px;height:15px;flex:0 0 auto">${esc(a.nome)} <span style="color:var(--ink-faint);font-size:10.5px">(${(a.mensagens||[]).length})</span></label>`).join(''):`<div style="font-size:11px;color:var(--ink-faint)">Sem abordagens aqui. Crie em <b>Abordagens (produtos)</b>.</div>`);
   })()+
   (function(){const rv=d.respostaValor||12,ru=d.respostaUnidade||'horas';return `<div style="height:1px;background:var(--line-soft);margin:11px 0 6px"></div><div class="ne-lb" style="margin-top:0">Mapeamento da resposta</div><div style="font-size:11px;color:var(--ink-faint);margin:2px 0 5px">Depois de enviar a abordagem, aguardar resposta por:</div><div class="ne-inline"><input class="ne-inp" type="number" min="1" data-distrespval value="${rv}" style="width:74px"><select class="ne-sel" data-distrespunid style="width:120px"><option ${ru==='minutos'?'selected':''}>minutos</option><option ${ru==='horas'?'selected':''}>horas</option><option ${ru==='dias'?'selected':''}>dias</option></select></div><div style="font-size:10.5px;color:var(--ink-faint);margin-top:4px">Com as saídas de resposta LIGADAS, o lead fica retido neste bloco até responder (sai na hora) ou vencer o prazo — "Próximo passo" não é usado. Sem ligação = comportamento atual.</div>`;})()+
   portRow('respondeu','Caso o lead RESPONDA no prazo','branch')+
   portRow('naoRespondeu','Caso o lead NÃO responda','err')+
   portRow('out','Próximo passo','ok')+portRow('err','Se ninguém disponível','err');
 }
 if(n.type==='send-approach'){const o=n.opts||{};
  return `<div style="font-size:11.5px;color:var(--ink-soft);padding:2px 0 6px;line-height:1.45">Envia a abordagem <b>pela instância do corretor DONO do lead</b> (definido pela Distribuição). Use depois de um bloco Distribuir, ou em follow-ups.</div>`+
   (function(){const dprod=o.produtoId||0;const abList=(ref.abordagens||[]).filter(a=>(a.produto_id||0)===dprod);const selAb=o.abordagemIds||[];
    return `<div class="ne-lb" style="margin-top:0">Produto das abordagens</div>`+
     `<select class="ne-sel" data-sapprod><option value="0" ${dprod===0?'selected':''}>— Modelos gerais (sem produto) —</option>${(ref.produtos||[]).map(p=>`<option value="${p.id}" ${p.id===dprod?'selected':''}>${esc(p.nome)}</option>`).join('')}</select>`+
     `<div style="font-size:11px;color:var(--ink-faint);margin:6px 0 3px">Marque as abordagens (o sistema alterna entre elas):</div>`+
     (abList.length?abList.map(a=>`<label style="display:flex;align-items:center;gap:7px;font-size:12px;padding:3px 0;cursor:pointer"><input type="checkbox" data-sapab="${a.id}" ${selAb.indexOf(a.id)>=0?'checked':''} style="width:15px;height:15px;flex:0 0 auto">${esc(a.nome)} <span style="color:var(--ink-faint);font-size:10.5px">(${(a.mensagens||[]).length})</span></label>`).join(''):`<div style="font-size:11px;color:var(--ink-faint)">Sem abordagens aqui. Crie em <b>Abordagens (produtos)</b>.</div>`);
   })()+
   portRow('out','Próximo passo','ok');
 }
 if(n.type==='chat'){const ms=n.opts.messages||[];const conx=n.opts.instancia||'';
  return `<div style="font-size:11px;color:var(--ink-faint);padding:2px 0">Envie e receba mensagens. Clique para adicionar uma mensagem:</div><div style="font-size:11px;color:var(--ink-soft);margin:3px 0 5px"><b>Conexão:</b> ${conx?esc(conx):'<span style="color:var(--ink-faint)">herda dos anteriores</span>'}</div>${ms.length?ms.map(m=>`<div style="font-size:11px;color:var(--ink-soft);padding:3px 0;border-top:1px solid var(--line-soft)">• ${esc(msgPartLabel(m))}</div>`).join(''):'<div style="font-size:11px;color:var(--ink-faint);padding:2px 0">Nenhuma mensagem ainda</div>'}<button class="ne-add" data-editmsg>${ico('message',14)} adicionar / editar mensagem</button>${portRow('out','Próximo passo','ok')}${portRow('err','Caso ocorrer erro no envio','err')}`;
 }
 if(n.type==='time'){const wt=n.opts.wait_type||(n.opts.unidade?('wait-'+({segundos:'seconds',minutos:'minutes',horas:'hours',dias:'days'}[n.opts.unidade]||'minutes')):'');const m=wt?esperaMeta(wt):null;const cfg=m?m[3]:'';let bd='';
  if(cfg.indexOf('dur:')===0){const u=cfg.slice(4);bd=`<div class="ne-inline"><input class="ne-inp" type="number" min="0" data-wvalor value="${esc(n.opts.valor||0)}"><span style="align-self:center;font-size:12px;color:var(--ink-soft);white-space:nowrap">${u}</span></div>`;}
  else if(cfg==='datetime')bd=`<input class="ne-inp" type="datetime-local" data-wdata value="${esc(n.opts.data||'')}">`;
  else if(cfg==='intervalo'){const dias=n.opts.dias||[],dd=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];bd=`<div style="display:flex;gap:3px;flex-wrap:wrap">${dd.map((d,idx)=>`<button data-wdia="${idx}" class="ne-sel" style="width:auto;padding:4px 7px;font-size:10px;${dias.includes(idx)?'background:var(--brand-soft);color:var(--brand);border-color:var(--brand)':''}">${d}</button>`).join('')}</div><div class="ne-inline"><input class="ne-inp" type="time" data-wcf="hora_inicio" value="${esc(n.opts.hora_inicio||'09:00')}"><input class="ne-inp" type="time" data-wcf="hora_fim" value="${esc(n.opts.hora_fim||'18:00')}"></div>`;}
  const chosen=m?`<div style="font-size:11.5px;font-weight:600;margin:3px 0 5px;color:var(--ink)">${esc(m[1])}${m[4]?BETA_TAG:''}</div>`:'';
  return `<div style="font-size:11px;color:var(--ink-faint);padding:2px 0">Espera um determinado tempo para continuar a execução.</div>${chosen}${bd?'<div style="margin-bottom:6px">'+bd+'</div>':''}<button class="ne-add" data-addespera>${ico('plus',14)} ${m?'trocar tipo de espera':'adicionar espera'}</button>${portRow('out','Próximo passo','ok')}`;
 }
 if(n.type==='field-operation'){const ops=n.opts.fieldOperations||[];
  return `<div style="font-size:11px;color:var(--ink-faint);padding:2px 0 2px;line-height:1.4">Escolha o <b>Destino</b> (campo do lead) e clique em <b>JSON</b> para escolher qual campo que chegou no webhook vai preenchê-lo.</div>${ops.map((op,i)=>fieldOpRow(op,i)).join('')}<button class="ne-add" data-addfop>${ico('plus',14)} adicionar mapeamento</button>${portRow('out','Próximo passo','ok')}${portRow('err','Se ocorrer erro','err')}`;
 }
 return portRow('out','Próximo','ok');
}
/* ---- Operações de campos: contrato real do motor (fieldOperations) ---- */
function _uuid(){try{if(window.crypto&&crypto.randomUUID)return crypto.randomUUID();}catch(e){}return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return (c==='x'?r:(r&0x3|0x8)).toString(16);});}
const FIELDOP_DEST=[['leadName','Nome do lead'],['leadPhone','Telefone do lead'],['leadEmail','E-mail do lead'],['leadCpfCnpj','CPF/CNPJ do lead'],['leadInstagram','Instagram do lead'],['leadOrigin','Origem do lead']];
function fopDestLabel(param){if(!param)return 'Selecionar destino';const f=FIELDOP_DEST.find(x=>x[0]===param);if(f)return f[1];const m=/^additional-field\[(.*)\]$/.exec(param);if(m)return 'Campo adicional: '+m[1].trim();return param;}
function datasourcesOf(){const ds=[];const add=v=>{if(v&&ds.indexOf(v)<0)ds.push(v);};if(cur)Object.values(cur.nodes).forEach(n=>{if(n.type==='trigger')(n.opts.triggers||[]).forEach(t=>add(t.options&&t.options.datasourceName));(n.opts.fieldOperations||[]).forEach(op=>add(op.options&&op.options.datasourceName));});if(!ds.length)add('Api-request-1');return ds;}
function fieldOpRow(op,i){const o=op.options||{};
 if(op.name==='parse-phone-field-operation'){
  return `<div class="ne-row" data-foprow="${i}"><div class="ne-rowh"><div style="flex:1;font-size:11.5px;font-weight:600;color:var(--ink)">Formatar telefone</div><button class="ne-del" data-fopdel>${ico('trash',13)}</button></div><div class="ne-lb">Telefone (do JSON)</div><div class="ne-inline"><input class="ne-inp" data-fopphone value="${esc(o.phone||'')}" placeholder="{telefone|[Api-request-1]telefone}" style="flex:1"><button class="hookbtn" data-fopjson data-fopfield="phone">JSON</button></div></div>`;
 }
 const param=o.parameter||'';const known=FIELDOP_DEST.some(d=>d[0]===param);const cv=fopValPreview(o.value||'');
 const resumo=`<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12.5px;font-weight:600;margin-bottom:7px">`+
  `<span style="background:var(--brand-soft);color:var(--brand);padding:2px 8px;border-radius:6px">${esc(fopDestLabel(param))}</span>`+
  `<span style="color:var(--ink-faint);font-size:11px;font-weight:500">recebe</span>`+
  (cv?`<span style="background:#e9faf3;color:#0e9488;padding:2px 8px;border-radius:6px">${esc(cv)}</span>`:`<span style="color:var(--err);font-size:11px;font-weight:500">— clique em JSON e escolha o campo</span>`)+
  `</div>`;
 return `<div class="ne-row" data-foprow="${i}">${resumo}<div class="ne-rowh"><div style="flex:1;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--ink-faint)">Destino (campo do lead)</div><button class="ne-del" data-fopdel>${ico('trash',13)}</button></div>`+
  `<select class="ne-sel" data-fopdest>${param?'':'<option value="" selected>— selecione o destino —</option>'}${FIELDOP_DEST.map(d=>`<option value="${d[0]}" ${d[0]===param?'selected':''}>${esc(d[1])}</option>`).join('')}<option value="__add__" ${(param&&!known)?'selected':''}>${(param&&!known)?'★ '+esc(fopDestLabel(param)):'Campo adicional…'}</option></select>`+
  `<div class="ne-lb">Valor — campo que chegou no webhook</div><div class="ne-inline"><input class="ne-inp" data-fopval value="${esc(o.value||'')}" placeholder="clique em JSON →" style="flex:1"><button class="hookbtn" data-fopjson data-fopfield="value">JSON</button></div></div>`;}
function fopValPreview(v){if(!v)return '';let s=String(v);if(s.indexOf('|')>=0)s=s.substring(s.indexOf('|')+1);s=s.replace(/^\{/,'').replace(/\}$/,'');const m=/^\[[^\]]*\](.+)$/.exec(s);return m?m[1]:s;}
// Infere o destino (campo do lead) a partir do NOME do campo que chegou no webhook,
// replicando a associacao automatica do ApeCerto: usuario clica no campo do JSON e o destino ja vem certo.
function fopInferDest(token){const key=fopValPreview(token||'');if(!key)return '';let k=String(key).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]/g,'');
 if(!k)return '';
 if(/^(nome|name|nomecompleto|fullname|nomelead|leadname|primeironome|firstname)$/.test(k))return 'leadName';
 if(/(telefone|phone|celular|whatsapp|whats|fone|tel|mobile|numero|ddd)/.test(k))return 'leadPhone';
 if(/(email|mail|correio)/.test(k))return 'leadEmail';
 if(/(cpf|cnpj|documento)/.test(k)||k==='doc')return 'leadCpfCnpj';
 if(/(instagram|insta|arroba)/.test(k)||k==='ig')return 'leadInstagram';
 if(/(origem|origin|source|fonte|utmsource|canal)/.test(k))return 'leadOrigin';
 return '';}
/* popover para inserir campo do JSON: gera {chave|[fonte]chave} */
async function openJsonPicker(x,y,cb){closeCampoPicker();const p=document.createElement('div');p.id='campoPick';p.className='campo-pick apeab-pop';p.style.width='340px';p.style.left=Math.min(x,innerWidth-356)+'px';p.style.top=Math.min(y,innerHeight-330)+'px';
 const dss=datasourcesOf();const dsName=dss[0]||'Api-request-1';
 ROOT.appendChild(p);
 p.innerHTML=`<div class="ne-lb" style="margin-top:0">Campos que chegaram no webhook</div><div style="font-size:11px;color:var(--ink-faint);padding:8px">Carregando…</div>`;
 let recebido={};try{if(cur&&cur.id){const r=await sbGet('/automacoes?id=eq.'+cur.id+'&select=ultima_entrada');recebido=(r[0]&&r[0].ultima_entrada)||{};}}catch(e){}
 const keys=Object.keys(recebido||{});
 const list=keys.length?keys.map(k=>`<button data-jk="${esc(k)}" style="display:flex;justify-content:space-between;gap:10px;width:100%;border:0;background:transparent;border-radius:7px;padding:8px 9px;font-size:12.5px;text-align:left;color:var(--ink);cursor:pointer"><b style="font-weight:600;flex:0 0 auto">${esc(k)}</b><span style="color:var(--ink-faint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(String(recebido[k]).slice(0,42))}</span></button>`).join(''):'<div style="color:var(--ink-faint);font-size:11.5px;padding:8px;line-height:1.5">Nenhum dado recebido ainda. Dispare <b>um</b> lead de teste no webhook e reabra aqui — os campos aparecem pra clicar. Ou digite o campo abaixo.</div>';
 p.innerHTML=`<div class="ne-lb" style="margin-top:0">Campos que chegaram no webhook (clique pra usar)</div><div style="max-height:210px;overflow:auto;margin-bottom:8px">${list}</div><div class="ne-lb">Ou digite o nome do campo</div><input class="cp-search" id="jpKey" placeholder="ex.: nome, telefone" style="margin-bottom:8px"><button class="sb-add" id="jpAdd" style="margin:0;padding:8px">Inserir</button>`;
 p.querySelectorAll('[data-jk]').forEach(b=>{b.onmouseenter=()=>b.style.background='var(--brand-soft)';b.onmouseleave=()=>b.style.background='transparent';b.onclick=()=>{cb('['+dsName+']'+b.dataset.jk);closeCampoPicker();};});
 const ki=p.querySelector('#jpKey');const finish=()=>{const key=(ki.value||'').trim();if(!key){ki.focus();return;}cb('['+dsName+']'+key);closeCampoPicker();};
 p.querySelector('#jpAdd').onclick=finish;ki.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();finish();}};setTimeout(()=>document.addEventListener('mousedown',_cpOutside),0);}
function condRow(c,i){const m=condMeta(c.name),cfg=m[3],o=c.options||{};let f='';
 if(cfg==='pipeline')f=`<select class="ne-sel" data-cf="pipeline">${pipeOpts(o.pipeline_id)}</select>`;
 else if(cfg==='corretor')f=`<select class="ne-sel" data-cf="corretor">${corOpts(o.corretor)}</select>`;
 else if(cfg==='pipeline_stage')f=`<select class="ne-sel" data-cf="pipeline">${pipeOpts(o.pipeline_id)}</select><select class="ne-sel" data-cf="etapa">${stageOpts(o.etapa_id,o.pipeline_id)}</select>`;
 else if(cfg==='tag')f=`<input class="ne-inp" data-cf="tag" value="${esc(o.tag||'')}" placeholder="Escolha uma tag ou digite" list="apeTagsDL"><datalist id="apeTagsDL">${(ref.tags||[]).map(t=>`<option value="${esc(t)}"></option>`).join('')}</datalist>`;
 else if(cfg==='campo')f=`<button class="ne-sel" data-condcampo style="text-align:left;cursor:pointer;color:${o.campo?'var(--ink)':'var(--ink-faint)'}">${o.campo?esc(campoLabel(o.campo)):'Selecionar campo'}</button>`;
 else if(cfg==='campo_valor')f=`<button class="ne-sel" data-condcampo style="text-align:left;cursor:pointer;color:${o.campo?'var(--ink)':'var(--ink-faint)'}">${o.campo?esc(campoLabel(o.campo)):'Selecionar campo'}</button><input class="ne-inp" data-cf="valor" value="${esc(o.valor||'')}" placeholder="Valor">`;
 else if(cfg==='campo_between')f=`<button class="ne-sel" data-condcampo style="text-align:left;cursor:pointer;color:${o.campo?'var(--ink)':'var(--ink-faint)'}">${o.campo?esc(campoLabel(o.campo)):'Selecionar campo'}</button><div class="ne-inline"><input class="ne-inp" type="number" data-cf="min" value="${esc(o.min||'')}" placeholder="mín"><input class="ne-inp" type="number" data-cf="max" value="${esc(o.max||'')}" placeholder="máx"></div>`;
 else if(cfg==='horas')f=`<input class="ne-inp" type="number" min="1" data-cf="janela_horas" value="${esc(o.janela_horas||'24')}" placeholder="Janela em horas (ex.: 24)">`;
 else if(cfg==='time'){const dias=o.dias||[],dd=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];f=`<div style="display:flex;gap:3px;flex-wrap:wrap">${dd.map((d,idx)=>`<button data-dia="${idx}" class="ne-sel" style="width:auto;padding:4px 7px;font-size:10px;${dias.includes(idx)?'background:var(--brand-soft);color:var(--brand);border-color:var(--brand)':''}">${d}</button>`).join('')}</div><div class="ne-inline"><input class="ne-inp" type="time" data-cf="hora_inicio" value="${esc(o.hora_inicio||'09:00')}"><input class="ne-inp" type="time" data-cf="hora_fim" value="${esc(o.hora_fim||'18:00')}"></div>`;}
 return `<div class="ne-row" data-crow="${i}"><div class="ne-rowh"><div style="flex:1;font-size:11.5px;font-weight:600;color:var(--ink)">${esc(m[1])}${m[4]?BETA_TAG:''}</div><button class="ne-del" data-cdel>${ico('trash',13)}</button></div>${f?'<div style="display:flex;flex-direction:column;gap:6px">'+f+'</div>':''}<div class="ne-port" style="margin-top:5px"><span class="lbl" style="font-size:10px">Se esta condição for verdadeira</span><span class="port-dot dot branch" data-port="${esc(c.id||'')}"></span></div></div>`;}
function actRow(a,i){const m=acaoMeta(a.name),cfg=m[3],o=a.options||{};let f='';
 if(cfg==='pipeline_stage')f=`<select class="ne-sel" data-af="pipeline">${pipeOpts(o.pipeline_id)}</select><select class="ne-sel" data-af="etapa">${stageOpts(o.etapa_id,o.pipeline_id)}</select>`;
 else if(cfg==='corretor')f=`<select class="ne-sel" data-af="corretor">${corOpts(o.corretor)}</select>`;
 else if(cfg==='tag')f=`<input class="ne-inp" data-af="tag" value="${esc(o.tag||'')}" placeholder="Escolha uma tag ou digite uma nova" list="apeTagsDL"><datalist id="apeTagsDL">${(ref.tags||[]).map(t=>`<option value="${esc(t)}"></option>`).join('')}</datalist>`;
 else if(cfg==='automacao')f=`<select class="ne-sel" data-af="automacao">${autoOpts(o.automacao)}</select>`;
 else if(cfg==='motivo')f=`<input class="ne-inp" data-af="motivo" value="${esc(o.motivo||'')}" placeholder="Motivo (opcional)">`;
 // toggle: também aplicar no lead (atendente do negócio ↔ lead)
 const tog=(lbl)=>`<label style="display:flex;align-items:center;gap:7px;margin-top:2px;font-size:11.5px;color:var(--ink);cursor:pointer"><input type="checkbox" data-af-bool="tambemLead" ${(o.tambemLead!==false)?'checked':''} style="width:15px;height:15px;flex:0 0 auto">${lbl}</label>`;
 if(a.name==='add-attendant-on-business-action')f+=tog('Transferir o mesmo atendente ao lead também?');
 if(a.name==='clean-attendant-on-business-action')f+=tog('Remover o atendente do lead também?');
 return `<div class="ne-row" data-arow="${i}"><div class="ne-rowh"><div style="flex:1;font-size:11.5px;font-weight:600;color:var(--ink)">${esc(m[1])}${m[4]?BETA_TAG:''}</div><button class="ne-del" data-adel>${ico('trash',13)}</button></div>${f?'<div style="display:flex;flex-direction:column;gap:6px">'+f+'</div>':''}</div>`;}
function ramoRow(r,i){return `<div class="ne-row" data-rrow="${i}"><div class="ne-rowh"><input class="ne-inp" data-rname value="${esc(r.name||'')}" placeholder="Nome" style="flex:2"><input class="ne-inp" type="number" data-rperc value="${esc(r.perc||0)}" style="flex:1" placeholder="%"><button class="ne-del" data-rdel>${ico('trash',13)}</button></div><div class="ne-port"><span class="lbl">saída</span><span class="port-dot dot branch" data-port="${esc(r.id)}"></span></div></div>`;}
function msgRow(m,i){const nm=m.name||'send-text-message',o=m.options||{};const kind=nm==='send-image-message'?'imagem':(nm==='send-video-message'?'video':'texto');
 const field=kind==='texto'
  ?`<textarea class="ne-ta" data-mtext placeholder="Mensagem… use {nome}, {telefone}">${esc(o.text||'')}</textarea><div class="ne-inline"><select class="ne-sel" data-mcampo><option value="">inserir campo…</option>${CAMPOS.map(c=>`<option>${c}</option>`).join('')}</select></div>`
  :`<input class="ne-inp" data-murl value="${esc(o.url||'')}" placeholder="URL do ${kind}">`;
 return `<div class="ne-row" data-mrow="${i}"><div class="ne-rowh"><select class="ne-sel" data-mkind>${selOpts([['texto','Texto'],['imagem','Imagem'],['video','Vídeo']],kind)}</select><button class="ne-del" data-mdel>${ico('trash',13)}</button></div>${field}</div>`;}

/* ---------- binds inline ---------- */
function stopMD(el){el.querySelectorAll('input,select,textarea,button').forEach(x=>x.addEventListener('mousedown',e=>e.stopPropagation()));}
function bindBody(n,el){
 stopMD(el);
 const q=s=>el.querySelector(s),qa=s=>[...el.querySelectorAll(s)];
 // trigger
 const tr=q('[data-trig]');
 if(tr){tr.onchange=()=>{const name=tr.value;n.opts.triggers=[{name,group:grpOf(TRIGGERS,name),options:{}}];setDirty();reNode(n);};
  qa('[data-tk]').forEach(inp=>inp.onchange=()=>{const t=n.opts.triggers[0];t.options=t.options||{};var k=inp.dataset.tk;if(k==='pipeline'||k==='etapa'){t.options[k+'_id']=inp.value?(+inp.value):'';t.options[k]=inp.value?inp.options[inp.selectedIndex].text:'';if(k==='pipeline'){t.options.etapa_id='';t.options.etapa='';}}else{t.options[k]=inp.value;}if(k==='pipeline')reNode(n);setDirty();});
  const cp=q('[data-copyhook]');if(cp)cp.onclick=e=>{e.stopPropagation();if(!cur.id)return;navigator.clipboard.writeText(SUPA_URL+'/functions/v1/entrada?auto='+cur.id).then(()=>toast('URL copiada','ok'));};}
 // condition
 if(q('[data-addcond]')){n.opts.conditions=n.opts.conditions||[];
  q('[data-addcond]').onclick=e=>{e.stopPropagation();const r=e.currentTarget.getBoundingClientRect();openCondPicker(r.left,r.bottom+4,(name)=>{n.opts.conditions.push({id:'k'+(cur.uid++),name,group:'',options:{}});setDirty();reNode(n);});};
  qa('[data-crow]').forEach(row=>{const i=+row.dataset.crow,c=n.opts.conditions[i];c.options=c.options||{};
   row.querySelector('[data-cdel]').onclick=ev=>{ev.stopPropagation();n.opts.conditions.splice(i,1);setDirty();reNode(n);};
   const cc=row.querySelector('[data-condcampo]');if(cc)cc.onclick=ev=>{ev.stopPropagation();const r=ev.currentTarget.getBoundingClientRect();openCampoPicker(r.left,r.bottom+4,(key)=>{c.options.campo=key;setDirty();reNode(n);});};
   row.querySelectorAll('[data-cf]').forEach(inp=>inp.onchange=()=>{var k=inp.dataset.cf;if(k==='pipeline'||k==='etapa'){c.options[k+'_id']=inp.value?(+inp.value):'';c.options[k]=inp.value?inp.options[inp.selectedIndex].text:'';if(k==='pipeline'){c.options.etapa_id='';c.options.etapa='';}}else{c.options[k]=inp.value;}if(k==='pipeline')reNode(n);setDirty();});
   row.querySelectorAll('[data-dia]').forEach(bt=>bt.onclick=ev=>{ev.stopPropagation();const d=+bt.dataset.dia;c.options.dias=c.options.dias||[];const ix=c.options.dias.indexOf(d);if(ix>=0)c.options.dias.splice(ix,1);else c.options.dias.push(d);setDirty();reNode(n);});});}
 // action
 if(q('[data-addact]')){n.opts.actions=n.opts.actions||[];
  q('[data-addact]').onclick=e=>{e.stopPropagation();openAcaoPicker((name)=>{n.opts.actions.push({name,group:'',options:{}});setDirty();reNode(n);});};
  qa('[data-arow]').forEach(row=>{const i=+row.dataset.arow,a=n.opts.actions[i];a.options=a.options||{};
   row.querySelector('[data-adel]').onclick=ev=>{ev.stopPropagation();n.opts.actions.splice(i,1);setDirty();reNode(n);};
   row.querySelectorAll('[data-af]').forEach(inp=>inp.onchange=()=>{var k=inp.dataset.af;if(k==='pipeline'||k==='etapa'){a.options[k+'_id']=inp.value?(+inp.value):'';a.options[k]=inp.value?inp.options[inp.selectedIndex].text:'';if(k==='pipeline'){a.options.etapa_id='';a.options.etapa='';}}else{a.options[k]=inp.value;}if(k==='pipeline')reNode(n);setDirty();});
   row.querySelectorAll('[data-af-bool]').forEach(inp=>inp.onchange=()=>{a.options[inp.dataset.afBool]=inp.checked;setDirty();});});}
 // distribuição de leads (roleta por peso)
 if(n.type==='distribution'){n.opts.distribuicao=n.opts.distribuicao||{items:[],onlineOnly:true,tambemNegocio:false};const d=n.opts.distribuicao;d.items=d.items||[];
  qa('[data-distrow]').forEach(row=>{const i=+row.dataset.distrow,it=d.items[i];if(!it)return;
   const on=row.querySelector('[data-diston]');if(on)on.onchange=()=>{it.on=on.checked;setDirty();reNode(n);};
   const pz=row.querySelector('[data-distpeso]');if(pz)pz.onchange=()=>{it.peso=Math.max(0,+pz.value||0);setDirty();reNode(n);};});
  const onl=q('[data-distonline]');if(onl)onl.onchange=()=>{d.onlineOnly=onl.checked;setDirty();};
  const neg=q('[data-distneg]');if(neg)neg.onchange=()=>{d.tambemNegocio=neg.checked;setDirty();};
  const prd=q('[data-distprod]');if(prd)prd.onchange=()=>{d.produtoId=+prd.value||0;d.abordagemIds=[];setDirty();reNode(n);};
  qa('[data-distab]').forEach(cb=>cb.onchange=()=>{const id=+cb.dataset.distab;d.abordagemIds=d.abordagemIds||[];const ix=d.abordagemIds.indexOf(id);if(cb.checked&&ix<0)d.abordagemIds.push(id);else if(!cb.checked&&ix>=0)d.abordagemIds.splice(ix,1);setDirty();});
  const rvI=q('[data-distrespval]');if(rvI)rvI.onchange=()=>{d.respostaValor=+rvI.value||12;setDirty();};
  const ruI=q('[data-distrespunid]');if(ruI)ruI.onchange=()=>{d.respostaUnidade=ruI.value;setDirty();};}
 if(n.type==='send-approach'){const o=n.opts=n.opts||{};
  const sp=q('[data-sapprod]');if(sp)sp.onchange=()=>{o.produtoId=+sp.value||0;o.abordagemIds=[];setDirty();reNode(n);};
  qa('[data-sapab]').forEach(cb=>cb.onchange=()=>{const id=+cb.dataset.sapab;o.abordagemIds=o.abordagemIds||[];const ix=o.abordagemIds.indexOf(id);if(cb.checked&&ix<0)o.abordagemIds.push(id);else if(!cb.checked&&ix>=0)o.abordagemIds.splice(ix,1);setDirty();});}
 // randomizer
 if(q('[data-addramo]')){n.ramos=n.ramos||[];q('[data-addramo]').onclick=e=>{e.stopPropagation();n.ramos.push({id:'r'+(cur.uid++),name:'Novo',perc:0});setDirty();reNode(n);};
  qa('[data-rrow]').forEach(row=>{const i=+row.dataset.rrow,r=n.ramos[i];
   row.querySelector('[data-rname]').onchange=ev=>{r.name=ev.target.value;setDirty();};
   row.querySelector('[data-rperc]').onchange=ev=>{r.perc=+ev.target.value||0;setDirty();};
   row.querySelector('[data-rdel]').onclick=ev=>{ev.stopPropagation();cur.wires=cur.wires.filter(w=>!(w.from===n.id&&w.port===r.id));n.ramos.splice(i,1);setDirty();reNode(n);};});}
 // chat
 if(n.type==='chat'){const eb=q('[data-editmsg]');if(eb)eb.onclick=e=>{e.stopPropagation();openMsgDrawer(n);};}
 // time / espera
 if(n.type==='time'){const ab=q('[data-addespera]');if(ab)ab.onclick=e=>{e.stopPropagation();openEsperaPicker((name)=>{applyEspera(n,name);setDirty();reNode(n);});};
  const wv=q('[data-wvalor]');if(wv)wv.onchange=()=>{n.opts.valor=+wv.value||0;setDirty();};
  const wd=q('[data-wdata]');if(wd)wd.onchange=()=>{n.opts.data=wd.value;setDirty();};
  qa('[data-wcf]').forEach(inp=>inp.onchange=()=>{n.opts[inp.dataset.wcf]=inp.value;setDirty();});
  qa('[data-wdia]').forEach(bt=>bt.onclick=ev=>{ev.stopPropagation();const d=+bt.dataset.wdia;n.opts.dias=n.opts.dias||[];const ix=n.opts.dias.indexOf(d);if(ix>=0)n.opts.dias.splice(ix,1);else n.opts.dias.push(d);setDirty();reNode(n);});}
 // operações de campos
 if(n.type==='field-operation'){n.opts.fieldOperations=n.opts.fieldOperations||[];
  const ab=q('[data-addfop]');if(ab)ab.onclick=e=>{e.stopPropagation();n.opts.fieldOperations.push({name:'set-field-operation',group:'field',stepId:_uuid(),options:{value:'',parameter:''}});setDirty();reNode(n);};
  qa('[data-foprow]').forEach(row=>{const i=+row.dataset.foprow,op=n.opts.fieldOperations[i];op.options=op.options||{};
   row.querySelector('[data-fopdel]').onclick=e=>{e.stopPropagation();n.opts.fieldOperations.splice(i,1);setDirty();reNode(n);};
   const ph=row.querySelector('[data-fopphone]');if(ph)ph.onchange=()=>{op.options.phone=ph.value;setDirty();};
   const dest=row.querySelector('[data-fopdest]');if(dest)dest.onchange=e=>{op._destTouched=true;if(e.target.value==='__add__'){const nm=prompt('Nome do campo adicional (exatamente como aparece no CRM, com espaços se houver):',/^additional-field\[(.*)\]$/.exec(op.options.parameter||'')?RegExp.$1:'');if(nm!==null&&nm.trim()){op.options.parameter='additional-field['+nm+']';}setDirty();reNode(n);}else{op.options.parameter=e.target.value;setDirty();reNode(n);}};
   const val=row.querySelector('[data-fopval]');if(val)val.onchange=()=>{op.options.value=val.value;setDirty();};
   qa2(row,'[data-fopjson]').forEach(b=>b.onclick=e=>{e.stopPropagation();const field=b.dataset.fopfield;const r=e.currentTarget.getBoundingClientRect();openJsonPicker(r.left,r.bottom+4,(token)=>{const inp=row.querySelector(field==='phone'?'[data-fopphone]':'[data-fopval]');if(inp)inp.value=token;if(field==='phone')op.options.phone=token;else{op.options.value=token;/* auto-associa o destino pelo nome do campo (igual ApeCerto), a menos que o usuario ja tenha escolhido manualmente */if(!op._destTouched){const inf=fopInferDest(token);if(inf)op.options.parameter=inf;}}setDirty();reNode(n);});});
  });}
}
function qa2(root,sel){return [...root.querySelectorAll(sel)];}
function delNode(id){if(!confirm('Excluir este bloco?'))return;delete cur.nodes[id];cur.wires=cur.wires.filter(w=>w.from!==id&&w.to!==id);if(selectedId===id)selectedId=null;setDirty();renderNodes();}

/* ---------- arrastar nó ---------- */
function startDrag(e,n){e.preventDefault();e.stopPropagation();selectedId=n.id;markSel();const sx=e.clientX,sy=e.clientY,ox=n.x,oy=n.y;
 const _dragEl=worldEl.querySelector(`.node[data-id="${n.id}"]`);
 function mv(ev){n.x=ox+(ev.clientX-sx)/view.scale;n.y=oy+(ev.clientY-sy)/view.scale;if(_dragEl){_dragEl.style.left=n.x+'px';_dragEl.style.top=n.y+'px';}scheduleEdges();}
 function up(){window.removeEventListener('mousemove',mv);window.removeEventListener('mouseup',up);setDirty();}
 window.addEventListener('mousemove',mv);window.addEventListener('mouseup',up);}

/* ---------- wires ---------- */
function dotWorld(el){const r=el.getBoundingClientRect(),wr=worldEl.getBoundingClientRect();return{x:(r.left+r.width/2-wr.left)/view.scale,y:(r.top+r.height/2-wr.top)/view.scale};}
/* caminho ORTOGONAL (quadrado, cantos em ângulo reto levemente arredondados),
   sempre partindo do centro EXATO da bolinha de origem até o destino */
function orthPath(a,b){
 const mx=(a.x+b.x)/2;
 const r=Math.max(0,Math.min(10,Math.abs(b.y-a.y)/2,Math.abs(mx-a.x),Math.abs(b.x-mx)));
 if(r<2)return `M ${a.x} ${a.y} L ${mx} ${a.y} L ${mx} ${b.y} L ${b.x} ${b.y}`;
 const sx1=mx>=a.x?1:-1, sy=b.y>=a.y?1:-1, sx2=b.x>=mx?1:-1;
 return `M ${a.x} ${a.y} L ${mx-sx1*r} ${a.y} Q ${mx} ${a.y} ${mx} ${a.y+sy*r} L ${mx} ${b.y-sy*r} Q ${mx} ${b.y} ${mx+sx2*r} ${b.y} L ${b.x} ${b.y}`;
}
function startWire(e,n,port){e.preventDefault();e.stopPropagation();const a=dotWorld(e.currentTarget||e.target);
 const tmp=document.createElementNS('http://www.w3.org/2000/svg','path');tmp.setAttribute('stroke','var(--brand)');tmp.setAttribute('stroke-width','2');tmp.setAttribute('fill','none');tmp.setAttribute('stroke-dasharray','5 4');edgesEl.appendChild(tmp);
 function mv(ev){const wr=worldEl.getBoundingClientRect(),bx=(ev.clientX-wr.left)/view.scale,by=(ev.clientY-wr.top)/view.scale;tmp.setAttribute('d',orthPath(a,{x:bx,y:by}));}
 function up(ev){window.removeEventListener('mousemove',mv);window.removeEventListener('mouseup',up);tmp.remove();const tgt=ev.target.closest('.node');
  if(tgt&&tgt.dataset.id!==n.id){connect(n.id,port,tgt.dataset.id);}
  else{const wr=worldEl.getBoundingClientRect();const dx=(ev.clientX-wr.left)/view.scale,dy=(ev.clientY-wr.top)/view.scale;miniMenu(ev.clientX,ev.clientY,type=>{if(type){const id=addNode(type,dx,dy);connect(n.id,port,id);}});}}
 window.addEventListener('mousemove',mv);window.addEventListener('mouseup',up);}
function connect(from,port,to){cur.wires=cur.wires.filter(w=>!(w.from===from&&w.port===port));cur.wires.push({from,port,to});setDirty();drawEdges();}
function drawEdges(){if(!cur){edgesEl.innerHTML='';return;}const P=[];
 cur.wires.forEach(w=>{const f=worldEl.querySelector(`.node[data-id="${w.from}"] .port-dot[data-port="${w.port}"]`),t=worldEl.querySelector(`.node[data-id="${w.to}"] [data-in]`);if(!f||!t)return;const a=dotWorld(f),b=dotWorld(t);const col=(w.port==='err'||w.port==='timeout')?'var(--err)':(w.port==='true'?'var(--c-condition)':(w.port==='false'?'#f59e0b':'var(--brand)'));P.push(`<path d="${orthPath(a,b)}" stroke="${col}" stroke-width="1.8" fill="none" stroke-dasharray="6 5" stroke-linecap="round" opacity=".8"/>`);});
 edgesEl.innerHTML=P.join('');}
/* Perf: coalesce redesenho das linhas em 1x por frame (evita rebuild do SVG a cada mousemove) */
let _edgeRAF=0;
function scheduleEdges(){ if(_edgeRAF) return; _edgeRAF=requestAnimationFrame(function(){ _edgeRAF=0; drawEdges(); }); }

/* ---------- mini-menu (arrastar → soltar → criar bloco) ---------- */
function miniMenu(sx,sy,cb){closeMini();const m=document.createElement('div');m.className='minimenu';m.id='mini';m.style.left=Math.min(sx,innerWidth-220)+'px';m.style.top=Math.min(sy,innerHeight-320)+'px';
 m.innerHTML=Object.entries(TYPES).map(([t,mt])=>`<button data-t="${t}"><span style="color:var(${mt.cvar})">${ico(mt.vis,16,`var(${mt.cvar})`)}</span>${mt.label}</button>`).join('');
 ROOT.appendChild(m);m.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{cb(b.dataset.t);closeMini();});
 setTimeout(()=>document.addEventListener('mousedown',outsideMini),0);}
function outsideMini(e){if(!e.target.closest('#mini')){closeMini();}}
function closeMini(){const m=document.getElementById('mini');if(m)m.remove();document.removeEventListener('mousedown',outsideMini);}

/* ---------- criar bloco ---------- */
function addNode(type,x,y){const id='b'+(cur.uid++);const base={id,type,sub:'',x:x??140,y:y??160,note:'',ramos:[],opts:{}};
 // blocos abrem VAZIOS — só com o botão "+ adicionar ..."
 if(type==='trigger')base.opts.triggers=[{name:'json-http-request-trigger',group:'system',options:{}}];
 if(type==='condition')base.opts.conditions=[];
 if(type==='action')base.opts.actions=[];
 if(type==='chat')base.opts={platform:'WHATSAPP',provider:'EVOLUTION_API',instancia:'',corretor:'',destinatario:'{telefone}',messages:[],esperaResposta:{unidade:'minutos',valor:0}};
 if(type==='time')base.opts={};
 if(type==='field-operation')base.opts={fieldOperations:[]};
 if(type==='randomizer')base.ramos=[{id:'r'+(cur.uid++),name:'A',perc:50},{id:'r'+(cur.uid++),name:'B',perc:50}];
 if(type==='distribution')base.opts={distribuicao:{items:(ref.corretores||[]).filter(c=>c.ativo!==false).map(c=>({corretor:c.nome,peso:(c.peso||1),on:true})),onlineOnly:true,tambemNegocio:false}};
 cur.nodes[id]=base;selectedId=id;setDirty();renderNodes();markSel();return id;}

/* ---------- compile + salvar ---------- */
function routeFor(n){const outs=cur.wires.filter(w=>w.from===n.id),by=p=>(outs.find(w=>w.port===p)||{}).to||'';const o=JSON.parse(JSON.stringify(n.opts||{}));
 if(n.type==='condition'){o.trueNextBlockId=by('true');o.falseNextBlockId=by('false');o.conditions=(n.opts.conditions||[]).map(c=>({id:c.id,name:c.name,group:c.group||'',options:c.options||{},trueNextBlockId:by(c.id)}));}
 else if(n.type==='randomizer'){o.randomizers=(n.ramos||[]).map(r=>({id:r.id,name:r.name,perc:r.perc,nextBlockId:by(r.id)}));}
 else{o.nextBlockId=by('out');if(['action','chat','field-operation','api','distribution'].includes(n.type))o.errorNextBlockId=by('err');if(n.type==='chat')o.timeoutNextBlockId=by('timeout');if(n.type==='distribution'){o.respondeuNextBlockId=by('respondeu');o.naoRespondeuNextBlockId=by('naoRespondeu');}}
 return o;}
function compile(){const blocks=Object.values(cur.nodes).map(n=>{if(!n.sourceBlockId)n.sourceBlockId=_uuid();return {id:n.id,type:n.type,options:routeFor(n),presentation:{x:Math.round(n.x),y:Math.round(n.y)},sourceBlockId:n.sourceBlockId};});
 const eb={};Object.values(cur.nodes).forEach(n=>{eb[n.id]={id:n.id,fam:TYPES[n.type].fam,sub:n.sub||'',x:Math.round(n.x),y:Math.round(n.y),note:n.note||'',extra:{},parts:[],ramos:n.ramos||[],noteOpen:false};});
 return{editor:{uid:cur.uid,notes:cur.notes||{},wires:cur.wires,blocks:eb},automation:{name:cur.name||cur.nome,provider:cur.provider||'apecerto-erp',anotacoes:cur.anotacoes||[],blocks}};}
async function save(){if(!cur){toast('Abra uma automação');return;}
 try{setStatus('Salvando…','#f59e0b');await sbPatch('/automacoes?id=eq.'+cur.id,{mapa:compile(),atualizada_em:new Date().toISOString()});dirty=false;setStatus('Salvo','#10b981');toast('Fluxo salvo no Supabase','ok');
 }catch(e){console.error(e);setStatus('Erro ao salvar','#dc2626');toast('Erro ao salvar: '+e.message,'err');}}

/* ---------- simular + monitor ---------- */
async function simular(){if(!cur){toast('Abra uma automação');return;}if(dirty){if(confirm('Salvar antes de simular? (a simulação usa a versão salva)'))await save();}
 const nome=prompt('Nome do lead de teste:','Lead Teste');if(nome===null)return;const tel=prompt('Telefone (só números):','5511999998888');if(tel===null)return;
 try{setStatus('Simulando…','#f59e0b');const tr=await sbRpc('motor_rodar',{p_auto_id:cur.id,p_lead:{nome,telefone:tel,origem:'simulacao'}});showPanel('Resultado da simulação',`<pre style="white-space:pre-wrap;font-size:12px;margin:0">${esc(tr)}</pre>`);setStatus('Conectado','#10b981');loadMonitor();
 }catch(e){console.error(e);setStatus('Erro','#dc2626');toast('Erro na simulação: '+e.message,'err');}}
let monRows=[];
async function loadMonitor(){if(!cur)return;try{monRows=await sbGet('/motor_execucoes?automacao_id=eq.'+cur.id+'&select=bloco_id,evento,status,detalhe,lead_nome,criado_em&order=id.desc&limit=200');applyCounts();}catch(e){console.warn('monitor',e.message);}}
function applyCounts(){if(!cur)return;const c={};monRows.forEach(r=>{const id=r.bloco_id||'_';c[id]=c[id]||{ok:0,alerta:0,erro:0};if(c[id][r.status]!=null)c[id][r.status]++;});
 Object.values(cur.nodes).forEach(n=>{const el=worldEl.querySelector(`.node[data-id="${n.id}"] [data-foot]`);if(!el)return;const x=c[n.id]||{ok:0,alerta:0,erro:0};el.querySelector('[data-c="ok"]').textContent=x.ok;el.querySelector('[data-c="alerta"]').textContent=x.alerta;el.querySelector('[data-c="erro"]').textContent=x.erro;});}
function openMonitor(){if(!cur){toast('Abra uma automação');return;}loadMonitor().then(()=>{const rows=monRows.slice(0,80).map(r=>{const col=r.status==='ok'?'var(--ok)':(r.status==='erro'?'var(--err)':'var(--warn)');const dt=new Date(r.criado_em).toLocaleString('pt-BR');return `<div style="display:flex;gap:8px;padding:8px 0;border-bottom:1px solid var(--line-soft);font-size:12px"><span style="width:8px;height:8px;border-radius:50%;background:${col};margin-top:4px;flex:0 0 auto"></span><div><b>${esc(r.evento)}</b> · ${esc(r.lead_nome||'')} <span style="color:var(--ink-faint)">— ${esc(dt)}</span><br><span style="color:var(--ink-soft)">${esc(r.detalhe||'')}</span></div></div>`;}).join('')||'<div style="color:var(--ink-faint);font-size:12px">Sem execuções. Simule ou dispare o webhook.</div>';showPanel('Monitor — '+cur.nome,rows);});}
function showPanel(title,html){let p=document.getElementById('rpanel');if(!p){p=document.createElement('div');p.id='rpanel';p.style.cssText='position:absolute;top:0;right:0;height:100%;width:360px;background:var(--surface);border-left:1px solid var(--line);z-index:46;box-shadow:-8px 0 24px rgba(15,23,42,.08);display:flex;flex-direction:column';MAIN.appendChild(p);}p.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 16px 8px"><h4 style="margin:0;font-size:15px;font-weight:700">${esc(title)}</h4><button id="rpClose" style="border:0;background:transparent">${ico('x',18,'var(--ink-faint)')}</button></div><div style="flex:1;overflow-y:auto;padding:4px 16px 20px">${html}</div>`;document.getElementById('rpClose').onclick=()=>p.remove();}

/* ---------- toolbar / sidebar ---------- */
document.getElementById('tbSave').onclick=save;
document.getElementById('tbDownload').onclick=()=>{if(!cur)return;const b=new Blob([JSON.stringify(compile(),null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=(cur.nome||'fluxo')+'.json';a.click();};
document.getElementById('tbTrash').onclick=()=>{if(cur&&selectedId)delNode(selectedId);};
document.getElementById('tbEdit').onclick=()=>{if(!cur)return;const nn=prompt('Renomear automação:',cur.nome);if(nn&&nn.trim()){cur.nome=nn.trim();cur.name=nn.trim();document.getElementById('flowName').textContent=cur.nome;setDirty();}};
document.getElementById('tbDup').onclick=()=>{if(!cur||!selectedId)return;const s=cur.nodes[selectedId];const id='b'+(cur.uid++);const c=JSON.parse(JSON.stringify(s));c.id=id;
 // duplica PARA BAIXO, na mesma coluna (mesma orientação)
 const srcEl=worldEl.querySelector(`.node[data-id="${selectedId}"]`);const h=srcEl?srcEl.offsetHeight:180;c.x=s.x;c.y=s.y+h+48;
 if(c.ramos)c.ramos=c.ramos.map(r=>({...r,id:'r'+(cur.uid++)}));cur.nodes[id]=c;selectedId=id;setDirty();renderNodes();markSel();};
document.getElementById('tbNote').onclick=()=>{if(!cur||!selectedId)return;const n=cur.nodes[selectedId];const t=prompt('Nota do bloco:',n.note||'');if(t!==null){n.note=t;setDirty();renderNodes();}};
document.getElementById('tbHide').onclick=async()=>{if(!cur)return;const nv=!(cur.ativa===true);if(nv&&(cur.status||'publicado')!=='publicado'){toast('Publique a automação antes de ativar','err');return;}try{await sbPatch('/automacoes?id=eq.'+cur.id,{ativa:nv});cur.ativa=nv;toast(nv?'Automação ativada':'Automação desativada','ok');const a=ref.automacoes.find(x=>x.id===cur.id);if(a)a.ativa=nv;renderStateBadges();renderSidebar(document.getElementById('sbSearch').value);}catch(e){toast('Erro: '+e.message,'err');}};
document.getElementById('tbNext').onclick=()=>{if(!cur)return;const ids=Object.keys(cur.nodes);if(!ids.length)return;const i=ids.indexOf(selectedId);selectedId=ids[(i+1)%ids.length];markSel();const n=cur.nodes[selectedId];view.x=canvasEl.clientWidth/2-(n.x+170)*view.scale;view.y=canvasEl.clientHeight/2-(n.y+90)*view.scale;applyTransform();};
(function extra(){const tb=ROOT.querySelector('.toolbar');const sep=document.createElement('div');sep.className='tb-sep';tb.appendChild(sep);const s=document.createElement('button');s.className='tb-btn';s.title='Simular';s.innerHTML=ico('play',16);s.onclick=simular;tb.appendChild(s);const m=document.createElement('button');m.className='tb-btn';m.title='Monitor';m.innerHTML=ico('monitor',16);m.onclick=openMonitor;tb.appendChild(m);})();

function renderPalette(){const body=document.getElementById('paletteBody');body.innerHTML=Object.entries(TYPES).map(([t,m])=>`<button class="pal-item" data-type="${t}"><span class="ico">${ico(m.vis,17,`var(${m.cvar})`)}</span>${m.label}</button>`).join('');
 body.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>{if(!cur){toast('Abra ou crie uma automação');return;}addNode(b.dataset.type,(-view.x+320)/view.scale,(-view.y+220)/view.scale);});}
function collapseSidebar(on){const app=document.querySelector('.apecerto-automation-builder .app')||document.querySelector('.app');if(!app)return;app.classList.toggle('sb-collapsed',!!on);try{fitView();}catch(e){}}
(function(){const c=document.getElementById('sbCollapse');if(c)c.onclick=()=>collapseSidebar(true);const o=document.getElementById('sbOpen');if(o)o.onclick=()=>collapseSidebar(false);})();
document.getElementById('paletteClose').onclick=()=>{document.getElementById('palette').style.display='none';document.getElementById('paletteToggle').style.display='flex';};
document.getElementById('paletteToggle').onclick=()=>{document.getElementById('palette').style.display='block';document.getElementById('paletteToggle').style.display='none';};
document.getElementById('sbSearch').oninput=e=>renderSidebar(e.target.value);
async function createAutomation(grupoFixo){
 const nm=prompt('Nome da nova automação:');if(!nm||!nm.trim())return;
 let grupo;
 if(grupoFixo!==undefined){grupo=grupoFixo;} // veio de um grupo específico (pode ser null = Sem grupo)
 else{grupo=prompt('Grupo/produto (opcional):','')||null;}
 const id='b1';
 const mapa={editor:{uid:2,notes:{},wires:[],blocks:{[id]:{id,fam:'gatilho',sub:'json-http-request-trigger',x:120,y:200,note:'',extra:{},parts:[],ramos:[],noteOpen:false}}},automation:{name:nm.trim(),provider:'apecerto-erp',anotacoes:[],blocks:[{id,type:'trigger',options:{triggers:[{name:'json-http-request-trigger',group:'system',options:{}}],nextBlockId:''},presentation:{x:120,y:200}}]}};
 try{const rows=await sbPost('/automacoes',{nome:nm.trim(),grupo,ativa:false,mapa});const nv=rows[0];ref.automacoes.push({id:nv.id,nome:nv.nome,grupo:nv.grupo,ativa:nv.ativa});renderSidebar(document.getElementById('sbSearch').value);openAutomacao(nv.id);toast('Automação criada','ok');}catch(e){toast('Erro ao criar: '+e.message,'err');}
}
document.getElementById('btnAddAutomation').onclick=()=>createAutomation();
document.getElementById('btnAbordagens').onclick=()=>openAbordagensManager();
document.getElementById('btnEscritorio').onclick=()=>openEscritorioConfig();

/* =====================================================================
   FASE 1 — Validação + Auto-save + Desfazer/Refazer  (aditivo, não altera contrato)
   ===================================================================== */
/* ---- histórico (undo/redo) ---- */
let _hist=[], _hidx=-1, _histT=null;
function _snap(){return JSON.stringify({nodes:cur.nodes,wires:cur.wires,uid:cur.uid,nome:cur.nome,ativa:cur.ativa});}
function historyInit(){if(!cur){_hist=[];_hidx=-1;updUndo();return;}_hist=[_snap()];_hidx=0;updUndo();}
function scheduleHistory(){clearTimeout(_histT);_histT=setTimeout(()=>{if(!cur)return;const s=_snap();if(_hist[_hidx]===s)return;_hist=_hist.slice(0,_hidx+1);_hist.push(s);if(_hist.length>60)_hist.shift();_hidx=_hist.length-1;updUndo();},350);}
function _applySnap(s){const o=JSON.parse(s);cur.nodes=o.nodes;cur.wires=o.wires;cur.uid=o.uid;cur.nome=o.nome;cur.ativa=o.ativa;document.getElementById('flowName').textContent=cur.nome;renderNodes();}
function undo(){if(_hidx<=0)return;_hidx--;_applySnap(_hist[_hidx]);dirty=true;scheduleAutosave();updUndo();}
function redo(){if(_hidx>=_hist.length-1)return;_hidx++;_applySnap(_hist[_hidx]);dirty=true;scheduleAutosave();updUndo();}
function updUndo(){const u=document.getElementById('btnUndo'),r=document.getElementById('btnRedo');if(u)u.style.opacity=_hidx>0?'1':'.35';if(r)r.style.opacity=(_hidx>=0&&_hidx<_hist.length-1)?'1':'.35';}
window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if((e.ctrlKey||e.metaKey)&&k==='z'){e.preventDefault();e.shiftKey?redo():undo();}else if((e.ctrlKey||e.metaKey)&&k==='y'){e.preventDefault();redo();}else if((e.ctrlKey||e.metaKey)&&k==='s'){e.preventDefault();save();}});

/* ---- auto-save + proteção ---- */
let _asT=null; const AUTOSAVE=false; // salva SOMENTE quando o usuário clica em Salvar
function scheduleAutosave(){if(!AUTOSAVE||!cur)return;clearTimeout(_asT);_asT=setTimeout(async()=>{if(dirty&&cur){await save();if(!dirty){const t=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});setStatus('Salvo às '+t,'#10b981');}}},2500);}
function cancelAutosave(){clearTimeout(_asT);}
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});

/* ---- validação ---- */
function centerBlock(id){const n=cur&&cur.nodes[id];if(!n)return;view.x=canvasEl.clientWidth/2-(n.x+170)*view.scale;view.y=canvasEl.clientHeight/2-(n.y+90)*view.scale;applyTransform();selectedId=id;markSel();}
function detectCycle(adj){const color={};let hit=null;function dfs(u){color[u]=1;for(const v of (adj[u]||[])){if(color[v]===1){hit=v;return true;}if(!color[v]&&dfs(v))return true;}color[u]=2;return false;}for(const id in cur.nodes){if(!color[id]&&dfs(id))return hit;}return null;}
function computeIssues(){
 if(!cur)return [];
 const N=cur.nodes,W=cur.wires,I=[];const add=(lvl,id,msg)=>I.push({lvl,id,msg});
 const list=Object.values(N),trig=list.filter(n=>n.type==='trigger');
 if(!trig.length)add('erro',null,'Sem bloco de início (gatilho).');
 const adj={};W.forEach(w=>{(adj[w.from]=adj[w.from]||[]).push(w.to);});
 const seen=new Set(),stk=trig.map(t=>t.id);while(stk.length){const id=stk.pop();if(seen.has(id))continue;seen.add(id);(adj[id]||[]).forEach(t=>stk.push(t));}
 list.forEach(n=>{if(n.type!=='trigger'&&!seen.has(n.id))add('alerta',n.id,'Bloco inalcançável (nada conecta a ele).');});
 const hasOut=(id,p)=>W.some(w=>w.from===id&&w.port===p);
 list.forEach(n=>{
  if(n.type==='condition'){const cs=n.opts.conditions||[];if(!cs.length)add('erro',n.id,'Condição sem nenhuma regra.');cs.forEach(c=>{const o=c.options||{};if(c.name==='lead-has-business-on-stage-condition'&&!o.etapa)add('alerta',n.id,'Condição de etapa sem etapa escolhida.');if(c.name==='lead-has-business-on-pipeline-condition'&&!o.pipeline)add('alerta',n.id,'Condição de funil sem funil.');});if(!hasOut(n.id,'true')&&!hasOut(n.id,'false'))add('alerta',n.id,'Condição sem nenhuma saída conectada.');}
  if(n.type==='action'){const as=n.opts.actions||[];if(!as.length)add('erro',n.id,'Bloco de ação sem ações.');as.forEach(a=>{const o=a.options||{};if(a.name==='add-tag-action'&&!o.tag)add('alerta',n.id,'Ação "adicionar tag" sem tag.');if(a.name==='add-attendant-on-business-action'&&!o.corretor)add('alerta',n.id,'Ação "atribuir corretor" sem corretor.');if((a.name==='create-business-action'||a.name==='move-business-action')&&!o.pipeline)add('alerta',n.id,'Ação de negócio sem funil.');if(a.name==='start-another-automation-action'){if(!o.automacao)add('alerta',n.id,'Ação "iniciar automação" sem alvo.');else if(o.automacao===cur.nome)add('erro',n.id,'Automação chamando ela mesma.');}});}
  if(n.type==='chat'){const ms=n.opts.messages||[];if(!ms.some(m=>m.options&&(m.options.text||m.options.url)))add('alerta',n.id,'Mensagem vazia.');if(!n.opts.instancia&&!n.opts.corretor)add('alerta',n.id,'Mensagem sem instância nem corretor definidos.');}
  if(n.type==='time'&&!(+n.opts.valor>0))add('alerta',n.id,'Espera com tempo 0.');
  if(n.type==='randomizer'){const sum=(n.ramos||[]).reduce((a,r)=>a+(+r.perc||0),0);if(sum!==100)add('alerta',n.id,'Randomizador soma '+sum+'% (ideal 100%).');(n.ramos||[]).forEach(r=>{if(!hasOut(n.id,r.id))add('alerta',n.id,'Caminho "'+(r.name||'?')+'" sem destino.');});}
 });
 const cyc=detectCycle(adj);
 if(cyc){const temEspera=list.some(n=>n.type==='time');add(temEspera?'alerta':'erro',cyc,temEspera?'Há um ciclo no fluxo — confirme que passa por uma Espera.':'Possível loop infinito (ciclo sem bloco de Espera).');}
 return I;
}
function validate(){if(!cur){toast('Abra uma automação');return;}showValidation(computeIssues());}
function showValidation(I){
 const erros=I.filter(x=>x.lvl==='erro'),alertas=I.filter(x=>x.lvl==='alerta');
 let head;
 if(erros.length)head=`<div style="background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;border-radius:9px;padding:10px 12px;font-weight:700;font-size:13px;margin-bottom:10px">${erros.length} erro(s) impeditivo(s)${alertas.length?' · '+alertas.length+' alerta(s)':''}</div>`;
 else if(alertas.length)head=`<div style="background:#fffbeb;border:1px solid #fde68a;color:#92700a;border-radius:9px;padding:10px 12px;font-weight:700;font-size:13px;margin-bottom:10px">Sem erros · ${alertas.length} alerta(s)</div>`;
 else head=`<div style="background:#ecfdf5;border:1px solid #a7f3d0;color:#047857;border-radius:9px;padding:10px 12px;font-weight:700;font-size:13px;margin-bottom:10px">✔ Pronto para publicar</div>`;
 const rowH=x=>{const c=x.lvl==='erro'?'var(--err)':'var(--warn)';return `<button data-vgo="${x.id||''}" style="display:flex;gap:8px;width:100%;text-align:left;border:1px solid var(--line);background:#fff;border-radius:9px;padding:9px 10px;margin-bottom:6px;font-size:12px;cursor:${x.id?'pointer':'default'}"><span style="width:8px;height:8px;border-radius:50%;background:${c};margin-top:4px;flex:0 0 auto"></span><span>${esc(x.msg)}${x.id?' <span style="color:var(--ink-faint)">— ir ao bloco</span>':''}</span></button>`;};
 showPanel('Validação — '+cur.nome, head + (I.length?[...erros,...alertas].map(rowH).join(''):'<div style="color:var(--ink-faint);font-size:12px">Tudo certo.</div>'));
 document.querySelectorAll('[data-vgo]').forEach(b=>{if(b.dataset.vgo)b.onclick=()=>centerBlock(b.dataset.vgo);});
}

/* ---- botões novos na toolbar (Desfazer / Refazer / Validar) ---- */
(function fase1btns(){
 const tb=ROOT.querySelector('.toolbar');const sep=document.createElement('div');sep.className='tb-sep';tb.appendChild(sep);
 function mk(id,title,inner,fn){const b=document.createElement('button');b.className='tb-btn';if(id)b.id=id;b.title=title;b.innerHTML='<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+inner+'</svg>';b.onclick=fn;tb.appendChild(b);return b;}
 mk('btnUndo','Desfazer (Ctrl+Z)','<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-1"/>',undo);
 mk('btnRedo','Refazer (Ctrl+Shift+Z)','<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h1"/>',redo);
 mk(null,'Validar automação','<circle cx="12" cy="12" r="9"/><path d="M8.5 12l2.2 2.2L15.5 9.5"/>',validate);
 updUndo();
})();

/* =====================================================================
   FASE 2B — Estados (Rascunho/Publicado/Ativo) + Versões + Sidebar
   Aditivo. Contrato/motor preservados.
   ===================================================================== */
function renderStateBadges(){
 if(!cur)return;const sub=document.getElementById('flowSub');let host=document.getElementById('stateBadges');
 if(!host){host=document.createElement('span');host.id='stateBadges';host.style.cssText='display:inline-flex;gap:6px;margin-left:8px;vertical-align:middle';sub.parentNode.appendChild(host);}
 const pub=(cur.status||'publicado')==='publicado',ativa=cur.ativa===true;
 const chip=(t,bg,fg)=>`<span style="font-size:9px;font-weight:800;letter-spacing:.03em;border-radius:999px;padding:2px 8px;background:${bg};color:${fg}">${t}</span>`;
 host.innerHTML=(cur.arquivada?chip('ARQUIVADA','#e2e8f0','#475569'):'')+chip(pub?'PUBLICADO':'RASCUNHO',pub?'#dcfce7':'#fef9c3',pub?'#166534':'#854d0e')+chip(ativa?'ATIVO':'INATIVO',ativa?'#dbeafe':'#f1f5f9',ativa?'#1e40af':'#64748b');
}
/* sidebar: tabs + menu de item */
function injectSidebarTabs(){
 const list=document.getElementById('sbList');if(!list||document.getElementById('sbTabs'))return;
 const t=document.createElement('div');t.id='sbTabs';t.style.cssText='display:flex;gap:5px;flex-wrap:wrap;padding:2px 12px 8px';
 const tabs=[['todas','Todas'],['ativas','Ativas'],['publicadas','Publicadas'],['rascunhos','Rascunhos'],['arquivadas','Arquivadas']];
 t.innerHTML=tabs.map(([k,l])=>`<button data-f="${k}" style="border:1px solid var(--line);background:${k===sbFilter?'var(--brand-soft)':'#fff'};color:${k===sbFilter?'var(--brand)':'var(--ink-soft)'};border-radius:999px;padding:4px 10px;font-size:11px;font-weight:600">${l}</button>`).join('');
 list.parentNode.insertBefore(t,list);
 t.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{sbFilter=b.dataset.f;t.querySelectorAll('[data-f]').forEach(x=>{const on=x.dataset.f===sbFilter;x.style.background=on?'var(--brand-soft)':'#fff';x.style.color=on?'var(--brand)':'var(--ink-soft)';});renderSidebar(document.getElementById('sbSearch').value);});
}
function sbMenu(x,y,id){closeMini();const a=ref.automacoes.find(z=>z.id===id);const m=document.createElement('div');m.className='minimenu';m.id='mini';m.style.left=Math.min(x,innerWidth-220)+'px';m.style.top=Math.min(y,innerHeight-240)+'px';
 const items=[['dup','Duplicar'],['exp','Exportar JSON'],[a&&a.arquivada?'unarch':'arch',a&&a.arquivada?'Desarquivar':'Arquivar'],['move','Mover para grupo…'],['del','Excluir']];
 m.innerHTML=items.map(([k,l])=>`<button data-k="${k}" style="${k==='del'?'color:var(--err)':''}">${k==='del'?ico('trash',13)+' ':''}${esc(l)}</button>`).join('');
 ROOT.appendChild(m);m.querySelectorAll('[data-k]').forEach(b=>b.onclick=async()=>{closeMini();await sbAction(b.dataset.k,id);});
 setTimeout(()=>document.addEventListener('mousedown',outsideMini),0);}
async function sbAction(k,id){const a=ref.automacoes.find(z=>z.id===id);try{
 if(k==='dup'){const r=(await sbGet('/automacoes?id=eq.'+id+'&select=nome,grupo,mapa'))[0];const nv=(await sbPost('/automacoes',{nome:r.nome+' (cópia)',grupo:r.grupo,ativa:false,status:'rascunho',mapa:r.mapa}))[0];ref.automacoes.push({id:nv.id,nome:nv.nome,grupo:nv.grupo,ativa:false,status:'rascunho',arquivada:false});renderSidebar(document.getElementById('sbSearch').value);toast('Duplicada','ok');}
 else if(k==='exp'){const r=(await sbGet('/automacoes?id=eq.'+id+'&select=nome,mapa'))[0];const b=new Blob([JSON.stringify(r.mapa,null,2)],{type:'application/json'});const el=document.createElement('a');el.href=URL.createObjectURL(b);el.download=(r.nome||'fluxo')+'.json';el.click();}
 else if(k==='arch'||k==='unarch'){const nv=k==='arch';await sbPatch('/automacoes?id=eq.'+id,{arquivada:nv});if(a)a.arquivada=nv;if(cur&&cur.id===id){cur.arquivada=nv;renderStateBadges();}renderSidebar(document.getElementById('sbSearch').value);toast(nv?'Arquivada':'Desarquivada','ok');}
 else if(k==='move'){const g=await pickGroup(a?a.grupo:'');if(g===null)return;await sbPatch('/automacoes?id=eq.'+id,{grupo:g||null});if(a)a.grupo=g||null;if(cur&&cur.id===id)cur.grupo=g||null;renderSidebar(document.getElementById('sbSearch').value);toast('Movida','ok');}
 else if(k==='del'){if(!confirm('Excluir a automação "'+((a&&a.nome)||'')+'" DEFINITIVAMENTE?\n\nEssa ação não pode ser desfeita.'))return;await sbDelete('/automacoes?id=eq.'+id);const ix=ref.automacoes.findIndex(z=>z.id===id);if(ix>=0)ref.automacoes.splice(ix,1);if(cur&&cur.id===id){cur=null;const fn=document.getElementById('flowName');if(fn)fn.textContent='—';const fs=document.getElementById('flowSub');if(fs)fs.textContent='';renderNodes();if(typeof emptyTip!=='undefined'&&emptyTip)emptyTip.style.display='';}renderSidebar(document.getElementById('sbSearch').value);toast('Automação excluída','ok');}
 }catch(e){toast('Erro: '+e.message,'err');}}
/* seletor de grupo: lista os grupos existentes + opção de criar novo */
function pickGroup(atual){return new Promise(resolve=>{
 const grupos=[...new Set(ref.automacoes.map(a=>a.grupo).filter(Boolean))].sort();
 closeMini();const sc=document.createElement('div');sc.className='cond-scrim';sc.id='grpScrim';
 sc.innerHTML=`<div style="background:#fff;border-radius:16px;width:380px;max-width:92vw;box-shadow:0 24px 60px rgba(0,0,0,.32);overflow:hidden"><div style="display:flex;align-items:center;justify-content:space-between;padding:15px 16px 8px"><b style="font-size:15px;color:var(--ink)">Mover para grupo</b><button data-x style="border:0;background:none;font-size:20px;cursor:pointer;color:var(--ink-faint)">×</button></div>
  <div style="padding:6px 14px 14px;display:flex;flex-direction:column;gap:6px;max-height:340px;overflow:auto">
   ${grupos.map(g=>`<button data-g="${esc(g)}" class="grp-opt" style="text-align:left;padding:9px 11px;border:1px solid var(--line);border-radius:9px;background:${g===atual?'var(--brand-soft)':'#fff'};color:${g===atual?'var(--brand)':'var(--ink)'};font-size:13px;font-weight:600;cursor:pointer">${ico('flow',13,'var(--ink-faint)')} ${esc(g)}</button>`).join('')}
   <button data-g="" class="grp-opt" style="text-align:left;padding:9px 11px;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--ink-soft);font-size:13px;cursor:pointer">Sem grupo</button>
   <div style="display:flex;gap:6px;margin-top:4px"><input id="grpNew" class="ne-inp" placeholder="+ criar novo grupo" style="flex:1"><button id="grpNewOk" class="sb-add" style="margin:0;padding:8px 12px;width:auto">Criar</button></div>
  </div></div>`;
 ROOT.appendChild(sc);
 const close=v=>{sc.remove();resolve(v);};
 sc.querySelector('[data-x]').onclick=()=>close(null);
 sc.onclick=e=>{if(e.target===sc)close(null);};
 sc.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>close(b.dataset.g));
 const ni=sc.querySelector('#grpNew');sc.querySelector('#grpNewOk').onclick=()=>{const v=(ni.value||'').trim();if(v)close(v);else ni.focus();};
 ni.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();const v=(ni.value||'').trim();if(v)close(v);}};
});}
/* publicar + versões */
async function nextVersion(id){const r=await sbGet('/automacao_versoes?automacao_id=eq.'+id+'&select=versao&order=versao.desc&limit=1');return ((r[0]&&r[0].versao)||0)+1;}
async function publish(){if(!cur){toast('Abra uma automação');return;}
 const errs=computeIssues().filter(x=>x.lvl==='erro');if(errs.length){toast('Corrija os '+errs.length+' erro(s) antes de publicar','err');validate();return;}
 try{setStatus('Publicando…','#f59e0b');if(dirty)await save();const v=await nextVersion(cur.id);
  await sbPost('/automacao_versoes',{automacao_id:cur.id,versao:v,nome:cur.nome,mapa:compile(),observacao:'Publicação',criado_por:'construtor'});
  await sbPatch('/automacoes?id=eq.'+cur.id,{status:'publicado',publicado_em:new Date().toISOString()});
  cur.status='publicado';cur.publicado_em=new Date().toISOString();const a=ref.automacoes.find(x=>x.id===cur.id);if(a)a.status='publicado';
  renderStateBadges();renderSidebar(document.getElementById('sbSearch').value);setStatus('Publicado','#10b981');toast('Publicada (v'+v+')','ok');
 }catch(e){setStatus('Erro','#dc2626');toast('Erro ao publicar: '+e.message,'err');}}
async function openVersions(){if(!cur){toast('Abra uma automação');return;}
 try{const vs=await sbGet('/automacao_versoes?automacao_id=eq.'+cur.id+'&select=id,versao,nome,observacao,criado_em&order=versao.desc');
  const html=vs.length?vs.map(v=>`<div class="ne-row" style="margin-bottom:8px"><div class="ne-rowh" style="justify-content:space-between"><b style="font-size:12px">v${v.versao}</b><span style="font-size:11px;color:var(--ink-faint)">${new Date(v.criado_em).toLocaleString('pt-BR')}</span></div><div style="font-size:11px;color:var(--ink-soft)">${esc(v.observacao||'')}</div><div style="display:flex;gap:6px;margin-top:4px"><button class="hookbtn" data-vrest="${v.id}">Restaurar</button><button class="hookbtn" data-vcmp="${v.id}">Comparar</button></div></div>`).join(''):'<div style="color:var(--ink-faint);font-size:12px">Nenhuma versão. Publique para criar a v1.</div>';
  showPanel('Versões — '+cur.nome,html);
  document.querySelectorAll('[data-vrest]').forEach(b=>b.onclick=()=>restoreVersion(+b.dataset.vrest));
  document.querySelectorAll('[data-vcmp]').forEach(b=>b.onclick=()=>compareVersion(+b.dataset.vcmp));
 }catch(e){toast('Erro: '+e.message,'err');}}
async function restoreVersion(vid){if(!confirm('Restaurar esta versão no editor? (não publica automaticamente)'))return;
 try{const v=(await sbGet('/automacao_versoes?id=eq.'+vid+'&select=mapa'))[0];const t=hydrate({id:cur.id,nome:cur.nome,grupo:cur.grupo,ativa:cur.ativa,status:cur.status,publicado_em:cur.publicado_em,arquivada:cur.arquivada,mapa:v.mapa});cur.nodes=t.nodes;cur.wires=t.wires;cur.uid=t.uid;renderNodes();fitView();setDirty();toast('Versão restaurada no editor','ok');
 }catch(e){toast('Erro: '+e.message,'err');}}
async function compareVersion(vid){
 try{const v=(await sbGet('/automacao_versoes?id=eq.'+vid+'&select=versao,mapa'))[0];const vb=((v.mapa&&v.mapa.automation&&v.mapa.automation.blocks)||[]).map(b=>b.id);const cb=compile().automation.blocks.map(b=>b.id);
  const add=cb.filter(x=>!vb.includes(x)),rem=vb.filter(x=>!cb.includes(x));
  showPanel('Comparar com v'+v.versao,`<div style="font-size:12px;line-height:1.7"><b>Agora:</b> ${cb.length} blocos · <b>v${v.versao}:</b> ${vb.length} blocos<br><span style="color:var(--ok)">+ ${add.length} adicionados</span> · <span style="color:var(--err)">− ${rem.length} removidos</span>${add.length?'<br>Novos: '+add.map(esc).join(', '):''}${rem.length?'<br>Removidos: '+rem.map(esc).join(', '):''}</div>`);
 }catch(e){toast('Erro: '+e.message,'err');}}
/* botões: Publicar + Versões */
(function fase2btns(){const tb=ROOT.querySelector('.toolbar');const sep=document.createElement('div');sep.className='tb-sep';tb.appendChild(sep);
 function mk(title,inner,fn){const b=document.createElement('button');b.className='tb-btn';b.title=title;b.innerHTML='<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+inner+'</svg>';b.onclick=fn;tb.appendChild(b);return b;}
 mk('Publicar','<path d="M12 19V6"/><path d="m5 12 7-7 7 7"/>',publish);
 mk('Versões','<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',openVersions);
})();
injectSidebarTabs();

/* ---- seletor de campo de destino (2 colunas, categorizado) ---- */
/* estilo movido para apeab_styles.css */
let _cpState={cat:'Campos do lead',q:''};
const CREATE_PREF={'Campos adicionais do lead':'lead_extra.','Campos adicionais do negócio':'negocio.','Campos adicionais da empresa':'empresa.'};
function _tico(t){return t==='#'?'#':t==='D'?'▦':t==='L'?'≣':t==='{}'?'{ }':'T';}
function openCampoPicker(x,y,cb){closeCampoPicker();_cpState={cat:'Campos do lead',q:''};
 const p=document.createElement('div');p.id='campoPick';p.className='campo-pick';p.style.left=Math.min(x,innerWidth-536)+'px';p.style.top=Math.min(y,innerHeight-410)+'px';
 function render(){const cats=Object.keys(CAMPOS_DEST),cat=_cpState.cat,ql=_cpState.q.toLowerCase();const fields=(CAMPOS_DEST[cat]||[]).filter(f=>!ql||f[1].toLowerCase().includes(ql));
  p.innerHTML=`<input class="cp-search" placeholder="Pesquisar..." value="${esc(_cpState.q)}"><div class="cp-cols"><div class="cp-cats">${cats.map(c=>`<button data-cat="${esc(c)}" class="${c===cat?'on':''}">${esc(c)}</button>`).join('')}</div><div class="cp-fields">${fields.map(f=>`<button data-key="${esc(f[0])}"><span class="cp-t">${_tico(f[2])}</span>${esc(f[1])}</button>`).join('')||'<div class="cp-empty">Nada aqui</div>'}${CREATE_PREF[cat]?'<button class="cp-create" data-create>+ Criar campo</button>':''}</div></div>`;
  const si=p.querySelector('.cp-search');si.oninput=e=>{_cpState.q=e.target.value;render();p.querySelector('.cp-search').focus();p.querySelector('.cp-search').setSelectionRange(_cpState.q.length,_cpState.q.length);};
  p.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{_cpState.cat=b.dataset.cat;_cpState.q='';render();});
  p.querySelectorAll('[data-key]').forEach(b=>b.onclick=()=>{cb(b.dataset.key);closeCampoPicker();});
  const cr=p.querySelector('[data-create]');if(cr)cr.onclick=()=>{const nm=prompt('Nome do novo campo:');if(!nm||!nm.trim())return;const slug=nm.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');cb((CREATE_PREF[cat]||'lead_extra.')+slug);closeCampoPicker();};
 }
 render();ROOT.appendChild(p);setTimeout(()=>document.addEventListener('mousedown',_cpOutside),0);}
function _cpOutside(e){if(!e.target.closest('#campoPick'))closeCampoPicker();}
function closeCampoPicker(){const p=document.getElementById('campoPick');if(p)p.remove();document.removeEventListener('mousedown',_cpOutside);}
/* estilo movido para apeab_styles.css */
const CAT_COND_ICON={'Negócios':'brief','Leads':'user','Tempo':'wait','Mensagens':'message','Instagram':'insta','Campos':'field'};
let _condPk={cat:'Negócios',q:''};
function openCondPicker(_x,_y,cb){closeCondModal();_condPk={cat:'Negócios',q:''};
 const scrim=document.createElement('div');scrim.className='cond-scrim';scrim.id='condScrim';
 const modal=document.createElement('div');modal.className='cond-modal';scrim.appendChild(modal);
 function render(){const cats=Object.keys(CONDICOES),cat=_condPk.cat,ql=_condPk.q.toLowerCase();const list=(CONDICOES[cat]||[]).filter(f=>!ql||f[1].toLowerCase().includes(ql)||f[2].toLowerCase().includes(ql));
  modal.innerHTML=`<div class="cm-rail">${cats.map(c=>`<button data-cat="${esc(c)}" class="${c===cat?'on':''}">${ico(CAT_COND_ICON[c]||'field',16,'currentColor')}<span>${esc(c)}</span></button>`).join('')}</div><div class="cm-main"><div class="cm-head"><div><h3>${esc(cat)}</h3><p>Adicione condições de ${esc(cat.toLowerCase())}</p></div><button class="cm-x" data-x>${ico('x',20,'currentColor')}</button></div><input class="cm-search" placeholder="Pesquisar..." value="${esc(_condPk.q)}"><div class="cm-list">${list.map(f=>`<button class="cm-card" data-key="${esc(f[0])}"><span class="cm-cico">${ico(CAT_COND_ICON[cat]||'field',17,'currentColor')}</span><span class="cm-ct"><b>${esc(f[1])}</b><span>${esc(f[2])}</span></span>${f[4]?'<span class="cm-badge">Atenção</span>':''}</button>`).join('')||'<div style="color:var(--ink-faint);font-size:13px;padding:12px">Nada aqui</div>'}</div></div>`;
  modal.querySelector('[data-x]').onclick=closeCondModal;
  modal.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{_condPk.cat=b.dataset.cat;_condPk.q='';render();});
  const si=modal.querySelector('.cm-search');si.oninput=e=>{_condPk.q=e.target.value;render();const s2=modal.querySelector('.cm-search');s2.focus();s2.setSelectionRange(_condPk.q.length,_condPk.q.length);};
  modal.querySelectorAll('[data-key]').forEach(b=>b.onclick=()=>{cb(b.dataset.key);closeCondModal();});
 }
 render();scrim.onclick=e=>{if(e.target===scrim)closeCondModal();};ROOT.appendChild(scrim);}
function closeCondModal(){const s=document.getElementById('condScrim');if(s)s.remove();}
let _acaoPk={cat:'Negócios',q:''};
function openAcaoPicker(cb){closeCondModal();_acaoPk={cat:'Negócios',q:''};
 const scrim=document.createElement('div');scrim.className='cond-scrim';scrim.id='condScrim';
 const modal=document.createElement('div');modal.className='cond-modal';scrim.appendChild(modal);
 function render(){const cats=Object.keys(ACOES),cat=_acaoPk.cat,ql=_acaoPk.q.toLowerCase();const list=(ACOES[cat]||[]).filter(f=>!ql||f[1].toLowerCase().includes(ql)||f[2].toLowerCase().includes(ql));
  modal.innerHTML=`<div class="cm-rail">${cats.map(c=>`<button data-cat="${esc(c)}" class="${c===cat?'on':''}">${ico(CAT_ACAO_ICON[c]||'brief',16,'currentColor')}<span>${esc(c)}</span></button>`).join('')}</div><div class="cm-main"><div class="cm-head"><div><h3>${esc(cat)}</h3><p>Adicione ações em ${esc(cat.toLowerCase())}</p></div><button class="cm-x" data-x>${ico('x',20,'currentColor')}</button></div><input class="cm-search" placeholder="Pesquisar..." value="${esc(_acaoPk.q)}"><div class="cm-list">${list.map(f=>`<button class="cm-card" data-key="${esc(f[0])}"><span class="cm-cico">${ico(CAT_ACAO_ICON[cat]||'brief',17,'currentColor')}</span><span class="cm-ct"><b>${esc(f[1])}</b><span>${esc(f[2])}</span></span>${f[4]?'<span class="cm-badge">Atenção</span>':''}</button>`).join('')||'<div style="color:var(--ink-faint);font-size:13px;padding:20px 12px;text-align:center">Nenhuma ação nesta categoria por enquanto.</div>'}</div></div>`;
  modal.querySelector('[data-x]').onclick=closeCondModal;
  modal.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{_acaoPk.cat=b.dataset.cat;_acaoPk.q='';render();});
  const si=modal.querySelector('.cm-search');si.oninput=e=>{_acaoPk.q=e.target.value;render();const s2=modal.querySelector('.cm-search');s2.focus();s2.setSelectionRange(_acaoPk.q.length,_acaoPk.q.length);};
  modal.querySelectorAll('[data-key]').forEach(b=>b.onclick=()=>{cb(b.dataset.key);closeCondModal();});
 }
 render();scrim.onclick=e=>{if(e.target===scrim)closeCondModal();};ROOT.appendChild(scrim);}

/* ---- Mensagem: painel lateral (drawer) fiel ao ApeCerto ---- */
const drawer=document.getElementById('drawer');
if(document.getElementById('drawerBack'))document.getElementById('drawerBack').onclick=()=>drawer.classList.remove('show');
const PARTS=[['send-text-message','Mensagem de texto','field'],['send-image-message','Imagem','insta'],['send-video-message','Vídeo','monitor'],['send-audio-message','Mensagem de áudio','mic'],['send-file-message','Arquivo anexo','attach'],['send-dynamic-url-message','Arquivo URL Dinâmica','link'],['wait-user-input','Entrada do usuário','message'],['delay','Atraso de tempo','wait']];
function msgPartLabel(m){const nm=m.name,o=m.options||{};if(nm==='send-text-message')return o.text?('"'+String(o.text).slice(0,30)+(String(o.text).length>30?'…':'')+'"'):'Texto (vazio)';if(nm==='wait-user-input')return 'Entrada do usuário';if(nm==='delay')return 'Atraso '+(o.valor||0)+' '+(o.unidade||'seg');if(nm==='send-audio-message')return 'Áudio';if(nm==='send-image-message')return 'Imagem'+(o.url?' ✓':'');if(nm==='send-video-message')return 'Vídeo'+(o.url?' ✓':'');if(nm==='send-file-message')return 'Anexo';if(nm==='send-dynamic-url-message')return 'URL dinâmica';return nm;}
function msgPartEditor(m,i){const nm=m.name,o=m.options||{};let inner='';
 if(nm==='send-text-message')inner=`<textarea class="dw-input" data-mtext style="min-height:70px;resize:vertical">${esc(o.text||'')}</textarea><div style="margin-top:6px"><select class="dw-select" data-mcampo><option value="">inserir campo…</option>${CAMPOS.map(c=>`<option>${c}</option>`).join('')}</select></div>`;
 else if(nm==='wait-user-input')inner=`<div style="font-size:11.5px;color:var(--ink-soft);margin-bottom:6px">Aguarda a resposta do lead e continua. Tempo limite:</div><div style="display:flex;gap:6px"><input class="dw-input" type="number" data-mv value="${esc(o.timeout||0)}" placeholder="0 = sem limite"><select class="dw-select" data-mu>${['minutos','horas','dias'].map(u=>`<option ${o.unidade===u?'selected':''}>${u}</option>`).join('')}</select></div>`;
 else if(nm==='delay')inner=`<div style="display:flex;gap:6px"><input class="dw-input" type="number" data-mv value="${esc(o.valor||0)}"><select class="dw-select" data-mu>${['segundos','minutos','horas'].map(u=>`<option ${o.unidade===u?'selected':''}>${u}</option>`).join('')}</select></div>`;
 else if(nm==='send-image-message'||nm==='send-video-message'){const isImg=nm==='send-image-message';const has=!!o.url;
   const prev=has?(isImg?`<img src="${esc(o.url)}" style="max-width:100%;max-height:130px;border-radius:8px;display:block;margin-bottom:6px" onerror="this.style.display='none'">`:`<div style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--ok);margin-bottom:6px">${ico('monitor',15,'var(--ok)')} Vídeo anexado${o.filename?' · '+esc(o.filename):''}</div>`):'';
   inner=`${prev}<label class="ne-add" style="cursor:pointer;flex-direction:column;gap:2px;padding:12px"><input type="file" accept="${isImg?'image/*':'video/*'}" data-mfile style="display:none">${ico(isImg?'insta':'monitor',18,'var(--brand)')}<span>${has?'Trocar arquivo':'Escolher da galeria'}</span><span style="font-size:10px;color:var(--ink-faint);font-weight:400">${isImg?'imagem':'vídeo'} · máx. 16MB · enviado nativo</span></label><div data-mfstatus style="font-size:10.5px;margin-top:4px;color:var(--ink-faint)"></div><input class="dw-input" data-mcap value="${esc(o.caption||'')}" placeholder="Legenda (opcional)" style="margin-top:6px">`;}
 else inner=`<input class="dw-input" data-murl value="${esc(o.url||'')}" placeholder="URL do arquivo">`;
 const label=(PARTS.find(p=>p[0]===nm)||[,nm])[1];
 return `<div class="dw-opt" draggable="true" data-mpart="${i}" style="flex-direction:column;align-items:stretch;gap:7px"><div style="display:flex;align-items:center;justify-content:space-between;gap:6px"><span data-mdrag title="Arraste para reordenar" style="cursor:grab;color:var(--ink-faint);font-size:15px;line-height:1;user-select:none">⠿</span><b style="font-size:12.5px;font-weight:700;flex:1">${esc(label)}</b><button class="ne-del" data-mdel style="width:26px;height:26px">${ico('trash',13)}</button></div>${inner}</div>`;}
function refreshNodeChat(n){if(worldEl.querySelector(`.node[data-id="${n.id}"]`)){renderNodes();markSel();}}
const MIDIA_MAX=16*1024*1024;
async function uploadMidia(file){
 const ext=(file.name.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'');
 const path='auto/'+_uuid()+(ext?('.'+ext):'');
 const r=await fetch(SUPA_URL+'/storage/v1/object/automacao-midia/'+path,{method:'POST',headers:{apikey:SUPA_KEY,Authorization:'Bearer '+authBearer(),'Content-Type':file.type||'application/octet-stream','x-upsert':'true'},body:file});
 if(!r.ok)throw new Error('HTTP '+r.status+' '+(await r.text()).slice(0,140));
 return SUPA_URL+'/storage/v1/object/public/automacao-midia/'+path;
}
function openMsgDrawer(n){
 n.opts.messages=n.opts.messages||[];n.opts.destinatario=n.opts.destinatario||'{telefone}';n.opts.platform=n.opts.platform||'WHATSAPP';n.opts.provider=n.opts.provider||'EVOLUTION_API';
 const body=document.getElementById('drawerBody');
 document.getElementById('drawerTitle').textContent='Mensagens';document.getElementById('drawerSub').textContent='Envie, receba e armazene respostas';
 function render(){
  body.innerHTML=`<div class="dw-label" style="margin-top:2px">Conexão</div><button id="msgConx" class="dw-select" style="text-align:left;cursor:pointer;display:flex;align-items:center;justify-content:space-between">${n.opts.instancia?esc(n.opts.instancia):'<span style="color:var(--ink-faint)">Selecionar</span>'}<span style="color:var(--ink-faint)">⌄</span></button><div style="font-size:10.5px;color:var(--ink-faint);margin:6px 0 2px">Deixe em branco para usar a conexão dos blocos anteriores.</div><div style="height:1px;background:var(--line-soft);margin:14px 0 4px"></div>${PARTS.map(p=>`<button class="dw-opt" data-add="${p[0]}"><span class="oic">${ico(p[2],17,'var(--brand)')}</span>${p[1]}</button>`).join('')}<div id="mparts" style="margin-top:12px;display:flex;flex-direction:column;gap:8px">${n.opts.messages.map((m,i)=>msgPartEditor(m,i)).join('')}</div>`;
  document.getElementById('msgConx').onclick=e=>{const r=e.currentTarget.getBoundingClientRect();openInstancePicker(r.left,r.bottom+4,(nm)=>{n.opts.instancia=nm;setDirty();render();refreshNodeChat(n);});};
  body.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{const nm=b.dataset.add;const opt=nm==='send-text-message'?{text:''}:(nm==='wait-user-input'?{timeout:0,unidade:'minutos'}:(nm==='delay'?{valor:5,unidade:'segundos'}:{url:''}));n.opts.messages.push({name:nm,options:opt});setDirty();render();refreshNodeChat(n);});
  let _dragFrom=null;
  body.querySelectorAll('[data-mpart]').forEach(row=>{const i=+row.dataset.mpart,m=n.opts.messages[i];
   row.querySelector('[data-mdel]').onclick=()=>{n.opts.messages.splice(i,1);setDirty();render();refreshNodeChat(n);};
   const ta=row.querySelector('[data-mtext]');if(ta){_trackCaret(ta);ta.onchange=()=>{m.options=m.options||{};m.options.text=ta.value;setDirty();refreshNodeChat(n);};}
   const cs=row.querySelector('[data-mcampo]');if(cs&&ta)cs.onchange=e=>{const tok=e.target.value;if(!tok)return;m.options=m.options||{};m.options.text=insertAtCaret(ta,tok);e.target.value='';setDirty();refreshNodeChat(n);};
   const mv=row.querySelector('[data-mv]');if(mv)mv.onchange=()=>{m.options=m.options||{};m.options[m.name==='wait-user-input'?'timeout':'valor']=+mv.value||0;setDirty();refreshNodeChat(n);};
   const mu=row.querySelector('[data-mu]');if(mu)mu.onchange=()=>{m.options=m.options||{};m.options.unidade=mu.value;setDirty();};
   const url=row.querySelector('[data-murl]');if(url)url.onchange=()=>{m.options=m.options||{};m.options.url=url.value;setDirty();refreshNodeChat(n);};
   const cap=row.querySelector('[data-mcap]');if(cap)cap.onchange=()=>{m.options=m.options||{};m.options.caption=cap.value;setDirty();};
   const mf=row.querySelector('[data-mfile]');if(mf)mf.onchange=async()=>{const f=mf.files&&mf.files[0];if(!f)return;const stEl=row.querySelector('[data-mfstatus]');
    if(f.size>MIDIA_MAX){if(stEl){stEl.textContent='Arquivo tem '+(f.size/1048576).toFixed(1)+'MB — o limite é 16MB. Não enviado.';stEl.style.color='var(--err)';}mf.value='';return;}
    if(stEl){stEl.textContent='Enviando arquivo…';stEl.style.color='var(--ink-faint)';}
    try{const url=await uploadMidia(f);m.options=m.options||{};m.options.url=url;m.options.filename=f.name;m.options.mimetype=f.type;setDirty();render();refreshNodeChat(n);}
    catch(e){if(stEl){stEl.textContent='Erro ao enviar: '+e.message;stEl.style.color='var(--err)';}}
   };
   // arrastar para reordenar
   row.addEventListener('dragstart',e=>{_dragFrom=i;row.style.opacity='.45';try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(i));}catch(_e){}});
   row.addEventListener('dragend',()=>{row.style.opacity='';});
   row.addEventListener('dragover',e=>{e.preventDefault();row.style.boxShadow='0 -2px 0 var(--brand)';});
   row.addEventListener('dragleave',()=>{row.style.boxShadow='';});
   row.addEventListener('drop',e=>{e.preventDefault();row.style.boxShadow='';const from=_dragFrom!=null?_dragFrom:+((e.dataTransfer&&e.dataTransfer.getData('text/plain'))||-1);const to=i;if(from<0||from===to){return;}const arr=n.opts.messages;const it=arr.splice(from,1)[0];arr.splice(to,0,it);_dragFrom=null;setDirty();render();refreshNodeChat(n);});
  });
 }
 render();drawer.classList.add('show');
}
/* ---------- Abordagens (modelos de mensagem por produto) ---------- */
const ABORD_PARTS=[['send-text-message','Mensagem de texto','field'],['send-image-message','Imagem','insta'],['send-video-message','Vídeo','monitor'],['delay','Atraso de tempo','wait']];
function _wireMsgParts(container,arr,onSave){let _df=null;
 container.querySelectorAll('[data-mpart]').forEach(row=>{const i=+row.dataset.mpart,m=arr[i];if(!m)return;
  const del=row.querySelector('[data-mdel]');if(del)del.onclick=()=>{arr.splice(i,1);onSave(true);};
  const ta=row.querySelector('[data-mtext]');if(ta){_trackCaret(ta);ta.onchange=()=>{m.options=m.options||{};m.options.text=ta.value;onSave(false);};}
  const cmp=row.querySelector('[data-mcampo]');if(cmp&&ta)cmp.onchange=e=>{const tok=e.target.value;if(!tok)return;m.options=m.options||{};m.options.text=insertAtCaret(ta,tok);e.target.value='';onSave(false);};
  const mv=row.querySelector('[data-mv]');if(mv)mv.onchange=()=>{m.options=m.options||{};m.options[m.name==='wait-user-input'?'timeout':'valor']=+mv.value||0;onSave(false);};
  const mu=row.querySelector('[data-mu]');if(mu)mu.onchange=()=>{m.options=m.options||{};m.options.unidade=mu.value;onSave(false);};
  const url=row.querySelector('[data-murl]');if(url)url.onchange=()=>{m.options=m.options||{};m.options.url=url.value;onSave(false);};
  const cap=row.querySelector('[data-mcap]');if(cap)cap.onchange=()=>{m.options=m.options||{};m.options.caption=cap.value;onSave(false);};
  const mf=row.querySelector('[data-mfile]');if(mf)mf.onchange=async()=>{const f=mf.files&&mf.files[0];if(!f)return;const stEl=row.querySelector('[data-mfstatus]');
   if(f.size>MIDIA_MAX){if(stEl){stEl.textContent='Arquivo tem '+(f.size/1048576).toFixed(1)+'MB — limite 16MB.';stEl.style.color='var(--err)';}mf.value='';return;}
   if(stEl){stEl.textContent='Enviando…';stEl.style.color='var(--ink-faint)';}
   try{const u=await uploadMidia(f);m.options=m.options||{};m.options.url=u;m.options.filename=f.name;m.options.mimetype=f.type;onSave(true);}catch(e){if(stEl){stEl.textContent='Erro: '+e.message;stEl.style.color='var(--err)';}}};
  row.addEventListener('dragstart',e=>{_df=i;row.style.opacity='.45';try{e.dataTransfer.effectAllowed='move';}catch(_e){}});
  row.addEventListener('dragend',()=>{row.style.opacity='';});
  row.addEventListener('dragover',e=>{e.preventDefault();row.style.boxShadow='0 -2px 0 var(--brand)';});
  row.addEventListener('dragleave',()=>{row.style.boxShadow='';});
  row.addEventListener('drop',e=>{e.preventDefault();row.style.boxShadow='';const to=i,from=_df;if(from==null||from===to)return;const it=arr.splice(from,1)[0];arr.splice(to,0,it);_df=null;onSave(true);});});
}
function openAbordagensManager(){
 let selProd=ref.produtos[0]?ref.produtos[0].id:0; let editing=null; // editing = abordagem id
 const sc=document.createElement('div');sc.className='cond-scrim';sc.id='abordScrim';sc.style.cssText='position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:rgba(20,16,12,0.34);padding:20px;';sc.addEventListener('click',function(e){if(e.target===sc)sc.remove();});ROOT.appendChild(sc);
 const close=()=>sc.remove();
 const prodsList=()=>[{id:0,nome:'Modelos gerais (sem produto)'}].concat(ref.produtos||[]);
 const abordDo=(pid)=>(ref.abordagens||[]).filter(a=>(a.produto_id||0)===pid).sort((x,y)=>(x.ordem||0)-(y.ordem||0));
 async function persist(a){try{await sbPatch('/abordagens?id=eq.'+a.id,{mensagens:a.mensagens,nome:a.nome});}catch(e){toast('Erro ao salvar: '+e.message,'err');}}
 function render(){
  const prods=prodsList();
  const rightList=()=>{const its=abordDo(selProd);return `<div style="flex:1;overflow:auto;padding:0 16px 12px">${its.length?its.map(a=>`<div style="display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:8px"><span style="flex:1;min-width:0"><b style="font-size:13px">${esc(a.nome)}</b><span style="font-size:11px;color:var(--ink-faint);margin-left:8px">${(a.mensagens||[]).length} parte(s)</span></span><button class="hookbtn" data-abedit="${a.id}">editar mensagens</button><button data-abdup="${a.id}" title="Duplicar abordagem" style="border:0;background:none;cursor:pointer;color:var(--ink-faint)">${ico('copy',14,'var(--ink-faint)')}</button><button data-abren="${a.id}" title="Renomear" style="border:0;background:none;cursor:pointer;color:var(--ink-faint);font-size:14px">✎</button><button data-abdel="${a.id}" title="Excluir" style="border:0;background:none;cursor:pointer;color:var(--err);font-size:14px">🗑</button></div>`).join(''):'<div style="padding:12px;color:var(--ink-faint);font-size:12px">Nenhuma abordagem aqui. Crie a primeira.</div>'}</div><button data-abadd class="sb-add" style="margin:0 16px 14px">${ico('plus',14)} nova abordagem</button>`;};
  let rightPane;
  if(editing){const a=(ref.abordagens||[]).find(x=>x.id===editing);a.mensagens=a.mensagens||[];
   rightPane=`<div style="display:flex;align-items:center;gap:8px;padding:14px 16px 8px"><button data-back style="border:0;background:none;cursor:pointer;color:var(--brand);font-weight:600;font-size:13px">← voltar</button><b style="flex:1;font-size:14px">${esc(a.nome)}</b><button data-x style="border:0;background:none;font-size:20px;cursor:pointer;color:var(--ink-faint)">×</button></div><div style="flex:1;overflow:auto;padding:0 16px 14px"><div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">${ABORD_PARTS.map(p=>`<button class="dw-opt" data-add="${p[0]}" style="width:auto;flex:0 0 auto;padding:8px 11px"><span class="oic">${ico(p[2],16,'var(--brand)')}</span>${p[1]}</button>`).join('')}</div><div id="abmparts" style="display:flex;flex-direction:column;gap:8px">${a.mensagens.map((m,i)=>msgPartEditor(m,i)).join('')||'<div style="font-size:12px;color:var(--ink-faint);padding:6px">Adicione a primeira mensagem acima.</div>'}</div></div>`;
  }else{
   rightPane=`<div style="display:flex;align-items:center;padding:15px 16px 8px"><b style="flex:1;font-size:15px">Abordagens · ${esc((prods.find(p=>p.id===selProd)||{}).nome||'')}</b><button data-x style="border:0;background:none;font-size:20px;cursor:pointer;color:var(--ink-faint)">×</button></div>${rightList()}`;
  }
  sc.innerHTML=`<div style="background:#fff;border-radius:16px;width:860px;max-width:96vw;height:580px;max-height:92vh;display:flex;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.32)">
   <div style="width:250px;border-right:1px solid var(--line);display:flex;flex-direction:column;background:var(--surface)">
    <div style="padding:15px 16px 8px;font-weight:700;font-size:15px">Produtos</div>
    <div style="flex:1;overflow:auto;padding:0 10px">${prods.map(p=>`<div data-prod="${p.id}" style="display:flex;align-items:center;gap:4px;padding:9px 10px;border-radius:9px;cursor:pointer;background:${p.id===selProd?'var(--brand-soft)':'transparent'};color:${p.id===selProd?'var(--brand)':'var(--ink)'};font-weight:600;font-size:12.5px;margin-bottom:2px"><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.nome)}</span>${p.id!==0?`<button data-proddup="${p.id}" title="Duplicar produto e abordagens" style="border:0;background:none;cursor:pointer;color:var(--ink-faint)">${ico('copy',13,'var(--ink-faint)')}</button><button data-prodren="${p.id}" title="Renomear" style="border:0;background:none;cursor:pointer;color:var(--ink-faint);font-size:13px">✎</button><button data-proddel="${p.id}" title="Excluir" style="border:0;background:none;cursor:pointer;color:var(--err);font-size:13px">🗑</button>`:''}</div>`).join('')}</div>
    <button data-prodadd class="sb-add" style="margin:10px">${ico('plus',14)} novo produto</button>
   </div>
   <div style="flex:1;display:flex;flex-direction:column;min-width:0">${rightPane}</div>
  </div>`;
  sc.onclick=e=>{if(e.target===sc)close();};
  const xb=sc.querySelector('[data-x]');if(xb)xb.onclick=close;
  if(editing){
   const a=(ref.abordagens||[]).find(x=>x.id===editing);
   sc.querySelector('[data-back]').onclick=()=>{editing=null;render();};
   sc.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{const nm=b.dataset.add;const opt=nm==='send-text-message'?{text:''}:(nm==='delay'?{valor:5,unidade:'segundos'}:{url:''});a.mensagens.push({name:nm,options:opt});persist(a);render();});
   _wireMsgParts(sc.querySelector('#abmparts'),a.mensagens,(rerender)=>{persist(a);if(rerender)render();});
   return;
  }
  sc.querySelectorAll('[data-prod]').forEach(el=>el.onclick=e=>{if(e.target.closest('[data-prodren],[data-proddel]'))return;selProd=+el.dataset.prod;render();});
  sc.querySelector('[data-prodadd]').onclick=async()=>{const nm=prompt('Nome do produto:');if(!nm||!nm.trim())return;try{const r=await sbPost('/produtos',{nome:nm.trim()});ref.produtos.push(r[0]);selProd=r[0].id;render();}catch(e){toast('Erro: '+e.message,'err');}};
  sc.querySelectorAll('[data-prodren]').forEach(b=>b.onclick=async e=>{e.stopPropagation();const id=+b.dataset.prodren;const p=ref.produtos.find(x=>x.id===id);const nm=prompt('Novo nome do produto:',p.nome);if(nm===null||!nm.trim())return;try{await sbPatch('/produtos?id=eq.'+id,{nome:nm.trim()});p.nome=nm.trim();render();}catch(e){toast('Erro: '+e.message,'err');}});
  sc.querySelectorAll('[data-proddel]').forEach(b=>b.onclick=async e=>{e.stopPropagation();const id=+b.dataset.proddel;if(!confirm('Excluir o produto e suas abordagens?'))return;try{await sbDelete('/produtos?id=eq.'+id);ref.produtos=ref.produtos.filter(x=>x.id!==id);ref.abordagens=ref.abordagens.filter(a=>a.produto_id!==id);if(selProd===id)selProd=0;render();}catch(e){toast('Erro: '+e.message,'err');}});
  const ab=sc.querySelector('[data-abadd]');if(ab)ab.onclick=async()=>{const nm=prompt('Nome da abordagem:');if(!nm||!nm.trim())return;try{const ord=abordDo(selProd).length;const r=await sbPost('/abordagens',{produto_id:selProd||null,nome:nm.trim(),ordem:ord,mensagens:[]});ref.abordagens.push(r[0]);editing=r[0].id;render();}catch(e){toast('Erro: '+e.message,'err');}};
  sc.querySelectorAll('[data-abedit]').forEach(b=>b.onclick=()=>{editing=+b.dataset.abedit;render();});
  sc.querySelectorAll('[data-abdup]').forEach(b=>b.onclick=async()=>{const id=+b.dataset.abdup;const a=ref.abordagens.find(x=>x.id===id);try{const ord=abordDo(a.produto_id||0).length;const r=await sbPost('/abordagens',{produto_id:a.produto_id,nome:a.nome+' (cópia)',ordem:ord,mensagens:JSON.parse(JSON.stringify(a.mensagens||[]))});ref.abordagens.push(r[0]);render();toast('Abordagem duplicada','ok');}catch(e){toast('Erro: '+e.message,'err');}});
  sc.querySelectorAll('[data-proddup]').forEach(b=>b.onclick=async e=>{e.stopPropagation();const id=+b.dataset.proddup;const p=ref.produtos.find(x=>x.id===id);try{const np=(await sbPost('/produtos',{nome:p.nome+' (cópia)'}))[0];ref.produtos.push(np);const abs=abordDo(id);for(const a of abs){const r=await sbPost('/abordagens',{produto_id:np.id,nome:a.nome,ordem:a.ordem,mensagens:JSON.parse(JSON.stringify(a.mensagens||[]))});ref.abordagens.push(r[0]);}selProd=np.id;render();toast('Produto duplicado com '+abs.length+' abordagem(ns)','ok');}catch(e){toast('Erro: '+e.message,'err');}});
  sc.querySelectorAll('[data-abren]').forEach(b=>b.onclick=async()=>{const id=+b.dataset.abren;const a=ref.abordagens.find(x=>x.id===id);const nm=prompt('Novo nome:',a.nome);if(nm===null||!nm.trim())return;try{await sbPatch('/abordagens?id=eq.'+id,{nome:nm.trim()});a.nome=nm.trim();render();}catch(e){toast('Erro: '+e.message,'err');}});
  sc.querySelectorAll('[data-abdel]').forEach(b=>b.onclick=async()=>{const id=+b.dataset.abdel;if(!confirm('Excluir esta abordagem?'))return;try{await sbDelete('/abordagens?id=eq.'+id);ref.abordagens=ref.abordagens.filter(x=>x.id!==id);render();}catch(e){toast('Erro: '+e.message,'err');}});
 }
 render();
}
/* ==================================================================
   CAPTAÇÃO / PRODUTOS — gerenciador ligado ao catálogo real
   (empreendimentos + unidades + midias). Captador obrigatório,
   origem prédio/terceiros, regra de mídia (fotos/vídeo/áreas comuns).
   ================================================================== */
const CAP_MIN_FOTOS=6;
function capMidiaStatus(mids){
 const fotos=mids.filter(m=>m.tipo==='foto').length;
 const video=mids.some(m=>m.tipo==='video');
 const comum=mids.some(m=>m.categoria==='area_comum')||mids.some(m=>m.tipo==='pdf');
 const ok=fotos>=CAP_MIN_FOTOS&&video&&comum;
 return {fotos,video,comum,ok};
}
async function openCaptacaoManager(){
 const sc=document.createElement('div');sc.className='cond-scrim';sc.id='capScrim';sc.style.background='var(--bg,#eef2f6)';ROOT.appendChild(sc);
 const close=()=>sc.remove();
 let emps=[],sel=null,mids=[],unids=[],loading=true,saving=false;
 const corretores=(ref.corretores||[]);
 async function loadList(){try{emps=await sbGet('/empreendimentos?select=id,nome,bairro,origem,status,captador_corretor_id,captado_em&order=captado_em.desc.nullslast,nome');}catch(e){emps=[];toast('Erro ao listar: '+e.message,'err');}loading=false;render();}
 async function loadOne(id){try{const[m,u]=await Promise.all([sbGet('/midias?empreendimento_id=eq.'+id+'&select=id,tipo,categoria,storage_path,nome'),sbGet('/unidades?empreendimento_id=eq.'+id+'&select=id,numero,tipologia,area_m2,vagas,valor_tabela,disponivel,de_terceiros&order=numero')]);mids=m||[];unids=u||[];}catch(e){mids=[];unids=[];}render();}
 function corretorNome(id){const c=corretores.find(x=>x.id===id);return c?c.nome:'—';}
 function novo(){sel={id:null,nome:'',bairro:'',endereco:'',incorporadora:'',origem:'predio',status:'pronto',captador_corretor_id:corretores[0]?corretores[0].id:null,proprietario_nome:'',proprietario_contato:''};mids=[];unids=[];render();}
 function parseTabela(txt){const out=[];(txt||'').split(/\r?\n/).forEach(function(ln){ln=ln.trim();if(!ln)return;const c=ln.split(/\t|;|,|\s{2,}/).map(s=>s.trim()).filter(Boolean);if(!c.length)return;out.push({numero:c[0]||'',tipologia:c[1]||'',area_m2:parseFloat((c[2]||'').replace(',','.'))||null,vagas:parseInt(c[3])||null,valor_tabela:parseFloat((c[4]||'').replace(/[^0-9.,]/g,'').replace(',','.'))||null,disponivel:true});});return out;}
 async function uploadFiles(fileList,tipo,categoria){if(!sel||!sel.id){toast('Salve o produto primeiro para anexar mídia.','err');return;}const files=[...fileList];for(const f of files){try{const url=await uploadMidia(f);const row=(await sbPost('/midias',{empreendimento_id:sel.id,tipo:tipo,categoria:categoria||null,storage_path:url,nome:f.name}))[0];mids.push(row);render();}catch(e){toast('Falha no upload: '+e.message,'err');}}}
 async function delMidia(id){if(!confirm('Remover esta mídia?'))return;try{await sbDelete('/midias?id=eq.'+id);mids=mids.filter(m=>m.id!==id);render();}catch(e){toast('Erro: '+e.message,'err');}}
 async function salvar(){
  if(saving)return;
  const f=sel;if(!f.nome.trim()){toast('Dê um nome ao produto/condomínio.','err');return;}
  if(!f.captador_corretor_id){toast('Selecione o captador indicado (obrigatório).','err');return;}
  saving=true;render();
  const body={nome:f.nome.trim(),bairro:f.bairro||null,endereco:f.endereco||null,incorporadora:f.incorporadora||null,origem:f.origem,status:f.status,captador_corretor_id:f.captador_corretor_id};
  try{
   if(!f.id){const r=(await sbPost('/empreendimentos',body))[0];f.id=r.id;emps.unshift(Object.assign({},r,{captador_corretor_id:f.captador_corretor_id}));
    if(f.origem==='terceiros'){const u=(await sbPost('/unidades',{empreendimento_id:f.id,numero:f._un_numero||'única',tipologia:f._un_tip||null,area_m2:parseFloat((f._un_area||'').toString().replace(',','.'))||null,vagas:parseInt(f._un_vagas)||null,valor_tabela:parseFloat((f._un_valor||'').toString().replace(/[^0-9.,]/g,'').replace(',','.'))||null,disponivel:true,de_terceiros:true,captador_corretor_id:f.captador_corretor_id,proprietario_nome:f.proprietario_nome||null,proprietario_contato:f.proprietario_contato||null}))[0];unids.push(u);}
    else if(f._tabela&&f._tabela.trim()){const rows=parseTabela(f._tabela).map(r=>Object.assign(r,{empreendimento_id:f.id,captador_corretor_id:f.captador_corretor_id}));if(rows.length){const ins=await sbPost('/unidades',rows);unids=unids.concat(ins);}}
    toast('Produto captado ✓ — agora anexe as mídias.','ok');
   }else{await sbPatch('/empreendimentos?id=eq.'+f.id,body);const idx=emps.findIndex(e=>e.id===f.id);if(idx>=0)Object.assign(emps[idx],body);toast('Produto atualizado ✓','ok');}
  }catch(e){toast('Erro ao salvar: '+e.message,'err');}
  saving=false;render();
 }
 function render(){
  const listHtml=loading?'<div style="padding:14px;color:var(--ink-faint);font-size:12px">Carregando…</div>':(emps.length?emps.map(function(e){const st=(sel&&sel.id===e.id);return `<div data-emp="${e.id}" style="display:flex;align-items:center;gap:6px;padding:9px 10px;border-radius:9px;cursor:pointer;background:${st?'var(--brand-soft)':'transparent'};margin-bottom:2px"><span style="flex:1;min-width:0"><b style="font-size:12.5px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${st?'var(--brand)':'var(--ink)'}">${esc(e.nome)}</b><span style="font-size:10.5px;color:var(--ink-faint)">${esc(e.bairro||'')} · ${e.origem==='terceiros'?'Terceiros':'Prédio'} · capt: ${esc(corretorNome(e.captador_corretor_id))}</span></span></div>`;}).join(''):'<div style="padding:14px;color:var(--ink-faint);font-size:12px">Nenhuma captação ainda.</div>');
  let form='<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--ink-faint);font-size:13px;padding:20px;text-align:center">Selecione uma captação à esquerda<br>ou clique em “+ nova captação”.</div>';
  if(sel){
   const st=capMidiaStatus(mids);
   const opt=(v,cur,l)=>`<option value="${v}"${v===cur?' selected':''}>${l}</option>`;
   const corrOpts=corretores.map(c=>opt(c.id,sel.captador_corretor_id,esc(c.nome))).join('');
   form=`<div style="flex:1;overflow:auto;padding:14px 16px 18px">
    <div style="display:flex;gap:8px;margin-bottom:12px"><button data-tipo="predio" class="dw-opt" style="flex:1;justify-content:center;${sel.origem==='predio'?'border-color:var(--brand);background:var(--brand-soft);color:var(--brand)':''}">🏢 Prédio (tabela de unidades)</button><button data-tipo="terceiros" class="dw-opt" style="flex:1;justify-content:center;${sel.origem==='terceiros'?'border-color:var(--brand);background:var(--brand-soft);color:var(--brand)':''}">🔑 Terceiros (unidade avulsa)</button></div>
    <div class="ne-lb">Nome do ${sel.origem==='terceiros'?'imóvel/condomínio':'empreendimento'}</div><input class="ne-inp" data-k="nome" value="${esc(sel.nome)}" placeholder="ex.: Edifício Aurora">
    <div style="display:flex;gap:8px"><div style="flex:1"><div class="ne-lb">Bairro</div><input class="ne-inp" data-k="bairro" value="${esc(sel.bairro||'')}"></div><div style="flex:1"><div class="ne-lb">Status</div><select class="ne-sel" data-k="status">${opt('pronto',sel.status,'Pronto')}${opt('em_obras',sel.status,'Em obras')}${opt('lancamento',sel.status,'Lançamento')}</select></div></div>
    <div class="ne-lb">Endereço</div><input class="ne-inp" data-k="endereco" value="${esc(sel.endereco||'')}">
    <div class="ne-lb" style="color:var(--brand)">Captador indicado * (recompensado na venda)</div><select class="ne-sel" data-k="captador_corretor_id">${corrOpts||'<option value="">— sem corretores —</option>'}</select>
    ${sel.origem==='terceiros'?`<div style="border:1px solid var(--line);border-radius:10px;padding:10px;margin-top:10px;background:#fbfcfe"><div class="ne-lb" style="margin-top:0">Dados da unidade / proprietário</div><div style="display:flex;gap:8px"><input class="ne-inp" data-k="_un_numero" placeholder="nº/unidade" value="${esc(sel._un_numero||'')}"><input class="ne-inp" data-k="_un_tip" placeholder="tipologia" value="${esc(sel._un_tip||'')}"></div><div style="display:flex;gap:8px"><input class="ne-inp" data-k="_un_area" placeholder="área m²" value="${esc(sel._un_area||'')}"><input class="ne-inp" data-k="_un_vagas" placeholder="vagas" value="${esc(sel._un_vagas||'')}"><input class="ne-inp" data-k="_un_valor" placeholder="valor" value="${esc(sel._un_valor||'')}"></div><div style="display:flex;gap:8px"><input class="ne-inp" data-k="proprietario_nome" placeholder="proprietário" value="${esc(sel.proprietario_nome||'')}"><input class="ne-inp" data-k="proprietario_contato" placeholder="contato" value="${esc(sel.proprietario_contato||'')}"></div></div>`:(!sel.id?`<div class="ne-lb">Tabela do prédio (cole: número, tipologia, área, vagas, valor — uma unidade por linha)</div><textarea class="ne-ta" data-k="_tabela" placeholder="101\tApto 2 dorm\t58\t1\t450000\n102\tApto 3 dorm\t72\t2\t620000">${esc(sel._tabela||'')}</textarea>`:`<div class="ne-lb">Unidades (${unids.length})</div><div style="max-height:120px;overflow:auto;border:1px solid var(--line);border-radius:9px">${unids.length?unids.map(u=>`<div style="display:flex;gap:8px;padding:6px 9px;font-size:12px;border-bottom:1px solid var(--line-soft)"><b>${esc(u.numero||'')}</b><span style="flex:1;color:var(--ink-faint)">${esc(u.tipologia||'')} · ${u.area_m2||'?'}m²</span><span>${u.valor_tabela?('R$ '+Number(u.valor_tabela).toLocaleString('pt-BR')):''}</span></div>`).join(''):'<div style="padding:8px;color:var(--ink-faint);font-size:12px">Sem unidades.</div>'}</div>`)}
    <div style="margin-top:16px;border-top:1px solid var(--line);padding-top:12px">
     <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><b style="font-size:13px;flex:1">Mídia obrigatória</b>${sel.id?`<span style="font-size:11px;font-weight:700;color:${st.ok?'var(--ok)':'var(--err)'}">${st.ok?'completo ✓':'incompleto'}</span>`:'<span style="font-size:11px;color:var(--ink-faint)">salve para anexar</span>'}</div>
     <div style="display:flex;gap:8px;font-size:11.5px;margin-bottom:10px"><span style="color:${st.fotos>=CAP_MIN_FOTOS?'var(--ok)':'var(--ink-faint)'}">📷 ${st.fotos}/${CAP_MIN_FOTOS} fotos</span><span style="color:${st.video?'var(--ok)':'var(--ink-faint)'}">🎬 vídeo ${st.video?'✓':'—'}</span><span style="color:${st.comum?'var(--ok)':'var(--ink-faint)'}">🏊 áreas comuns/PDF ${st.comum?'✓':'—'}</span></div>
     ${sel.id?`<div style="display:flex;flex-wrap:wrap;gap:6px"><label class="dw-opt" style="width:auto;cursor:pointer">📷 Fotos<input type="file" accept="image/*" multiple data-up="foto" style="display:none"></label><label class="dw-opt" style="width:auto;cursor:pointer">🎬 Vídeo<input type="file" accept="video/*" data-up="video" style="display:none"></label><label class="dw-opt" style="width:auto;cursor:pointer">🏊 Áreas comuns<input type="file" accept="image/*" multiple data-up="area_comum" style="display:none"></label><label class="dw-opt" style="width:auto;cursor:pointer">📄 PDF<input type="file" accept="application/pdf" data-up="pdf" style="display:none"></label></div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">${mids.map(function(m){var sp=(m.storage_path||'');var url=(/^https?:/.test(sp))?sp:('https://diaegvfveqezispcthwk.supabase.co/storage/v1/object/public/empreendimentos/'+sp);var thumb=(m.tipo==='foto')?('<img src="'+url+'" loading="lazy" style="width:28px;height:28px;object-fit:cover;border-radius:5px;flex-shrink:0">'):(m.tipo==='video'?'🎬':'📄');return '<div style="position:relative;border:1px solid var(--line);border-radius:8px;padding:4px 8px;font-size:11px;display:flex;align-items:center;gap:6px">'+thumb+' '+esc((m.nome||'').slice(0,18))+'<button data-delm="'+m.id+'" style="border:0;background:none;cursor:pointer;color:var(--err)">×</button></div>';}).join('')}</div>`:''}
    </div>
   </div>
   <div style="border-top:1px solid var(--line);padding:12px 16px;display:flex;gap:8px;justify-content:flex-end"><button data-cancel style="border:1px solid var(--line);background:#fff;border-radius:9px;padding:9px 14px;font-size:13px;cursor:pointer">Fechar</button><button data-save class="sb-add" style="width:auto;margin:0;padding:9px 18px">${saving?'Salvando…':(sel.id?'Salvar alterações':'Captar produto')}</button></div>`;
  }
  sc.innerHTML=`<div style="background:#fff;border-radius:16px;width:900px;max-width:96vw;height:600px;max-height:92vh;display:flex;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.32)">
   <div style="width:260px;border-right:1px solid var(--line);display:flex;flex-direction:column;background:var(--surface)">
    <div style="padding:15px 16px 8px;font-weight:700;font-size:15px">Captações / Produtos</div>
    <div style="flex:1;overflow:auto;padding:0 10px">${listHtml}</div>
    <button data-novo class="sb-add" style="margin:10px">${ico('plus',14)} nova captação</button>
   </div>
   <div style="flex:1;display:flex;flex-direction:column;min-width:0">${sel?'':'<div style="display:flex;align-items:center;padding:15px 16px 8px"><b style="flex:1;font-size:15px">Captação</b><button data-x style="border:0;background:none;font-size:20px;cursor:pointer;color:var(--ink-faint)">×</button></div>'}${form}</div>
  </div>`;
  sc.onclick=e=>{if(e.target===sc)close();};
  const xb=sc.querySelector('[data-x]');if(xb)xb.onclick=close;
  sc.querySelectorAll('[data-emp]').forEach(el=>el.onclick=()=>{const id=el.dataset.emp;const e=emps.find(x=>String(x.id)===String(id));sel=Object.assign({},e);loadOne(id);});
  const nb=sc.querySelector('[data-novo]');if(nb)nb.onclick=novo;
  const cb=sc.querySelector('[data-cancel]');if(cb)cb.onclick=()=>{sel=null;render();};
  const sb=sc.querySelector('[data-save]');if(sb)sb.onclick=salvar;
  sc.querySelectorAll('[data-tipo]').forEach(b=>b.onclick=()=>{sel.origem=b.dataset.tipo;render();});
  sc.querySelectorAll('[data-k]').forEach(el=>{el.oninput=el.onchange=e=>{let v=e.target.value;if(el.dataset.k==='captador_corretor_id')v=v?+v:null;sel[el.dataset.k]=v;};});
  sc.querySelectorAll('[data-up]').forEach(inp=>inp.onchange=e=>{const cat=inp.dataset.up;const tipo=cat==='area_comum'?'foto':cat;uploadFiles(e.target.files,tipo,cat==='area_comum'?'area_comum':null);});
  sc.querySelectorAll('[data-delm]').forEach(b=>b.onclick=()=>delMidia(+b.dataset.delm));
 }
 render();loadList();
}
try{ window.__apeCaptacao = function(){ try{ openCaptacaoManager(); }catch(e){ if(window.console)console.warn(e); } }; }catch(_e){}

/* ==================================================================
   PIPELINE — gestão real (grupos, reordenar arrastando, migrar etapa)
   Ligado a pipelines / pipeline_stages / negocios de verdade.
   ================================================================== */
async function openPipelinesManager(){
 const sc=document.createElement('div');sc.className='cond-scrim';sc.id='pipeScrim';sc.style.background='var(--bg,#eef2f6)';ROOT.appendChild(sc);
 const close=()=>sc.remove();
 let pipes=[],stages=[],counts={},sel=null,loading=true,dragId=null;
 async function load(){
  try{
   const[p,s,neg]=await Promise.all([
     sbGet('/pipelines?select=id,nome,grupo,ordem&order=grupo.nullsfirst,ordem'),
     sbGet('/pipeline_stages?select=id,pipeline_id,nome,ordem,cor&order=pipeline_id,ordem'),
     sbGet('/negocios?select=stage_id&status=not.eq.perdido')
   ]);
   pipes=p||[];stages=s||[];counts={};(neg||[]).forEach(function(n){counts[n.stage_id]=(counts[n.stage_id]||0)+1;});
   if(!sel&&pipes[0])sel=pipes[0].id;
  }catch(e){toast('Erro ao carregar funis: '+e.message,'err');}
  loading=false;render();
 }
 const grupos=()=>{const g={};pipes.forEach(function(p){const k=p.grupo||'(sem grupo)';(g[k]=g[k]||[]).push(p);});return g;};
 const stagesDe=(pid)=>stages.filter(s=>s.pipeline_id===pid).sort((a,b)=>(a.ordem||0)-(b.ordem||0));async function apeStageMenu(pid){if(!pid){toast('Selecione um funil primeiro','err');return;}var p=pipes.find(function(x){return x.id===pid;});var list=stagesDe(pid);var menu=list.map(function(s,i){return (i+1)+') '+s.nome+' ['+(s.tipo||'aberto')+']';}).join('\n');var op=prompt('ETAPAS de "'+(p?p.nome:'')+'":\n'+(menu||'(nenhuma)')+'\n\nN=nova  R#=renomear  T#=tipo  C#=cor  X#=excluir\n(ex: N, R2, T3, C1, X4)');if(!op)return;op=op.trim();var up=op.toUpperCase();try{if(up==='N'){var nm=prompt('Nome da nova etapa:');if(!nm||!nm.trim())return;var tp=(prompt('Tipo: aberto, ganho ou perdido','aberto')||'aberto').trim().toLowerCase();if(['aberto','ganho','perdido'].indexOf(tp)<0)tp='aberto';await sbPost('/pipeline_stages',{pipeline_id:pid,nome:nm.trim(),ordem:list.length,tipo:tp,cor:'#8B5CF6',criado_em:new Date().toISOString()});toast('Etapa criada','ok');}else{var idx=parseInt(op.slice(1),10)-1;var st=list[idx];if(!st){toast('Etapa invalida','err');return;}var c0=up.charAt(0);if(c0==='R'){var nn=prompt('Novo nome:',st.nome);if(nn===null||!nn.trim())return;await sbPatch('/pipeline_stages?id=eq.'+st.id,{nome:nn.trim()});}else if(c0==='T'){var t2=(prompt('Tipo: aberto, ganho ou perdido',st.tipo||'aberto')||'').trim().toLowerCase();if(['aberto','ganho','perdido'].indexOf(t2)<0){toast('Tipo invalido','err');return;}await sbPatch('/pipeline_stages?id=eq.'+st.id,{tipo:t2});}else if(c0==='C'){var cc=prompt('Cor hex (ex #10B981):',st.cor||'#8B5CF6');if(!cc||!cc.trim())return;await sbPatch('/pipeline_stages?id=eq.'+st.id,{cor:cc.trim()});}else if(c0==='X'){if(!confirm('Excluir a etapa "'+st.nome+'"?'))return;await sbDelete('/pipeline_stages?id=eq.'+st.id);}else{toast('Comando nao reconhecido','err');return;}}await load();apeStageMenu(pid);}catch(e){toast('Erro: '+e.message,'err');}}
 async function persistOrdem(){for(const p of pipes){try{await sbPatch('/pipelines?id=eq.'+p.id,{ordem:p.ordem,grupo:p.grupo||null});}catch(e){}}}
 async function migrar(fromStage){
  const alvo=stages.filter(s=>s.id!==fromStage);
  const nomes=alvo.map(s=>{const pp=pipes.find(x=>x.id===s.pipeline_id);return (pp?pp.nome+' › ':'')+s.nome;});
  const escolha=prompt('Migrar os '+(counts[fromStage]||0)+' negócios desta etapa para:\n\n'+alvo.map((s,i)=>(i+1)+') '+nomes[i]).join('\n')+'\n\nDigite o número:');
  if(!escolha)return;const idx=parseInt(escolha)-1;if(isNaN(idx)||!alvo[idx]){toast('Opção inválida','err');return;}
  const to=alvo[idx];
  if(!confirm('Confirma migrar '+(counts[fromStage]||0)+' negócios para "'+nomes[idx]+'"?'))return;
  try{await sbPatch('/negocios?stage_id=eq.'+fromStage,{stage_id:to.id,pipeline_id:to.pipeline_id,ultima_movimentacao:new Date().toISOString()});
   counts[to.id]=(counts[to.id]||0)+(counts[fromStage]||0);counts[fromStage]=0;toast('Negócios migrados ✓','ok');render();
  }catch(e){toast('Erro ao migrar (permissão de admin?): '+e.message,'err');}
 }
 function render(){
  const gs=grupos();
  const leftInner=loading?'<div style="padding:14px;color:var(--ink-faint);font-size:12px">Carregando…</div>':Object.keys(gs).map(function(gname){
   return `<div style="margin-bottom:10px" data-grp="${esc(gname)}"><div style="display:flex;align-items:center;gap:4px;padding:4px 8px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--ink-faint)"><span style="flex:1">${esc(gname)}</span></div>${gs[gname].map(function(p){const st=sel===p.id;return `<div draggable="true" data-pipe="${p.id}" style="display:flex;align-items:center;gap:6px;padding:9px 10px;border-radius:9px;cursor:grab;background:${st?'var(--brand-soft)':'#fff'};border:1px solid ${st?'var(--brand)':'var(--line)'};margin-bottom:5px"><span style="color:var(--ink-faint);font-size:13px">⠿</span><span style="flex:1;font-weight:600;font-size:12.5px;color:${st?'var(--brand)':'var(--ink)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.nome)}</span><button data-pgrp="${p.id}" title="Grupo" style="border:0;background:none;cursor:pointer;color:var(--ink-faint);font-size:12px">📁</button><button data-pren="${p.id}" title="Renomear" style="border:0;background:none;cursor:pointer;color:var(--ink-faint);font-size:12px">✎</button></div>`;}).join('')}</div>`;
  }).join('');
  let right='<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--ink-faint);font-size:13px">Selecione um funil.</div>';
  if(sel){const p=pipes.find(x=>x.id===sel);const sts=stagesDe(sel);
   right=`<div style="display:flex;align-items:center;padding:15px 16px 10px"><b style="flex:1;font-size:15px">${esc(p?p.nome:'')} · etapas</b><button data-x style="border:0;background:none;font-size:20px;cursor:pointer;color:var(--ink-faint)">×</button></div>
   <div style="flex:1;overflow:auto;padding:0 16px 16px">${sts.length?sts.map(function(s){return `<div style="display:flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:10px;padding:11px 13px;margin-bottom:8px"><span style="width:10px;height:10px;border-radius:50%;background:${esc(s.cor||'#94a3b8')}"></span><span style="flex:1;font-weight:600;font-size:13px">${esc(s.nome)}</span><span style="font-size:12px;color:var(--ink-faint)">${counts[s.id]||0} negócios</span><button data-migr="${s.id}" class="hookbtn" style="font-size:11.5px">migrar todos →</button></div>`;}).join(''):'<div style="color:var(--ink-faint);font-size:12px;padding:10px">Sem etapas.</div>'}</div>`;
  }
  sc.innerHTML=`<div style="background:#fff;border-radius:16px;width:820px;max-width:96vw;height:560px;max-height:92vh;display:flex;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.32)">
   <div style="width:290px;border-right:1px solid var(--line);display:flex;flex-direction:column;background:var(--surface)">
    <div style="padding:14px 16px 6px;font-weight:700;font-size:15px">Funis (pipelines)</div>
    <div style="font-size:11px;color:var(--ink-faint);padding:0 16px 8px">Arraste para reordenar · 📁 muda de grupo</div>
    <div id="pipeList" style="flex:1;overflow:auto;padding:0 10px">${leftInner}</div>
    <div style="display:flex;gap:6px;padding:10px"><button data-newpipe class="sb-add" style="flex:1;margin:0">${ico('plus',13)} funil</button><button data-newstage class="sb-add" style="flex:1;margin:0;background:var(--surface);color:var(--ink)">${ico('plus',13)} etapa</button><button data-newgrp class="sb-add" style="flex:1;margin:0;background:var(--surface);color:var(--brand);border:1px solid var(--brand)">${ico('plus',13)} grupo</button></div>
   </div>
   <div style="flex:1;display:flex;flex-direction:column;min-width:0">${right}</div>
  </div>`;
  sc.onclick=e=>{if(e.target===sc)close();};
  const xb=sc.querySelector('[data-x]');if(xb)xb.onclick=close;
  sc.querySelectorAll('[data-pipe]').forEach(function(el){
   el.onclick=e=>{if(e.target.closest('[data-pren],[data-pgrp]'))return;sel=+el.dataset.pipe;render();};
   el.ondragstart=e=>{dragId=+el.dataset.pipe;e.dataTransfer.effectAllowed='move';};
   el.ondragover=e=>{e.preventDefault();};
   el.ondrop=e=>{e.preventDefault();const overId=+el.dataset.pipe;if(!dragId||dragId===overId)return;const from=pipes.findIndex(x=>x.id===dragId),to=pipes.findIndex(x=>x.id===overId);if(from<0||to<0)return;const moved=pipes[from];moved.grupo=pipes[to].grupo;pipes.splice(from,1);pipes.splice(to,0,moved);pipes.forEach((p,i)=>p.ordem=i+1);dragId=null;persistOrdem();render();};
  });
  const nsg=sc.querySelector('[data-newstage]');if(nsg)nsg.onclick=()=>apeStageMenu(sel);const np=sc.querySelector('[data-newpipe]');if(np)np.onclick=async()=>{const nm=prompt('Nome do novo funil:');if(!nm||!nm.trim())return;try{const ord=pipes.length+1;const r=(await sbPost('/pipelines',{nome:nm.trim(),ordem:ord}))[0];pipes.push(r);sel=r.id;render();}catch(e){toast('Erro: '+e.message,'err');}};
  const ng=sc.querySelector('[data-newgrp]');if(ng)ng.onclick=async()=>{const nm=prompt('Nome do novo grupo de funis:');if(!nm||!nm.trim())return;const p=pipes.find(x=>x.id===sel);if(p){p.grupo=nm.trim();try{await sbPatch('/pipelines?id=eq.'+p.id,{grupo:p.grupo});}catch(e){}render();}else{toast('Selecione um funil para colocar no grupo.','err');}};
  sc.querySelectorAll('[data-pren]').forEach(b=>b.onclick=async e=>{e.stopPropagation();const id=+b.dataset.pren;const p=pipes.find(x=>x.id===id);const nm=prompt('Renomear funil:',p.nome);if(nm===null||!nm.trim())return;try{await sbPatch('/pipelines?id=eq.'+id,{nome:nm.trim()});p.nome=nm.trim();render();}catch(e){toast('Erro: '+e.message,'err');}});
  sc.querySelectorAll('[data-pgrp]').forEach(b=>b.onclick=async e=>{e.stopPropagation();const id=+b.dataset.pgrp;const p=pipes.find(x=>x.id===id);const nomes=[...new Set(pipes.map(x=>x.grupo).filter(Boolean))];const nm=prompt('Grupo do funil (deixe vazio p/ nenhum):\nExistentes: '+(nomes.join(', ')||'—'),p.grupo||'');if(nm===null)return;p.grupo=nm.trim()||null;try{await sbPatch('/pipelines?id=eq.'+id,{grupo:p.grupo});}catch(e){}render();});
  sc.querySelectorAll('[data-migr]').forEach(b=>b.onclick=()=>migrar(+b.dataset.migr));
 }
 render();load();
}
try{ window.__apePipelines = function(){ try{ openPipelinesManager(); }catch(e){ if(window.console)console.warn(e); } }; }catch(_e){}

/* ==================================================================
   CRM real — quadro Kanban ligado a leads / negocios / crm_atividades.
   Mover etapa (arrastar), criar tarefa, transferir, observação: tudo grava.
   ================================================================== */
async function openCrmManager(){
 const sc=document.createElement('div');sc.className='cond-scrim';sc.id='crmScrim';sc.style.background='var(--bg,#eef2f6)';ROOT.appendChild(sc);
 const close=()=>sc.remove();
 let pipes=[],pid=null,stages=[],negs=[],leadMap={},loading=true,dragNeg=null,detail=null,timeline={at:[],tf:[]};
 const corretores=(ref.corretores||[]);
 const cNome=id=>{const c=corretores.find(x=>x.id===id);return c?c.nome:'—';};
 const fmt=v=>v?('R$ '+Number(v).toLocaleString('pt-BR')):'';
 async function chunkLeads(ids){leadMap={};const uniq=[...new Set(ids.filter(Boolean))];for(let i=0;i<uniq.length;i+=150){const part=uniq.slice(i,i+150);try{const rows=await sbGet('/leads?select=id,nome,telefone&id=in.('+part.join(',')+')');rows.forEach(l=>leadMap[l.id]=l);}catch(e){}}}
 async function loadPipes(){try{pipes=await sbGet('/pipelines?select=id,nome,ordem&order=ordem');if(!pid&&pipes[0])pid=pipes[0].id;}catch(e){pipes=[];}}
 async function loadBoard(){loading=true;render();
  try{
   const[s,n]=await Promise.all([
    sbGet('/pipeline_stages?select=id,pipeline_id,nome,ordem,cor&pipeline_id=eq.'+pid+'&order=ordem'),
    sbGet('/negocios?select=id,lead_id,corretor_id,stage_id,valor,status&pipeline_id=eq.'+pid+'&status=not.eq.perdido&order=ultima_movimentacao.desc&limit=800')
   ]);
   stages=s||[];negs=n||[];await chunkLeads(negs.map(x=>x.lead_id));
  }catch(e){toast('Erro ao carregar CRM: '+e.message,'err');}
  loading=false;render();
 }
 async function moverStage(negId,toStage){const ng=negs.find(x=>x.id===negId);if(!ng||ng.stage_id===toStage)return;const old=ng.stage_id;ng.stage_id=toStage;render();
  try{const res=await sbRpc('mover_negocio',{p_negocio_id:negId,p_stage_id:toStage});if(!res||res.ok===false)throw new Error((res&&res.error)||'falha ao mover');if(res.status!==undefined)ng.status=res.status;if(res.pipeline_id!==undefined)ng.pipeline_id=res.pipeline_id;render();}catch(e){ng.stage_id=old;toast('Erro ao mover: '+e.message,'err');render();}}
 async function novoLead(){const nome=prompt('Nome do lead:');if(!nome||!nome.trim())return;const tel=prompt('Telefone (só números):','')||'';
  try{const lead=(await sbPost('/leads',{nome:nome.trim(),telefone:tel.trim()||null,pipeline_id:pid}))[0];const st=stages[0];const ng=(await sbPost('/negocios',{lead_id:lead.id,pipeline_id:pid,stage_id:st?st.id:null,status:'aberto'}))[0];leadMap[lead.id]=lead;negs.unshift(ng);toast('Lead criado ✓','ok');render();}catch(e){toast('Erro: '+e.message,'err');}}
 async function openDetail(negId){detail=negs.find(x=>x.id===negId);timeline={at:[],tf:[]};render();
  try{const[at,tf]=await Promise.all([sbGet('/crm_atividades?select=id,tipo,texto,criado_em&lead_id=eq.'+detail.lead_id+'&order=criado_em.desc&limit=40'),sbGet('/crm_tarefas?select=id,titulo,vencimento,concluida&lead_id=eq.'+detail.lead_id+'&order=criado_em.desc&limit=20')]);timeline={at:at||[],tf:tf||[]};render();}catch(e){timeline={at:[],tf:[]};render();}}
 async function logAtiv(tipo,texto){if(!detail)return;try{await sbPost('/crm_atividades',{lead_id:detail.lead_id,negocio_id:detail.id,corretor_id:detail.corretor_id||null,tipo:tipo,texto:texto});}catch(e){}}
 async function acaoObs(){const t=prompt('Observação:');if(!t||!t.trim())return;await logAtiv('observacao',t.trim());toast('Observação registrada ✓','ok');openDetail(detail.id);}
 async function acaoTarefa(){const t=prompt('Título da tarefa:');if(!t||!t.trim())return;const venc=prompt('Vencimento (AAAA-MM-DD, opcional):','');let v=null;if(venc&&/^\d{4}-\d{2}-\d{2}/.test(venc))v=venc;
  try{await sbPost('/crm_tarefas',{lead_id:detail.lead_id,negocio_id:detail.id,corretor_id:detail.corretor_id||null,titulo:t.trim(),vencimento:v});await logAtiv('tarefa','Tarefa: '+t.trim());toast('Tarefa criada ✓','ok');openDetail(detail.id);}catch(e){toast('Erro: '+e.message,'err');}}
 async function acaoTransferir(){if(!corretores.length){toast('Sem corretores.','err');return;}const lst=corretores.map((c,i)=>(i+1)+') '+c.nome).join('\n');const e=prompt('Transferir para qual corretor?\n\n'+lst+'\n\nNúmero:');if(!e)return;const idx=parseInt(e)-1;if(isNaN(idx)||!corretores[idx]){toast('Inválido','err');return;}const c=corretores[idx];
  try{await sbPatch('/negocios?id=eq.'+detail.id,{corretor_id:c.id});detail.corretor_id=c.id;await logAtiv('transferencia','Transferido para '+c.nome);toast('Transferido para '+c.nome+' ✓','ok');openDetail(detail.id);}catch(e2){toast('Erro: '+e2.message,'err');}}
 function render(){
  const pipeOpts=pipes.map(p=>`<option value="${p.id}"${p.id===pid?' selected':''}>${esc(p.nome)}</option>`).join('');
  let board='<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--ink-faint)">Carregando…</div>';
  if(!loading){
   board=`<div style="flex:1;display:flex;gap:10px;overflow-x:auto;padding:12px 14px;align-items:flex-start">${stages.map(function(s){const items=negs.filter(n=>n.stage_id===s.id);return `<div data-stage="${s.id}" style="flex:0 0 236px;background:var(--surface);border-radius:12px;padding:8px;max-height:100%;display:flex;flex-direction:column"><div style="display:flex;align-items:center;gap:6px;padding:4px 6px 8px"><span style="width:9px;height:9px;border-radius:50%;background:${esc(s.cor||'#94a3b8')}"></span><b style="flex:1;font-size:12.5px">${esc(s.nome)}</b><span style="font-size:11px;color:var(--ink-faint)">${items.length}</span></div><div data-drop="${s.id}" style="flex:1;overflow:auto;min-height:40px;display:flex;flex-direction:column;gap:6px">${items.map(function(n){const l=leadMap[n.lead_id]||{};return `<div draggable="true" data-neg="${n.id}" style="background:#fff;border:1px solid var(--line);border-radius:9px;padding:9px 10px;cursor:pointer"><div style="font-weight:600;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.nome||('Lead #'+n.lead_id))}</div><div style="font-size:11px;color:var(--ink-faint);margin-top:2px">${esc(cNome(n.corretor_id))}${n.valor?' · '+fmt(n.valor):''}</div></div>`;}).join('')||'<div style="font-size:11px;color:var(--ink-faint);padding:8px;text-align:center">—</div>'}</div></div>`;}).join('')}</div>`;
  }
  let side='';
  if(detail){const l=leadMap[detail.lead_id]||{};const tl={at:(timeline&&timeline.at)||[],tf:(timeline&&timeline.tf)||[]};
   side=`<div style="width:320px;border-left:1px solid var(--line);display:flex;flex-direction:column;background:#fff">
    <div style="padding:14px 16px 8px;display:flex;align-items:flex-start"><div style="flex:1"><b style="font-size:15px">${esc(l.nome||('Lead #'+detail.lead_id))}</b><div style="font-size:12px;color:var(--ink-faint)">${esc(l.telefone||'')}</div><div style="font-size:11.5px;color:var(--ink-faint);margin-top:3px">Corretor: ${esc(cNome(detail.corretor_id))}${detail.valor?' · '+fmt(detail.valor):''}</div></div><button data-dclose style="border:0;background:none;font-size:18px;cursor:pointer;color:var(--ink-faint)">×</button></div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;padding:6px 16px 10px;border-bottom:1px solid var(--line)"><button data-a="tarefa" class="dw-opt" style="width:auto;padding:7px 10px">✓ Tarefa</button><button data-a="obs" class="dw-opt" style="width:auto;padding:7px 10px">📝 Observação</button><button data-a="transf" class="dw-opt" style="width:auto;padding:7px 10px">↪ Transferir</button></div>
    <div style="flex:1;overflow:auto;padding:10px 16px">
     ${tl.tf.length?'<div class="ne-lb" style="margin-top:0">Tarefas</div>'+tl.tf.map(t=>`<div style="font-size:12px;border:1px solid var(--line);border-radius:8px;padding:7px 9px;margin-bottom:5px"><b>${esc(t.titulo)}</b>${t.vencimento?`<span style="color:var(--ink-faint);font-size:11px"> · vence ${esc(String(t.vencimento).slice(0,10))}</span>`:''}</div>`).join(''):''}
     <div class="ne-lb">Histórico</div>${tl.at.length?tl.at.map(a=>`<div style="font-size:12px;padding:6px 0;border-bottom:1px solid var(--line-soft)"><span style="font-weight:600;color:var(--brand)">${esc(a.tipo)}</span> ${esc(a.texto||'')}<div style="font-size:10.5px;color:var(--ink-faint)">${esc(String(a.criado_em).slice(0,16).replace('T',' '))}</div></div>`).join(''):'<div style="font-size:12px;color:var(--ink-faint)">Sem histórico ainda.</div>'}
    </div></div>`;
  }
  sc.innerHTML=`<div style="background:var(--bg,#eef2f6);border-radius:16px;width:1080px;max-width:97vw;height:640px;max-height:93vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.32)">
   <div style="display:flex;align-items:center;gap:10px;padding:13px 16px;background:#fff;border-bottom:1px solid var(--line)"><b style="font-size:15px">CRM</b><select id="crmPipe" class="ne-sel" style="width:auto;min-width:160px">${pipeOpts}</select><button data-novolead class="sb-add" style="width:auto;margin:0;padding:8px 14px">${ico('plus',13)} novo lead</button><span style="flex:1"></span><span style="font-size:12px;color:var(--ink-faint)">${negs.length} negócios</span><button data-x style="border:0;background:none;font-size:22px;cursor:pointer;color:var(--ink-faint)">×</button></div>
   <div style="flex:1;display:flex;min-height:0">${board}${side}</div>
  </div>`;
  sc.onclick=e=>{if(e.target===sc)close();};
  sc.querySelector('[data-x]').onclick=close;
  const pv=sc.querySelector('#crmPipe');if(pv)pv.onchange=e=>{pid=+e.target.value;detail=null;loadBoard();};
  const nl=sc.querySelector('[data-novolead]');if(nl)nl.onclick=novoLead;
  sc.querySelectorAll('[data-neg]').forEach(function(el){
   el.onclick=e=>{if(!dragNeg)openDetail(+el.dataset.neg);};
   el.ondragstart=()=>{dragNeg=+el.dataset.neg;};
   el.ondragend=()=>{setTimeout(()=>{dragNeg=null;},50);};
  });
  sc.querySelectorAll('[data-drop]').forEach(function(col){
   col.ondragover=e=>{e.preventDefault();col.style.background='var(--brand-soft)';};
   col.ondragleave=()=>{col.style.background='';};
   col.ondrop=e=>{e.preventDefault();col.style.background='';if(dragNeg!=null)moverStage(dragNeg,+col.dataset.drop);};
  });
  const dc=sc.querySelector('[data-dclose]');if(dc)dc.onclick=()=>{detail=null;render();};
  sc.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{const a=b.dataset.a;if(a==='obs')acaoObs();else if(a==='tarefa')acaoTarefa();else if(a==='transf')acaoTransferir();});
 }
 render();await loadPipes();await loadBoard();
}
try{ window.__apeCrm = function(){ try{ openCrmManager(); }catch(e){ if(window.console)console.warn(e); } }; }catch(_e){}

/* ---------- IP do escritório (auto-detecta e atualiza) ---------- */
function openEscritorioConfig(){
 const sc=document.createElement('div');sc.className='cond-scrim';sc.id='escScrim';ROOT.appendChild(sc);
 const close=()=>sc.remove();
 let ips=[]; let meuIp=''; let carregando=true;
 function save(){sbPatch('/escritorio_config?id=eq.1',{ips:ips,atualizado_em:new Date().toISOString()}).then(()=>{render();toast('IP do escritório salvo','ok');}).catch(e=>toast('Erro: '+e.message,'err'));}
 function render(){
  sc.innerHTML=`<div style="background:#fff;border-radius:16px;width:460px;max-width:94vw;box-shadow:0 24px 60px rgba(0,0,0,.32);overflow:hidden">
   <div style="display:flex;align-items:center;padding:16px 18px 8px"><b style="flex:1;font-size:16px">IP do escritório</b><button data-x style="border:0;background:none;font-size:20px;cursor:pointer;color:var(--ink-faint)">×</button></div>
   <div style="padding:0 18px 16px">
    <div style="font-size:12px;color:var(--ink-faint);line-height:1.45;margin-bottom:12px">No horário comercial (9:30–18:30), só recebe lead quem está conectado a partir de um destes IPs (dentro do escritório).</div>
    <div style="background:var(--brand-soft);border-radius:10px;padding:11px 13px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
     <div style="flex:1;min-width:0"><div style="font-size:11px;color:var(--ink-faint)">Seu IP agora</div><div style="font-size:15px;font-weight:700;color:var(--brand)">${meuIp?esc(meuIp):'detectando…'}</div></div>
     ${meuIp?(ips.indexOf(meuIp)<0?`<button data-usemyip class="sb-add" style="width:auto;margin:0;padding:8px 13px">Usar este IP</button>`:'<span style="font-size:11.5px;color:var(--ok);font-weight:700">já cadastrado ✓</span>'):''}
    </div>
    <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--ink-faint);margin-bottom:6px">IPs cadastrados</div>
    ${ips.length?ips.map(ip=>`<div style="display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:9px;padding:8px 11px;margin-bottom:6px"><span style="flex:1;font-size:13px;font-weight:600">${esc(ip)}</span><button data-rmip="${esc(ip)}" style="border:0;background:none;cursor:pointer;color:var(--err);font-size:12px">remover</button></div>`).join(''):(carregando?'<div style="font-size:12px;color:var(--ink-faint);padding:4px 0">Carregando…</div>':'<div style="font-size:12px;color:var(--ink-faint);padding:4px 0">Nenhum IP cadastrado.</div>')}
    <div style="display:flex;gap:6px;margin-top:8px"><input id="ipNew" class="ne-inp" placeholder="adicionar IP manualmente" style="flex:1"><button id="ipAdd" class="sb-add" style="width:auto;margin:0;padding:8px 13px">Adicionar</button></div>
   </div></div>`;
  sc.onclick=e=>{if(e.target===sc)close();};
  sc.querySelector('[data-x]').onclick=close;
  const um=sc.querySelector('[data-usemyip]');if(um)um.onclick=()=>{if(meuIp&&ips.indexOf(meuIp)<0){ips.push(meuIp);save();}};
  sc.querySelectorAll('[data-rmip]').forEach(b=>b.onclick=()=>{if(!confirm('Remover o IP '+b.dataset.rmip+'?'))return;ips=ips.filter(x=>x!==b.dataset.rmip);save();});
  const ia=sc.querySelector('#ipNew');const addIp=()=>{const v=(ia.value||'').trim();if(v&&ips.indexOf(v)<0){ips.push(v);save();}};
  sc.querySelector('#ipAdd').onclick=addIp;ia.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addIp();}};
 }
 render();
 sbGet('/escritorio_config?id=eq.1&select=ips').then(r=>{ips=(r[0]&&r[0].ips)||[];carregando=false;render();}).catch(()=>{carregando=false;render();});
 fetch(SUPA_URL+'/functions/v1/presenca',{method:'POST',headers:{apikey:SUPA_KEY,Authorization:'Bearer '+authBearer(),'Content-Type':'application/json'},body:'{}'}).then(r=>r.json()).then(j=>{meuIp=(j&&j.ip)||'';render();}).catch(()=>{});
}
try{ window.__apeEscritorio = function(){ try{ openEscritorioConfig(); }catch(e){} }; }catch(_e){}
let _espPk={cat:'Tempo',q:''};
function openEsperaPicker(cb){closeCondModal();_espPk={cat:'Tempo',q:''};
 const scrim=document.createElement('div');scrim.className='cond-scrim';scrim.id='condScrim';
 const modal=document.createElement('div');modal.className='cond-modal';scrim.appendChild(modal);
 function render(){const cats=Object.keys(ESPERAS),cat=_espPk.cat,ql=_espPk.q.toLowerCase();const list=(ESPERAS[cat]||[]).filter(f=>!ql||f[1].toLowerCase().includes(ql)||f[2].toLowerCase().includes(ql));
  modal.innerHTML=`<div class="cm-rail">${cats.map(c=>`<button data-cat="${esc(c)}" class="${c===cat?'on':''}">${ico(CAT_ESPERA_ICON[c]||'wait',16,'currentColor')}<span>${esc(c)}</span></button>`).join('')}</div><div class="cm-main"><div class="cm-head"><div><h3>${esc(cat)}</h3><p>${esc(ESPERA_SUB[cat]||'')}</p></div><button class="cm-x" data-x>${ico('x',20,'currentColor')}</button></div><input class="cm-search" placeholder="Pesquisar..." value="${esc(_espPk.q)}"><div class="cm-list">${list.map(f=>`<button class="cm-card" data-key="${esc(f[0])}"><span class="cm-cico">${ico('wait',17,'currentColor')}</span><span class="cm-ct"><b>${esc(f[1])}</b><span>${esc(f[2])}</span></span>${f[4]?'<span class="cm-badge">Atenção</span>':''}</button>`).join('')||'<div style="color:var(--ink-faint);font-size:13px;padding:12px">Nada aqui</div>'}</div></div>`;
  modal.querySelector('[data-x]').onclick=closeCondModal;
  modal.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{_espPk.cat=b.dataset.cat;_espPk.q='';render();});
  const si=modal.querySelector('.cm-search');si.oninput=e=>{_espPk.q=e.target.value;render();const s2=modal.querySelector('.cm-search');s2.focus();s2.setSelectionRange(_espPk.q.length,_espPk.q.length);};
  modal.querySelectorAll('[data-key]').forEach(b=>b.onclick=()=>{cb(b.dataset.key);closeCondModal();});
 }
 render();scrim.onclick=e=>{if(e.target===scrim)closeCondModal();};ROOT.appendChild(scrim);}
function openInstancePicker(x,y,cb){closeCampoPicker();
 const p=document.createElement('div');p.id='campoPick';p.className='campo-pick';p.style.width='300px';p.style.left=Math.min(x,innerWidth-316)+'px';p.style.top=Math.min(y,innerHeight-360)+'px';let q='';
 function render(){const list=ref.instancias.filter(i=>!q||i.nome.toLowerCase().includes(q.toLowerCase()));
  p.innerHTML=`<input class="cp-search" placeholder="Pesquisar..." value="${esc(q)}"><div style="max-height:280px;overflow:auto">${list.map(i=>`<button data-nm="${esc(i.nome)}" style="display:flex;align-items:center;gap:9px;width:100%;border:0;background:transparent;border-radius:7px;padding:8px;font-size:12.5px;text-align:left;color:var(--ink);cursor:pointer">${ico('wa',16,'#25D366')}${esc(i.nome)}</button>`).join('')||'<div style="padding:10px;color:var(--ink-faint);font-size:12px">Nenhuma instância</div>'}</div>`;
  p.querySelectorAll('button[data-nm]').forEach(b=>b.onmouseenter=()=>b.style.background='var(--brand-soft)');
  p.querySelectorAll('button[data-nm]').forEach(b=>b.onmouseleave=()=>b.style.background='transparent');
  const si=p.querySelector('.cp-search');si.oninput=e=>{q=e.target.value;render();const s2=p.querySelector('.cp-search');s2.focus();s2.setSelectionRange(q.length,q.length);};
  p.querySelectorAll('[data-nm]').forEach(b=>b.onclick=()=>{cb(b.dataset.nm);closeCampoPicker();});
 }
 render();ROOT.appendChild(p);setTimeout(()=>document.addEventListener('mousedown',_cpOutside),0);}

/* INIT */
renderPalette();boot();
// expõe o gerenciador de abordagens para o menu do ERP (Ferramentas → Abordagens)
try{ window.__apeAbordagens = function(){ try{ openAbordagensManager(); }catch(e){ if(window.console)console.warn(e); } }; }catch(_e){}


}

function mount(host, context){
  if(!host) return;
  if(mounted) unmount();
  ROOT = host; _ctx = context || {}; _teardown = [];
  if(ROOT.classList) ROOT.classList.add('apecerto-automation-builder');
  ROOT.innerHTML = BUILDER_HTML;
  MAIN = ROOT.querySelector('.main');
  // rastreia listeners globais adicionados durante a montagem para removê-los no unmount
  var realWin = window.addEventListener, realDoc = document.addEventListener;
  window.addEventListener = function(ev,fn,opt){ _teardown.push(function(){ try{ window.removeEventListener(ev,fn,opt); }catch(e){} }); return realWin.call(window,ev,fn,opt); };
  document.addEventListener = function(ev,fn,opt){ _teardown.push(function(){ try{ document.removeEventListener(ev,fn,opt); }catch(e){} }); return realDoc.call(document,ev,fn,opt); };
  try { __run(); }
  catch(e){ if(window.console) console.error('[ApeCertoAutomationBuilder] erro na montagem:', e); }
  finally { window.addEventListener = realWin; document.addEventListener = realDoc; }
  mounted = true;
}

function unmount(){
  if(!mounted) return;
  for(var i=0;i<_teardown.length;i++){ try{ _teardown[i](); }catch(e){} }
  _teardown = [];
  // remove overlays transitórios que possam ter ido para o document.body em versões anteriores
  ['toast','mini','campoPick','condScrim','rpanel'].forEach(function(id){
    var el = document.getElementById(id); if(el && (!ROOT || !ROOT.contains(el))) { try{ el.remove(); }catch(e){} }
  });
  if(ROOT){ try{ ROOT.innerHTML=''; }catch(e){} }
  ROOT=null; MAIN=null; mounted=false;
}

return { mount: mount, unmount: unmount, isMounted: function(){ return mounted; } };
})();
