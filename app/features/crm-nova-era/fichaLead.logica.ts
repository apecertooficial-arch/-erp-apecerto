/* FICHA DO LEAD NO CELULAR — regras puras (print 06 do pacote de design).
 *
 * Nenhuma destas funções toca em React, DOM ou rede: só entra dado e sai
 * texto. Vive fora do .tsx porque o `--experimental-strip-types` do node
 * não entende JSX — regra escrita dentro do componente é regra que nunca
 * vai ser testada.
 *
 * SÓ `import type` AQUI, e não é estilo: o strip-types APAGA import de
 * tipo, mas mantém import de valor. Mantido, o Node ESM exigiria extensão
 * explícita (`.ts`) no caminho, que por sua vez o build do aplicativo não
 * aceita. É a mesma razão pela qual meuDia.logica.ts não importa nada e
 * carrega uma cópia da regra canônica.
 *
 * REGRAS DE PRODUTO que este arquivo faz valer (README do pacote, §57-64):
 *   - "Sem vocabulário técnico na tela do corretor": `rotuloEvento` traduz
 *     por lista fechada e cai num rótulo genérico no desconhecido. É o
 *     único jeito de garantir que um `tipo` novo no banco não vaze
 *     "ingest" ou "runner" para a tela amanhã.
 *   - "Histórico é somente leitura": aqui só há leitura mesmo.
 *   - "Concluir tarefa ≠ contato realizado": `estadoWhatsapp` nunca
 *     devolve "confirmado" por toque — só quando o servidor confirma.
 */

import type { ItemTela } from "../home/telaCorretor.logica";

/* Cópia de `espera` de telaCorretor.logica.ts — ver o cabeçalho acima.
   AMARRADA POR TESTE: tests/ficha-lead-celular.test.mjs importa as duas e
   falha se discordarem em qualquer valor. Duas telas que escrevem "24h" e
   "1 d" para o mesmo lead é defeito que o corretor vê antes de nós. */
export function esperaCurta(minutos: number): string {
  const m = Math.max(0, Math.round(Number(minutos) || 0));
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)} d`;
}

export type AbaFicha = "conversa" | "sara" | "dados" | "historico";

/* A ordem é a do print: Conversa, Sara, Dados, Histórico. */
export const ABAS_FICHA: { id: AbaFicha; rotulo: string }[] = [
  { id: "conversa", rotulo: "Conversa" },
  { id: "sara", rotulo: "Sara" },
  { id: "dados", rotulo: "Dados" },
  { id: "historico", rotulo: "Histórico" },
];

/* Abre em "Dados" igual ao print. É a aba que responde a pergunta mais
   comum na rua ("qual é o telefone?") sem esperar chamada nenhuma. */
export const ABA_INICIAL: AbaFicha = "dados";

/** E.164 (55 + DDD + número) para o formato que se lê: (11) 98888-2869. */
export function telefoneExibicao(e164: string | null | undefined): string | null {
  const d = String(e164 ?? "").replace(/\D/g, "");
  if (d.length !== 12 && d.length !== 13) return null;
  const ddd = d.slice(2, 4);
  const n = d.slice(4);
  if (n.length === 9) return `(${ddd}) ${n.slice(0, 5)}-${n.slice(5)}`;
  if (n.length === 8) return `(${ddd}) ${n.slice(0, 4)}-${n.slice(4)}`;
  return null;
}

/** `em_atendimento` → `Em atendimento`. Etapa técnica não vai para a tela. */
export function etapaHumana(etapa: string | null | undefined): string {
  const t = String(etapa ?? "").trim().replace(/_/g, " ").toLowerCase();
  if (!t) return "Sem etapa";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const MIN_MS = 60_000;
const meiaNoite = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "Hoje, até 12h" · "Amanhã, até 10h" · "Venceu 2h atrás" · "Sem prazo". */
export function prazoHumano(iso: string | null | undefined, agora: Date = new Date()): string {
  if (!iso) return "Sem prazo";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Sem prazo";

  if (d.getTime() < agora.getTime()) {
    return `Venceu ${esperaCurta(Math.round((agora.getTime() - d.getTime()) / MIN_MS))} atrás`;
  }

  const min = d.getMinutes();
  const hora = min === 0 ? `${d.getHours()}h` : `${d.getHours()}h${String(min).padStart(2, "0")}`;
  const dias = Math.round((meiaNoite(d) - meiaNoite(agora)) / (24 * 60 * MIN_MS));
  if (dias <= 0) return `Hoje, até ${hora}`;
  if (dias === 1) return `Amanhã, até ${hora}`;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}, até ${hora}`;
}

