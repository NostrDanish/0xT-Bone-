import { useState } from "react";
import { Bone, KeyRound, Wallet, Sparkles, ShieldCheck } from "lucide-react";
import { useApp } from "../lib/store";

export default function Login() {
  const { loginNip07, loginNsec, createAccount } = useApp();
  const [tab, setTab] = useState<"extension" | "key" | "new">("extension");
  const [keyInput, setKeyInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(fn: () => Promise<void> | void) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
    setBusy(false);
  }

  return (
    <div className="min-h-screen bg-app text-fg flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Bone size={56} className="accent-text mx-auto" />
          <h1 className="text-3xl font-bold mt-3">T-Bone</h1>
          <p className="text-dim mt-1">Privacy-focused Nostr for web &amp; desktop</p>
          <p className="text-xs text-dim mt-2 flex items-center justify-center gap-1">
            <ShieldCheck size={13} /> No tracking · No analytics · Keys stay local
          </p>
        </div>

        <div className="card p-6">
          <div className="flex gap-1 bg-surface-2 p-1 rounded-card mb-5">
            {(
              [
                ["extension", "Extension", Wallet],
                ["key", "Use nsec", KeyRound],
                ["new", "New account", Sparkles],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm btn ${
                  tab === id ? "accent-bg font-semibold" : "text-dim"
                }`}
                style={tab === id ? { color: "var(--accent-contrast)" } : undefined}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>

          {tab === "extension" && (
            <div className="space-y-3">
              <p className="text-sm text-dim">
                Log in with a browser Nostr extension (NIP-07) — your key never touches this app.
              </p>
              <button onClick={() => run(loginNip07)} disabled={busy} className="accent-btn w-full py-3">
                {busy ? "Connecting…" : "Connect extension"}
              </button>
              <p className="text-xs text-dim">Works with Alby, nos2x, Aka-Profiles and friends.</p>
            </div>
          )}

          {tab === "key" && (
            <div className="space-y-3">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="nsec1… or 64-char hex secret key"
                className="w-full bg-surface-2 border border-line rounded-card px-3 py-3"
              />
              <button
                onClick={() => run(() => loginNsec(keyInput))}
                disabled={busy || !keyInput.trim()}
                className="accent-btn w-full py-3 disabled:opacity-50"
              >
                {busy ? "Signing in…" : "Sign in"}
              </button>
              <p className="text-xs text-dim">
                The key is stored locally in this browser only (no server). This build of T-Bone Web is a
                demo-grade vault — for high-value keys prefer a NIP-07 extension or hardware signer.
              </p>
            </div>
          )}

          {tab === "new" && (
            <div className="space-y-3">
              <p className="text-sm text-dim">
                Generate a fresh identity. The secret key is generated and kept in this browser — back it
                up from Settings after logging in.
              </p>
              <button onClick={() => run(() => createAccount())} disabled={busy} className="accent-btn w-full py-3">
                {busy ? "Generating…" : "Create account"}
              </button>
            </div>
          )}

          {err && <p className="text-red-400 text-sm mt-3">{err}</p>}
        </div>

        <p className="text-center text-xs text-dim mt-6">
          Vibed with <a href="https://shakespeare.diy" className="accent-text" target="_blank" rel="noreferrer">Shakespeare</a>
        </p>
      </div>
    </div>
  );
}
