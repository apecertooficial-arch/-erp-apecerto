"use client";
/* Doc §19 — Configurações completo: módulo admin com seções; Conexões vira UMA seção.
   Para corretor, mantém exatamente o comportamento anterior (só Conexões). */
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";
import { ConnectionsWorkspace } from "./ConnectionsWorkspace";
import { PresenceConfig } from "../presence/PresenceConfig";

type PipelineInfo = { id: number; nome: string; grupo: string | null; ordem: number | null; etapas: Array<{ id: number; nome: string; ordem: number | null; cor: string | null }> };
type AdminConfig = {
  empresa: Record<string, string>;
  distribuicao_pausada: boolean;
  ips: string[];
  comissao: { versao?: string; descricao?: string; vigente_de?: string; vigente_ate?: string; parametros?: Record<string, unknown> };
  pipelines: PipelineInfo[];
  instancias: Array<{ id: number; nome: string; telefone: string | null; conectada: boolean; ativa: boolean }>;
};

const SECTIONS = [
  { key: "empresa", label: "Empresa", sub: "Dados e identidade", icon: "▦" },
  { key: "conexoes", label: "Conexões (WhatsApp)", sub: "Instâncias e status", icon: "▤" },
  { key: "usuarios", label: "Usuários & Permissões", sub: "Acessos da equipe", icon: "◫" },
  { key: "crm", label: "CRM & Pipelines", sub: "Etapas e funil", icon: "⌥" },
  { key: "esteira", label: "Esteira de vendas", sub: "Etapas, responsáveis e documentos", icon: "◆" },
  { key: "presenca", label: "Regra de presença", sub: "Corretor online de verdade", icon: "🛡" },
  { key: "financeiro", label: "Financeiro", sub: "Comissões e metas", icon: "▣" },
  { key: "seguranca", label: "Segurança", sub: "Sessões e RLS", icon: "▪" },
  { key: "integracoes", label: "Integrações & IA", sub: "APIs e agentes", icon: "✦" },
] as const;
type SectionKey = typeof SECTIONS[number]["key"];

export function SettingsWorkspace({ accessToken, sessionRole, onNavigate }: { accessToken: string; sessionRole: string; onNavigate?: (module: string) => void }) {
  const isAdmin = sessionRole !== "corretor";
  const [section, setSection] = useState<SectionKey>("empresa");
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [company, setCompany] = useState<Record<string, string>>({});
  const [ipsText, setIpsText] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    void getBrowserSupabaseClient().rpc("erp_config_atual").then(({ data, error: rpcError }) => {
      if (rpcError) { setError(rpcError.message); return; }
      const result = data as AdminConfig;
      setConfig(result);
      setCompany(result.empresa ?? {});
      setIpsText((result.ips ?? []).join("\n"));
    });
  }, [isAdmin, accessToken]);

  if (!isAdmin) return <ConnectionsWorkspace accessToken={accessToken} />;

  async function saveCompany() {
    setSaving(true); setToast("");
    const { error: rpcError } = await getBrowserSupabaseClient().rpc("erp_settings_salvar", { p_chave: "empresa", p_valor: company });
    setToast(rpcError ? rpcError.message : "Dados da empresa salvos.");
    setSaving(false);
  }

  async function toggleDistribution(paused: boolean) {
    setSaving(true); setToast("");
    const { error: rpcError } = await getBrowserSupabaseClient().rpc("erp_toggle_distribuicao", { p_pausada: paused });
    if (rpcError) setToast(rpcError.message);
    else { setConfig((current) => current ? { ...current, distribuicao_pausada: paused } : current); setToast(paused ? "Distribuição pausada." : "Distribuição reativada."); }
    setSaving(false);
  }

  async function saveIps() {
    setSaving(true); setToast("");
    const ips = ipsText.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
    const { error: rpcError } = await getBrowserSupabaseClient().rpc("erp_salvar_ips", { p_ips: ips });
    setToast(rpcError ? rpcError.message : `${ips.length} IP(s) salvos.`);
    setSaving(false);
  }

  const companyField = (key: string, label: string, placeholder: string) => (
    <label>{label}<input value={company[key] ?? ""} onChange={(event) => setCompany((current) => ({ ...current, [key]: event.target.value }))} placeholder={placeholder} /></label>
  );

  return <SettingsShell section={section} setSection={setSection} error={error} toast={toast} saving={saving} config={config} company={company} setCompany={setCompany} ipsText={ipsText} setIpsText={setIpsText} saveCompany={saveCompany} toggleDistribution={toggleDistribution} saveIps={saveIps} companyField={companyField} accessToken={accessToken} onNavigate={onNavigate} />;
}

