import type { Event as NostrEvent, Filter } from "nostr-tools";
import { SimplePool, finalizeEvent, getPublicKey, generateSecretKey, nip04, nip19 } from "nostr-tools";
import { verifyEvent } from "nostr-tools/pure";
import type { SecretKey } from "nostr-tools/core";

/* ------------------------------------------------------------------ */
/* Relay pool                                                          */
/* ------------------------------------------------------------------ */

export const pool = new SimplePool();

export const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
  "wss://nostr.wine",
];

export type RelayStatus = "connecting" | "open" | "closed" | "error";

/* ------------------------------------------------------------------ */
/* Signer — NIP-07 extension or a device-local secret key              */
/* ------------------------------------------------------------------ */

export interface Signer {
  kind: "nip07" | "local" | "nip46";
  pubkey: string;
  sign(ev: NostrEvent): Promise<NostrEvent>;
  nip04Encrypt?(pubkey: string, plaintext: string): Promise<string>;
  nip04Decrypt?(pubkey: string, ciphertext: string): Promise<string>;
  nip44Encrypt?(pubkey: string, plaintext: string): Promise<string>;
  nip44Decrypt?(pubkey: string, ciphertext: string): Promise<string>;
}

function localSigner(sk: SecretKey, pubkey: string): Signer {
  return {
    kind: "local",
    pubkey,
    sign: (ev) => Promise.resolve(finalizeEvent(ev as any, sk)),
    nip04Encrypt: (pk, pt) => Promise.resolve(nip04.encrypt(sk, pk, pt)),
    nip04Decrypt: (pk, ct) => Promise.resolve(nip04.decrypt(sk, pk, ct)),
    nip44Encrypt: (pk, pt) =>
      import("nostr-tools/nip44").then((n) => n.v2.utils.getConversationKey(sk, pk)).then((ck) =>
        import("nostr-tools/nip44").then((n2) => n2.v2.encrypt(pt, ck)),
      ),
    nip44Decrypt: (pk, ct) =>
      import("nostr-tools/nip44").then((n) => n.v2.utils.getConversationKey(sk, pk)).then((ck) =>
        import("nostr-tools/nip44").then((n2) => n2.v2.decrypt(ct, ck)),
      ),
  };
}

export function nip07Signer(pubkey: string): Signer {
  const api = (window as any).nostr;
  return {
    kind: "nip07",
    pubkey,
    sign: (ev) => api.signEvent(ev),
    nip04Encrypt: (pk, pt) => api.nip04.encrypt(pk, pt),
    nip04Decrypt: (pk, ct) => api.nip04.decrypt(pk, ct),
    nip44Encrypt: (pk, pt) => api.nip44?.encrypt(pk, pt),
    nip44Decrypt: (pk, ct) => api.nip44?.decrypt(pk, ct),
  };
}

export function makeLocalSigner(skHex?: string): { signer: Signer; skHex: string } {
  const sk = skHex ? hexToBytes(skHex) : generateSecretKey();
  return { signer: localSigner(sk, getPublicKey(sk)), skHex: bytesToHex(sk) };
}

/* ------------------------------------------------------------------ */
/* Event store — global cache with subscription notifications          */
/* ------------------------------------------------------------------ */

export interface Profile {
  name?: string;
  display_name?: string;
  about?: string;
  picture?: string;
  banner?: string;
  nip05?: string;
  website?: string;
  lud06?: string;
  lud16?: string;
  created_at?: number;
}

export class EventStore {
  events = new Map<string, NostrEvent>();
  /** replaceable events: latest per author:kind:d */
  replaceable = new Map<string, NostrEvent>();
  profiles = new Map<string, Profile>();
  version = 0;
  private listeners = new Set<() => void>();

  up(ev: NostrEvent) {
    const existing = this.events.get(ev.id);
    if (existing) return false;
    this.events.set(ev.id, ev);

    if ([0, 3, 10000, 10001, 10002, 30023].includes(ev.kind)) {
      const d = ev.tags.find((t) => t[0] === "d")?.[1] ?? "";
      const key = `${ev.pubkey}:${ev.kind}:${d}`;
      const prev = this.replaceable.get(key);
      if (!prev || ev.created_at >= prev.created_at) {
        this.replaceable.set(key, ev);
        if (ev.kind === 0) {
          try {
            this.profiles.set(ev.pubkey, JSON.parse(ev.content));
          } catch {
            /* bad profile json */
          }
        }
      }
    }
    this.version++;
    return true;
  }

  get(id: string) {
    return this.events.get(id);
  }

