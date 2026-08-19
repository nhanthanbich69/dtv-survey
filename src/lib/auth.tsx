import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Profile, Role } from "./types";
import { asOne } from "./cast";

type AuthState = {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  denial: string | null;
};

type AuthContextValue = AuthState & {
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  canManageUsers: boolean;
  canManageTenants: boolean;
  canWriteSurveys: boolean;
  canPublish: boolean;
  canDeleteSurveys: boolean;
  canExport: boolean;
  role: Role | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadProfile(userId: string): Promise<{ profile: Profile | null; denial: string | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*, tenants(id, name, code, status)")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { profile: null, denial: "Không tải được thông tin tài khoản. Vui lòng thử lại." };
  }
  if (!data) {
    return { profile: null, denial: "Tài khoản chưa được cấp quyền truy cập hệ thống." };
  }
  const raw = data as unknown as Profile;
  const profile: Profile = {
    ...raw,
    tenants: asOne<NonNullable<Profile["tenants"]>>(raw.tenants),
  };
  if (profile.status !== "active") {
    return { profile: null, denial: "Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên." };
  }
  if (profile.role !== "admin") {
    const tenant = profile.tenants;
    if (!profile.tenant_id || !tenant) {
      return { profile: null, denial: "Tài khoản chưa được gán khách hàng. Vui lòng liên hệ quản trị viên." };
    }
    if (tenant.status !== "active") {
      return { profile: null, denial: "Khách hàng của bạn đang ngưng hoạt động. Vui lòng liên hệ quản trị viên." };
    }
  }
  return { profile, denial: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    loading: true,
    session: null,
    profile: null,
    denial: null,
  });

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) {
      setState({ loading: false, session: null, profile: null, denial: null });
      return;
    }
    const next = await loadProfile(session.user.id);
    if (next.denial) {
      await supabase.auth.signOut();
      setState({ loading: false, session: null, profile: null, denial: next.denial });
      return;
    }
    setState({ loading: false, session, profile: next.profile, denial: null });
  }, []);

  useEffect(() => {
    void refresh();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({ loading: false, session: null, profile: null, denial: null });
  }, []);

  const role = state.profile?.role ?? null;
  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      refresh,
      signOut,
      role,
      isAdmin: role === "admin",
      canManageUsers: role === "admin",
      canManageTenants: role === "admin",
      canWriteSurveys: role === "admin" || role === "manager" || role === "staff",
      canPublish: role === "admin" || role === "manager",
      canDeleteSurveys: role === "admin",
      canExport: role === "admin" || role === "manager",
    }),
    [state, refresh, signOut, role],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải nằm trong AuthProvider");
  return ctx;
}
