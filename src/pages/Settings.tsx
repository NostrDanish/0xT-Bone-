import { useState } from "react";
import { KeyRound, Copy, Download, Wallet, Palette, Type } from "lucide-react";
import { useApp, ACCENTS, type AppSettings } from "../lib/store";
import { encodeNpub, bytesToHex } from "../lib/nostr";
import { parseNwcUri, nwcGetBalance, formatSats } from "../lib/nwc";

export default function Settings() {
  const { signer, settings, updateSettings, logout } = useApp();
  const [skShown, setSkShown] = useState<string | null>(null);
  const [nwcInput, setNwcInput] = useState(settings.nwcUri);
  const [nwcMsg, setNwcMsg] = useState<string | null>(null);

  const acc = JSON.parse(localStorage.getItem("tb.account") ?? "null");

  async function showKey() {
    if (acc?.skHex) setSkShown(bytesToHex(new Uint8Array(acc.skHex.match(/.{2}/g).map((h: string) => parseInt(h, 16)))));
    else setSkShown("Managed by your NIP-07 extension — export it from the extension itself.");
  }

  function exportData() {
    const data: Record<string, string | null> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith("tb.")) data[k] = localStorage.getItem(k);
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "t-bone-backup.json";
    a.click();
  }

  async function checkNwc() {
    const info = parseNwcUri(nwcInput);
    if (!info) {
      setNwcMsg("Invalid NWC URI");
      return;
    }
    setNwcMsg("Checking wallet…");
    const bal = await nwcGetBalance(info);
    setNwcMsg(bal != null ? `Connected — balance ${formatSats(bal)}` : "Wallet did not respond (check relay/secret)");
  }

  function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    updateSettings({ [key]: value });
  }

  return (
    <div className="p-4 max-md:p-3 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Appearance */}
      <section className="card p-5 mb-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Palette size={17} className="accent-text" /> Appearance</h2>

        <label className="text-sm text-dim block mb-2">Theme</label>
        <div className="flex gap-2 mb-4">
          {(["dark", "light", "cream"] as const).map((t) => (
            <button
              key={t}
              onClick={() => set("theme", t)}
              className={`px-4 py-2 text-sm capitalize btn border border-line ${settings.theme === t ? "accent-bg font-semibold" : "bg-surface-2 text-dim"}`}
              style={settings.theme === t ? { color: "var(--accent-contrast)" } : undefined}
            >
              {t}
            </button>
          ))}
          <label className="flex items-center gap-2 text-sm text-dim ml-2 cursor-pointer">
            <input type="checkbox" checked={settings.autoTheme} onChange={(e) => set("autoTheme", e.target.checked)} />
            auto (follow system)
          </label>
        </div>

        <label className="text-sm text-dim block mb-2">Accent</label>
        <div className="flex gap-2 mb-4 flex-wrap">
          {ACCENTS.map((a) => (
            <button
              key={a.value}
              onClick={() => set("accent", a.value)}
              className={`w-8 h-8 rounded-full border-2 ${settings.accent === a.value ? "border-fg" : "border-transparent"}`}
              style={{ background: a.value, borderColor: settings.accent === a.value ? "var(--fg)" : undefined }}
              title={a.name}
            />
          ))}
        </div>

        <label className="text-sm text-dim block mb-2">Corner radius: {settings.radius}px</label>
        <input
          type="range"
          min={0}
          max={28}
          value={settings.radius}
          onChange={(e) => set("radius", Number(e.target.value))}
          className="w-full mb-4 accent-[var(--accent)]"
        />

        <label className="text-sm text-dim block mb-2">Text size: {Math.round(settings.textScale * 100)}%</label>
        <input
          type="range"
          min={85}
          max={130}
          value={Math.round(settings.textScale * 100)}
          onChange={(e) => set("textScale", Number(e.target.value) / 100)}
          className="w-full mb-4 accent-[var(--accent)]"
        />

        <label className="text-sm text-dim block mb-2">Font</label>
        <div className="flex gap-2">
          {(
            [
              ["system", "Standard sans"],
              ["nunito", "Nunito Sans"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => set("font", v)}
              className={`px-4 py-2 text-sm btn border border-line ${settings.font === v ? "accent-bg font-semibold" : "bg-surface-2 text-dim"}`}
              style={settings.font === v ? { color: "var(--accent-contrast)" } : undefined}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Lightning / NWC */}
      <section className="card p-5 mb-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Wallet size={17} className="accent-text" /> Lightning (NIP-47 Wallet Connect)</h2>
        <input
          value={nwcInput}
          onChange={(e) => setNwcInput(e.target.value)}
          placeholder="nostr+walletconnect://…"
          className="w-full bg-surface-2 border border-line rounded-card px-3 py-2.5 font-mono text-xs mb-3"
        />
        <div className="flex gap-2 items-center">
          <button
            onClick={() => {
              updateSettings({ nwcUri: nwcInput.trim() });
              setNwcMsg("Saved");
            }}
            className="accent-btn px-4 py-2 text-sm"
          >
            Save
          </button>
          <button onClick={checkNwc} className="btn px-4 py-2 text-sm text-dim">
            Test connection
          </button>
          {nwcMsg && <span className="text-sm text-dim">{nwcMsg}</span>}
        </div>
        <p className="text-xs text-dim mt-3">
          With NWC connected, zaps are paid in-app via NIP-47. Without it, the invoice is handed to your
          system wallet handler.
        </p>
      </section>

      {/* Account */}
      <section className="card p-5 mb-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><KeyRound size={17} className="accent-text" /> Account</h2>
        <div className="text-sm text-dim mb-3">
          Logged in as <span className="font-mono text-fg">{signer?.pubkey.slice(0, 16)}…</span> ({signer?.kind === "nip07" ? "NIP-07 extension" : "local key"})
        </div>
        <div className="text-xs text-dim mb-4 font-mono break-all">npub: {encodeNpub(signer?.pubkey ?? "")}</div>

        <div className="flex gap-2 flex-wrap">
          {signer?.kind === "local" && (
            <button onClick={showKey} className="btn px-4 py-2 text-sm border border-line flex items-center gap-1.5">
              <Copy size={14} /> {skShown ? "Hide" : "Reveal secret key"}
            </button>
          )}
          <button onClick={exportData} className="btn px-4 py-2 text-sm border border-line flex items-center gap-1.5">
            <Download size={14} /> Export backup
          </button>
          <button onClick={logout} className="btn px-4 py-2 text-sm border border-line text-red-400">
            Log out
          </button>
        </div>
        {skShown && (
          <textarea
            readOnly
            value={skShown}
            className="w-full mt-3 bg-surface-2 border border-line rounded-card p-3 font-mono text-xs h-20"
            onFocus={(e) => e.currentTarget.select()}
          />
        )}
        <p className="text-xs text-dim mt-3">
          <Type size={11} className="inline mr-1" />
          Backup includes settings, relay list and the encrypted toolbox vault (if unlocked once this session).
        </p>
      </section>

      <p className="text-center text-xs text-dim pb-6">
        T-Bone Web · MIT · Privacy-first: all state lives in this browser. Vibed with{" "}
        <a href="https://shakespeare.diy" target="_blank" rel="noreferrer" className="accent-text">Shakespeare</a>
      </p>
    </div>
  );
}
