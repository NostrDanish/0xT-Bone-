import { useEffect, useMemo, useRef } from "react";
import type { Event as NostrEvent, Filter } from "nostr-tools";
import { sub, store } from "./nostr";
import { useApp, useStoreTick } from "./store";

/**
 * Subscribe to relays with the given filters; returns matching events
 * (newest first) straight from the shared event store.
 */
export function useFeed(filters: Filter[], opts: { live?: boolean; untilLoadMore?: boolean } = {}) {
  const { relayUrls, tick } = useApp();
  const storeTick = useStoreTick();
  const key = useMemo(() => JSON.stringify(filters), [filters]);
  const handleRef = useRef<{ close(): void } | null>(null);

  useEffect(() => {
    if (relayUrls.length === 0) return;
    const parsed = JSON.parse(key) as Filter[];
    const h = sub(relayUrls, parsed, { label: "feed" });
    handleRef.current = h;
    return () => h.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, relayUrls.join(",")]);

  const events = useMemo(() => {
    const parsed = JSON.parse(key) as Filter[];
    const seen = new Set<string>();
    const out: NostrEvent[] = [];
    outer: for (const f of parsed) {
      for (const ev of store.events.values()) {
        if (seen.has(ev.id)) continue;
        if (f.authors && !f.authors.includes(ev.pubkey)) continue;
        if (f.kinds && !f.kinds.includes(ev.kind)) continue;
        if (f["#t"]) {
          const tags = ev.tags.filter((t) => t[0] === "t").map((t) => t[1]);
          if (!f["#t"].some((t) => tags.includes(t))) continue;
        }
        if (f["#e"]) {
          const tags = ev.tags.filter((t) => t[0] === "e").map((t) => t[1]);
          if (!f["#e"].some((t) => tags.includes(t))) continue;
        }
        if (f["#p"]) {
          const tags = ev.tags.filter((t) => t[0] === "p").map((t) => t[1]);
          if (!f["#p"].some((t) => tags.includes(t))) continue;
        }
        if (f.since && ev.created_at < f.since) continue;
        if (f.until && ev.created_at > f.until) continue;
        if (f.limit && out.length >= f.limit * 2) continue outer;
        if (matchesSearch(ev, f.search)) {
          seen.add(ev.id);
          out.push(ev);
        }
      }
    }
    return out.sort((a, b) => b.created_at - a.created_at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, storeTick]);

  return events;
}

function matchesSearch(ev: NostrEvent, search?: string): boolean {
  if (!search) return true;
  return ev.content.toLowerCase().includes(search.toLowerCase());
}

/** Fetch a single event by id from relays (resolves via store). */
export function useEventById(id: string | undefined, kinds = [1, 6]) {
  const { relayUrls } = useApp();
  useStoreTick();
  useEffect(() => {
    if (!id || relayUrls.length === 0) return;
    if (store.get(id)) return;
    const h = sub(relayUrls, [{ ids: [id] }]);
    // ids filter needs raw id; if passed a nevent/note decode happens in caller
    return () => h.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, relayUrls.join(",")]);
  return id ? store.get(id) : undefined;
}

/** Load older events into the store (pagination). */
export async function loadOlder(filters: Filter[], until: number) {
  const { relayUrls } = useAppSnapshot();
  const f = filters.map((x) => ({ ...x, until, limit: x.limit ?? 40 }));
  await new Promise<void>((resolve) => {
    const h = sub(relayUrls, f, { onEose: () => resolve() });
    setTimeout(() => resolve(), 4000);
    setTimeout(() => h.close(), 10000);
  });
  store.notify();
}

// tiny snapshot helper to avoid hook rules in loadOlder
function useAppSnapshot() {
  return { relayUrls: JSON.parse(localStorage.getItem("tb.relays") ?? "null")?.filter((r: any) => r.read).map((r: any) => r.url) ?? [] };
}

/** Reactions (kind 7) count per event id. */
export function reactionCounts(eventId: string): { total: number; mine: boolean } {
  let total = 0;
  let mine = false;
  for (const ev of store.events.values()) {
    if (ev.kind !== 7) continue;
    const eTag = ev.tags.find((t) => t[0] === "e" && t[1] === eventId);
    if (!eTag) continue;
    total++;
    if (ev.content === "+" || ev.content === "👍") mine = mine || Boolean(mePubkey() === ev.pubkey);
  }
  return { total, mine };
}

function mePubkey(): string | null {
  try {
    const acc = JSON.parse(localStorage.getItem("tb.account") ?? "null");
    return acc?.pubkey ?? null;
  } catch {
    return null;
  }
}

/** Reposts (kind 6) of an event. */
export function repostCount(eventId: string): number {
  let n = 0;
  for (const ev of store.events.values()) {
    if (ev.kind !== 6) continue;
    const t = ev.tags.find((x) => x[0] === "e" && x[1] === eventId);
    if (t || ev.content === eventId) n++;
  }
  return n;
}

/** Reply count for an event (kind 1 referencing it via e tag). */
export function replyCount(eventId: string): number {
  let n = 0;
  for (const ev of store.events.values()) {
    if (ev.kind !== 1) continue;
    const tags = ev.tags.filter((t) => t[0] === "e").map((t) => t[1]);
    if (tags.includes(eventId)) n++;
  }
  return n;
}

/** Zap receipts (kind 9735) for an event. */
export function zapTotal(eventId: string): number {
  let msat = 0;
  for (const ev of store.events.values()) {
    if (ev.kind !== 9735) continue;
    const t = ev.tags.find((x) => x[0] === "e" && x[1] === eventId);
    if (!t) continue;
    const bolt = ev.tags.find((x) => x[0] === "bolt11")?.[1] ?? "";
    const m = bolt.match(/amount=(\d+)/);
    if (m) msat += parseInt(m[1], 10);
  }
  return msat;
}
