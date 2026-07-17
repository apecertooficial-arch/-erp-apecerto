// @ts-nocheck
"use client";
import { useEffect } from "react";

/* Sara — assistente flutuante GLOBAL (nivel do app, aparece em toda tela). */
export function SaraWidget() {
  useEffect(() => {
    if (typeof window === "undefined" || window.__saraWidget) return;
    window.__saraWidget = true;
    var SB = "https://diaegvfveqezispcthwk.supabase.co";
    var ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpYWVndmZ2ZXFlemlzcGN0aHdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5OTU4MjIsImV4cCI6MjA5ODU3MTgyMn0.312n8BuI-loQrQ20x9j1hNjKZs2UO71ey9gvIo0eY0I";
    var messages = [];
    function fn(body) { return fetch(SB + "/functions/v1/ia-router", { method: "POST", headers: { Authorization: "Bearer " + ANON, apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(function (r) { return r.json(); }); }
    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    function md(s) {
      s = esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
      var lines = s.split("\n"), html = "", list = null, n = 0;
      for (var i = 0; i < lines.length; i++) { var ln = lines[i];
        var mn = ln.match(/^\s*\d+\.\s+(.*)$/), mb = ln.match(/^\s*[-•]\s+(.*)$/);
        if (mn) { if (list !== "ol") { if (list) html += "</" + list + ">"; html += "<ol>"; list = "ol"; } html += "<li>" + mn[1] + "</li>"; }
        else if (mb) { if (list !== "ul") { if (list) html += "</" + list + ">"; html += "<ul>"; list = "ul"; } html += "<li>" + mb[1] + "</li>"; }
        else { if (list) { html += "</" + list + ">"; list = null; } if (ln.trim() !== "") html += "<p>" + ln + "</p>"; }
      }
      if (list) html += "</" + list + ">";
      return html;
    }
    var st = document.createElement("style");
    st.textContent = ["#sara-fab{position:fixed;bottom:24px;right:24px;z-index:170;width:62px;height:62px;border-radius:50%;border:none;cursor:pointer;background:linear-gradient(135deg,#FF7000,#7c3aed);box-shadow:0 10px 30px rgba(124,58,237,.45);display:flex;align-items:center;justify-content:center;transition:transform .18s;}",
    "#sara-fab:hover{transform:scale(1.07) rotate(4deg);}#sara-fab svg{width:28px;height:28px;}",
    "#sara-fab .pulse{position:absolute;inset:0;border-radius:50%;animation:saraP 2.4s infinite;}",
    "@keyframes saraP{0%{box-shadow:0 0 0 0 rgba(124,58,237,.45);}70%{box-shadow:0 0 0 16px rgba(124,58,237,0);}100%{box-shadow:0 0 0 0 rgba(124,58,237,0);}}",
    "#sara-panel{position:fixed;bottom:98px;right:24px;z-index:170;width:388px;max-width:calc(100vw - 32px);height:min(600px,82vh);background:#fff;border-radius:22px;box-shadow:0 24px 70px rgba(20,17,40,.30);display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;transform:translateY(14px) scale(.98);opacity:0;transition:transform .2s,opacity .2s;}",
    "#sara-panel.open{display:flex;transform:translateY(0) scale(1);opacity:1;}",
    "#sara-head{background:linear-gradient(135deg,#FF7000 0%,#a021c9 55%,#7c3aed 100%);color:#fff;padding:16px 18px;display:flex;align-items:center;gap:12px;}",
    "#sara-head .av{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:17px;flex-shrink:0;}",
    "#sara-head b{font-size:16px;display:block;line-height:1.15;}#sara-head .stat{opacity:.95;font-size:11.5px;display:flex;align-items:center;gap:5px;}",
    "#sara-head .stat i{width:7px;height:7px;border-radius:50%;background:#4ade80;display:inline-block;}",
    "#sara-x{margin-left:auto;background:rgba(255,255,255,.15);border:none;color:#fff;width:30px;height:30px;border-radius:50%;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;}",
    "#sara-msgs{flex:1;overflow-y:auto;padding:16px 14px;background:linear-gradient(180deg,#faf9ff,#f4f2fb);display:flex;flex-direction:column;gap:10px;}",
    ".sara-line{display:flex;gap:8px;align-items:flex-end;max-width:88%;}.sara-line.u{align-self:flex-end;flex-direction:row-reverse;}",
    ".sara-line .mini{width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#FF7000,#7c3aed);color:#fff;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-bottom:2px;}",
    ".sara-b{padding:10px 13px;border-radius:15px;font-size:13.5px;line-height:1.5;}",
    ".sara-b.u{background:linear-gradient(135deg,#7c3aed,#a021c9);color:#fff;border-bottom-right-radius:5px;}",
    ".sara-b.a{background:#fff;color:#28263a;border:1px solid #ececf3;border-bottom-left-radius:5px;}",
    ".sara-b.a p{margin:0 0 6px;}.sara-b.a p:last-child{margin-bottom:0;}.sara-b.a ol,.sara-b.a ul{margin:4px 0 4px 2px;padding-left:18px;}.sara-b.a li{margin:3px 0;}.sara-b.a strong{font-weight:700;color:#1c1a29;}",
    ".sara-chips{display:flex;flex-wrap:wrap;gap:7px;padding:2px 2px 4px 36px;}",
    ".sara-chip{background:#fff;border:1px solid #e0dcf0;color:#7c3aed;font-size:12px;font-weight:600;padding:7px 12px;border-radius:999px;cursor:pointer;}",
    ".sara-chip:hover{background:#7c3aed;color:#fff;}",
    ".sara-typing{display:flex;gap:4px;padding:12px 14px;}.sara-typing span{width:7px;height:7px;border-radius:50%;background:#b7add9;animation:saraT 1.2s infinite;}",
    ".sara-typing span:nth-child(2){animation-delay:.2s;}.sara-typing span:nth-child(3){animation-delay:.4s;}",
    "@keyframes saraT{0%,60%,100%{transform:translateY(0);opacity:.5;}30%{transform:translateY(-4px);opacity:1;}}",
    "#sara-foot{display:flex;gap:9px;padding:12px;border-top:1px solid #eee;background:#fff;align-items:flex-end;}",
    "#sara-in{flex:1;border:1px solid #ddd8ee;border-radius:22px;padding:11px 15px;font-size:13.5px;font-family:inherit;resize:none;max-height:96px;outline:none;}#sara-in:focus{border-color:#7c3aed;}",
    "#sara-send{border:none;background:linear-gradient(135deg,#FF7000,#7c3aed);color:#fff;border-radius:50%;width:42px;height:42px;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;}#sara-send svg{width:19px;height:19px;}"].join("");
    document.head.appendChild(st);
    var spark = '<svg viewBox="0 0 24 24" fill="#fff"><path d="M12 2l1.9 5.1L19 9l-5.1 1.9L12 16l-1.9-5.1L5 9l5.1-1.9L12 2z"/><path d="M19 14l.9 2.4L22 17l-2.1.6L19 20l-.9-2.4L16 17l2.1-.6L19 14z"/></svg>';
    var fab = document.createElement("button"); fab.id = "sara-fab"; fab.title = "Falar com a Sara"; fab.innerHTML = '<span class="pulse"></span>' + spark;
    var panel = document.createElement("div"); panel.id = "sara-panel";
    panel.innerHTML = '<div id="sara-head"><div class="av">S</div><div><b>Sara</b><span class="stat"><i></i> assistente Apecerto · online</span></div><button id="sara-x">×</button></div><div id="sara-msgs"></div><div id="sara-foot"><textarea id="sara-in" rows="1" placeholder="Pergunte algo ou peca uma direcao..."></textarea><button id="sara-send"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg></button></div>';
    document.body.appendChild(fab); document.body.appendChild(panel);
    var msgsEl = panel.querySelector("#sara-msgs"), inEl = panel.querySelector("#sara-in");
    function bubble(role, content) {
      var line = document.createElement("div"); line.className = "sara-line " + (role === "user" ? "u" : "a");
      var mini = document.createElement("div"); mini.className = "mini"; mini.textContent = role === "user" ? "" : "S";
      var b = document.createElement("div"); b.className = "sara-b " + (role === "user" ? "u" : "a");
      if (role === "user") b.textContent = content; else b.innerHTML = md(content);
      if (role !== "user") line.appendChild(mini);
      line.appendChild(b); msgsEl.appendChild(line); msgsEl.scrollTop = msgsEl.scrollHeight; return b;
    }
    function typing() { var line = document.createElement("div"); line.className = "sara-line a"; line.innerHTML = '<div class="mini">S</div><div class="sara-b a sara-typing"><span></span><span></span><span></span></div>'; msgsEl.appendChild(line); msgsEl.scrollTop = msgsEl.scrollHeight; return line; }
    var greeted = false;
    var sugestoes = ["Como respondo objeção de preço?", "Como conduzo para a visita?", "Como qualifico um lead novo?"];
    function greet() {
      bubble("assistant", "Oi! Eu sou a Sara. Posso ajudar com dúvidas do sistema, produtos, objeções de cliente ou dar uma direção no atendimento. Como posso te ajudar?");
      var chips = document.createElement("div"); chips.className = "sara-chips";
      sugestoes.forEach(function (s) { var c = document.createElement("button"); c.className = "sara-chip"; c.textContent = s; c.onclick = function () { chips.remove(); enviar(s); }; chips.appendChild(c); });
      msgsEl.appendChild(chips); msgsEl.scrollTop = msgsEl.scrollHeight;
    }
    function open() { panel.classList.add("open"); if (!greeted) { greeted = true; greet(); } setTimeout(function () { inEl.focus(); }, 60); }
    function close() { panel.classList.remove("open"); }
    fab.onclick = function () { panel.classList.contains("open") ? close() : open(); };
    panel.querySelector("#sara-x").onclick = close;
    async function enviar(texto) {
      var txt = (texto != null ? texto : inEl.value).trim(); if (!txt) return; inEl.value = "";
      bubble("user", txt); messages.push({ role: "user", content: txt }); var t = typing();
      try { var r = await fn({ agente_nome: "Sara", messages: messages.slice(-12) }); t.remove();
        if (r && r.ok) { var resp = r.resposta || (typeof r.saida === "string" ? r.saida : JSON.stringify(r.saida)); bubble("assistant", resp); messages.push({ role: "assistant", content: resp }); }
        else { bubble("assistant", (r && r.reason === "sem_chave") ? "Estou sem chave de IA configurada." : "Ops, tive um problema pra responder agora. Tenta de novo?"); }
      } catch (e) { t.remove(); bubble("assistant", "Sem conexão agora. Tenta de novo em instantes."); }
    }
    panel.querySelector("#sara-send").onclick = function () { enviar(); };
    inEl.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } });
    inEl.addEventListener("input", function () { inEl.style.height = "auto"; inEl.style.height = Math.min(inEl.scrollHeight, 96) + "px"; });
  }, []);
  return null;
}