  replaceableFor(pubkey: string, kind: number, d = "") {
    return this.replaceable.get(`${pubkey}:${kind}:${d}`);
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getVersion = () => this.version;

  notify() {
    for (const fn of this.listeners) fn();
  }
}

export const store = new EventStore();

/* ------------------------------------------------------------------ */
/* Subscriptions                                                       */
/* ------------------------------------------------------------------ */

export interface SubHandle {
  close(): void;
}

/** Subscribe to relays and feed the store. Returns a close handle. */
export function sub(
  relays: string[],
  filters: Filter[],
  opts: { onEose?: () => void; label?: string } = {},
): SubHandle {
  if (relays.length === 0) return { close: () => {} };
  let closed = false;
  let count = 0;
  let eoseCount = 0;

  const handle = pool.subscribeMany(
    relays,
    filters,
    {
      onevent: (ev: NostrEvent) => {
        if (closed) return;
        if (!verifyEvent(ev)) return;
        if (store.up(ev)) {
          count++;
          // Throttle notifications a bit for feed smoothness
          if (count % 5 === 0 || ev.kind !== 1) store.notify();
        }
      },
      oneose: () => {
        eoseCount++;
        if (eoseCount >= Math.min(relays.length, 2)) {
          store.notify();
          opts.onEose?.();
        }
      },
    },
  );

  return {
    close() {
      closed = true;
      try {
        handle.close();
      } catch {
        /* noop */
      }
    },
  };
}

/** Publish an event to all configured relays. */
export async function publish(relays: string[], ev: NostrEvent): Promise<void> {
  if (relays.length === 0) throw new Error("No relays configured");
  await Promise.any(pool.publish(relays, ev));
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

export function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("bad hex");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function encodeNpub(pubkey: string) {
  try {
    return nip19.npubEncode(pubkey);
  } catch {
    return pubkey;
  }
}

export function encodeNote(id: string) {
  try {
    return nip19.noteEncode(id);
  } catch {
    return id;
  }
}

export function shortNpub(pubkey: string) {
  try {
    const s = nip19.npubEncode(pubkey);
    return `${s.slice(0, 10)}…${s.slice(-6)}`;
  } catch {
    return pubkey.slice(0, 10);
  }
}

export interface NoteRefs {
  rootId?: string;
  replyId?: string;
  mentions: string[];
  hashtags: string[];
  quoteIds: string[];
}

/** Extract NIP-10 reply markers + mentions + hashtags from an event. */
export function parseRefs(ev: NostrEvent): NoteRefs {
  let rootId: string | undefined;
  let replyId: string | undefined;
  const mentions: string[] = [];
  const hashtags: string[] = [];
  const quoteIds: string[] = [];

  const eTags = ev.tags.filter((t) => t[0] === "e");
  for (const t of ev.tags) {
    if (t[0] === "e") {
      if (t.length >= 4) {
        if (t[3] === "root") rootId = t[1];
        else if (t[3] === "reply" || t[3] === "mention") replyId ??= t[1] === rootId ? undefined : t[1];
      }
    } else if (t[0] === "p") {
      if (!mentions.includes(t[1])) mentions.push(t[1]);
    } else if (t[0] === "t") {
      if (!hashtags.includes(t[1])) hashtags.push(t[1]);
    } else if (t[0] === "q") {
      quoteIds.push(t[1]);
    }
  }
  // Legacy reply style: last e tag is the direct parent
  if (!replyId && eTags.length >= 2) replyId = eTags[eTags.length - 1][1];
  if (!rootId && eTags.length >= 1) rootId = eTags[0][1];
  if (replyId === rootId) replyId = undefined;

  return { rootId, replyId, mentions, hashtags, quoteIds };
}

export function timeAgo(ts: number): string {
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d`;
  return new Date(ts * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function displayName(pk: string): string {
  const p = store.profiles.get(pk);
  return p?.display_name || p?.name || shortNpub(pk);
}

export function avatarUrl(pk: string): string | undefined {
  return store.profiles.get(pk)?.picture;
}

/** Identicon-style deterministic avatar as an inline SVG data URL. */
export function fallbackAvatar(pk: string): string {
  let hash = 0;
  for (let i = 0; i < pk.length; i++) hash = (hash * 31 + pk.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  const hue2 = (hue + 40) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},55%,45%)"/><stop offset="1" stop-color="hsl(${hue2},55%,55%)"/></linearGradient></defs><rect width="80" height="80" fill="url(#g)"/><text x="40" y="52" font-size="34" text-anchor="middle" fill="rgba(255,255,255,.9)" font-family="sans-serif">${pk.slice(0, 2).toUpperCase()}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