/** A "evidência" do print: por que este lead está aqui, em fato observável. */
export function evidencia(i: ItemTela): string {
  const t = esperaCurta(i.tempo_espera);
  return i.respondeu ? `Respondeu há ${t}` : `Sem resposta há ${t}`;
}

/** O texto grande do bloco roxo. A Sara fala; calada, o motivo da fila fala. */
export function oQueFazerAgora(i: ItemTela): string {
  const sara = (i.sara_orientacao_curta ?? "").trim();
  if (sara) return sara;
  const motivo = (i.motivo_prioridade ?? "").trim();
  return motivo || "Retomar o atendimento";
}

/** Quando a Sara já disse o que fazer, o motivo da fila vira o "porquê". */
export function porQueAgora(i: ItemTela): string | null {
  const sara = (i.sara_orientacao_curta ?? "").trim();
  const motivo = (i.motivo_prioridade ?? "").trim();
  if (!sara || !motivo || sara === motivo) return null;
  return motivo;
}

export type EstadoWhatsapp = "pronto" | "aguardando" | "confirmado";

/* Mesma regra da tela de Início, de propósito: duas telas que discordam
   sobre se a mensagem saiu é pior do que qualquer uma das duas errada.
   `abriuLocal` é o registro de intenção no aparelho — abrir o WhatsApp
   NÃO é ter falado com o cliente, e só a integração confirma. */
export function estadoWhatsapp(i: ItemTela, abriuLocal: boolean): EstadoWhatsapp {
  if (i.outbound_real_confirmado) return "confirmado";
  if (i.aguardando_sincronizacao || abriuLocal) return "aguardando";
  return "pronto";
}

/* --------------------------------------------------------------------
   HISTÓRICO — tradução por lista fechada.

   `ncrm_evento.tipo` é vocabulário de banco. Prettificar o texto cru
   ("mensagem_enviada" → "Mensagem enviada") funcionaria hoje e vazaria
   amanhã, no primeiro tipo novo que alguém chamar de `ingest_retry`.
   Lista fechada + rótulo genérico é a única versão que não tem esse
   modo de falha.
   -------------------------------------------------------------------- */
const ROTULO_EVENTO: Record<string, string> = {
  lead_recebido: "Cliente chegou",
  primeiro_contato: "Primeiro contato",
  tentativa: "Tentativa de contato",
  mensagem_enviada: "Mensagem enviada",
  mensagem_recebida: "Cliente respondeu",
  resposta_recebida: "Cliente respondeu",
  acao_concluida: "Tarefa concluída",
  visita_agendada: "Visita agendada",
  visita_realizada: "Visita realizada",
  visita_cancelada: "Visita cancelada",
  proposta_criada: "Proposta enviada",
  proposta_encerrada: "Proposta encerrada",
  descarte: "Atendimento encerrado",
  nutricao: "Enviado para nutrição",
  reativado: "Atendimento reaberto",
  transferido: "Passou para outro corretor",
  justificativa: "Justificativa registrada",
};

export function rotuloEvento(tipo: string | null | undefined): string {
  const t = String(tipo ?? "").trim().toLowerCase();
  return ROTULO_EVENTO[t] ?? "Atualização do atendimento";
}

