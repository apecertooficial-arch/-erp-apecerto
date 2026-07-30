"use client";

import { useCallback, useState } from "react";
import { prepararAberturaWhatsApp } from "../lib/whatsappNativo";

type Props = {
  telefone: string | null | undefined;
  negocioId: string | number;
  /** Rotulo principal. Muda conforme o momento do atendimento. */
  rotulo?: string;
  /** Texto que a Sara sugeriu. Serve para copiar, nunca para enviar. */
  sugestao?: string | null;
  /** Avisa a tela que o corretor abriu o WhatsApp (intencao, nao envio). */
  onAbriu?: (negocioId: string | number) => void;
  compacto?: boolean;
};

/**
 * Abre o WhatsApp OFICIAL do celular do corretor.
 *
 * O ERP nao envia nada. Nao existe chamada a endpoint de envio aqui. Tocar no
 * botao registra apenas INTENCAO: a atuacao so e confirmada quando o outbound
 * correspondente volta pelo webhook do D-API e passa pelo contrato canonico.
 */
export function BotaoWhatsApp({ telefone, negocioId, rotulo = "Chamar no WhatsApp", sugestao, onAbriu, compacto }: Props) {
  const [copiado, setCopiado] = useState<"" | "numero" | "sugestao">("");
  const preparo = prepararAberturaWhatsApp(telefone);

  const copiar = useCallback(async (texto: string, qual: "numero" | "sugestao") => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(qual);
      setTimeout(() => setCopiado(""), 1800);
    } catch { /* sem area de transferencia: o numero continua visivel na tela */ }
  }, []);

  const abrir = useCallback(() => {
    if (!preparo.ok) return;
    onAbriu?.(negocioId);
    // Tenta o aplicativo instalado. Se o esquema nao for tratado, o navegador
    // segue na mesma pagina e o fallback oficial assume.
    const inicio = Date.now();
    window.location.href = preparo.app;
    setTimeout(() => {
      if (document.visibilityState === "visible" && Date.now() - inicio < 2500) {
        window.open(preparo.web, "_blank", "noopener,noreferrer");
      }
    }, 1200);
  }, [preparo, negocioId, onAbriu]);

  if (!preparo.ok) {
    return (
      <div className="ncrm-wa-erro" role="alert">
        <strong>Nao da para chamar este cliente</strong>
        <span>{preparo.explicacao}</span>
        <span className="ncrm-wa-erro-dica">Corrija o telefone no cadastro do lead para liberar o atendimento.</span>
      </div>
    );
  }

  return (
    <div className={compacto ? "ncrm-wa ncrm-wa-compacto" : "ncrm-wa"}>
      <button type="button" className="ncrm-wa-principal" onClick={abrir}>
        <span aria-hidden="true">💬</span> {rotulo}
      </button>

      {!compacto && (
        <div className="ncrm-wa-secundarias">
          <button type="button" className="ncrm-wa-link" onClick={() => void copiar(preparo.exibicao, "numero")}>
            {copiado === "numero" ? "Numero copiado" : `Copiar ${preparo.exibicao}`}
          </button>
          {sugestao ? (
            <button type="button" className="ncrm-wa-link" onClick={() => void copiar(sugestao, "sugestao")}>
              {copiado === "sugestao" ? "Sugestao copiada" : "Copiar sugestao da Sara"}
            </button>
          ) : null}
        </div>
      )}

      {!compacto && (
        <p className="ncrm-wa-nota">
          A mensagem sai do WhatsApp do seu celular. O ERP nao envia nada por voce.
        </p>
      )}
    </div>
  );
}
