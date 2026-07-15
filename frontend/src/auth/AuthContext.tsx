import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authApi, type UserOut } from "../api/auth";

interface AuthContextValue {
  user: UserOut | null;
  loading: boolean;
  setupRequired: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const { setup_required } = await authApi.setupRequired();
      setSetupRequired(setup_required);
      if (!setup_required) {
        try {
          setUser(await authApi.me());
        } catch {
          setUser(null);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, setupRequired, refresh }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
