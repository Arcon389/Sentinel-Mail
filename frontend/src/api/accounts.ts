import { api } from "./client";

export type SenderListMode = "off" | "whitelist" | "blacklist";

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
  sender_list: string | null;
  sender_list_mode: SenderListMode;
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
  sender_list: string | null;
  sender_list_mode: SenderListMode;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  error_code?: string | null;
}

const TEST_ERROR_CODES = [
  "auth_failed",
  "dns_error",
  "timeout",
  "connection_refused",
  "ssl_error",
  "folder_not_found",
  "imap_error",
  "connection_failed",
];

/** Combines the translated hint for a known `error_code` with the raw server message. */
export function formatTestResult(result: TestConnectionResult, t: (key: string) => string): string {
  if (result.success) {
    return `✓ ${result.message}`;
  }
  if (result.error_code && TEST_ERROR_CODES.includes(result.error_code)) {
    const hint = t(`accounts.testErrors.${result.error_code}`);
    return `✗ ${hint} (${result.message})`;
  }
  return `✗ ${result.message}`;
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
