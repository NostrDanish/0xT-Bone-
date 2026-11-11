/**
 * Nostr Wallet Connect (NIP-47) — minimal client for pay_invoice.
 * URI format: nostr+walletconnect://<wallet-pubkey>?relay=<wss>&secret=<hex>
 */
import type { Event as NostrEvent } from "nostr-tools";
import { finalizeEvent, getPublicKey, nip04 } from "nostr-tools";
import { hexToBytes, pool } from "./nostr";

export interface NwcInfo {
  walletPubkey: string;
  relay: string;
  secret: string;
}

export function parseNwcUri(uri: string): NwcInfo | null {
  try {
    if (!uri.startsWith("nostr+walletconnect://")) return null;
    const url = new URL(uri.replace("nostr+walletconnect://", "https://nw.c/"));
    const walletPubkey = url.hostname || url.pathname.replace("//", "");
    const relay = url.searchParams.get("relay") ?? "";
    const secret = url.searchParams.get("secret") ?? "";
    if (!/^[0-9a-f]{64}$/.test(walletPubkey) || !relay || !/^[0-9a-f]{32,}$/.test(secret)) return null;
    return { walletPubkey, relay, secret };
  } catch {
    return null;
  }
}

function requestEvent(nwc: NwcInfo, method: string, params: any): NostrEvent {
  const sk = hexToBytes(nwc.secret);
  const content = nip04.encrypt(sk, nwc.walletPubkey, JSON.stringify({ method, params }));
  return finalizeEvent(
    {
      kind: 23194,
      content,
      tags: [["p", nwc.walletPubkey]],
      created_at: Math.floor(Date.now() / 1000),
      pubkey: getPublicKey(sk),
    },
    sk,
  );
}

async function waitForResponse(nwc: NwcInfo, requestId: string, timeoutMs = 20000): Promise<any> {
  return new Promise((resolve, reject) => {
    const sub = pool.subscribeMany(
      [nwc.relay],
      [{ kinds: [23195], authors: [nwc.walletPubkey], "#e": [requestId], since: Math.floor(Date.now() / 1000) - 10 }],
      {
        onevent: (ev: NostrEvent) => {
          try {
            const sk = hexToBytes(nwc.secret);
            const content = nip04.decrypt(sk, nwc.walletPubkey, ev.content);
            const parsed = JSON.parse(content);
            sub.close();
            if (parsed.error) reject(new Error(parsed.error.message ?? "wallet error"));
            else resolve(parsed.result);
          } catch (e) {
            sub.close();
            reject(e);
          }
        },
        oneose: () => {},
      },
    );
    setTimeout(() => {
      try {
        sub.close();
      } catch { /* noop */ }
      reject(new Error("Wallet response timed out"));
    }, timeoutMs);
  });
}

/** Generic NWC request (connects, publishes, waits for response). */
export async function nwcRequest(nwc: NwcInfo, method: string, params: any): Promise<any> {
  const ev = requestEvent(nwc, method, params);
  const waitP = waitForResponse(nwc, ev.id);
  await Promise.any(pool.publish([nwc.relay], ev));
  return waitP;
}

export async function nwcPayInvoice(nwc: NwcInfo, invoice: string): Promise<any> {
  return nwcRequest(nwc, "pay_invoice", { invoice });
}

export async function nwcGetBalance(nwc: NwcInfo): Promise<number | null> {
  try {
    const r = await nwcRequest(nwc, "get_balance", {});
    return typeof r?.balance === "number" ? r.balance : null;
  } catch {
    return null;
  }
}

export function formatSats(msat: number | null): string {
  if (msat == null) return "—";
  return `${Math.round(msat / 1000).toLocaleString()} sats`;
}
