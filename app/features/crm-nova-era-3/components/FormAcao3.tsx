"use client";
/**
 * FORMULÁRIOS DE AÇÃO 3.0 — a confirmação humana.
 *
 * Toda escrita continua indo pelos contratos que já existiam
 * (PATCH /api/ncrm, que chama as funções autorizadas do banco). Este arquivo
 * não inventa ação nova: só apresenta as mesmas com a linguagem do corretor.
 */
import { useEffect, useState } from "react";
import type { LeadNova } from "../../crm-nova-era/lib/rules";

export type TipoForm = "resultado" | "proxima" | "visita" | "proposta" | "nutricao" | "descarte";

export const TITULO_FORM: Record<TipoForm, string> = {
  resultado: "Marcar ação como feita",
  proxima: "Definir a próxima ação",
  visita: "Agendar visita",
  proposta: "Registrar proposta na Esteira",
  nutricao: "Enviar para nutrição",
  descarte: "Descartar",
};

const PROXIMAS = [
  { v: "retornar_contato", r: "Responder o cliente" },
  { v: "entender_necessidade", r: "Qualificar necessidade" },
  { v: "enviar_opcoes", r: "Enviar opções de imóveis" },
  { v: "confirmar_recebimento", r: "Validar opções enviadas" },
  { v: "ligar_retorno", r: "Ligar para o cliente" },
  { v: "agendar_visita", r: "Convidar ou confirmar visita" },
  { v: "preparar_proposta", r: "Preparar proposta" },
  { v: "avaliar_descarte", r: "Avaliar encerramento" },
];

const MOTIVOS = [
  { v: "sem_interesse", r: "Sem interesse" },
  { v: "sem_perfil_financeiro", r: "Sem perfil financeiro" },
  { v: "numero_invalido", r: "Número inválido" },
  { v: "ja_comprou_concorrente", r: "Já comprou com concorrente" },
  { v: "duplicado", r: "Duplicado" },
  { v: "outro", r: "Outro" },
];

