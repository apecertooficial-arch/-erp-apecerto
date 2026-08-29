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
      const corpo = await resposta.json().catch(() => null) as { horarios?: Horario[] } | null;
      if (!resposta.ok || !corpo?.horarios) throw new Error("disponibilidade_indisponivel");
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

  return <fieldset className="f2-horarios" disabled={disabled}>
    <legend>Data e horário da visita</legend>
    <label>Dia
      <input type="date" min={hoje()} value={data} onChange={(evento) => trocarData(evento.target.value)} />
    </label>
    {comGerente && !gerenteId ? <p className="f2-horarios-aviso">Escolha o gerente para consultar os horários.</p> : null}
    {estado === "carregando" && <p className="f2-horarios-aviso" role="status">Consultando horários…</p>}
    {estado === "erro" && <p className="f2-horarios-erro" role="alert">Não foi possível consultar os horários. Tente novamente.</p>}
    {estado === "pronto" && <>
      <div className="f2-horarios-grade" aria-label="Horários disponíveis">
        {horarios.map((horario) => {
          const selecionado = horarioSelecionado === horario.inicio;
          const disponivel = horario.estado === "disponivel";
          const rotulo = horario.estado === "meu" ? "Sua visita" : disponivel ? "Disponível" : "Indisponível";
          return <button
            key={horario.inicio}
            type="button"
            className={`f2-horario ${horario.estado}${selecionado ? " selecionado" : ""}`}
            disabled={!disponivel || disabled}
            aria-pressed={selecionado}
            onClick={() => onChange(`${data}T${horario.inicio}`)}
          >
            <strong>{horario.inicio}</strong><small>{rotulo}</small>
          </button>;
        })}
      </div>
      <p className="f2-horarios-legenda"><span><i className="livre" />Disponível</span><span><i />Indisponível</span><span><i className="meu" />Sua visita</span></p>
    </>}
  </fieldset>;
}
