import { api } from "./client";

export interface PrinterCapabilities {
  duplex_supported: boolean;
  color_supported: boolean;
  paper_sizes: string[];
}

export interface PrinterOptions {
  copies: number;
  duplex: boolean;
  color: boolean;
  paper_size: string;
}

export interface Printer {
  id: string;
  name: string;
  cups_queue_name: string;
  connection_uri: string;
  is_active: boolean;
  capabilities: PrinterCapabilities;
  default_options: PrinterOptions;
  created_at: string;
  updated_at: string;
}

export interface DiscoveredPrinter {
  name: string;
  host: string;
  port: number;
  uri: string;
}

export interface PrinterCreateInput {
  name: string;
  connection_uri: string;
  is_active: boolean;
  default_options: PrinterOptions;
}

export interface TestPrintResult {
  success: boolean;
  message: string;
}

export const printersApi = {
  list: () => api.get<Printer[]>("/printers"),
  discover: () => api.get<DiscoveredPrinter[]>("/printers/discover"),
  create: (input: PrinterCreateInput) => api.post<Printer>("/printers", input),
  update: (id: string, input: Partial<Pick<PrinterCreateInput, "name" | "is_active" | "default_options">>) =>
    api.patch<Printer>(`/printers/${id}`, input),
  remove: (id: string) => api.delete<void>(`/printers/${id}`),
  testPrint: (id: string) => api.post<TestPrintResult>(`/printers/${id}/test-print`),
};
