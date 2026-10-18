import { useState } from "react";
import { X, Send, Zap } from "lucide-react";
import type { Event as NostrEvent } from "nostr-tools";
import { nip19 } from "nostr-tools";
import { useApp } from "../lib/store";
import { parseRefs, store } from "../lib/nostr";
import { Avatar } from "./NoteCard";

interface Props {
  onClose: () => void;
  replyTo?: NostrEvent;
  quote?: NostrEvent;
}

export default function Composer({ onClose, replyTo, quote }: Props) {
  const { signAndPublish } = useApp();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const charCount = text.length;
  const over = charCount > 2800;

  async function submit() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const tags: string[][] = [];
      if (replyTo) {
        const refs = parseRefs(replyTo);
        const rootId = refs.rootId ?? replyTo.id;
        if (rootId && rootId !== replyTo.id) {
          tags.push(["e", rootId, "", "root"]);
          tags.push(["e", replyTo.id, "", "reply"]);
        } else {
          tags.push(["e", replyTo.id, "", "root"]);
        }
        tags.push(["p", replyTo.pubkey]);
        for (const m of refs.mentions) if (m !== replyTo.pubkey) tags.push(["p", m]);
      }
      if (quote) {
        tags.push(["q", quote.id]);
        tags.push(["p", quote.pubkey]);
        let enc = "";
        try {
          enc = nip19.neventEncode({ id: quote.id, kind: quote.kind, author: quote.pubkey, relays: [] });
        } catch {
          enc = nip19.noteEncode(quote.id);
        }
        // include the quote reference in content per NIP-18 style
        if (!text.includes("nostr:")) {
          setText((t) => t + (t ? "\n\n" : "") + `nostr:${enc}`);
        }
      }
      // hashtag tags
      const hashtags = [...new Set([...text.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1]))];
      for (const h of hashtags) tags.push(["t", h]);

      await signAndPublish(1, text, tags);
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Publish failed");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 pt-[10vh]" onClick={onClose}>
      <div className="card w-full max-w-xl p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold">{replyTo ? "Reply" : quote ? "Quote note" : "New note"}</span>
          <button onClick={onClose} className="btn p-1.5">
            <X size={18} />
          </button>
        </div>

        {replyTo && (
          <div className="border border-line rounded-card p-3 bg-surface-2 mb-3 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <Avatar pubkey={replyTo.pubkey} size={20} />
              <span className="font-medium">{store.profiles.get(replyTo.pubkey)?.name ?? replyTo.pubkey.slice(0, 10)}</span>
            </div>
            <div className="whitespace-pre-wrap break-words text-dim line-clamp-3">{replyTo.content}</div>
          </div>
        )}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={replyTo ? "Write your reply…" : "What's on your mind? #hashtag and nostr: links supported"}
          className="w-full bg-surface-2 border border-line rounded-card p-3 min-h-32 resize-y text-fg"
          autoFocus
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
        />

        <div className="flex items-center justify-between mt-3">
          <span className={`text-xs ${over ? "text-red-400" : "text-dim"}`}>{charCount}</span>
          <div className="flex items-center gap-2">
            {err && <span className="text-xs text-red-400">{err}</span>}
            <button onClick={submit} disabled={busy || !text.trim() || over} className="accent-btn px-4 py-2 flex items-center gap-2 disabled:opacity-50">
              {busy ? <Zap size={16} className="animate-pulse" /> : <Send size={16} />}
              {busy ? "Publishing…" : "Publish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
