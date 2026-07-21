import { api } from "./client";

export interface AppSettings {
  maintenance_mode: boolean;
}

export const settingsApi = {
  get: () => api.get<AppSettings>("/settings"),
  update: (input: AppSettings) => api.patch<AppSettings>("/settings", input),
};