type Categoria = { id: string; nome: string; tipo: "entrada" | "saida" | "ambos"; natureza: string; cor: string | null; ordem: number };

function CategoriasCaixaEditor({ accessToken }: { accessToken: string }) {
  const [cats, setCats] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ nome: "", tipo: "saida", natureza: "normal", cor: "#ff6500" });
  const naturezaLabel: Record<string, string> = { normal: "Normal", comissao_recebida: "Comissão recebida (entra na imobiliária)", comissao_paga: "Comissão paga (repasse à parte)" };
  const load = async () => {
    const response = await fetch("/api/finance", { headers: { Authorization: `Bearer ${accessToken}` } });
    const result = await response.json() as { categorias?: Categoria[]; error?: string };
    if (!response.ok) { setMsg(result.error || "Não foi possível carregar as categorias."); return; }
    setCats((result.categorias ?? []).slice().sort((a, b) => a.tipo.localeCompare(b.tipo) || a.ordem - b.ordem));
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  const mutate = async (payload: Record<string, unknown>) => {
    setBusy(true); setMsg("");
    try {
      const response = await fetch("/api/finance", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Falha ao salvar.");
      await load();
    } catch (reason) { setMsg(reason instanceof Error ? reason.message : "Falha ao salvar."); }
    finally { setBusy(false); }
  };
  const add = () => { if (!form.nome.trim()) return; void mutate({ action: "createCategory", nome: form.nome.trim(), tipo: form.tipo, natureza: form.natureza, cor: form.cor }); setForm({ ...form, nome: "" }); };
  if (loading) return <div className="settings-cats"><h3>Categorias do fluxo de caixa</h3><p className="settings-hint">Carregando…</p></div>;
  return <div className="settings-cats">
    <h3>Categorias do fluxo de caixa</h3>
    <p className="settings-hint">Estas categorias aparecem ao lançar movimentações no caixa. Marque “comissão recebida/paga” para o ERP apontar na venda o que já entrou na imobiliária e o que foi repassado às partes.</p>
    {msg && <div className="settings-toast">{msg}</div>}
    <div className="settings-cat-add">
      <input aria-label="Cor" type="color" value={form.cor} onChange={(event) => setForm({ ...form, cor: event.target.value })} />
      <input aria-label="Nome da categoria" value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} placeholder="Nome da categoria" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} />
      <select aria-label="Tipo" value={form.tipo} onChange={(event) => setForm({ ...form, tipo: event.target.value })}><option value="entrada">Entrada</option><option value="saida">Saída</option><option value="ambos">Entrada e saída</option></select>
      <select aria-label="Natureza" value={form.natureza} onChange={(event) => setForm({ ...form, natureza: event.target.value })}><option value="normal">Normal</option><option value="comissao_recebida">Comissão recebida</option><option value="comissao_paga">Comissão paga</option></select>
      <button type="button" disabled={busy || !form.nome.trim()} onClick={add}>＋ Adicionar</button>
    </div>
    <div className="settings-cat-list">
      {cats.map((cat) => <div className="settings-cat-row" key={cat.id}>
        <i style={{ background: cat.cor || "#ddd" }} />
        <input value={cat.nome} disabled={busy} onChange={(event) => setCats((rows) => rows.map((r) => r.id === cat.id ? { ...r, nome: event.target.value } : r))} onBlur={(event) => { if (event.target.value.trim() && event.target.value.trim() !== cat.nome) void mutate({ action: "renameCategory", categoryId: cat.id, nome: event.target.value.trim() }); }} />
        <select value={cat.tipo} disabled={busy} onChange={(event) => void mutate({ action: "renameCategory", categoryId: cat.id, tipo: event.target.value })}><option value="entrada">Entrada</option><option value="saida">Saída</option><option value="ambos">Ambos</option></select>
        <select value={cat.natureza} disabled={busy} title={naturezaLabel[cat.natureza]} onChange={(event) => void mutate({ action: "renameCategory", categoryId: cat.id, natureza: event.target.value })}><option value="normal">Normal</option><option value="comissao_recebida">Com. recebida</option><option value="comissao_paga">Com. paga</option></select>
        <input aria-label="Cor" type="color" value={cat.cor || "#cccccc"} disabled={busy} onChange={(event) => void mutate({ action: "renameCategory", categoryId: cat.id, cor: event.target.value })} />
        <button type="button" className="settings-cat-del" disabled={busy} title="Remover" onClick={() => void mutate({ action: "removeCategory", categoryId: cat.id })}>×</button>
      </div>)}
      {cats.length === 0 && <p className="settings-hint">Nenhuma categoria cadastrada.</p>}
    </div>
  </div>;
}

