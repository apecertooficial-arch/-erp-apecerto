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
 * TOKENS DO HANDOFF v3 (entrega-crm/_ds): laranja #FF7000 é a ação primária
 * (inclusive o WhatsApp — verde é só o estado CONFIRMADO), roxo #8B00CC é a
 * Sara, registro em preto, e o código de cores por significado vale no CRM
 * todo: laranja=respondeu, roxo=lead novo, âmbar=aguardando, vermelho=prazo
 * estourado, verde=confirmado.
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
.ncrm3-item.tom-laranja { border-left-color:var(--orange); }
.ncrm3-item.tom-roxo { border-left-color:#8B00CC; }
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
.ncrm3-abertura-numeros article { display:flex; flex-direction:column; gap:1px; padding:10px 12px; border-radius:var(--radius-input); background:var(--sunken); }
.ncrm3-abertura-numeros article:nth-child(1) { background:var(--orange-50); } .ncrm3-abertura-numeros article:nth-child(1) b { color:var(--orange-700); }
.ncrm3-abertura-numeros article:nth-child(2) { background:#F7ECFC; } .ncrm3-abertura-numeros article:nth-child(2) b { color:#8B00CC; }
.ncrm3-abertura-numeros article:nth-child(3) { background:#FFF8E8; } .ncrm3-abertura-numeros article:nth-child(3) b { color:#8A6100; }
.ncrm3-abertura-numeros article:nth-child(4) { background:#E6F5EC; } .ncrm3-abertura-numeros article:nth-child(4) b { color:#136B3D; }
.ncrm3-abertura-numeros article:nth-child(4) button { color:#136B3D; }
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
.ncrm3-momentos button.on { border-color:#211d1a; background:#211d1a; color:#fff; }
.ncrm3-momentos button.on b { background:rgba(255,255,255,.2); color:#fff; }

.ncrm3-quadro { display:grid; grid-template-columns:repeat(4,minmax(250px,1fr)); gap:14px; align-items:start; }
.ncrm3-coluna { position:relative; display:flex; flex-direction:column; gap:10px; min-width:0; padding:14px 12px 12px; border:1px solid var(--line); border-radius:var(--radius-card); background:var(--sunken); overflow:hidden; }
.ncrm3-coluna::before { content:""; position:absolute; top:0; left:0; right:0; height:4px; background:var(--line-strong); }
.ncrm3-coluna[data-momento="novo"]::before { background:var(--orange); }
.ncrm3-coluna[data-momento="tentando_contato"]::before { background:#E8A317; }
.ncrm3-coluna[data-momento="em_atendimento"]::before { background:#1E9E5A; }
.ncrm3-coluna[data-momento="em_acompanhamento"]::before { background:#B8B0A8; }
.ncrm3-coluna-cab strong::before { content:""; width:8px; height:8px; border-radius:999px; background:var(--line-strong); }
.ncrm3-coluna[data-momento="novo"] .ncrm3-coluna-cab strong::before { background:var(--orange); }
.ncrm3-coluna[data-momento="tentando_contato"] .ncrm3-coluna-cab strong::before { background:#E8A317; }
.ncrm3-coluna[data-momento="em_atendimento"] .ncrm3-coluna-cab strong::before { background:#1E9E5A; }
.ncrm3-coluna[data-momento="em_acompanhamento"] .ncrm3-coluna-cab strong::before { background:#B8B0A8; }
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
.ncrm3-conduta { display:flex; flex-direction:column; gap:5px; padding:11px; border:1px solid #E7D7ED; border-left:4px solid #8B00CC; border-radius:var(--radius-input); background:#FBF5FD; color:var(--ink); font-size:12px; line-height:1.35; }
.ncrm3-conduta.prazo-atrasada { border-left-color:#D92D20; background:#FFF4F2; }
.ncrm3-conduta.prazo-vence_logo { border-left-color:#F79009; background:#FFFAEB; }
.ncrm3-conduta-label { color:#7A009F; font-size:10px; font-weight:800; letter-spacing:.09em; }
.ncrm3-conduta>b { font-size:14px; line-height:1.3; }
.ncrm3-conduta>small { color:var(--ink-soft); }
.ncrm3-conduta>em { color:var(--ink-soft); font-style:normal; }
.ncrm3-conduta-prazo { width:max-content; max-width:100%; padding:3px 8px; border-radius:999px; background:#fff; color:#7A009F; font-weight:750; }
.ncrm3-conduta.prazo-atrasada .ncrm3-conduta-prazo { color:#B42318; }
.ncrm3-conduta-ficha .ncrm3-sara { margin-top:12px; }
.ncrm3-card-sara { display:flex; flex-direction:column; gap:4px; padding:8px 10px; border:1px solid #EBD1F5; border-radius:var(--radius-input); background:#F7ECFC; color:#66009A; font-size:12px; line-height:1.4; }
.ncrm3-card-sara > span:first-child { color:#8B00CC; font-size:10.5px; font-weight:700; letter-spacing:.08em; }
.ncrm3-card-sara b { color:#66009A; }
.ncrm3-card-rodape { display:flex; align-items:center; justify-content:space-between; gap:8px; color:var(--faint); font-size:11.5px; }
.ncrm3-card-acoes { display:flex; align-items:center; gap:6px; }
.ncrm3-card-acoes .ncrm3-principal { flex:1; }
.ncrm3-principal { display:inline-flex; align-items:center; justify-content:center; gap:6px; min-height:40px; padding:0 16px; border:0; border-radius:var(--radius-pill); background:var(--orange); color:#fff; font-family:inherit; font-size:13px; font-weight:600; cursor:pointer; text-decoration:none; }
.ncrm3-principal:hover { background:var(--orange-600); }
.ncrm3-principal:disabled { opacity:.4; cursor:default; }
.ncrm3-secundario { display:inline-flex; align-items:center; justify-content:center; gap:6px; min-height:40px; padding:0 14px; border:1px solid var(--line-strong); border-radius:var(--radius-pill); background:var(--surface); color:var(--ink-soft); font-family:inherit; font-size:13px; font-weight:600; cursor:pointer; text-decoration:none; }
.ncrm3-secundario:hover { background:var(--sunken); }
.ncrm3-whatsapp { display:inline-flex; align-items:center; justify-content:center; gap:6px; min-height:44px; padding:0 16px; border:0; border-radius:var(--radius-pill); background:#FF7000; color:#fff; font-family:inherit; font-size:13.5px; font-weight:700; cursor:pointer; text-decoration:none; }
.ncrm3-whatsapp:hover { background:#E66200; }
.ncrm3-preto { display:inline-flex; align-items:center; justify-content:center; gap:6px; min-height:40px; padding:0 16px; border:0; border-radius:var(--radius-pill); background:#211d1a; color:#fff; font-family:inherit; font-size:13px; font-weight:600; cursor:pointer; }
.ncrm3-preto:hover { background:#3a3430; }
.ncrm3-mais { position:relative; }
.ncrm3-mais>button { min-width:40px; min-height:40px; border:1px solid var(--line-strong); border-radius:var(--radius-pill); background:var(--surface); color:var(--ink-soft); font-size:16px; line-height:1; cursor:pointer; }
.ncrm3-menu { position:absolute; right:0; top:44px; z-index:30; display:flex; flex-direction:column; min-width:210px; padding:6px; border:1px solid var(--line); border-radius:14px; background:var(--surface); box-shadow:var(--shadow-lg); }
.ncrm3-menu button { border:0; border-radius:9px; padding:10px 12px; background:transparent; color:var(--ink-soft); font-family:inherit; font-size:13px; font-weight:600; text-align:left; cursor:pointer; }
.ncrm3-menu button:hover { background:var(--sunken); }

/* ---------- Ficha ---------- */
.ncrm3-ficha { display:flex; flex-direction:column; width:420px; max-width:44vw; flex:0 0 auto; border-left:1px solid var(--line); background:var(--surface); overflow:auto; }
.ncrm3-ficha-topo { position:sticky; top:0; z-index:2; display:flex; align-items:flex-start; gap:12px; padding:16px 20px; border-bottom:1px solid var(--line); background:var(--surface); }
.ncrm3-ficha-topo h2 { margin:0; font-size:18px; font-weight:700; letter-spacing:-.02em; }
.ncrm3-ficha-topo .ncrm3-situacao { display:block; margin-top:3px; color:var(--muted); font-size:12.5px; }
.ncrm3-ficha-fechar { margin-left:auto; min-width:38px; min-height:38px; border:1px solid var(--line); border-radius:var(--radius-pill); background:var(--surface); color:var(--muted); font-size:15px; cursor:pointer; }
.ncrm3-bloco { display:flex; flex-direction:column; gap:9px; padding:16px 20px; border-bottom:1px solid var(--line); }
.ncrm3-bloco>h3 { margin:0; color:var(--muted); font-size:11px; font-weight:700; letter-spacing:.11em; text-transform:uppercase; }
.ncrm3-linhas { display:flex; flex-direction:column; gap:8px; padding:10px 12px; border-radius:var(--radius-input); background:var(--sunken); }
.ncrm3-linha { display:flex; justify-content:space-between; gap:12px; font-size:13px; }
.ncrm3-linha span { color:var(--muted); }
.ncrm3-linha b { font-weight:600; text-align:right; }
.ncrm3-fone { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:11px 13px; border:1px solid var(--line); border-radius:var(--radius-input); background:var(--sunken); font-size:15px; font-weight:650; letter-spacing:.02em; }
.ncrm3-nota { margin:0; color:var(--faint); font-size:12px; line-height:1.45; }
.ncrm3-conversa { display:flex; flex-direction:column; gap:7px; max-height:320px; overflow:auto; padding:2px; }
.ncrm3-msg { max-width:84%; padding:7px 11px; border-radius:14px; font-size:13px; line-height:1.4; }
.ncrm3-msg.cliente { align-self:flex-start; border:1px solid var(--line); background:var(--sunken); }
.ncrm3-msg.corretor { align-self:flex-end; border:1px solid var(--orange-100); background:var(--orange-50); }
.ncrm3-msg em { display:block; margin-bottom:2px; color:var(--faint); font-size:10.5px; font-style:normal; }
.ncrm3-tempo { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
.ncrm3-tempo li { display:flex; gap:8px; color:var(--ink-soft); font-size:12.5px; }
.ncrm3-tempo li span { flex:0 0 auto; color:var(--faint); }
.ncrm3-avancadas { display:flex; flex-wrap:wrap; gap:8px; }

/* ---------- Sara (LILÁS, como no protótipo) ---------- */
.ncrm3-sara { display:flex; flex-direction:column; gap:9px; padding:12px 13px; border:1px solid #EBD1F5; border-radius:var(--radius-card); background:#F7ECFC; }
.ncrm3-sara h4 { margin:0; font-size:13.5px; font-weight:700; }
.ncrm3-sara p { margin:0; color:#66009A; font-size:12.5px; line-height:1.45; }
.ncrm3-sara-campos { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:5px; color:var(--ink-soft); font-size:12.5px; }
.ncrm3-sara-campos li b { font-weight:650; }
.ncrm3-sara-copiar { padding:8px 10px; border:1px dashed #B24DDD; border-radius:var(--radius-input); background:var(--surface); color:var(--ink-soft); font-size:12.5px; line-height:1.45; }
.ncrm3-sara-acoes { display:flex; flex-wrap:wrap; gap:7px; }
.ncrm3-sara-acoes button { min-height:38px; padding:0 14px; border:1px solid var(--line-strong); border-radius:var(--radius-pill); background:var(--surface); color:var(--ink-soft); font-family:inherit; font-size:12.5px; font-weight:600; cursor:pointer; }
.ncrm3-sara-acoes button.usar { border-color:#8B00CC; background:#8B00CC; color:#fff; }
.ncrm3-sara-acoes button:disabled { opacity:.5; cursor:default; }
.ncrm3-sara-simples { gap:12px; }
.ncrm3-sara-topo { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.ncrm3-sara-status { padding:5px 8px; border-radius:999px; background:#fff; color:#66009A; font-size:10.5px; font-weight:700; text-align:right; }
.ncrm3-sara-status.nivel-revisao { background:#FFF1E8; color:#A14100; }
.ncrm3-sara-agora { display:flex; flex-direction:column; gap:5px; padding:13px; border-radius:12px; background:#fff; border:1px solid #E7D7ED; }
.ncrm3-sara-agora>span { color:#8B00CC; font-size:10px; font-weight:800; letter-spacing:.1em; }
.ncrm3-sara-agora>strong { color:var(--ink); font-size:15px; line-height:1.35; }
.ncrm3-sara-agora>small { color:var(--muted); font-size:11.5px; }
.ncrm3-sara-detalhes { padding-top:4px; border-top:1px solid #E4CBEF; }
.ncrm3-sara-detalhes>summary { min-height:36px; display:flex; align-items:center; color:#66009A; font-size:12px; font-weight:700; cursor:pointer; }
.ncrm3-sara-detalhes[open]>summary { margin-bottom:9px; }
.ncrm3-ficha-extras { border-bottom:1px solid var(--line); background:#fff; }
.ncrm3-ficha-extras>summary { padding:16px 20px; cursor:pointer; list-style-position:inside; font-size:13px; font-weight:750; color:var(--ink); }
.ncrm3-ficha-extras>div>.ncrm3-bloco:last-child { border-bottom:0; }
.ncrm3-sara-detalhes>ol { margin:9px 0 0 18px; padding:0; color:var(--ink-soft); font-size:12px; }

/* ---------- Gestão ---------- */
.ncrm3-gestao { display:flex; flex-direction:column; gap:16px; }
.ncrm3-gestao-abas { display:flex; flex-wrap:wrap; gap:6px; }
.ncrm3-gestao-abas button { min-height:38px; padding:0 14px; border:1px solid var(--line); border-radius:var(--radius-pill); background:var(--surface); color:var(--ink-soft); font-family:inherit; font-size:13px; font-weight:600; cursor:pointer; }
.ncrm3-gestao-abas button.on { border-color:var(--orange); background:var(--orange-50); color:var(--orange-700); }
.ncrm3-kpis { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px; }
.ncrm3-kpi { padding:13px 15px; border:1px solid var(--line); border-radius:var(--radius-card); background:var(--surface); }
.ncrm3-kpi b { display:block; font-size:22px; font-weight:700; letter-spacing:-.02em; }
.ncrm3-kpi span { color:var(--muted); font-size:11.5px; }

/* ---------- Leads 3.0 (tabela do protótipo) ---------- */
.ncrm3-leads { display:flex; flex-direction:column; gap:12px; }
.ncrm3-leads-topo { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
.ncrm3-leads-filtros { display:flex; gap:6px; flex-wrap:wrap; }
.ncrm3-leads-filtros button { min-height:34px; padding:0 12px; border:1px solid var(--line); border-radius:var(--radius-pill); background:var(--surface); color:var(--ink-soft); font-family:inherit; font-size:12.5px; font-weight:600; cursor:pointer; }
.ncrm3-leads-filtros button.on { background:var(--ink); border-color:var(--ink); color:#fff; }
.ncrm3-leads-filtros .ncrm3-leads-atrasados { background:var(--red-50, #FBE5E5); border-color:transparent; color:var(--red-600, #A32C2C); }
.ncrm3-leads-filtros .ncrm3-leads-atrasados.on { background:var(--red-600, #A32C2C); color:#fff; }
.ncrm3-leads-total { color:var(--muted); font-size:12px; }
.ncrm3-tabela { border:1px solid var(--line); border-radius:var(--radius-card); background:var(--surface); overflow:hidden; }
.ncrm3-tr { display:grid; grid-template-columns:minmax(230px,2fr) minmax(105px,1fr) minmax(150px,1.2fr) minmax(110px,1fr) minmax(90px,.9fr) minmax(60px,.5fr) minmax(85px,.8fr) 74px; align-items:center; gap:10px; padding:10px 14px; border-bottom:1px solid var(--line); border-left:3px solid transparent; }
.ncrm3-tr:last-child { border-bottom:none; }
.ncrm3-tr.cab { padding:9px 14px; background:var(--surface-soft, #faf8f6); color:var(--muted); font-size:10.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; border-left-color:transparent; }
.ncrm3-tr.etapa-novo { border-left-color:#8B00CC; }
.ncrm3-tr.etapa-tentando_contato { border-left-color:#E8A317; }
.ncrm3-tr.etapa-em_atendimento { border-left-color:#FF7000; }
.ncrm3-tr.etapa-em_acompanhamento { border-left-color:#1E9E5A; }
.ncrm3-td-lead { display:flex; align-items:center; gap:10px; min-width:0; }
.ncrm3-td-nome { display:flex; flex-direction:column; min-width:0; }
.ncrm3-td-nome b { font-size:13.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ncrm3-td-nome small { color:var(--muted); font-size:11.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ncrm3-td-tempo { display:flex; flex-direction:column; font-size:13px; font-weight:600; }
.ncrm3-td-tempo.atrasado { color:var(--red-600, #A32C2C); }
.ncrm3-td-tempo small { color:var(--muted); font-size:11px; font-weight:500; }
.ncrm3-chip-etapa { font-style:normal; display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:var(--radius-pill); font-size:11.5px; font-weight:600; background:var(--surface-soft, #f6f2ee); color:var(--ink-soft); }
.ncrm3-chip-etapa::before { content:""; width:6px; height:6px; border-radius:999px; background:currentColor; }
.ncrm3-chip-etapa.e-novo { background:#F7ECFC; color:#8B00CC; }
.ncrm3-chip-etapa.e-tentando_contato { background:#FFF8E8; color:#8A6100; }
.ncrm3-chip-etapa.e-em_atendimento { background:#FFF3EA; color:#CC5800; }
.ncrm3-chip-etapa.e-em_acompanhamento { background:#E6F5EC; color:#136B3D; }
.ncrm3-td-corretor { font-size:13px; font-weight:600; }
.ncrm3-td-origem, .ncrm3-td-data { color:var(--muted); font-size:12.5px; }
.ncrm3-abrir { min-height:32px; padding:0 14px; border:none; border-radius:var(--radius-pill); background:var(--orange); color:#fff; font-family:inherit; font-size:12.5px; font-weight:700; cursor:pointer; }
.ncrm3-tabela-rodape { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 14px; color:var(--muted); font-size:12px; background:var(--surface); }

/* ---------- Visitas 3.0 (protótipo 04) ---------- */
.ncrm3-visitas { display:flex; flex-direction:column; gap:14px; max-width:1080px; }
.ncrm3-visitas-topo { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
.ncrm3-visitas-selo { display:flex; align-items:center; gap:10px; }
.ncrm3-visitas-selo span { color:var(--orange-700); font-size:11px; font-weight:700; letter-spacing:.11em; }
.ncrm3-visitas-selo b { padding:3px 11px; border-radius:var(--radius-pill); background:var(--orange-50); color:var(--orange-700); font-size:11.5px; font-weight:700; }
.ncrm3-visitas-lista { display:flex; flex-direction:column; border:1px solid var(--line); border-radius:var(--radius-card); background:var(--surface); overflow:hidden; }
.ncrm3-visitas-pipe { display:grid; grid-template-columns:repeat(3,minmax(260px,1fr)); gap:12px; align-items:start; }
.ncrm3-visitas-coluna { min-width:0; padding:10px; border-radius:var(--radius-card); background:var(--sunken); }
.ncrm3-visitas-coluna>h3 { display:flex; align-items:center; justify-content:space-between; margin:0 0 9px; font-size:13px; }
.ncrm3-visitas-coluna>h3 b { padding:2px 8px; border-radius:999px; background:#fff; }
@media (max-width:900px){ .ncrm3-visitas-pipe { grid-template-columns:1fr; } }
.ncrm3-visita { display:flex; align-items:center; gap:14px; padding:12px 16px; border-bottom:1px solid var(--line); }
.ncrm3-visita:last-child { border-bottom:none; }
.ncrm3-visita-data { flex:0 0 auto; display:flex; flex-direction:column; align-items:center; justify-content:center; min-width:52px; padding:6px 8px; border-radius:var(--radius-input); background:var(--orange-50); }
.ncrm3-visita-data b { color:var(--orange-700); font-size:17px; font-weight:700; line-height:1.1; }
.ncrm3-visita-data small { color:var(--orange-700); font-size:9.5px; font-weight:700; letter-spacing:.08em; opacity:.8; }
.ncrm3-visita-corpo { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
.ncrm3-visita-corpo b { font-size:14px; font-weight:650; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ncrm3-visita-corpo small { color:var(--muted); font-size:12px; }
.ncrm3-visita-status { flex:0 0 auto; font-style:normal; padding:4px 12px; border-radius:var(--radius-pill); font-size:11.5px; font-weight:600; }
.ncrm3-visita-status.ok { background:#E6F5EC; color:#136B3D; }
.ncrm3-visita-status.espera { background:#FFF8E8; color:#8A6100; }
.ncrm3-visita-status.feita { background:var(--sunken); color:var(--muted); }
.ncrm3-visita-status.falta { background:#FBE5E5; color:#A32C2C; }

/* ---------- Avisos ---------- */
.ncrm3-avisos { display:flex; flex-direction:column; gap:10px; max-width:920px; }

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
/* O protótipo não tem a barra de filtros do CRM antigo dentro da 3.0 (Todos os
   funis / Etapas / Leads Atrasados): quem filtra é a própria tela nova. */
.ncrm3-oficial .crm-toolbar-v2 { display:none; }
/* Na aba Visitas o cabeçalho é o da 3.0 ("CRM · Visitas"); o da Agenda oficial
   sai de cena para não apresentar a tela com o nome errado. */
.ncrm3-so-visitas .crm-v2-header { display:none; }
.ncrm3-so-visitas .crm-agenda-grid { grid-template-columns:1fr; }
.ncrm3-so-visitas .crm-agenda-grid > .agenda-panel:not(.visits) { display:none; }

/* ---------- HANDOFF v3 (entrega-crm): topbar, estados do WhatsApp, chips de motivo,
   presenca do corretor e skin das visoes oficiais (Esteira, Agenda e Gestao).
   Tokens do design system oficial: laranja #FF7000, roxo #8B00CC, sucesso #1FA85A,
   atencao #F2A82C, perigo #D93E3E, neutros quentes. O CRM atual NAO e alterado:
   o skin vale so dentro da 3.0 (.ncrm3-oficial / .ncrm3-gestao). ---------- */
.ncrm3-topbar { display:flex; align-items:center; gap:14px; padding:10px 28px; border-bottom:1px solid var(--line); background:var(--surface); flex-wrap:wrap; }
.ncrm3-topbar-seletor { display:inline-flex; align-items:center; padding:3px; border:1px solid var(--line); border-radius:var(--radius-pill); background:var(--sunken); }
.ncrm3-topbar-seletor button { display:inline-flex; align-items:center; gap:6px; min-height:32px; padding:0 13px; border:0; border-radius:var(--radius-pill); background:transparent; color:var(--muted); font-family:inherit; font-size:12px; font-weight:600; cursor:pointer; white-space:nowrap; }
.ncrm3-topbar-seletor button.on { background:var(--surface); color:var(--ink); box-shadow:var(--shadow-xs); font-weight:700; }
.ncrm3-topbar-seletor button.on i { font-style:normal; padding:1px 6px; border-radius:var(--radius-pill); background:#FFE4D1; color:#CC5800; font-size:9.5px; font-weight:800; }
.ncrm3-topbar-nota { color:var(--muted); font-size:12px; }
.ncrm3-topbar-busca { display:flex; align-items:center; gap:7px; margin-left:auto; min-width:230px; padding:0 13px; min-height:38px; border:1px solid var(--line); border-radius:var(--radius-pill); background:var(--surface); }
.ncrm3-topbar-busca span { color:var(--faint); }
.ncrm3-topbar-busca input { flex:1; border:0; outline:0; background:transparent; color:var(--ink); font-family:inherit; font-size:12.5px; }
.ncrm3-novolead { display:inline-flex; align-items:center; gap:6px; min-height:38px; padding:0 16px; border:0; border-radius:var(--radius-pill); background:#FF7000; color:#fff; font-family:inherit; font-size:12.5px; font-weight:700; cursor:pointer; }
.ncrm3-novolead:hover { background:#E66200; }

/* Chips de motivo (Meu Dia e Avisos): laranja = respondeu, roxo = lead novo, vermelho = prazo estourado. */
.ncrm3-chip-motivo { display:inline-flex; align-items:center; padding:2px 10px; border-radius:var(--radius-pill); background:var(--sunken); color:var(--ink-soft); font-size:11px; font-weight:700; }
.ncrm3-chip-motivo.m-laranja { background:#FFE4D1; color:#CC5800; }
.ncrm3-chip-motivo.m-roxo { background:#EBD1F5; color:#66009A; }
.ncrm3-chip-motivo.m-vermelho { background:#FBE5E5; color:#A32C2C; }
.ncrm3-eyebrow { display:flex; align-items:baseline; gap:8px; color:#CC5800; font-size:11px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; }
.ncrm3-eyebrow b { padding:1px 8px; border-radius:var(--radius-pill); background:var(--sunken); color:var(--muted); font-size:11px; letter-spacing:0; }
.ncrm3-eyebrow small { color:var(--faint); font-size:11.5px; font-weight:500; letter-spacing:0; text-transform:none; }

/* Presenca do corretor na tabela de Leads. */
.ncrm3-online { display:flex; flex-direction:column; }
.ncrm3-online small { display:inline-flex; align-items:center; gap:5px; color:#1FA85A; font-size:10.5px; font-weight:700; }
.ncrm3-online small::before { content:""; width:6px; height:6px; border-radius:999px; background:#1FA85A; }
.ncrm3-online.off small { color:#B8B0A8; }
.ncrm3-online.off small::before { background:#B8B0A8; }

/* WhatsApp honesto: aberto -> aguardando sincronizacao (ambar) -> confirmado (verde). */
.ncrm3-wa-aguardando { display:flex; flex-direction:column; gap:7px; padding:11px 14px; border:1px solid #F2A82C; border-radius:var(--radius-input); background:#FDF1D9; color:#8A6100; font-size:12.5px; font-weight:700; }
.ncrm3-wa-aguardando i { display:block; height:4px; border-radius:999px; background:#F5E3B8; overflow:hidden; position:relative; }
.ncrm3-wa-aguardando i::after { content:""; position:absolute; inset:0; width:38%; border-radius:999px; background:#F2A82C; animation:ncrm3-sync 1.2s ease-in-out infinite alternate; }
@keyframes ncrm3-sync { from { transform:translateX(-10%); } to { transform:translateX(180%); } }
.ncrm3-wa-confirmado { display:flex; flex-direction:column; gap:3px; padding:11px 14px; border:1px solid #9BD9B4; border-radius:var(--radius-input); background:#E4F6EC; color:#136B3D; font-size:12.5px; font-weight:700; }
.ncrm3-wa-confirmado small { color:#1FA85A; font-size:11px; font-weight:600; }

/* Skin da Esteira oficial dentro da 3.0 (print 05): KPIs coloridos e cards do DS. */
.ncrm3-oficial .sales-kpis article { border:0; border-radius:18px; }
.ncrm3-oficial .sales-kpis article:nth-child(1) { background:#FFF3EA; } .ncrm3-oficial .sales-kpis article:nth-child(1) strong { color:#CC5800; }
.ncrm3-oficial .sales-kpis article:nth-child(2) { background:#F7ECFC; } .ncrm3-oficial .sales-kpis article:nth-child(2) strong { color:#66009A; }
.ncrm3-oficial .sales-kpis article:nth-child(3) { background:#E6F5EC; } .ncrm3-oficial .sales-kpis article:nth-child(3) strong { color:#136B3D; }
.ncrm3-oficial .sales-kpis article:nth-child(4) { background:#FFF8E8; } .ncrm3-oficial .sales-kpis article:nth-child(4) strong { color:#8A6100; }
.ncrm3-oficial .sales-kpis article:nth-child(5) { background:#FBE5E5; } .ncrm3-oficial .sales-kpis article:nth-child(5) strong { color:#A32C2C; }
.ncrm3-oficial .sales-process>header span { color:#CC5800; letter-spacing:.12em; }
.ncrm3-oficial .sales-stage { border-radius:18px; }
.ncrm3-oficial .sales-filter button.active { background:#211D1A; border-color:#211D1A; color:#fff; }

/* Skin da Agenda oficial dentro da 3.0 (print 06): check verde, data laranja, atraso vermelho. */
.ncrm3-oficial .agenda-panel { border-radius:18px; }
.ncrm3-oficial .agenda-item.done>button { background:#1E9E5A; border-color:#1E9E5A; color:#fff; }
.ncrm3-oficial .agenda-item.overdue time { color:#A32C2C; font-weight:700; }
.ncrm3-oficial .visit-item .visit-date { background:#FFF3EA; border-radius:12px; }
.ncrm3-oficial .visit-item .visit-date strong { color:#CC5800; }
.ncrm3-oficial .visit-item .visit-date span { color:#CC5800; text-transform:uppercase; font-weight:700; }

/* Gestao (prints 08-11): sub-aba ativa em pill preto, como no prototipo. */
.ncrm3-gestao-abas button.on { border-color:#211D1A; background:#211D1A; color:#fff; }

.ncrm3-dia .ncrm3-secao-cab h3 { color:#CC5800; }
.ncrm3-modal-fundo { position:fixed; inset:0; z-index:60; display:flex; align-items:center; justify-content:center; padding:20px; background:rgba(31,28,26,.45); }
.ncrm3-modal { display:flex; flex-direction:column; gap:12px; width:min(420px,94vw); padding:20px; border-radius:18px; background:var(--surface); box-shadow:var(--shadow-lg); }
.ncrm3-modal h3 { margin:0; font-size:16px; font-weight:700; letter-spacing:-.02em; }
.ncrm3-modal label { display:flex; flex-direction:column; gap:5px; color:var(--muted); font-size:12px; font-weight:600; }
.ncrm3-modal input, .ncrm3-modal select { min-height:40px; padding:0 12px; border:1px solid var(--line); border-radius:12px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:13px; outline:0; }
.ncrm3-modal input:focus, .ncrm3-modal select:focus { border-color:#FF7000; }
.ncrm3-modal-acoes { display:flex; justify-content:flex-end; gap:8px; }

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
