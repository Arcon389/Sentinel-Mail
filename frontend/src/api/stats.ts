import { api } from "./client";

export type StatsWindow = "1h" | "24h" | "7d" | "1m";

export interface StatsPoint {
  bucket: string;
  triggers: number;
  chains: number;
}

export interface StatsTimeseries {
  window: StatsWindow;
  bucket_seconds: number;
  points: StatsPoint[];
}

export const statsApi = {
  timeseries: (window: StatsWindow) =>
    api.get<StatsTimeseries>(`/stats/timeseries?window=${window}`),
};
