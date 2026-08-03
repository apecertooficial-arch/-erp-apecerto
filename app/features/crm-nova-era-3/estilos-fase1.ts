/**
 * FASE 1 (print Meu Dia) — casca do CRM 3.0 no desenho aprovado.
 * Separado do estilos.ts para o trabalho faseado: cada fase soma um bloco
 * pequeno e revisável, sem reescrever o arquivo grande a cada print.
 */
export const CRM3_CSS_FASE1 = `
/* A casca ocupa TODA a largura disponivel: o wrapper do gate e um flex row e,
   sem flex-grow, o CRM encolhia para o tamanho do conteudo e sobrava um vazio
   a direita (ajuste pedido na fase 1). */
.crm-v2.ncrm3 { flex:1 1 auto; width:100%; min-width:0; }
.ncrm3-dia { max-width:1280px; }
.ncrm3-avisos { max-width:1280px; }
.ncrm3 > .crm-command-bar nav button { display:inline-flex; align-items:center; gap:8px; font-size:13.5px; padding:10px 14px; border-radius:10px; border:1.5px solid transparent; }
.ncrm3 > .crm-command-bar nav button.active { border-color:#FF7000; background:#fff; color:#CC5800; }
.ncrm3-aba-badge { min-width:20px; padding:1px 7px; border-radius:999px; background:var(--sunken); color:var(--ink-soft); font-size:10.5px; font-weight:700; }
.ncrm3 > .crm-command-bar nav button.active .ncrm3-aba-badge { background:#FFE4D1; color:#CC5800; }
.ncrm3 > .crm-v2-header .crm-eyebrow { display:none; }
.ncrm3 > .crm-v2-header > div { display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
.ncrm3 > .crm-v2-header h1 { margin:0; }
.ncrm3 > .crm-v2-header p { margin:0; color:var(--muted); font-size:13px; }
.ncrm3-abertura { border:0; border-radius:16px; }
.ncrm3-abertura-numeros { gap:12px; }
.ncrm3-abertura-numeros article { padding:14px 16px; border-radius:14px; }
.ncrm3-abertura-numeros b { font-size:27px; }
.ncrm3-abertura-numeros article.link { background:#E6F5EC; }
.ncrm3-abertura-numeros article.link b { color:#136B3D; }
.ncrm3-abertura-numeros article.link span { color:#136B3D; opacity:.85; }
.ncrm3-abertura-proximo { border:0; border-radius:14px; padding:16px 18px; }
.ncrm3-abertura-proximo .ncrm3-principal { min-height:44px; padding:0 22px; box-shadow:0 8px 18px rgba(255,112,0,.28); }
.ncrm3-item { position:relative; border:0; border-left:0; border-radius:16px; padding:14px 16px 14px 22px; box-shadow:0 1px 3px rgba(31,28,26,.07); }
.ncrm3-item::before { content:""; position:absolute; left:8px; top:14px; bottom:14px; width:4px; border-radius:999px; background:var(--line-strong); }
.ncrm3-item.tom-vermelho::before { background:#D93E3E; }
.ncrm3-item.tom-amarelo::before { background:#F2A82C; }
.ncrm3-item.tom-verde::before { background:#1E9E5A; }
.ncrm3-item.tom-laranja::before { background:#FF7000; }
.ncrm3-item.tom-roxo::before { background:#8B00CC; }
.ncrm3-item.tom-vermelho, .ncrm3-item.tom-amarelo, .ncrm3-item.tom-verde, .ncrm3-item.tom-laranja, .ncrm3-item.tom-roxo { border-left:0; }
.ncrm3-av { flex:0 0 auto; }
.ncrm3-dia .ncrm3-av.av-laranja { background:#FFE4D1; color:#CC5800; }
.ncrm3-dia .ncrm3-av.av-roxo { background:#EBD1F5; color:#66009A; }
.ncrm3-dia .ncrm3-av.av-vermelho { background:#FBE5E5; color:#A32C2C; }
.ncrm3-item-tempo { display:inline-flex; align-items:center; gap:4px; }
.ncrm3-dia .ncrm3-mais>button { min-width:36px; min-height:36px; border-radius:999px; font-size:15px; }
`;
