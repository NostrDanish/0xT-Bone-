import { useEffect, useMemo, useState } from "react";
import { Bell, Heart, Repeat2, MessageCircle, Zap } from "lucide-react";
import type { Event as NostrEvent } from "nostr-tools";
import { useApp, useStoreTick } from "../lib/store";
import { store, sub, parseRefs } from "../lib/nostr";
import { Avatar, ProfileLink } from "../components/NoteCard";
import Content from "../components/Content";
import { timeAgo } from "../lib/nostr";

type Filter2 = "all" | "mentions" | "reactions" | "zaps" | "reposts";

export default function Notifications() {
  const { signer, relayUrls } = useApp();
  useStoreTick();
  const [filter, setFilter] = useState<Filter2>("all");

  // Subscribe to everything aimed at me
  useEffect(() => {
    if (!signer || relayUrls.length === 0) return;
    const since = Math.floor(Date.now() / 1000) - 86400 * 7;
    const handles = [
      sub(relayUrls, [{ kinds: [1], "#p": [signer.pubkey], since, limit: 100 }]),
      sub(relayUrls, [{ kinds: [7], "#p": [signer.pubkey], since, limit: 200 }]),
      sub(relayUrls, [{ kinds: [6], "#p": [signer.pubkey], since, limit: 100 }]),
      sub(relayUrls, [{ kinds: [9735], "#p": [signer.pubkey], since, limit: 100 }]),
    ];
    const h = setInterval(() => {
      // clear unread badge once inbox opened
      sessionStorage.setItem("tb.unread", "0");
    }, 1500);
    return () => {
      handles.forEach((x) => x.close());
      clearInterval(h);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signer?.pubkey, relayUrls.join(",")]);

  interface Item {
    ev: NostrEvent;
    type: "mention" | "reaction" | "repost" | "zap";
    target?: NostrEvent;
  }

  const items: Item[] = useMemo(() => {
    if (!signer) return [];
    const out: Item[] = [];
    for (const ev of store.events.values()) {
      if (ev.pubkey === signer.pubkey) continue;
      const pTags = ev.tags.filter((t) => t[0] === "p").map((t) => t[1]);
      if (!pTags.includes(signer.pubkey)) continue;

      if (ev.kind === 1) {
        const refs = parseRefs(ev);
        // replies to my notes count too (they carry #p me)
        out.push({ ev, type: "mention" });
      } else if (ev.kind === 7) {
        out.push({ ev, type: "reaction" });
      } else if (ev.kind === 6) {
        out.push({ ev, type: "repost" });
      } else if (ev.kind === 9735) {
        out.push({ ev, type: "zap" });
      }
    }
    return out.sort((a, b) => b.ev.created_at - a.ev.created_at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signer?.pubkey, useStoreTick()]);

  const shown = items.filter((i) => filter === "all" || i.type === filter);

  const ICONS = {
    mention: <MessageCircle size={15} className="accent-text" />,
    reaction: <Heart size={15} className="text-red-400" />,
    repost: <Repeat2 size={15} className="text-green-400" />,
    zap: <Zap size={15} className="accent-text" />,
  };

  return (
    <div className="p-4 max-md:p-3">
      <h1 className="text-2xl font-bold mb-4">Inbox</h1>

      <div className="flex gap-1 bg-surface-2 p-1 rounded-card mb-4 overflow-x-auto">
        {(["all", "mentions", "reactions", "zaps", "reposts"] as Filter2[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm capitalize btn whitespace-nowrap ${filter === f ? "accent-bg font-semibold" : "text-dim"}`}
            style={filter === f ? { color: "var(--accent-contrast)" } : undefined}
          >
            {f}
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <div className="text-center text-dim py-16 flex flex-col items-center gap-2">
          <Bell size={32} />
          No notifications yet — they'll show up here when people interact with your notes.
        </div>
      )}

      <div className="space-y-2">
        {shown.map(({ ev, type, target }) => {
          let context: React.ReactNode = null;
          if (type === "mention") {
            const refs = parseRefs(ev);
            const parent = refs.rootId ? store.get(refs.rootId) : undefined;
            context = parent ? (
              <div className="text-xs text-dim border-l-2 border-line pl-2 line-clamp-2">
                replying to: {parent.content.slice(0, 100)}
              </div>
            ) : null;
          }

          return (
            <div key={ev.id + type} className="card p-3 flex gap-3 items-start">
              <div className="pt-1">{ICONS[type]}</div>
              <Avatar pubkey={ev.pubkey} size={36} />
              <div className="flex-1 min-w-0">
                <div className="text-sm">
                  <ProfileLink pubkey={ev.pubkey} />{" "}
                  <span className="text-dim">
                    {type === "mention" && (parseRefs(ev).replyId ? "replied" : "mentioned you")}
                    {type === "reaction" && `reacted ${ev.content}`}
                    {type === "repost" && "reposted your note"}
                    {type === "zap" && "zapped you"}
                  </span>
                  <span className="text-dim float-right">{timeAgo(ev.created_at)}</span>
                </div>
                {type === "mention" && <Content event={ev} className="text-sm mt-1" />}
                {context}
                {type === "zap" && (
                  <div className="text-xs accent-text mt-1">
                    {(() => {
                      const bolt = ev.tags.find((t) => t[0] === "bolt11")?.[1] ?? "";
                      const m = bolt.match(/amount=(\d+)/);
                      return m ? `${Math.round(parseInt(m[1], 10) / 1000).toLocaleString()} sats ⚡` : "zap";
                    })()}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