type EsteiraStage = { id: string; slug: string; nome: string; cor: string | null; ordem: number; papel: string | null; sla_dias: number | null; resale: boolean; exige_docs: boolean };
type EsteiraDoc = { id: string; etapa_slug: string; nome: string; obrigatorio: boolean; ordem: number };
const ESTEIRA_PAPEIS = ["Corretor", "Gerente", "Jurídico", "Financeiro", "Administrador"];

function EsteiraConfig({ accessToken }: { accessToken: string }) {
  const [stages, setStages] = useState<EsteiraStage[]>([]);
  const [docs, setDocs] = useState<EsteiraDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [novoDoc, setNovoDoc] = useState<Record<string, string>>({});
  const load = async () => {
    const response = await fetch("/api/crm/sales", { headers: { Authorization: `Bearer ${accessToken}` } });
    const result = await response.json() as { stages?: EsteiraStage[]; etapaDocs?: EsteiraDoc[]; error?: string };
    if (!response.ok) { setMsg(result.error || "Não foi possível carregar a esteira."); setLoading(false); return; }
    setStages((result.stages ?? []).slice().sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)));
    setDocs((result.etapaDocs ?? []).slice().sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)));
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  const mutate = async (payload: Record<string, unknown>) => {
    setBusy(true); setMsg("");
    try {
      const response = await fetch("/api/crm/sales", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Falha ao salvar.");
      await load();
    } catch (reason) { setMsg(reason instanceof Error ? reason.message : "Falha ao salvar."); }
    finally { setBusy(false); }
  };
  const addDoc = (slug: string) => {
    const nome = (novoDoc[slug] ?? "").trim();
    if (!nome) return;
    setNovoDoc((current) => ({ ...current, [slug]: "" }));
    void mutate({ action: "docCreate", etapaSlug: slug, nome, obrigatorio: true });
  };
  if (loading) return <section className="settings-card"><h2>Esteira de vendas</h2><p className="settings-hint">Carregando…</p></section>;
  return <section className="settings-card">
    <h2>Esteira de vendas</h2>
    <p>Defina, para cada etapa do negócio, quem é o responsável, o prazo (SLA) e quais documentos são obrigatórios para o lead avançar. Os documentos aparecem no botão <strong>📎 Docs</strong> dentro do card de cada venda.</p>
    {msg && <div className="settings-toast">{msg}</div>}
    <div className="esteira-config-list">
      {stages.map((stage) => {
        const stageDocs = docs.filter((doc) => doc.etapa_slug === stage.slug);
        return <div className="esteira-config-stage" key={stage.id}>
          <div className="esteira-config-head">
            <input aria-label="Cor da etapa" type="color" value={stage.cor || "#8d2bd1"} disabled={busy} onChange={(event) => void mutate({ action: "updateStage", stageId: stage.id, cor: event.target.value })} />
            <input className="esteira-config-nome" value={stage.nome} disabled={busy}
              onChange={(event) => setStages((rows) => rows.map((r) => r.id === stage.id ? { ...r, nome: event.target.value } : r))}
              onBlur={(event) => { const v = event.target.value.trim(); if (v && v !== stage.nome) void mutate({ action: "updateStage", stageId: stage.id, nome: v }); }} />
            <label className="esteira-config-field">Responsável
              <select value={stage.papel || "Corretor"} disabled={busy} onChange={(event) => void mutate({ action: "updateStage", stageId: stage.id, papel: event.target.value })}>
                {ESTEIRA_PAPEIS.map((papel) => <option key={papel} value={papel}>{papel}</option>)}
              </select>
            </label>
            <label className="esteira-config-field">SLA (dias)
              <input type="number" min={0} value={stage.sla_dias ?? 0} disabled={busy}
                onChange={(event) => setStages((rows) => rows.map((r) => r.id === stage.id ? { ...r, sla_dias: Number(event.target.value) } : r))}
                onBlur={(event) => { const v = Math.max(0, Math.trunc(Number(event.target.value) || 0)); if (v !== (stage.sla_dias ?? 0)) void mutate({ action: "updateStage", stageId: stage.id, slaDias: v }); }} />
            </label>
          </div>
          <label className="esteira-config-gate">
            <input type="checkbox" checked={stage.exige_docs} disabled={busy} onChange={(event) => void mutate({ action: "updateStage", stageId: stage.id, exigeDocs: event.target.checked })} />
            <span><strong>Exigir documentos para avançar desta etapa</strong><small>Quando marcado, o lead só passa para a próxima etapa se todos os documentos obrigatórios estiverem anexados.</small></span>
          </label>
          <div className="esteira-config-docs">
            {stageDocs.map((doc) => <div className="esteira-config-doc" key={doc.id}>
              <input value={doc.nome} disabled={busy}
                onChange={(event) => setDocs((rows) => rows.map((r) => r.id === doc.id ? { ...r, nome: event.target.value } : r))}
                onBlur={(event) => { const v = event.target.value.trim(); if (v && v !== doc.nome) void mutate({ action: "docUpdate", docId: doc.id, nome: v }); }} />
              <label className="esteira-config-obrig" title="Documento obrigatório para avançar">
                <input type="checkbox" checked={doc.obrigatorio} disabled={busy} onChange={(event) => void mutate({ action: "docUpdate", docId: doc.id, obrigatorio: event.target.checked })} />
                Obrigatório
              </label>
              <button type="button" className="settings-cat-del" disabled={busy} title="Remover documento" onClick={() => void mutate({ action: "docDelete", docId: doc.id })}>×</button>
            </div>)}
            {stageDocs.length === 0 && <p className="settings-hint">Nenhum documento configurado para esta etapa.</p>}
            <div className="esteira-config-doc-add">
              <input value={novoDoc[stage.slug] ?? ""} disabled={busy} placeholder="Novo documento (ex.: RG do comprador)"
                onChange={(event) => setNovoDoc((current) => ({ ...current, [stage.slug]: event.target.value }))}
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addDoc(stage.slug); } }} />
              <button type="button" disabled={busy || !(novoDoc[stage.slug] ?? "").trim()} onClick={() => addDoc(stage.slug)}>＋ Adicionar documento</button>
            </div>
          </div>
        </div>;
      })}
      {stages.length === 0 && <p className="settings-hint">Nenhuma etapa cadastrada. Crie etapas na tela do CRM (Esteira de vendas).</p>}
    </div>
  </section>;
}

