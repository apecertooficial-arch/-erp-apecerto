"use client";

// Ficha cadastral para análise de financiamento — página PÚBLICA (link por token).
// Substitui o Google Forms: o cliente preenche, os dados caem direto no ERP,
// vinculados ao lead e ao corretor que enviou o link.

import { use, useEffect, useState } from "react";

type FichaInfo = { comprador_nome: string | null; telefone: string | null; email: string | null; status: string | null; corretor_nome: string | null };

const CIVIL = [
  { v: "solteiro", l: "Solteiro(a)" }, { v: "casado", l: "Casado(a)" }, { v: "uniao_estavel", l: "União estável" },
  { v: "divorciado", l: "Divorciado(a)" }, { v: "viuvo", l: "Viúvo(a)" },
];

const maskMoney = (v: string) => {
  const digits = v.replace(/\D/g, "");
  if (!digits) return "";
  return (Number(digits) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const moneyToNumber = (v: string) => String(Number(v.replace(/\./g, "").replace(",", ".")) || "");
const maskCpf = (v: string) => v.replace(/\D/g, "").slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
const maskCep = (v: string) => v.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
const maskPhone = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 11); return d.length > 10 ? d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3") : d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3"); };

export default function FichaPublica({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [info, setInfo] = useState<FichaInfo | null>(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [temConjuge, setTemConjuge] = useState(false);
  const [f, setF] = useState({
    comprador_nome: "", telefone: "", email: "", data_nascimento: "", cpf: "", rg: "", endereco: "", cep: "",
    estado_civil: "", renda: "", valor_imovel: "", valor_entrada: "", valor_financiar: "",
    conjuge_nome: "", conjuge_cpf: "", conjuge_rg: "", conjuge_email: "", conjuge_renda: "", conjuge_data_nascimento: "",
    consentimento_lgpd: false,
  });
  const set = (k: string, v: string | boolean) => setF((cur) => ({ ...cur, [k]: v }));

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/ficha-publica?token=${encodeURIComponent(token)}`);
        const data = (await res.json()) as FichaInfo & { error?: string };
        if (!res.ok) { setErro(data.error || "Não foi possível abrir a ficha."); return; }
        setInfo(data);
        setF((cur) => ({ ...cur, comprador_nome: data.comprador_nome ?? "", telefone: data.telefone ? maskPhone(data.telefone.replace(/^55/, "")) : "", email: data.email ?? "" }));
      } catch { setErro("Sem conexão — tente de novo."); }
    })();
  }, [token]);

  const faltando = () => {
    if (!f.comprador_nome.trim()) return "Informe seu nome completo.";
    if (f.telefone.replace(/\D/g, "").length < 10) return "Informe um telefone válido com DDD.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) return "Informe um e-mail válido.";
    if (!f.data_nascimento) return "Informe sua data de nascimento.";
    if (f.cpf.replace(/\D/g, "").length !== 11) return "Informe um CPF válido.";
    if (!f.rg.trim()) return "Informe seu RG.";
    if (!f.endereco.trim()) return "Informe seu endereço.";
    if (f.cep.replace(/\D/g, "").length !== 8) return "Informe um CEP válido.";
    if (!f.estado_civil) return "Selecione seu estado civil.";
    if (!f.renda) return "Informe sua renda mensal.";
    if (!f.valor_imovel) return "Informe o valor do imóvel.";
    if (!f.valor_entrada) return "Informe o valor de entrada.";
    if (!f.valor_financiar) return "Informe o valor a financiar.";
    if (!f.consentimento_lgpd) return "É preciso autorizar o uso dos dados para a análise.";
    return null;
  };

  async function enviar() {
    const falta = faltando();
    if (falta) { setErro(falta); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setEnviando(true); setErro("");
    try {
      const dados = {
        ...f,
        telefone: `55${f.telefone.replace(/\D/g, "")}`.replace(/^5555/, "55"),
        renda: moneyToNumber(f.renda), valor_imovel: moneyToNumber(f.valor_imovel),
        valor_entrada: moneyToNumber(f.valor_entrada), valor_financiar: moneyToNumber(f.valor_financiar),
        conjuge_renda: temConjuge ? moneyToNumber(f.conjuge_renda) : "",
        conjuge_nome: temConjuge ? f.conjuge_nome : "", conjuge_cpf: temConjuge ? f.conjuge_cpf : "",
        conjuge_rg: temConjuge ? f.conjuge_rg : "", conjuge_email: temConjuge ? f.conjuge_email : "",
        conjuge_data_nascimento: temConjuge ? f.conjuge_data_nascimento : "",
        consentimento_lgpd: String(f.consentimento_lgpd),
      };
      const res = await fetch("/api/ficha-publica", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, dados }) });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) { setErro(body.error || "Não foi possível enviar."); return; }
      setEnviada(true); window.scrollTo({ top: 0 });
    } catch { setErro("Sem conexão — tente de novo."); }
    finally { setEnviando(false); }
  }

  if (erro && !info) return <div className="ficha-page"><div className="ficha-card ficha-center"><span className="ficha-logo">apê<b>certo</b></span><h1>Ops!</h1><p>{erro}</p></div></div>;
  if (!info) return <div className="ficha-page"><div className="ficha-card ficha-center"><span className="ficha-logo">apê<b>certo</b></span><p>Carregando ficha…</p></div></div>;
  if (enviada) return <div className="ficha-page"><div className="ficha-card ficha-center"><span className="ficha-logo">apê<b>certo</b></span><div className="ficha-ok">✓</div><h1>Ficha enviada!</h1><p>Recebemos seus dados{info.corretor_nome ? ` — ${info.corretor_nome} já foi avisado(a)` : ""}. Em breve entraremos em contato com a sua simulação de financiamento.</p></div></div>;

  return (
    <div className="ficha-page">
      <div className="ficha-card">
        <header className="ficha-head">
          <span className="ficha-logo">apê<b>certo</b></span>
          <h1>Ficha para análise de financiamento</h1>
          <p>Preencha seus dados para {info.corretor_nome ? `${info.corretor_nome} preparar` : "prepararmos"} a sua simulação. Leva menos de 3 minutos.</p>
        </header>
        {erro && <div className="ficha-erro" role="alert">{erro}</div>}

        <section><h2>Seus dados</h2>
          <div className="ficha-grid">
            <label className="wide">Nome completo *<input value={f.comprador_nome} onChange={(e) => set("comprador_nome", e.target.value)} autoComplete="name" /></label>
            <label>Telefone (WhatsApp) *<input inputMode="tel" value={f.telefone} onChange={(e) => set("telefone", maskPhone(e.target.value))} placeholder="(11) 91234-5678" /></label>
            <label>E-mail *<input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" /></label>
            <label>Data de nascimento *<input type="date" value={f.data_nascimento} onChange={(e) => set("data_nascimento", e.target.value)} /></label>
            <label>Estado civil *<select value={f.estado_civil} onChange={(e) => set("estado_civil", e.target.value)}><option value="">Selecione</option>{CIVIL.map((o) => <option value={o.v} key={o.v}>{o.l}</option>)}</select></label>
            <label>CPF *<input inputMode="numeric" value={f.cpf} onChange={(e) => set("cpf", maskCpf(e.target.value))} placeholder="000.000.000-00" /></label>
            <label>RG *<input value={f.rg} onChange={(e) => set("rg", e.target.value)} /></label>
            <label className="wide">Endereço completo *<input value={f.endereco} onChange={(e) => set("endereco", e.target.value)} placeholder="Rua, número, bairro, cidade" autoComplete="street-address" /></label>
            <label>CEP *<input inputMode="numeric" value={f.cep} onChange={(e) => set("cep", maskCep(e.target.value))} placeholder="00000-000" autoComplete="postal-code" /></label>
            <label>Renda mensal (R$) *<input inputMode="numeric" value={f.renda} onChange={(e) => set("renda", maskMoney(e.target.value))} placeholder="0,00" /></label>
          </div>
        </section>

        <section><h2>Sobre o imóvel</h2>
          <div className="ficha-grid">
            <label>Valor do imóvel (R$) *<input inputMode="numeric" value={f.valor_imovel} onChange={(e) => set("valor_imovel", maskMoney(e.target.value))} placeholder="0,00" /></label>
            <label>Valor de entrada (R$) *<input inputMode="numeric" value={f.valor_entrada} onChange={(e) => set("valor_entrada", maskMoney(e.target.value))} placeholder="0,00" /></label>
            <label>Valor a financiar (R$) *<input inputMode="numeric" value={f.valor_financiar} onChange={(e) => set("valor_financiar", maskMoney(e.target.value))} placeholder="0,00" /></label>
          </div>
        </section>

        <section>
          <label className="ficha-switch"><input type="checkbox" checked={temConjuge} onChange={(e) => setTemConjuge(e.target.checked)} /><span>Vou compor renda com cônjuge/companheiro(a)</span></label>
          {temConjuge && (
            <div className="ficha-grid">
              <label className="wide">Nome do cônjuge<input value={f.conjuge_nome} onChange={(e) => set("conjuge_nome", e.target.value)} /></label>
              <label>CPF do cônjuge<input inputMode="numeric" value={f.conjuge_cpf} onChange={(e) => set("conjuge_cpf", maskCpf(e.target.value))} placeholder="000.000.000-00" /></label>
              <label>RG do cônjuge<input value={f.conjuge_rg} onChange={(e) => set("conjuge_rg", e.target.value)} /></label>
              <label>E-mail do cônjuge<input type="email" value={f.conjuge_email} onChange={(e) => set("conjuge_email", e.target.value)} /></label>
              <label>Data de nascimento<input type="date" value={f.conjuge_data_nascimento} onChange={(e) => set("conjuge_data_nascimento", e.target.value)} /></label>
              <label>Renda mensal (R$)<input inputMode="numeric" value={f.conjuge_renda} onChange={(e) => set("conjuge_renda", maskMoney(e.target.value))} placeholder="0,00" /></label>
            </div>
          )}
        </section>

        <label className="ficha-lgpd"><input type="checkbox" checked={f.consentimento_lgpd} onChange={(e) => set("consentimento_lgpd", e.target.checked)} /><span>Autorizo o uso dos meus dados pela ApêCerto exclusivamente para a análise e simulação de financiamento imobiliário (LGPD). *</span></label>

        <button className="ficha-enviar" type="button" disabled={enviando} onClick={() => void enviar()}>{enviando ? "Enviando…" : "Enviar ficha"}</button>
        <p className="ficha-rodape">Seus dados são enviados com segurança direto para a ApêCerto.</p>
      </div>
    </div>
  );
}
