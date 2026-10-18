import { useEffect, useState } from "react";
import { Plus, Trash2, CircleCheck, CircleX } from "lucide-react";
import { useApp, useStoreTick } from "../lib/store";
import type { RelayInfo } from "../lib/store";
import type { RelayStatus } from "../lib/nostr";

export default function Relays() {
  const { relays, setRelays, signer, signAndPublish } = useApp();
  useStoreTick();
  const [input, setInput] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, RelayStatus>>({});

  // Live status probes (independent WebSocket checks)
  useEffect(() => {
    let cancelled = false;
    const sockets: WebSocket[] = [];
    for (const r of relays) {
      try {
        const ws = new WebSocket(r.url);
        sockets.push(ws);
        ws.onopen = () => !cancelled && setStatuses((s) => ({ ...s, [r.url]: "open" }));
        ws.onerror = () => !cancelled && setStatuses((s) => ({ ...s, [r.url]: "error" }));
        ws.onclose = () => !cancelled && setStatuses((s) => (s[r.url] === "open" ? s : { ...s, [r.url]: "closed" }));
        setTimeout(() => ws.readyState === 0 && ws.close(), 8000);
      } catch {
        setStatuses((s) => ({ ...s, [r.url]: "error" }));
      }
    }
    return () => {
      cancelled = true;
      sockets.forEach((ws) => ws.close());
    };
  }, [relays.map((r) => r.url).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  function add() {
    let url = input.trim();
    if (!url) return;
    if (!url.startsWith("wss://") && !url.startsWith("ws://")) url = `wss://${url}`;
    try {
      new URL(url);
    } catch {
      setErr("Invalid relay URL");
      return;
    }
    if (relays.some((r) => r.url === url)) {
      setErr("Already added");
      return;
    }
    setErr(null);
    setRelays([...relays, { url, read: true, write: true }]);
    setInput("");
  }

  async function saveToRelayList() {
    try {
      await signAndPublish(
        10002,
        "",
        relays.map((r) => ["r", r.url, r.read && r.write ? "" : r.read ? "read" : "write"]),
      );
      setErr(null);
      alert("Relay list published (NIP-65)");
    } catch (e: any) {
      setErr(e?.message ?? "Publish failed");
    }
  }

  const statusIcon = (s?: RelayStatus) =>
    s === "open" ? (
      <CircleCheck size={16} className="text-green-500" />
    ) : s === "error" ? (
      <CircleX size={16} className="text-red-400" />
    ) : (
      <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
    );

  return (
    <div className="p-4 max-md:p-3">
      <h1 className="text-2xl font-bold mb-1">Relays</h1>
      <p className="text-dim text-sm mb-4">
        {relays.length} configured — read relays feed your timelines, write relays receive your publishes.
        {signer && " Publishing your list updates your NIP-65 relay metadata."}
      </p>

      <div className="flex gap-2 mb-5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="wss://relay.example.com"
          className="flex-1 bg-surface-2 border border-line rounded-card px-3 py-2.5"
        />
        <button onClick={add} className="accent-btn px-4 flex items-center gap-1.5">
          <Plus size={16} /> Add
        </button>
      </div>
      {err && <p className="text-red-400 text-sm mb-3">{err}</p>}

      <div className="card divide-y divide-[var(--border)]">
        {relays.map((r: RelayInfo) => (
          <div key={r.url} className="flex items-center gap-3 p-3">
            {statusIcon(statuses[r.url])}
            <span className="font-mono text-sm flex-1 min-w-0 truncate">{r.url}</span>

            <label className="flex items-center gap-1.5 text-xs text-dim cursor-pointer">
              <input
                type="checkbox"
                checked={r.read}
                onChange={() =>
                  setRelays(relays.map((x) => (x.url === r.url ? { ...x, read: !x.read } : x)))
                }
              />
              read
            </label>
            <label className="flex items-center gap-1.5 text-xs text-dim cursor-pointer">
              <input
                type="checkbox"
                checked={r.write}
                onChange={() =>
                  setRelays(relays.map((x) => (x.url === r.url ? { ...x, write: !x.write } : x)))
                }
              />
              write
            </label>

            <button
              className="btn p-1.5 text-dim"
              onClick={() => setRelays(relays.filter((x) => x.url !== r.url))}
              title="Remove"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      {signer && (
        <button onClick={saveToRelayList} className="accent-btn px-4 py-2 mt-4 text-sm">
          Publish relay list (NIP-65)
        </button>
      )}
    </div>
  );
}
