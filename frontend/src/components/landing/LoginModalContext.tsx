"use client";

import { createContext, useContext, useMemo, useState } from "react";

interface LoginModalContextValue {
  isOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
}

const LoginModalContext = createContext<LoginModalContextValue | null>(null);

export function LoginModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const value = useMemo(
    () => ({ isOpen, openLoginModal: () => setIsOpen(true), closeLoginModal: () => setIsOpen(false) }),
    [isOpen]
  );
  return <LoginModalContext.Provider value={value}>{children}</LoginModalContext.Provider>;
}

/** Landing-page-only: opens the existing login flow as an overlay instead of
 * navigating to /login. Falls back to a no-op outside the provider (e.g. if
 * a component using it is ever rendered elsewhere) rather than throwing. */
export function useLoginModal(): LoginModalContextValue {
  const ctx = useContext(LoginModalContext);
  return ctx ?? { isOpen: false, openLoginModal: () => {}, closeLoginModal: () => {} };
}
