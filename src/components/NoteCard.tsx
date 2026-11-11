import { Link, useNavigate } from "react-router-dom";
import { Heart, Repeat2, MessageCircle, Zap, Quote, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Event as NostrEvent } from "nostr-tools";
import { store, displayName, avatarUrl, fallbackAvatar, parseRefs, timeAgo, publish } from "../lib/nostr";
import { useApp, useStoreTick } from "../lib/store";
import { reactionCounts, repostCount, replyCount, zapTotal } from "../lib/feed";
import Content from "./Content";
import Composer from "./Composer";
import { sendZap } from "../lib/zap";

export function Avatar({ pubkey, size = 44 }: { pubkey: string; size?: number }) {
  useStoreTick();
  const url = avatarUrl(pubkey) ?? fallbackAvatar(pubkey);
  return (
    <img
      src={url}
      width={size}
      height={size}
      className="rounded-full object-cover shrink-0"
      style={{ width: size, height: size }}
      alt=""
      loading="lazy"
    />
  );
}

export function ProfileLink({ pubkey, children, className = "" }: { pubkey: string; children?: React.ReactNode; className?: string }) {
  return (
    <Link to={`/p/${pubkey}`} className={`hover:underline font-medium ${className}`}>
      {children ?? displayName(pubkey)}
    </Link>
  );
}

export default function NoteCard({ event, embedded = false }: { event: NostrEvent; embedded?: boolean }) {
  const { signer, signAndPublish, settings, relayUrls, isFollowing, toggleFollow } = useApp();
  useStoreTick();
  const navigate = useNavigate();
  const [replying, setReplying] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [zapMsg, setZapMsg] = useState<string | null>(null);
  const [boosted, setBoosted] = useState(false);
  const [liked, setLiked] = useState(false);

  const refs = parseRefs(event);
  const reactions = reactionCounts(event.id);
  const boosts = repostCount(event.id);
  const replies = replyCount(event.id);
  const zaps = zapTotal(event.id);

  if (event.kind === 6) {
    // repost: render inner event if we have it
    const innerId = event.tags.find((t) => t[0] === "e")?.[1];
    const inner = innerId ? store.get(innerId) : undefined;
    return (
      <div className="card p-4 mb-3 fade-in">
        <div className="flex items-center gap-2 text-dim text-sm mb-2">
          <Repeat2 size={14} />
          <ProfileLink pubkey={event.pubkey} /> boosted
          <span className="ml-auto">{timeAgo(event.created_at)}</span>
        </div>
        {inner ? (
          <NoteCard event={inner} embedded />
        ) : (
          <button className="accent-text text-sm" onClick={() => navigate(`/thread/${event.id}`)}>
            View repost…
          </button>
        )}
      </div>
    );
  }

  const reacted = reactions.mine || liked;

  async function react() {
    setLiked(true);
    try {
      await signAndPublish(7, "+", [["e", event.id], ["p", event.pubkey]]);
    } catch (e) {
      console.error(e);
    }
  }

  async function repost() {
    setBoosted(true);
    try {
      await signAndPublish(6, JSON.stringify(event), [
        ["e", event.id],
        ["p", event.pubkey],
      ]);
    } catch (e) {
      console.error(e);
    }
  }

  async function zap(amountMsat: number) {
    if (!signer) return;
    setZapMsg("Sending zap…");
    try {
      const res = await sendZap(
        signer,
        event.pubkey,
        event.id,
        amountMsat,
        relayUrls(),
        settings.nwcUri,
      );
      if (res.paid) {
        setZapMsg("Zap sent ⚡");
      } else if (res.invoice) {
        setZapMsg("Invoice ready — opening wallet…");
        window.open(`lightning:${res.invoice}`, "_blank");
      } else {
        setZapMsg("Could not create invoice");
      }
    } catch (e: any) {
      setZapMsg(e?.message ?? "Zap failed");
    }
    setTimeout(() => setZapMsg(null), 4000);
  }

  return (
    <article className={`card p-4 fade-in ${embedded ? "" : "mb-3"}`}>
      {/* repost/quote context header handled by caller */}
      <div className="flex gap-3">
        <Link to={`/p/${event.pubkey}`}>
          <Avatar pubkey={event.pubkey} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 text-sm">
            <ProfileLink pubkey={event.pubkey} className="truncate" />
            {!isFollowing(event.pubkey) && event.pubkey !== signer?.pubkey && (
              <button
                className="text-xs accent-text hover:underline shrink-0"
                onClick={() => toggleFollow(event.pubkey).catch(() => {})}
              >
                follow
              </button>
            )}
            <span className="text-dim ml-auto shrink-0">
              <Link to={`/thread/${event.id}`} className="hover:underline">
                {timeAgo(event.created_at)}
              </Link>
            </span>
          </div>

          <button className="text-left w-full" onClick={() => navigate(`/thread/${event.id}`)}>
            <Content event={event} className="mt-1" />
          </button>

          {/* quoted notes */}
          {refs.quoteIds.map((qid) => {
            const q = store.get(qid);
            return q ? (
              <div key={qid} className="mt-2 border border-line rounded-card p-3 bg-surface-2">
                <div className="flex items-center gap-2 text-xs text-dim mb-1">
                  <Avatar pubkey={q.pubkey} size={18} />
                  <ProfileLink pubkey={q.pubkey} />
                </div>
                <Content event={q} className="text-sm" />
              </div>
            ) : null;
          })}

          {/* action bar */}
          <div className="flex items-center gap-5 mt-3 text-dim text-sm relative">
            <button className="flex items-center gap-1.5 btn px-2 py-1" onClick={() => setReplying(true)}>
              <MessageCircle size={16} /> {replies > 0 ? replies : ""}
            </button>
            <button className={`flex items-center gap-1.5 btn px-2 py-1 ${boosted ? "accent-text" : ""}`} onClick={repost} title="Repost">
              <Repeat2 size={16} /> {boosts > 0 ? boosts : ""}
            </button>
            <button
              className={`flex items-center gap-1.5 btn px-2 py-1 ${reacted ? "accent-text" : ""}`}
              onClick={react}
              title="Like"
            >
              <Heart size={16} /> {reactions.total > 0 ? reactions.total : ""}
            </button>
            <button className="flex items-center gap-1.5 btn px-2 py-1 accent-text" onClick={() => zap(21000)} title="Zap 21 sats">
              <Zap size={16} /> {zaps > 0 ? Math.round(zaps / 1000) : ""}
            </button>
            <button className="btn px-2 py-1" onClick={() => setQuoting(true)} title="Quote">
              <Quote size={15} />
            </button>
            {event.pubkey === signer?.pubkey && (
              <button
                className="btn px-2 py-1 ml-auto"
                title="Delete (NIP-09 best effort)"
                onClick={async () => {
                  try {
                    await signAndPublish(5, "", [["e", event.id]]);
                    // request deletion via kind 5; local removal
                    store.events.delete(event.id);
                    store.notify();
                  } catch { /* noop */ }
                }}
              >
                <Trash2 size={15} />
              </button>
            )}
            {zapMsg && <span className="absolute -top-6 right-0 text-xs accent-text">{zapMsg}</span>}
          </div>

          {/* inline zap amount chooser */}
          {zapMsg === "Sending zap…" && null}
        </div>
      </div>

      {replying && (
        <Composer
          onClose={() => setReplying(false)}
          replyTo={event}
        />
      )}
      {quoting && <Composer onClose={() => setQuoting(false)} quote={event} />}
    </article>
  );
}
