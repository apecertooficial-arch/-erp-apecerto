"use client";

import type { StudioData } from "../features/studio/domain";
import { StudioModule } from "../features/studio/StudioModule";

export function StudioVisualClient({ fixture }: { fixture: StudioData }) {
  return <StudioModule
    accessToken="visual-test"
    initialData={fixture}
    mutationHandler={async () => ({ ok: true })}
  />;
}
