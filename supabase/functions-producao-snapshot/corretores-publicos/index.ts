// corretores-publicos
// Endpoint de leitura restrita para o projeto apecerto-instagram.
//
// Por que existe: o projeto de captacao precisa saber quem esta online.
// A alternativa seria dar a service_role_key do ERP para ele -- o que
// derruba justamente o isolamento que motivou separar os projetos.
// Aqui ele so consegue ler 5 campos nao sensiveis, com um token proprio
// que pode ser rotacionado sem tocar em mais nada.
//
// NAO devolve telefone, email, CPF, comissao nem documento.
// verify_jwt = false porque a autenticacao e o token abaixo.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const TOKEN = Deno.env.get("SYNC_TOKEN") ?? "";

// Comparacao de tempo constante: evita descobrir o token por timing.
function tokenValido(recebido: string): boolean {
  if (!TOKEN || TOKEN.length < 32) return false;
  if (recebido.length !== TOKEN.length) return false;
  let diff = 0;
  for (let i = 0; i < TOKEN.length; i++) {
    diff |= TOKEN.charCodeAt(i) ^ recebido.charCodeAt(i);
  }
  return diff === 0;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") {
    return json({ erro: "metodo nao permitido" }, 405);
  }

  const auth = req.headers.get("authorization") ?? "";
  const recebido = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!tokenValido(recebido)) {
    return json({ erro: "nao autorizado" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase
    .from("corretores")
    .select("id, nome, ativo, online, ordem");

  if (error) {
    console.error("falha ao ler corretores:", error.message);
    return json({ erro: "falha ao ler corretores" }, 500);
  }

  return json({
    corretores: data ?? [],
    total: data?.length ?? 0,
    em: new Date().toISOString(),
  });
});
