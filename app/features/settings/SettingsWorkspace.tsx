"use client";
/* Doc §19 — Configurações completo: módulo admin com seções; Conexões vira UMA seção.
   Para corretor, mantém exatamente o comportamento anterior (só Conexões). */
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";
import { ConnectionsWorkspace } from "./ConnectionsWorkspace";

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
  { key: "empresa", label: "Empresa", icon: "▦" },
  { key: "conexoes", label: "Conexões (WhatsApp)", icon: "◎" },
  { key: "usuarios", label: "Usuários & Permissões", icon: "◫" },
  { key: "crm", label: "CRM & Pipelines", icon: "▤" },
  { key: "financeiro", label: "Financeiro", icon: "▣" },
  { key: "seguranca", label: "Segurança", icon: "▪" },
  { key: "integracoes", label: "Integrações & IA", icon: "✦" },
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

  return <div className="settings-workspace">
    <header className="workspace-top"><div><h1>Configurações</h1><p>Administração do sistema · alterações são auditadas</p></div></header>
    <div className="settings-body">
      <nav className="settings-nav">{SECTIONS.map((item) => <button className={section === item.key ? "active" : ""} type="button" onClick={() => setSection(item.key)} key={item.key}><span>{item.icon}</span>{item.label}</button>)}</nav>
      <main className="settings-main">
        {error && <div className="workspace-error">{error}</div>}
        {toast && <div className="settings-toast">{toast}</div>}

        {section === "empresa" && <section className="settings-card">
          <h2>Dados da empresa</h2><p>Usados em documentos, propostas e no rodapé de mensagens.</p>
          <div className="settings-grid">
            {companyField("nome", "Nome da imobiliária", "Apê Certo Imóveis")}
            {companyField("creci", "CRECI jurídico", "CRECI-SP J00000")}
            {companyField("cnpj", "CNPJ", "00.000.000/0001-00")}
            {companyField("telefone", "Telefone", "(11) 0000-0000")}
            {companyField("email", "E-mail", "contato@apecerto.com.br")}
            {companyField("site", "Site", "https://apecerto.com.br")}
            <label className="wide">Endereço<input value={company.endereco ?? ""} onChange={(event) => setCompany((current) => ({ ...current, endereco: event.target.value }))} placeholder="Rua, número, bairro, cidade - UF" /></label>
          </div>
          <footer><button className="settings-save" type="button" disabled={saving} onClick={() => void saveCompany()}>{saving ? "Salvando…" : "Salvar empresa"}</button></footer>
        </section>}

        {section === "conexoes" && <section className="settings-embed"><ConnectionsWorkspace accessToken={accessToken} /></section>}

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
