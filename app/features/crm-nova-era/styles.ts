/**
 * CRM Nova Era — CSS isolado (FASE 1.0).
 * TODAS as classes têm prefixo `nova-crm-` para não colidir nem herdar do globals.css.
 * Injetado via <style> pelo Gate (sem tocar app/globals.css nem app/layout.tsx).
 */
export const NOVA_CRM_CSS = `
.nova-crm-root{--nc-orange:#ff7000;--nc-ink:#1d1d1f;--nc-muted:#6b7280;--nc-line:#e6e6ea;--nc-bg:#f6f7f9;--nc-card:#fff;
  --nc-green:#22a35a;--nc-yellow:#e0a520;--nc-red:#d13d3d;--nc-black:#3f3a36;
  color:var(--nc-ink);font-family:inherit;display:flex;flex-direction:column;height:100%;min-height:0;background:var(--nc-bg);}
.nova-crm-topbar{display:flex;align-items:center;gap:16px;padding:14px 20px;background:var(--nc-card);border-bottom:1px solid var(--nc-line);flex-wrap:wrap;}
.nova-crm-topbar h1{font-size:18px;margin:0;font-weight:700;}
.nova-crm-eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--nc-muted);}
.nova-crm-badge-exp{background:#fff4e6;color:#b45309;border:1px solid #f5c98a;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:700;}
.nova-crm-seg{display:inline-flex;background:#eef0f3;border-radius:10px;padding:3px;gap:2px;}
.nova-crm-seg button{border:0;background:transparent;padding:7px 14px;border-radius:8px;font-size:13px;font-weight:600;color:var(--nc-muted);cursor:pointer;}
.nova-crm-seg button.on{background:var(--nc-card);color:var(--nc-ink);box-shadow:0 1px 2px rgba(0,0,0,.08);}
.nova-crm-notice{display:flex;align-items:center;gap:8px;background:#fff8ee;border:1px solid #f3d9b0;color:#8a5a12;padding:8px 14px;font-size:12.5px;}
.nova-crm-notice b{color:#7a4d0a;}
.nova-crm-body{flex:1;min-height:0;display:flex;gap:0;}
.nova-crm-main{flex:1;min-width:0;display:flex;flex-direction:column;padding:16px 20px;overflow:auto;}
.nova-crm-board{display:grid;grid-template-columns:repeat(4,minmax(240px,1fr));gap:14px;align-items:start;}
.nova-crm-col{background:#eef0f3;border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:10px;min-height:120px;}
.nova-crm-col-head{display:flex;flex-direction:column;gap:2px;padding:4px 6px;}
.nova-crm-col-head strong{font-size:13.5px;}
.nova-crm-col-head span{font-size:11px;color:var(--nc-muted);}
.nova-crm-col-count{align-self:flex-start;background:#dfe3e8;border-radius:999px;font-size:11px;padding:1px 8px;font-weight:700;color:#4b5563;margin-top:2px;}
.nova-crm-card{background:var(--nc-card);border:1px solid var(--nc-line);border-left:4px solid var(--nc-line);border-radius:12px;padding:11px 12px;cursor:pointer;display:flex;flex-direction:column;gap:8px;transition:box-shadow .12s,transform .12s;}
.nova-crm-card:hover{box-shadow:0 3px 12px rgba(0,0,0,.08);transform:translateY(-1px);}
.nova-crm-card.sel{outline:2px solid var(--nc-orange);}
.nova-crm-card.lv-critico{border-left-color:var(--nc-black);}
.nova-crm-card.lv-atrasado{border-left-color:var(--nc-red);}
.nova-crm-card.lv-atencao{border-left-color:var(--nc-yellow);}
.nova-crm-card.lv-no_prazo{border-left-color:var(--nc-green);}
.nova-crm-card-top{display:flex;justify-content:space-between;align-items:baseline;gap:8px;}
.nova-crm-card-top strong{font-size:14px;}
.nova-crm-card-origin{font-size:11px;color:var(--nc-muted);}
.nova-crm-chip{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;border-radius:999px;padding:2px 9px;}
.nova-crm-chip.lv-critico{background:#efe9e5;color:var(--nc-black);}
.nova-crm-chip.lv-atrasado{background:#fbe6e6;color:var(--nc-red);}
.nova-crm-chip.lv-atencao{background:#fcf3da;color:#9a6a08;}
.nova-crm-chip.lv-no_prazo{background:#e4f4ea;color:var(--nc-green);}
.nova-crm-mom{font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--nc-muted);font-weight:700;}
.nova-crm-card-next{font-size:12px;color:#374151;background:#f7f8fa;border-radius:8px;padding:6px 8px;}
.nova-crm-dots{display:flex;gap:4px;align-items:center;}
.nova-crm-dot{width:9px;height:9px;border-radius:50%;background:#dfe3e8;border:1px solid #cfd4da;}
.nova-crm-dot.r-sem_resposta{background:#e5c07a;border-color:#c99b3c;}
.nova-crm-dot.r-conversou{background:#3b6fe0;border-color:#2b57bd;}
.nova-crm-dot.r-agendou_visita{background:var(--nc-green);border-color:#178a48;}
.nova-crm-dot.r-sem_interesse{background:#b9bec6;border-color:#9aa0a8;}
.nova-crm-dot.r-numero_invalido{background:var(--nc-red);border-color:#a82c2c;}
.nova-crm-dot.pend{background:transparent;border-style:dashed;}
/* Painel lateral */
.nova-crm-panel{width:400px;flex-shrink:0;background:var(--nc-card);border-left:1px solid var(--nc-line);display:flex;flex-direction:column;overflow:auto;}
.nova-crm-panel-head{padding:16px 18px;border-bottom:1px solid var(--nc-line);position:sticky;top:0;background:var(--nc-card);z-index:1;}
.nova-crm-panel-head h2{margin:0;font-size:17px;}
.nova-crm-panel-head .sub{font-size:12px;color:var(--nc-muted);margin-top:2px;}
.nova-crm-panel-sec{padding:14px 18px;border-bottom:1px solid var(--nc-line);}
.nova-crm-panel-sec h3{margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--nc-muted);}
.nova-crm-coach{background:#fff8ee;border:1px solid #f3d9b0;border-radius:12px;padding:12px;}
.nova-crm-coach .t{font-weight:700;font-size:13.5px;margin-bottom:4px;}
.nova-crm-coach .d{font-size:12.5px;color:#5b4a2e;line-height:1.45;}
.nova-crm-tl{display:flex;flex-direction:column;gap:0;}
.nova-crm-tl-item{display:flex;gap:10px;}
.nova-crm-tl-rail{display:flex;flex-direction:column;align-items:center;}
.nova-crm-tl-node{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0;}
.nova-crm-tl-line{width:2px;flex:1;background:var(--nc-line);min-height:14px;}
.nova-crm-tl-body{padding-bottom:14px;}
.nova-crm-tl-body .c{font-size:13px;font-weight:600;}
.nova-crm-tl-body .m{font-size:11.5px;color:var(--nc-muted);}
.nova-crm-tl-body .o{font-size:12px;color:#374151;margin-top:2px;}
.nova-crm-tl-next .nova-crm-tl-node{background:#fff;border:2px dashed var(--nc-orange);color:var(--nc-orange);}
.nova-crm-btn{border:0;border-radius:10px;padding:9px 14px;font-size:13px;font-weight:600;cursor:pointer;}
.nova-crm-btn.primary{background:var(--nc-orange);color:#fff;}
.nova-crm-btn.primary:hover{background:#e86400;}
.nova-crm-btn.ghost{background:#f1f3f5;color:#374151;}
.nova-crm-btn.ghost:hover{background:#e6e9ec;}
.nova-crm-btn.danger{background:#fbe6e6;color:var(--nc-red);}
.nova-crm-actions{display:flex;flex-wrap:wrap;gap:8px;}
.nova-crm-actions .nova-crm-btn{flex:0 0 auto;}
/* Fila de hoje */
.nova-crm-queue{display:flex;flex-direction:column;gap:8px;max-width:760px;}
.nova-crm-queue-item{display:flex;align-items:center;gap:12px;background:var(--nc-card);border:1px solid var(--nc-line);border-left:4px solid var(--nc-line);border-radius:12px;padding:10px 14px;cursor:pointer;}
.nova-crm-queue-item:hover{box-shadow:0 2px 10px rgba(0,0,0,.06);}
.nova-crm-queue-item.lv-critico{border-left-color:var(--nc-black);}
.nova-crm-queue-item.lv-atrasado{border-left-color:var(--nc-red);}
.nova-crm-queue-item.lv-atencao{border-left-color:var(--nc-yellow);}
.nova-crm-queue-item.lv-no_prazo{border-left-color:var(--nc-green);}
.nova-crm-queue-rank{font-size:15px;font-weight:800;color:#9aa0a8;width:26px;text-align:center;}
.nova-crm-queue-main{flex:1;min-width:0;}
.nova-crm-queue-main strong{font-size:14px;}
.nova-crm-queue-main .m{font-size:12px;color:var(--nc-muted);}
.nova-crm-empty{color:var(--nc-muted);font-size:13px;padding:24px;text-align:center;}
/* Modal */
.nova-crm-modal-layer{position:fixed;inset:0;background:rgba(15,15,20,.45);display:flex;align-items:center;justify-content:center;z-index:60;padding:20px;}
.nova-crm-modal{background:var(--nc-card);border-radius:16px;max-width:460px;width:100%;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.25);}
.nova-crm-modal h3{margin:0 0 4px;font-size:16px;}
.nova-crm-modal .sub{font-size:12.5px;color:var(--nc-muted);margin-bottom:14px;}
.nova-crm-field{display:flex;flex-direction:column;gap:5px;margin-bottom:12px;}
.nova-crm-field label{font-size:12px;font-weight:600;color:#374151;}
.nova-crm-field select,.nova-crm-field input,.nova-crm-field textarea{border:1px solid var(--nc-line);border-radius:9px;padding:8px 10px;font-size:13px;font-family:inherit;}
.nova-crm-err{background:#fbe6e6;color:var(--nc-red);border-radius:9px;padding:8px 10px;font-size:12px;margin-bottom:10px;}
.nova-crm-modal-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:6px;}
.nova-crm-toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:#1d1d1f;color:#fff;padding:10px 18px;border-radius:999px;font-size:13px;z-index:70;box-shadow:0 8px 24px rgba(0,0,0,.25);}
.nova-crm-seghint{font-size:11px;color:var(--nc-muted);}
/* Fase 1.1 */
.nova-crm-resp-badge{display:inline-flex;align-items:center;gap:4px;background:#e8efff;color:#2b57bd;border:1px solid #c3d3f7;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:700;}
.nova-crm-auto-badge{display:inline-flex;align-items:center;gap:4px;background:#eef1f4;color:#43505e;border:1px solid #d4dae1;border-radius:999px;padding:2px 9px;font-size:10.5px;font-weight:600;}
.nova-crm-card-foot{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:10.5px;color:var(--nc-muted);}
.nova-crm-queue-cat{font-size:11px;text-transform:uppercase;letter-spacing:.07em;font-weight:800;color:#4b5563;margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid var(--nc-line);}
.nova-crm-queue > div > .nova-crm-queue-cat:first-child{margin-top:0;}
.nova-crm-outbound{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:18px;}
.nova-crm-out-area{background:#f0f2f5;border:1px dashed #c9ced6;border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px;}
.nova-crm-out-head{display:flex;justify-content:space-between;align-items:center;gap:8px;}
.nova-crm-out-head strong{font-size:13px;}
.nova-crm-out-item{background:var(--nc-card);border:1px solid var(--nc-line);border-radius:10px;padding:9px 12px;cursor:pointer;display:flex;flex-direction:column;gap:2px;font-size:12.5px;}
.nova-crm-out-item:hover{box-shadow:0 2px 8px rgba(0,0,0,.07);}
.nova-crm-out-item.sel{outline:2px solid var(--nc-orange);}
.nova-crm-out-item span{color:var(--nc-muted);font-size:11.5px;}
.nova-crm-kpis{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px;}
.nova-crm-kpi{background:var(--nc-card);border:1px solid var(--nc-line);border-radius:12px;padding:10px 14px;min-width:118px;}
.nova-crm-kpi b{display:block;font-size:20px;line-height:1.1;}
.nova-crm-kpi span{font-size:11px;color:var(--nc-muted);}
.nova-crm-kpi.warn b{color:var(--nc-red);}
.nova-crm-kpi.info b{color:#2b57bd;}
.nova-crm-filters{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:14px;}
.nova-crm-filters select{border:1px solid var(--nc-line);border-radius:9px;padding:6px 9px;font-size:12.5px;background:var(--nc-card);}
.nova-crm-fchip{border:1px solid var(--nc-line);background:var(--nc-card);border-radius:999px;padding:5px 12px;font-size:12px;font-weight:600;color:#4b5563;cursor:pointer;}
.nova-crm-fchip.on{background:var(--nc-orange);border-color:var(--nc-orange);color:#fff;}
/* ---- CRM Nova Era (live) — classes adicionais ---- */
.nova-crm-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 12px;border-bottom:1px solid var(--nc-line);background:var(--nc-card);}
.nova-crm-count{display:inline-flex;min-width:20px;justify-content:center;background:var(--nc-bg);border:1px solid var(--nc-line);border-radius:999px;padding:0 7px;font-size:11px;font-weight:700;margin-left:6px;}
.nova-crm-col-body{display:flex;flex-direction:column;gap:8px;padding:8px 4px;}
.nova-crm-fila-wrap{display:flex;flex-direction:column;gap:10px;}
.nova-crm-indic{display:flex;flex-wrap:wrap;gap:14px;font-size:12.5px;color:var(--nc-muted);}
.nova-crm-indic b{color:var(--nc-ink);}
.nova-crm-panel-next{margin-top:8px;font-size:13px;}
.nova-crm-panel-body{display:flex;flex-direction:column;gap:12px;padding:12px;overflow:auto;}
.nova-crm-coach{background:var(--nc-bg);border:1px solid var(--nc-line);border-radius:12px;padding:10px 12px;font-size:13px;}
.nova-crm-coach p{margin:4px 0 0;color:var(--nc-muted);}
.nova-crm-sara-card{margin-top:8px;border:1px solid var(--nc-line);border-radius:12px;padding:10px;background:var(--nc-card);}
.nova-crm-acoes{display:flex;flex-wrap:wrap;gap:8px;}
.nova-crm-form{display:flex;flex-direction:column;gap:8px;border:1px solid var(--nc-line);border-radius:12px;padding:12px;background:var(--nc-card);}
.nova-crm-form label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600;color:#4b5563;}
.nova-crm-form select,.nova-crm-form input{border:1px solid var(--nc-line);border-radius:9px;padding:7px 9px;font-size:13px;background:#fff;}
.nova-crm-form-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:4px;}
.nova-crm-hint{font-size:12px;color:var(--nc-muted);}
.nova-crm-saida-resumo{background:var(--nc-bg);border:1px solid var(--nc-line);border-radius:12px;padding:12px;font-size:13px;}
.nova-crm-tl-wrap{display:flex;flex-direction:column;gap:6px;}
.nova-crm-tl-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;font-size:12px;color:#4b5563;}
.nova-crm-tl-list li span{color:var(--nc-muted);}
`;
