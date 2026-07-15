import { gunzipSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "../..");
const sourcePath = resolve(projectRoot, "reference/CRM_ApeCerto_FINAL.html");
const source = await readFile(sourcePath, "utf8");
const templateMatch = source.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/);
const manifestMatch = source.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/);

if (!templateMatch || !manifestMatch) throw new Error("Pacote do ERP original incompleto.");

let template = JSON.parse(templateMatch[1]);
const manifest = JSON.parse(manifestMatch[1]);
const publicAssets = resolve(projectRoot, "frontend/public/legacy-assets");
await mkdir(publicAssets, { recursive: true });

const extensionFor = (mime) => {
  if (mime.includes("javascript")) return "js";
  if (mime === "image/png") return "png";
  if (mime === "font/ttf") return "ttf";
  return "bin";
};

for (const [uuid, asset] of Object.entries(manifest)) {
  let data = Buffer.from(asset.data, "base64");
  if (asset.compressed) data = gunzipSync(data);
  const extension = extensionFor(asset.mime);
  const publicPath = `/legacy-assets/${uuid}.${extension}`;

  if (uuid === "2b6ec5e7-d30e-46d2-85f8-33c0ead220e0") {
    const runtime = data.toString("utf8").replace(
      "registry.get(this.__name).subs.add(this.__sub);",
      "registry.get(this.__name).subs.add(this.__sub); if(this.logic && typeof this.logic.doLogin === 'function') window.__apeLegacyLogic = this.logic;",
    );
    data = Buffer.from(runtime, "utf8");
  }

  await writeFile(resolve(publicAssets, `${uuid}.${extension}`), data);
  template = template.split(uuid).join(publicPath);

}

const performanceMarkup = `
      <sc-if value="{{ isPerformance }}" hint-placeholder-val="{{ false }}">
        <div class="apf-root cc-scroll cc-fade">
          <div class="apf-command">
            <div class="apf-tabs">
              <sc-for list="{{ perf.tabs }}" as="t" hint-placeholder-count="7">
                <button type="button" onclick="{{ t.onClick }}" style="{{ t.style }}">{{ t.label }}</button>
              </sc-for>
            </div>
            <div class="apf-command-spacer"></div>
            <label class="apf-scope"><span>Visualização</span><sc-raw-select value="{{ perf.scopeSel.value }}" onchange="{{ perf.scopeSel.onChange }}"><sc-for list="{{ perf.scopeSel.opts }}" as="o" hint-placeholder-count="5"><option value="{{ o.v }}">{{ o.label }}</option></sc-for></sc-raw-select></label>
            <div class="apf-period"><sc-for list="{{ perf.periodoChips }}" as="p" hint-placeholder-count="3"><button type="button" onclick="{{ p.onClick }}" style="{{ p.style }}">{{ p.label }}</button></sc-for></div>
          </div>
          <div class="apf-live"><span></span> Métricas parametrizadas · dados do Supabase</div>
          <sc-if value="{{ perf.dataQuality.show }}" hint-placeholder-val="{{ false }}"><div class="apf-quality"><strong>Base em consolidação</strong><span>{{ perf.dataQuality.text }}</span></div></sc-if>

          <sc-if value="{{ perf.pGeral }}" hint-placeholder-val="{{ true }}">
            <div class="apf-hero-grid">
              <article class="apf-card apf-score-card">
                <div><p class="apf-eyebrow">Score ApêCerto</p><h2>{{ perf.scopeNome }}</h2><span style="{{ perf.scoreHero.badgeStyle }}">{{ perf.scoreHero.faixa }}</span></div>
                <div style="{{ perf.scoreHero.ringStyle }}"><div class="apf-ring-core"><strong>{{ perf.scoreHero.value }}</strong><small>/100</small></div></div>
              </article>
              <article class="apf-card">
                <div class="apf-card-title"><div><p class="apf-eyebrow">Composição do Score</p><h3>Indicadores ponderados</h3></div></div>
                <div class="apf-driver-list"><sc-for list="{{ perf.scoreHero.drivers }}" as="d" hint-placeholder-count="6"><div><header><span>{{ d.label }} <small>{{ d.peso }}</small></span><strong>{{ d.valTxt }}</strong></header><div class="apf-track"><i style="{{ d.barStyle }}"></i></div></div></sc-for></div>
              </article>
            </div>
            <div class="apf-kpis"><sc-for list="{{ perf.kpis }}" as="k" hint-placeholder-count="6"><article class="apf-kpi"><div style="{{ k.iconWrap }}">{{ k.icon }}</div><span>{{ k.label }}</span><strong>{{ k.value }}</strong><small>{{ k.sub }}</small></article></sc-for></div>
            <div class="apf-two">
              <article class="apf-card"><div class="apf-card-title"><div><p class="apf-eyebrow">Meta comercial</p><h3>Progresso do período</h3></div><strong class="apf-orange">{{ perf.meta.pctTxt }}</strong></div><div class="apf-track apf-track-lg"><i style="{{ perf.meta.barStyle }}"></i></div><dl class="apf-summary"><div><dt>Atingido</dt><dd>{{ perf.meta.atingidoTxt }}</dd></div><div><dt>Meta</dt><dd>{{ perf.meta.metaTxt }}</dd></div><div><dt>Restante</dt><dd>{{ perf.meta.restanteTxt }}</dd></div><div><dt>Projeção</dt><dd>{{ perf.meta.projecaoTxt }}</dd></div></dl><p class="apf-muted">{{ perf.meta.projPctTxt }}</p></article>
              <article class="apf-card"><div class="apf-card-title"><div><p class="apf-eyebrow">Conversão</p><h3>Eficiência do funil</h3></div></div><div class="apf-conv"><sc-for list="{{ perf.conv }}" as="c" hint-placeholder-count="3"><div><header><span>{{ c.k }}</span><strong>{{ c.pctTxt }}</strong></header><div class="apf-track"><i style="{{ c.barStyle }}"></i></div></div></sc-for></div></article>
            </div>
            <article class="apf-card"><div class="apf-card-title"><div><p class="apf-eyebrow">Ranking do período</p><h3>VGV e Score da equipe</h3></div></div><div class="apf-rank"><sc-for list="{{ perf.ranking }}" as="r" hint-placeholder-count="5"><button type="button" onclick="{{ r.onClick }}" style="{{ r.rowStyle }}"><b>{{ r.pos }}</b><i style="{{ r.avatarStyle }}">{{ r.initials }}</i><span><strong>{{ r.nome }}</strong><small>{{ r.scoreTxt }}</small><em class="apf-track"><u style="{{ r.barStyle }}"></u></em></span><mark>{{ r.vgvTxt }}</mark></button></sc-for></div></article>
          </sc-if>

          <sc-if value="{{ perf.pAtend }}" hint-placeholder-val="{{ false }}">
            <div class="apf-kpis apf-kpis-four"><sc-for list="{{ perf.atend.kpis }}" as="k" hint-placeholder-count="12"><article class="apf-kpi"><div style="{{ k.iconWrap }}">{{ k.icon }}</div><span>{{ k.label }}</span><strong>{{ k.value }}</strong><small>{{ k.sub }}</small></article></sc-for></div>
            <div class="apf-three">
              <article class="apf-card apf-ring-panel"><p class="apf-eyebrow">SLA de atendimento</p><div style="{{ perf.atend.slaRingStyle }}"><div class="apf-ring-core"><strong>{{ perf.atend.slaPctTxt }}</strong><small>cumprido</small></div></div><p>Meta operacional ≥ 85%</p></article>
              <article class="apf-card apf-ring-panel"><p class="apf-eyebrow">Primeira resposta</p><div style="{{ perf.atend.respRingStyle }}"><div class="apf-ring-core"><strong>{{ perf.atend.respTxt }}</strong><small>média</small></div></div><p>Meta operacional ≤ 2 min</p></article>
              <article class="apf-card"><div class="apf-card-title"><div><p class="apf-eyebrow">Equipe</p><h3>Velocidade de resposta</h3></div></div><div class="apf-speed"><sc-for list="{{ perf.atend.tempoBars }}" as="r" hint-placeholder-count="5"><div><i style="{{ r.avatarStyle }}">{{ r.initials }}</i><span><b>{{ r.nome }}</b><em class="apf-track"><u style="{{ r.barStyle }}"></u></em></span><strong>{{ r.valTxt }}</strong></div></sc-for></div></article>
            </div>
          </sc-if>

          <sc-if value="{{ perf.pAtiv }}" hint-placeholder-val="{{ false }}">
            <div class="apf-kpis"><sc-for list="{{ perf.ativ.kpis }}" as="k" hint-placeholder-count="6"><article class="apf-kpi"><div style="{{ k.iconWrap }}">{{ k.icon }}</div><span>{{ k.label }}</span><strong>{{ k.value }}</strong><small>{{ k.sub }}</small></article></sc-for></div>
            <article class="apf-card"><div class="apf-card-title"><div><p class="apf-eyebrow">Atividade comercial</p><h3>Da visita ao fechamento</h3></div></div><div class="apf-funnel"><sc-for list="{{ perf.ativ.funil }}" as="f" hint-placeholder-count="4"><div><header><span>{{ f.k }}</span><strong>{{ f.n }}</strong></header><div class="apf-track apf-track-lg"><i style="{{ f.barStyle }}"></i></div></div></sc-for></div></article>
          </sc-if>

          <sc-if value="{{ perf.pOrg }}" hint-placeholder-val="{{ false }}">
            <div class="apf-alerts"><sc-for list="{{ perf.org.alertas }}" as="a" hint-placeholder-count="9"><article><div style="color:{{ a.cor }}">{{ a.icon }}</div><strong style="color:{{ a.cor }}">{{ a.n }}</strong><span>{{ a.label }}</span></article></sc-for></div>
            <sc-if value="{{ perf.org.showTable }}" hint-placeholder-val="{{ true }}"><article class="apf-card"><div class="apf-card-title"><div><p class="apf-eyebrow">Disciplina operacional</p><h3>Organização do CRM por corretor</h3></div></div><div class="apf-table"><div class="apf-table-head"><span>Corretor</span><span>Parados</span><span>Sem tarefa</span><span>Sem qualificação</span><span>Disciplina</span></div><sc-for list="{{ perf.org.rows }}" as="r" hint-placeholder-count="5"><button type="button" onclick="{{ r.onClick }}"><span><i style="{{ r.avatarStyle }}">{{ r.initials }}</i><b>{{ r.nome }}</b></span><em>{{ r.paradosTxt }}</em><em>{{ r.tarefaTxt }}</em><em>{{ r.qualifTxt }}</em><strong>{{ r.discTxt }}<u class="apf-track"><i style="{{ r.barStyle }}"></i></u></strong></button></sc-for></div></article></sc-if>
          </sc-if>

          <sc-if value="{{ perf.pProd }}" hint-placeholder-val="{{ false }}">
            <div class="apf-kpis"><sc-for list="{{ perf.prod.kpis }}" as="k" hint-placeholder-count="6"><article class="apf-kpi"><div style="{{ k.iconWrap }}">{{ k.icon }}</div><span>{{ k.label }}</span><strong>{{ k.value }}</strong><small>{{ k.sub }}</small></article></sc-for></div>
            <div class="apf-two"><article class="apf-card"><div class="apf-card-title"><div><p class="apf-eyebrow">Velocidade do ciclo</p><h3>Tempo médio até a venda</h3></div></div><div class="apf-conv"><sc-for list="{{ perf.prod.tempos }}" as="t" hint-placeholder-count="3"><div><header><span>{{ t.k }}</span><strong>{{ t.v }}</strong></header><div class="apf-track"><i style="{{ t.barStyle }}"></i></div></div></sc-for></div></article><article class="apf-card apf-highlight"><p class="apf-eyebrow">Conversão por hora online</p><strong>{{ perf.prod.conversaoHora }}%</strong><span>vendas geradas por hora produtiva</span></article></div>
          </sc-if>

          <sc-if value="{{ perf.pRank }}" hint-placeholder-val="{{ false }}">
            <div class="apf-board-grid"><sc-for list="{{ perf.boards }}" as="b" hint-placeholder-count="6"><article class="apf-card"><div class="apf-card-title"><div><p class="apf-eyebrow">Ranking</p><h3>{{ b.titulo }}</h3><small>{{ b.subtitulo }}</small></div></div><div class="apf-board"><sc-for list="{{ b.rows }}" as="r" hint-placeholder-count="5"><button type="button" onclick="{{ r.onClick }}"><b style="{{ r.posStyle }}">{{ r.pos }}</b><i style="{{ r.avatarStyle }}">{{ r.initials }}</i><span><strong>{{ r.nome }}</strong><em class="apf-track"><u style="{{ r.barStyle }}"></u></em></span><mark>{{ r.valTxt }}</mark></button></sc-for></div></article></sc-for></div>
          </sc-if>

          <sc-if value="{{ perf.pIa }}" hint-placeholder-val="{{ false }}">
            <div class="apf-indices"><sc-for list="{{ perf.indices }}" as="i" hint-placeholder-count="6"><article class="apf-card"><header><div><p class="apf-eyebrow">Índice parametrizado</p><h3>{{ i.nome }}</h3></div><strong>{{ i.val }}</strong></header><p>{{ i.desc }}</p><div class="apf-track"><i style="{{ i.barStyle }}"></i></div></article></sc-for></div>
            <div class="apf-two"><article class="apf-card"><div class="apf-card-title"><div><p class="apf-eyebrow">Inteligência comercial</p><h3>Leitura dos indicadores</h3></div></div><div class="apf-insights"><sc-for list="{{ perf.iaCards }}" as="c" hint-placeholder-count="5"><article style="border-left-color:{{ c.cor }}"><div style="color:{{ c.cor }}">{{ c.icon }}</div><span><strong>{{ c.q }}</strong><p>{{ c.a }}</p></span></article></sc-for></div></article><article class="apf-card"><div class="apf-card-title"><div><p class="apf-eyebrow">Plano de ação</p><h3>Prioridades sugeridas</h3></div></div><div class="apf-actions"><sc-for list="{{ perf.iaAcoes }}" as="a" hint-placeholder-count="4"><div><i style="background:{{ a.cor }}"></i><span><strong>{{ a.t }}</strong><small style="color:{{ a.cor }}">{{ a.impacto }}</small></span></div></sc-for></div></article></div>
          </sc-if>
        </div>
      </sc-if>
`;

const performanceBlock = /      <sc-if value="\{\{ isPerformance \}\}"[\s\S]*?<\/sc-if>\s*\n\s*<!-- ========== INÍCIO \/ DASHBOARD ========== -->/;
if (!performanceBlock.test(template)) throw new Error("Bloco visual de Performance não encontrado no HTML original.");
template = template.replace(performanceBlock, `${performanceMarkup}\n      <!-- ========== INÍCIO / DASHBOARD ========== -->`);

const performanceLogicAnchor = "      // §2/§15 — na visão de corretor o seletor de escopo perde a lista da equipe: só o próprio desempenho.";
const performanceTabsLogic = `      perf.tabs = [
        { id: 'geral', label: 'Visão geral' },
        { id: 'atendimento', label: 'Atendimento' },
        { id: 'atividade', label: 'Atividade' },
        { id: 'organizacao', label: 'Organização do CRM' },
        { id: 'produtividade', label: 'Produtividade' },
        { id: 'ranking', label: 'Ranking', gestor: true },
        { id: 'ia', label: 'Inteligência', gestor: true }
      ].filter(t => !t.gestor || gestorP).map(t => ({ label: t.label, onClick: () => this.setState({ perfTab: t.id }), style: chip(pTab === t.id) }));
      perf.dataQuality = { show: !cur.convLeadOk, text: 'A conversão Lead → Venda fica indisponível enquanto vendas históricas não estiverem vinculadas à base de leads atribuídos.' };
`;
if (!template.includes(performanceLogicAnchor)) throw new Error("Lógica de Performance não encontrada no HTML original.");
template = template.replace(performanceLogicAnchor, performanceTabsLogic + performanceLogicAnchor);

const performanceFactorLogic = "      const pf = perfPeriodo === 'mes' ? 1 : perfPeriodo === 'tri' ? 2.85 : 10.7;";
if (!template.includes(performanceFactorLogic)) throw new Error("Fator legado de Performance não encontrado.");
template = template.replace(performanceFactorLogic, "      const pf = 1; // O RPC já devolve o período exato; não projetar valores por multiplicação.");

const performanceCoreMetricsLogic = `        const vendas = R.vendas || 0; const leads = R.leads || 0;
        const vgv = R.vgv || 0; const com = R.comissao || 0; const ticket = vendas ? Math.round(vgv / vendas) : 0;
        const meta = metasMap[n] || 3000000; const metaPct = (vgv>0&&meta) ? Math.min(999, Math.round(vgv / meta * 100)) : 0;`;
const performanceCoreMetricsReplacement = `        const vendas = R.vendas || 0; const leads = R.leadsTotal || R.leads || 0;
        const vgv = R.vgv || 0; const com = R.comissao || 0; const ticket = vendas ? Math.round(vgv / vendas) : 0;
        const normMeta = (v) => String(v||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').trim().toLowerCase();
        const nNorm = normMeta(n); const nFirst = nNorm.split(' ')[0];
        const metaKey = Object.keys(metasMap).find(k => { const x=normMeta(k); return x===nNorm || x.split(' ')[0]===nFirst; });
        const metaBase = Number(metaKey ? metasMap[metaKey] : 3000000) || 3000000;
        const meta = metaBase * (perfPeriodo === 'tri' ? 3 : perfPeriodo === 'ano' ? 12 : 1); const metaPct = (vgv>0&&meta) ? Math.min(999, Math.round(vgv / meta * 100)) : 0;`;
if (!template.includes(performanceCoreMetricsLogic)) throw new Error("Métricas centrais de Performance não encontradas.");
template = template.replace(performanceCoreMetricsLogic, performanceCoreMetricsReplacement);

const performanceReactivationLogic = "        const ligacoes = R.ligacoes || 0; const ligAtend = R.ligAtend || 0; const followups = R.followups || 0;";
if (!template.includes(performanceReactivationLogic)) throw new Error("Métricas de atendimento de Performance não encontradas.");
template = template.replace(performanceReactivationLogic, performanceReactivationLogic + " const reativacoes = R.reativacoes || 0;");
template = template.replace("msgsEnv, msgsRec, audios, ligacoes, ligAtend, followups, onlineH", "msgsEnv, msgsRec, audios, ligacoes, ligAtend, followups, reativacoes, onlineH");
template = template.replace("kpi('Reativações', String(pn(_ri(cur.nome + 'rea', 3, 22))), 'leads recuperados'", "kpi('Reativações', String(pn(cur.reativacoes)), 'leads recuperados'");
template = template.replace("        r.reativacoes = _ri(r.nome + 'rea', 3, 22);", "        r.reativacoes = r.reativacoes || 0;");
template = template.replace("      const perH = (v) => (v / cur.onlineH);", "      const perH = (v) => (v / Math.max(1, cur.onlineH));");
template = template.replace("brlK(cur.com / cur.onlineH)", "brlK(cur.com / Math.max(1, cur.onlineH))");

