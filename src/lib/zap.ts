/**
 * NIP-57 zaps — build the zap request, fetch an invoice from the
 * recipient's LNURL-pay endpoint, and optionally pay via NWC (NIP-47).
 */
import type { Event as NostrEvent } from "nostr-tools";
import type { Signer } from "./nostr";
import { nwcPayInvoice, parseNwcUri, type NwcInfo } from "./nwc";
import { store, type Profile } from "./nostr";

function lnurlFromProfile(p?: Profile): string | null {
  if (!p) return null;
  if (p.lud16 && p.lud16.includes("@")) {
    const [name, domain] = p.lud16.split("@");
    return `https://${domain}/.well-known/lnurlp/${name}`;
  }
  if (p.lud06) {
    // lud06 may be a bech32-encoded lnurl or a raw URL
    if (p.lud06.startsWith("http")) return p.lud06;
    if (p.lud06.toLowerCase().startsWith("lnurl1")) {
      const decoded = bech32Decode(p.lud06.toLowerCase());
      if (decoded?.startsWith("http")) return decoded;
    }
    return p.lud06;
  }
  return null;
}

/** Minimal bech32 decode (for LNURL). Returns payload as an UTF-8 string or null. */
function bech32Decode(bech: string): string | null {
  const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  const pos = bech.lastIndexOf("1");
  if (pos < 1 || pos + 7 > bech.length) return null;
  const dataPart = bech.slice(pos + 1);
  const values: number[] = [];
  for (const ch of dataPart) {
    const v = CHARSET.indexOf(ch);
    if (v === -1) return null;
    values.push(v);
  }
  values.length -= 6; // strip checksum
  // convert 5-bit groups to 8-bit bytes
  let acc = 0, bits = 0;
  const bytes: number[] = [];
  for (const v of values) {
    acc = (acc << 5) | v;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  try {
    return new TextDecoder().decode(new Uint8Array(bytes));
  } catch {
    return null;
  }
}

async function fetchJson(url: string): Promise<any> {
  // try direct, fall back to CORS proxy
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (r.ok) return r.json();
  } catch {
    /* fallthrough */
  }
  const proxied = `https://proxy.shakespeare.diy/?url=${encodeURIComponent(url)}`;
  const r2 = await fetch(proxied, { signal: AbortSignal.timeout(12000) });
  if (!r2.ok) throw new Error(`LNURL fetch failed (${r2.status})`);
  return r2.json();
}

export interface ZapResult {
  invoice?: string;
  paid: boolean;
}

/**
 * Full zap flow. Amount is in millisats.
 * - Requires signer for the zap request (kind 9734).
 * - If NWC is configured in the URI, pays automatically; otherwise returns the invoice (BOLT11).
 */
export async function sendZap(
  signer: Signer,
  targetPubkey: string,
  targetEventId: string | undefined,
  msat: number,
  relays: string[],
  nwcUri: string,
  comment = "",
): Promise<ZapResult> {
  const profile = store.profiles.get(targetPubkey);
  const lnurl = lnurlFromProfile(profile);
  if (!lnurl) throw new Error("Recipient has no Lightning address (lud16/lud06)");

  const lnurlData = await fetchJson(lnurl);
  if (lnurlData.tag !== "payRequest") throw new Error("Not an LNURL-pay endpoint");

  const p = profile ?? {};
  const zapTags: string[][] = [["relays", ...relays], ["p", targetPubkey]];
  if (targetEventId) zapTags.push(["e", targetEventId]);

  const zapRequest: NostrEvent = {
    kind: 9734,
    pubkey: signer.pubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: zapTags,
    content: comment,
  };
  const signed = await signer.sign(zapRequest);

  const url = new URL(lnurlData.callback);
  url.searchParams.set("amount", String(msat));
  url.searchParams.set("nostr", JSON.stringify(signed));
  if (p.lud06) url.searchParams.set("lnurl", p.lud06);

  const invoiceData = await fetchJson(url.toString());
  const invoice: string | undefined = invoiceData.pr;
  if (!invoice) throw new Error("No invoice returned");

  const nwc: NwcInfo | null = parseNwcUri(nwcUri);
  if (nwc) {
    try {
      await nwcPayInvoice(nwc, invoice);
      return { invoice, paid: true };
    } catch (e) {
      console.error("NWC payment failed", e);
      return { invoice, paid: false };
    }
  }
  return { invoice, paid: false };
}

/** Parse a NIP-57 zap receipt (kind 9735) into (zapper, amountMsat, targetEvent). */
export function parseZapReceipt(ev: NostrEvent): { zapper: string; amountMsat: number; targetEvent?: string } | null {
  const get = (name: string) => ev.tags.find((t) => t[0] === name)?.[1];
  const bolt11 = get("bolt11");
  let amountMsat = 0;
  if (bolt11) {
    const m = bolt11.match(/amount=(\d+)/);
    if (m) amountMsat = parseInt(m[1], 10); // msat encoded in the bolt11 string
  }
  const description = get("description");
  let zapper = ev.pubkey;
  if (description) {
    try {
      const req = JSON.parse(description) as NostrEvent;
      zapper = req.pubkey;
    } catch { /* noop */ }
  }
  const targetEvent = ev.tags.find((t) => t[0] === "e")?.[1];
  return { zapper, amountMsat, targetEvent };
}
