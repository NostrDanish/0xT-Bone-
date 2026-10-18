import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Event as NostrEvent } from "nostr-tools";
import { generateSecretKey, getPublicKey, nip19 } from "nostr-tools";
import {
  DEFAULT_RELAYS,
  hexToBytes,
  makeLocalSigner,
  nip07Signer,
  publish,
  store,
  sub,
  type Signer,
} from "./nostr";

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

const LS = {
  account: "tb.account", // {pubkey, skHex?, kind}
  relays: "tb.relays",
  settings: "tb.settings",
  follows: "tb.follows.cache",
};

export interface AppSettings {
  theme: "dark" | "light" | "cream";
  accent: string;
  radius: number; // px
  textScale: number; // 0.9 – 1.3
  font: "system" | "nunito";
  nwcUri: string;
  autoTheme: boolean;
}

export const ACCENTS = [
  { name: "Bone", value: "#e0b04a" },
  { name: "Nostr Purple", value: "#8b5cf6" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Sky", value: "#0ea5e9" },
  { name: "Lime", value: "#84cc16" },
  { name: "Orange", value: "#f97316" },
];

const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  accent: "#e0b04a",
  radius: 16,
  textScale: 1,
  font: "system",
  nwcUri: "",
  autoTheme: false,
};

interface AccountInfo {
  pubkey: string;
  kind: "nip07" | "local";
  skHex?: string;
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function loadArray(key: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]");
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

export interface RelayInfo {
  url: string;
  read: boolean;
  write: boolean;
}

interface AppContextValue {
  // account
  signer: Signer | null;
  loginNip07: () => Promise<void>;
  loginNsec: (nsecOrHex: string) => Promise<void>;
  createAccount: () => void;
  logout: () => void;
  // relays
  relays: RelayInfo[];
  setRelays: (r: RelayInfo[]) => void;
  relayUrls: () => string[];
  writeRelayUrls: () => string[];
  // follows
  follows: Set<string>;
  toggleFollow: (pk: string) => Promise<void>;
  isFollowing: (pk: string) => boolean;
  // muted
  muted: Set<string>;
  // settings
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  // publishing
  signAndPublish: (kind: number, content: string, tags?: string[][]) => Promise<NostrEvent>;
  // version tick for cache invalidation
  tick: number;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp outside provider");
  return ctx;
}

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<AccountInfo | null>(() => load<AccountInfo | null>(LS.account, null));
  const [signer, setSigner] = useState<Signer | null>(null);
  const [relays, setRelaysState] = useState<RelayInfo[]>(() => {
    const saved = loadArray(LS.relays);
    return saved.length
      ? saved
      : DEFAULT_RELAYS.map((url) => ({ url, read: true, write: true }));
  });
  const [follows, setFollows] = useState<Set<string>>(new Set(loadArray(LS.follows)));
  const [muted] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<AppSettings>(() => load(LS.settings, DEFAULT_SETTINGS));
  const [tick, setTick] = useState(0);