template = template.replace("        const convLead = leads ? vendas / leads : 0; const convVisita", "        const convLeadOk = leads > 0 && vendas <= leads; const convLead = convLeadOk ? vendas / leads : 0; const convVisita");
template = template.replace("convLead, convVisita, convProp, respScore", "convLead, convLeadOk, convVisita, convProp, respScore");
template = template.replace("        convLead: teamLeads ? teamVendas / teamLeads : 0, convVisita", "        convLeadOk: teamLeads > 0 && teamVendas <= teamLeads, convLead: (teamLeads > 0 && teamVendas <= teamLeads) ? teamVendas / teamLeads : 0, convVisita");
template = template.replace("kpi('Conversão Lead→Venda', (cur.convLead * 100).toFixed(1) + '%', pn(cur.leads) + ' leads'", "kpi('Conversão Lead→Venda', cur.convLeadOk ? (cur.convLead * 100).toFixed(1) + '%' : 'N/D', cur.convLeadOk ? pn(cur.leads) + ' leads' : 'vínculos históricos incompletos'");

const performancePeriodLogic = "        periodoChips: [{ id: 'mes', l: 'Mês' }, { id: 'tri', l: 'Trimestre' }, { id: 'ano', l: 'Ano' }].map(p => ({ label: p.l, onClick: () => this.setState({ perfPeriodo: p.id }), style: chip(perfPeriodo === p.id) })),";
if (!template.includes(performancePeriodLogic)) throw new Error("Seletor de período de Performance não encontrado.");
template = template.replace(performancePeriodLogic, "        periodoChips: [{ id: 'mes', l: 'Mês' }, { id: 'tri', l: 'Trimestre' }, { id: 'ano', l: 'Ano' }].map(p => ({ label: p.l, onClick: () => this.setState({ perfPeriodo: p.id }, () => this._loadPerformanceReal(p.id)), style: chip(perfPeriodo === p.id) })),");

const performanceLoaderLogic = `  async _loadPerformanceReal(){
    var self=this;
    try{
      var BASE='https://diaegvfveqezispcthwk.supabase.co/rest/v1';
      const r=await fetch(BASE+'/rpc/performance_corretores',{method:'POST',headers:self._esteiraHeaders(),body:'{}'});`;
const performanceLoaderReplacement = `  async _loadPerformanceReal(periodo){
    var self=this;
    try{
      var BASE='https://diaegvfveqezispcthwk.supabase.co/rest/v1';
      var p=periodo||((self.state&&self.state.perfPeriodo)||'mes');
      var agora=new Date(); var inicio;
      if(p==='ano') inicio=new Date(agora.getFullYear(),0,1);
      else if(p==='tri') inicio=new Date(agora.getFullYear(),agora.getMonth()-2,1);
      else inicio=new Date(agora.getFullYear(),agora.getMonth(),1);
      const r=await fetch(BASE+'/rpc/performance_corretores',{method:'POST',headers:self._esteiraHeaders(),body:JSON.stringify({p_inicio:inicio.toISOString(),p_fim:agora.toISOString()})});`;
if (!template.includes(performanceLoaderLogic)) throw new Error("Carregador real de Performance não encontrado.");
template = template.replace(performanceLoaderLogic, performanceLoaderReplacement);

const rankingVgvLoaderAnchor = "  async _loadPerformanceReal(periodo){";
if (!template.includes(rankingVgvLoaderAnchor)) throw new Error("Ponto de inclusão do ranking de VGV não encontrado.");
template = template.replace(rankingVgvLoaderAnchor, `  async _loadRankingVgvReal(){
    var self=this;
    try{
      var BASE='https://diaegvfveqezispcthwk.supabase.co/rest/v1';
      var ano=2026;
      const r=await fetch(BASE+'/rpc/ranking_vgv_corretores',{method:'POST',headers:self._esteiraHeaders(),body:JSON.stringify({p_inicio:ano+'-01-01T00:00:00-03:00',p_fim:(ano+1)+'-01-01T00:00:00-03:00'})});
      if(!r.ok) return;
      const j=await r.json();
      self._rankingVgvReal=Array.isArray(j)?j:[];
      if(self.state) self.setState({_rankingVgvRev:(self.state._rankingVgvRev||0)+1});
    }catch(e){}
  }
${rankingVgvLoaderAnchor}`);

// O HTML original guardava nomes com grafias diferentes (ex.: Elizângela,
// Elizangela Ferreira e Eliz). Vendas e metas devem ser ligadas pela pessoa,
// sem depender de acento ou sobrenome digitado no lançamento.
const personHelperAnchor = "  _num(x) {";
const personHelpers = `  _personKey(value) {
    return String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim().split(/\\s+/)[0] || '';
  }
  _samePerson(a, b) { const ka = this._personKey(a), kb = this._personKey(b); return !!ka && ka === kb; }
  _personIncluded(value, target) { var self = this; return String(value || '').split(/[,\\/]/).some(function(part){ return self._samePerson(part, target); }); }
  _abrirVendaFinanceiroAdmin(vendaId) {
    var self=this, perfil=String((self.state&&self.state.sessionPerfil)||'').toLowerCase();
    if(perfil!=='admin'){self.showToast('Somente administradores podem editar os dados financeiros da venda.');return;}
    var d=(self.state&&self.state.vendasX&&self.state.vendasX[vendaId])||{};
    var source=d._sourceVenda||{};
    if(!source.id){self.showToast('Não foi possível localizar os dados originais desta venda.');return;}
    var esc=function(v){return String(v==null?'':v).replace(/[&<>\"]/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'})[c];});};
    var nval=function(v){var n=Number(v||0);return n?String(Math.round(n*100)/100):'';};
    var parseNum=function(v){var s=String(v==null?'':v).trim().replace(/\\s/g,'');if(s.indexOf(',')>=0&&s.indexOf('.')>=0)s=s.replace(/\\./g,'').replace(',','.');else s=s.replace(',','.');return Number(s);};
    var pct=Number(source.percentual_comissao||0)*100;
    var sale={data_venda:String(source.data_venda||'').slice(0,10),vgv:nval(source.vgv),percentual_comissao:pct?String(Math.round(pct*10000)/10000):'',forma_pgto:source.forma_pgto||'',status:String(source.status||'pendente').toLowerCase(),obs:source.obs||''};
    var rows=(d._recebimentosRaw||[]).map(function(r){return{id:r.id||'',venda_id:vendaId,numero_parcela:String(r.numero_parcela||''),valor_total:nval(r.valor_total),data_prevista:String(r.data_prevista||'').slice(0,10),data_recebimento:String(r.data_recebimento||'').slice(0,10),status:String(r.status||'pendente').toLowerCase()};});
    var removed=[];
    var overlay=document.createElement('div');overlay.id='apeVendaFinanceiroAdmin';overlay.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(31,28,26,.5);display:flex;align-items:center;justify-content:center;padding:22px;font-family:var(--font-body,Arial)';
    var close=function(){try{overlay.remove();}catch(e){}};
    var fresh=function(){return{id:'',venda_id:vendaId,numero_parcela:String(rows.length+1),valor_total:'',data_prevista:'',data_recebimento:'',status:'pendente'};};
    var sync=function(){overlay.querySelectorAll('[data-sale-field]').forEach(function(inp){sale[inp.getAttribute('data-sale-field')]=inp.value;});overlay.querySelectorAll('[data-rec-row]').forEach(function(el){var i=Number(el.getAttribute('data-rec-row')),r=rows[i];if(!r)return;el.querySelectorAll('[data-rec-field]').forEach(function(inp){r[inp.getAttribute('data-rec-field')]=inp.value;});});};
    var fieldStyle='display:block;width:100%;height:40px;box-sizing:border-box;margin-top:5px;border:1px solid #DDD6D0;border-radius:9px;background:#fff;padding:0 10px;font-family:inherit';
    var labelStyle='font-size:10px;font-weight:800;color:#8B837C;letter-spacing:.05em';
    var render=function(){
      var recBody=rows.map(function(r,i){return '<div data-rec-row="'+i+'" style="border:1px solid #E6E0DB;border-radius:12px;padding:12px;background:#FAF8F6;margin-bottom:9px"><div style="display:grid;grid-template-columns:90px minmax(130px,1fr) minmax(135px,1fr) minmax(135px,1fr) minmax(120px,.8fr) 34px;gap:9px;align-items:end"><label style="'+labelStyle+'">PARCELA<input data-rec-field="numero_parcela" inputmode="numeric" value="'+esc(r.numero_parcela)+'" style="'+fieldStyle+'"></label><label style="'+labelStyle+'">VALOR (R$)<input data-rec-field="valor_total" inputmode="decimal" value="'+esc(r.valor_total)+'" placeholder="0,00" style="'+fieldStyle+'"></label><label style="'+labelStyle+'">DATA PREVISTA<input data-rec-field="data_prevista" type="date" value="'+esc(r.data_prevista)+'" style="'+fieldStyle+'"></label><label style="'+labelStyle+'">DATA RECEBIDA<input data-rec-field="data_recebimento" type="date" value="'+esc(r.data_recebimento)+'" style="'+fieldStyle+'"></label><label style="'+labelStyle+'">SITUAÇÃO<select data-rec-field="status" style="'+fieldStyle+'"><option value="pendente">Pendente</option><option value="recebido">Recebido</option></select></label><button type="button" data-rec-del="'+i+'" title="Excluir parcela" style="width:34px;height:40px;border:1px solid #F2C5C5;border-radius:9px;background:#FFF4F4;color:#C83E3E;font-size:18px;cursor:pointer">×</button></div></div>';}).join('');
      overlay.innerHTML='<div style="width:min(1040px,97vw);max-height:92vh;background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.28);overflow:hidden;display:flex;flex-direction:column"><div style="padding:19px 21px 14px;border-bottom:1px solid #EEE9E5;display:flex;align-items:flex-start;gap:12px"><div style="flex:1"><div style="font-size:19px;font-weight:800;color:#251F1B">Editar venda e recebimentos</div><div style="font-size:12.5px;color:#7C746E;margin-top:4px">Acesso exclusivo do administrador. Corrija valores e datas sem alterar automaticamente outras informações.</div></div><button type="button" data-close style="width:34px;height:34px;border:0;border-radius:10px;background:#F5F2EF;font-size:21px;color:#756C65;cursor:pointer">×</button></div><div style="padding:16px 20px;overflow:auto"><div style="font-size:12px;font-weight:800;color:#5F5751;margin-bottom:10px">DADOS DA VENDA</div><div style="display:grid;grid-template-columns:repeat(3,minmax(150px,1fr));gap:11px;margin-bottom:18px"><label style="'+labelStyle+'">DATA DA VENDA<input data-sale-field="data_venda" type="date" value="'+esc(sale.data_venda)+'" style="'+fieldStyle+'"></label><label style="'+labelStyle+'">VGV (R$)<input data-sale-field="vgv" inputmode="decimal" value="'+esc(sale.vgv)+'" style="'+fieldStyle+'"></label><label style="'+labelStyle+'">COMISSÃO BRUTA (%)<input data-sale-field="percentual_comissao" inputmode="decimal" value="'+esc(sale.percentual_comissao)+'" style="'+fieldStyle+'"></label><label style="'+labelStyle+'">FORMA DE PAGAMENTO<input data-sale-field="forma_pgto" value="'+esc(sale.forma_pgto)+'" placeholder="Ex.: Parcelado" style="'+fieldStyle+'"></label><label style="'+labelStyle+'">STATUS DA VENDA<select data-sale-field="status" style="'+fieldStyle+'"><option value="pendente">Pendente</option><option value="concluido">Concluído</option><option value="pago">Pago</option><option value="distrato">Distrato</option></select></label><label style="'+labelStyle+'">OBSERVAÇÃO<input data-sale-field="obs" value="'+esc(sale.obs)+'" style="'+fieldStyle+'"></label></div><div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><div style="font-size:12px;font-weight:800;color:#5F5751;flex:1">PARCELAS RECEBIDAS PELA IMOBILIÁRIA</div><button type="button" data-rec-add style="height:36px;padding:0 13px;border:1.5px dashed #B783CF;border-radius:9px;background:#FBF4FE;color:#7D1AA8;font-weight:800;cursor:pointer">+ Adicionar parcela</button></div>'+recBody+(rows.length?'':'<div style="padding:18px;border:1px dashed #DDD6D0;border-radius:12px;text-align:center;color:#7C746E;font-size:12.5px">Nenhuma parcela cadastrada.</div>')+'<div style="margin-top:12px;padding:11px 13px;border-radius:10px;background:#FFF4E9;color:#9B4A00;font-size:12px;line-height:1.45"><strong>Importante:</strong> os pagamentos de comissão e indicação continuam sendo editados separadamente na aba Comissões.</div></div><div style="padding:13px 20px;border-top:1px solid #EEE9E5;display:flex;justify-content:flex-end;gap:9px"><button type="button" data-cancel style="height:42px;padding:0 17px;border:1px solid #DDD6D0;border-radius:10px;background:#fff;font-weight:700;cursor:pointer">Cancelar</button><button type="button" data-save style="height:42px;padding:0 18px;border:0;border-radius:10px;background:#FF7000;color:#fff;font-weight:800;cursor:pointer">Revisar e salvar</button></div></div>';
      overlay.querySelector('[data-sale-field="status"]').value=sale.status||'pendente';
      rows.forEach(function(r,i){var el=overlay.querySelector('[data-rec-row="'+i+'"]');if(el){var s=el.querySelector('[data-rec-field="status"]');if(s)s.value=r.status||'pendente';}});
      overlay.querySelector('[data-close]').onclick=close;overlay.querySelector('[data-cancel]').onclick=close;
      overlay.querySelector('[data-rec-add]').onclick=function(){sync();rows.push(fresh());render();};
      overlay.querySelectorAll('[data-rec-del]').forEach(function(btn){btn.onclick=function(){sync();var i=Number(btn.getAttribute('data-rec-del')),r=rows[i];if(r&&r.id)removed.push(r.id);rows.splice(i,1);render();};});
      overlay.querySelector('[data-save]').onclick=async function(){
        sync();var vgv=parseNum(sale.vgv),pc=parseNum(sale.percentual_comissao);
        if(!sale.data_venda||!(vgv>0)||!(pc>=0)){self.showToast('Informe a data da venda, um VGV maior que zero e a comissão.');return;}
        for(var i=0;i<rows.length;i++){var n=Number(rows[i].numero_parcela),val=parseNum(rows[i].valor_total);if(!(n>0)||!(val>0)){self.showToast('Informe o número e um valor maior que zero em todas as parcelas.');return;}if(rows[i].status==='recebido'&&!rows[i].data_recebimento){self.showToast('Informe a data recebida nas parcelas marcadas como recebidas.');return;}rows[i].numero_parcela=n;rows[i].valor_total=val;}
        var soma=rows.reduce(function(a,r){return a+Number(r.valor_total||0);},0),bruta=vgv*(pc/100);
        var resumo='Confirma a atualização desta venda?\\n\\nVGV: R$ '+vgv.toLocaleString('pt-BR',{minimumFractionDigits:2})+'\\nComissão bruta: R$ '+bruta.toLocaleString('pt-BR',{minimumFractionDigits:2})+'\\nTotal das parcelas: R$ '+soma.toLocaleString('pt-BR',{minimumFractionDigits:2})+'\\nParcelas: '+rows.length;
        if(!window.confirm(resumo))return;
        var btn=overlay.querySelector('[data-save]');btn.disabled=true;btn.textContent='Salvando…';
        try{
          var BASE='https://diaegvfveqezispcthwk.supabase.co/rest/v1',H=Object.assign({},self._esteiraHeaders(),{'Content-Type':'application/json',Prefer:'return=representation'});
          var vendaPayload={data_venda:sale.data_venda,vgv:vgv,percentual_comissao:pc/100,forma_pgto:sale.forma_pgto||null,status:sale.status||'pendente',obs:sale.obs||null};
          var rv=await fetch(BASE+'/vendas?id=eq.'+encodeURIComponent(vendaId),{method:'PATCH',headers:H,body:JSON.stringify(vendaPayload)});if(!rv.ok)throw new Error((await rv.text())||'falha ao atualizar a venda');var changed=await rv.json();if(!Array.isArray(changed)||!changed.length)throw new Error('a venda não foi alterada; confirme o acesso de administrador');
          for(var x=0;x<removed.length;x++){var rd=await fetch(BASE+'/recebimentos?id=eq.'+encodeURIComponent(removed[x]),{method:'DELETE',headers:H});if(!rd.ok)throw new Error((await rd.text())||'falha ao excluir parcela');}
          for(var j=0;j<rows.length;j++){var r=rows[j],payload={venda_id:vendaId,numero_parcela:r.numero_parcela,valor_total:r.valor_total,data_prevista:r.data_prevista||null,data_recebimento:r.status==='recebido'?(r.data_recebimento||null):null,status:r.status==='recebido'?'recebido':'pendente'};var url=BASE+'/recebimentos',method='POST';if(r.id){url+='?id=eq.'+encodeURIComponent(r.id);method='PATCH';}var rr=await fetch(url,{method:method,headers:H,body:JSON.stringify(payload)});if(!rr.ok)throw new Error((await rr.text())||'falha ao salvar parcela');}
          close();await self._loadVendasReal();self.showToast('Venda e parcelas atualizadas.');
        }catch(e){btn.disabled=false;btn.textContent='Revisar e salvar';self.showToast('Erro ao salvar: '+(e&&e.message||'erro'));}
      };
    };
    overlay.onclick=function(e){if(e.target===overlay)close();};document.body.appendChild(overlay);render();
  }
  _abrirPagamentosAdmin(vendaId) {
    var self=this, perfil=String((self.state&&self.state.sessionPerfil)||'').toLowerCase();
    if(perfil!=='admin'){ self.showToast('Somente administradores podem editar pagamentos.'); return; }
    var esc=function(v){return String(v==null?'':v).replace(/[&<>\"]/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'})[c];});};
    var moneyVal=function(v){var n=Number(v||0);return n?String(Math.round(n*100)/100):'';};
    var users=(self._usuariosFinanceiro||[]).slice().sort(function(a,b){return String(a.nome||'').localeCompare(String(b.nome||''));});
    var rows=(self._pagamentosComissao||[]).filter(function(x){return String(x.venda_id)===String(vendaId);}).map(function(x){return Object.assign({},x,{valor:moneyVal(x.valor)});});
    var removed=[];
    var overlay=document.createElement('div'); overlay.id='apePagamentoAdmin'; overlay.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(31,28,26,.48);display:flex;align-items:center;justify-content:center;padding:22px;font-family:var(--font-body,Arial)';
    var close=function(){try{overlay.remove();}catch(e){}};
    var fresh=function(){return{id:'',venda_id:vendaId,beneficiario_id:'',papel:'comissao',valor:'',data_pagamento:new Date().toISOString().slice(0,10),status:'pago',observacao:''};};
    if(!rows.length)rows.push(fresh());
    var sync=function(){ overlay.querySelectorAll('[data-pay-row]').forEach(function(el){var i=Number(el.getAttribute('data-pay-row')),r=rows[i];if(!r)return;el.querySelectorAll('[data-field]').forEach(function(inp){r[inp.getAttribute('data-field')]=inp.value;});}); };
    var render=function(){
      var userOpts='<option value="">Selecione quem recebeu</option>'+users.map(function(u){return '<option value="'+esc(u.id)+'">'+esc(u.nome)+(u.role?' · '+esc(u.role):'')+'</option>';}).join('');
      var body=rows.map(function(r,i){return '<div data-pay-row="'+i+'" style="border:1px solid var(--border-soft,#E5E0DB);border-radius:13px;padding:13px;background:#FAF8F6;margin-bottom:10px"><div style="display:grid;grid-template-columns:minmax(190px,1.4fr) minmax(130px,.8fr) minmax(130px,.8fr) minmax(135px,.8fr) minmax(120px,.7fr) 34px;gap:9px;align-items:end"><label style="font-size:10px;font-weight:800;color:#8B837C;letter-spacing:.05em">PAGO PARA<select data-field="beneficiario_id" style="display:block;width:100%;height:39px;margin-top:5px;border:1px solid #DDD6D0;border-radius:9px;background:#fff;padding:0 9px">'+userOpts+'</select></label><label style="font-size:10px;font-weight:800;color:#8B837C;letter-spacing:.05em">CLASSIFICAÇÃO<select data-field="papel" style="display:block;width:100%;height:39px;margin-top:5px;border:1px solid #DDD6D0;border-radius:9px;background:#fff;padding:0 9px"><option value="comissao">Comissão</option><option value="indicacao">Indicação</option></select></label><label style="font-size:10px;font-weight:800;color:#8B837C;letter-spacing:.05em">VALOR (R$)<input data-field="valor" inputmode="decimal" value="'+esc(r.valor)+'" placeholder="0,00" style="display:block;width:100%;height:39px;box-sizing:border-box;margin-top:5px;border:1px solid #DDD6D0;border-radius:9px;background:#fff;padding:0 10px"></label><label style="font-size:10px;font-weight:800;color:#8B837C;letter-spacing:.05em">DATA<input data-field="data_pagamento" type="date" value="'+esc(r.data_pagamento||'')+'" style="display:block;width:100%;height:39px;box-sizing:border-box;margin-top:5px;border:1px solid #DDD6D0;border-radius:9px;background:#fff;padding:0 9px"></label><label style="font-size:10px;font-weight:800;color:#8B837C;letter-spacing:.05em">SITUAÇÃO<select data-field="status" style="display:block;width:100%;height:39px;margin-top:5px;border:1px solid #DDD6D0;border-radius:9px;background:#fff;padding:0 9px"><option value="pago">Pago</option><option value="previsto">Previsto</option></select></label><button type="button" data-del="'+i+'" title="Excluir lançamento" style="width:34px;height:39px;border:1px solid #F2C5C5;border-radius:9px;background:#FFF4F4;color:#C83E3E;font-size:18px;cursor:pointer">×</button></div><label style="display:block;font-size:10px;font-weight:800;color:#8B837C;letter-spacing:.05em;margin-top:10px">OBSERVAÇÃO<input data-field="observacao" value="'+esc(r.observacao||'')+'" placeholder="Ex.: 1ª parcela da comissão" style="display:block;width:100%;height:38px;box-sizing:border-box;margin-top:5px;border:1px solid #DDD6D0;border-radius:9px;background:#fff;padding:0 10px"></label></div>';}).join('');
      overlay.innerHTML='<div style="width:min(1000px,96vw);max-height:90vh;background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.28);overflow:hidden;display:flex;flex-direction:column"><div style="padding:19px 21px 14px;border-bottom:1px solid #EEE9E5;display:flex;align-items:flex-start;gap:12px"><div style="flex:1"><div style="font-size:19px;font-weight:800;color:#251F1B">Pagamentos de comissão e indicação</div><div style="font-size:12.5px;color:#7C746E;margin-top:4px">Somente administradores editam. Registre cada parcela separadamente para preservar valores, datas e beneficiários.</div></div><button type="button" data-close style="width:34px;height:34px;border:0;border-radius:10px;background:#F5F2EF;font-size:21px;color:#756C65;cursor:pointer">×</button></div><div style="padding:16px 20px;overflow:auto">'+body+'<button type="button" data-add style="height:40px;padding:0 14px;border:1.5px dashed #B783CF;border-radius:10px;background:#FBF4FE;color:#7D1AA8;font-weight:800;cursor:pointer">+ Adicionar parcela ou pagamento</button></div><div style="padding:13px 20px;border-top:1px solid #EEE9E5;display:flex;justify-content:flex-end;gap:9px"><button type="button" data-cancel style="height:42px;padding:0 17px;border:1px solid #DDD6D0;border-radius:10px;background:#fff;font-weight:700;cursor:pointer">Cancelar</button><button type="button" data-save style="height:42px;padding:0 18px;border:0;border-radius:10px;background:#FF7000;color:#fff;font-weight:800;cursor:pointer">Salvar pagamentos</button></div></div>';
      rows.forEach(function(r,i){var el=overlay.querySelector('[data-pay-row="'+i+'"]');if(!el)return;['beneficiario_id','papel','status'].forEach(function(k){var inp=el.querySelector('[data-field="'+k+'"]');if(inp)inp.value=r[k]||'';});});
      overlay.querySelector('[data-close]').onclick=close; overlay.querySelector('[data-cancel]').onclick=close;
      overlay.querySelector('[data-add]').onclick=function(){sync();rows.push(fresh());render();};
      overlay.querySelectorAll('[data-del]').forEach(function(btn){btn.onclick=function(){sync();var i=Number(btn.getAttribute('data-del')),r=rows[i];if(r&&r.id)removed.push(r.id);rows.splice(i,1);if(!rows.length)rows.push(fresh());render();};});
      overlay.querySelector('[data-save]').onclick=async function(){
        sync(); var valid=rows.filter(function(r){return r.beneficiario_id||r.valor||r.observacao;});
        for(var i=0;i<valid.length;i++){var val=Number(String(valid[i].valor||'').replace(',','.'));if(!valid[i].beneficiario_id||!(val>0)){self.showToast('Informe quem recebeu e um valor maior que zero.');return;}valid[i].valor=val;if(valid[i].status==='pago'&&!valid[i].data_pagamento)valid[i].data_pagamento=new Date().toISOString().slice(0,10);}
        var btn=overlay.querySelector('[data-save]');btn.disabled=true;btn.textContent='Salvando…';
        try{
          var BASE='https://diaegvfveqezispcthwk.supabase.co/rest/v1',H=Object.assign({},self._esteiraHeaders(),{'Content-Type':'application/json',Prefer:'return=representation'});
          for(var d=0;d<removed.length;d++){var rd=await fetch(BASE+'/pagamentos_comissao?id=eq.'+encodeURIComponent(removed[d]),{method:'DELETE',headers:H});if(!rd.ok)throw new Error('não foi possível excluir um pagamento');}
          for(var j=0;j<valid.length;j++){var r=valid[j],payload={venda_id:vendaId,beneficiario_id:r.beneficiario_id,papel:r.papel==='indicacao'?'indicacao':'comissao',valor:r.valor,data_pagamento:r.data_pagamento||null,status:r.status==='previsto'?'previsto':'pago',observacao:r.observacao||null,updated_at:new Date().toISOString()};var url=BASE+'/pagamentos_comissao',method='POST';if(r.id){url+='?id=eq.'+encodeURIComponent(r.id);method='PATCH';}var rs=await fetch(url,{method:method,headers:H,body:JSON.stringify(payload)});if(!rs.ok){var msg=await rs.text();throw new Error(msg||'falha ao salvar pagamento');}}
          close();await self._loadVendasReal();self.showToast('Pagamentos atualizados.');
        }catch(e){btn.disabled=false;btn.textContent='Salvar pagamentos';self.showToast('Erro ao salvar: '+(e&&e.message||'erro'));}
      };
    };
    overlay.onclick=function(e){if(e.target===overlay)close();};document.body.appendChild(overlay);render();
  }
`;
if (!template.includes(personHelperAnchor)) throw new Error("Normalização de nomes do Financeiro não encontrada.");
template = template.replace(personHelperAnchor, personHelpers + personHelperAnchor);

