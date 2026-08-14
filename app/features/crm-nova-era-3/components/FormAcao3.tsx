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

/* A visita nao e so data e hora. O CRM antigo sempre gravou produto, unidade e
   gerente -- e sem gerente escolhido nao da para checar conflito de agenda. */
export type DadosVisita = {
  data: string; hora: string;
  empreendimentoId: string | null; produto: string | null; unidade: string | null;
  comGerente: boolean; gerenteId: number | null;
};

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
  onCriarVisita: (dados: DadosVisita) => void | Promise<void>;
}) {
  const [canal, setCanal] = useState("whatsapp");
  const [resultado, setResultado] = useState(lead.respondeu ? "respondeu" : "nao_respondeu");
  const [obs, setObs] = useState("");
  const [proximaTipo, setProximaTipo] = useState(inicial?.proximaTipo ?? "entender_necessidade");
  const [proximaEm, setProximaEm] = useState(() => inicial?.prazo ?? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16));
  const [vData, setVData] = useState("");
  const [vHora, setVHora] = useState("");
  const [vEmpreendimento, setVEmpreendimento] = useState("");
  const [vUnidade, setVUnidade] = useState("");
  const [vComGerente, setVComGerente] = useState(false);
  const [vGerente, setVGerente] = useState("");
  const [gerentes, setGerentes] = useState<Array<{ id: number; nome: string; geral: boolean }>>([]);
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
    if (tipo !== "proposta" && tipo !== "visita") return;
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

  useEffect(() => {
    if (tipo !== "visita") return;
    const ctrl = new AbortController();
    void fetch("/api/ncrm/gerentes", { headers: { Authorization: `Bearer ${accessToken}` }, signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("falha"))))
      .then((j: { gerentes?: Array<{ id: number; nome: string; geral: boolean }> }) => setGerentes(j.gerentes ?? []))
      .catch(() => { /* sem gerente na lista o corretor ainda agenda a visita */ });
    return () => ctrl.abort();
  }, [tipo, accessToken]);

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
            <p className="ncrm3-nota"><b>A Sara define o próximo passo.</b> Depois de salvar, ela relê a conversa, escolhe uma das 10 ações oficiais e determina o prazo.</p>
          )}
          <label className="ncrm3-linha" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <span>Observação</span>
            <input value={obs} onChange={(e) => setObs(e.target.value)} />
          </label>
          <div className="ncrm3-avancadas">
            <button type="button" className="ncrm3-secundario" onClick={onCancelar}>Cancelar</button>
            <button
              type="button" className="ncrm3-principal" disabled={busy}
              onClick={() => onEnviar(lead.respondeu
                ? { action: "concluirAcao", ...base, resultado, obs, proximaTipo: "outro", proximaTitulo: "Sara avaliando a conversa", proximaEm: new Date(Date.now() + 15 * 60 * 1000).toISOString() }
                : {
                    action: "registrarTentativa", ...base, canal, resultado, obs,
                    proximaTipo: respondeuAgora ? "outro" : null,
                    proximaTitulo: respondeuAgora ? "Sara avaliando a conversa" : null,
                    proximaEm: respondeuAgora ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null,
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
            <span>Produto que vai ser mostrado</span>
            <input
              value={produtoBusca}
              onChange={(e) => { setProdutoBusca(e.target.value); setVEmpreendimento(""); }}
              placeholder="Digite para procurar o empreendimento"
            />
            <select value={vEmpreendimento} onChange={(e) => setVEmpreendimento(e.target.value)}>
              <option value="">— escolha o empreendimento —</option>
              {produtos.map((p) => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
            </select>
            {produtosErro && <small className="ncrm3-erro">{produtosErro}</small>}
          </label>
          <label className="ncrm3-linha" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <span>Unidade <small>(opcional)</small></span>
            <input value={vUnidade} onChange={(e) => setVUnidade(e.target.value)} placeholder="Ex.: apto 402" />
          </label>
          <label className="ncrm3-linha" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <span>Data</span><input type="date" value={vData} onChange={(e) => setVData(e.target.value)} />
          </label>
          <label className="ncrm3-linha" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <span>Hora de início</span><input type="time" value={vHora} onChange={(e) => setVHora(e.target.value)} />
          </label>
          <label className="ncrm3-linha">
            <input
              type="checkbox"
              checked={vComGerente}
              onChange={(e) => {
                const marcou = e.target.checked;
                setVComGerente(marcou);
                if (marcou && !vGerente) setVGerente(String(gerentes.find((g) => g.geral)?.id ?? gerentes[0]?.id ?? ""));
              }}
            />
            <span>Quero o gerente presente</span>
          </label>
          {vComGerente && (
            <label className="ncrm3-linha" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <span>Qual gerente</span>
              <select value={vGerente} onChange={(e) => setVGerente(e.target.value)}>
                <option value="">— escolha —</option>
                {gerentes.map((g) => <option key={g.id} value={String(g.id)}>{g.nome}{g.geral ? " (geral)" : ""}</option>)}
              </select>
              <small className="ncrm3-nota">Se o gerente já tiver visita nesse horário, o sistema recusa e diz com quem é o choque.</small>
            </label>
          )}
          <div className="ncrm3-avancadas">
            <button type="button" className="ncrm3-secundario" onClick={onCancelar}>Cancelar</button>
            <button
              type="button"
              className="ncrm3-principal"
              disabled={busy || !vData || !vHora || !leadId || (!vEmpreendimento && vUnidade.trim().length < 2) || (vComGerente && !vGerente)}
              onClick={() => onCriarVisita({
                data: vData,
                hora: vHora,
                empreendimentoId: vEmpreendimento || null,
                produto: produtos.find((p) => p.id === vEmpreendimento)?.rotulo ?? (vUnidade.trim() || null),
                unidade: vUnidade.trim() || null,
                comGerente: vComGerente,
                gerenteId: vComGerente && vGerente ? Number(vGerente) : null,
              })}
            >
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
