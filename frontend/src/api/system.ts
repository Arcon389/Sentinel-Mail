import { api } from "./client";

export interface SmtpStatus {
  configured: boolean;
  host: string | null;
}

export interface SmtpTestResult {
  success: boolean;
  message: string;
}

export const systemApi = {
  smtpStatus: () => api.get<SmtpStatus>("/system/smtp-status"),
  smtpTest: () => api.post<SmtpTestResult>("/system/smtp-test"),
};