const personReplacements = [
  ["this.vendas.filter(v => v.corretor === meuNomeFin || v.parceiro === meuNomeFin)", "this.vendas.filter(v => this._samePerson(v.corretor, meuNomeFin) || this._samePerson(v.parceiro, meuNomeFin))"],
  ["calcAll.filter(c => c.v.corretor === meuNomeFin || c.v.parceiro === meuNomeFin)", "calcAll.filter(c => this._samePerson(c.v.corretor, meuNomeFin) || this._samePerson(c.v.parceiro, meuNomeFin))"],
  ["vendasReg.filter(v => v.corretor === meuNomeFin || v.parceiro === meuNomeFin)", "vendasReg.filter(v => this._samePerson(v.corretor, meuNomeFin) || this._samePerson(v.parceiro, meuNomeFin))"],
  ["c.parts.filter(p => !p.isImob && p.nome === meuNomeFin)", "c.parts.filter(p => !p.isImob && this._personIncluded(p.nome, meuNomeFin))"],
  ["c.parts.find(p => !p.isImob && p.nome === meuNomeFin)", "c.parts.find(p => !p.isImob && this._personIncluded(p.nome, meuNomeFin))"],
  ["rows.find(r => r.nome === meuNomeFin)", "rows.find(r => this._samePerson(r.nome, meuNomeFin))"],
  ["r.nome === meuNomeFin", "this._samePerson(r.nome, meuNomeFin)"],
];
for (const [before, after] of personReplacements) {
  if (!template.includes(before)) throw new Error(`Comparação de corretor não encontrada: ${before}`);
  template = template.replaceAll(before, after);
}

const financeGoalLookup = "    const metaDe = (nome) => metaMap[nome] || 3000000;";
if (!template.includes(financeGoalLookup)) throw new Error("Metas do Financeiro não encontradas.");
template = template.replace(financeGoalLookup, "    const metaDe = (nome) => { const k = Object.keys(metaMap).find(x => this._samePerson(x, nome)); return Number(k ? metaMap[k] : 3000000) || 3000000; };");

template = template.replace(
  "self.showToast(_pf==='Admin'?'Vendas: 0 registros retornados do banco.':'Vendas/Financeiro visivel apenas para Admin.');",
  "self.showToast(_pf==='Admin'?'Vendas: 0 registros retornados do banco.':'Nenhuma venda associada a este corretor.');",
);

// O Financeiro legado já tinha a interface correta, mas descartava o UUID da
// venda e transformava todo recebimento em uma parcela fictícia. Mantemos o
// desenho original e reconectamos venda, comissão do corretor e parcelas reais.
const legacyVendaId = "    return { id: i + 1, cliente: empr, produto: empr, unidade: unid,";
if (!template.includes(legacyVendaId)) throw new Error("Identificador legado da venda não encontrado.");
template = template.replace(legacyVendaId, "    return { id: a[9] || (i + 1), cliente: empr, produto: empr, unidade: unid,");

const buildVendasXEnd = "    try{ this.setState({ vendasX: VX }); }catch(e){}\n  }\n  async _loadVendasReal(){";
if (!template.includes(buildVendasXEnd)) throw new Error("Montagem financeira das vendas não encontrada.");
template = template.replace(buildVendasXEnd, "    try{ this.setState({ vendasX: VX }); }catch(e){}\n    return VX;\n  }\n  async _loadVendasReal(){");

