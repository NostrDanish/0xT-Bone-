import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { ScanLine, ClipboardPaste, Smartphone, RefreshCw, ExternalLink, CheckCircle2, Loader2 } from "lucide-react";
import {
  AMBER_RELAYS,
  awaitAmberScan,
  connectBunkerUri,
  createAmberConnectUri,
  type Nip46Signer,
} from "../lib/nip46";

interface Props {
  onLogin: (signer: Nip46Signer, pubkey: string) => void;
}

type Mode = "qr" | "paste";

export default function AmberLogin({ onLogin }: Props) {
  const [mode, setMode] = useState<Mode>("qr");
  const [session, setSession] = useState<{ uri: string; secret: string; clientSecretHex: string } | null>(null);
  const [status, setStatus] = useState<string | null>("Waiting for Amber…");
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [bunkerInput, setBunkerInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [gen, setGen] = useState(0); // bump to regenerate the QR
  const signerRef = useRef<Nip46Signer | null>(null);
  const attemptRef = useRef(0);
  const cancelScanRef = useRef<(() => void) | null>(null);

  const finish = useCallback(
    (signer: Nip46Signer) => {
      signerRef.current = signer;
      signer
        .fetchPubkey()
        .then((pk) => {
          setConnected(true);
          setStatus(null);
          // give the UI a beat to show success, then hand over
          setTimeout(() => onLogin(signer, pk), 600);
        })
        .catch((e) => {
          setError(e?.message ?? "Could not fetch pubkey from signer");
          setBusy(false);
        });
    },
    [onLogin],
  );

  /* --- QR flow ------------------------------------------------------ */
  useEffect(() => {
    if (mode !== "qr") return;
    const attempt = ++attemptRef.current;
    setConnected(false);
    setError(null);
    setAuthUrl(null);
    const s = createAmberConnectUri(AMBER_RELAYS);
    setSession(s);
    setStatus("Waiting for Amber…");

    const scan = awaitAmberScan(AMBER_RELAYS, s.clientSecretHex, s.secret, {
      onAuth: (url) => setAuthUrl(url),
      onSeen: () => setStatus("Amber responded — completing handshake…"),
      timeoutMs: 5 * 60_000,
    });
    cancelScanRef.current = scan.cancel;
    scan.promise
      .then((signer) => {
        if (attemptRef.current !== attempt) {
          signer.destroy();
          return;
        }
        finish(signer);
      })
      .catch((e) => {
        if (attemptRef.current !== attempt) return;
        setError(e?.message ?? "Connection failed");
        setStatus(null);
      });

    return () => {
      attemptRef.current++;
      cancelScanRef.current?.();
      signerRef.current?.destroy();
      signerRef.current = null;
    };
  }, [mode, gen, finish]);

  /* --- bunker:// paste flow ------------------------------------------ */
  async function connectPaste() {
    setBusy(true);
    setError(null);
    setStatus("Connecting to bunker…");
    try {
      const signer = await connectBunkerUri(bunkerInput, { onAuth: (url) => setAuthUrl(url) });
      finish(signer);
    } catch (e: any) {
      setError(e?.message ?? "Connection failed");
      setStatus(null);
    }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-surface-2 p-1 rounded-card">
        {(
          [
            ["qr", "Scan with Amber", ScanLine],
            ["paste", "Paste bunker URI", ClipboardPaste],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm btn ${
              mode === id ? "accent-bg font-semibold" : "text-dim"
            }`}
            style={mode === id ? { color: "var(--accent-contrast)" } : undefined}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {mode === "qr" && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-dim text-center">
            Scan this QR code with <b>Amber</b> on your phone (or any NIP-46 signer), then approve the
            connection. Your key never leaves your phone.
          </p>

          {session && (
            <div className="bg-white p-4 rounded-card">
              <QRCode value={session.uri} size={210} />
            </div>
          )}

          {connected ? (
            <div className="flex items-center gap-2 text-sm text-green-500">
              <CheckCircle2 size={16} /> Connected — signing you in…
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-dim">
              <Loader2 size={15} className="animate-spin" />
              {status ?? "Waiting for Amber…"}
            </div>
          )}

          <div className="w-full flex gap-2">
            <a
              href={session?.uri ?? "#"}
              className="flex-1 accent-btn py-2.5 text-sm text-center flex items-center justify-center gap-1.5"
            >
              <Smartphone size={15} /> Open with Amber
            </a>
            <button
              onClick={() => navigator.clipboard?.writeText(session?.uri ?? "")}
              className="btn px-3 py-2.5 text-sm border border-line text-dim"
              title="Copy connection link"
            >
              Copy
            </button>
            <button
              onClick={() => setGen((g) => g + 1)}
              className="btn px-3 py-2.5 text-sm border border-line text-dim"
              title="Regenerate QR"
            >
              <RefreshCw size={15} />
            </button>
          </div>

          <details className="w-full">
            <summary className="text-xs text-dim cursor-pointer">Show connection link</summary>
            <div className="mt-2 bg-surface-2 border border-line rounded-card p-2 font-mono text-[10px] break-all text-dim max-h-24 overflow-y-auto">
              {session?.uri}
            </div>
          </details>
        </div>
      )}

      {mode === "paste" && (
        <div className="space-y-3">
          <p className="text-sm text-dim">
            In Amber, open <b>Settings → Bunker</b>, copy the connection string and paste it here.
            Works with nsec.app, nsecBunker and other NIP-46 signers too.
          </p>
          <textarea
            value={bunkerInput}
            onChange={(e) => setBunkerInput(e.target.value)}
            placeholder="bunker://…"
            className="w-full bg-surface-2 border border-line rounded-card p-3 font-mono text-xs h-20 resize-none"
          />
          <button
            onClick={connectPaste}
            disabled={busy || !bunkerInput.trim()}
            className="accent-btn w-full py-3 disabled:opacity-50"
          >
            {busy ? "Connecting…" : "Connect"}
          </button>
        </div>
      )}

      {authUrl && (
        <a
          href={authUrl}
          target="_blank"
          rel="noreferrer"
          className="card p-3 text-sm flex items-center gap-2 accent-text"
        >
          <ExternalLink size={15} /> Approval required — open this link to confirm
        </a>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}
