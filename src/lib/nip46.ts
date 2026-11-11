/**
 * NIP-46 remote signing — Amber / nsecBunker / any bunker signer.
 *
 * Two flows are supported:
 *
 * 1. Client-initiated ("scan to login"): the client generates an ephemeral
 *    keypair and shows a `nostrconnect://` URI as a QR code. The user scans
 *    it with Amber, approves, and Amber sends the connect response back over
 *    the relays in the URI. The client learns the remote-signer pubkey from
 *    the response author and validates the echoed secret.
 *
 * 2. Signer-initiated: the user pastes a `bunker://` token (Amber >
 *    Settings > Bunker). The client derives its keypair from the secret
 *    when it is a 64-hex key (nsecBunker convention) and sends a `connect`
 *    request RPC.
 *
 * Transport: request + response events are kind 24133 (current spec),
 * content NIP-44 v2 encrypted (NIP-04 fallback when decrypting).
 * For maximum compatibility with older Amber versions, requests are also
 * published as kind 23194 (legacy request kind).
 */
import type { Event as NostrEvent } from "nostr-tools";
import { finalizeEvent, generateSecretKey, getPublicKey, nip04, nip44 } from "nostr-tools";
import { verifyEvent } from "nostr-tools/pure";
import { bytesToHex, hexToBytes, pool } from "./nostr";
import type { Signer } from "./nostr";

const REQUEST_KIND = 24133;
const LEGACY_REQUEST_KIND = 23194;
const RESPONSE_KIND = 24133;

/** Relays used for the remote-signing session. */
export const AMBER_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
  "wss://nostr.wine",
];

export function randomSecret(len = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function buildNostrConnectUri(
  clientPubkey: string,
  relays: string[],
  secret: string,
  name: string,
  url: string,
): string {
  const params = new URLSearchParams();
  for (const r of relays) params.append("relay", r);
  params.set("secret", secret);
  params.set("name", name);
  params.set("url", url);
  return `nostrconnect://${clientPubkey}?${params.toString()}`;
}

/** Generate a fresh connection session for the QR login flow. */
export function createAmberConnectUri(
  relays: string[] = AMBER_RELAYS,
): { uri: string; secret: string; clientSecretHex: string } {
  const sk = generateSecretKey();
  const clientSecretHex = bytesToHex(sk);
  const secret = randomSecret(16);
  const uri = buildNostrConnectUri(
    getPublicKey(sk),
    relays,
    secret,
    "T-Bone Web",
    window.location.origin,
  );
  return { uri, secret, clientSecretHex };
}

function tryDecrypt(clientSecret: Uint8Array, ev: NostrEvent): any | null {
  // NIP-44 v2 first (current spec), NIP-04 fallback (older signers)
  try {
    const convKey = nip44.v2.utils.getConversationKey(clientSecret, ev.pubkey);
    return JSON.parse(nip44.v2.decrypt(ev.content, convKey));
  } catch {
    try {
      return JSON.parse(nip04.decrypt(clientSecret, ev.pubkey, ev.content));
    } catch {
      return null;
    }
  }
}

/** Wait for the signer to scan the nostrconnect:// QR and approve.
 *  Returns { promise, cancel } — cancel() tears down the relay subscription. */
export function awaitAmberScan(
  relays: string[],
  clientSecretHex: string,
  secret: string,
  opts: { onAuth?: (url: string) => void; onSeen?: () => void; timeoutMs?: number } = {},
): { promise: Promise<Nip46Signer>; cancel: () => void } {
  const clientSecret = hexToBytes(clientSecretHex);
  const clientPubkey = getPublicKey(clientSecret);
  const timeoutMs = opts.timeoutMs ?? 5 * 60_000;

  let done = false;
  let sub: { close(): void } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cleanup = () => {
    if (sub) {
      try {
        sub.close();
      } catch { /* noop */ }
      sub = null;
    }
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const promise = new Promise<Nip46Signer>((resolve, reject) => {
    const since = Math.floor(Date.now() / 1000) - 10;

    sub = pool.subscribeMany(
      relays,
      [{ kinds: [RESPONSE_KIND, LEGACY_REQUEST_KIND], "#p": [clientPubkey], since }],
      {
        onevent: (ev: NostrEvent) => {
          if (done || !verifyEvent(ev)) return;
          const parsed = tryDecrypt(clientSecret, ev);
          if (!parsed || typeof parsed.result !== "string") return;
          if (parsed.result === "auth_url") {
            opts.onAuth?.(String(parsed.error ?? ""));
            return;
          }
          if (parsed.result !== secret) return; // must echo our secret (anti-spoof)
          done = true;
          opts.onSeen?.();
          const signer = new Nip46Signer(relays, clientSecretHex, ev.pubkey);
          cleanup();
          resolve(signer);
        },
        onclose: () => {
          if (!done) {
            done = true;
            timer = null;
            reject(new Error("Connection closed before Amber responded"));
          }
        },
      },
    );

    timer = setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error("Timed out waiting for Amber — generate a new QR"));
    }, timeoutMs);
  });

  return {
    promise,
    cancel: () => {
      if (done) return;
      done = true;
      cleanup();
    },
  };
}

