export const dynamic = "force-dynamic";

// Endpoint público de versão — permite confirmar qual build está no ar no Render.
const BUILD = "2026-07-27-v7-aquario-escala";

export async function GET() {
  return Response.json({ v: BUILD });
}
