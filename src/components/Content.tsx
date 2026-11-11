import React, { useState } from "react";
import type { Event as NostrEvent } from "nostr-tools";
import { nip19 } from "nostr-tools";
import { store, displayName } from "../lib/nostr";

/** Render note content: links, images, video, hashtags, mentions, nostr: entities. */

const URL_RE = /(https?:\/\/[^\s<>"]+)/g;
const HASHTAG_RE = /#([\p{L}\p{N}_]+)/u;
const NOSTR_RE = /nostr:(npub1|note1|nprofile1|nevent1|naddr1)([023456789acdefghjklmnpqrstuvwxyz]+)/i;

type Token =
  | { type: "text"; value: string }
  | { type: "url"; value: string }
  | { type: "hashtag"; value: string }
  | { type: "nostr"; value: string }
  | { type: "mention"; value: string };

function tokenize(content: string): Token[] {
  const tokens: Token[] = [];
  let rest = content;
  const combined = /(\bhttps?:\/\/[^\s<>"]+)|(nostr:(?:npub1|note1|nprofile1|nevent1|naddr1)[023456789acdefghjklmnpqrstuvwxyz]+)/i;
  while (rest.length) {
    const m = combined.exec(rest);
    if (!m) {
      tokens.push({ type: "text", value: rest });
      break;
    }
    if (m.index > 0) tokens.push({ type: "text", value: rest.slice(0, m.index) });
    const raw = m[0];
    if (raw.startsWith("http")) tokens.push({ type: "url", value: raw });
    else tokens.push({ type: "nostr", value: raw });
    rest = rest.slice(m.index + raw.length);
  }
  return tokens;
}

function NostrEntity({ value }: { value: string }) {
  try {
    const decoded = nip19.decode(value.slice("nostr:".length));
    if (decoded.type === "npub" || decoded.type === "nprofile") {
      const pk = (decoded.data as any).pubkey ?? (decoded.data as string);
      return <span className="accent-text">{"@" + displayName(pk)}</span>;
    }
    if (decoded.type === "note" || decoded.type === "nevent") {
      const id = (decoded.data as any).id ?? (decoded.data as string);
      const ev = store.get(id);
      if (ev) {
        return <span className="accent-text">{"→ " + displayName(ev.pubkey)}</span>;
      }
      return <span className="accent-text opacity-80">[quoted note]</span>;
    }
  } catch { /* fallthrough */ }
  return <span className="accent-text opacity-70">{value}</span>;
}

function Media({ url }: { url: string }) {
  const isImg = /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|$)/i.test(url) || url.includes("/picture/") || (url.includes("imgur.com") && !url.includes("/a/"));
  const isVid = /\.(mp4|webm|mov)(\?|$)/i.test(url);
  if (isVid) {
    return (
      <video src={url} controls preload="metadata" className="mt-2 rounded-card max-h-96 w-auto" />
    );
  }
  if (isImg || url.includes("nostr.build") || url.includes("blossom") || url.includes("void.cat") || url.includes("primal.net")) {
    return <NoteImage url={url} />;
  }
  return null;
}

function NoteImage({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <img
        src={url}
        alt=""
        loading="lazy"
        onClick={() => setOpen(true)}
        className="mt-2 rounded-card max-h-96 object-cover cursor-zoom-in"
        onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
      />
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setOpen(false)}
        >
          <img src={url} className="max-w-full max-h-full object-contain" alt="" />
        </div>
      )}
    </>
  );
}

export default function Content({ event, className = "" }: { event: NostrEvent; className?: string }) {
  const tokens = tokenize(event.content);
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === "text") {
      // split text into hashtags & plain text
      const parts = t.value.split(/(#[\p{L}\p{N}_]+)/u);
      for (const part of parts) {
        if (!part) continue;
        if (part.startsWith("#") && HASHTAG_RE.test(part)) {
          nodes.push(
            <a key={`h-${nodes.length}`} href={`/tag/${part.slice(1)}`} className="accent-text">
              {part}
            </a>,
          );
        } else {
          nodes.push(<span key={`t-${nodes.length}`}>{part}</span>);
        }
      }
    } else if (t.type === "url") {
      nodes.push(<Media key={`m-${i}`} url={t.value} />);
      const shown = t.value.replace(/^https?:\/\//, "").replace(/[?#].*$/, "");
      nodes.push(
        <div key={`l-${i}`}>
          <a href={t.value} target="_blank" rel="noreferrer" className="accent-text break-all">
            {shown.length > 60 ? shown.slice(0, 60) + "…" : shown}
          </a>
        </div>,
      );
    } else if (t.type === "nostr") {
      nodes.push(<NostrEntity key={`n-${i}`} value={t.value} />);
    }
  }

  return <div className={`whitespace-pre-wrap break-words leading-relaxed ${className}`}>{nodes}</div>;
}
