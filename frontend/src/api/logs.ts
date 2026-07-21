import { api } from "./client";

export interface ExecutionLog {
  id: string;
  account_id: string | null;
  chain_id: string | null;
  step_id: string | null;
  timestamp: string;
  level: "debug" | "info" | "warning" | "error";
  event_type: string;
  message: string;
  details: Record<string, unknown> | null;
}

export interface ExecutionLogPage {
  items: ExecutionLog[];
  total: number;
  page: number;
  page_size: number;
}

export interface LogFilters {
  account_id?: string;
  level?: string;
  include_debug?: boolean;
  page?: number;
}

export const logsApi = {
  list: (filters: LogFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.account_id) params.set("account_id", filters.account_id);
    if (filters.level) params.set("level", filters.level);
    if (filters.include_debug) params.set("include_debug", "true");
    params.set("page", String(filters.page ?? 1));
    return api.get<ExecutionLogPage>(`/logs?${params.toString()}`);
  },
};