export function FormAcao3({
  tipo, lead, versao, leadId, busy, accessToken, inicial,
  onCancelar, onEnviar, onCriarVisita,
}: {
  tipo: TipoForm;
  lead: LeadNova;
  versao: number;
  leadId: number | null;
  busy: boolean;
  accessToken: string;
  inicial?: { proximaTipo?: string; prazo?: string };
  onCancelar: () => void;
  onEnviar: (payload: Record<string, unknown>) => void | Promise<void>;
  onCriarVisita: (data: string, hora: string) => void | Promise<void>;
}) {
  const [canal, setCanal] = useState("whatsapp");
  const [resultado, setResultado] = useState(lead.respondeu ? "respondeu" : "nao_respondeu");
  const [obs, setObs] = useState("");
  const [proximaTipo, setProximaTipo] = useState(inicial?.proximaTipo ?? "entender_necessidade");
  const [proximaEm, setProximaEm] = useState(inicial?.prazo ?? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16));
  const [vData, setVData] = useState("");
  const [vHora, setVHora] = useState("");
  const [valor, setValor] = useState("");
  const [forma, setForma] = useState("");
  const [produtoId, setProdutoId] = useState("");
  const [produtoBusca, setProdutoBusca] = useState("");
  const [produtos, setProdutos] = useState<Array<{ id: string; rotulo: string }>>([]);
  const [produtosErro, setProdutosErro] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("sem_interesse");
  const [detalhe, setDetalhe] = useState("");

  const base = { negocioId: Number(lead.id), versao };
  const respondeuAgora = resultado === "respondeu" || resultado === "pediu_retorno";
  const proxIso = proximaEm ? new Date(proximaEm).toISOString() : null;

  useEffect(() => {
    if (tipo !== "proposta") return;
    const ctrl = new AbortController();
    const q = produtoBusca.trim();
    const t = setTimeout(() => {
      void fetch(`/api/ncrm/produtos${q ? `?q=${encodeURIComponent(q)}` : ""}`, {
        headers: { Authorization: `Bearer ${accessToken}` }, signal: ctrl.signal,
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("falha"))))
        .then((j: { produtos?: Array<{ id: string; rotulo: string }> }) => { setProdutos(j.produtos ?? []); setProdutosErro(null); })
        .catch((e) => { if ((e as { name?: string })?.name !== "AbortError") setProdutosErro("Não foi possível carregar os imóveis."); });
    }, 250);
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [tipo, produtoBusca, accessToken]);

  return (
    <div className="ncrm3-bloco" style={{ borderTop: "1px solid var(--line)", background: "var(--sunken)" }}>
      <h3>{TITULO_FORM[tipo]}</h3>

      {tipo === "resultado" && (
        <>
          <label className="ncrm3-linha" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <span>Por onde você falou</span>
            <select value={canal} onChange={(e) => setCanal(e.target.value)}>
              <option value="whatsapp">WhatsApp</option>
              <option value="ligacao">Ligação</option>
              <option value="email">E-mail</option>
              <option value="presencial">Presencial</option>
            </select>
          </label>
          <label className="ncrm3-linha" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <span>O que aconteceu</span>
            <select value={resultado} onChange={(e) => setResultado(e.target.value)}>
              <option value="nao_respondeu">Não respondeu</option>
              <option value="respondeu">Consegui falar</option>
              <option value="pediu_retorno">Pediu para retornar depois</option>
              <option value="telefone_invalido">Número inválido</option>
              <option value="sem_interesse">Sem interesse</option>
              <option value="contato_inadequado">Contato inadequado</option>
            </select>
          </label>
          {respondeuAgora && (
            <>
              <label className="ncrm3-linha" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <span>Próxima ação</span>
                <select value={proximaTipo} onChange={(e) => setProximaTipo(e.target.value)}>
                  {PROXIMAS.map((p) => <option key={p.v} value={p.v}>{p.r}</option>)}
                </select>
              </label>
              <label className="ncrm3-linha" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <span>Para quando</span>
                <input type="datetime-local" value={proximaEm} onChange={(e) => setProximaEm(e.target.value)} />
              </label>
            </>
          )}
          <label className="ncrm3-linha" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <span>Observação</span>
            <input value={obs} onChange={(e) => setObs(e.target.value)} />
          </label>
          <div className="ncrm3-avancadas">
            <button type="button" className="ncrm3-secundario" onClick={onCancelar}>Cancelar</button>
            <button
              type="button" className="ncrm3-principal" disabled={busy || (respondeuAgora && !proximaEm)}
              onClick={() => onEnviar(lead.respondeu
                ? { action: "concluirAcao", ...base, resultado, obs, proximaTipo, proximaTitulo: proximaTipo.replace(/_/g, " "), proximaEm: proxIso }
                : {
                    action: "registrarTentativa", ...base, canal, resultado, obs,
                    proximaTipo: respondeuAgora ? proximaTipo : null,
                    proximaTitulo: respondeuAgora ? proximaTipo.replace(/_/g, " ") : null,
                    proximaEm: respondeuAgora ? proxIso : null,
                  })}
            >
              Concluir e receber o próximo passo
            </button>
          </div>
        </>
      )}

      {tipo === "proxima" && (
        <>
          <label className="ncrm3-linha" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <span>Próxima ação</span>
            <select value={proximaTipo} onChange={(e) => setProximaTipo(e.target.value)}>
              {PROXIMAS.map((p) => <option key={p.v} value={p.v}>{p.r}</option>)}
            </select>
          </label>
          <label className="ncrm3-linha" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <span>Para quando</span>
            <input type="datetime-local" value={proximaEm} onChange={(e) => setProximaEm(e.target.value)} />
          </label>
          <label className="ncrm3-linha" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <span>Observação</span>
            <input value={obs} onChange={(e) => setObs(e.target.value)} />
          </label>
          <div className="ncrm3-avancadas">
            <button type="button" className="ncrm3-secundario" onClick={onCancelar}>Cancelar</button>
            <button
              type="button" className="ncrm3-principal" disabled={busy || !proximaEm}
              onClick={() => onEnviar({
                action: "concluirAcao", ...base, resultado: "acao_concluida", obs,
                proximaTipo, proximaTitulo: proximaTipo.replace(/_/g, " "), proximaEm: proxIso,
              })}
            >
              Salvar
            </button>
          </div>
        </>
      )}

      {tipo === "visita" && (
        <>
          <p className="ncrm3-nota">
            Agenda uma visita real, no mesmo fluxo da Agenda. Só depois de criada o cliente aparece no Pipe de
            Visitas — intenção de visitar não conta.
          </p>
          <label className="ncrm3-linha" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <span>Data</span><input type="date" value={vData} onChange={(e) => setVData(e.target.value)} />
          </label>
          <label className="ncrm3-linha" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <span>Hora de início</span><input type="time" value={vHora} onChange={(e) => setVHora(e.target.value)} />
          </label>
          <div className="ncrm3-avancadas">
            <button type="button" className="ncrm3-secundario" onClick={onCancelar}>Cancelar</button>
            <button type="button" className="ncrm3-principal" disabled={busy || !vData || !vHora || !leadId} onClick={() => onCriarVisita(vData, vHora)}>
              Criar visita
            </button>
          </div>
        </>
      )}

      {tipo === "proposta" && (
        <>
          <p className="ncrm3-nota">
            Proposta não é venda. Cria a solicitação real na Esteira de Vendas e encaminha o cliente para lá.
          </p>
          <label className="ncrm3-linha" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <span>Buscar imóvel</span>
            <input value={produtoBusca} onChange={(e) => setProdutoBusca(e.target.value)} placeholder="nome ou bairro" />
          </label>
          <label className="ncrm3-linha" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <span>Imóvel</span>
            <select value={produtoId} onChange={(e) => setProdutoId(e.target.value)}>
              <option value="">— selecione pelo nome —</option>
              {produtos.map((p) => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
            </select>
          </label>
          {produtosErro && <p className="ncrm3-nota" style={{ color: "#a02a2a" }}>{produtosErro}</p>}
          <label className="ncrm3-linha" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <span>Valor (R$)</span><input type="number" value={valor} onChange={(e) => setValor(e.target.value)} />
          </label>
          <label className="ncrm3-linha" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <span>Forma de pagamento</span><input value={forma} onChange={(e) => setForma(e.target.value)} placeholder="opcional" />
          </label>
          <div className="ncrm3-avancadas">
            <button type="button" className="ncrm3-secundario" onClick={onCancelar}>Cancelar</button>
            <button
              type="button" className="ncrm3-principal" disabled={busy || !valor || !produtoId}
              onClick={() => onEnviar({ action: "registrarPropostaEsteira", ...base, produtoId, valor: Number(valor), forma: forma || null, obs })}
            >
              Registrar proposta
            </button>
          </div>
        </>
      )}

      {tipo === "nutricao" && (
        <>
          <label className="ncrm3-linha" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <span>Motivo</span><input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="ex.: compra prevista para o ano que vem" />
          </label>
          <div className="ncrm3-avancadas">
            <button type="button" className="ncrm3-secundario" onClick={onCancelar}>Cancelar</button>
            <button type="button" className="ncrm3-principal" disabled={busy} onClick={() => onEnviar({ action: "saidaNutricao", ...base, motivo: obs || null })}>
              Enviar para nutrição
            </button>
          </div>
        </>
      )}

      {tipo === "descarte" && (
        <>
          <label className="ncrm3-linha" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <span>Motivo</span>
            <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              {MOTIVOS.map((m) => <option key={m.v} value={m.v}>{m.r}</option>)}
            </select>
          </label>
          {motivo === "outro" && (
            <label className="ncrm3-linha" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <span>Detalhe</span><input value={detalhe} onChange={(e) => setDetalhe(e.target.value)} />
            </label>
          )}
          <div className="ncrm3-avancadas">
            <button type="button" className="ncrm3-secundario" onClick={onCancelar}>Cancelar</button>
            <button type="button" className="ncrm3-principal" disabled={busy} onClick={() => onEnviar({ action: "saidaDescarte", ...base, motivo, detalhe: detalhe || null })}>
              Descartar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
