export const dynamic = "force-dynamic";

// Endpoint público de versão — permite confirmar qual build está no ar no Render.
const BUILD = "2026-07-24-fechamento-fix-v2";

export async function GET() {
  return Response.json({ v: BUILD });
}
