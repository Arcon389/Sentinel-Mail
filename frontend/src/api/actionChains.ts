import { api } from "./client";

export type StepType = "rest_call" | "webhook" | "send_email" | "print" | "pause";
export type OnError = "abort_chain" | "continue";
export type BodyType = "json_raw" | "json_keyvalue" | "form_urlencoded";
export type TriggerType = "unread_new" | "inbox_zero";
export type ConditionMatch = "all" | "any";
export type SenderFilterMode = "contains" | "regex";

export interface KeyValue {
  key: string;
  value: string;
}

export interface HttpStepConfig {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  headers: KeyValue[];
  body_type: BodyType;
  body_template?: string | null;
  body_fields?: KeyValue[] | null;
}

export interface SendEmailStepConfig {
  from: string;
  to: string;
  subject_template: string;
  body_template: string;
}

export interface PrintStepConfig {
  printer_id: string;
  content: "body" | "attachments" | "both";
  attachment_filter: string[];
  options_override: Record<string, unknown>;
}

export interface PauseStepConfig {
  seconds: number;
}

export interface ChainStep {
  id: string;
  chain_id: string;
  position: number;
  step_type: StepType;
  config: HttpStepConfig | SendEmailStepConfig | PrintStepConfig | PauseStepConfig | Record<string, unknown>;
  on_error: OnError;
}

export interface ActionChain {
  id: string;
  account_id: string;
  name: string;
  trigger_type: TriggerType;
  is_active: boolean;
  loop_enabled: boolean;
  loop_pause_seconds: number;
  loop_max_iterations: number;
  loop_infinite: boolean;
  time_window_enabled: boolean;
  time_start: string | null;
  time_end: string | null;
  condition_match: ConditionMatch;
  sender_filter_mode: SenderFilterMode;
  sender_filter: string | null;
  subject_regex: string | null;
  body_regex: string | null;
  created_at: string;
  updated_at: string;
  steps: ChainStep[];
}

export interface ActionChainInput {
  account_id: string;
  name: string;
  trigger_type: TriggerType;
  is_active: boolean;
  loop_enabled: boolean;
  loop_pause_seconds: number;
  loop_max_iterations: number;
  loop_infinite: boolean;
  time_window_enabled: boolean;
  time_start: string | null;
  time_end: string | null;
  condition_match: ConditionMatch;
  sender_filter_mode: SenderFilterMode;
  sender_filter: string | null;
  subject_regex: string | null;
  body_regex: string | null;
}

export interface TestSendResult {
  success: boolean;
  status_code: number | null;
  response_headers: Record<string, string> | null;
  body_preview: string | null;
  error: string | null;
}

export interface Placeholder {
  key: string;
  description: string;
}

export const actionChainsApi = {
  list: (accountId?: string) => api.get<ActionChain[]>(`/action-chains${accountId ? `?account_id=${accountId}` : ""}`),
  get: (id: string) => api.get<ActionChain>(`/action-chains/${id}`),
  create: (input: ActionChainInput) => api.post<ActionChain>("/action-chains", input),
  update: (id: string, input: Partial<ActionChainInput>) => api.patch<ActionChain>(`/action-chains/${id}`, input),
  remove: (id: string) => api.delete<void>(`/action-chains/${id}`),

  addStep: (chainId: string, step: { step_type: StepType; config: unknown; on_error: OnError }) =>
    api.post<ChainStep>(`/action-chains/${chainId}/steps`, step),
  updateStep: (chainId: string, stepId: string, step: { config?: unknown; on_error?: OnError }) =>
    api.patch<ChainStep>(`/action-chains/${chainId}/steps/${stepId}`, step),
  removeStep: (chainId: string, stepId: string) => api.delete<void>(`/action-chains/${chainId}/steps/${stepId}`),
  reorderSteps: (chainId: string, stepIds: string[]) =>
    api.put<ChainStep[]>(`/action-chains/${chainId}/steps/reorder`, { step_ids: stepIds }),

  testSend: (payload: { step_type: StepType; config: unknown; account_id?: string }) =>
    api.post<TestSendResult>("/action-chains/steps/test-send", payload),

  placeholders: () => api.get<Placeholder[]>("/placeholders"),
};
