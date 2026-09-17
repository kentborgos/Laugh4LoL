import { create } from "zustand";

const KEY = "laugh4lol-age";

export type AgeState = {
  token: string | null;
  adult: boolean;
  ready: boolean;
  setToken: (token: string, adult: boolean) => void;
  clear: () => void;
  hydrate: () => void;
};

function readStored(): { token: string; adult: boolean } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string; adult?: boolean };
    if (typeof parsed.token !== "string") return null;
    return { token: parsed.token, adult: Boolean(parsed.adult) };
  } catch {
    return null;
  }
}

export const useAge = create<AgeState>((set) => ({
  token: null,
  adult: false,
  ready: false,
  hydrate: () => {
    const stored = readStored();
    set({ token: stored?.token ?? null, adult: stored?.adult ?? false, ready: true });
  },
  setToken: (token, adult) => {
    localStorage.setItem(KEY, JSON.stringify({ token, adult, at: Date.now() }));
    set({ token, adult, ready: true });
  },
  clear: () => {
    localStorage.removeItem(KEY);
    set({ token: null, adult: false, ready: true });
  },
}));