function SettingsShell({ section, setSection, error, toast, saving, config, company, setCompany, ipsText, setIpsText, saveCompany, toggleDistribution, saveIps, companyField, accessToken, onNavigate }: {
  section: SectionKey; setSection: (key: SectionKey) => void; error: string; toast: string; saving: boolean; config: AdminConfig | null;
  company: Record<string, string>; setCompany: Dispatch<SetStateAction<Record<string, string>>>; ipsText: string; setIpsText: (value: string) => void;
  saveCompany: () => Promise<void>; toggleDistribution: (paused: boolean) => Promise<void>; saveIps: () => Promise<void>; companyField: (key: string, label: string, placeholder: string) => ReactNode; accessToken: string; onNavigate?: (module: string) => void;
}) {
  return <div className="settings-workspace">
    <header className="workspace-top settings-top"><div><span className="settings-kicker">ADMINISTRAÇÃO</span><h1>Configurações</h1><p>Ajustes do sistema · todas as alterações são auditadas.</p></div><span className="settings-admin-pill">🛡 Somente administradores</span></header>
    <div className="settings-body">
      <nav className="settings-nav">{SECTIONS.map((item) => <button className={section === item.key ? "active" : ""} type="button" onClick={() => setSection(item.key)} key={item.key}><span className="settings-nav-ico">{item.icon}</span><span className="settings-nav-text"><strong>{item.label}</strong><small>{item.sub}</small></span><span className="settings-nav-chev">›</span></button>)}</nav>
      <main className="settings-main">
        {error && <div className="workspace-error">{error}</div>}
        {toast && <div className="settings-toast">{toast}</div>}

        {section === "empresa" && <div className="settings-empresa">
          <section className="settings-card settings-identity">
            <button type="button" className="settings-logo"><span>⌂</span><small>Trocar logo</small></button>
            <div className="settings-identity-body">
              <h2>Identidade da imobiliária</h2><p>O logo e o nome aparecem em documentos, propostas e no rodapé das mensagens.</p>
              <div className="settings-grid">
                {companyField("nome", "Nome da imobiliária", "Apê Certo Imóveis")}
                {companyField("creci", "CRECI jurídico", "CRECI-SP J00000")}
              </div>
            </div>
          </section>
          <section className="settings-card">
            <h2><span className="sc-ico phone">✆</span>Contato</h2>
            <div className="settings-grid">
              {companyField("cnpj", "CNPJ", "00.000.000/0001-00")}
              {companyField("telefone", "Telefone", "(11) 0000-0000")}
              {companyField("email", "E-mail", "contato@apecerto.com.br")}
              {companyField("site", "Site", "https://apecerto.com.br")}
            </div>
          </section>
          <section className="settings-card">
            <h2><span className="sc-ico pin">◉</span>Localização</h2>
            <label className="wide">Endereço<input value={company.endereco ?? ""} onChange={(event) => setCompany((current) => ({ ...current, endereco: event.target.value }))} placeholder="Rua, número, bairro, cidade - UF" /></label>
          </section>
          <footer className="settings-form-footer"><span>Alterações são registradas na auditoria.</span><div><button type="button" className="settings-cancel" onClick={() => setCompany(config?.empresa ?? {})}>Cancelar</button><button className="settings-save" type="button" disabled={saving} onClick={() => void saveCompany()}>{saving ? "Salvando…" : "✓ Salvar empresa"}</button></div></footer>
        </div>}

        {section === "conexoes" && <section className="settings-embed"><ConnectionsWorkspace accessToken={accessToken} /></section>}

        {section === "presenca" && <PresenceConfig accessToken={accessToken} />}

        {section === "esteira" && <EsteiraConfig accessToken={accessToken} />}

        {section === "usuarios" && <section className="settings-card">
          <h2>Usuários & Permissões</h2><p>Papéis, acesso por módulo, instâncias e documentos ficam no módulo Usuários.</p>
          <div className="settings-shortcut"><div><strong>Gestão completa da equipe</strong><small>Ver/criar/editar/excluir/administrar por módulo, com trilha auditada.</small></div><button type="button" onClick={() => onNavigate?.("Usuários")}>Abrir Usuários →</button></div>
        </section>}

        {section === "crm" && config && <section className="settings-card">
          <h2>CRM & Pipelines</h2><p>Controles da distribuição de leads e estrutura dos funis.</p>
          <label className="settings-switch"><input type="checkbox" checked={!config.distribuicao_pausada} disabled={saving} onChange={(event) => void toggleDistribution(!event.target.checked)} /><div><strong>Roleta de distribuição {config.distribuicao_pausada ? "PAUSADA" : "ativa"}</strong><small>Quando pausada, nenhum lead novo é distribuído automaticamente aos corretores.</small></div></label>
          <h3>Funis e etapas</h3>
          {config.pipelines.map((pipeline) => <details className="settings-pipeline" key={pipeline.id}><summary>{pipeline.nome} <small>{pipeline.etapas.length} etapas</small></summary><ol>{pipeline.etapas.map((stage) => <li key={stage.id}><i style={{ background: stage.cor ?? "#ddd" }} />{stage.nome}</li>)}</ol></details>)}
          <p className="settings-hint">Edição de etapas (criar/renomear/reordenar) fica na tela do CRM, seção do §6 do roadmap.</p>
        </section>}

        {section === "financeiro" && config && <section className="settings-card">
          <h2>Financeiro</h2><p>Regra de comissão vigente aplicada às vendas.</p>
          {config.comissao?.versao ? <div className="settings-commission"><strong>Versão {config.comissao.versao}</strong><small>{config.comissao.descricao ?? "Sem descrição"}</small><small>Vigência: {config.comissao.vigente_de ?? "—"} até {config.comissao.vigente_ate ?? "em aberto"}</small><pre>{JSON.stringify(config.comissao.parametros ?? {}, null, 2)}</pre></div> : <p className="settings-hint">Nenhuma regra de comissão cadastrada.</p>}
          <CategoriasCaixaEditor accessToken={accessToken} />
          <p className="settings-hint">Metas, indicações e comissões editáveis continuam no módulo Financeiro.</p>
        </section>}

        {section === "seguranca" && <section className="settings-card">
          <h2>Segurança</h2><p>IPs do escritório (usados na regra de presença/horário da roleta) e trilha de auditoria.</p>
          <label className="wide settings-ips">IPs autorizados do escritório (um por linha)<textarea value={ipsText} onChange={(event) => setIpsText(event.target.value)} placeholder={"200.100.10.1\n200.100.10.2"} rows={5} /></label>
          <footer><button className="settings-save" type="button" disabled={saving} onClick={() => void saveIps()}>{saving ? "Salvando…" : "Salvar IPs"}</button></footer>
          <div className="settings-shortcut"><div><strong>Auditoria do sistema</strong><small>Todo salvamento nas Configurações, Usuários e módulos auditados fica registrado.</small></div><button type="button" onClick={() => onNavigate?.("Auditoria")}>Abrir Auditoria →</button></div>
        </section>}

        {section === "integracoes" && config && <section className="settings-card">
          <h2>Integrações & IA</h2><p>Status das integrações conectadas ao ERP.</p>
          <div className="settings-integrations">
            <article><strong>WhatsApp (D-API)</strong><small>{config.instancias.filter((instance) => instance.conectada).length}/{config.instancias.length} instâncias conectadas</small><em className={config.instancias.some((instance) => instance.conectada) ? "ok" : "warn"}>{config.instancias.some((instance) => instance.conectada) ? "Operacional" : "Atenção"}</em></article>
            <article><strong>Supabase</strong><small>Banco, autenticação e arquivos</small><em className="ok">Operacional</em></article>
            <article><strong>Datacrazy</strong><small>Histórico de atendimento</small><em className="ok">Configurada</em></article>
            <article><strong>Agentes de IA</strong><small>Sara e agentes do módulo Agentes de IA</small><em className="ok">Ativos</em></article>
          </div>
          <p className="settings-hint">Chaves e credenciais são gerenciadas no Supabase/Render — não ficam expostas aqui.</p>
        </section>}
      </main>
    </div>
  </div>;
}
