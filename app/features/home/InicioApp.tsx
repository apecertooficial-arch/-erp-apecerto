"use client";

import { Funil2Mobile } from "../funil-2/Funil2Mobile";

/**
 * Início do aplicativo = Meu Dia operacional.
 *
 * A versão anterior mostrava só indicadores e mandava o corretor abrir outra
 * tela. Agora a própria entrada do app entrega a fila real do Funil 2.0, em
 * ordem de prazo, com a direção da Sara e o botão para chamar no WhatsApp.
 * O painel completo continua reservado ao computador.
 */
export function InicioApp({ accessToken, nome, onIr }: {
  accessToken: string;
  nome: string;
  onIr: (destino: string) => void;
}) {
  return <Funil2Mobile accessToken={accessToken} nome={nome} modo="inicio" onIr={onIr} />;
}
