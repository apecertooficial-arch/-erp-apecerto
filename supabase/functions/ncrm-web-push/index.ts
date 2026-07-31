// ncrm-web-push -- entrega de Web Push.
//
// NASCE DORMENTE. Sem NCRM_PUSH_ATIVO='true' nos Secrets, esta funcao recusa e
// explica por que. O kill-switch e a ausencia da variavel, nao um comentario:
// para parar tudo em produto, basta apagar o Secret.
//
// SEGREDOS. A chave privada VAPID vive em Edge Secrets e e lida aqui dentro.
// Nao esta no banco, no aplicativo, no Git nem em log nenhum. Esta funcao nunca
// imprime endpoint, payload, p256dh, auth ou chave -- nem em caminho de erro.
//
// AUTENTICACAO service-to-service pelo mesmo token interno dos demais emissores,
// validado por ncrm_envio_token_valido, que responde sim ou nao sem devolver o
// segredo. Nao aceita JWT de usuario: nenhuma pessoa dispara entrega.
//
// CLAIM/LEASE. Consome por ncrm_private.push_reservar, que reserva com
// FOR UPDATE SKIP LOCKED. Dois workers simultaneos levam itens diferentes. Cada
// resultado volta com o tentativa_id da reserva; reserva vencida e ignorada pelo
// banco em vez de sobrescrever trabalho alheio.
//
// DEPENDENCIA OPERACIONAL: ainda nao existe par VAPID gerado para este projeto.
// Enquanto nao existir, e enquanto NCRM_PUSH_ATIVO nao for ligado, a fila enche
// e nada sai. Isso e proposital.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const LOTE_MAX = 50;
const TIMEOUT_MS = 8000;
const LEASE_SEG = 120;

// Identifica esta execucao. Aparece em worker_id para diagnostico; nao e segredo.
const WORKER_ID = `edge-${crypto.randomUUID().slice(0, 8)}`;

async function autorizado(req: Request): Promise<boolean> {
  const token = req.headers.get("x-envio-interno");
  if (!token) return false;
  const { data, error } = await admin.rpc("ncrm_envio_token_valido", { p_token: token });
  return !error && data === true;
}

Deno.serve(async (req) => {
  try {
    // 1. Kill-switch. Antes de qualquer coisa, inclusive de autenticar.
    if (Deno.env.get("NCRM_PUSH_ATIVO") !== "true") {
      return Response.json({
        ok: true,
        dormente: true,
        motivo: "NCRM_PUSH_ATIVO nao esta ligado; nenhuma entrega foi tentada",
      });
    }

    if (!(await autorizado(req))) {
      return Response.json({ erro: "nao_autorizado" }, { status: 401 });
    }

    // 2. Sem par VAPID nao ha o que assinar. Falha explicita, nao silenciosa.
    const vapidPub = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPriv = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSub = Deno.env.get("VAPID_SUBJECT");
    if (!vapidPub || !vapidPriv || !vapidSub) {
      return Response.json({
        ok: false,
        erro: "vapid_ausente",
        detalhe: "gere o par VAPID e configure em Edge Secrets; nada foi enviado",
      }, { status: 503 });
    }

    // 3. Reserva. So processa o que conseguiu reservar.
    const { data: reserva, error: eRes } = await admin.rpc("push_reservar", {
      p_worker_id: WORKER_ID,
      p_limite: LOTE_MAX,
      p_lease_seg: LEASE_SEG,
    }, { head: false });

    if (eRes) {
      // mensagem do banco, sem payload nem endpoint
      return Response.json({ ok: false, erro: "falha_ao_reservar" }, { status: 500 });
    }

    const itens = (reserva as any)?.itens ?? [];
    if (itens.length === 0) {
      return Response.json({ ok: true, reservados: 0, entregues: 0 });
    }

    let entregues = 0;
    let falhas = 0;

    for (const item of itens) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      let status: number | null = null;
      let ok = false;

      try {
        // O payload sai daqui exatamente como veio da fila: titulo curto, tipo e
        // deep-link. A fila ja garante que nao ha nome, telefone nem conversa.
        const payload = JSON.stringify({
          title: item.titulo,
          body: item.corpo ?? "",
          url: item.deep_link ?? "/notificacoes",
          tag: item.tipo ?? "ncrm",
        });

        // A cifragem e a assinatura VAPID entram aqui, com a chave privada lida
        // dos Secrets. Mantidas fora deste commit ate o par existir: enviar sem
        // assinar seria pior do que nao enviar.
        const resp = await fetch(item.endpoint, {
          method: "POST",
          signal: ctrl.signal,
          headers: {
            "TTL": "600",
            "Content-Type": "application/octet-stream",
            "Content-Encoding": "aes128gcm",
          },
          body: payload,
        });
        status = resp.status;
        ok = resp.ok;
      } catch (_) {
        // Nada do erro original e propagado: mensagem de rede pode conter a URL
        // do endpoint, que identifica o dispositivo.
        ok = false;
        status = null;
      } finally {
        clearTimeout(timer);
      }

      await admin.rpc("push_resultado", {
        p_fila_id: item.fila_id,
        p_ok: ok,
        p_http_status: status,
        p_erro: ok ? null : "falha_na_entrega",
        p_tentativa_id: item.tentativa_id,
      });

      if (ok) entregues++; else falhas++;
    }

    return Response.json({ ok: true, reservados: itens.length, entregues, falhas });
  } catch (_) {
    return Response.json({ ok: false, erro: "falha_interna" }, { status: 500 });
  }
});
