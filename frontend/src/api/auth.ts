import { api } from "./client";

export interface UserOut {
  id: string;
  email: string;
  role: "admin" | "user";
}

export const authApi = {
  setupRequired: () => api.get<{ setup_required: boolean }>("/auth/setup-required"),
  setup: (email: string, password: string) => api.post<UserOut>("/auth/setup", { email, password }),
  login: (email: string, password: string) => api.post<UserOut>("/auth/login", { email, password }),
  logout: () => api.post<{ ok: boolean }>("/auth/logout"),
  me: () => api.get<UserOut>("/auth/me"),
  changePassword: (current_password: string, new_password: string) =>
    api.post<{ ok: boolean }>("/auth/change-password", { current_password, new_password }),
};