/** Connect by pasting a bunker:// token (signer-initiated flow). */
export async function connectBunkerUri(
  uri: string,
  opts: { onAuth?: (url: string) => void; timeoutMs?: number } = {},
): Promise<Nip46Signer> {
  const m = uri.trim().match(/^bunker:\/\/([0-9a-fA-F]{64})(\?.*)?$/);
  if (!m) throw new Error("Not a valid bunker:// URI");
  const signerPubkey = m[1].toLowerCase();
  const params = new URLSearchParams(m[2] ?? "");
  const relays = params.getAll("relay");
  if (relays.length === 0) throw new Error("bunker:// URI has no relays");
  const secret = params.get("secret") ?? "";

  // nsecBunker convention: secret is the client's secret key (64 hex)
  const sk =
    secret && secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)
      ? hexToBytes(secret)
      : generateSecretKey();
  const clientSecretHex = bytesToHex(sk);

  const signer = new Nip46Signer(relays, clientSecretHex, signerPubkey);
  await signer.handshake(secret, opts);
  return signer;
}

/* ------------------------------------------------------------------ */
/* The signer                                                          */
/* ------------------------------------------------------------------ */

interface Pending {
  resolve: (v: string) => void;
  reject: (e: any) => void;
  timer: number;
  onAuth?: (url: string) => void;
  authSeen?: boolean;
}

export class Nip46Signer implements Signer {
  kind: "nip46" = "nip46";
  pubkey = "";
  private sk: Uint8Array;
  private myPubkey: string;
  private sub: { close(): void } | null = null;
  private destroyed = false;
  private pending = new Map<string, Pending>();
  private watchdog: number | null = null;
  private authCallback?: (url: string) => void;

  constructor(
    public relays: string[],
    public clientSecretHex: string,
    public signerPubkey: string,
  ) {
    this.sk = hexToBytes(clientSecretHex);
    this.myPubkey = getPublicKey(this.sk);
    this.startSubscription();
    this.watchdog = window.setInterval(() => {
      if (!this.destroyed && !this.sub) this.startSubscription();
    }, 5000);
  }

  private startSubscription() {
    this.sub?.close();
    if (this.destroyed) return;
    const since = Math.floor(Date.now() / 1000) - 10;
    try {
      this.sub = pool.subscribeMany(
        this.relays,
        [{ kinds: [RESPONSE_KIND, LEGACY_REQUEST_KIND], authors: [this.signerPubkey], "#p": [this.myPubkey], since }],
        {
          onevent: (ev: NostrEvent) => {
            if (this.destroyed || !verifyEvent(ev)) return;
            void this.handleResponse(ev);
          },
          onclose: () => {
            this.sub = null;
          },
        },
      );
    } catch {
      this.sub = null;
    }
  }

  private async handleResponse(ev: NostrEvent) {
    if (ev.pubkey !== this.signerPubkey) return;
    const parsed = tryDecrypt(this.sk, ev);
    if (!parsed || typeof parsed.id !== "string") return;
    const p = this.pending.get(parsed.id);
    if (!p) return;

    if (parsed.result === "auth_url") {
      // signer wants extra approval at the URL — keep waiting for the real result
      if (!p.authSeen) {
        p.authSeen = true;
        (p.onAuth ?? this.authCallback)?.(String(parsed.error ?? ""));
      }
      return;
    }
    this.pending.delete(parsed.id);
    clearTimeout(p.timer);
    if (parsed.error) p.reject(new Error(String(parsed.error)));
    else p.resolve(String(parsed.result ?? ""));
  }

