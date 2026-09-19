import { create } from "zustand";

const KEY = "laugh4lol-cookies";
const COOKIE = "laugh_cookie_pref";

export type CookieChoice = "all" | "necessary";

export type CookieConsentState = {
  choice: CookieChoice | null;
  ready: boolean;
  hydrate: () => void;
  choose: (choice: CookieChoice) => void;
  reopen: () => void;
};

function readStored(): CookieChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "all" || raw === "necessary") return raw;
  } catch {
    /* private mode */
  }
  const match = document.cookie.match(/(?:^|; )laugh_cookie_pref=([^;]*)/);
  const fromCookie = match?.[1];
  if (fromCookie === "all" || fromCookie === "necessary") return fromCookie;
  return null;
}

function persist(choice: CookieChoice) {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    /* ignore */
  }
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${COOKIE}=${choice}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export const useCookieConsent = create<CookieConsentState>((set) => ({
  choice: null,
  ready: false,
  hydrate: () => set({ choice: readStored(), ready: true }),
  choose: (choice) => {
    persist(choice);
    set({ choice, ready: true });
  },
  reopen: () => set({ choice: null, ready: true }),
}));

export function optionalCookiesAllowed() {
  return useCookieConsent.getState().choice === "all";
}
