/**
 * AS QUATRO ETAPAS DO FUNIL 3.0 — PURO e testável.
 *
 * A fonte da verdade das etapas continua sendo `crm-nova-era/lib/rules.ts`
 * (COLUNAS). Aqui só existe a camada de APRESENTAÇÃO: título curto, ajuda em
 * linguagem do corretor e a cor do marcador. Nada é renomeado no domínio.
 *
 * Cada etapa contém momentos operacionais. Visita agendada aparece também no
 * Pipe de Visitas; proposta registrada inicia a Esteira de Vendas.
 */
import { COLUNAS, type ColunaChave } from "../../crm-nova-era/lib/rules.ts";

export type Momento = ColunaChave;

export type DefinicaoMomento = {
  chave: Momento;
  titulo: string;
  ajuda: string;
  /** Classe de cor do marcador do card (identidade do CRM atual). */
  tom: "entrada" | "tentativa" | "atendimento" | "acompanhamento";
};

export const MOMENTOS: readonly DefinicaoMomento[] = Object.freeze([
  { chave: "novo", titulo: "Novo", ajuda: "No horário oficial, chame em até 5 minutos. Fora dele, o lead fica disponível sem aceite nem punição noturna.", tom: "entrada" },
  { chave: "tentando_contato", titulo: "Tentando contato", ajuda: "Você já chamou; o cliente ainda não respondeu.", tom: "tentativa" },
  { chave: "em_atendimento", titulo: "Em atendimento", ajuda: "Cliente respondeu. Entenda a necessidade e combine o próximo passo.", tom: "atendimento" },
  { chave: "em_acompanhamento", titulo: "Pós-visita", ajuda: "A visita aconteceu. Registre o feedback e defina proposta, nova opção ou retorno.", tom: "acompanhamento" },
]);

/** As quatro chaves, na ordem. Nem uma coluna a mais. */
export const ORDEM_MOMENTOS: readonly Momento[] = Object.freeze(MOMENTOS.map((m) => m.chave));

/** Garante que a apresentação não inventou nem perdeu etapa do domínio. */
export function momentosBatemComODominio(): boolean {
  const dominio = COLUNAS.map((c) => c.chave).join("|");
  return dominio === ORDEM_MOMENTOS.join("|");
}

export function definicaoMomento(chave: string | null | undefined): DefinicaoMomento {
  return MOMENTOS.find((m) => m.chave === chave) ?? MOMENTOS[0];
}

export function tituloMomento(chave: string | null | undefined): string {
  return definicaoMomento(chave).titulo;
}

/**
 * "Visita" e "proposta" jamais viram coluna. Serve de trava explícita para o
 * teste e para quem for mexer aqui depois.
 */
export function ehMomentoValido(chave: string): boolean {
  return (ORDEM_MOMENTOS as readonly string[]).includes(chave);
}
