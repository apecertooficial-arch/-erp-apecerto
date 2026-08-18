export const dynamic = "force-dynamic";

/* Identificador público e não sensível do código que o Render está executando.
 * O registro do service worker precisa de um valor estável durante todo o
 * deploy e diferente no próximo deploy. RENDER_GIT_COMMIT fornece exatamente
 * essa semântica; as alternativas cobrem outros ambientes e desenvolvimento. */
export async function GET() {
  const build = process.env.RENDER_GIT_COMMIT
    || process.env.NEXT_PUBLIC_BUILD_ID
    || process.env.NEXT_PUBLIC_COMMIT_SHA
    || "local";
  return Response.json(
    { build: String(build).slice(0, 80) },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