/** "30/07 · 17:42" — data curta, que é o que cabe na linha. */
export function quandoHumano(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${dia}/${mes} · ${hh}:${mm}`;
}

/* --------------------------------------------------------------------
   DETALHE — o que só existe em GET /api/ncrm?negocio=
   -------------------------------------------------------------------- */
export type DetalheFicha = {
  corretor: string | null;
  origem: string | null;
  email: string | null;
  primeiraResposta: string | null;
  eventos: { id: string; rotulo: string; quando: string }[];
};

type Bruto = Record<string, unknown>;
const obj = (v: unknown): Bruto => (v && typeof v === "object" ? (v as Bruto) : {});
const txt = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > 0 ? s : null;
};

/* Leitura defensiva: o embed do Supabase devolve ora objeto, ora array de
   um elemento, dependendo da cardinalidade que ele infere. Quebrar a ficha
   inteira por causa disso seria trocar um defeito silencioso por outro. */
const um = (v: unknown): Bruto => (Array.isArray(v) ? obj(v[0]) : obj(v));

export function lerDetalhe(json: unknown): DetalheFicha {
  const raiz = obj(json);
  const estado = um(raiz.estado);
  const negocio = um(estado.negocios);
  const lead = um(negocio.leads);
  const corretor = um(negocio.corretores);

  const eventosBrutos = Array.isArray(raiz.eventos) ? raiz.eventos : [];
  const eventos = eventosBrutos
    .map((e, idx) => {
      const ev = obj(e);
      return {
        id: String(ev.id ?? idx),
        rotulo: rotuloEvento(typeof ev.tipo === "string" ? ev.tipo : null),
        quando: quandoHumano(typeof ev.criado_em === "string" ? ev.criado_em : null),
      };
    })
    /* Mais recente primeiro: na rua ninguém rola até o fim para saber o
       que aconteceu agora. A rota devolve em ordem crescente. */
    .reverse();

  return {
    corretor: txt(corretor.nome),
    origem: txt(lead.origem),
    email: txt(lead.email),
    primeiraResposta: quandoHumano(typeof estado.primeira_resposta_em === "string" ? estado.primeira_resposta_em : null) || null,
    eventos,
  };
}

export type LinhaDado = { k: string; v: string };

/** As linhas da aba Dados, na ordem do print. Campo vazio não vira linha. */
export function linhasDeDados(i: ItemTela, det: DetalheFicha | null): LinhaDado[] {
  const linhas: LinhaDado[] = [];
  const poe = (k: string, v: string | null | undefined) => {
    const s = (v ?? "").trim();
    if (s) linhas.push({ k, v: s });
  };
  poe("Corretor", det?.corretor);
  poe("Origem", det?.origem);
  poe("Interesse", i.interesse_resumo);
  poe("E-mail", det?.email);
  poe("Primeira resposta", det?.primeiraResposta);
  return linhas;
}

/* --------------------------------------------------------------------
   CONVERSA — mensagens de wa_mensagens
   -------------------------------------------------------------------- */
export type MensagemFicha = { id: string; minha: boolean; texto: string; quando: string };

export function lerConversa(json: unknown): MensagemFicha[] {
  const raiz = obj(json);
  const brutas = Array.isArray(raiz.mensagens) ? raiz.mensagens : [];
  return brutas
    .map((m, idx) => {
      const msg = obj(m);
      const conteudo = txt(msg.conteudo) ?? txt(msg.transcricao);
      /* Áudio, imagem e documento chegam sem texto. Dizer o que é vale
         mais do que uma bolha vazia que parece defeito. */
      const tipo = String(msg.tipo ?? "").toLowerCase();
      const texto = conteudo ?? (tipo && tipo !== "texto" ? `[${tipo}]` : "");
      return {
        id: String(msg.id ?? idx),
        minha: String(msg.direcao ?? "").toLowerCase().startsWith("out"),
        texto,
        quando: quandoHumano(txt(msg.enviado_em) ?? txt(msg.criado_em)),
      };
    })
    .filter((m) => m.texto.length > 0);
}
