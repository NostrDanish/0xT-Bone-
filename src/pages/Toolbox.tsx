import { useEffect, useState } from "react";
import { Lock, Unlock, Plus, Trash2, Folder as FolderIcon, CheckSquare, StickyNote, ShieldCheck } from "lucide-react";
import {
  unlockVault,
  vaultExists,
  listEntries,
  saveEntry,
  deleteEntry,
  wipeVault,
  type ToolboxEntry,
} from "../lib/crypto";

export default function Toolbox() {
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [pass, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [entries, setEntries] = useState<ToolboxEntry[]>([]);
  const [folders, setFolders] = useState<string[]>(["Personal"]);
  const [folder, setFolder] = useState("Personal");
  const [editing, setEditing] = useState<ToolboxEntry | null>(null);
  const [exists] = useState(vaultExists());

  async function refresh(k: CryptoKey) {
    setEntries(await listEntries(k));
  }

  async function unlock() {
    setErr(null);
    try {
      const k = await unlockVault(pass);
      setKey(k);
      await refresh(k);
    } catch {
      setErr("Wrong passphrase");
    }
  }

  useEffect(() => {
    if (key) refresh(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const folderEntries = entries.filter((e) => e.folder === folder);

  if (!key) {
    return (
      <div className="p-4 max-md:p-3 max-w-lg">
        <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <Lock className="accent-text" size={22} /> Private Toolbox
        </h1>
        <p className="text-dim text-sm mb-6">
          Notes and checklists encrypted on this device with AES-256-GCM and a passphrase-derived key
          (PBKDF2, 210k iterations). Nothing is ever uploaded — there is no server.
        </p>

        <div className="card p-5">
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && pass && unlock()}
            placeholder={exists ? "Vault passphrase" : "Create a vault passphrase"}
            className="w-full bg-surface-2 border border-line rounded-card px-3 py-3 mb-3"
            autoFocus
          />
          <button onClick={unlock} disabled={!pass} className="accent-btn w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50">
            <Unlock size={16} /> {exists ? "Unlock" : "Create vault"}
          </button>
          {err && <p className="text-red-400 text-sm mt-3">{err}</p>}
          <p className="text-xs text-dim mt-3 flex gap-1.5">
            <ShieldCheck size={14} className="shrink-0 mt-0.5" />
            {exists
              ? "Enter the same passphrase you used when creating the vault."
              : "There's no recovery — if you forget the passphrase the data is unrecoverable. That's the point."}
          </p>
          {exists && (
            <button
              className="text-xs text-red-400 mt-4 hover:underline"
              onClick={() => {
                if (confirm("Wipe the encrypted vault? All toolbox entries will be lost.")) {
                  wipeVault();
                  location.reload();
                }
              }}
            >
              Wipe vault
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-md:p-3">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Unlock size={20} className="text-green-500" /> Toolbox
        </h1>
        <button
          onClick={async () => {
            const e = await saveEntry(key, { type: "note", folder, title: "", body: "", createdAt: Date.now(), updatedAt: Date.now() });
            setEditing(e);
            refresh(key);
          }}
          className="accent-btn px-4 py-2 flex items-center gap-1.5 text-sm"
        >
          <Plus size={16} /> New
        </button>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {folders.map((f) => (
          <button
            key={f}
            onClick={() => setFolder(f)}
            className={`px-3 py-1.5 text-sm btn pill whitespace-nowrap flex items-center gap-1.5 ${
              folder === f ? "accent-bg font-semibold" : "bg-surface-2 text-dim"
            }`}
            style={folder === f ? { color: "var(--accent-contrast)" } : undefined}
          >
            <FolderIcon size={13} /> {f}
          </button>
        ))}
        <AddFolder onAdd={(f) => setFolders((prev) => [...prev, f])} />
      </div>

      {editing ? (
        <Editor
          entry={editing}
          onSave={async (e) => {
            await saveEntry(key, e);
            setEditing(null);
            refresh(key);
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {folderEntries.map((e) => (
            <div key={e.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <button className="text-left flex-1" onClick={() => setEditing(e)}>
                  <div className="font-semibold flex items-center gap-2">
                    {e.type === "checklist" ? <CheckSquare size={15} className="accent-text" /> : <StickyNote size={15} className="accent-text" />}
                    {e.title || "Untitled"}
                  </div>
                  <div className="text-sm text-dim mt-1 line-clamp-3">
                    {e.type === "checklist"
                      ? (() => {
                          try {
                            const items = JSON.parse(e.body) as { text: string; done: boolean }[];
                            return `${items.filter((i) => i.done).length}/${items.length} done — ${items.map((i) => i.text).join(", ") || "empty"}`;
                          } catch {
                            return e.body;
                          }
                        })()
                      : e.body || "Empty note"}
                  </div>
                </button>
                <button
                  className="btn p-1.5 text-dim"
                  onClick={async () => {
                    await deleteEntry(key, e.id);
                    refresh(key);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {folderEntries.length === 0 && (
            <div className="text-dim text-sm py-10 text-center col-span-full">
              Nothing in this folder yet. Everything you add is encrypted before it touches storage.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddFolder({ onAdd }: { onAdd: (name: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  if (!adding) {
    return (
      <button onClick={() => setAdding(true)} className="px-3 py-1.5 text-sm btn pill bg-surface-2 text-dim">
        + Folder
      </button>
    );
  }
  return (
    <input
      autoFocus
      value={name}
      onChange={(e) => setName(e.target.value)}
      onBlur={() => {
        if (name.trim()) onAdd(name.trim());
        setAdding(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          if (name.trim()) onAdd(name.trim());
          setAdding(false);
        }
      }}
      placeholder="Folder name"
      className="bg-surface-2 border border-line rounded-card px-3 py-1.5 text-sm w-36"
    />
  );
}

function Editor({
  entry,
  onSave,
  onCancel,
}: {
  entry: ToolboxEntry;
  onSave: (e: ToolboxEntry) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(entry.title);
  const [type, setType] = useState(entry.type);
  const [body, setBody] = useState(entry.body);
  const [checklist, setChecklist] = useState<{ text: string; done: boolean }[]>(() => {
    try {
      return JSON.parse(entry.body);
    } catch {
      return [];
    }
  });

  return (
    <div className="card p-4">
      <div className="flex gap-1 bg-surface-2 p-1 rounded-card w-fit mb-3">
        {(["note", "checklist"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`px-3 py-1 text-sm capitalize btn ${type === t ? "accent-bg font-semibold" : "text-dim"}`}
            style={type === t ? { color: "var(--accent-contrast)" } : undefined}
          >
            {t}
          </button>
        ))}
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="w-full bg-surface-2 border border-line rounded-card px-3 py-2.5 mb-3 font-semibold"
      />

      {type === "note" ? (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full bg-surface-2 border border-line rounded-card p-3 min-h-48"
          placeholder="Write something private…"
          autoFocus
        />
      ) : (
        <div className="space-y-2">
          {checklist.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => setChecklist(checklist.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
                className="w-4 h-4 accent-[var(--accent)]"
              />
              <input
                value={item.text}
                onChange={(e) => setChecklist(checklist.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                placeholder="Item"
                className="flex-1 bg-surface-2 border border-line rounded-card px-3 py-2"
              />
              <button onClick={() => setChecklist(checklist.filter((_, j) => j !== i))} className="btn p-1.5 text-dim">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            onClick={() => setChecklist([...checklist, { text: "", done: false }])}
            className="btn px-3 py-2 text-sm text-dim flex items-center gap-1.5"
          >
            <Plus size={14} /> Add item
          </button>
        </div>
      )}

      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onCancel} className="btn px-4 py-2 text-sm text-dim">
          Cancel
        </button>
        <button
          onClick={() =>
            onSave({
              ...entry,
              title,
              type,
              body: type === "checklist" ? JSON.stringify(checklist) : body,
              updatedAt: Date.now(),
            })
          }
          className="accent-btn px-4 py-2 text-sm"
        >
          Save (encrypt)
        </button>
      </div>
    </div>
  );
}
