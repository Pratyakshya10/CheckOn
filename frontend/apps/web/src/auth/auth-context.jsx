import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { trpc } from '../trpc/client';

const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

function stripAuthParams() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('auth') && !url.searchParams.has('auth_error')) return;
  url.searchParams.delete('auth');
  url.searchParams.delete('auth_error');
  const next = url.pathname + (url.search || '') + url.hash;
  window.history.replaceState({}, '', next);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('sign-in');
  const [authError, setAuthError] = useState('');

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
    const errorFromRedirect = params.get('auth_error');
    const signedIn = params.get('auth') === 'ok';

    if (errorFromRedirect) {
      setAuthError(errorFromRedirect);
      setAuthMode('sign-in');
      setIsAuthOpen(true);
    }

    refreshUser().finally(() => {
      setReady(true);
      if (signedIn || errorFromRedirect) stripAuthParams();
    });
  }, [refreshUser]);

  const openAuth = useCallback((mode = 'sign-in') => {
    setAuthMode(mode);
    setIsAuthOpen(true);
  }, []);

  const closeAuth = useCallback(() => {
    setIsAuthOpen(false);
    setAuthError('');
  }, []);

  const login = useCallback(async (email, password, keepSignedIn = true) => {
    const nextUser = await trpc.auth.signIn.mutate({ email, password, keepSignedIn });
    setUser(nextUser);
    setIsAuthOpen(false);
    setAuthError('');
    return nextUser;
  }, []);

  const signup = useCallback(async (fullName, email, password, confirmPassword, keepSignedIn = true) => {
    const nextUser = await trpc.auth.signUp.mutate({
      fullName,
      email,
      password,
      confirmPassword,
      keepSignedIn,
    });
    setUser(nextUser);
    setIsAuthOpen(false);
    setAuthError('');
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await trpc.auth.logout.mutate();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
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
      logout,
    }),
    [user, ready, isAuthOpen, authMode, authError, openAuth, closeAuth, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
