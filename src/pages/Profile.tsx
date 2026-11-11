import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, UserPlus, UserMinus, Zap } from "lucide-react";
import type { Filter } from "nostr-tools";
import { nip19 } from "nostr-tools";
import { useApp, useStoreTick } from "../lib/store";
import { store, sub, displayName, avatarUrl, fallbackAvatar, shortNpub, encodeNpub } from "../lib/nostr";
import { useFeed, zapTotal } from "../lib/feed";
import NoteCard, { Avatar } from "../components/NoteCard";
import { sendZap } from "../lib/zap";

function decodePubkey(input: string): string {
  if (/^[0-9a-f]{64}$/.test(input)) return input;
  try {
    const d = nip19.decode(input);
    if (d.type === "npub") return d.data as string;
    if (d.type === "nprofile") return (d.data as any).pubkey;
  } catch { /* noop */ }
  return input;
}

export default function Profile() {
  const { npub } = useParams();
  const pk = decodePubkey(npub ?? "");
  const { relayUrls, isFollowing, toggleFollow, signer, settings } = useApp();
  useStoreTick();
  const [zapMsg, setZapMsg] = useState<string | null>(null);

  // fetch profile + notes
  useEffect(() => {
    if (!pk || relayUrls.length === 0) return;
    const h = sub(relayUrls, [{ kinds: [0], authors: [pk], limit: 1 }]);
    return () => h.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pk, relayUrls.join(",")]);

  const filters: Filter[] = useMemo(
    () => (pk ? [{ kinds: [1, 6], authors: [pk], limit: 50 }] : []),
    [pk],
  );
  const notes = useFeed(filters);

  const profile = store.profiles.get(pk);
  const totalZaps = useMemo(() => notes.reduce((acc, n) => acc + zapTotal(n.id), 0), [notes]);
  const isMe = signer?.pubkey === pk;

  async function zapProfile() {
    if (!signer) return;
    setZapMsg("Sending zap…");
    try {
      const res = await sendZap(signer, pk, undefined, 21000, relayUrls(), settings.nwcUri);
      setZapMsg(res.paid ? "Zap sent ⚡" : res.invoice ? "Invoice ready — opening wallet…" : "No invoice");
      if (res.invoice && !res.paid) window.open(`lightning:${res.invoice}`, "_blank");
    } catch (e: any) {
      setZapMsg(e?.message ?? "Zap failed");
    }
    setTimeout(() => setZapMsg(null), 4000);
  }

  return (
    <div>
      {/* banner */}
      <div
        className="h-40 bg-surface-2 bg-cover bg-center relative max-md:h-28"
        style={profile?.banner ? { backgroundImage: `url(${profile.banner})` } : undefined}
      >
        <div className="absolute top-3 left-3">
          <Link to="/" className="flex items-center gap-2 bg-surface/80 backdrop-blur px-3 py-1.5 rounded-card text-sm">
            <ArrowLeft size={16} /> Back
          </Link>
        </div>
      </div>

      <div className="px-4 max-md:px-3">
        <div className="flex items-end gap-4 -mt-10 mb-4">
          <div className="rounded-full border-4" style={{ borderColor: "var(--bg)", background: "var(--bg)" }}>
            <img
              src={avatarUrl(pk) ?? fallbackAvatar(pk)}
              className="w-24 h-24 rounded-full object-cover max-md:w-16 max-md:h-16"
              alt=""
            />
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <h1 className="text-xl font-bold truncate">{profile?.display_name || profile?.name || shortNpub(pk)}</h1>
            <div className="text-sm text-dim truncate">
              {profile?.name && profile.name !== (profile.display_name ?? profile.name) ? `@${profile.name} · ` : ""}
              <a
                href={`https://njump.me/${encodeNpub(pk)}`}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
              >
                {shortNpub(pk)}
              </a>
              {profile?.nip05 && <span className="ml-2 accent-text">✓ {profile.nip05}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 pb-1">
            {!isMe && (
              <>
                <button
                  onClick={() => toggleFollow(pk).catch(() => {})}
                  className={`px-4 py-2 text-sm font-semibold rounded-card flex items-center gap-1.5 ${
                    isFollowing(pk) ? "bg-surface-2 text-fg border border-line" : "accent-btn"
                  }`}
                >
                  {isFollowing(pk) ? <UserMinus size={15} /> : <UserPlus size={15} />}
                  {isFollowing(pk) ? "Unfollow" : "Follow"}
                </button>
                <button onClick={zapProfile} className="accent-text btn px-3 py-2 flex items-center gap-1" title="Zap 21 sats">
                  <Zap size={17} />
                </button>
              </>
            )}
          </div>
        </div>

        {zapMsg && <div className="text-sm accent-text mb-3">{zapMsg}</div>}

        {profile?.about && <p className="whitespace-pre-wrap text-sm mb-4">{profile.about}</p>}

        <div className="flex gap-4 text-sm text-dim mb-4">
          <span><b className="text-fg">{notes.length}</b> notes</span>
          {totalZaps > 0 && <span><b className="text-fg">{Math.round(totalZaps / 1000)}</b> sats zapped</span>}
          {profile?.website && (
            <a href={profile.website} target="_blank" rel="noreferrer" className="accent-text">{profile.website}</a>
          )}
        </div>
      </div>

      <div className="px-4 max-md:px-3 pb-6">
        {notes.map((n) => (
          <NoteCard key={n.id} event={n} />
        ))}
        {notes.length === 0 && <div className="text-center text-dim py-16 animate-pulse">Loading notes…</div>}
      </div>
    </div>
  );
}
