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
  make_and_model?: string | null;
  device_class?: string | null;
}

export type PrinterProtocol = "ipp" | "socket" | "lpd";

const DEFAULT_PORTS: Record<PrinterProtocol, number> = {
  ipp: 631,
  socket: 9100,
  lpd: 515,
};

/** Builds a CUPS device URI from a bare host/IP + protocol, so users don't
 * have to type a full URI by hand. Port falls back to the protocol default. */
export function buildDeviceUri(protocol: PrinterProtocol, host: string, port?: number): string {
  const trimmedHost = host.trim();
  if (!trimmedHost) return "";
  const p = port && port > 0 ? port : DEFAULT_PORTS[protocol];
  switch (protocol) {
    case "socket":
      return `socket://${trimmedHost}:${p}`;
    case "lpd":
      return `lpd://${trimmedHost}:${p}/PASSTHRU`;
    case "ipp":
    default:
      return `ipp://${trimmedHost}:${p}/ipp/print`;
  }
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
  update: (
    id: string,
    input: Partial<Pick<PrinterCreateInput, "name" | "is_active" | "default_options" | "connection_uri">>,
  ) => api.patch<Printer>(`/printers/${id}`, input),
  remove: (id: string) => api.delete<void>(`/printers/${id}`),
  testPrint: (id: string) => api.post<TestPrintResult>(`/printers/${id}/test-print`),
};
