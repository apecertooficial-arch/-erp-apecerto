"use client";

import { AutomationFlowBuilderV4 } from "../features/automations/AutomationFlowBuilderV4";

export default function AutomacoesDesignPreviewPage() {
  return <AutomationFlowBuilderV4 accessToken="preview-local" initialAutomationId={66} entryAction={null} preview onBack={() => { window.location.href = "/automacoes"; }} />;
}
