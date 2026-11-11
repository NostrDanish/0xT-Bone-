import { useMemo, useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import type { Filter } from "nostr-tools";
import { useApp, useStoreTick } from "../lib/store";
import { store, sub, displayName, avatarUrl, fallbackAvatar } from "../lib/nostr";
import { useFeed } from "../lib/feed";
import NoteCard from "../components/NoteCard";
import { useEffect } from "react";
import { Link } from "react-router-dom";

export default function Search() {
  const { relayUrls } = useApp();
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");

  useStoreTick();

  const isNpub = /^npub1|^nprofile1|^note1|^nevent1/.test(submitted.trim());
  const isHashtag = submitted.startsWith("#") || (submitted.length > 1 && !submitted.includes(" "));

  // profile search (NIP-50 where supported) + local cache matches
  useEffect(() => {
    if (!submitted || relayUrls.length === 0) return;
    const h = sub(relayUrls, [{ kinds: [0], search: submitted, limit: 20 }]);
    return () => h.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, relayUrls.join(",")]);

  const profileMatches = useMemo(() => {
    const lower = submitted.toLowerCase().replace(/^#/, "");
    if (!lower || isNpub) return [];
    const out: { pk: string; name: string }[] = [];
    for (const [pk, p] of store.profiles.entries()) {
      const hay = `${p.name ?? ""} ${p.display_name ?? ""} ${p.nip05 ?? ""} ${p.about ?? ""}`.toLowerCase();
      if (hay.includes(lower)) out.push({ pk, name: p.display_name || p.name || "" });
    }
    return out.slice(0, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, useStoreTick()]);

  const noteFilters: Filter[] = useMemo(() => {
    if (!submitted) return [];
    const clean = submitted.replace(/^#/, "");
    if (isNpub) return [];
    return [{ kinds: [1], limit: 40, search: clean }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  const notes = useFeed(noteFilters);

  return (
    <div className="p-4 max-md:p-3">
      <h1 className="text-2xl font-bold mb-4">Search</h1>

      <div className="relative mb-5">
        <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setSubmitted(q.trim())}
          placeholder="Search notes, people, #hashtags, npub…"
          className="w-full bg-surface-2 border border-line rounded-card pl-10 pr-3 py-3"
          autoFocus
        />
      </div>

      {!submitted && (
        <p className="text-dim text-sm">
          Try a hashtag like <b>#nostr</b>, a name, or paste an npub to jump straight to a profile.
          Relay-side NIP-50 search is used when available, with local cache matching as fallback.
        </p>
      )}

      {isNpub && (
        <div className="mt-4">
          <Link to={`/p/${submitted.trim()}`} className="accent-text">
            Open profile {submitted.trim().slice(0, 20)}…
          </Link>
        </div>
      )}

      {profileMatches.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-dim uppercase tracking-wide mt-6 mb-2">People</h2>
          <div className="card divide-y divide-[var(--border)] mb-4">
            {profileMatches.map(({ pk }) => (
              <Link key={pk} to={`/p/${pk}`} className="flex items-center gap-3 p-3 hover:bg-surface-2">
                <img src={avatarUrl(pk) ?? fallbackAvatar(pk)} className="w-10 h-10 rounded-full object-cover" alt="" />
                <div className="min-w-0">
                  <div className="font-medium truncate">{displayName(pk)}</div>
                  <div className="text-xs text-dim truncate">{store.profiles.get(pk)?.nip05 ?? pk.slice(0, 16) + "…"}</div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {submitted && !isNpub && (
        <>
          <h2 className="text-sm font-semibold text-dim uppercase tracking-wide mt-6 mb-2">Notes</h2>
          {notes.map((n) => (
            <NoteCard key={n.id} event={n} />
          ))}
          {notes.length === 0 && <div className="text-center text-dim py-10">No matching notes cached yet…</div>}
        </>
      )}
    </div>
  );
}
