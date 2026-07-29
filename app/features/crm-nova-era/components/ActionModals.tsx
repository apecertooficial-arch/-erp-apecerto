"use client";
/**
 * ActionModals — modais de AÇÕES SIMULADAS (Fase 1.1; tudo em memória, sem rede).
 *  - Registrar contato: resultados obrigatórios (não respondeu / respondeu /
 *    telefone inválido / pediu retorno / sem interesse / contato inadequado),
 *    com exigências por resultado — nenhuma conclusão deixa o lead sem próximo passo.
 *  - Agendar visita (ação separada; saída → Pipeline de Visitas)
 *  - Registrar proposta (produto, valor, data, observação; saída → Esteira de Vendas,
 *    SEM exigir aceite)
 *  - Descartar (motivo estruturado)
 */
import { useState } from "react";
import {
  validarConclusaoTentativa,
  validarResultadoAcaoComercial,
  validarProposta,
  validarDescarte,
  sugerirProximaTentativa,
  ACOES_COMERCIAIS,
  ACAO_TITULO,
  MOTIVOS_DESCARTE,
  RESULTADOS_ACAO_COMERCIAL,
  RESULTADO_ACAO_ROTULO,
  type CanalContato,
  type EntradaAcaoComercial,
  type EntradaTentativa,
  type LeadNova,
  type MotivoDescarte,
  type ProximaAcaoTipo,
  type PropostaRegistrada,
  type ResultadoAcaoComercial,
  type ResultadoTentativa,
} from "../lib/rules";

export type ModalTipo = "tentativa" | "acao" | "visita" | "proposta" | "descartar" | null;

const CANAIS: { v: CanalContato; l: string }[] = [
  { v: "whatsapp", l: "WhatsApp" },
  { v: "ligacao", l: "Ligação" },
  { v: "email", l: "E-mail" },
  { v: "presencial", l: "Presencial" },
];
const RESULTADOS: { v: ResultadoTentativa; l: string }[] = [
  { v: "nao_respondeu", l: "Não respondeu" },
  { v: "respondeu", l: "Respondeu" },
  { v: "telefone_invalido", l: "Telefone inválido" },
  { v: "pediu_retorno", l: "Pediu retorno" },
  { v: "sem_interesse", l: "Sem interesse" },
  { v: "contato_inadequado", l: "Contato inadequado" },
];
const MOTIVO_ROTULO: Record<MotivoDescarte, string> = {
  sem_interesse: "Sem interesse",
  sem_perfil_financeiro: "Sem perfil financeiro",
  numero_invalido: "Número inválido",
  ja_comprou_concorrente: "Já comprou no concorrente",
  duplicado: "Lead duplicado",
  outro: "Outro (descrever)",
};

export interface DescarteSubmit { motivo: MotivoDescarte; detalhe: string }

