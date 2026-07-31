"use client";

import { LiveChatWorkspace } from "../../features/chat/LiveChatWorkspace";
import { GuardaModulo } from "../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Chat ao Vivo">{(t) => <LiveChatWorkspace accessToken={t} />}</GuardaModulo>;
}
