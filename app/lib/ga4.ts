import { createSign } from "node:crypto";

/* GA4 — leitura server-to-server da Data API, sem dependência nova.
 *
 * A conta de serviço tem papel Leitor na propriedade. Assinamos um JWT com a
 * chave privada, trocamos por access token no oauth2 e chamamos runReport. Feito
 * à mão de propósito: adicionar @google-analytics/data só para três relatórios
 * traria um SDK grande para dentro do build.
 *
 * Este módulo é SOMENTE de servidor. O JSON da conta de serviço vive em
 * GA4_SERVICE_ACCOUNT_JSON e o id da propriedade em GA4_PROPERTY_ID; nada disso
 * pode aparecer em código de tela. Se qualquer uma faltar, ga4Configurado() é
 * false e a área mostra "aguardando conexão" — nunca zero.
 */

const ESCOPO = "https://www.googleapis.com/auth/analytics.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

type Conta = { client_email?: string; private_key?: string };

let cacheToken: { token: string; expiraEm: number } | null = null;

function lerConta(): Conta | null {
  const bruto = process.env.GA4_SERVICE_ACCOUNT_JSON;
  if (!bruto) return null;
  try {
    const conta = JSON.parse(bruto) as Conta;
    if (!conta.client_email || !conta.private_key) return null;
    /* O Render costuma entregar a chave com \n literais; o PEM precisa das quebras. */
    conta.private_key = conta.private_key.replace(/\\n/g, "\n");
    return conta;
  } catch (erro) {
    console.error("[ga4] GA4_SERVICE_ACCOUNT_JSON não é JSON válido:", erro instanceof Error ? erro.message : erro);
    return null;
  }
}

export function ga4Configurado() {
  return !!lerConta() && !!process.env.GA4_PROPERTY_ID;
}

const b64url = (valor: string | Buffer) =>
  Buffer.from(valor).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function accessToken(): Promise<string | null> {
  const agora = Math.floor(Date.now() / 1000);
  if (cacheToken && cacheToken.expiraEm > agora + 60) return cacheToken.token;

  const conta = lerConta();
  if (!conta) return null;

  const cabecalho = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const corpo = b64url(JSON.stringify({
    iss: conta.client_email,
    scope: ESCOPO,
    aud: TOKEN_URL,
    iat: agora,
    exp: agora + 3600,
  }));
  const assinatura = createSign("RSA-SHA256").update(`${cabecalho}.${corpo}`).sign(conta.private_key as string);
  const assertion = `${cabecalho}.${corpo}.${b64url(assinatura)}`;

  const resposta = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!resposta.ok) {
    console.error("[ga4] troca de token falhou:", resposta.status);
    return null;
  }
  const json = (await resposta.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;
  cacheToken = { token: json.access_token, expiraEm: agora + (json.expires_in ?? 3600) };
  return json.access_token;
}

type Relatorio = {
  metricas: string[];
  dimensoes?: string[];
  limite?: number;
  ordenarPor?: string;
};

type LinhaGa4 = { dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> };

export type LinhaRelatorio = { chaves: string[]; valores: number[] };

async function runReport(inicio: string, fim: string, r: Relatorio): Promise<LinhaRelatorio[] | null> {
  const token = await accessToken();
  const propriedade = process.env.GA4_PROPERTY_ID;
  if (!token || !propriedade) return null;

  const corpo: Record<string, unknown> = {
    dateRanges: [{ startDate: inicio, endDate: fim }],
    metrics: r.metricas.map((name) => ({ name })),
    limit: r.limite ?? 10,
  };
  if (r.dimensoes?.length) corpo.dimensions = r.dimensoes.map((name) => ({ name }));
  if (r.ordenarPor) corpo.orderBys = [{ desc: true, metric: { metricName: r.ordenarPor } }];

  const resposta = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propriedade}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  if (!resposta.ok) {
    console.error("[ga4] runReport falhou:", resposta.status, r.metricas.join(","));
    return null;
  }
  const json = (await resposta.json()) as { rows?: LinhaGa4[] };
  return (json.rows ?? []).map((linha) => ({
    chaves: (linha.dimensionValues ?? []).map((d) => d.value ?? "não informado"),
    valores: (linha.metricValues ?? []).map((m) => Number(m.value ?? 0) || 0),
  }));
}

export type Ga4Leitura = {
  totais: { sessoes: number; visualizacoes: number; sessoesEngajadas: number; taxaEngajamento: number | null } | null;
  paginas: Array<{ pagina: string; visualizacoes: number; entradas: number }>;
  origens: Array<{ origem: string; sessoes: number; engajadas: number }>;
  dispositivos: Array<{ dispositivo: string; sessoes: number }>;
};

/* Uma leitura por tela, todas na mesma janela. Falha de um relatório não derruba
   os outros: cada pedaço volta vazio e a tela declara o que faltou. */
export async function lerGa4(inicio: string, fim: string): Promise<Ga4Leitura | null> {
  if (!ga4Configurado()) return null;

  const [totais, paginas, origens, dispositivos] = await Promise.all([
    runReport(inicio, fim, { metricas: ["sessions", "screenPageViews", "engagedSessions"], limite: 1 }),
    runReport(inicio, fim, { metricas: ["screenPageViews", "entrances"], dimensoes: ["pagePath"], limite: 12, ordenarPor: "screenPageViews" }),
    runReport(inicio, fim, { metricas: ["sessions", "engagedSessions"], dimensoes: ["sessionDefaultChannelGroup"], limite: 12, ordenarPor: "sessions" }),
    runReport(inicio, fim, { metricas: ["sessions"], dimensoes: ["deviceCategory"], limite: 5, ordenarPor: "sessions" }),
  ]);

  if (!totais && !paginas && !origens && !dispositivos) return null;

  const linhaTotal = totais?.[0]?.valores ?? null;
  return {
    totais: linhaTotal
      ? {
          sessoes: linhaTotal[0] ?? 0,
          visualizacoes: linhaTotal[1] ?? 0,
          sessoesEngajadas: linhaTotal[2] ?? 0,
          taxaEngajamento: (linhaTotal[0] ?? 0) > 0 ? (100 * (linhaTotal[2] ?? 0)) / (linhaTotal[0] ?? 1) : null,
        }
      : null,
    paginas: (paginas ?? []).map((l) => ({ pagina: l.chaves[0] ?? "não informado", visualizacoes: l.valores[0] ?? 0, entradas: l.valores[1] ?? 0 })),
    origens: (origens ?? []).map((l) => ({ origem: l.chaves[0] ?? "não informado", sessoes: l.valores[0] ?? 0, engajadas: l.valores[1] ?? 0 })),
    dispositivos: (dispositivos ?? []).map((l) => ({ dispositivo: l.chaves[0] ?? "não informado", sessoes: l.valores[0] ?? 0 })),
  };
}
