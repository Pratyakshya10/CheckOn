import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthUser } from "@checkon/trpc/client";
import { trpc } from "../trpc/client";

export type AuthMode = "sign-in" | "sign-up";

type AuthContextValue = {
  user: AuthUser | null;
  ready: boolean;
  isAuthenticated: boolean;
  isAuthOpen: boolean;
  authMode: AuthMode;
  authError: string;
  setAuthMode: (mode: AuthMode) => void;
  setAuthError: (message: string) => void;
  openAuth: (mode?: AuthMode) => void;
  closeAuth: () => void;
  login: (email: string, password: string, keepSignedIn?: boolean, totpCode?: string) => Promise<AuthUser>;
  signup: (
    fullName: string,
    email: string,
    password: string,
    confirmPassword: string,
    keepSignedIn?: boolean,
  ) => Promise<AuthUser>;
  updateUserProfile: (updates: { fullName: string; profileRole?: string }) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

function stripAuthParams() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("auth") && !url.searchParams.has("auth_error")) return;
  url.searchParams.delete("auth");
  url.searchParams.delete("auth_error");
  const next = url.pathname + (url.search || "") + url.hash;
  window.history.replaceState({}, "", next);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [authError, setAuthError] = useState("");

  const refreshUser = useCallback(async () => {
    try {
      const nextUser = await trpc.auth.me.query();
      setUser(nextUser);
      return nextUser;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorFromRedirect = params.get("auth_error");
    const signedIn = params.get("auth") === "ok";

    if (errorFromRedirect) {
      setAuthError(errorFromRedirect);
      setAuthMode("sign-in");
      setIsAuthOpen(true);
    }

    void refreshUser().finally(() => {
      setReady(true);
      if (signedIn || errorFromRedirect) stripAuthParams();
    });
  }, [refreshUser]);

  const openAuth = useCallback((mode: AuthMode = "sign-in") => {
    setAuthMode(mode);
    setIsAuthOpen(true);
  }, []);

  const closeAuth = useCallback(() => {
    setIsAuthOpen(false);
    setAuthError("");
  }, []);

  const login = useCallback(async (email: string, password: string, keepSignedIn = true, totpCode?: string) => {
    const nextUser = await trpc.auth.signIn.mutate({ email, password, keepSignedIn, totpCode });
    setUser(nextUser);
    setIsAuthOpen(false);
    setAuthError("");
    return nextUser;
  }, []);

  const signup = useCallback(
    async (
      fullName: string,
      email: string,
      password: string,
      confirmPassword: string,
      keepSignedIn = true,
    ) => {
      const nextUser = await trpc.auth.signUp.mutate({
        fullName,
        email,
        password,
        confirmPassword,
        keepSignedIn,
      });
      setUser(nextUser);
      setIsAuthOpen(false);
      setAuthError("");
      return nextUser;
    },
    [],
  );

  const updateUserProfile = useCallback(async (updates: { fullName: string; profileRole?: string }) => {
    const nextUser = await trpc.account.updateProfile.mutate(updates);
    setUser(nextUser);
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await trpc.auth.logout.mutate();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      isAuthenticated: Boolean(user),
      isAuthOpen,
      authMode,
      authError,
      setAuthMode,
      setAuthError,
      openAuth,
      closeAuth,
      login,
      signup,
      updateUserProfile,
      logout,
    }),
    [user, ready, isAuthOpen, authMode, authError, openAuth, closeAuth, login, signup, updateUserProfile, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
