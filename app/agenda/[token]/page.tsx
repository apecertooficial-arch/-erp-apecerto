"use client";

import { use, useCallback, useEffect, useState } from "react";

type Visita = {
  hora: string; horaFim: string | null; cliente: string; corretor: string;
  produto: string; unidade: string; local: string; status: string; comGerente: boolean;
};
type Dia = { dia: string; rotulo: string; visitas: Visita[] };
type Agenda = { geradoEm: string; dias: Dia[] };

const DIAS_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const STATUS: Record<string, { t: string; bg: string; fg: string }> = {
  agendada: { t: "Agendada", bg: "#FFF1E5", fg: "#C2530A" },
  confirmada: { t: "Confirmada", bg: "#E7F6EC", fg: "#157A42" },
  realizada: { t: "Realizada ✓", bg: "#EDEBFA", fg: "#4C3FB8" },
};

function rotuloDia(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const hoje = new Date();
  const isHoje = dt.toDateString() === hoje.toDateString();
  const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1);
  const isAmanha = dt.toDateString() === amanha.toDateString();
  const base = `${DIAS_PT[dt.getDay()]} · ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
  return isHoje ? `HOJE · ${base}` : isAmanha ? `Amanhã · ${base}` : base;
}

/* Agenda ApêCerto — versão mobile compartilhável (somente leitura). */
export default function AgendaPublica({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [erro, setErro] = useState("");
  const [horaAtualizacao, setHoraAtualizacao] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/agenda-publica?token=${encodeURIComponent(token)}`);
      const data = await res.json() as Agenda & { error?: string };
      if (!res.ok) { setErro(data.error || "Não foi possível abrir a agenda."); return; }
      setAgenda(data); setErro("");
      setHoraAtualizacao(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    } catch { setErro("Sem conexão — tente de novo."); }
  }, [token]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { void load(); }, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const totalVisitas = (agenda?.dias ?? []).reduce((n, d) => n + d.visitas.length, 0);

  return <div className="agm">
    <header className="agm-hero">
      <img src="/brand/simbolo-cores.png" alt="" style={{ background: "#fff", borderRadius: 12, padding: 5 }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      <div>
        <h1>Agenda ApêCerto</h1>
        <p>{agenda ? `${totalVisitas} compromisso${totalVisitas === 1 ? "" : "s"} nos próximos 14 dias` : "Carregando…"}</p>
      </div>
    </header>

    {erro && <div className="agm-erro">{erro}</div>}

    {agenda && agenda.dias.length === 0 && !erro &&
      <div className="agm-vazio">Nenhuma visita marcada nos próximos 14 dias. 🎉</div>}

    {(agenda?.dias ?? []).map((d) => <section className="agm-dia" key={d.dia}>
      <h2 className={rotuloDia(d.dia).startsWith("HOJE") ? "hoje" : ""}>{rotuloDia(d.dia)}</h2>
      {d.visitas.map((v, i) => {
        const st = STATUS[v.status] ?? STATUS.agendada;
        return <article className="agm-card" key={i}>
          <div className="agm-hora"><b>{v.hora}</b>{v.horaFim && <small>até {v.horaFim}</small>}</div>
          <div className="agm-info">
            <strong>{v.cliente}</strong>
            {(v.produto || v.unidade) && <span>🏢 {v.produto}{v.unidade ? ` · ${v.unidade}` : ""}</span>}
            {v.local && <span>📍 {v.local}</span>}
            <div className="agm-tags">
              <em className="cor">{v.corretor}</em>
              <em style={{ background: st.bg, color: st.fg }}>{st.t}</em>
              {v.comGerente && <em className="ger">c/ gerente</em>}
            </div>
          </div>
        </article>;
      })}
    </section>)}

    {agenda && <footer className="agm-rodape">
      Atualiza sozinha a cada minuto · atualizada às {horaAtualizacao}
    </footer>}

    <style>{`
      html, body { margin:0; padding:0; background:#F7F4F1; }
      .agm { min-height:100vh; max-width:560px; margin:0 auto; font-family:'Nunito', -apple-system, 'Segoe UI', sans-serif; color:#20140e; padding-bottom:40px; }
      .agm-hero { display:flex; align-items:center; gap:14px; padding:22px 18px 20px; background:linear-gradient(120deg, #FF6500 0%, #E5006D 100%); color:#fff; border-radius:0 0 22px 22px; box-shadow:0 8px 24px rgba(229,0,109,.22); }
      .agm-hero img { width:44px; height:44px; object-fit:contain; }
      .agm-hero h1 { margin:0; font-size:19px; letter-spacing:-.02em; }
      .agm-hero p { margin:3px 0 0; font-size:12.5px; opacity:.92; font-weight:600; }
      .agm-erro { margin:18px 14px; padding:14px 16px; border-radius:14px; background:#FDEAE7; color:#B03227; font-weight:700; font-size:14px; }
      .agm-vazio { margin:26px 14px; padding:22px; border-radius:16px; background:#fff; text-align:center; font-weight:700; color:#6d635c; box-shadow:0 2px 10px rgba(32,20,14,.05); }
      .agm-dia { padding:0 12px; }
      .agm-dia h2 { font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:#8a807a; margin:22px 4px 8px; }
      .agm-dia h2.hoje { color:#C2530A; }
      .agm-card { display:flex; gap:12px; background:#fff; border-radius:15px; padding:13px 14px; margin-bottom:9px; box-shadow:0 2px 10px rgba(32,20,14,.06); }
      .agm-hora { flex:0 0 54px; display:flex; flex-direction:column; align-items:center; padding-top:2px; }
      .agm-hora b { font-size:16px; color:#FF6500; letter-spacing:-.02em; }
      .agm-hora small { font-size:10px; color:#8a807a; font-weight:700; margin-top:2px; text-align:center; }
      .agm-info { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }
      .agm-info strong { font-size:15px; letter-spacing:-.01em; }
      .agm-info > span { font-size:12px; color:#6d635c; font-weight:600; overflow:hidden; text-overflow:ellipsis; }
      .agm-tags { display:flex; gap:6px; flex-wrap:wrap; margin-top:5px; }
      .agm-tags em { font-style:normal; font-size:10.5px; font-weight:800; padding:3px 9px; border-radius:999px; }
      .agm-tags em.cor { background:#FFF1E5; color:#C2530A; border:1px solid #F6D9C2; }
      .agm-tags em.ger { background:#F3E8FB; color:#66009A; }
      .agm-rodape { text-align:center; font-size:11px; color:#8a807a; font-weight:650; margin-top:26px; }
    `}</style>
  </div>;
}
