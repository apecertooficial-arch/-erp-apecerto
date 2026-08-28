"use client";

import { useCallback, useState } from "react";
import { prepararAberturaWhatsApp } from "../../lib/whatsappNativo";

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

  /* Registra a INTENCAO. Nao confirma contato, nao muda etapa, nao inicia SLA,
     nao chama endpoint de envio. Roda no proprio clique — a navegacao para
     whatsapp:// e feita pelo href do <a>, dentro da ativacao do usuario. */
  const registrarIntencao = useCallback(() => {
    onAbriu?.(negocioId);
  }, [negocioId, onAbriu]);

  if (!preparo.ok) {
    return (
      <div className="ncrm-wa-erro" role="alert">
        <strong>Não dá para chamar este cliente</strong>
        <span>{preparo.explicacao}</span>
        <span className="ncrm-wa-erro-dica">Corrija o telefone no cadastro do lead para liberar o atendimento.</span>
      </div>
    );
  }

  return (
    <div className={compacto ? "ncrm-wa ncrm-wa-compacto" : "ncrm-wa"}>
      {/* Ancora, nao botao: o whatsapp:// e seguido pelo proprio navegador na
          interacao do usuario. A versao anterior usava window.open depois de
          setTimeout(1200ms) — fora da janela de ativacao, o iOS Safari e os
          bloqueadores de popup descartavam o fallback e o corretor ficava sem
          nada acontecendo. */}
      <a
        className="ncrm-wa-principal"
        href={preparo.app}
        onClick={registrarIntencao}
        data-e164={preparo.e164}
      >
        <span aria-hidden="true">💬</span> {rotulo}
      </a>

      {/* A SEGUNDA FORMA DO NUMERO — visivel SEMPRE, inclusive no modo compacto.
          O corretor so descobre que o numero nao existe depois de abrir o
          WhatsApp; se a alternativa estiver escondida atras de um menu, ele
          descarta o lead antes de achar. Em 11/08 quatro leads bons foram
          descartados assim. */}
      {preparo.alt && (
        <a
          className="ncrm-wa-alt"
          href={preparo.alt.app}
          onClick={registrarIntencao}
          data-e164={preparo.alt.e164}
        >
          Não existe? Tentar {preparo.alt.rotulo} · {preparo.alt.exibicao}
        </a>
      )}

      {!compacto && (
        <div className="ncrm-wa-secundarias">
          {/* Fallback oficial, sempre visivel. Serve no desktop (sem app
              instalado) e no celular quando o esquema whatsapp:// nao abre.
              Visivel de proposito: nada de heuristica de tempo. */}
          <a
            className="ncrm-wa-link"
            href={preparo.web}
            target="_blank"
            rel="noopener noreferrer"
            onClick={registrarIntencao}
          >
            Nao abriu? Abrir pelo WhatsApp Web
          </a>
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
          {preparo.alt ? " Se o WhatsApp disser que o número não existe, tente a segunda forma acima antes de descartar o lead." : ""}
        </p>
      )}
    </div>
  );
}