  private convKey(signerPubkey: string) {
    return nip44.v2.utils.getConversationKey(this.sk, signerPubkey);
  }

  /** Send an RPC request and wait for the response. */
  rpc(method: string, params: string[], timeoutMs = 45_000, onAuth?: (url: string) => void): Promise<string> {
    if (this.destroyed) return Promise.reject(new Error("Signer closed"));
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const content = nip44.v2.encrypt(
      JSON.stringify({ id, method, params }),
      this.convKey(this.signerPubkey),
    );
    const created_at = Math.floor(Date.now() / 1000);

    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`"${method}" timed out — check your phone for approval prompts`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer, onAuth });

      // publish as current-spec kind 24133 + legacy 23194 for old signers
      for (const kind of [REQUEST_KIND, LEGACY_REQUEST_KIND]) {
        const ev = finalizeEvent(
          { kind, content, tags: [["p", this.signerPubkey]], created_at, pubkey: this.myPubkey },
          this.sk,
        );
        for (const p of pool.publish(this.relays, ev)) p.catch(() => {});
      }
    });
  }

  /** Initial `connect` RPC — used by the bunker:// flow. */
  async handshake(
    secret: string,
    opts: { onAuth?: (url: string) => void; timeoutMs?: number } = {},
  ): Promise<void> {
    this.authCallback = opts.onAuth;
    const metadata = JSON.stringify({
      name: "T-Bone Web",
      url: window.location.origin,
    });
    // params: [remote-signer-pubkey, secret, perms, metadata]
    await this.rpc("connect", [this.signerPubkey, secret, "", metadata], opts.timeoutMs ?? 120_000, opts.onAuth);
    await this.fetchPubkey();
  }

  /** `get_public_key` RPC — the actual user pubkey. */
  async fetchPubkey(): Promise<string> {
    const pk = await this.rpc("get_public_key", [], 30_000);
    this.pubkey = pk;
    return pk;
  }

  /* --- Signer interface -------------------------------------------- */

  async sign(ev: NostrEvent): Promise<NostrEvent> {
    const result = await this.rpc(
      "sign_event",
      [JSON.stringify({ kind: ev.kind, content: ev.content, tags: ev.tags, created_at: ev.created_at })],
      90_000,
    );
    let signed: NostrEvent;
    try {
      signed = JSON.parse(result) as NostrEvent;
    } catch {
      throw new Error("Malformed sign_event response");
    }
    if (!verifyEvent(signed)) throw new Error("Event returned from signer is improperly signed");
    return signed;
  }

  nip04Encrypt(pubkey: string, plaintext: string): Promise<string> {
    return this.rpc("nip04_encrypt", [pubkey, plaintext]);
  }
  nip04Decrypt(pubkey: string, ciphertext: string): Promise<string> {
    return this.rpc("nip04_decrypt", [pubkey, ciphertext]);
  }
  nip44Encrypt(pubkey: string, plaintext: string): Promise<string> {
    return this.rpc("nip44_encrypt", [pubkey, plaintext]);
  }
  nip44Decrypt(pubkey: string, ciphertext: string): Promise<string> {
    return this.rpc("nip44_decrypt", [pubkey, ciphertext]);
  }

  /** Ask the signer for its preferred relays (NIP-46 switch_relays). */
  async applySignerRelays(): Promise<string[] | null> {
    try {
      const result = await this.rpc("switch_relays", [], 20_000);
      const list = JSON.parse(result);
      if (Array.isArray(list) && list.length && list.every((x) => typeof x === "string")) {
        this.relays = list;
        this.startSubscription();
        return list;
      }
    } catch { /* optional */ }
    return null;
  }

  /** Teardown. Pass true to also tell the signer to end the session. */
  async destroy(sendLogout = false): Promise<void> {
    if (sendLogout) {
      try {
        await this.rpc("logout", [], 15_000);
      } catch { /* courtesy only */ }
    }
    this.destroyed = true;
    if (this.watchdog) window.clearInterval(this.watchdog);
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error("Signer closed"));
    }
    this.pending.clear();
    try {
      this.sub?.close();
    } catch { /* noop */ }
    this.sub = null;
  }
}
