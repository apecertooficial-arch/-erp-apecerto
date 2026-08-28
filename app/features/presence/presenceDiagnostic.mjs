/**
 * Reduz o IP a uma indicação operacional. O endereço completo nunca deve
 * voltar ao navegador nem aparecer em logs de interface.
 * @param {unknown} value
 */
export function mascararIp(value) {
  const ip = typeof value === "string" ? value.trim() : "";
  if (!ip) return "indisponível";

  const ipv4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4 && ipv4.slice(1).every((octeto) => Number(octeto) <= 255)) {
    return `${ipv4[1]}.${ipv4[2]}.x.x`;
  }

  if (ip.includes(":")) {
    const grupos = ip.split(":").filter(Boolean);
    if (grupos.length > 0 && grupos.every((grupo) => /^[0-9a-f]{1,4}$/i.test(grupo))) {
      return `${grupos.slice(0, 2).join(":")}:…`;
    }
  }

  return "indisponível";
}

/**
 * Cria o contrato somente leitura consumido pela barra de presença.
 * @param {{ ip?: unknown, corresponde?: unknown, observadoEm?: unknown }} input
 */
export function criarDiagnosticoPresenca(input = {}) {
  const ipMascarado = mascararIp(input.ip);
  const corresponde = input.corresponde === true;
  const observadoEm = typeof input.observadoEm === "string" && !Number.isNaN(Date.parse(input.observadoEm))
    ? new Date(input.observadoEm).toISOString()
    : new Date().toISOString();

  let orientacao;
  if (ipMascarado === "indisponível") {
    orientacao = "Não foi possível identificar a rede. Tente novamente antes de confirmar a presença.";
  } else if (corresponde) {
    orientacao = "Rede do escritório reconhecida. Confirme sua presença para participar da distribuição.";
  } else {
    orientacao = "Esta rede está fora da lista reconhecida. A presença continuará sem confirmação.";
  }

  return {
    corresponde,
    ip_mascarado: ipMascarado,
    observado_em: observadoEm,
    orientacao,
  };
}
