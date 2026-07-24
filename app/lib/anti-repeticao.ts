import type { createServerSupabaseClient } from "./supabase/server";

/* TRAVA ANTI-REPETIÇÃO: bloqueia enviar ao mesmo cliente um texto praticamente igual
   a outro já enviado nas últimas 48h (vale para humano, sugestão da Sara, qualquer origem).
   Mensagens curtas ("ok", "bom dia") passam livres — só compara textos com 60+ caracteres. */
function normalizar(texto: string) {
  return texto.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
}

export async function textoRepetidoRecente(supabase: ReturnType<typeof createServerSupabaseClient>, telefone: string, texto: string) {
  const novo = normalizar(texto);
  if (novo.length < 60) return null;
  const last8 = telefone.replace(/\D/g, "").slice(-8);
  if (last8.length < 8) return null;
  const { data: contatos } = await supabase.from("wa_contatos").select("id").like("telefone", `%${last8}`).limit(10);
  if (!contatos?.length) return null;
  const { data: conversas } = await supabase.from("wa_conversas").select("id").in("contato_id", contatos.map((c) => c.id)).limit(20);
  if (!conversas?.length) return null;
  const desde = new Date(Date.now() - 48 * 3600_000).toISOString();
  const { data: enviadas } = await supabase.from("wa_mensagens")
    .select("conteudo,criado_em").in("conversa_id", conversas.map((c) => c.id))
    .eq("direcao", "enviada").gte("criado_em", desde)
    .order("criado_em", { ascending: false }).limit(30);
  for (const m of enviadas ?? []) {
    const antigo = normalizar(m.conteudo ?? "");
    if (antigo.length < 60) continue;
    if (antigo === novo || antigo.includes(novo.slice(0, 80)) || novo.includes(antigo.slice(0, 80))) {
      const quando = new Date(m.criado_em as string).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
      return `Esse cliente já recebeu uma mensagem praticamente igual em ${quando}. Reescreva com outra abordagem para não soar repetitivo.`;
    }
  }
  return null;
}
