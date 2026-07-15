/*
 * ApeCore — camada operacional do Sistema Operacional ApeCerto.
 * Responsabilidade: persistência + regras de negócio + eventos + notificações
 * + histórico (auditoria) + sessão/permissões (RBAC).
 *
 * Arquitetura em camadas (pronta pra Supabase):
 *   UI (componentes)  ->  ApeCore.services (regras)  ->  repos/persist (dados)
 * A troca por Supabase exige apenas reimplementar `persist` (load/save) e os
 * repos; a lógica das telas não muda.
 */
(function () {
  if (window.ApeCore && window.ApeCore.__init) return;
  var LS_KEY = 'apecerto_os_v1';

  // ---------- Camada de persistência (trocável por Supabase) ----------
  var persist = {
    load: function () { try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch (e) { return null; } },
    save: function (db) { try { localStorage.setItem(LS_KEY, JSON.stringify(db)); } catch (e) {} }
  };

  // ---------- Motor de eventos ----------
  var bus = {};
  function on(ev, fn) { (bus[ev] = bus[ev] || []).push(fn); return function () { bus[ev] = (bus[ev] || []).filter(function (f) { return f !== fn; }); }; }
  function emit(ev, payload) { (bus[ev] || []).forEach(function (fn) { try { fn(payload); } catch (e) {} }); (bus['*'] || []).forEach(function (fn) { try { fn(ev, payload); } catch (e) {} }); }

  // ---------- Utilitários ----------
  var _seq = 0;
  function uid(p) { _seq++; return (p || 'id') + '_' + Date.now().toString(36) + _seq.toString(36); }
  function today() { var d = new Date(); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); }
  function brl(n) { return 'R$ ' + Math.round(Number(n) || 0).toLocaleString('pt-BR'); }

  var db = null;

  // ---------- Sessão + permissões (RBAC) ----------
  var ROLE_PERMS = {
    Admin: ['*'],
    Diretor: ['ver', 'criar', 'editar', 'financeiro', 'comissoes', 'dashboards', 'usuarios', 'produtos', 'ia', 'integracoes'],
    Gestor: ['ver', 'criar', 'editar', 'comissoes', 'dashboards', 'produtos'],
    Financeiro: ['ver', 'financeiro', 'comissoes', 'dashboards'],
    Corretor: ['ver', 'criar', 'produtos'],
    Atendimento: ['ver', 'criar']
  };
  var session = { nome: 'Julia Moraes', role: 'Admin' };
  function can(perm) { var p = ROLE_PERMS[session.role] || []; return p.indexOf('*') >= 0 || p.indexOf(perm) >= 0; }

  // ---------- Histórico (auditoria) + notificações ----------
  function history(entry) {
    db._history.unshift(Object.assign({ id: uid('h'), at: Date.now(), user: session.nome, device: 'web' }, entry));
    if (db._history.length > 500) db._history.length = 500;
    emit('history.add', entry);
  }
  function notify(n) {
    db._notifs.unshift(Object.assign({ id: uid('n'), at: Date.now(), read: false, ago: 'agora' }, n));
    if (db._notifs.length > 200) db._notifs.length = 200;
    emit('notify.add', n);
  }

  // ---------- Repositório genérico (CRUD centralizado) ----------
  function repo(coll) {
    return {
      all: function () { return db[coll] || []; },
      get: function (id) { return (db[coll] || []).find(function (x) { return x.id === id; }); },
      create: function (data) {
        var rec = Object.assign({ id: uid(coll) }, data);
        (db[coll] = db[coll] || []).push(rec);
        history({ action: 'create', module: coll, ref: rec.id });
        persist.save(db); emit(coll + '.created', rec); emit('change', { coll: coll });
        return rec;
      },
      update: function (id, patch) {
        var rec = null;
        db[coll] = (db[coll] || []).map(function (x) { return x.id === id ? (rec = Object.assign({}, x, patch)) : x; });
        history({ action: 'update', module: coll, ref: id });
        persist.save(db); emit(coll + '.updated', rec); emit('change', { coll: coll });
        return rec;
      },
      remove: function (id) {
        db[coll] = (db[coll] || []).filter(function (x) { return x.id !== id; });
        history({ action: 'delete', module: coll, ref: id });
        persist.save(db); emit(coll + '.deleted', { id: id }); emit('change', { coll: coll });
      }
    };
  }

  // ---------- Regras de negócio (detalhe financeiro de uma venda) ----------
  function buildDetail(v) {
    var neg = Number(v.valorNeg) || Math.round(v.vgv * 0.985 / 1000) * 1000;
    var parcelas = v.pgto === 'À vista' ? 1 : (Number(v.parcelas) > 0 ? Number(v.parcelas) : 3);
    var comBruta = neg * v.comPct / 100;
    // Split da COMISSÃO LÍQUIDA (após despesas e indicação): corretor + executivo + apêcerto.
    var parts = [
      { nome: 'apêcerto', funcao: 'Imobiliária', pct: 55, pago: true },
      { nome: v.corretor, funcao: 'Corretor', pct: 35, pago: false },
      { nome: 'Rômulo Dias', funcao: 'Executivo', pct: 10, pago: false }
    ];
    // Indicação: 10% da comissão BRUTA vai para o corretor indicador (deduzida antes do split).
    if (v.parceiro) parts.push({ nome: v.parceiro, funcao: 'Indicação', pct: 0, pago: false });
    // Despesas para fechar o negócio (deduzidas da comissão bruta).
    var custos = (v.custos && v.custos.length) ? v.custos : [
      { tipo: 'Cartório e registro', valor: Math.round(neg * 0.006) },
      { tipo: 'Documentação e taxas', valor: Math.round(neg * 0.002) }
    ];
    var per = Math.round(comBruta / parcelas), recs = [];
    for (var i = 0; i < parcelas; i++) recs.push({ parcela: (i + 1) + '/' + parcelas, prev: per, recebido: 0, dataPrev: v.data || today(), dataReceb: '—', conta: 'Itaú PJ', forma: v.pgto, status: 'Previsto' });
    return { valorNeg: neg, parcelas: parcelas, empreendimento: v.produto, construtora: v.construtora || '—', campanha: v.campanha || 'Moema pronto pra morar', origem: v.origem || 'Instagram', executivo: 'Rômulo Dias', gerente: 'Marina Chef', formaPgto: v.pgto, participantes: parts, custos: custos, recebimentos: recs };
  }

  // ---------- Serviços (o que os botões executam de verdade) ----------
  var services = {
    // Nova venda -> cliente + financeiro (contas a receber) + comissão + caixa previsto + timeline + notificação + histórico
    criarVenda: function (input) {
      if (!input.cliente || !input.produto || !(Number(input.vgv) > 0)) throw new Error('Preencha cliente, produto e VGV.');
      var v = Object.assign({ id: uid('venda'), status: 'Aguardando', data: today(), receb: '—', parceiro: null, comCorPct: Number(input.comPct) >= 5 ? 2 : 1.5 }, input);
      v.vgv = Number(input.vgv); v.comPct = Number(input.comPct) || 4; v.valorNeg = Number(input.valorNeg) || v.vgv;
      db.vendas.push(v);
      db.vendasX[v.id] = buildDetail(v);
      var comBruta = v.valorNeg * v.comPct / 100;
      // contas a receber (fluxo de caixa previsto)
      db.lancamentos.unshift({ data: v.data, tipo: 'entrada', cat: 'Comissão de venda', prev: Math.round(comBruta), real: 0, conta: 'Itaú PJ', status: 'previsto', venda: v.produto, corretor: v.corretor });
      // cliente entra na base (uma vez)
      if (!db.leads.some(function (l) { return l.nome === v.cliente; })) db.leads.unshift({ id: Date.now(), nome: v.cliente, tel: '(11) 90000-0000', valor: v.vgv, bairro: v.bairro || 'Moema', ape: v.produto, tags: ['Cliente'], stage: 'fechado', temp: 'quente', last: 'Compra registrada', ago: 'agora', fonte: 'Venda' });
      notify({ titulo: 'Nova venda registrada', sub: v.produto + ' · ' + brl(v.vgv) + ' · ' + v.corretor, icon: 'check', cor: '#1FA85A' });
      history({ action: 'create', module: 'vendas', ref: v.id, desc: 'Venda ' + v.cliente + ' — ' + brl(v.vgv) });
      persist.save(db); emit('vendas.created', v); emit('change', { coll: 'vendas' });
      return v;
    },
    novoLancamento: function (input) {
      if (!input.cat || !(Number(input.valor) > 0)) throw new Error('Informe categoria e valor.');
      var val = Number(input.valor), st = input.status || 'previsto';
      db.lancamentos.unshift({ data: today(), tipo: input.tipo || 'entrada', cat: input.cat, prev: val, real: st === 'previsto' ? 0 : val, conta: input.conta || 'Itaú PJ', status: st, venda: null, corretor: null });
      notify({ titulo: 'Lançamento no caixa', sub: (input.tipo === 'saída' ? 'Saída' : 'Entrada') + ' · ' + brl(val) + ' · ' + input.cat, icon: 'wallet', cor: input.tipo === 'saída' ? '#E5484D' : '#1FA85A' });
      history({ action: 'create', module: 'caixa', desc: input.cat + ' ' + brl(val) });
      persist.save(db); emit('change', { coll: 'lancamentos' });
      return true;
    },
    novoLead: function (input) {
      if (!input.nome) throw new Error('Informe o nome do lead.');
      var lead = { id: Date.now(), nome: input.nome, tel: input.tel || '(11) 90000-0000', valor: Number(input.valor) || 0, bairro: input.bairro || 'Moema', ape: input.ape || 'A definir', tags: [input.origem || 'Instagram'], stage: 'novo', temp: 'quente', last: 'Lead criado', ago: 'agora', fonte: input.origem || 'Instagram' };
      db.leads.unshift(lead);
      notify({ titulo: 'Novo lead recebido', sub: lead.nome + ' · ' + (lead.fonte), icon: 'sparkle', cor: '#FF7000' });
      history({ action: 'create', module: 'crm', desc: 'Lead ' + lead.nome });
      persist.save(db); emit('leads.created', lead); emit('change', { coll: 'leads' });
      return lead;
    },
    cadastrarProduto: function (input) {
      if (!input.nome) throw new Error('Informe o nome do empreendimento.');
      var p = { id: Date.now(), nome: input.nome, tipo: input.tipo || 'Apartamento', bairro: input.bairro || 'Moema', cidade: 'São Paulo', endereco: input.endereco || '—', incorporadora: input.incorporadora || '—', status: input.status || 'Lançamento', metragem: Number(input.metragem) || 0, dorms: Number(input.dorms) || 0, suites: 0, vagas: Number(input.vagas) || 0, valor: Number(input.valor) || 0, entrada: 0, financ: 0, parcelas: 120, comissao: 4, disp: Number(input.disp) || 1, leads: 0, cor: '#FF7000', descricao: input.descricao || '', pontos: [], objecoes: [], publico: '—', materiais: [], unidades: [] };
      db.produtos.push(p);
      notify({ titulo: 'Produto cadastrado', sub: p.nome + ' · ' + p.bairro, icon: 'building2', cor: '#8B00CC' });
      history({ action: 'create', module: 'produtos', ref: p.id, desc: p.nome });
      persist.save(db); emit('change', { coll: 'produtos' });
      return p;
    },
    novoUsuario: function (input) {
      if (!input.nome || !input.email) throw new Error('Informe nome e e-mail.');
      var u = { nome: input.nome, email: input.email, creci: input.creci || '—', tipo: input.tipo || 'Corretor', status: 'ativo', leads: 0, vendas: 0, acum: 0, pago: 0, pend: 0 };
      db.usuarios.push(u);
      notify({ titulo: 'Usuário criado', sub: u.nome + ' · ' + u.tipo, icon: 'users', cor: '#2F6FED' });
      history({ action: 'create', module: 'usuarios', desc: u.nome + ' (' + u.tipo + ')' });
      persist.save(db); emit('change', { coll: 'usuarios' });
      return u;
    },
    agendarVisita: function (input) {
      if (!input.dia || !input.lead) throw new Error('Informe lead e dia.');
      var ev = { dia: Number(input.dia), t: (input.hora || '10h') + ' · ' + input.lead, cor: '#F2A82C' };
      db.eventos.push(ev);
      notify({ titulo: 'Visita agendada', sub: input.lead + ' · dia ' + input.dia + ' ' + (input.hora || ''), icon: 'calendar', cor: '#F2A82C' });
      history({ action: 'create', module: 'agenda', desc: 'Visita ' + input.lead });
      persist.save(db); emit('change', { coll: 'eventos' });
      return ev;
    }
  };

  // ---------- Bootstrap ----------
  function seed(initial) {
    var stored = persist.load();
    if (stored && stored.__v === 7) { db = stored; return db; }
    db = Object.assign({ __v: 7, _notifs: [], _history: [], eventos: [] }, initial);
    // notificações iniciais (se vierem do seed) já entram como feed
    if (initial && initial.notifs) { db._notifs = initial.notifs.map(function (n) { return Object.assign({ id: uid('n'), at: Date.now(), read: false }, n); }); }
    persist.save(db);
    return db;
  }
  function set(coll, arr) { db[coll] = arr; persist.save(db); }

  window.ApeCore = {
    __init: true,
    seed: seed, on: on, emit: emit, repo: repo, services: services, set: set,
    notify: notify, history: history, can: can, session: session, brl: brl, uid: uid, today: today,
    get db() { return db; },
    notifs: function () { return db ? db._notifs : []; },
    historyLog: function () { return db ? db._history : []; },
    setRole: function (r) { session.role = r; emit('change', { coll: 'session' }); },
    reset: function () { localStorage.removeItem(LS_KEY); db = null; }
  };
})();