  /* --- theme application ------------------------------------------ */
  useEffect(() => {
    let theme = settings.theme;
    if (settings.autoTheme) {
      theme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.font = settings.font;
    root.style.setProperty("--accent", settings.accent);
    root.style.setProperty("--radius", `${settings.radius}px`);
    root.style.fontSize = `${16 * settings.textScale}px`;
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(LS.settings, JSON.stringify(next));
      return next;
    });
  }, []);

  /* --- signer bootstrap -------------------------------------------- */
  useEffect(() => {
    if (!account) {
      setSigner(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (account.kind === "local" && account.skHex) {
          const s = makeLocalSigner(account.skHex).signer;
          if (!cancelled) setSigner(s);
        } else {
          // NIP-07
          const api = (window as any).nostr;
          if (!api) throw new Error("No NIP-07 extension found");
          const pk = await api.getPublicKey();
          if (!cancelled) {
            setSigner(nip07Signer(pk));
            setAccount({ ...account, pubkey: pk });
          }
        }
      } catch (e) {
        console.error("signer init failed", e);
        if (!cancelled) setSigner(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.pubkey, account?.kind]);

  /* --- relay connections ------------------------------------------- */
  const relayUrls = useMemo(() => relays.filter((r) => r.read).map((r) => r.url), [relays]);

  useEffect(() => {
    if (!signer) return;
    // fetch user's relay list (kind 10002 / kind 3 fallback handled by store subs)
    const h = sub([relayUrls[0] ?? DEFAULT_RELAYS[0]], [{ kinds: [10002], authors: [signer.pubkey], limit: 1 }]);
    return () => h.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signer?.pubkey]);

  /* --- core subscriptions when logged in --------------------------- */
  useEffect(() => {
    if (!signer || relayUrls.length === 0) return;

    const handles: { close(): void }[] = [];

    // Own metadata + contact list + relay list
    handles.push(
      sub(relayUrls, [
        { kinds: [0, 3, 10002], authors: [signer.pubkey], limit: 3 },
      ]),
    );

    // Follows' profiles + contact lists (for following feed)
    const wk = setInterval(() => {
      // refresh follows from store every few seconds
      const ev = store.replaceableFor(signer.pubkey, 3);
      if (ev) {
        const pks = ev.tags.filter((t) => t[0] === "p").map((t) => t[1]);
        if (pks.length) {
          const next = new Set(pks);
          setFollows((prev) => {
            const same = prev.size === next.size && [...next].every((p) => prev.has(p));
            if (same) return prev;
            localStorage.setItem(LS.follows, JSON.stringify([...next]));
            // fetch profiles of follows
            return next;
          });
        }
      }
      setTick((t) => t + 1);
    }, 3000);

    return () => {
      handles.forEach((h) => h.close());
      clearInterval(wk);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signer?.pubkey, relayUrls.join(",")]);

  /* --- publish helper ---------------------------------------------- */
  const signAndPublish = useCallback(
    async (kind: number, content: string, tags: string[][] = []): Promise<NostrEvent> => {
      if (!signer) throw new Error("Not logged in");
      const draft = { kind, content, tags, created_at: Math.floor(Date.now() / 1000), pubkey: signer.pubkey };
      const ev = await signer.sign(draft as any);
      await publish(writeRelayUrls(), ev);
      store.up(ev);
      store.notify();
      return ev;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signer, relays],
  );

  const writeRelayUrls = useCallback(
    () => relays.filter((r) => r.write).map((r) => r.url),
    [relays],
  );

  /* --- login/logout ------------------------------------------------- */
  const loginNip07 = useCallback(async () => {
    const api = (window as any).nostr;
    if (!api) throw new Error("No NIP-07 extension found in this browser. Install Alby, nos2x or Aka-Profiles.");
    const pk = await api.getPublicKey();
    const acc: AccountInfo = { pubkey: pk, kind: "nip07" };
    localStorage.setItem(LS.account, JSON.stringify(acc));
    setAccount(acc);
  }, []);

  const loginNsec = useCallback(async (input: string) => {
    let skHex: string;
    const v = input.trim();
    if (v.startsWith("nsec1")) {
      const d = nip19.decode(v);
      if (d.type !== "nsec") throw new Error("Not an nsec");
      skHex = Array.from(d.data as Uint8Array).map((x) => x.toString(16).padStart(2, "0")).join("");
    } else {
      skHex = v.replace(/\s+/g, "").replace(/^0x/, "");
      hexToBytes(skHex); // validate
      if (skHex.length !== 64) throw new Error("Secret key must be 64 hex chars");
    }
    const pk = getPublicKey(hexToBytes(skHex));
    const acc: AccountInfo = { pubkey: pk, kind: "local", skHex };
    localStorage.setItem(LS.account, JSON.stringify(acc));
    setAccount(acc);
  }, []);

  const createAccount = useCallback(() => {
    const sk = generateSecretKey();
    const skHex = Array.from(sk).map((x) => x.toString(16).padStart(2, "0")).join("");
    const pk = getPublicKey(sk);
    const acc: AccountInfo = { pubkey: pk, kind: "local", skHex };
    localStorage.setItem(LS.account, JSON.stringify(acc));
    setAccount(acc);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(LS.account);
    setAccount(null);
    setSigner(null);
  }, []);

  /* --- relays -------------------------------------------------------- */
  const setRelays = useCallback((next: RelayInfo[]) => {
    localStorage.setItem(LS.relays, JSON.stringify(next));
    setRelaysState(next);
  }, []);

  /* --- follows -------------------------------------------------------- */
  const isFollowing = useCallback((pk: string) => follows.has(pk), [follows]);

  const toggleFollow = useCallback(
    async (pk: string) => {
      if (!signer) return;
      const next = new Set(follows);
      const wasFollowing = next.has(pk);
      if (wasFollowing) next.delete(pk);
      else next.add(pk);
      setFollows(next);

      const tags: string[][] = [];
      // preserve non-p tags from previous contact list
      const prevEv = store.replaceableFor(signer.pubkey, 3);
      if (prevEv) {
        for (const t of prevEv.tags) if (t[0] !== "p") tags.push(t);
      }
      for (const p of next) tags.push(["p", p]);

      try {
        await signAndPublish(3, prevEv?.content ?? "", tags);
        // persist to relay list metadata too? (NIP-65) — optional
      } catch (e) {
        console.error("follow publish failed", e);
        // rollback
        const back = new Set(follows);
        setFollows(back);
        throw e;
      }
    },
    [follows, signer, signAndPublish],
  );

  const value: AppContextValue = {
    signer,
    loginNip07,
    loginNsec,
    createAccount,
    logout,
    relays,
    setRelays,
    relayUrls: () => relayUrls,
    writeRelayUrls,
    follows,
    toggleFollow,
    isFollowing,
    muted,
    settings,
    updateSettings,
    signAndPublish,
    tick,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/** React to store cache updates (event store version). */
export function useStoreTick(): number {
  const { tick } = useApp();
  // store also notifies independently; combine with a local subscription
  const [v, setV] = React.useState(0);
  React.useEffect(() => store.subscribe(() => setV((x) => x + 1)), []);
  return v + tick;
}
