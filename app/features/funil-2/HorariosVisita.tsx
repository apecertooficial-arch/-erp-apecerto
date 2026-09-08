"use client";

import { useEffect, useMemo, useState } from "react";

type EstadoHorario = "disponivel" | "indisponivel" | "meu";
type Horario = { inicio: string; fim: string; estado: EstadoHorario };

type Props = {
  accessToken: string;
  leadId?: string;
  visitId?: string;
  comGerente: boolean;
  gerenteId: number | null;
  value: string;
  onChange: (value: string) => void;
  initialDate?: string;
  disabled?: boolean;
};

const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

const horaAgora = () => new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).format(new Date());

function somarDias(data: string, quantidade: number) {
  const [ano, mes, dia] = data.split("-").map(Number);
  const resultado = new Date(Date.UTC(ano, mes - 1, dia + quantidade));
  return resultado.toISOString().slice(0, 10);
}

function dataAmigavel(data: string) {
  const [ano, mes, dia] = data.split("-").map(Number);
  if (!ano || !mes || !dia) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(ano, mes - 1, dia, 12)));
}

const periodoDoHorario = (horario: string) => {
  const hora = Number(horario.slice(0, 2));
  return hora < 12 ? "Manhã" : hora < 18 ? "Tarde" : "Noite";
};

export function HorariosVisita({ accessToken, leadId = "", visitId = "", comGerente, gerenteId, value, onChange, initialDate, disabled = false }: Props) {
  const [data, setData] = useState(() => value.slice(0, 10) || initialDate || hoje());
  const alvo = visitId || leadId;
  const chaveConsulta = !alvo || (comGerente && !gerenteId) ? "" : `${alvo}:${data}:${comGerente ? gerenteId : "sem-gerente"}`;
  const [resultado, setResultado] = useState<{ chave: string; horarios: Horario[]; erro: boolean }>({ chave: "", horarios: [], erro: false });
  const estado = !chaveConsulta ? "aguardando" : resultado.chave !== chaveConsulta ? "carregando" : resultado.erro ? "erro" : "pronto";
  const horarios = resultado.chave === chaveConsulta ? resultado.horarios : [];
  const horarioSelecionado = useMemo(() => value.startsWith(`${data}T`) ? value.slice(11, 16) : "", [data, value]);

  useEffect(() => {
    if (!chaveConsulta) return;
    const controlador = new AbortController();
    void fetch(visitId ? "/api/agenda" : "/api/funil2", {
      method: visitId ? "PATCH" : "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(visitId
        ? { action: "visitAvailability", visitId, data }
        : { action: "visitaDisponibilidade", leadId, data, comGerente, gerenteId }),
      signal: controlador.signal,
    }).then(async (resposta) => {
      const corpo = await resposta.json().catch(() => null) as { horarios?: Horario[]; error?: string } | null;
      if (!resposta.ok || !corpo?.horarios) throw new Error(corpo?.error || "Não foi possível consultar os horários.");
      setResultado({ chave: chaveConsulta, horarios: corpo.horarios, erro: false });
    }).catch((erro) => {
      if (erro?.name === "AbortError") return;
      setResultado({ chave: chaveConsulta, horarios: [], erro: true });
    });
    return () => controlador.abort();
  }, [accessToken, chaveConsulta, comGerente, data, gerenteId, leadId, visitId]);

  function trocarData(novaData: string) {
    setData(novaData);
    onChange("");
  }

  const grupos = useMemo(() => {
    const mapa = new Map<string, Horario[]>();
    for (const horario of horarios) {
      const periodo = periodoDoHorario(horario.inicio);
      mapa.set(periodo, [...(mapa.get(periodo) ?? []), horario]);
    }
    return [...mapa.entries()];
  }, [horarios]);

  const dataHoje = hoje();
  const dataAmanha = somarDias(dataHoje, 1);

  return <fieldset className="f2-horarios" disabled={disabled}>
    <legend>Escolha a data e o horário</legend>
    <div className="f2-horarios-atalhos" aria-label="Datas rápidas">
      <button type="button" className={data === dataHoje ? "selecionado" : ""} onClick={() => trocarData(dataHoje)}>Hoje</button>
      <button type="button" className={data === dataAmanha ? "selecionado" : ""} onClick={() => trocarData(dataAmanha)}>Amanhã</button>
    </div>
    <label>Outra data
      <input type="date" min={hoje()} value={data} onChange={(evento) => trocarData(evento.target.value)} />
    </label>
    <p className="f2-horarios-data">{dataAmigavel(data)}</p>
    {!alvo ? <p className="f2-horarios-aviso">Escolha o cliente para consultar os horários disponíveis.</p> : null}
    {comGerente && !gerenteId ? <p className="f2-horarios-aviso">Escolha o gerente para consultar os horários.</p> : null}
    {estado === "carregando" && <p className="f2-horarios-aviso" role="status">Consultando horários…</p>}
    {estado === "erro" && <p className="f2-horarios-erro" role="alert">Não foi possível consultar os horários. Tente novamente.</p>}
    {estado === "pronto" && <>
      {grupos.map(([periodo, itens]) => <section className="f2-horarios-periodo" key={periodo}>
        <h4>{periodo}</h4>
        <div className="f2-horarios-grade" aria-label={`Horários de ${periodo.toLocaleLowerCase("pt-BR")}`}>
          {itens.map((horario) => {
            const selecionado = horarioSelecionado === horario.inicio;
            const horarioEncerrado = data === dataHoje && horario.inicio <= horaAgora();
            const disponivel = horario.estado === "disponivel" && !horarioEncerrado;
            const estadoVisual = horarioEncerrado ? "indisponivel" : horario.estado;
            const rotulo = horarioEncerrado ? "Encerrado" : horario.estado === "meu" ? "Sua visita" : disponivel ? "Disponível" : "Indisponível";
            return <button
              key={horario.inicio}
              type="button"
              className={`f2-horario ${estadoVisual}${selecionado ? " selecionado" : ""}`}
              disabled={!disponivel || disabled}
              aria-pressed={selecionado}
              onClick={() => onChange(`${data}T${horario.inicio}`)}
            >
              <strong>{horario.inicio}</strong><small>{rotulo}</small>
            </button>;
          })}
        </div>
      </section>)}
      <p className="f2-horarios-legenda"><span><i className="livre" />Disponível</span><span><i />Indisponível</span><span><i className="meu" />Sua visita</span></p>
    </>}
    {horarioSelecionado && <div className="f2-horarios-resumo" role="status">
      <span>DATA E HORÁRIO ESCOLHIDOS</span>
      <strong>{dataAmigavel(data)}, às {horarioSelecionado}</strong>
      <small>Horário de Brasília</small>
    </div>}
  </fieldset>;
}
