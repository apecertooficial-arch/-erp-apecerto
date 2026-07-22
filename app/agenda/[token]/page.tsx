"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";

type Visita = {
  dia: string; hora: string; horaFim: string | null; cliente: string; corretor: string;
  produto: string; unidade: string; local: string; status: string; comGerente: boolean;
};
type Agenda = { hoje: string; visitas: Visita[] };

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const DIAS_PT = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const CORES: Record<string, string> = {
  Claudia: "#FF7000", Elizangela: "#E5006D", Tica: "#8B00CC", Fabiano: "#1E6FD9", Edrisia: "#0FA36B",
};
const corDo = (nome: string) => CORES[nome.split(" ")[0]] ?? "#FF7000";
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* Agenda ApêCerto — visão mensal estilo Google Agenda (link compartilhável, somente leitura). */
export default function AgendaPublica({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const hoje = useMemo(() => new Date(), []);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [diaSel, setDiaSel] = useState(iso(hoje));
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [erro, setErro] = useState("");

  const load = useCallback(async () => {
    // carrega o mês visível inteiro (incluindo pontas da grade)
    const de = iso(new Date(ano, mes, 1 - new Date(ano, mes, 1).getDay()));
    const ate = iso(new Date(ano, mes + 1, 6));
    try {
      const res = await fetch(`/api/agenda-publica?token=${encodeURIComponent(token)}&de=${de}&ate=${ate}`);
      const data = await res.json() as Agenda & { error?: string };
      if (!res.ok) { setErro(data.error || "Não foi possível abrir a agenda."); return; }
      setAgenda(data); setErro("");
    } catch { setErro("Sem conexão — tente de novo."); }
  }, [token, ano, mes]);

  useEffect(() => {
    // garantia de viewport mobile (evita a página abrir "espremida" no celular)
    if (!document.querySelector('meta[name="viewport"]')) {
      const m = document.createElement("meta");
      m.name = "viewport"; m.content = "width=device-width, initial-scale=1, viewport-fit=cover";
      document.head.appendChild(m);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { void load(); }, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const porDia = useMemo(() => {
    const m = new Map<string, Visita[]>();
    for (const v of agenda?.visitas ?? []) {
      if (!m.has(v.dia)) m.set(v.dia, []);
      m.get(v.dia)!.push(v);
    }
    return m;
  }, [agenda]);

  // células da grade do mês (começa no domingo)
  const celulas = useMemo(() => {
    const primeiro = new Date(ano, mes, 1);
    const inicio = new Date(ano, mes, 1 - primeiro.getDay());
    const out: Array<{ d: string; num: number; foraMes: boolean }> = [];
    for (let i = 0; i < 42; i++) {
      const dt = new Date(inicio); dt.setDate(inicio.getDate() + i);
      out.push({ d: iso(dt), num: dt.getDate(), foraMes: dt.getMonth() !== mes });
      if (i >= 34 && dt.getDay() === 6 && new Date(inicio.getTime() + (i + 1) * 86400000).getMonth() !== mes) break;
    }
    return out;
  }, [ano, mes]);

  const navega = (delta: number) => {
    let m = mes + delta, a = ano;
    if (m < 0) { m = 11; a--; } if (m > 11) { m = 0; a++; }
    setMes(m); setAno(a);
  };

  const selecionadas = porDia.get(diaSel) ?? [];
  const [ys, ms, ds] = diaSel.split("-").map(Number);
  const rotuloSel = `${DIAS_PT[new Date(ys, ms - 1, ds).getDay()]}, ${ds} de ${MESES[ms - 1]}`;
  const hojeIso = agenda?.hoje ?? iso(hoje);

  return <div className="agm">
    <header className="agm-topo">
      <img src="/brand/simbolo-cores.png" alt="ApêCerto" />
      <button type="button" onClick={() => navega(-1)} aria-label="Mês anterior">‹</button>
      <h1>{MESES[mes]} <span>{ano}</span></h1>
      <button type="button" onClick={() => navega(1)} aria-label="Próximo mês">›</button>
      <button type="button" className="agm-hoje-btn" onClick={() => { setAno(hoje.getFullYear()); setMes(hoje.getMonth()); setDiaSel(hojeIso); }}>Hoje</button>
    </header>

    {erro && <div className="agm-erro">{erro}</div>}

    <div className="agm-grade">
      {SEMANA.map((s, i) => <div className="agm-sem" key={i}>{s}</div>)}
      {celulas.map((c) => {
        const vs = porDia.get(c.d) ?? [];
        const ehHoje = c.d === hojeIso;
        const sel = c.d === diaSel;
        return <button type="button" key={c.d} onClick={() => setDiaSel(c.d)}
          className={`agm-cel ${c.foraMes ? "fora" : ""} ${sel ? "sel" : ""}`}>
          <span className={`agm-num ${ehHoje ? "hj" : ""}`}>{c.num}</span>
          <span className="agm-chips">
            {vs.slice(0, 3).map((v, i) => <em key={i} style={{ background: corDo(v.corretor) }}>
              {v.corretor.split(" ")[0]}/{v.cliente.split(" ")[0]}
            </em>)}
            {vs.length > 3 && <small>+{vs.length - 3}</small>}
          </span>
        </button>;
      })}
    </div>

    <section className="agm-dia-detalhe">
      <h2>{rotuloSel}{selecionadas.length > 0 && <b> · {selecionadas.length} compromisso{selecionadas.length === 1 ? "" : "s"}</b>}</h2>
      {selecionadas.length === 0 && <p className="agm-livre">Dia livre — nenhuma visita marcada.</p>}
      {selecionadas.map((v, i) => <article className="agm-card" key={i} style={{ borderLeftColor: corDo(v.corretor) }}>
        <div className="agm-hora"><b>{v.hora}</b>{v.horaFim && <small>{v.horaFim}</small>}</div>
        <div className="agm-info">
          <strong>{v.cliente}</strong>
          {(v.produto || v.unidade) && <span>🏢 {v.produto}{v.unidade ? ` · ${v.unidade}` : ""}</span>}
          {v.local && <span>📍 {v.local}</span>}
          <div className="agm-tags">
            <em style={{ background: `${corDo(v.corretor)}1c`, color: corDo(v.corretor) }}>{v.corretor}</em>
            <em className={`st-${v.status}`}>{v.status === "realizada" ? "Realizada ✓" : v.status === "confirmada" ? "Confirmada" : "Agendada"}</em>
            {v.comGerente && <em className="ger">c/ gerente</em>}
          </div>
        </div>
      </article>)}
    </section>

    <footer className="agm-rodape">Agenda ApêCerto · atualiza sozinha a cada minuto</footer>

    <style>{`
      html, body { margin:0; padding:0; background:#fff; width:100%; overflow-x:hidden; }
      .agm, .agm * { box-sizing:border-box; }
      .agm { min-height:100vh; width:100%; max-width:640px; margin:0 auto; font-family:'Nunito', -apple-system, 'Segoe UI', sans-serif; color:#20140e; padding-bottom:30px; }
      .agm-topo { display:flex; align-items:center; gap:8px; padding:14px 12px 10px; position:sticky; top:0; background:#fff; z-index:5; border-bottom:1px solid #F0ECE8; }
      .agm-topo img { width:34px; height:34px; object-fit:contain; }
      .agm-topo h1 { flex:1; margin:0; font-size:19px; text-transform:capitalize; letter-spacing:-.02em; text-align:center; }
      .agm-topo h1 span { color:#8a807a; font-weight:600; font-size:15px; }
      .agm-topo > button { width:34px; height:34px; border-radius:10px; border:1.5px solid #ECE7E3; background:#fff; color:#6d635c; font-size:19px; cursor:pointer; }
      .agm-topo .agm-hoje-btn { width:auto; padding:0 13px; font-size:12.5px; font-weight:800; color:#C2530A; border-color:#F6D9C2; background:#FFF1E5; }
      .agm-erro { margin:14px; padding:13px 15px; border-radius:13px; background:#FDEAE7; color:#B03227; font-weight:700; font-size:13.5px; }
      .agm-grade { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); width:100%; border-bottom:1px solid #F0ECE8; }
      .agm-sem { text-align:center; font-size:10.5px; font-weight:800; color:#8a807a; padding:8px 0 4px; }
      .agm-cel { min-width:0; min-height:74px; border:none; border-top:1px solid #F5F1EE; background:#fff; padding:3px 1px; text-align:center; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:2px; font-family:inherit; }
      .agm-cel.fora { opacity:.38; }
      .agm-cel.sel { background:#FFF7F0; box-shadow:inset 0 0 0 2px #FF6500; border-radius:8px; }
      .agm-num { width:24px; height:24px; display:flex; align-items:center; justify-content:center; font-size:12.5px; font-weight:700; border-radius:50%; }
      .agm-num.hj { background:#FF6500; color:#fff; }
      .agm-chips { display:flex; flex-direction:column; gap:2px; width:100%; overflow:hidden; }
      .agm-chips em { font-style:normal; font-size:8.5px; font-weight:800; color:#fff; border-radius:4px; padding:1.5px 3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; }
      .agm-chips small { font-size:9px; font-weight:800; color:#8a807a; }
      .agm-dia-detalhe { padding:14px 14px 0; }
      .agm-dia-detalhe h2 { font-size:14.5px; margin:2px 0 10px; text-transform:capitalize; }
      .agm-dia-detalhe h2 b { color:#C2530A; font-weight:800; }
      .agm-livre { font-size:13px; color:#8a807a; font-weight:650; background:#FAF8F6; border-radius:12px; padding:14px; text-align:center; }
      .agm-card { display:flex; gap:12px; background:#fff; border:1px solid #F0ECE8; border-left:4px solid #FF6500; border-radius:13px; padding:12px 13px; margin-bottom:8px; box-shadow:0 2px 8px rgba(32,20,14,.05); }
      .agm-hora { flex:0 0 46px; display:flex; flex-direction:column; align-items:center; padding-top:1px; }
      .agm-hora b { font-size:15px; letter-spacing:-.02em; }
      .agm-hora small { font-size:10px; color:#8a807a; font-weight:700; margin-top:1px; }
      .agm-info { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
      .agm-info strong { font-size:14.5px; letter-spacing:-.01em; }
      .agm-info > span { font-size:12px; color:#6d635c; font-weight:600; }
      .agm-tags { display:flex; gap:6px; flex-wrap:wrap; margin-top:5px; }
      .agm-tags em { font-style:normal; font-size:10px; font-weight:800; padding:2.5px 8px; border-radius:999px; }
      .agm-tags em.st-agendada { background:#FFF1E5; color:#C2530A; }
      .agm-tags em.st-confirmada { background:#E7F6EC; color:#157A42; }
      .agm-tags em.st-realizada { background:#EDEBFA; color:#4C3FB8; }
      .agm-tags em.ger { background:#F3E8FB; color:#66009A; }
      .agm-rodape { text-align:center; font-size:10.5px; color:#8a807a; font-weight:650; margin-top:22px; }
    `}</style>
  </div>;
}
