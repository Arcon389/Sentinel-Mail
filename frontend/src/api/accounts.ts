import { api } from "./client";

export interface AccountState {
  last_unread_count: number | null;
  last_checked_at: string | null;
  last_error: string | null;
}

export interface Account {
  id: string;
  name: string;
  imap_host: string;
  imap_port: number;
  use_ssl: boolean;
  username: string;
  folder: string;
  poll_interval_seconds: number | null;
  use_idle: boolean | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  state?: AccountState | null;
  active_chain_count: number;
  last_triggered_at?: string | null;
}

export interface AccountInput {
  name: string;
  imap_host: string;
  imap_port: number;
  use_ssl: boolean;
  username: string;
  password?: string;
  folder: string;
  poll_interval_seconds: number | null;
  use_idle: boolean | null;
  is_active: boolean;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
}

export interface AccountDefaults {
  default_poll_interval_seconds: number;
  default_use_idle: boolean;
}

export const accountsApi = {
  list: () => api.get<Account[]>("/accounts"),
  get: (id: string) => api.get<Account>(`/accounts/${id}`),
  create: (input: AccountInput) => api.post<Account>("/accounts", input),
  update: (id: string, input: Partial<AccountInput>) => api.patch<Account>(`/accounts/${id}`, input),
  remove: (id: string) => api.delete<void>(`/accounts/${id}`),
  testNew: (input: AccountInput) => api.post<TestConnectionResult>("/accounts/test-connection", input),
  testExisting: (id: string) => api.post<TestConnectionResult>(`/accounts/${id}/test-connection`),
  defaults: () => api.get<AccountDefaults>("/accounts/defaults"),
};
