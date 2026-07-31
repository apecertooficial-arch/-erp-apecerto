/**
 * CRM Nova Era 3.0 — CSS próprio, injetado pelo workspace.
 *
 * IDENTIDADE: nada é reinventado. Cores, tipografia, raios, sombras e o
 * espaçamento vêm das variáveis do design system do CRM atual (globals.css).
 * A casca (cabeçalho, abas, busca, filtros, painel lateral) usa as MESMAS
 * classes do CRM atual — `crm-v2`, `crm-v2-header`, `crm-command-bar`,
 * `crm-toolbar-v2`, `crm-filter-sheet`, `lead-avatar`.
 *
 * Só o que é novo na 3.0 ganha classe: prefixo `ncrm3-`.
 */
export const CRM3_CSS = `
.ncrm3 { display:flex; flex-direction:column; min-height:0; }
.ncrm3-conteudo { flex:1; min-width:0; min-height:0; overflow:auto; padding:18px 28px 32px; }
.ncrm3-aviso { margin:0 0 14px; padding:11px 14px; border:1px solid var(--line); border-left:3px solid var(--orange); border-radius:var(--radius-input); background:var(--orange-50); color:var(--ink-soft); font-size:13px; }
.ncrm3-vazio { padding:34px 18px; border:1px dashed var(--line-strong); border-radius:var(--radius-card); background:var(--surface); color:var(--muted); font-size:13.5px; text-align:center; }
.ncrm3-vazio strong { display:block; margin-bottom:4px; color:var(--ink); font-size:15px; }
.ncrm3-carregando { padding:28px; color:var(--muted); font-size:13.5px; }
.ncrm3-erro { margin-bottom:14px; padding:12px 14px; border:1px solid #f0cfcf; border-radius:var(--radius-input); background:var(--red-bg); color:#96292a; font-size:13px; }

/* ---------- Meu Dia ---------- */
.ncrm3-dia { display:flex; flex-direction:column; gap:22px; max-width:920px; }
.ncrm3-dia-chamada { display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
.ncrm3-dia-chamada h2 { margin:0; font-size:19px; font-weight:700; letter-spacing:-.02em; }
.ncrm3-dia-chamada span { color:var(--muted); font-size:13px; }
.ncrm3-secao { display:flex; flex-direction:column; gap:9px; }
.ncrm3-secao-cab { display:flex; align-items:baseline; gap:8px; }
.ncrm3-secao-cab h3 { margin:0; font-size:12px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:var(--ink-soft); }
.ncrm3-secao-cab b { padding:1px 8px; border-radius:var(--radius-pill); background:var(--sunken); color:var(--muted); font-size:11px; }
.ncrm3-secao-ajuda { margin:0; color:var(--faint); font-size:12px; }

.ncrm3-item { display:flex; align-items:center; gap:14px; padding:13px 16px; border:1px solid var(--line); border-left:3px solid var(--line-strong); border-radius:var(--radius-card); background:var(--surface); box-shadow:var(--shadow-xs); }
.ncrm3-item:hover { box-shadow:var(--shadow-sm); }
.ncrm3-item.tom-vermelho { border-left-color:var(--red); }
.ncrm3-item.tom-amarelo { border-left-color:var(--amber); }
.ncrm3-item.tom-verde { border-left-color:var(--green); }
.ncrm3-item-corpo { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }
.ncrm3-item-linha { display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; }
.ncrm3-item-linha strong { font-size:15px; font-weight:650; }
.ncrm3-item-meta { color:var(--muted); font-size:12.5px; }
.ncrm3-item-motivo { color:var(--orange-700); font-size:12.5px; font-weight:600; }
.ncrm3-item-acao { color:var(--ink-soft); font-size:12.5px; }
.ncrm3-item-botao { flex:0 0 auto; }

/* ---------- Painel de abertura do Meu Dia ---------- */
.ncrm3-abertura { display:flex; flex-direction:column; gap:12px; padding:14px 16px; border:1px solid var(--line); border-radius:var(--radius-card); background:var(--surface); box-shadow:var(--shadow-xs); }
.ncrm3-abertura-numeros { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:10px; }
.ncrm3-abertura-numeros article { display:flex; flex-direction:column; gap:1px; padding:8px 10px; border-radius:var(--radius-input); background:var(--sunken); }
.ncrm3-abertura-numeros b { font-size:24px; font-weight:700; line-height:1.1; letter-spacing:-.02em; }
.ncrm3-abertura-numeros span { color:var(--muted); font-size:11.5px; }
.ncrm3-abertura-numeros article.link button { align-self:flex-start; padding:0; border:0; background:transparent; color:var(--orange-700); font-family:inherit; font-size:14px; font-weight:650; text-align:left; cursor:pointer; }
.ncrm3-abertura-proximo { display:flex; align-items:center; gap:14px; flex-wrap:wrap; padding:12px 14px; border:1px solid var(--orange-100); border-radius:var(--radius-input); background:var(--orange-50); }
.ncrm3-abertura-proximo > div { flex:1; min-width:200px; display:flex; flex-direction:column; gap:2px; }
.ncrm3-abertura-rotulo { color:var(--orange-700); font-size:10.5px; font-weight:700; letter-spacing:.11em; text-transform:uppercase; }
.ncrm3-abertura-proximo strong { font-size:16px; font-weight:700; }
.ncrm3-abertura-proximo em { color:var(--muted); font-size:12px; font-style:normal; }
.ncrm3-abertura-proximo p { margin:2px 0 0; color:var(--ink-soft); font-size:13px; }

/* ---------- Checklist de qualificacao (dentro da Sara) ---------- */
.ncrm3-checklist { display:flex; flex-direction:column; gap:7px; padding:9px 10px; border:1px solid var(--line); border-radius:var(--radius-input); background:var(--surface); }
.ncrm3-checklist-topo { display:flex; align-items:center; gap:10px; font-size:12.5px; }
.ncrm3-checklist-barra { flex:1; height:5px; border-radius:999px; background:var(--sunken); overflow:hidden; }
.ncrm3-checklist-barra i { display:block; height:100%; background:var(--orange); }
.ncrm3-checklist ul { list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:3px 12px; }
.ncrm3-checklist li { display:flex; align-items:baseline; gap:6px; font-size:12px; }
.ncrm3-checklist li span { flex:0 0 auto; width:12px; }
.ncrm3-checklist li b { font-weight:600; color:var(--ink-soft); }
.ncrm3-checklist li em { color:var(--muted); font-style:normal; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ncrm3-checklist li.ok span { color:var(--green); }
.ncrm3-checklist li.falta { opacity:.72; }
.ncrm3-checklist li.falta span { color:var(--faint); }

/* ---------- Funil ---------- */
.ncrm3-momentos { display:flex; gap:6px; margin-bottom:14px; overflow:auto; padding-bottom:2px; }
.ncrm3-momentos button { flex:0 0 auto; display:inline-flex; align-items:center; gap:7px; min-height:38px; padding:0 14px; border:1px solid var(--line); border-radius:var(--radius-pill); background:var(--surface); color:var(--ink-soft); font-family:inherit; font-size:13px; font-weight:600; cursor:pointer; }
.ncrm3-momentos button b { padding:0 7px; border-radius:var(--radius-pill); background:var(--sunken); color:var(--muted); font-size:11px; }
.ncrm3-momentos button.on { border-color:var(--orange); background:var(--orange-50); color:var(--orange-700); }
.ncrm3-momentos button.on b { background:var(--orange-100); color:var(--orange-700); }

.ncrm3-quadro { display:grid; grid-template-columns:repeat(4,minmax(250px,1fr)); gap:14px; align-items:start; }
.ncrm3-coluna { display:flex; flex-direction:column; gap:10px; min-width:0; padding:12px; border:1px solid var(--line); border-radius:var(--radius-card); background:var(--sunken); }
.ncrm3-coluna-cab { display:flex; flex-direction:column; gap:2px; }
.ncrm3-coluna-cab strong { display:flex; align-items:center; gap:7px; font-size:14px; font-weight:700; }
.ncrm3-coluna-cab strong b { padding:0 8px; border-radius:var(--radius-pill); background:var(--surface); color:var(--muted); font-size:11px; font-weight:700; }
.ncrm3-coluna-cab small { color:var(--muted); font-size:11.5px; line-height:1.35; }

/* ---------- Card 3.0 ---------- */
.ncrm3-card { position:relative; display:flex; flex-direction:column; gap:9px; padding:13px 14px; border:1px solid var(--line); border-left:3px solid var(--line-strong); border-radius:var(--radius-card); background:var(--surface); box-shadow:var(--shadow-xs); cursor:pointer; transition:box-shadow .16s ease, transform .16s ease; }
.ncrm3-card:hover { box-shadow:var(--shadow-sm); transform:translateY(-1px); }
.ncrm3-card.sel { border-color:var(--orange); box-shadow:0 0 0 3px rgba(255,101,0,.14); }
.ncrm3-card.tom-vermelho { border-left-color:var(--red); }
.ncrm3-card.tom-amarelo { border-left-color:var(--amber); }
.ncrm3-card.tom-verde { border-left-color:var(--green); }
.ncrm3-card.tom-preto { border-left-color:#3f3a36; }
.ncrm3-card-topo { display:flex; align-items:center; gap:10px; min-width:0; }
.ncrm3-card-topo .lead-avatar { flex:0 0 auto; }
.ncrm3-card-nome { min-width:0; display:flex; flex-direction:column; gap:1px; }
.ncrm3-card-nome strong { font-size:14.5px; font-weight:650; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ncrm3-card-nome span { color:var(--muted); font-size:11.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ncrm3-chips { display:flex; flex-wrap:wrap; gap:5px; }
.ncrm3-chip { display:inline-flex; align-items:center; gap:4px; padding:2px 9px; border-radius:var(--radius-pill); background:var(--sunken); color:var(--ink-soft); font-size:11px; font-weight:600; }
.ncrm3-chip.temp-quente { background:var(--orange-soft); color:var(--orange-700); }
.ncrm3-chip.temp-morno { background:var(--amber-bg); color:#8a5c07; }
.ncrm3-chip.temp-frio { background:#eaf0fb; color:#2f5bb7; }
.ncrm3-chip.temp-negociando { background:var(--green-bg); color:#10774a; }
.ncrm3-chip.sla-vermelho { background:var(--red-bg); color:#a02a2a; }
.ncrm3-chip.sla-amarelo { background:var(--amber-bg); color:#8a5c07; }
.ncrm3-chip.sla-verde { background:var(--green-bg); color:#10774a; }
.ncrm3-chip.sla-neutro { background:var(--sunken); color:var(--muted); }
.ncrm3-pendente { display:inline-flex; align-items:center; gap:5px; padding:3px 9px; border-radius:var(--radius-pill); background:#eaf0fb; color:#2456b5; font-size:11.5px; font-weight:700; }
.ncrm3-card-proxima { padding:7px 9px; border-radius:var(--radius-input); background:var(--sunken); color:var(--ink-soft); font-size:12.5px; }
.ncrm3-card-proxima b { display:block; font-weight:650; }
.ncrm3-card-sara { display:flex; gap:6px; padding:7px 9px; border:1px solid var(--orange-100); border-radius:var(--radius-input); background:var(--orange-50); color:#8a4a10; font-size:12px; line-height:1.4; }
.ncrm3-card-rodape { display:flex; align-items:center; justify-content:space-between; gap:8px; color:var(--faint); font-size:11.5px; }
.ncrm3-card-acoes { display:flex; align-items:center; gap:6px; }
.ncrm3-card-acoes .ncrm3-principal { flex:1; }
.ncrm3-principal { display:inline-flex; align-items:center; justify-content:center; gap:6px; min-height:40px; padding:0 16px; border:0; border-radius:var(--radius-pill); background:var(--orange); color:#fff; font-family:inherit; font-size:13px; font-weight:600; cursor:pointer; text-decoration:none; }
.ncrm3-principal:hover { background:var(--orange-600); }
.ncrm3-principal:disabled { opacity:.4; cursor:default; }
.ncrm3-secundario { display:inline-flex; align-items:center; justify-content:center; gap:6px; min-height:40px; padding:0 14px; border:1px solid var(--line-strong); border-radius:var(--radius-pill); background:var(--surface); color:var(--ink-soft); font-family:inherit; font-size:13px; font-weight:600; cursor:pointer; text-decoration:none; }
.ncrm3-secundario:hover { background:var(--sunken); }
.ncrm3-mais { position:relative; }
.ncrm3-mais>button { min-width:40px; min-height:40px; border:1px solid var(--line-strong); border-radius:var(--radius-pill); background:var(--surface); color:var(--ink-soft); font-size:16px; line-height:1; cursor:pointer; }
.ncrm3-menu { position:absolute; right:0; top:44px; z-index:30; display:flex; flex-direction:column; min-width:210px; padding:6px; border:1px solid var(--line); border-radius:14px; background:var(--surface); box-shadow:var(--shadow-lg); }
.ncrm3-menu button { border:0; border-radius:9px; padding:10px 12px; background:transparent; color:var(--ink-soft); font-family:inherit; font-size:13px; font-weight:600; text-align:left; cursor:pointer; }
.ncrm3-menu button:hover { background:var(--sunken); }

/* ---------- Ficha ---------- */
.ncrm3-ficha { display:flex; flex-direction:column; width:520px; max-width:44vw; flex:0 0 auto; border-left:1px solid var(--line); background:var(--surface); overflow:auto; }
.ncrm3-ficha-topo { position:sticky; top:0; z-index:2; display:flex; align-items:flex-start; gap:12px; padding:16px 20px; border-bottom:1px solid var(--line); background:var(--surface); }
.ncrm3-ficha-topo h2 { margin:0; font-size:18px; font-weight:700; letter-spacing:-.02em; }
.ncrm3-ficha-topo .ncrm3-situacao { display:block; margin-top:3px; color:var(--muted); font-size:12.5px; }
.ncrm3-ficha-fechar { margin-left:auto; min-width:38px; min-height:38px; border:1px solid var(--line); border-radius:var(--radius-pill); background:var(--surface); color:var(--muted); font-size:15px; cursor:pointer; }
.ncrm3-bloco { display:flex; flex-direction:column; gap:9px; padding:16px 20px; border-bottom:1px solid var(--line); }
.ncrm3-bloco>h3 { margin:0; color:var(--muted); font-size:11px; font-weight:700; letter-spacing:.11em; text-transform:uppercase; }
.ncrm3-linhas { display:flex; flex-direction:column; gap:6px; }
.ncrm3-linha { display:flex; justify-content:space-between; gap:12px; font-size:13px; }
.ncrm3-linha span { color:var(--muted); }
.ncrm3-linha b { font-weight:600; text-align:right; }
.ncrm3-fone { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:11px 13px; border:1px solid var(--line); border-radius:var(--radius-input); background:var(--sunken); font-size:15px; font-weight:650; letter-spacing:.02em; }
.ncrm3-nota { margin:0; color:var(--faint); font-size:12px; line-height:1.45; }
.ncrm3-conversa { display:flex; flex-direction:column; gap:7px; max-height:320px; overflow:auto; padding:2px; }
.ncrm3-msg { max-width:84%; padding:7px 11px; border-radius:14px; font-size:13px; line-height:1.4; }
.ncrm3-msg.cliente { align-self:flex-start; border:1px solid var(--line); background:var(--sunken); }
.ncrm3-msg.corretor { align-self:flex-end; border:1px solid #bfe8cf; background:var(--green-bg); }
.ncrm3-msg em { display:block; margin-bottom:2px; color:var(--faint); font-size:10.5px; font-style:normal; }
.ncrm3-tempo { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
.ncrm3-tempo li { display:flex; gap:8px; color:var(--ink-soft); font-size:12.5px; }
.ncrm3-tempo li span { flex:0 0 auto; color:var(--faint); }
.ncrm3-avancadas { display:flex; flex-wrap:wrap; gap:8px; }

/* ---------- Sara ---------- */
.ncrm3-sara { display:flex; flex-direction:column; gap:9px; padding:12px 13px; border:1px solid var(--orange-100); border-radius:var(--radius-card); background:var(--orange-50); }
.ncrm3-sara h4 { margin:0; font-size:13.5px; font-weight:700; }
.ncrm3-sara p { margin:0; color:#7d4a14; font-size:12.5px; line-height:1.45; }
.ncrm3-sara-campos { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:5px; color:var(--ink-soft); font-size:12.5px; }
.ncrm3-sara-campos li b { font-weight:650; }
.ncrm3-sara-copiar { padding:8px 10px; border:1px dashed #e2b98c; border-radius:var(--radius-input); background:var(--surface); color:var(--ink-soft); font-size:12.5px; line-height:1.45; }
.ncrm3-sara-acoes { display:flex; flex-wrap:wrap; gap:7px; }
.ncrm3-sara-acoes button { min-height:38px; padding:0 14px; border:1px solid var(--line-strong); border-radius:var(--radius-pill); background:var(--surface); color:var(--ink-soft); font-family:inherit; font-size:12.5px; font-weight:600; cursor:pointer; }
.ncrm3-sara-acoes button.usar { border-color:var(--orange); background:var(--orange); color:#fff; }
.ncrm3-sara-acoes button:disabled { opacity:.5; cursor:default; }

/* ---------- Gestão ---------- */
.ncrm3-gestao { display:flex; flex-direction:column; gap:16px; max-width:960px; }
.ncrm3-gestao-abas { display:flex; flex-wrap:wrap; gap:6px; }
.ncrm3-gestao-abas button { min-height:38px; padding:0 14px; border:1px solid var(--line); border-radius:var(--radius-pill); background:var(--surface); color:var(--ink-soft); font-family:inherit; font-size:13px; font-weight:600; cursor:pointer; }
.ncrm3-gestao-abas button.on { border-color:var(--orange); background:var(--orange-50); color:var(--orange-700); }
.ncrm3-kpis { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px; }
.ncrm3-kpi { padding:13px 15px; border:1px solid var(--line); border-radius:var(--radius-card); background:var(--surface); }
.ncrm3-kpi b { display:block; font-size:22px; font-weight:700; letter-spacing:-.02em; }
.ncrm3-kpi span { color:var(--muted); font-size:11.5px; }

/* ---------- Avisos ---------- */
.ncrm3-avisos { display:flex; flex-direction:column; gap:10px; max-width:820px; }

/* ---------- Visões oficiais do CRM atual, montadas dentro da 3.0 ----------
   O CRM atual NÃO foi alterado. Aqui só escondemos a barra de visões dele
   (a navegação 3.0 já faz esse papel, com oito abas) e, na aba Visitas,
   recortamos a Agenda para o painel do Pipe de Visitas que já existe. */
.ncrm3-oficial { flex:1; min-width:0; min-height:0; overflow:auto; }
.ncrm3-oficial .crm-v2 { min-height:0; zoom:1; }
/* O globals.css aplica zoom:.85 em .crm-v2. A casca da 3.0 tambem e .crm-v2,
   entao a visao oficial aninhada herdava o zoom duas vezes (.85 x .85 = 72%)
   e Leads, Esteira e Agenda apareciam menores que no CRM atual. */
.ncrm3-oficial .crm-command-bar { display:none; }
.ncrm3-so-visitas .crm-agenda-grid { grid-template-columns:1fr; }
.ncrm3-so-visitas .crm-agenda-grid > .agenda-panel:not(.visits) { display:none; }

/* ---------- Responsivo (tablet, 430px e 390px) ---------- */
@media (max-width:1180px) {
  .ncrm3-quadro { grid-template-columns:repeat(2,minmax(240px,1fr)); }
  .ncrm3-ficha { width:440px; max-width:52vw; }
}
@media (max-width:900px) {
  .ncrm3-conteudo { padding:14px 16px 26px; }
  .ncrm3-quadro { grid-template-columns:1fr; }
  /* Uma etapa por vez: as abas de momento passam a comandar o quadro. */
  .ncrm3-quadro[data-momento="novo"] .ncrm3-coluna:not([data-momento="novo"]),
  .ncrm3-quadro[data-momento="tentando_contato"] .ncrm3-coluna:not([data-momento="tentando_contato"]),
  .ncrm3-quadro[data-momento="em_atendimento"] .ncrm3-coluna:not([data-momento="em_atendimento"]),
  .ncrm3-quadro[data-momento="em_acompanhamento"] .ncrm3-coluna:not([data-momento="em_acompanhamento"]) { display:none; }
  /* Ficha em tela cheia no celular. */
  .ncrm3-ficha { position:fixed; inset:0; z-index:80; width:100vw; max-width:100vw; border-left:0; }
  .ncrm3-abertura-numeros { grid-template-columns:1fr 1fr; }
  .ncrm3-checklist ul { grid-template-columns:1fr; }
  .ncrm3-abertura-proximo .ncrm3-principal { width:100%; }
  .ncrm3-item { flex-wrap:wrap; }
  .ncrm3-item-botao, .ncrm3-item-botao .ncrm3-principal { width:100%; }
}
@media (max-width:460px) {
  .ncrm3-conteudo { padding:12px 12px 24px; }
  .ncrm3-dia { gap:18px; }
  .ncrm3-card { padding:14px; }
  .ncrm3-principal, .ncrm3-secundario { min-height:44px; }
  .ncrm3-linha { flex-direction:column; gap:2px; }
  .ncrm3-linha b { text-align:left; }
  .ncrm3-avancadas .ncrm3-secundario { width:100%; }
}
/* Nada pode causar rolagem horizontal em nenhuma largura. */
.ncrm3, .ncrm3-conteudo, .ncrm3-quadro, .ncrm3-coluna, .ncrm3-card, .ncrm3-item { max-width:100%; }
.ncrm3-card, .ncrm3-item, .ncrm3-linha b, .ncrm3-item-corpo { overflow-wrap:anywhere; }
`;
