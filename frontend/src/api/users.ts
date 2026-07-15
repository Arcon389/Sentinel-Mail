import { api } from "./client";

export interface User {
  id: string;
  email: string;
  role: "admin" | "user";
}

export interface UserCreateInput {
  email: string;
  password: string;
  role: "admin" | "user";
}

export const usersApi = {
  list: () => api.get<User[]>("/users"),
  create: (input: UserCreateInput) => api.post<User>("/users", input),
  update: (id: string, input: { role?: "admin" | "user"; password?: string }) => api.patch<User>(`/users/${id}`, input),
  remove: (id: string) => api.delete<void>(`/users/${id}`),
};