const vendasLoaderPattern = /  async _loadVendasReal\(\)\{[\s\S]*?\n  _loadDashKpis\(\)\{/;
if (!vendasLoaderPattern.test(template)) throw new Error("Carregador de vendas do Financeiro não encontrado.");
const vendasLoader = `  async _loadVendasReal(){
    var self=this;
    var BASE='https://diaegvfveqezispcthwk.supabase.co/rest/v1';
    var HH=self._esteiraHeaders();
    function fmt(d){ if(!d)return '—'; var p=String(d).slice(0,10).split('-'); return p.length===3?(p[2]+'/'+p[1]+'/'+p[0]):String(d); }
    function get(path){ return fetch(BASE+path,{headers:HH}).then(function(r){ if(!r.ok) throw new Error(path.split('?')[0]+' '+r.status); return r.json(); }); }
    try{
      const res=await Promise.all([
        get('/v_vendas_detalhe?select=id,data_venda,empreendimento,bairro,unidade,corretores,vgv,percentual_comissao,comissao_bruta,comissao_corretores,comissao_executivo,comissao_apecerto,indicacao,forma_pgto,status,obs&order=data_venda.desc'),
        get('/recebimentos?select=id,venda_id,numero_parcela,valor_total,data_prevista,data_recebimento,status&order=data_prevista.asc.nullslast,numero_parcela.asc'),
        get('/comissoes?select=id,venda_id,beneficiario_id,papel,valor_final'),
        get('/venda_corretores?select=venda_id,corretor_id,corretor_nome,fracao,eh_indicador'),
        get('/pagamentos_comissao?select=id,venda_id,comissao_id,beneficiario_id,papel,valor,data_pagamento,status,observacao,created_at&order=data_pagamento.desc.nullslast,created_at.desc'),
        get('/usuarios?select=id,nome,role&ativo=eq.true&order=nome')
      ]);
      const rows=res[0]||[], recRows=res[1]||[], comRows=res[2]||[], vincRows=res[3]||[], payRows=res[4]||[], userRows=res[5]||[];
      self._pagamentosComissao=payRows;
      self._usuariosFinanceiro=userRows;
      if(!Array.isArray(rows)) throw new Error('payload vendas');
      const isBroker=String((self.state&&self.state.sessionPerfil)||'').toLowerCase()==='corretor';
      const meuNome=(self.state&&self.state.sessionNome)||'';
      const meuUserId=(self._authUser&&self._authUser.id)||'';
      const V0=rows.map(function(v){
        return [fmt(v.data_venda), v.empreendimento||'—', v.unidade||'', v.corretores||'', Number(v.vgv||0), Number(v.comissao_bruta||0), Number(v.comissao_corretores||0), v.status||'pendente',
          { bruta:Number(v.comissao_bruta||0), corretores:Number(v.comissao_corretores||0), executivo:Number(v.comissao_executivo||0), apecerto:Number(v.comissao_apecerto||0), indicacao:Number(v.indicacao||0), bairro:v.bairro||'', formaPgto:v.forma_pgto||'' }, String(v.id)];
      });
      self.vendas=V0.map(function(a,i){return self._mapVenda(a,i);});
      var VX=self._buildVendasX()||{};
      self.vendas.forEach(function(v){
        var d=VX[v.id]; if(!d)return;
        var source=rows.find(function(x){return String(x.id)===String(v.id);})||{};
        var recs=recRows.filter(function(x){return String(x.venda_id)===String(v.id);});
        d._sourceVenda=source;
        d._recebimentosRaw=recs;
        d._pagamentos=payRows.filter(function(x){return String(x.venda_id)===String(v.id);});
        d._liquidada=String(source.status||'').toLowerCase()==='pago';
        d._semRecebimentoValor=false;
        if(recs.length){
          d.recebimentos=recs.map(function(r){ var recebido=String(r.status||'').toLowerCase()==='recebido'||!!r.data_recebimento; return { parcela:String(r.numero_parcela||'Única'), prev:Number(r.valor_total||0), recebido:recebido?Number(r.valor_total||0):0, dataPrev:fmt(r.data_prevista), dataReceb:recebido?fmt(r.data_recebimento||r.data_prevista):'—', conta:'—', forma:v.pgto||'—', status:recebido?'Recebido':'Previsto' }; });
        } else {
          var quitada=String(source.status||'').toLowerCase()==='pago';
          var total=Number(source.comissao_bruta||0);
          d._semRecebimentoValor=total<=0;
          d.recebimentos=total>0?[{ parcela:'Única', prev:total, recebido:quitada?total:0, dataPrev:quitada?v.data:'a definir', dataReceb:quitada?v.data:'—', conta:'—', forma:v.pgto||'—', status:quitada?'Recebido':'Previsto' }]:[];
        }
        if(isBroker){
          var meusVinc=vincRows.filter(function(x){return String(x.venda_id)===String(v.id) && self._samePerson(x.corretor_nome,meuNome);});
          var fracao=meusVinc.reduce(function(a,x){return a+Number(x.fracao||0);},0);
          var exata=meuUserId?comRows.filter(function(x){return String(x.venda_id)===String(v.id) && String(x.beneficiario_id||'')===String(meuUserId);}).reduce(function(a,x){return a+Number(x.valor_final||0);},0):0;
          var minha=exata>0?exata:(Number(source.comissao_corretores||0)*fracao);
          var bruta=Number(source.comissao_bruta||0);
          var pct=bruta>0?Math.max(0,Math.min(100,minha/bruta*100)):0;
          d.participantes=[
            {nome:meuNome||v.corretor||'Corretor',funcao:'Corretor',valorReal:minha,pct:pct,pago:false},
            {nome:'apêcerto (imobiliária)',funcao:'Imobiliária',valorReal:Math.max(0,bruta-minha),pct:Math.max(0,100-pct),pago:true}
          ];
          v._minhaComissao=minha;
          v._fracao=meusVinc.length?fracao:1;
          v._vgvAtribuido=Number(v.vgv||0)*v._fracao;
          d._meusPagamentos=d._pagamentos.filter(function(x){return String(x.beneficiario_id||'')===String(meuUserId);});
          d._meuPagoReal=d._meusPagamentos.length?d._meusPagamentos.filter(function(x){return String(x.status||'').toLowerCase()==='pago';}).reduce(function(a,x){return a+Number(x.valor||0);},0):null;
          v._ehIndicacao=d._meusPagamentos.length?d._meusPagamentos.some(function(x){return String(x.papel||'').toLowerCase()==='indicacao';}):(meuUserId?comRows.some(function(x){return String(x.venda_id)===String(v.id) && String(x.beneficiario_id||'')===String(meuUserId) && String(x.papel||'').toLowerCase()==='indicacao';}):meusVinc.some(function(x){return x.eh_indicador===true;}));
        }
      });
      self.vendasErro=false;
      self.setState({ vendasX:VX });
      if(!rows.length){ var _pf=(self.state&&self.state.sessionPerfil)||''; self.showToast(_pf==='Admin'?'Vendas: 0 registros retornados do banco.':'Nenhuma venda associada a este corretor.'); }
    }catch(err){ self.vendasErro=true; try{ if(window.console)console.warn('[vendas] '+(err&&err.message)); }catch(e){} try{ self.showToast('Vendas não carregaram: '+(err&&err.message||'erro')); self.setState({}); }catch(e){} }
  }
  _loadDashKpis(){`;
template = template.replace(vendasLoaderPattern, vendasLoader);

const brokerFinanceSummary = "      let comPaga = 0, comReceber = 0;\n      const minhasParcelas = [];\n      minhas.forEach(c => { c.parts.filter(p => !p.isImob && this._personIncluded(p.nome, meuNomeFin)).forEach(p => { comPaga += p.pago; comReceber += p.saldo; if (p.saldo > 0.5) minhasParcelas.push({ venda: c.v.produto, unidade: 'Unid. ' + c.v.unidade, valorFmt: money(p.saldo), venc: (c.d.recebimentos.find(r => r.status !== 'Recebido') || {}).dataPrev || c.v.data, funcao: p.funcao }); }); });";
const brokerFinanceSummaryConnected = `      let comPaga = 0, comReceber = 0;
      const minhasParcelas = [];
      minhas.forEach(c => {
        const p=c.parts.find(x => !x.isImob && this._personIncluded(x.nome, meuNomeFin)); if(!p)return;
        comPaga += p.recebido; comReceber += Math.max(0,p.previsto-p.recebido);
        (c.d.recebimentos||[]).forEach(r => { if(r.status==='Recebido')return; const share=c.previstoTotal>0?p.previsto*(Number(r.prev||0)/c.previstoTotal):0; if(share>0.005) minhasParcelas.push({ venda:c.v.produto, unidade:'Unid. '+c.v.unidade, valorFmt:money(share), venc:r.dataPrev||'a definir', funcao:p.funcao }); });
      });`;
if (!template.includes(brokerFinanceSummary)) throw new Error("Resumo pessoal do Financeiro não encontrado.");
template = template.replace(brokerFinanceSummary, brokerFinanceSummaryConnected);
template = template.replace("      const minhas = calcAll.filter(c => this._samePerson(c.v.corretor, meuNomeFin) || this._samePerson(c.v.parceiro, meuNomeFin));", "      const minhas = calcAll.filter(c => c.v._minhaComissao != null);");

const brokerStatsLogic = "      const cStats = (arr) => { const vgv = arr.reduce((a, c) => a + c.v.vgv, 0); const n = arr.length; let paga = 0, pend = 0; arr.forEach(c => c.parts.filter(p => !p.isImob && this._personIncluded(p.nome, meuNomeFin)).forEach(p => { paga += p.pago; pend += p.saldo; })); return { vgv: vgv, n: n, ticket: n ? vgv / n : 0, comGerada: arr.reduce((a, c) => a + c.comBruta, 0), paga: paga, pend: pend }; };";
const brokerStatsConnected = `      const cStats = (arr) => { const vgv = arr.reduce((a, c) => a + c.v.vgv, 0); const n = arr.length; let gerada = 0, paga = 0, pend = 0; arr.forEach(c => { const p=c.parts.find(x => !x.isImob && this._personIncluded(x.nome, meuNomeFin)); if(!p)return; gerada+=p.previsto; paga+=p.recebido; pend+=Math.max(0,p.previsto-p.recebido); }); return { vgv:vgv, n:n, ticket:n?vgv/n:0, comGerada:gerada, paga:paga, pend:pend }; };`;
if (!template.includes(brokerStatsLogic)) throw new Error("Indicadores pessoais do Financeiro não encontrados.");
template = template.replace(brokerStatsLogic, brokerStatsConnected);
template = template.replace("      const minhasC = calcAll.filter(c => this._samePerson(c.v.corretor, meuNomeFin) || this._samePerson(c.v.parceiro, meuNomeFin));", "      const minhasC = calcAll.filter(c => c.v._minhaComissao != null);");

template = template.replace("      const meuVgvMes = noMes.reduce((a, c) => a + c.v.vgv, 0);\n      const meuVgvAno = minhas.reduce((a, c) => a + c.v.vgv, 0);", "      const meuVgvMes = noMes.reduce((a, c) => a + (c.v._vgvAtribuido != null ? c.v._vgvAtribuido : c.v.vgv), 0);\n      const meuVgvAno = minhas.reduce((a, c) => a + (c.v._vgvAtribuido != null ? c.v._vgvAtribuido : c.v.vgv), 0);");
template = template.replace("const myEvo = allMonths.map(m => minhas.filter(c => mesNum(c.v.data) === m).reduce((a, c) => a + c.v.vgv, 0));", "const myEvo = allMonths.map(m => minhas.filter(c => mesNum(c.v.data) === m).reduce((a, c) => a + (c.v._vgvAtribuido != null ? c.v._vgvAtribuido : c.v.vgv), 0));");
template = template.replace(brokerStatsConnected, brokerStatsConnected.replace("a + c.v.vgv", "a + (c.v._vgvAtribuido != null ? c.v._vgvAtribuido : c.v.vgv)"));

const financeReceiptRatio = "    const ratio = previstoTotal > 0 ? Math.min(1, recebidoTotal / previstoTotal) : 0;";
if (!template.includes(financeReceiptRatio)) throw new Error("Cálculo de liquidação financeira não encontrado.");
template = template.replace(financeReceiptRatio, "    const ratio = d._liquidada ? 1 : (previstoTotal > 0 ? Math.min(1, recebidoTotal / previstoTotal) : 0);");

const financeParticipantReceipt = `      const recebido = previsto * ratio;
      const isImob = p.funcao === 'Imobiliária';
      const pago = isImob ? recebido : (p.pago ? recebido : 0);`;
const financeParticipantReceiptConnected = `      const isImob = p.funcao === 'Imobiliária';
      const recebidoBase = previsto * ratio;
      const recebido = (!isImob && d._meuPagoReal != null) ? Math.min(previsto, Math.max(0, Number(d._meuPagoReal) || 0)) : recebidoBase;
      const pago = (!isImob && d._meuPagoReal != null) ? recebido : (isImob ? recebido : (p.pago ? recebido : 0));`;
if (!template.includes(financeParticipantReceipt)) throw new Error("Cálculo de pagamento do participante não encontrado.");
template = template.replace(financeParticipantReceipt, financeParticipantReceiptConnected);
template = template.replace("const kpi4 = (s) => [ { label: 'VGV vendido'", "const kpi4 = (s) => [ { label: 'VGV atribuído'");
template = template.replace("mp[k].vgv += c.v.vgv; mp[k].n++; mp[k].com += c.comBruta;", "mp[k].vgv += (c.v._vgvAtribuido != null ? c.v._vgvAtribuido : c.v.vgv); mp[k].n++; const pp=c.parts.find(x => !x.isImob && this._personIncluded(x.nome, meuNomeFin)); mp[k].com += pp ? pp.previsto : 0;");
template = template.replace("vgv: a.reduce((x, c) => x + c.v.vgv, 0), com: a.reduce((x, c) => x + c.comBruta, 0)", "vgv: a.reduce((x, c) => x + (c.v._vgvAtribuido != null ? c.v._vgvAtribuido : c.v.vgv), 0), com: a.reduce((x, c) => { const p=c.parts.find(pp => !pp.isImob && this._personIncluded(pp.nome, meuNomeFin)); return x+(p?p.previsto:0); }, 0)");

const brokerVendaRows = "      const vendaRows = (arr) => arr.slice().sort((a, b) => (mesNum(a.v.data) - mesNum(b.v.data)) || (parseInt(a.v.data) - parseInt(b.v.data))).map(c => ({ data: c.v.data, empreendimento: c.v.produto, unidade: c.v.unidade, cliente: c.v.cliente, vgvFmt: money(c.v.vgv), comFmt: money(c.comBruta), onOpen: () => this.setState({ selectedVenda: c.v.id, vendaTab: 'dados' }) }));";
const brokerVendaRowsConnected = `      const vendaRows = (arr) => arr.slice().sort((a,b) => String(b.v.data).localeCompare(String(a.v.data))).map(c => { const p=c.parts.find(x => !x.isImob && this._personIncluded(x.nome, meuNomeFin)); const previsto=p?p.previsto:0, recebido=p?p.recebido:0; return { data:c.v.data, empreendimento:c.v.produto, unidade:c.v.unidade||'—', cliente:c.v.cliente, vgvFmt:money(c.v._vgvAtribuido != null ? c.v._vgvAtribuido : c.v.vgv), comFmt:money(previsto), recebidoFmt:money(recebido), receberFmt:money(Math.max(0,previsto-recebido)), onOpen:() => this.setState({ selectedVenda:c.v.id, vendaTab:'recebimentos' }) }; });`;
if (!template.includes(brokerVendaRows)) throw new Error("Lista pessoal de vendas não encontrada.");
template = template.replace(brokerVendaRows, brokerVendaRowsConnected);

template = template.replace("recCorrTotalFmt: money(meuPartPrev), recCorrPagoFmt: money(meuPartPago), recCorrSaldoFmt: money(meuPartSaldo)", "recCorrTotalFmt: money(meuPartPrev), recCorrPagoFmt: money(meuPart ? meuPart.recebido : 0), recCorrSaldoFmt: money(Math.max(0, meuPartPrev - (meuPart ? meuPart.recebido : 0))), semRecebimento: d._semRecebimentoValor === true");
template = template.replace("return { parcela: r.parcela, dataPrev: r.dataPrev, valorFmt: money(share), status: rec ? 'Recebido' : 'Previsto'", "return { parcela: r.parcela, dataPrev: r.dataPrev, quando: rec ? ('Recebido em ' + (r.dataReceb || r.dataPrev)) : ('Previsto para ' + r.dataPrev), valorFmt: money(share), status: rec ? 'Recebido' : 'Previsto'");
template = template.replace("<div style=\"font-size:12px; color:var(--fg-3);\">venc. {{ r.dataPrev }}</div>", "<div style=\"font-size:12px; color:var(--fg-3);\">{{ r.quando }}</div>");

const brokerReceiptRows = `        const recCorr = (finCorretor && meuPart) ? d.recebimentos.map(r => { const share = c.previstoTotal > 0 ? Math.round(meuPartPrev * ((Number(r.prev) || 0) / c.previstoTotal)) : 0; const rec = r.status === 'Recebido'; return { parcela: r.parcela, dataPrev: r.dataPrev, quando: rec ? ('Recebido em ' + (r.dataReceb || r.dataPrev)) : ('Previsto para ' + r.dataPrev), valorFmt: money(share), status: rec ? 'Recebido' : 'Previsto', statusStyle: rec ? statusPill('#1FA85A', 'var(--success-bg)') : statusPill('#2F6FED', '#E4EDFB') }; }) : [];`;
const brokerReceiptRowsConnected = `        const recCorr = (finCorretor && meuPart) ? ((d._meusPagamentos && d._meusPagamentos.length) ? d._meusPagamentos.map((r, i) => { const rec=String(r.status||'').toLowerCase()==='pago'; return { parcela:String(i+1), dataPrev:r.data_pagamento||'a definir', quando:rec?('Pago em '+(r.data_pagamento||'data não informada')):('Previsto para '+(r.data_pagamento||'data não informada')), valorFmt:money(Number(r.valor)||0), status:rec?'Pago':'Previsto', statusStyle:rec?statusPill('#1FA85A','var(--success-bg)'):statusPill('#2F6FED','#E4EDFB') }; }) : d.recebimentos.map(r => { const share = c.previstoTotal > 0 ? Math.round(meuPartPrev * ((Number(r.prev) || 0) / c.previstoTotal)) : 0; const rec = r.status === 'Recebido'; return { parcela:r.parcela, dataPrev:r.dataPrev, quando:rec?('Recebido pela imobiliária em '+(r.dataReceb||r.dataPrev)):('Previsão baseada no recebimento da venda: '+r.dataPrev), valorFmt:money(share), status:rec?'Disponível':'Previsto', statusStyle:rec?statusPill('#1FA85A','var(--success-bg)'):statusPill('#2F6FED','#E4EDFB') }; })) : [];`;
if (!template.includes(brokerReceiptRows)) throw new Error("Parcelas pessoais do corretor não encontradas.");
template = template.replace(brokerReceiptRows, brokerReceiptRowsConnected);

const brokerReceiptListEnd = `              </sc-for>
            </sc-if>
            <sc-if value="{{ notCorretorView }}" hint-placeholder-val="{{ true }}">`;
const brokerReceiptListEndConnected = `              </sc-for>
              <sc-if value="{{ vd.semRecebimento }}" hint-placeholder-val="{{ false }}"><div style="padding:18px; border:1px dashed var(--border-soft); border-radius:12px; color:var(--fg-3); font-size:13px; text-align:center;">Valor e calendário de recebimento ainda não cadastrados para esta venda.</div></sc-if>
            </sc-if>
            <sc-if value="{{ notCorretorView }}" hint-placeholder-val="{{ true }}">`;
if (!template.includes(brokerReceiptListEnd)) throw new Error("Lista de recebimentos do corretor não encontrada.");
template = template.replace(brokerReceiptListEnd, brokerReceiptListEndConnected);

const vendaDrawerCloseButton = '<button type="button" onclick="{{ closeVenda }}" style="width:36px; height:36px; border-radius:50%; border:none; background:var(--bg-sunken); color:var(--fg-2); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0;"><span style="font-size:19px; display:inline-flex;">{{ icons.x }}</span></button>';
const vendaDrawerAdminActions = '<sc-if value="{{ vd.canEditFinanceiro }}" hint-placeholder-val="{{ false }}"><button type="button" onclick="{{ vd.onEditarFinanceiro }}" style="height:36px;padding:0 13px;border:1px solid #E1B8F2;border-radius:10px;background:#FBF4FE;color:#7D1AA8;font-family:var(--font-body);font-weight:800;font-size:12px;cursor:pointer;white-space:nowrap;">Editar venda e parcelas</button></sc-if>' + vendaDrawerCloseButton;
if (!template.includes(vendaDrawerCloseButton)) throw new Error("Botão de fechamento do detalhe da venda não encontrado.");
template = template.replace(vendaDrawerCloseButton, vendaDrawerAdminActions);

const vendaDrawerViewModel = "          cliente: v.cliente, produto: v.produto, unidade: v.unidade, status: v.status, statusStyle: vendaStatusMap[v.status] || vendaStatusMap['Aguardando'],";
const vendaDrawerViewModelAdmin = "          cliente: v.cliente, produto: v.produto, unidade: v.unidade, status: v.status, statusStyle: vendaStatusMap[v.status] || vendaStatusMap['Aguardando'], canEditFinanceiro: String((st.sessionPerfil||'')).toLowerCase()==='admin', onEditarFinanceiro: () => this._abrirVendaFinanceiroAdmin(svId),";
if (!template.includes(vendaDrawerViewModel)) throw new Error("Dados principais do detalhe da venda não encontrados.");
template = template.replace(vendaDrawerViewModel, vendaDrawerViewModelAdmin);

const adminCommissionMarkup = `          <sc-if value="{{ vd.isComissoes }}" hint-placeholder-val="{{ false }}">
            <sc-for list="{{ vd.comR }}" as="p" hint-placeholder-count="4">`;
const adminCommissionMarkupConnected = `          <sc-if value="{{ vd.isComissoes }}" hint-placeholder-val="{{ false }}">
            <div style="display:flex;align-items:center;gap:12px;padding:14px 15px;margin-bottom:12px;border:1px solid #E7CDF3;border-radius:13px;background:linear-gradient(135deg,#FBF4FE,#FFF7F1);"><div style="flex:1;"><div style="font-weight:800;font-size:14px;">Pagamentos aos beneficiários</div><div style="font-size:12px;color:var(--fg-3);margin-top:3px;">Edite valores pagos, destinatário e classifique cada lançamento como comissão ou indicação.</div></div><button type="button" onclick="{{ vd.onEditarPagamentos }}" style="height:39px;padding:0 15px;border:0;border-radius:10px;background:var(--ape-purple);color:#fff;font-family:var(--font-body);font-weight:800;font-size:12.5px;cursor:pointer;">Editar pagamentos</button></div>
            <sc-for list="{{ vd.comR }}" as="p" hint-placeholder-count="4">`;
if (!template.includes(adminCommissionMarkup)) throw new Error("Aba administrativa de comissões não encontrada.");
template = template.replace(adminCommissionMarkup, adminCommissionMarkupConnected);

const adminCommissionViewModel = `          comR: c.parts.map(p => ({ nome: p.nome, funcao: p.funcao, funcaoStyle: fBadge(p.funcao), previstoFmt: money(p.previsto), recebidoFmt: money(p.recebido), pagoFmt: money(p.pago), saldoFmt: money(p.saldo), canPay: !p.isImob && p.saldo > 0.5, pagoFlag: p.pago && !p.isImob, isImob: p.isImob, onPagar: () => this.togglePartPago(svId, p.i) })),`;
const adminCommissionViewModelConnected = `          comR: c.parts.map(p => ({ nome: p.nome, funcao: p.funcao, funcaoStyle: fBadge(p.funcao), previstoFmt: money(p.previsto), recebidoFmt: money(p.recebido), pagoFmt: money(p.pago), saldoFmt: money(p.saldo), canPay: !p.isImob && p.saldo > 0.5, pagoFlag: p.pago && !p.isImob, isImob: p.isImob, onPagar: () => this.togglePartPago(svId, p.i) })), onEditarPagamentos: () => this._abrirPagamentosAdmin(svId),`;
if (!template.includes(adminCommissionViewModel)) throw new Error("Dados da aba administrativa de comissões não encontrados.");
template = template.replace(adminCommissionViewModel, adminCommissionViewModelConnected);

// Nas quatro visões do corretor, a tabela passa a responder diretamente às
// perguntas: quanto vendeu, quanto recebeu e quanto ainda vai receber.
const brokerTableHeader = '<div style="display:grid; grid-template-columns:0.7fr 1.6fr 0.8fr 1.4fr 1fr 1fr; gap:12px; padding:10px 22px; background:var(--bg-sunken); font-size:11px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:var(--fg-3);"><span>Data</span><span>Empreendimento</span><span>Unidade</span><span>Cliente</span><span style="text-align:right;">VGV</span><span style="text-align:right;">Comissão</span></div>';
const brokerTableHeaderConnected = '<div style="display:grid; grid-template-columns:0.7fr 1.55fr 0.7fr 1fr 1fr 1fr 1fr; gap:12px; padding:10px 22px; background:var(--bg-sunken); font-size:11px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:var(--fg-3);"><span>Data</span><span>Empreendimento</span><span>Unidade</span><span style="text-align:right;">VGV</span><span style="text-align:right;">Minha comissão</span><span style="text-align:right;">Recebido</span><span style="text-align:right;">A receber</span></div>';
if (!template.includes(brokerTableHeader)) throw new Error("Cabeçalho das vendas do corretor não encontrado.");
template = template.replaceAll(brokerTableHeader, brokerTableHeaderConnected);
const brokerTableRow = '<div onclick="{{ v.onOpen }}" class="cc-card" style="display:grid; grid-template-columns:0.7fr 1.6fr 0.8fr 1.4fr 1fr 1fr; gap:12px; padding:13px 22px; border-top:1px solid var(--border-soft); align-items:center; font-size:13.5px; cursor:pointer;"><span style="color:var(--fg-3);">{{ v.data }}</span><span style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ v.empreendimento }}</span><span style="color:var(--fg-2);">{{ v.unidade }}</span><span style="color:var(--fg-2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ v.cliente }}</span><span style="text-align:right; font-weight:700; color:var(--ape-orange);">{{ v.vgvFmt }}</span><span style="text-align:right; font-weight:600;">{{ v.comFmt }}</span></div>';
const brokerTableRowConnected = '<div onclick="{{ v.onOpen }}" class="cc-card" style="display:grid; grid-template-columns:0.7fr 1.55fr 0.7fr 1fr 1fr 1fr 1fr; gap:12px; padding:13px 22px; border-top:1px solid var(--border-soft); align-items:center; font-size:13.5px; cursor:pointer;"><span style="color:var(--fg-3);">{{ v.data }}</span><span style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ v.empreendimento }}</span><span style="color:var(--fg-2);">{{ v.unidade }}</span><span style="text-align:right; font-weight:700; color:var(--ape-orange);">{{ v.vgvFmt }}</span><span style="text-align:right; font-weight:600;">{{ v.comFmt }}</span><span style="text-align:right; font-weight:700; color:#1FA85A;">{{ v.recebidoFmt }}</span><span style="text-align:right; font-weight:700; color:#C77400;">{{ v.receberFmt }}</span></div>';
if (!template.includes(brokerTableRow)) throw new Error("Linhas das vendas do corretor não encontradas.");
template = template.replaceAll(brokerTableRow, brokerTableRowConnected);

const dashboardSalesTitle = '<div style="display:flex; align-items:center; gap:10px; padding:16px 20px 12px;"><span style="font-weight:700; font-size:15px; flex:1;">Minhas vendas · {{ corretorFin.mesLabel }}</span><button type="button" onclick="{{ goMesAtual }}" style="border:none; background:transparent; color:var(--ape-orange-700); font-family:var(--font-body); font-weight:700; font-size:12.5px; cursor:pointer;">ver todas →</button></div>';
if (!template.includes(dashboardSalesTitle)) throw new Error("Título das vendas no painel do corretor não encontrado.");
template = template.replace(dashboardSalesTitle, '<div style="display:flex; align-items:center; gap:10px; padding:16px 20px 12px;"><span style="font-weight:700; font-size:15px; flex:1;">Minhas vendas · {{ corrModos.anual.totalVendasTxt }}</span><button type="button" onclick="{{ goHistorico }}" style="border:none; background:transparent; color:var(--ape-orange-700); font-family:var(--font-body); font-weight:700; font-size:12.5px; cursor:pointer;">ver histórico →</button></div>');
template = template.replace('<sc-if value="{{ corrModos.mesAtual.semVendas }}" hint-placeholder-val="{{ false }}"><div style="padding:22px 20px; text-align:center; color:var(--fg-3); font-size:13px;">Nenhuma venda neste mês.</div></sc-if>', '<sc-if value="{{ corrModos.anual.semVendas }}" hint-placeholder-val="{{ false }}"><div style="padding:22px 20px; text-align:center; color:var(--fg-3); font-size:13px;">Nenhuma venda associada ao seu usuário.</div></sc-if>');
template = template.replace('<sc-for list="{{ corrModos.mesAtual.vendas }}" as="v" hint-placeholder-count="3">', '<sc-for list="{{ corrModos.anual.vendas }}" as="v" hint-placeholder-count="6">');
const dashboardHeader = '<div style="display:grid; grid-template-columns:0.7fr 1.6fr 0.8fr 1.4fr 1fr 1fr; gap:12px; padding:10px 20px; background:var(--bg-sunken); font-size:11px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:var(--fg-3);"><span>Data</span><span>Empreendimento</span><span>Unidade</span><span>Cliente</span><span style="text-align:right;">VGV</span><span style="text-align:right;">Comissão</span></div>';
const dashboardHeaderConnected = '<div style="display:grid; grid-template-columns:0.7fr 1.55fr 0.7fr 1fr 1fr 1fr 1fr; gap:12px; padding:10px 20px; background:var(--bg-sunken); font-size:11px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:var(--fg-3);"><span>Data</span><span>Empreendimento</span><span>Unidade</span><span style="text-align:right;">VGV atribuído</span><span style="text-align:right;">Minha comissão</span><span style="text-align:right;">Recebido</span><span style="text-align:right;">A receber</span></div>';
if (!template.includes(dashboardHeader)) throw new Error("Cabeçalho de vendas do painel financeiro não encontrado.");
template = template.replace(dashboardHeader, dashboardHeaderConnected);
const dashboardRow = '<div onclick="{{ v.onOpen }}" class="cc-card" style="display:grid; grid-template-columns:0.7fr 1.6fr 0.8fr 1.4fr 1fr 1fr; gap:12px; padding:13px 20px; border-top:1px solid var(--border-soft); align-items:center; font-size:13.5px; cursor:pointer;"><span style="color:var(--fg-3);">{{ v.data }}</span><span style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ v.empreendimento }}</span><span style="color:var(--fg-2);">{{ v.unidade }}</span><span style="color:var(--fg-2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ v.cliente }}</span><span style="text-align:right; font-weight:700; color:var(--ape-orange);">{{ v.vgvFmt }}</span><span style="text-align:right; font-weight:600;">{{ v.comFmt }}</span></div>';
const dashboardRowConnected = '<div onclick="{{ v.onOpen }}" class="cc-card" style="display:grid; grid-template-columns:0.7fr 1.55fr 0.7fr 1fr 1fr 1fr 1fr; gap:12px; padding:13px 20px; border-top:1px solid var(--border-soft); align-items:center; font-size:13.5px; cursor:pointer;"><span style="color:var(--fg-3);">{{ v.data }}</span><span style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ v.empreendimento }}</span><span style="color:var(--fg-2);">{{ v.unidade }}</span><span style="text-align:right; font-weight:700; color:var(--ape-orange);">{{ v.vgvFmt }}</span><span style="text-align:right; font-weight:600;">{{ v.comFmt }}</span><span style="text-align:right; font-weight:700; color:#1FA85A;">{{ v.recebidoFmt }}</span><span style="text-align:right; font-weight:700; color:#C77400;">{{ v.receberFmt }}</span></div>';
if (!template.includes(dashboardRow)) throw new Error("Linhas de vendas do painel financeiro não encontradas.");
template = template.replace(dashboardRow, dashboardRowConnected);
template = template.replace("goMesAtual: () => this.setState({ finTab: 'mesatual' })", "goMesAtual: () => this.setState({ finTab: 'mesatual' }), goHistorico: () => this.setState({ finTab: 'historico' })");

// O Financeiro do corretor separa claramente visão, vendas próprias e indicações.
template = template.replace(
  "const corrTab = ['visao', 'mesatual', 'historico', 'comparativo', 'anual'].indexOf(finTab) >= 0 ? finTab : 'visao';",
  "const corrTab = ['visao', 'minhas-vendas', 'indicacoes'].indexOf(finTab) >= 0 ? finTab : 'visao';",
);
const oldBrokerFinanceTabs = "        // Corretor: 4 modos — Mês atual / Histórico / Comparativo / Anual.\n        const corrTabs = [ { id: 'visao', label: 'Visão geral' }, { id: 'mesatual', label: 'Mês atual' }, { id: 'historico', label: 'Histórico' }, { id: 'comparativo', label: 'Comparativo' }, { id: 'anual', label: 'Anual' } ];";
if (!template.includes(oldBrokerFinanceTabs)) throw new Error("Abas antigas do Financeiro do corretor não encontradas.");
template = template.replace(oldBrokerFinanceTabs, "        // Corretor: resumo, vendas próprias e indicações em áreas independentes.\n        const corrTabs = [ { id: 'visao', label: 'Visão geral' }, { id: 'minhas-vendas', label: 'Vendas' }, { id: 'indicacoes', label: 'Indicações' } ];");
template = template.replace(
  "isCorrAnual: finCorretor && scr === 'financeiro' && corrTab === 'anual'",
  "isCorrAnual: finCorretor && scr === 'financeiro' && corrTab === 'minhas-vendas', isCorrIndicacoes: finCorretor && scr === 'financeiro' && corrTab === 'indicacoes'",
);
template = template.replace(
  "anual: ['Financeiro · Anual', 'Resultado consolidado do ano'], visao:",
  "anual: ['Financeiro · Anual', 'Resultado consolidado do ano'], 'minhas-vendas': ['Financeiro · Vendas', 'Vendas e recebimentos associados ao seu usuário'], indicacoes: ['Financeiro · Indicações', 'Negócios em que você participou como indicador'], visao:",
);

const brokerOverviewLogicPattern = /    \/\/ ---- Visão pessoal do corretor ----[\s\S]*?\n    \/\/ ================= INDICADORES \(BI · competência mensal\) =================/;
if (!brokerOverviewLogicPattern.test(template)) throw new Error("Lógica da Visão geral financeira do corretor não encontrada.");
const brokerOverviewLogic = `    // ---- Visão pessoal do corretor · filtrável ----
    let corretorFin = null;
    if (finCorretor) {
      const minhasTodas = calcAll.filter(c => c.v._minhaComissao != null);
      const periodo = st.finCorrPeriodo || 'ano';
      const produto = st.finCorrProduto || 'todos';
      const statusRec = st.finCorrStatus || 'todos';
      const tipoVinculo = st.finCorrTipo || 'todos';
      const latestMes = Math.max(1, ...minhasTodas.map(c => mesNum(c.v.data)).filter(Boolean));
      const anoNum = (v) => { const p=String(v||'').split('/'); return Number(p[2]||2026); };
      const periodoOk = (c) => { const m=mesNum(c.v.data), a=anoNum(c.v.data); if(periodo==='mes')return a===2026&&m===latestMes; if(periodo==='tri')return a===2026&&m>=Math.max(1,latestMes-2)&&m<=latestMes; if(periodo==='sem')return a===2026&&m>=Math.max(1,latestMes-5)&&m<=latestMes; if(periodo==='ano')return a===2026; return true; };
      const partOf = (c) => c.parts.find(x => !x.isImob && this._personIncluded(x.nome, meuNomeFin));
      const recebidoOk = (c) => { const p=partOf(c); return !!p && p.previsto>0.01 && (c.d._liquidada===true || p.recebido>=p.previsto-0.01); };
      const minhas = minhasTodas.filter(c => periodoOk(c) && (produto==='todos'||c.v.produto===produto) && (statusRec==='todos'||(statusRec==='recebido'?recebidoOk(c):!recebidoOk(c))) && (tipoVinculo==='todos'||(tipoVinculo==='indicacao'?c.v._ehIndicacao===true:c.v._ehIndicacao!==true)));
      const meuVgvPeriodo = minhas.reduce((a,c) => a+(c.v._vgvAtribuido!=null?c.v._vgvAtribuido:c.v.vgv),0);
      let comGerada=0, comPaga=0, comReceber=0;
      const minhasParcelas=[];
      minhas.forEach(c => { const p=partOf(c); if(!p)return; comGerada+=p.previsto; comPaga+=p.recebido; comReceber+=Math.max(0,p.previsto-p.recebido); (c.d.recebimentos||[]).forEach(r => { if(r.status==='Recebido')return; const share=c.previstoTotal>0?p.previsto*(Number(r.prev||0)/c.previstoTotal):0; if(share>0.005)minhasParcelas.push({venda:c.v.produto,unidade:'Unid. '+c.v.unidade,valorFmt:money(share),venc:r.dataPrev||'a definir',funcao:p.funcao}); }); });
      const metaMes=metaDe(meuNomeFin)||3000000;
      const metaFator=periodo==='mes'?1:periodo==='tri'?3:periodo==='sem'?6:12;
      const metaPeriodo=metaMes*metaFator;
      const pctPeriodoReal=metaPeriodo?Math.round(meuVgvPeriodo/metaPeriodo*100):0;
      const pctPeriodo=Math.min(100,pctPeriodoReal);
      const faltaPeriodo=Math.max(0,metaPeriodo-meuVgvPeriodo);
      const periodoLabel={mes:mesNomeF[latestMes-1]+'/2026',tri:'Últimos 3 meses',sem:'Últimos 6 meses',ano:'Ano de 2026',tudo:'Todo o histórico'}[periodo]||'Ano de 2026';
      const corMap={}; calcAll.forEach(c => { const n=c.v.corretor||'—',k=this._personKey(n)||n; corMap[k]=corMap[k]||{nome:n,vgv:0,n:0}; corMap[k].vgv+=c.v.vgv; corMap[k].n++; });
      const rankLocal=Object.keys(corMap).map(k=>corMap[k]);
      const rankReal=(this._rankingVgvReal||[]).map(r=>({nome:r.nome||'—',vgv:Number(r.vgv||0),n:Number(r.vendas||0)}));
      const rankArr=(rankReal.length?rankReal:rankLocal).sort((a,b)=>b.vgv-a.vgv);
      const meuVgvAno=minhasTodas.filter(c=>anoNum(c.v.data)===2026).reduce((a,c)=>a+(c.v._vgvAtribuido!=null?c.v._vgvAtribuido:c.v.vgv),0);
      const myPos=Math.max(1,rankArr.findIndex(r=>this._samePerson(r.nome,meuNomeFin))+1), lider=rankArr[0]||{vgv:0};
      const medal=['#F2A82C','#AFA79D','#CD7F32'];
      const podiumAvatar=(bd)=>({width:'38px',height:'38px',borderRadius:'50%',background:bd?'#FFE4D1':'#EBD1F5',color:bd?'#CC5800':'#66009A',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'13px',flexShrink:0});
      const podium=rankArr.slice(0,5).map((r,i)=>{const me=this._samePerson(r.nome,meuNomeFin);return{pos:String(i+1),nome:me?'Você · '+r.nome:r.nome,isMe:me,initials:this.ini(r.nome),vgvFmt:moneyK(r.vgv),vendas:r.n+(r.n===1?' venda':' vendas'),avatarStyle:podiumAvatar(me),medalStyle:{width:'24px',height:'24px',borderRadius:'50%',background:medal[i]||'#C9C2BA',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'12px',flexShrink:0},rowStyle:{display:'flex',alignItems:'center',gap:'11px',padding:'11px 13px',borderRadius:'13px',background:me?'var(--ape-orange-50)':'var(--bg-page)',border:me?'1.5px solid var(--ape-orange)':'1px solid transparent'}};});
      const meses=[...new Set(minhas.map(c=>mesNum(c.v.data)).filter(Boolean))].sort((a,b)=>a-b);
      const evo=meses.map(m=>minhas.filter(c=>mesNum(c.v.data)===m).reduce((a,c)=>a+(c.v._vgvAtribuido!=null?c.v._vgvAtribuido:c.v.vgv),0)), evoMax=Math.max(1,...evo);
      const evolucaoMinha=meses.map((m,i)=>({mes:mesNome3[m-1],atual:m===latestMes,vgvFmt:moneyK(evo[i]),barStyle:{width:'100%',height:Math.max(5,Math.round(evo[i]/evoMax*100))+'%',borderRadius:'7px 7px 2px 2px',background:m===latestMes?'linear-gradient(180deg,#FF7000,#E85D00)':'#F0D9C7',transition:'height 320ms cubic-bezier(0.2,0.8,0.2,1)'}}));
      const bWrap=(cor)=>({width:'38px',height:'38px',borderRadius:'11px',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',background:cor,flexShrink:0});
      const indicacoesN=minhas.filter(c=>c.v._ehIndicacao===true).length;
      const badges=[{icon:this.I.trend,iconWrap:bWrap('#FF7000'),titulo:pctPeriodo+'% da meta do período',sub:'faltam '+moneyK(faltaPeriodo)},{icon:this.I.sparkle,iconWrap:bWrap('#8B00CC'),titulo:indicacoesN+(indicacoesN===1?' indicação':' indicações'),sub:'no filtro atual'},{icon:this.I.building2,iconWrap:bWrap('#2F6FED'),titulo:minhas.length+(minhas.length===1?' venda':' vendas'),sub:periodoLabel}];
      if(comReceber>0)badges.push({icon:this.I.wallet,iconWrap:bWrap('#0E9488'),titulo:moneyK(comReceber)+' a receber',sub:'recebíveis futuros'});
      const sWrap=(cor)=>({width:'36px',height:'36px',borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',background:cor,flexShrink:0});
      const selStyle={height:'40px',padding:'0 34px 0 13px',borderRadius:'11px',border:'1.5px solid var(--border-soft)',background:'var(--bg-surface)',color:'var(--fg-1)',fontFamily:'var(--font-body)',fontWeight:600,fontSize:'13px',cursor:'pointer',minWidth:'150px'};
      const produtos=[...new Set(minhasTodas.map(c=>c.v.produto).filter(Boolean))].sort();
      const mkSel=(value,key,opts)=>({value:value,style:selStyle,onChange:(e)=>this.setState({[key]:e.target.value}),opts:opts});
      corretorFin={
        mesLabel:periodoLabel,nome:String(meuNomeFin).split(' ')[0],posLabel:myPos+'º',posSub:myPos===1?'você é o líder de vendas do time 🔑':('faltam '+moneyK(Math.max(0,lider.vgv-meuVgvAno))+' pra alcançar o 1º lugar'),
        ringStyle:{width:'148px',height:'148px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,background:'conic-gradient(#fff '+(pctPeriodo*3.6)+'deg, rgba(255,255,255,0.22) '+(pctPeriodo*3.6)+'deg)'},pctMesLabel:pctPeriodo+'%',vgvPeriodoFmt:moneyK(meuVgvPeriodo),faltaMetaFmt:moneyK(faltaPeriodo),
        stats:[{label:'VGV no período',value:moneyK(meuVgvPeriodo),sub:minhas.length+(minhas.length===1?' venda':' vendas'),icon:this.I.trend,iconWrap:sWrap('#FF7000')},{label:'Comissão gerada',value:moneyK(comGerada),sub:periodoLabel,icon:this.I.wallet,iconWrap:sWrap('#8B00CC')},{label:'Comissão recebida',value:moneyK(comPaga),sub:'pagamentos confirmados',icon:this.I.check,iconWrap:sWrap('#1FA85A')},{label:'A receber',value:moneyK(comReceber),sub:'parcelas pendentes',icon:this.I.clock,iconWrap:sWrap('#C77400')},{label:'Ticket médio',value:moneyK(minhas.length?meuVgvPeriodo/minhas.length:0),sub:'por venda',icon:this.I.dollar,iconWrap:sWrap('#0E9488')},{label:'Indicações',value:String(indicacoesN),sub:'associadas a você',icon:this.I.users,iconWrap:sWrap('#2F6FED')}],
        podium:podium,badges:badges,metaAnoPctLabel:pctPeriodo+'%',metaAnoBar:{width:pctPeriodo+'%',height:'100%',borderRadius:'999px',background:pctPeriodo>=100?'#3DDC84':'linear-gradient(90deg,#FF7000,#FFA24D)',transition:'width 320ms'},vgvAnoFmt:moneyK(meuVgvPeriodo),metaAnoFmt:moneyK(metaPeriodo),faltaAnoFmt:moneyK(faltaPeriodo),evolucao:evolucaoMinha,parcelas:minhasParcelas,temParcelas:minhasParcelas.length>0,semParcelas:minhasParcelas.length===0,
        filtros:{periodo:mkSel(periodo,'finCorrPeriodo',[{v:'mes',label:'Mês atual'},{v:'tri',label:'Últimos 3 meses'},{v:'sem',label:'Últimos 6 meses'},{v:'ano',label:'Ano de 2026'},{v:'tudo',label:'Todo o histórico'}]),produto:mkSel(produto,'finCorrProduto',[{v:'todos',label:'Todos os produtos'}].concat(produtos.map(x=>({v:x,label:x})))),status:mkSel(statusRec,'finCorrStatus',[{v:'todos',label:'Todos os status'},{v:'recebido',label:'Recebidos'},{v:'receber',label:'A receber'}]),tipo:mkSel(tipoVinculo,'finCorrTipo',[{v:'todos',label:'Vendas e indicações'},{v:'venda',label:'Vendas próprias'},{v:'indicacao',label:'Indicações'}]),onClear:()=>this.setState({finCorrPeriodo:'ano',finCorrProduto:'todos',finCorrStatus:'todos',finCorrTipo:'todos'})}
      };
    }

    // ================= INDICADORES (BI · competência mensal) =================`;
template = template.replace(brokerOverviewLogicPattern, brokerOverviewLogic);

const brokerOverviewAnchor = `          <sc-if value="{{ isCorretorView }}" hint-placeholder-val="{{ false }}">
          <!-- HERO gamificado do corretor -->`;
const brokerOverviewAnchorConnected = `          <sc-if value="{{ isCorretorView }}" hint-placeholder-val="{{ false }}">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:var(--bg-surface);border-radius:var(--radius-lg);box-shadow:var(--shadow-sm);padding:14px 16px;margin-bottom:16px;"><span style="font-size:13px;font-weight:700;color:var(--fg-2);margin-right:3px;">Filtrar desempenho</span><sc-raw-select value="{{ corretorFin.filtros.periodo.value }}" onchange="{{ corretorFin.filtros.periodo.onChange }}" style="{{ corretorFin.filtros.periodo.style }}"><sc-for list="{{ corretorFin.filtros.periodo.opts }}" as="o" hint-placeholder-count="5"><option value="{{ o.v }}">{{ o.label }}</option></sc-for></sc-raw-select><sc-raw-select value="{{ corretorFin.filtros.produto.value }}" onchange="{{ corretorFin.filtros.produto.onChange }}" style="{{ corretorFin.filtros.produto.style }}"><sc-for list="{{ corretorFin.filtros.produto.opts }}" as="o" hint-placeholder-count="5"><option value="{{ o.v }}">{{ o.label }}</option></sc-for></sc-raw-select><sc-raw-select value="{{ corretorFin.filtros.status.value }}" onchange="{{ corretorFin.filtros.status.onChange }}" style="{{ corretorFin.filtros.status.style }}"><sc-for list="{{ corretorFin.filtros.status.opts }}" as="o" hint-placeholder-count="3"><option value="{{ o.v }}">{{ o.label }}</option></sc-for></sc-raw-select><sc-raw-select value="{{ corretorFin.filtros.tipo.value }}" onchange="{{ corretorFin.filtros.tipo.onChange }}" style="{{ corretorFin.filtros.tipo.style }}"><sc-for list="{{ corretorFin.filtros.tipo.opts }}" as="o" hint-placeholder-count="3"><option value="{{ o.v }}">{{ o.label }}</option></sc-for></sc-raw-select><button type="button" onclick="{{ corretorFin.filtros.onClear }}" style="height:40px;padding:0 14px;border-radius:11px;border:1.5px solid var(--border-soft);background:var(--bg-surface);color:var(--fg-2);font-family:var(--font-body);font-weight:700;font-size:12px;cursor:pointer;">Limpar</button></div>
          <!-- HERO gamificado do corretor -->`;
if (!template.includes(brokerOverviewAnchor)) throw new Error("Início da Visão geral do corretor não encontrado.");
template = template.replace(brokerOverviewAnchor, brokerOverviewAnchorConnected);
template = template.replace("Comissão recebida no mês", "Comissão recebida no período");
template = template.replace("meta do mês", "meta do período");
template = template.replace("Meta anual", "Meta do período");
template = template.replace(
  '<div style="font-size:11px; opacity:0.85;">Comissão recebida no período</div><div style="font-size:20px; font-weight:700; margin-top:2px;">{{ corretorFin.comMesFmt }}</div>',
  '<div style="font-size:11px; opacity:0.85;">VGV no período</div><div style="font-size:20px; font-weight:700; margin-top:2px;">{{ corretorFin.vgvPeriodoFmt }}</div>',
);
template = template.replace(
  '<div style="font-size:11px; opacity:0.85;">A receber (parcelas)</div><div style="font-size:20px; font-weight:700; margin-top:2px;">{{ corretorFin.comReceberFmt }}</div>',
  '<div style="font-size:11px; opacity:0.85;">Falta para a meta</div><div style="font-size:20px; font-weight:700; margin-top:2px;">{{ corretorFin.faltaMetaFmt }}</div>',
);

const overviewSalesPattern = /          <!-- Minhas vendas -->[\s\S]*?\n          <\/div>\n          <\/sc-if>\n          <sc-if value="\{\{ notCorretorView \}\}"/;
if (!overviewSalesPattern.test(template)) throw new Error("Lista duplicada de vendas na Visão geral não encontrada.");
template = template.replace(overviewSalesPattern, `          </sc-if>
          <sc-if value="{{ notCorretorView }}"`);

const brokerSalesLogicAnchor = "      corrModos = { mesAtual: mesAtualView, hist: histView, comp: compView, anual: anoView };";
if (!template.includes(brokerSalesLogicAnchor)) throw new Error("Consolidação antiga das vendas do corretor não encontrada.");
const brokerSalesLogic = `      corrModos = { mesAtual: mesAtualView, hist: histView, comp: compView, anual: anoView };
      const mvPeriodo=st.finVendaPeriodo||'ano', mvProduto=st.finVendaProduto||'todos', mvStatus=st.finVendaStatus||'todos', mvBusca=String(st.finVendaBusca||'').trim().toLowerCase();
      const mvLatestMes=Math.max(1,...minhasC.map(c=>mesNum(c.v.data)).filter(Boolean));
      const mvAno=(v)=>{const p=String(v||'').split('/');return Number(p[2]||2026);};
      const mvPart=(c)=>c.parts.find(x=>!x.isImob&&this._personIncluded(x.nome,meuNomeFin));
      const mvPago=(c)=>{const p=mvPart(c);return !!p&&p.previsto>0.01&&(c.d._liquidada===true||p.recebido>=p.previsto-0.01);};
      const mvPeriodoOk=(c)=>{const m=mesNum(c.v.data),a=mvAno(c.v.data);if(mvPeriodo==='mes')return a===2026&&m===mvLatestMes;if(mvPeriodo==='tri')return a===2026&&m>=Math.max(1,mvLatestMes-2)&&m<=mvLatestMes;if(mvPeriodo==='sem')return a===2026&&m>=Math.max(1,mvLatestMes-5)&&m<=mvLatestMes;if(mvPeriodo==='ano')return a===2026;return true;};
      const mvSemTipo=minhasC.filter(c=>{const texto=(c.v.produto+' '+c.v.unidade+' '+c.v.cliente).toLowerCase();return mvPeriodoOk(c)&&(mvProduto==='todos'||c.v.produto===mvProduto)&&(mvStatus==='todos'||(mvStatus==='recebido'?mvPago(c):!mvPago(c)))&&(!mvBusca||texto.indexOf(mvBusca)>=0);});
      const mvArr=mvSemTipo.filter(c=>c.v._ehIndicacao!==true);
      const mvIndicArr=mvSemTipo.filter(c=>c.v._ehIndicacao===true);
      const mvRow=(c)=>{const p=mvPart(c),prev=p?p.previsto:0,rec=p?p.recebido:0,saldo=Math.max(0,prev-rec),semValor=prev<=0.01,pago=!semValor&&mvPago(c),parcial=!semValor&&!pago&&rec>0.01;const recebidas=(c.d.recebimentos||[]).filter(r=>r.status==='Recebido'),pend=(c.d.recebimentos||[]).find(r=>r.status!=='Recebido');const label=semValor?'Sem valor':(pago?'Recebido':(parcial?'Parcial':'A receber'));const cor=semValor?'#7C746E':(pago?'#1FA85A':(parcial?'#C77400':'#2F6FED')),bg=semValor?'#F1EEEB':(pago?'var(--success-bg)':(parcial?'#FFF2D8':'#E4EDFB'));return{data:c.v.data,empreendimento:c.v.produto,unidade:c.v.unidade||'—',tipo:c.v._ehIndicacao===true?'Indicação':'Venda',tipoStyle:c.v._ehIndicacao===true?statusPill('#66009A','#F3E5FA'):statusPill('#CC5800','#FFF0E5'),vgvFmt:money(c.v._vgvAtribuido!=null?c.v._vgvAtribuido:c.v.vgv),comFmt:semValor?'Não informada':money(prev),recebidoFmt:semValor?'—':money(rec),receberFmt:semValor?'—':money(saldo),status:label,statusStyle:statusPill(cor,bg),statusSub:semValor?'Comissão não cadastrada':(pago?('Pago'+(recebidas.length?' · '+(recebidas[recebidas.length-1].dataReceb||recebidas[recebidas.length-1].dataPrev):'')):(pend?'Prev. '+pend.dataPrev:'Sem data prevista')),onOpen:()=>this.setState({selectedVenda:c.v.id,vendaTab:'recebimentos'})};};
      const mvRows=mvArr.slice().sort((a,b)=>String(b.v.data).localeCompare(String(a.v.data))).map(mvRow);
      const mvIndicRows=mvIndicArr.slice().sort((a,b)=>String(b.v.data).localeCompare(String(a.v.data))).map(mvRow);
      const mvResumo=(arr)=>{let vgv=0,com=0,rec=0,saldo=0;arr.forEach(c=>{const p=mvPart(c);vgv+=(c.v._vgvAtribuido!=null?c.v._vgvAtribuido:c.v.vgv);if(p){com+=p.previsto;rec+=p.recebido;saldo+=Math.max(0,p.previsto-p.recebido);}});return{vgv,com,rec,saldo,n:arr.length};};
      const mvS=mvResumo(mvArr), mvIS=mvResumo(mvIndicArr);
      const mvKpiWrap=(cor)=>({width:'38px',height:'38px',borderRadius:'11px',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',background:cor,flexShrink:0});
      const mvSelStyle={height:'40px',padding:'0 34px 0 13px',borderRadius:'11px',border:'1.5px solid var(--border-soft)',background:'var(--bg-surface)',color:'var(--fg-1)',fontFamily:'var(--font-body)',fontWeight:600,fontSize:'13px',cursor:'pointer',minWidth:'150px'};
      const mvProdutos=[...new Set(minhasC.map(c=>c.v.produto).filter(Boolean))].sort();
      const mvSel=(value,key,opts)=>({value,style:mvSelStyle,onChange:(e)=>this.setState({[key]:e.target.value}),opts});
      corrModos.vendas={
        rows:mvRows,semVendas:mvRows.length===0,totalTxt:mvRows.length+(mvRows.length===1?' registro':' registros'),
        kpis:[{label:'Vendas no filtro',value:String(mvS.n),sub:'associadas ao seu usuário',icon:this.I.building2,iconWrap:mvKpiWrap('#FF7000')},{label:'VGV atribuído',value:moneyK(mvS.vgv),sub:'participação nas vendas',icon:this.I.trend,iconWrap:mvKpiWrap('#8B00CC')},{label:'Minha comissão',value:moneyK(mvS.com),sub:'total gerado',icon:this.I.wallet,iconWrap:mvKpiWrap('#0E9488')},{label:'Recebido',value:moneyK(mvS.rec),sub:'pagamentos confirmados',icon:this.I.check,iconWrap:mvKpiWrap('#1FA85A')},{label:'A receber',value:moneyK(mvS.saldo),sub:'saldo futuro',icon:this.I.clock,iconWrap:mvKpiWrap('#C77400')}],
        filtros:{busca:{value:st.finVendaBusca||'',onChange:(e)=>this.setState({finVendaBusca:e.target.value}),style:{height:'40px',minWidth:'230px',flex:'1',padding:'0 13px',borderRadius:'11px',border:'1.5px solid var(--border-soft)',background:'var(--bg-surface)',color:'var(--fg-1)',fontFamily:'var(--font-body)',fontSize:'13px'}},periodo:mvSel(mvPeriodo,'finVendaPeriodo',[{v:'mes',label:'Mês atual'},{v:'tri',label:'Últimos 3 meses'},{v:'sem',label:'Últimos 6 meses'},{v:'ano',label:'Ano de 2026'},{v:'tudo',label:'Todo o histórico'}]),produto:mvSel(mvProduto,'finVendaProduto',[{v:'todos',label:'Todos os produtos'}].concat(mvProdutos.map(x=>({v:x,label:x})))),status:mvSel(mvStatus,'finVendaStatus',[{v:'todos',label:'Todos os status'},{v:'recebido',label:'Recebidos'},{v:'receber',label:'A receber'}]),onClear:()=>this.setState({finVendaBusca:'',finVendaPeriodo:'ano',finVendaProduto:'todos',finVendaStatus:'todos'})}
      };
      corrModos.indicacoes={
        rows:mvIndicRows,sem:mvIndicRows.length===0,totalTxt:mvIndicRows.length+(mvIndicRows.length===1?' indicação':' indicações'),
        kpis:[{label:'Indicações no filtro',value:String(mvIS.n),sub:'associadas ao seu usuário',icon:this.I.users,iconWrap:mvKpiWrap('#8B00CC')},{label:'VGV indicado',value:moneyK(mvIS.vgv),sub:'volume dos negócios indicados',icon:this.I.trend,iconWrap:mvKpiWrap('#FF7000')},{label:'Comissão de indicação',value:moneyK(mvIS.com),sub:'total gerado',icon:this.I.wallet,iconWrap:mvKpiWrap('#0E9488')},{label:'Recebido',value:moneyK(mvIS.rec),sub:'pagamentos confirmados',icon:this.I.check,iconWrap:mvKpiWrap('#1FA85A')},{label:'A receber',value:moneyK(mvIS.saldo),sub:'saldo futuro',icon:this.I.clock,iconWrap:mvKpiWrap('#C77400')}],
        filtros:corrModos.vendas.filtros
      };`;
template = template.replace(brokerSalesLogicAnchor, brokerSalesLogic);

const brokerAnnualPagePattern = /      <!-- ========== CORRETOR · ANUAL ========== -->[\s\S]*?\n      <\/sc-if>\n\n      <!-- ========== FINANCEIRO · CAIXA ========== -->/;
if (!brokerAnnualPagePattern.test(template)) throw new Error("Página anual antiga do corretor não encontrada.");
const brokerSalesPage = `      <!-- ========== CORRETOR · MINHAS VENDAS ========== -->
      <sc-if value="{{ isCorrAnual }}" hint-placeholder-val="{{ false }}">
        <div class="cc-scroll cc-fade" style="flex:1;min-height:0;overflow-y:auto;padding:24px 28px;">
          <div style="background:var(--bg-surface);border-radius:var(--radius-lg);box-shadow:var(--shadow-sm);padding:14px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;"><input value="{{ corrModos.vendas.filtros.busca.value }}" oninput="{{ corrModos.vendas.filtros.busca.onChange }}" placeholder="Buscar empreendimento ou unidade…" style="{{ corrModos.vendas.filtros.busca.style }}"><sc-raw-select value="{{ corrModos.vendas.filtros.periodo.value }}" onchange="{{ corrModos.vendas.filtros.periodo.onChange }}" style="{{ corrModos.vendas.filtros.periodo.style }}"><sc-for list="{{ corrModos.vendas.filtros.periodo.opts }}" as="o" hint-placeholder-count="5"><option value="{{ o.v }}">{{ o.label }}</option></sc-for></sc-raw-select><sc-raw-select value="{{ corrModos.vendas.filtros.produto.value }}" onchange="{{ corrModos.vendas.filtros.produto.onChange }}" style="{{ corrModos.vendas.filtros.produto.style }}"><sc-for list="{{ corrModos.vendas.filtros.produto.opts }}" as="o" hint-placeholder-count="5"><option value="{{ o.v }}">{{ o.label }}</option></sc-for></sc-raw-select><sc-raw-select value="{{ corrModos.vendas.filtros.status.value }}" onchange="{{ corrModos.vendas.filtros.status.onChange }}" style="{{ corrModos.vendas.filtros.status.style }}"><sc-for list="{{ corrModos.vendas.filtros.status.opts }}" as="o" hint-placeholder-count="3"><option value="{{ o.v }}">{{ o.label }}</option></sc-for></sc-raw-select><sc-raw-select value="{{ corrModos.vendas.filtros.tipo.value }}" onchange="{{ corrModos.vendas.filtros.tipo.onChange }}" style="{{ corrModos.vendas.filtros.tipo.style }}"><sc-for list="{{ corrModos.vendas.filtros.tipo.opts }}" as="o" hint-placeholder-count="3"><option value="{{ o.v }}">{{ o.label }}</option></sc-for></sc-raw-select><button type="button" onclick="{{ corrModos.vendas.filtros.onClear }}" style="height:40px;padding:0 14px;border-radius:11px;border:1.5px solid var(--border-soft);background:var(--bg-surface);color:var(--fg-2);font-family:var(--font-body);font-weight:700;font-size:12px;cursor:pointer;">Limpar</button></div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-bottom:16px;"><sc-for list="{{ corrModos.vendas.kpis }}" as="k" hint-placeholder-count="5"><div style="background:var(--bg-surface);border-radius:var(--radius-lg);box-shadow:var(--shadow-sm);padding:17px 18px;"><div style="display:flex;align-items:center;gap:10px;"><div style="{{ k.iconWrap }}"><span style="font-size:17px;display:inline-flex;">{{ k.icon }}</span></div><span style="font-size:12px;color:var(--fg-3);font-weight:600;">{{ k.label }}</span></div><div style="font-size:24px;font-weight:700;margin-top:10px;">{{ k.value }}</div><div style="font-size:11.5px;color:var(--fg-muted);margin-top:2px;">{{ k.sub }}</div></div></sc-for></div>
          <div style="background:linear-gradient(135deg,#F9F1FD,#FFF7F1);border:1px solid #E7CDF3;border-radius:var(--radius-lg);padding:18px 20px;margin-bottom:16px;"><div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;"><span style="width:38px;height:38px;border-radius:11px;background:var(--ape-purple);color:#fff;display:flex;align-items:center;justify-content:center;">{{ icons.users }}</span><div style="flex:1;"><div style="font-weight:700;font-size:16px;">Minhas indicações</div><div style="font-size:12px;color:var(--fg-3);">Todas as vendas em que você está cadastrado como indicador.</div></div><div style="display:flex;gap:18px;flex-wrap:wrap;"><div><small style="color:var(--fg-muted);">INDICAÇÕES</small><strong style="display:block;font-size:18px;">{{ corrModos.vendas.indicacoes.n }}</strong></div><div><small style="color:var(--fg-muted);">COMISSÃO</small><strong style="display:block;font-size:18px;">{{ corrModos.vendas.indicacoes.comFmt }}</strong></div><div><small style="color:var(--fg-muted);">RECEBIDO</small><strong style="display:block;font-size:18px;color:#1FA85A;">{{ corrModos.vendas.indicacoes.recebidoFmt }}</strong></div><div><small style="color:var(--fg-muted);">A RECEBER</small><strong style="display:block;font-size:18px;color:#C77400;">{{ corrModos.vendas.indicacoes.receberFmt }}</strong></div></div></div><sc-if value="{{ corrModos.vendas.indicacoes.sem }}" hint-placeholder-val="{{ false }}"><div style="padding:14px;text-align:center;color:var(--fg-3);font-size:13px;">Nenhuma indicação encontrada neste filtro.</div></sc-if><sc-for list="{{ corrModos.vendas.indicacoes.rows }}" as="v" hint-placeholder-count="3"><button type="button" onclick="{{ v.onOpen }}" style="width:100%;display:grid;grid-template-columns:.7fr 1.6fr .7fr 1fr 1fr;gap:12px;align-items:center;padding:11px 12px;border:0;border-top:1px solid rgba(139,0,204,.12);background:transparent;text-align:left;font-family:var(--font-body);cursor:pointer;"><span style="font-size:12px;color:var(--fg-3);">{{ v.data }}</span><span><strong style="display:block;font-size:13.5px;">{{ v.empreendimento }}</strong><small style="color:var(--fg-3);">Unid. {{ v.unidade }}</small></span><span style="{{ v.tipoStyle }}">{{ v.tipo }}</span><strong style="text-align:right;">{{ v.comFmt }}</strong><span style="text-align:right;"><span style="{{ v.statusStyle }}">{{ v.status }}</span></span></button></sc-for></div>
          <div style="background:var(--bg-surface);border-radius:var(--radius-lg);box-shadow:var(--shadow-sm);overflow:hidden;"><div style="display:flex;align-items:center;padding:17px 20px 13px;"><div><strong style="font-size:16px;">Todas as minhas vendas</strong><div style="font-size:12px;color:var(--fg-3);margin-top:2px;">{{ corrModos.vendas.totalTxt }} · clique para ver parcelas e datas.</div></div></div><div style="display:grid;grid-template-columns:.65fr .7fr 1.35fr .9fr 1fr 1fr 1fr 1fr;gap:10px;padding:10px 18px;background:var(--bg-sunken);font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--fg-3);"><span>Data</span><span>Tipo</span><span>Produto / unidade</span><span style="text-align:right;">VGV</span><span style="text-align:right;">Comissão</span><span>Status</span><span style="text-align:right;">Recebido</span><span style="text-align:right;">A receber</span></div><sc-if value="{{ corrModos.vendas.semVendas }}" hint-placeholder-val="{{ false }}"><div style="padding:30px;text-align:center;color:var(--fg-3);font-size:13px;">Nenhuma venda encontrada com os filtros selecionados.</div></sc-if><sc-for list="{{ corrModos.vendas.rows }}" as="v" hint-placeholder-count="8"><button type="button" onclick="{{ v.onOpen }}" class="cc-card" style="width:100%;display:grid;grid-template-columns:.65fr .7fr 1.35fr .9fr 1fr 1fr 1fr 1fr;gap:10px;padding:13px 18px;border:0;border-top:1px solid var(--border-soft);background:var(--bg-surface);align-items:center;text-align:left;font-family:var(--font-body);font-size:13px;cursor:pointer;"><span style="color:var(--fg-3);">{{ v.data }}</span><span><span style="{{ v.tipoStyle }}">{{ v.tipo }}</span></span><span style="min-width:0;"><strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ v.empreendimento }}</strong><small style="color:var(--fg-3);">Unid. {{ v.unidade }}</small></span><strong style="text-align:right;color:var(--ape-orange);">{{ v.vgvFmt }}</strong><strong style="text-align:right;">{{ v.comFmt }}</strong><span><span style="{{ v.statusStyle }}">{{ v.status }}</span><small style="display:block;color:var(--fg-muted);margin-top:3px;">{{ v.statusSub }}</small></span><strong style="text-align:right;color:#1FA85A;">{{ v.recebidoFmt }}</strong><strong style="text-align:right;color:#C77400;">{{ v.receberFmt }}</strong></button></sc-for></div>
        </div>
      </sc-if>

      <!-- ========== FINANCEIRO · CAIXA ========== -->`;
template = template.replace(brokerAnnualPagePattern, brokerSalesPage);

// A aba de Vendas não mistura indicações nem oferece um filtro de tipo redundante.
const brokerTypeSelectStart = '<sc-raw-select value="{{ corrModos.vendas.filtros.tipo.value }}"';
const brokerTypeSelectAt = template.indexOf(brokerTypeSelectStart);
if (brokerTypeSelectAt >= 0) {
  const brokerTypeSelectEnd = template.indexOf('</sc-raw-select>', brokerTypeSelectAt);
  if (brokerTypeSelectEnd >= 0) template = template.slice(0, brokerTypeSelectAt) + template.slice(brokerTypeSelectEnd + 16);
}
const embeddedIndStartText = '          <div style="background:linear-gradient(135deg,#F9F1FD,#FFF7F1);border:1px solid #E7CDF3;';
const salesTableStartText = '          <div style="background:var(--bg-surface);border-radius:var(--radius-lg);box-shadow:var(--shadow-sm);overflow:hidden;"><div style="display:flex;align-items:center;padding:17px 20px 13px;">';
const embeddedIndAt = template.indexOf(embeddedIndStartText);
const salesTableAt = embeddedIndAt >= 0 ? template.indexOf(salesTableStartText, embeddedIndAt) : -1;
if (embeddedIndAt >= 0 && salesTableAt > embeddedIndAt) template = template.slice(0, embeddedIndAt) + template.slice(salesTableAt);

const financeCashMarker = '      <!-- ========== FINANCEIRO · CAIXA ========== -->';
if (!template.includes(financeCashMarker)) throw new Error("Ponto de inclusão da aba de Indicações não encontrado.");
const brokerIndicationsPage = `      <!-- ========== CORRETOR · INDICAÇÕES ========== -->
      <sc-if value="{{ isCorrIndicacoes }}" hint-placeholder-val="{{ false }}">
        <div class="cc-scroll cc-fade" style="flex:1;min-height:0;overflow-y:auto;padding:24px 28px;">
          <div style="background:var(--bg-surface);border-radius:var(--radius-lg);box-shadow:var(--shadow-sm);padding:14px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;"><input value="{{ corrModos.indicacoes.filtros.busca.value }}" oninput="{{ corrModos.indicacoes.filtros.busca.onChange }}" placeholder="Buscar empreendimento ou unidade…" style="{{ corrModos.indicacoes.filtros.busca.style }}"><sc-raw-select value="{{ corrModos.indicacoes.filtros.periodo.value }}" onchange="{{ corrModos.indicacoes.filtros.periodo.onChange }}" style="{{ corrModos.indicacoes.filtros.periodo.style }}"><sc-for list="{{ corrModos.indicacoes.filtros.periodo.opts }}" as="o" hint-placeholder-count="5"><option value="{{ o.v }}">{{ o.label }}</option></sc-for></sc-raw-select><sc-raw-select value="{{ corrModos.indicacoes.filtros.produto.value }}" onchange="{{ corrModos.indicacoes.filtros.produto.onChange }}" style="{{ corrModos.indicacoes.filtros.produto.style }}"><sc-for list="{{ corrModos.indicacoes.filtros.produto.opts }}" as="o" hint-placeholder-count="5"><option value="{{ o.v }}">{{ o.label }}</option></sc-for></sc-raw-select><sc-raw-select value="{{ corrModos.indicacoes.filtros.status.value }}" onchange="{{ corrModos.indicacoes.filtros.status.onChange }}" style="{{ corrModos.indicacoes.filtros.status.style }}"><sc-for list="{{ corrModos.indicacoes.filtros.status.opts }}" as="o" hint-placeholder-count="3"><option value="{{ o.v }}">{{ o.label }}</option></sc-for></sc-raw-select><button type="button" onclick="{{ corrModos.indicacoes.filtros.onClear }}" style="height:40px;padding:0 14px;border-radius:11px;border:1.5px solid var(--border-soft);background:var(--bg-surface);color:var(--fg-2);font-family:var(--font-body);font-weight:700;font-size:12px;cursor:pointer;">Limpar</button></div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-bottom:16px;"><sc-for list="{{ corrModos.indicacoes.kpis }}" as="k" hint-placeholder-count="5"><div style="background:var(--bg-surface);border-radius:var(--radius-lg);box-shadow:var(--shadow-sm);padding:17px 18px;"><div style="display:flex;align-items:center;gap:10px;"><div style="{{ k.iconWrap }}"><span style="font-size:17px;display:inline-flex;">{{ k.icon }}</span></div><span style="font-size:12px;color:var(--fg-3);font-weight:600;">{{ k.label }}</span></div><div style="font-size:24px;font-weight:700;margin-top:10px;">{{ k.value }}</div><div style="font-size:11.5px;color:var(--fg-muted);margin-top:2px;">{{ k.sub }}</div></div></sc-for></div>
          <div style="background:var(--bg-surface);border-radius:var(--radius-lg);box-shadow:var(--shadow-sm);overflow:hidden;"><div style="display:flex;align-items:center;padding:17px 20px 13px;"><div><strong style="font-size:16px;">Minhas indicações</strong><div style="font-size:12px;color:var(--fg-3);margin-top:2px;">{{ corrModos.indicacoes.totalTxt }} · clique para ver parcelas e datas.</div></div></div><div style="display:grid;grid-template-columns:.65fr 1.5fr .9fr 1fr 1fr 1fr 1fr;gap:10px;padding:10px 18px;background:var(--bg-sunken);font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--fg-3);"><span>Data</span><span>Produto / unidade</span><span style="text-align:right;">VGV indicado</span><span style="text-align:right;">Comissão</span><span>Status</span><span style="text-align:right;">Recebido</span><span style="text-align:right;">A receber</span></div><sc-if value="{{ corrModos.indicacoes.sem }}" hint-placeholder-val="{{ false }}"><div style="padding:30px;text-align:center;color:var(--fg-3);font-size:13px;">Nenhuma indicação encontrada com os filtros selecionados.</div></sc-if><sc-for list="{{ corrModos.indicacoes.rows }}" as="v" hint-placeholder-count="8"><button type="button" onclick="{{ v.onOpen }}" class="cc-card" style="width:100%;display:grid;grid-template-columns:.65fr 1.5fr .9fr 1fr 1fr 1fr 1fr;gap:10px;padding:13px 18px;border:0;border-top:1px solid var(--border-soft);background:var(--bg-surface);align-items:center;text-align:left;font-family:var(--font-body);font-size:13px;cursor:pointer;"><span style="color:var(--fg-3);">{{ v.data }}</span><span style="min-width:0;"><strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ v.empreendimento }}</strong><small style="color:var(--fg-3);">Unid. {{ v.unidade }}</small></span><strong style="text-align:right;color:var(--ape-orange);">{{ v.vgvFmt }}</strong><strong style="text-align:right;">{{ v.comFmt }}</strong><span><span style="{{ v.statusStyle }}">{{ v.status }}</span><small style="display:block;color:var(--fg-muted);margin-top:3px;">{{ v.statusSub }}</small></span><strong style="text-align:right;color:#1FA85A;">{{ v.recebidoFmt }}</strong><strong style="text-align:right;color:#C77400;">{{ v.receberFmt }}</strong></button></sc-for></div>
        </div>
      </sc-if>

`;
template = template.replace(financeCashMarker, brokerIndicationsPage + financeCashMarker);

// Pendências continuam no sino/central. Um aviso breve só aparece quando a
// quantidade aumenta; ele some sozinho e nunca ocupa o topo permanentemente.
const alarmPattern = /  _slaAlarmeUI\(\)\{[\s\S]*?\n  _slaResponder\(neg\)\{/;
if (!alarmPattern.test(template)) throw new Error("Faixa de atendimento não encontrada.");
const alarmPopup = `  _slaAlarmeUI(){ var self=this; var n=Number(self._slaAlarme||0); var antigo=document.getElementById('apcAlarme');
    if(antigo) antigo.remove();
    if(n<=0){ self._slaUltimoAvisado=0; return; }
    var anterior=Number(self._slaUltimoAvisado||0);
    if(n<=anterior){ self._slaUltimoAvisado=n; return; }
    self._slaUltimoAvisado=n;
    var novo=n-anterior, b=document.getElementById('apcAlarmeToast'); if(b)b.remove();
    b=document.createElement('div'); b.id='apcAlarmeToast'; b.setAttribute('role','status'); b.style.cssText='position:fixed;right:22px;bottom:92px;z-index:99999;width:min(310px,calc(100vw - 44px));background:#fff;color:var(--fg-1,#1F1C1A);font-family:var(--font-body,inherit);padding:13px 14px;border:1px solid #E8D7F0;border-left:4px solid var(--ape-purple,#8B00CC);border-radius:13px;box-shadow:0 14px 34px rgba(31,28,26,.18);display:flex;align-items:center;gap:11px;animation:ccFadeIn .22s ease';
    var ic=document.createElement('div'); ic.textContent='🔔'; ic.style.cssText='width:34px;height:34px;border-radius:10px;background:#F3E5FA;display:flex;align-items:center;justify-content:center;flex-shrink:0'; b.appendChild(ic);
    var body=document.createElement('div'); body.style.cssText='flex:1;min-width:0'; var title=document.createElement('div'); title.textContent=novo===1?'Novo atendimento pendente':novo+' novos atendimentos'; title.style.cssText='font-weight:800;font-size:13px'; var txt=document.createElement('div'); txt.textContent='Veja os detalhes no sino de notificações.'; txt.style.cssText='margin-top:3px;color:var(--fg-3,#7b746d);font-size:11.5px;line-height:1.35'; body.appendChild(title); body.appendChild(txt); b.appendChild(body);
    var open=document.createElement('button'); open.type='button'; open.textContent='Ver'; open.style.cssText='border:0;background:var(--ape-purple,#8B00CC);color:#fff;padding:7px 10px;border-radius:8px;font-weight:700;font-size:11.5px;cursor:pointer'; open.onclick=function(){try{b.remove();}catch(e){} self.abrirCentralSla();}; b.appendChild(open); document.body.appendChild(b);
    clearTimeout(self._slaToastTimer); self._slaToastTimer=setTimeout(function(){try{b.remove();}catch(e){}},7500);
    if(Date.now()>=(self._silenciarAte||0)){try{var a=self._actx=self._actx||new (window.AudioContext||window.webkitAudioContext)();var o=a.createOscillator(),g=a.createGain();o.connect(g);g.connect(a.destination);o.type='sine';o.frequency.value=720;g.gain.value=0.035;o.start();setTimeout(function(){o.stop();},140);}catch(e){}}
  }
  _slaResponder(neg){`;
template = template.replace(alarmPattern, alarmPopup);

const crmEnrichAnchor = "    enrich(l) {    const t = this.tempMap[l.temp] || this.tempMap.morno;";
if (!template.includes(crmEnrichAnchor)) throw new Error("Painel lateral do CRM não encontrado no HTML original.");
template = template.replace(crmEnrichAnchor, `    enrich(l) {    const crmAction = (action, extra) => { if (typeof window.__apeCrmAction === 'function') window.__apeCrmAction(action, Object.assign({ dealId:String(l.id||'').replace(/^erp_/,''), name:l.nome||'', phone:l.tel||'', value:l.valor||0, productName:l.ape||'' }, extra||{})); else this.showToast('Carregando ação do CRM...'); };
    const t = this.tempMap[l.temp] || this.tempMap.morno;`);

const crmQuickActions = `      quickActions: [
        { label: 'Tarefas', icon: this.I.check, onClick: () => this.verTarefasLead(l) },
        { label: 'Agendar visita', icon: this.I.calendar, onClick: () => this.abrirAgendarVisita(l) },
        { label: 'Enviar produto', icon: this.I.building2, onClick: () => { this.setState({ screen: 'produtos', selectedId: null }); this.showToast('Selecione o produto e toque em Enviar ao cliente'); } },
        { label: 'Gerar proposta', icon: this.I.edit, onClick: () => this.recursoEmPreparo('Gerar proposta') },
        { label: 'Financiamento', icon: this.I.calc, onClick: () => this.abrirFichaSimulacao(l) },
        { label: 'Transferir', icon: this.I.users, onClick: () => this.transferirResponsavel(l) },
        { label: 'Lembrete de ligação', icon: this.I.phone, onClick: () => this.lembreteLigacao(l) },
        { label: 'Observação', icon: this.I.chat, onClick: () => this.addObservacaoChat(l) },
        { label: 'Pedir à IA', icon: this.I.sparkle, onClick: () => this.recursoEmPreparo('Pedir à IA') }
      ],`;
const crmQuickActionsConnected = `      quickActions: [
        { label: 'Tarefas', icon: this.I.check, onClick: () => crmAction('task') },
        { label: 'Agendar visita', icon: this.I.calendar, onClick: () => crmAction('visit') },
        { label: 'Enviar produto', icon: this.I.building2, onClick: () => crmAction('product') },
        { label: 'Gerar proposta', icon: this.I.edit, onClick: () => crmAction('proposal') },
        { label: 'Financiamento', icon: this.I.calc, onClick: () => crmAction('financing') },
        { label: 'Transferir', icon: this.I.users, onClick: () => crmAction('transfer') },
        { label: 'Lembrete de ligação', icon: this.I.phone, onClick: () => crmAction('callReminder') },
        { label: 'Observação', icon: this.I.chat, onClick: () => crmAction('note') },
        { label: 'Pedir à IA', icon: this.I.sparkle, onClick: () => crmAction('ai') }
      ],`;
if (!template.includes(crmQuickActions)) throw new Error("Ações rápidas do CRM não encontradas no HTML original.");
template = template.replace(crmQuickActions, crmQuickActionsConnected);

const crmVisitHandler = "      onAgendar: () => { const match = this.produtos.find(pp => l.ape && (l.ape.toLowerCase().indexOf(pp.nome.toLowerCase()) >= 0 || pp.nome.toLowerCase().indexOf((l.ape || '').toLowerCase()) >= 0)); const dono = this.corretores[l.id % this.corretores.length] || 'Rômulo Pedro'; this.openModal('visita', { leadId: l.id, cliente: l.nome, corretor: dono, produtoId: match ? String(match.id) : '', date: '2026-07-06', hora: '10:00' }); },";
if (!template.includes(crmVisitHandler)) throw new Error("Botão principal de visita do CRM não encontrado.");
template = template.replace(crmVisitHandler, "      onAgendar: () => crmAction('visit'),");

const crmSaleHandler = "      onIniciarVenda: (e) => { if (e && e.stopPropagation) e.stopPropagation(); const _v = this.vendas.find(x => x.leadId === l.id); if (_v) { this.setState({ screen: 'crm', crmTab: 'processos', selectedVenda: _v.id, vendaTab: 'processo' }); return; } this.enviarParaProcesso(l.id); },";
if (!template.includes(crmSaleHandler)) throw new Error("Botão de processo de venda do CRM não encontrado.");
template = template.replace(crmSaleHandler, "      onIniciarVenda: (e) => { if (e && e.stopPropagation) e.stopPropagation(); const _v = this.vendas.find(x => x.leadId === l.id); if (_v) { this.setState({ screen: 'crm', crmTab: 'processos', selectedVenda: _v.id, vendaTab: 'processo' }); return; } crmAction('sale'); },");

const crmNextHandler = "        pa.onExec = () => { if (pa.kind === 'agendar') { const match = this.produtos.find(pp => l.ape && (l.ape.toLowerCase().indexOf(pp.nome.toLowerCase()) >= 0)); const dono = this.corretores[l.id % this.corretores.length] || 'Rômulo Pedro'; this.openModal('visita', { leadId: l.id, cliente: l.nome, corretor: dono, produtoId: match ? String(match.id) : '', date: '2026-07-06', hora: '10:00' }); } else { this.openMiniChat(l.id); } this.showToast('▶ ' + pa.label); };";
if (!template.includes(crmNextHandler)) throw new Error("Próxima melhor ação do CRM não encontrada.");
template = template.replace(crmNextHandler, "        pa.onExec = () => crmAction(pa.kind === 'agendar' ? 'visit' : 'followup', { defaultTitle:pa.label });");

const bridge = `
<script src="/legacy-crm-actions.js"></script>
<style id="apecerto-legacy-embedded-style">
  .erp-nav{display:none!important}
  .erp-nav-fab{display:none!important}
  html,body,x-dc,.sc-host{height:100%!important;min-height:100%!important}
  .apf-root{flex:1;min-height:0;overflow:auto;padding:18px 24px 34px;background:var(--bg-page);color:var(--fg-1)}
  .apf-root *{box-sizing:border-box}.apf-command{display:flex;align-items:center;gap:10px;padding:8px 10px;margin-bottom:10px;border:1px solid var(--border-soft);border-radius:14px;background:var(--bg-surface);box-shadow:var(--shadow-sm)}
  .apf-tabs,.apf-period{display:flex;align-items:center;gap:3px;flex-wrap:wrap}.apf-command-spacer{flex:1}.apf-scope{display:flex;align-items:center;gap:7px;color:var(--fg-3);font-size:11px;font-weight:700}.apf-scope select{min-width:170px;padding:8px 30px 8px 10px;border:1px solid var(--border-default);border-radius:9px;background:#fff;color:var(--fg-1);font:600 12px var(--font-body)}
  .apf-live{display:flex;align-items:center;justify-content:flex-end;gap:6px;margin:0 4px 12px;color:var(--fg-muted);font-size:11px}.apf-live span{width:7px;height:7px;border-radius:50%;background:#1fa85a;box-shadow:0 0 0 3px rgba(31,168,90,.12)}
  .apf-quality{display:flex;align-items:center;gap:10px;margin:0 0 14px;padding:10px 13px;border:1px solid #f2d486;border-radius:11px;background:#fff8e8;color:#7e5a00;font-size:11px}.apf-quality strong{white-space:nowrap}.apf-quality span{color:#7e6842}
  .apf-card,.apf-kpi{border:1px solid var(--border-soft);border-radius:15px;background:var(--bg-surface);box-shadow:var(--shadow-sm)}.apf-card{padding:18px}.apf-card-title{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:15px}.apf-card-title h3,.apf-score-card h2,.apf-indices h3{margin:2px 0 0;font-size:15px}.apf-eyebrow{margin:0;color:var(--fg-muted);font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase}.apf-orange{color:var(--ape-orange);font-size:20px}.apf-muted{margin:10px 0 0;color:var(--fg-muted);font-size:11px}
  .apf-hero-grid{display:grid;grid-template-columns:minmax(280px,.75fr) minmax(430px,1.25fr);gap:14px;margin-bottom:14px}.apf-score-card{display:flex;align-items:center;justify-content:space-between;gap:18px}.apf-score-card h2{margin-bottom:10px}.apf-ring-core{width:calc(100% - 14px);height:calc(100% - 14px);margin:7px;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:50%;background:#fff}.apf-ring-core strong{font-size:28px}.apf-ring-core small{color:var(--fg-muted);font-size:10px}
  .apf-driver-list{display:grid;grid-template-columns:1fr 1fr;gap:12px 16px}.apf-driver-list header,.apf-conv header,.apf-funnel header{display:flex;justify-content:space-between;gap:8px;margin-bottom:6px;font-size:11px}.apf-driver-list header small{color:var(--fg-muted);font-weight:500}.apf-track{display:block;height:6px;overflow:hidden;border-radius:999px;background:var(--bg-sunken);text-decoration:none}.apf-track i,.apf-track u{display:block;text-decoration:none}.apf-track-lg{height:10px}
  .apf-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:11px;margin-bottom:14px}.apf-kpis-four{grid-template-columns:repeat(4,minmax(0,1fr))}.apf-kpi{min-height:128px;padding:14px;display:flex;flex-direction:column;align-items:flex-start}.apf-kpi>div{width:34px!important;height:34px!important;margin-bottom:10px}.apf-kpi>span{min-height:26px;color:var(--fg-3);font-size:11px;font-weight:650}.apf-kpi>strong{margin-top:5px;font-size:20px;letter-spacing:-.02em}.apf-kpi>small{margin-top:3px;color:var(--fg-muted);font-size:10px}
  .apf-two{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}.apf-three{display:grid;grid-template-columns:.7fr .7fr 1.6fr;gap:14px}.apf-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0 0}.apf-summary div{padding:9px;border-radius:10px;background:var(--bg-page)}.apf-summary dt{color:var(--fg-muted);font-size:9px}.apf-summary dd{margin:3px 0 0;font-size:13px;font-weight:800}.apf-conv,.apf-funnel{display:flex;flex-direction:column;gap:14px}
  .apf-rank button,.apf-board button{width:100%;border:0;background:transparent;color:inherit;font:inherit;text-align:left}.apf-rank button{display:grid!important;grid-template-columns:36px 40px 1fr auto;align-items:center}.apf-rank button+button{border-top:1px solid var(--border-soft)}.apf-rank button>b{color:var(--fg-muted);font-size:11px}.apf-rank button>i,.apf-speed i,.apf-board button>i,.apf-table button span>i{font-style:normal}.apf-rank button>span{display:flex;flex-direction:column;gap:3px}.apf-rank button>span small{color:var(--fg-muted);font-size:10px}.apf-rank button>span em{margin-top:3px}.apf-rank button>mark,.apf-board mark{background:transparent;color:var(--ape-orange-700);font-weight:800}
  .apf-ring-panel{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.apf-ring-panel>div{margin:14px auto}.apf-ring-panel>p:last-child{margin:0;color:var(--fg-muted);font-size:11px}.apf-speed{display:flex;flex-direction:column}.apf-speed>div{display:grid;grid-template-columns:32px 1fr auto;align-items:center;gap:9px;padding:7px 0}.apf-speed>div+div{border-top:1px solid var(--border-soft)}.apf-speed span{display:flex;flex-direction:column;gap:4px}.apf-speed b{font-size:11px}.apf-speed strong{font-size:11px}
  .apf-alerts{display:grid;grid-template-columns:repeat(5,1fr);gap:11px;margin-bottom:14px}.apf-alerts article{min-height:118px;padding:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid var(--border-soft);border-radius:14px;background:#fff;text-align:center}.apf-alerts article>div{font-size:18px}.apf-alerts strong{margin:6px 0 2px;font-size:24px}.apf-alerts span{color:var(--fg-3);font-size:10px}
  .apf-table-head,.apf-table button{display:grid;grid-template-columns:2fr repeat(3,.65fr) 1fr;align-items:center;gap:10px}.apf-table-head{padding:9px 12px;border-radius:9px;background:var(--bg-sunken);color:var(--fg-muted);font-size:9px;font-weight:800;text-transform:uppercase}.apf-table button{padding:10px 12px;border:0;border-bottom:1px solid var(--border-soft);background:#fff;color:inherit;text-align:left}.apf-table button>span{display:flex;align-items:center;gap:8px}.apf-table button>em{font-style:normal}.apf-table button>strong{display:flex;flex-direction:column;gap:5px}.apf-table button>strong u{width:100%}
  .apf-highlight{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:210px;text-align:center}.apf-highlight>strong{margin:12px 0 4px;color:var(--ape-orange);font-size:42px}.apf-highlight>span{color:var(--fg-muted);font-size:11px}.apf-board-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.apf-board button{display:grid;grid-template-columns:25px 32px 1fr auto;align-items:center;gap:8px;padding:8px 4px}.apf-board button+button{border-top:1px solid var(--border-soft)}.apf-board button>span{display:flex;flex-direction:column;gap:4px}.apf-board button>span strong{font-size:11px}.apf-board mark{font-size:11px}
  .apf-indices{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:14px}.apf-indices article header{display:flex;justify-content:space-between;gap:10px}.apf-indices article header>strong{color:var(--ape-orange);font-size:24px}.apf-indices article>p{min-height:30px;color:var(--fg-3);font-size:11px}.apf-insights{display:flex;flex-direction:column;gap:9px}.apf-insights article{display:flex;gap:9px;padding:10px;border-left:3px solid;border-radius:9px;background:var(--bg-page)}.apf-insights article>div{font-size:16px}.apf-insights span strong{font-size:11px}.apf-insights span p{margin:3px 0 0;color:var(--fg-3);font-size:10px;line-height:1.45}.apf-actions{display:flex;flex-direction:column;gap:8px}.apf-actions>div{display:flex;align-items:flex-start;gap:9px;padding:10px;border-bottom:1px solid var(--border-soft)}.apf-actions>div>i{width:8px;height:8px;margin-top:4px;border-radius:50%}.apf-actions span{display:flex;flex-direction:column;gap:3px}.apf-actions strong{font-size:11px}.apf-actions small{font-size:9px;font-weight:800;text-transform:uppercase}
  @media(max-width:1100px){.apf-kpis{grid-template-columns:repeat(3,1fr)}.apf-kpis-four{grid-template-columns:repeat(3,1fr)}.apf-alerts{grid-template-columns:repeat(3,1fr)}.apf-command{align-items:flex-start;flex-wrap:wrap}.apf-command-spacer{display:none}.apf-hero-grid,.apf-three{grid-template-columns:1fr}.apf-board-grid{grid-template-columns:1fr}.apf-indices{grid-template-columns:repeat(2,1fr)}}
</style>
<script id="apecerto-legacy-bridge">
(function(){
  var lastPayload = null;
  var attempts = 0;
  var profiles = {
    'fabiano@apecerto.com': { nome:'Fabiano Andrade', perfil:'Corretor', instancias:['Fabiano 02 | D-Api','Fabiano | D-Api'] },
    'claudia@apecerto.com': { nome:'Claudia Noviski', perfil:'Corretor', instancias:['Claudia Redmi | Buss','Claudia Redmi | Normal'] },
    'tica@apecerto.com': { nome:'Tica Moura', perfil:'Corretor', instancias:['Tica 02 | D-Api','Tica | D-Api'] },
    'audasantos.grau@gmail.com': { nome:'Edrisia', perfil:'Corretor', instancias:['Claudia 01 | Dapi','Edrisia 1.0 | D-Api'] },
    'elizangela@apecerto.com': { nome:'Elizangela Ferreira', perfil:'Corretor', instancias:['Eliz 2.0 | D-Api','Eliz | D-Api'] },
    'apecerto.oficial@gmail.com': { nome:'Samuel', perfil:'Admin', instancias:[] },
    'comercialromulopedroso@gmail.com': { nome:'Rômulo Pedroso', perfil:'Admin', instancias:[] },
    'pedrosoromulo2@gmail.com': { nome:'Rômulo Pedroso', perfil:'Admin', instancias:[] },
    'pedrosoromulo2006@gmail.com': { nome:'Rômulo Pedroso', perfil:'Admin', instancias:[] }
  };

  function loadRealData(app){
    ['_loadUserConfig','_loadErp','_loadProdutosReal','_loadVendasReal','_loadCaixaReal','_loadVisitasReal','_loadFichasReal','_loadDashKpis','_loadEsteiraAnexos','_loadNotifsReal','_loadMetasReal','_loadPerformanceReal','_loadRankingVgvReal','_loadMidiasProdutos'].forEach(function(name){
      try { if(typeof app[name] === 'function') app[name](); } catch(e) {}
    });
  }

  function apply(){
    if(!lastPayload) return;
    var app = window.__apeLegacyLogic;
    if(!app || typeof app.setState !== 'function'){
      if(attempts++ < 80) setTimeout(apply, 250);
      return;
    }
    var email = String(lastPayload.email || '').toLowerCase();
    var profile = profiles[email] || { nome:lastPayload.name || 'Samuel', perfil:lastPayload.profile || 'Admin', instancias:[] };
    var firstLogin = !(app.state && app.state.authed);
    app._authToken = lastPayload.token;
    app._authUser = { id:lastPayload.userId||null, email:email };
    app._perfilRec = profile;
    try {
      if(app._core && app._core.session){
        app._core.session.nome = profile.nome;
        app._core.session.perfil = profile.perfil;
        app._core.session.instancias = profile.instancias;
        if(app._core.setRole) app._core.setRole(profile.perfil);
      }
    } catch(e) {}
    app.setState({
      authed:true,
      screen:lastPayload.screen || 'inicio',
      sessionNome:profile.nome,
      sessionPerfil:profile.perfil,
      loginPass:''
    }, function(){
      if(firstLogin) loadRealData(app);
      else if(lastPayload.screen === 'performance') { try{ app._loadPerformanceReal(); }catch(e){} }
      else if(lastPayload.screen === 'financeiro') { try{ app._loadVendasReal(); app._loadCaixaReal(); app._loadMetasReal(); app._loadRankingVgvReal(); }catch(e){} }
      if(lastPayload.screen === 'abordagens') setTimeout(function(){ try{ if(window.__apeAbordagens) window.__apeAbordagens(); }catch(e){} }, 200);
    });
    window.parent.postMessage({ type:'apecerto:legacy-opened', screen:lastPayload.screen }, '*');
  }

  window.addEventListener('message', function(event){
    if(event.origin !== window.location.origin) return;
    if(!event.data || event.data.type !== 'apecerto:open-legacy') return;
    lastPayload = event.data;
    attempts = 0;
    apply();
  });
  window.parent.postMessage({ type:'apecerto:legacy-ready' }, '*');
})();
</script>`;

template = template.replace("</body>", `${bridge}\n</body>`);

await writeFile(resolve(projectRoot, "frontend/public/legacy-runtime.html"), template);
console.log("HTML original preparado para integração em frontend/public/legacy-runtime.html.");
