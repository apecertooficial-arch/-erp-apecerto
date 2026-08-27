import type { TemperaturaLead } from "../funil-2/modelo";

export type CrmV3Profile = "corretor" | "gestor" | "admin";
export type CrmV3Scenario = "normal" | "loading" | "empty" | "error" | "offline";
export type CrmV3Area = "day" | "deals" | "leads" | "activities" | "visits" | "sales" | "management" | "settings" | "matrix";
export type DealStatus = "open" | "won" | "lost";
export type ActivityStatus = "pending" | "done";
export type VisitStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";
export type MutationSource = "menu" | "drag" | "bulk" | "drawer" | "system";

export type StageV3 = {
  id: string;
  label: string;
  color: string;
  requiresActivity?: boolean;
};

export type PipelineV3 = {
  id: string;
  label: string;
  description: string;
  stages: StageV3[];
};

export type LeadV3 = {
  id: string;
  name: string;
  phone: string;
  email: string;
  document: string;
  source: string;
  owner: string;
  address: string;
  interest: string;
  tags: string[];
  createdAt: string;
};

export type DealV3 = {
  id: string;
  leadId: string;
  title: string;
  property: string;
  value: number;
  pipelineId: string;
  stageId: string;
  status: DealStatus;
  temperature: TemperaturaLead | null;
  momentCode: string;
  momentLabel: string;
  nextAction: string | null;
  dueLabel: string;
  dueTone: "danger" | "warning" | "neutral";
  owner: string;
  tags: string[];
  lastValidPosition?: { pipelineId: string; stageId: string };
  lossReason?: string;
};

export type ActivityV3 = {
  id: string;
  leadId: string;
  dealId: string | null;
  kind: "WhatsApp" | "Ligação" | "Tarefa" | "Visita";
  title: string;
  dueAt: string;
  durationMinutes: number;
  owner: string;
  status: ActivityStatus;
};

export type VisitFeedbackV3 = {
  interest: "high" | "medium" | "low";
  liked: string;
  objections: string;
  nextStep: string;
};

export type VisitV3 = {
  id: string;
  leadId: string;
  dealId: string;
  property: string;
  owner: string;
  manager: string | null;
  startsAt: string;
  durationMinutes: number;
  meetingPoint: string;
  notes: string;
  status: VisitStatus;
  feedback: VisitFeedbackV3 | null;
};

export type HistoryV3 = {
  id: string;
  leadId: string;
  title: string;
  detail: string;
  actor: "human" | "sara" | "dapi" | "system";
  createdAt: string;
};

export type CrmV3State = {
  pipelines: PipelineV3[];
  leads: LeadV3[];
  deals: DealV3[];
  activities: ActivityV3[];
  visits: VisitV3[];
  history: HistoryV3[];
};

export type MoveResult =
  | { ok: true; state: CrmV3State; message: string }
  | { ok: false; state: CrmV3State; message: string; code: "offline" | "activity_required" | "not_found" | "invalid_target" };

