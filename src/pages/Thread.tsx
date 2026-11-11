import { useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import type { Event as NostrEvent } from "nostr-tools";
import { nip19 } from "nostr-tools";
import { useApp, useStoreTick } from "../lib/store";
import { store, sub, parseRefs } from "../lib/nostr";
import NoteCard from "../components/NoteCard";

function decodeId(input: string): string {
  if (/^[0-9a-f]{64}$/.test(input)) return input;
  try {
    const d = nip19.decode(input);
    if (d.type === "note") return d.data as string;
    if (d.type === "nevent") return (d.data as any).id;
  } catch { /* noop */ }
  return input;
}

export default function Thread() {
  const { id: rawId } = useParams();
  const id = decodeId(rawId ?? "");
  const { relayUrls, signer } = useApp();
  useStoreTick();

  // fetch this note + its parent chain + replies
  useEffect(() => {
    if (!id || relayUrls.length === 0) return;
    const handles = [
      sub(relayUrls, [{ ids: [id] }], { onEose: () => {} }),
      sub(relayUrls, [{ kinds: [1], "#e": [id], limit: 100 }]),
    ];
    return () => handles.forEach((h) => h.close());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, relayUrls.join(",")]);

  const event = id ? store.get(id) : undefined;

  // once we have the event, fetch parents
  const refs = event ? parseRefs(event) : null;
  useEffect(() => {
    if (!refs || relayUrls.length === 0) return;
    const ids = [refs.rootId, refs.replyId].filter(Boolean) as string[];
    const missing = ids.filter((x) => !store.get(x));
    if (missing.length === 0) return;
    const h = sub(relayUrls, [{ ids: missing, kinds: [1] }]);
    return () => h.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, refs?.rootId, refs?.replyId, relayUrls.join(",")]);

  const chain = useMemo(() => {
    if (!event) return [];
    const list: NostrEvent[] = [];
    let cur = event;
    let guard = 0;
    while (guard++ < 20) {
      const r = parseRefs(cur);
      const parentId = r.replyId ?? (r.rootId !== cur.id ? r.rootId : undefined);
      if (!parentId) break;
      const parent = store.get(parentId);
      if (!parent) break;
      list.unshift(parent);
      cur = parent;
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, useStoreTick()]);

  const replies = useMemo(() => {
    if (!event) return [];
    return [...store.events.values()]
      .filter((e) => e.kind === 1 && e.tags.some((t) => t[0] === "e" && t[1] === event.id))
      .sort((a, b) => a.created_at - b.created_at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, useStoreTick()]);

  if (!event) {
    return (
      <div className="p-4">
        <Link to="/" className="flex items-center gap-2 text-dim mb-6"><ArrowLeft size={18} /> Back</Link>
        <div className="text-center text-dim py-16 animate-pulse">Loading note…</div>
      </div>
    );
  }

  return (
    <div className="p-4 max-md:p-3">
      <Link to="/" className="flex items-center gap-2 text-dim mb-4"><ArrowLeft size={18} /> Back to feed</Link>

      {chain.map((e) => (
        <div key={e.id} className="opacity-75">
          <NoteCard event={e} />
        </div>
      ))}
      <div className="border-l-2 border-line ml-6 pl-4 -my-1 mb-3" />
      <NoteCard event={event} />

      {replies.length > 0 && (
        <>
          <h2 className="font-semibold text-dim text-sm uppercase tracking-wide mt-6 mb-3">
            Replies ({replies.length})
          </h2>
          {replies.map((e) => (
            <NoteCard key={e.id} event={e} />
          ))}
        </>
      )}
    </div>
  );
}