/** ISO → valor aceito por <input type="datetime-local"> (UTC, demo). */
function isoParaInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 16);
}
function inputParaIso(v: string): string | null {
  if (!v) return null;
  const t = Date.parse(`${v}:00.000Z`);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export function ActionModals({
  tipo,
  lead,
  agoraISO,
  onFecharAction,
  onRegistrarTentativaAction,
  onConcluirAcaoAction,
  onAgendarVisitaAction,
  onRegistrarPropostaAction,
  onDescartarAction,
}: {
  tipo: ModalTipo;
  lead: LeadNova | null;
  agoraISO: string;
  onFecharAction: () => void;
  onRegistrarTentativaAction: (d: EntradaTentativa) => void;
  onConcluirAcaoAction: (d: EntradaAcaoComercial) => void;
  onAgendarVisitaAction: (visitaISO: string) => void;
  onRegistrarPropostaAction: (p: PropostaRegistrada) => void;
  onDescartarAction: (d: DescarteSubmit) => void;
}) {
  const [canal, setCanal] = useState<CanalContato>("whatsapp");
  const [resultado, setResultado] = useState<ResultadoTentativa>("nao_respondeu");
  const [resultadoAcao, setResultadoAcao] = useState<ResultadoAcaoComercial>("acao_concluida");
  const [obs, setObs] = useState("");
  const [acaoTipo, setAcaoTipo] = useState<ProximaAcaoTipo>("entender_necessidade");
  const [acaoEm, setAcaoEm] = useState("");
  const [encaminharDescarte, setEncaminharDescarte] = useState(false);
  const [visitaData, setVisitaData] = useState("");
  const [produto, setProduto] = useState("");
  const [valor, setValor] = useState("");
  const [propostaData, setPropostaData] = useState("");
  const [propostaObs, setPropostaObs] = useState("");
  const [motivo, setMotivo] = useState<MotivoDescarte>("sem_interesse");
  const [detalhe, setDetalhe] = useState("");
  const [erros, setErros] = useState<string[]>([]);

  const sugestao = lead ? sugerirProximaTentativa(lead) : null;

  // Valores EFETIVOS com pré-preenchimento derivado (sem efeitos):
  // - "não respondeu": data sugerida pela cadência, ajustável no campo;
  // - proposta: data padrão = "agora" da demonstração.
  const acaoEmEfetiva =
    acaoEm || (resultado === "nao_respondeu" && sugestao?.quandoISO ? isoParaInput(sugestao.quandoISO) : "");
  const propostaDataEfetiva = propostaData || isoParaInput(agoraISO);

  if (!tipo || !lead) return null;

  function reset() {
    setErros([]); setObs(""); setAcaoEm(""); setEncaminharDescarte(false);
    setVisitaData(""); setProduto(""); setValor(""); setPropostaData(""); setPropostaObs(""); setDetalhe("");
    setResultado("nao_respondeu"); setResultadoAcao("acao_concluida");
  }
  function fechar() { reset(); onFecharAction(); }

  function submitAcaoComercial() {
    const entrada: EntradaAcaoComercial = {
      resultado: resultadoAcao,
      em: agoraISO,
      observacao: obs || null,
      proximaAcaoTipo: acaoTipo,
      proximaAcaoEm: inputParaIso(acaoEm),
      visitaEm: inputParaIso(visitaData),
      proposta:
        resultadoAcao === "proposta_registrada"
          ? { produto: produto.trim(), valor: Number(valor.replace(/\./g, "").replace(",", ".")), data: inputParaIso(propostaDataEfetiva), observacao: propostaObs || null }
          : null,
      descarte: resultadoAcao === "sem_interesse" ? { motivo, detalhe } : null,
    };
    const r = validarResultadoAcaoComercial(entrada);
    if (!r.ok) { setErros(r.erros); return; }
    onConcluirAcaoAction(entrada);
    fechar();
  }

  function submitTentativa() {
    const entrada: EntradaTentativa = {
      canal,
      resultado,
      em: agoraISO,
      observacao: obs || null,
      proximaAcaoTipo: resultado === "respondeu" ? acaoTipo : resultado === "pediu_retorno" ? "retornar_contato" : "tentativa_cadencia",
      proximaAcaoEm: inputParaIso(acaoEmEfetiva),
      encaminharDescarte,
    };
    const r = validarConclusaoTentativa(entrada);
    if (!r.ok) { setErros(r.erros); return; }
    onRegistrarTentativaAction(entrada);
    fechar();
  }
  function submitVisita() {
    const iso = inputParaIso(visitaData);
    if (!iso) { setErros(["Informe a data/hora da visita."]); return; }
    onAgendarVisitaAction(iso);
    fechar();
  }
  function submitProposta() {
    const p = { produto: produto.trim(), valor: Number(valor.replace(/\./g, "").replace(",", ".")), data: inputParaIso(propostaDataEfetiva) };
    const r = validarProposta(p);
    if (!r.ok) { setErros(r.erros); return; }
    onRegistrarPropostaAction({ produto: p.produto, valor: p.valor, data: p.data as string, observacao: propostaObs || undefined });
    fechar();
  }
  function submitDescarte() {
    const r = validarDescarte({ motivo, detalhe });
    if (!r.ok) { setErros(r.erros); return; }
    onDescartarAction({ motivo, detalhe });
    fechar();
  }

  const pedirDataAcao =
    resultado === "respondeu" || resultado === "pediu_retorno" ||
    ((resultado === "telefone_invalido" || resultado === "contato_inadequado") && !encaminharDescarte) ||
    resultado === "nao_respondeu";

  const rotuloDataAcao =
    resultado === "respondeu" ? "Data/hora da próxima ação (obrigatória)"
      : resultado === "pediu_retorno" ? "Data/hora combinadas do retorno (obrigatória)"
        : resultado === "telefone_invalido" ? "Agendar correção cadastral para"
          : resultado === "contato_inadequado" ? "Reagendar contato para"
            : "Próxima tentativa da cadência (sugerida — ajuste se necessário)";

  return (
    <div className="nova-crm-modal-layer" onClick={fechar}>
      <div className="nova-crm-modal" onClick={(e) => e.stopPropagation()}>
        {erros.length > 0 && <div className="nova-crm-err">{erros.join(" ")}</div>}

        {tipo === "tentativa" && (
          <>
            <h3>Registrar tentativa</h3>
            <p className="sub">Cadência de prospecção (cliente ainda não respondeu). Simulação — nada é enviado. Nenhuma conclusão deixa o lead sem próximo passo.</p>
            <div className="nova-crm-field">
              <label>Canal</label>
              <select value={canal} onChange={(e) => setCanal(e.target.value as CanalContato)}>
                {CANAIS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
              </select>
            </div>
            <div className="nova-crm-field">
              <label>Resultado</label>
              <select value={resultado} onChange={(e) => { setResultado(e.target.value as ResultadoTentativa); setErros([]); setAcaoEm(""); setEncaminharDescarte(false); }}>
                {RESULTADOS.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
              </select>
            </div>

            {resultado === "respondeu" && (
              <div className="nova-crm-field">
                <label>Próxima ação comercial (obrigatória — a cadência encerra)</label>
                <select value={acaoTipo} onChange={(e) => setAcaoTipo(e.target.value as ProximaAcaoTipo)}>
                  {ACOES_COMERCIAIS.map((a) => <option key={a} value={a}>{ACAO_TITULO[a]}</option>)}
                </select>
              </div>
            )}

            {(resultado === "telefone_invalido" || resultado === "contato_inadequado") && (
              <div className="nova-crm-field">
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" checked={encaminharDescarte} onChange={(e) => setEncaminharDescarte(e.target.checked)} />
                  Encaminhar para descarte estruturado
                </label>
              </div>
            )}

            {pedirDataAcao && (
              <div className="nova-crm-field">
                <label>{rotuloDataAcao}</label>
                <input type="datetime-local" value={acaoEmEfetiva} onChange={(e) => setAcaoEm(e.target.value)} />
              </div>
            )}

            <div className="nova-crm-field">
              <label>Observação {resultado === "sem_interesse" || resultado === "contato_inadequado" ? "(obrigatória)" : "(opcional)"}</label>
              <textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
            </div>
            <div className="nova-crm-modal-foot">
              <button className="nova-crm-btn ghost" onClick={fechar}>Cancelar</button>
              <button className="nova-crm-btn primary" onClick={submitTentativa}>Registrar</button>
            </div>
          </>
        )}

        {tipo === "acao" && (
          <>
            <h3>Concluir ação atual</h3>
            <p className="sub">
              Acompanhamento comercial (cliente já respondeu) — este fluxo NÃO usa a cadência de
              prospecção e nunca mostra &ldquo;Tentativa 2/3/4&rdquo;. Simulação, nada é enviado.
            </p>
            <div className="nova-crm-field">
              <label>Ação que estava prevista</label>
              <input value={lead.proximaAcaoTitulo ?? "—"} readOnly disabled />
            </div>
            <div className="nova-crm-field">
              <label>Resultado da ação</label>
              <select value={resultadoAcao} onChange={(e) => { setResultadoAcao(e.target.value as ResultadoAcaoComercial); setErros([]); }}>
                {RESULTADOS_ACAO_COMERCIAL.map((r) => <option key={r} value={r}>{RESULTADO_ACAO_ROTULO[r]}</option>)}
              </select>
            </div>

            {resultadoAcao === "visita_agendada" && (
              <div className="nova-crm-field">
                <label>Data/hora da visita (encaminha ao Pipeline de Visitas)</label>
                <input type="datetime-local" value={visitaData} onChange={(e) => setVisitaData(e.target.value)} />
              </div>
            )}

            {resultadoAcao === "proposta_registrada" && (
              <>
                <div className="nova-crm-field">
                  <label>Empreendimento / produto</label>
                  <input value={produto} onChange={(e) => setProduto(e.target.value)} placeholder="Ex.: Residencial Demo — un. 101" />
                </div>
                <div className="nova-crm-field">
                  <label>Valor proposto (R$)</label>
                  <input inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex.: 450000" />
                </div>
                <div className="nova-crm-field">
                  <label>Data da proposta</label>
                  <input type="datetime-local" value={propostaDataEfetiva} onChange={(e) => setPropostaData(e.target.value)} />
                </div>
              </>
            )}

            {resultadoAcao === "sem_interesse" && (
              <>
                <div className="nova-crm-field">
                  <label>Motivo do descarte estruturado (obrigatório)</label>
                  <select value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoDescarte)}>
                    {MOTIVOS_DESCARTE.map((m) => <option key={m} value={m}>{MOTIVO_ROTULO[m]}</option>)}
                  </select>
                </div>
                {motivo === "outro" && (
                  <div className="nova-crm-field">
                    <label>Descreva o motivo</label>
                    <textarea rows={2} value={detalhe} onChange={(e) => setDetalhe(e.target.value)} />
                  </div>
                )}
              </>
            )}

            {!["visita_agendada", "proposta_registrada", "sem_interesse", "pediu_novo_retorno", "aguardando_documento"].includes(resultadoAcao) && (
              <div className="nova-crm-field">
                <label>Próxima ação comercial (obrigatória)</label>
                <select value={acaoTipo} onChange={(e) => setAcaoTipo(e.target.value as ProximaAcaoTipo)}>
                  {ACOES_COMERCIAIS.map((a) => <option key={a} value={a}>{ACAO_TITULO[a]}</option>)}
                </select>
              </div>
            )}

            {["acao_concluida", "cliente_respondeu", "sem_resposta_acompanhamento", "opcoes_enviadas", "outro", "pediu_novo_retorno", "aguardando_documento"].includes(resultadoAcao) && (
              <div className="nova-crm-field">
                <label>
                  {resultadoAcao === "pediu_novo_retorno"
                    ? "Data/hora combinadas do novo retorno (obrigatória)"
                    : resultadoAcao === "aguardando_documento"
                      ? "Quando cobrar a documentação (obrigatória)"
                      : "Data/hora da próxima ação (obrigatória)"}
                </label>
                <input type="datetime-local" value={acaoEm} onChange={(e) => setAcaoEm(e.target.value)} />
              </div>
            )}

            <div className="nova-crm-field">
              <label>Observação (opcional)</label>
              <textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
            </div>
            <div className="nova-crm-modal-foot">
              <button className="nova-crm-btn ghost" onClick={fechar}>Cancelar</button>
              <button className="nova-crm-btn primary" onClick={submitAcaoComercial}>Concluir ação</button>
            </div>
          </>
        )}

        {tipo === "visita" && (
          <>
            <h3>Agendar visita</h3>
            <p className="sub">Simulação — o lead sai do quadro e vai para &ldquo;Encaminhados para Pipeline de Visitas&rdquo;.</p>
            <div className="nova-crm-field">
              <label>Data/hora da visita</label>
              <input type="datetime-local" value={visitaData} onChange={(e) => setVisitaData(e.target.value)} />
            </div>
            <div className="nova-crm-modal-foot">
              <button className="nova-crm-btn ghost" onClick={fechar}>Cancelar</button>
              <button className="nova-crm-btn primary" onClick={submitVisita}>Agendar visita</button>
            </div>
          </>
        )}

        {tipo === "proposta" && (
          <>
            <h3>Registrar proposta</h3>
            <p className="sub">
              A Esteira de Vendas inicia com o REGISTRO da proposta — não é necessário aceite.
              Simulação: nenhuma venda real é criada.
            </p>
            <div className="nova-crm-field">
              <label>Empreendimento / produto</label>
              <input value={produto} onChange={(e) => setProduto(e.target.value)} placeholder="Ex.: Residencial Demo — un. 101" />
            </div>
            <div className="nova-crm-field">
              <label>Valor proposto (R$)</label>
              <input inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex.: 450000" />
            </div>
            <div className="nova-crm-field">
              <label>Data da proposta</label>
              <input type="datetime-local" value={propostaDataEfetiva} onChange={(e) => setPropostaData(e.target.value)} />
            </div>
            <div className="nova-crm-field">
              <label>Observação (opcional)</label>
              <textarea rows={2} value={propostaObs} onChange={(e) => setPropostaObs(e.target.value)} />
            </div>
            <div className="nova-crm-modal-foot">
              <button className="nova-crm-btn ghost" onClick={fechar}>Cancelar</button>
              <button className="nova-crm-btn primary" onClick={submitProposta}>
                Registrar proposta e encaminhar para a Esteira de Vendas
              </button>
            </div>
          </>
        )}

        {tipo === "descartar" && (
          <>
            <h3>Descartar lead</h3>
            <p className="sub">Simulação — motivo estruturado (não remove nada real).</p>
            <div className="nova-crm-field">
              <label>Motivo</label>
              <select value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoDescarte)}>
                {MOTIVOS_DESCARTE.map((m) => <option key={m} value={m}>{MOTIVO_ROTULO[m]}</option>)}
              </select>
            </div>
            {motivo === "outro" && (
              <div className="nova-crm-field">
                <label>Descreva o motivo</label>
                <textarea rows={2} value={detalhe} onChange={(e) => setDetalhe(e.target.value)} />
              </div>
            )}
            <div className="nova-crm-modal-foot">
              <button className="nova-crm-btn ghost" onClick={fechar}>Cancelar</button>
              <button className="nova-crm-btn danger" onClick={submitDescarte}>Descartar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
