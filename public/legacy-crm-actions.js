(function () {
  "use strict";

  var styleAdded = false;
  var activeModal = null;
  var money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function phone(value) { return String(value || "").replace(/\D/g, "").slice(-11); }
  function localInput(hours) {
    var date = new Date(Date.now() + (hours || 0) * 3600000);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  }
  function authHeaders(json) {
    var app = window.__apeLegacyLogic;
    var token = app && app._authToken;
    var headers = { Authorization: "Bearer " + token };
    if (json) headers["Content-Type"] = "application/json";
    return headers;
  }
  async function request(path, options) {
    var response = await fetch(path, options || { headers: authHeaders(false) });
    var result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível concluir esta ação.");
    return result;
  }
  function notify(message) {
    var app = window.__apeLegacyLogic;
    if (app && typeof app.showToast === "function") app.showToast(message);
  }
  function addStyle() {
    if (styleAdded) return;
    styleAdded = true;
    var style = document.createElement("style");
    style.textContent = ".ape-crm-action{position:fixed;inset:0;z-index:1000000;display:grid;place-items:center;padding:20px;background:rgba(31,24,20,.48);font-family:var(--font-body,Arial,sans-serif)}.ape-crm-action *{box-sizing:border-box}.ape-crm-action form{width:min(620px,96vw);max-height:92vh;overflow:auto;border-radius:17px;background:#fff;box-shadow:0 28px 80px rgba(35,20,10,.3)}.ape-crm-action header{display:flex;justify-content:space-between;gap:20px;padding:19px 21px 14px;border-bottom:1px solid #eee7e2}.ape-crm-action header span{color:#d95708;font-size:10px;font-weight:850;letter-spacing:.1em}.ape-crm-action h2{margin:4px 0 3px;font-size:20px;color:#292421}.ape-crm-action header p{margin:0;color:#8d837d;font-size:11px}.ape-crm-action .ape-x{width:31px;height:31px;border:0;border-radius:50%;background:#f2efed;color:#645b56;font-size:20px}.ape-action-body{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:18px 21px}.ape-action-body label{display:flex;flex-direction:column;gap:5px;color:#645c57;font-size:10px;font-weight:750}.ape-action-body label.wide,.ape-action-message{grid-column:1/-1}.ape-action-body input,.ape-action-body select,.ape-action-body textarea{width:100%;border:1px solid #ddd5d0;border-radius:10px;padding:10px 11px;background:#fff;color:#302b28;font:inherit;outline:0}.ape-action-body textarea{resize:vertical}.ape-action-body input:focus,.ape-action-body select:focus,.ape-action-body textarea:focus{border-color:#ff7a28;box-shadow:0 0 0 3px rgba(255,101,0,.09)}.ape-action-message{display:none;padding:10px 12px;border-radius:9px;background:#fdeaea;color:#ad342b;font-size:11px}.ape-action-message.show{display:block}.ape-crm-action footer{display:flex;justify-content:flex-end;gap:8px;padding:14px 21px;border-top:1px solid #eee7e2}.ape-crm-action footer button{min-height:39px;border:1px solid #ddd5d0;border-radius:10px;padding:0 15px;background:#fff;color:#5c534e;font-weight:750}.ape-crm-action footer .primary{border-color:#ff6500;background:#ff6500;color:#fff}.ape-crm-action footer button:disabled{opacity:.5}.ape-ai-copy{min-height:170px;line-height:1.5}.ape-action-hint{grid-column:1/-1;margin:0;padding:10px 12px;border-radius:9px;background:#f8f1fb;color:#782b9c;font-size:10px}@media(max-width:620px){.ape-action-body{grid-template-columns:1fr}.ape-action-body label.wide,.ape-action-message,.ape-action-hint{grid-column:auto}}";
    document.head.appendChild(style);
  }
  function productOptions(products, selected) {
    return '<option value="">Selecione</option>' + products.map(function (item) { return '<option value="' + esc(item.id) + '"' + (String(item.id) === String(selected || "") ? " selected" : "") + '>' + esc(item.nome) + "</option>"; }).join("");
  }
  function modalConfig(action, name) {
    var map = {
      task: ["AGENDA COMERCIAL", "Nova tarefa", "Registre o próximo passo para este lead.", "Criar tarefa"],
      callReminder: ["AGENDA COMERCIAL", "Lembrete de ligação", "Agende o retorno para " + name + ".", "Salvar lembrete"],
      visit: ["AGENDA DE VISITAS", "Agendar visita", "A visita ficará vinculada ao lead e ao negócio.", "Agendar visita"],
      product: ["ENVIO PELO WHATSAPP", "Enviar produto", "Selecione o imóvel e o material que será enviado.", "Enviar produto"],
      proposal: ["NEGOCIAÇÃO", "Gerar proposta", "Registre valor e condições no histórico do negócio.", "Salvar proposta"],
      financing: ["CRÉDITO IMOBILIÁRIO", "Financiamento", "Abra uma ficha em rascunho para completar depois.", "Criar ficha"],
      transfer: ["DISTRIBUIÇÃO", "Transferir atendimento", "Escolha o corretor que assumirá este negócio.", "Transferir"],
      note: ["HISTÓRICO DO LEAD", "Adicionar observação", "A observação ficará registrada no Supabase.", "Salvar observação"],
      ai: ["ASSISTENTE COMERCIAL", "Pedir à IA", "Sugestão construída a partir do contexto atual do lead.", "Copiar sugestão"],
      sale: ["PROCESSO DE VENDA", "Enviar para processo de venda", "Crie a venda e inicie a esteira de documentação.", "Criar venda"]
    };
    return map[action] || map.task;
  }
  function bodyFor(action, lead, deal, crm, chat, payload) {
    var products = chat.products || crm.products || [];
    var productId = deal.empreendimento_id || "";
    var options = productOptions(products, productId);
    var next = localInput(1);
    var tomorrow = localInput(24).slice(0, 10);
    if (action === "task" || action === "callReminder") return '<label class="wide">Título<input name="title" required value="' + esc(action === "callReminder" ? "Ligar para " + (lead.nome || "cliente") : payload.defaultTitle || "") + '"></label><label>Data e hora<input name="due" required type="datetime-local" value="' + next + '"></label><label>Prioridade<select name="priority"><option>normal</option><option>alta</option><option>baixa</option></select></label><label class="wide">Descrição<textarea name="description" rows="3"></textarea></label>';
    if (action === "visit") return '<label>Data<input name="date" required type="date" value="' + tomorrow + '"></label><label>Produto<select name="productId">' + options + '</select></label><label>Início<input name="startTime" required type="time" value="10:00"></label><label>Fim<input name="endTime" type="time" value="11:00"></label><label class="wide">Local<input name="local" placeholder="Usa o endereço do produto quando vazio"></label><label class="wide">Observações<textarea name="description" rows="3"></textarea></label>';
    if (action === "product") return '<label class="wide">Produto<select name="productId" required>' + options + '</select></label><label class="wide">Material<select name="mediaId"><option value="">Somente resumo do produto</option></select></label><p class="ape-action-hint">O envio usará a instância conectada ao histórico deste lead.</p>';
    if (action === "proposal") return '<label>Produto<select name="productId">' + options + '</select></label><label>Valor da proposta<input name="value" required type="number" min="1" value="' + esc(deal.valor || payload.value || "") + '"></label><label class="wide">Condições<textarea name="description" rows="5" placeholder="Entrada, parcelas, validade e condições"></textarea></label>';
    if (action === "financing") return '<label>Produto<select name="productId">' + options + '</select></label><label>Valor do imóvel<input name="value" required type="number" min="1" value="' + esc(deal.valor || payload.value || "") + '"></label><label>Entrada<input name="downPayment" type="number" min="0" value="0"></label><label class="wide"><span><input name="consent" type="checkbox" style="width:auto"> Consentimento LGPD confirmado</span></label>';
    if (action === "transfer") return '<label class="wide">Novo corretor<select name="brokerId" required><option value="">Selecione</option>' + (crm.brokers || []).filter(function (broker) { return broker.id !== deal.corretor_id; }).map(function (broker) { return '<option value="' + broker.id + '">' + esc(broker.nome) + (broker.online ? " · online" : "") + "</option>"; }).join("") + "</select></label>";
    if (action === "note") return '<label class="wide">Observação<textarea name="description" required rows="7" autofocus></textarea></label>';
    if (action === "sale") return '<label class="wide">Produto<select name="productId" required>' + options + '</select></label><label class="wide">Valor da venda<input name="value" required type="number" min="1" value="' + esc(deal.valor || payload.value || "") + '"></label>';
    var product = products.find(function (item) { return String(item.id) === String(productId); });
    var suggestion = "Retome o contato com " + (lead.nome || "o cliente") + " de forma objetiva. " + (product ? "Confirme se o interesse em " + product.nome + " continua ativo, " : "Confirme o perfil de imóvel e a faixa de valor, ") + "ofereça duas opções concretas de próximo passo e encerre com uma pergunta simples para facilitar a resposta.";
    return '<label class="wide">Sugestão<textarea class="ape-ai-copy" name="suggestion" readonly>' + esc(suggestion) + '</textarea></label><p class="ape-action-hint">Você pode copiar esta sugestão ou transformá-la em uma tarefa de follow-up.</p>';
  }

  async function open(action, payload) {
    action = action === "followup" ? "task" : action === "tasks" ? "task" : action;
    addStyle();
    if (activeModal) activeModal.remove();
    try {
      var results = await Promise.all([request("/api/crm", { headers: authHeaders(false) }), request("/api/live-chat", { headers: authHeaders(false) })]);
      var crm = results[0], chat = results[1];
      var dealId = Number(String(payload.dealId || "").replace(/^erp_/, ""));
      var deal = (crm.deals || []).find(function (item) { return item.id === dealId; });
      var lead = deal && (crm.leads || []).find(function (item) { return item.id === deal.lead_id; });
      if (!lead) lead = (crm.leads || []).find(function (item) { return phone(item.telefone) && phone(item.telefone) === phone(payload.phone); });
      if (!deal && lead) deal = (crm.deals || []).find(function (item) { return item.lead_id === lead.id; });
      if (!lead || !deal) throw new Error("Este card ainda não está associado a um negócio real do CRM.");
      var cfg = modalConfig(action, lead.nome || payload.name || "cliente");
      var layer = document.createElement("div"); activeModal = layer; layer.className = "ape-crm-action";
      layer.innerHTML = '<form><header><div><span>' + cfg[0] + "</span><h2>" + esc(cfg[1]) + "</h2><p>" + esc(cfg[2]) + '</p></div><button class="ape-x" type="button">×</button></header><div class="ape-action-body">' + bodyFor(action, lead, deal, crm, chat, payload) + '<div class="ape-action-message"></div></div><footer><button type="button" data-cancel>Cancelar</button><button class="primary" type="submit">' + esc(cfg[3]) + "</button></footer></form>";
      document.body.appendChild(layer);
      var form = layer.querySelector("form"), error = layer.querySelector(".ape-action-message"), submit = form.querySelector('button[type="submit"]');
      function close() { layer.remove(); if (activeModal === layer) activeModal = null; }
      layer.querySelector(".ape-x").onclick = close; layer.querySelector("[data-cancel]").onclick = close;
      layer.onmousedown = function (event) { if (event.target === layer) close(); };
      var productSelect = form.elements.productId, mediaSelect = form.elements.mediaId;
      if (productSelect && mediaSelect) productSelect.onchange = function () { mediaSelect.innerHTML = '<option value="">Somente resumo do produto</option>' + (chat.media || []).filter(function (item) { return String(item.empreendimento_id) === String(productSelect.value); }).map(function (item) { return '<option value="' + esc(item.id) + '">' + esc(item.tipo + " · " + (item.categoria || item.nome || "material")) + "</option>"; }).join(""); };
      form.onsubmit = async function (event) {
        event.preventDefault(); error.className = "ape-action-message"; submit.disabled = true; submit.textContent = "Salvando…";
        try {
          var values = Object.fromEntries(new FormData(form).entries());
          if (action === "ai") { await navigator.clipboard.writeText(values.suggestion); notify("Sugestão copiada."); close(); return; }
          var path = "/api/live-chat", method = "POST", body;
          if (action === "task" || action === "callReminder") body = { action: action, leadId: lead.id, dealId: deal.id, name: lead.nome, title: values.title, description: values.description, due: values.due, priority: values.priority };
          if (action === "visit") { path = "/api/crm"; method = "PATCH"; body = { action: "createVisit", leadId: lead.id, dealId: deal.id, productId: values.productId || null, date: values.date, startTime: values.startTime, endTime: values.endTime, local: values.local, observations: values.description, reminder: true }; }
          if (action === "proposal") body = { action: "proposal", leadId: lead.id, dealId: deal.id, productId: values.productId || null, value: values.value, conditions: values.description };
          if (action === "financing") body = { action: "financing", leadId: lead.id, dealId: deal.id, productId: values.productId || null, name: lead.nome, phone: lead.telefone, email: lead.email, value: values.value, downPayment: values.downPayment, financing: Math.max(0, Number(values.value) - Number(values.downPayment)), consent: values.consent === "on" };
          if (action === "transfer") body = { action: "transfer", leadId: lead.id, dealId: deal.id, brokerId: Number(values.brokerId) };
          if (action === "note") body = { action: "note", leadId: lead.id, dealId: deal.id, content: values.description };
          if (action === "sale") { path = "/api/crm/sales"; method = "PATCH"; body = { action: "create", dealId: deal.id, productId: values.productId, vgv: Number(values.value) }; }
          if (action === "product") {
            var selectedProduct = (chat.products || []).find(function (item) { return String(item.id) === String(values.productId); });
            var contact = (chat.contacts || []).find(function (item) { return item.lead_id === lead.id || phone(item.telefone) === phone(lead.telefone); });
            var conversation = contact && (chat.conversations || []).find(function (item) { return item.contato_id === contact.id; });
            var waInstance = conversation && (chat.instances || []).find(function (item) { return item.id === conversation.instancia_id; });
            var dapi = (chat.dapi || []).find(function (item) { return item.instancia_dapi === (waInstance && waInstance.session_id); }) || (chat.dapi || []).find(function (item) { return item.conectada; });
            if (!contact || !dapi || !selectedProduct) throw new Error("Este lead precisa ter conversa e instância conectada para enviar o produto.");
            body = { action: "send", leadId: lead.id, dealId: deal.id, phone: contact.telefone, instanceId: dapi.id, mediaId: values.mediaId || undefined, content: selectedProduct.nome + " · " + [selectedProduct.bairro, selectedProduct.cidade].filter(Boolean).join(", ") + " · " + (selectedProduct.preco ? money.format(selectedProduct.preco) : "valor sob consulta") };
          }
          await request(path, { method: method, headers: authHeaders(true), body: JSON.stringify(body) });
          notify(action === "product" ? "Produto enviado pelo WhatsApp." : "Ação salva no Supabase."); close();
        } catch (reason) { error.textContent = reason && reason.message ? reason.message : "Não foi possível concluir."; error.className = "ape-action-message show"; submit.disabled = false; submit.textContent = cfg[3]; }
      };
    } catch (reason) { notify(reason && reason.message ? reason.message : "Não foi possível abrir esta ação."); }
  }

  window.__apeCrmAction = open;
})();
