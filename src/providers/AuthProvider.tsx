import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "secretary" | "director";

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  role: AppRole | null;
  fullName: string;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthState>({
  session: null,
  user: null,
  loading: true,
  role: null,
  fullName: "",
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [fullName, setFullName] = useState("");

  const loadProfile = async (uid: string) => {
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setFullName(profile?.full_name ?? "");
    // Director takes precedence if present
    const r = roles?.map((x) => x.role) ?? [];
    if (r.includes("director")) setRole("director");
    else if (r.includes("secretary")) setRole("secretary");
    else setRole(null);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // Defer to avoid recursive auth callbacks
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setRole(null);
        setFullName("");
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadProfile(s.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthCtx.Provider value={{ session, user, loading, role, fullName, refreshProfile, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
