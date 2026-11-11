import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { Event as NostrEvent, Filter } from "nostr-tools";
import { useApp, useStoreTick } from "../lib/store";
import { store, sub } from "../lib/nostr";
import { useFeed } from "../lib/feed";
import NoteCard from "../components/NoteCard";

type Tab = "following" | "global";

export default function Home() {
  const { tag } = useParams();
  const [tab, setTab] = useState<Tab>("following");
  const { signer, follows, relayUrls } = useApp();
  useStoreTick();

  /* Maintain background subscriptions that enrich the feed:
     follows' profiles & reposts, reactions, zap receipts. */
  useEffect(() => {
    if (relayUrls.length === 0) return;
    const since = Math.floor(Date.now() / 1000) - 86400 * 3;
    const handles = [
      // profiles for anyone mentioned in recent notes (fire and forget enrichment)
      sub(relayUrls, [{ kinds: [6], since, limit: 150 }]),
      sub(relayUrls, [{ kinds: [7], since, limit: 300 }]),
      sub(relayUrls, [{ kinds: [9735], since, limit: 150 }]),
    ];
    return () => handles.forEach((h) => h.close());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relayUrls.join(",")]);

  const filters: Filter[] = useMemo(() => {
    const since = Math.floor(Date.now() / 1000) - 86400 * 3;
    const base: Filter = { kinds: [1], since, limit: 80 };
    if (tag) base["#t"] = [tag];
    else if (tab === "following") base.authors = [...follows, signer?.pubkey].filter(Boolean) as string[];
    return [base];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, JSON.stringify(follows), tag]);

  const events = useFeed(filters);
  const [limit, setLimit] = useState(25);
  const visible = events.slice(0, limit);

  /* Profile enrichment: fetch kind-0 metadata for everyone in the feed. */
  const authorsKey = useMemo(
    () => [...new Set(events.slice(0, 40).map((e) => e.pubkey))].join(","),
    [events],
  );
  useEffect(() => {
    if (!authorsKey || relayUrls.length === 0) return;
    const authors = authorsKey.split(",");
    const missing = authors.filter((a) => !store.profiles.has(a));
    if (missing.length === 0) return;
    const h = sub(relayUrls, [{ kinds: [0], authors: missing, limit: 50 }]);
    return () => h.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorsKey, relayUrls.join(",")]);

  const heading = tag ? `#${tag}` : "Feeds";

  return (
    <div className="p-4 max-md:p-3">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{heading}</h1>
        {!tag && (
          <div className="flex gap-1 bg-surface-2 p-1 rounded-card">
            {(["following", "global"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 text-sm btn capitalize ${tab === t ? "accent-bg font-semibold" : "text-dim"}`}
                style={tab === t ? { color: "var(--accent-contrast)" } : undefined}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === "following" && !tag && follows.size === 0 && (
        <div className="card p-4 mb-3 text-sm text-dim">
          Your following list is empty — switch to <b>Global</b> to discover notes, then follow people to
          build your home feed.
        </div>
      )}

      {visible.map((ev: NostrEvent) => (
        <NoteCard key={ev.id} event={ev} />
      ))}

      {visible.length === 0 && (
        <div className="text-center text-dim py-16">
          <div className="animate-pulse">Connecting to relays…</div>
        </div>
      )}

      {visible.length < events.length && (
        <button onClick={() => setLimit((l) => l + 25)} className="w-full py-3 btn text-dim text-sm mb-6">
          Load more ({events.length - visible.length} cached)
        </button>
      )}
    </div>
  );
}
