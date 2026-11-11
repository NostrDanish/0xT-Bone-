/**
 * Private Toolbox encryption — AES-256-GCM with a passphrase-derived key
 * (PBKDF2-SHA256, 210k iterations), mirroring T-Bone's on-device model.
 * Everything lives in localStorage, encrypted. Nothing leaves the device.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...b));
}

function unb64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: 210000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

const STORAGE_KEY = "tb.toolbox";

export interface ToolboxEntry {
  id: string;
  type: "note" | "checklist";
  folder: string;
  title: string;
  /** for notes: text; for checklists: JSON [{text, done}] */
  body: string;
  createdAt: number;
  updatedAt: number;
}

interface VaultFile {
  v: 1;
  salt: string;
  check: string; // encrypted "t-bone" to verify passphrase
  entries: { [id: string]: { iv: string; data: string } };
}

function emptyVault(): VaultFile {
  return { v: 1, salt: "", check: "", entries: {} };
}

function readVault(): VaultFile {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "") as VaultFile;
  } catch {
    return emptyVault();
  }
}

function writeVault(v: VaultFile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
}

/** Unlock the vault. Returns a session handle or throws on wrong passphrase. */
export async function unlockVault(passphrase: string): Promise<CryptoKey> {
  const vault = readVault();
  if (!vault.salt) {
    // First time: create
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(passphrase, salt);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const check = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode("t-bone"));
    writeVault({ ...emptyVault(), salt: b64(salt), check: JSON.stringify({ iv: b64(iv), data: b64(check) }) });
    return key;
  }
  const key = await deriveKey(passphrase, unb64(vault.salt));
  const { iv, data } = JSON.parse(vault.check);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(iv) as unknown as BufferSource },
    key,
    unb64(data) as unknown as BufferSource,
  );
  if (dec.decode(plain) !== "t-bone") throw new Error("wrong passphrase");
  return key;
}

export async function listEntries(key: CryptoKey): Promise<ToolboxEntry[]> {
  const vault = readVault();
  const out: ToolboxEntry[] = [];
  for (const [id, blob] of Object.entries(vault.entries)) {
    try {
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: unb64(blob.iv) as unknown as BufferSource },
        key,
        unb64(blob.data) as unknown as BufferSource,
      );
      out.push({ ...JSON.parse(dec.decode(plain)), id });
    } catch {
      /* skip corrupt */
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveEntry(key: CryptoKey, entry: Omit<ToolboxEntry, "id"> & { id?: string }): Promise<ToolboxEntry> {
  const id = entry.id ?? crypto.randomUUID();
  const full = { ...entry, id } as ToolboxEntry;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(JSON.stringify(full)),
  );
  const vault = readVault();
  vault.entries[id] = { iv: b64(iv), data: b64(data) };
  writeVault(vault);
  return full;
}

export async function deleteEntry(key: CryptoKey, id: string): Promise<void> {
  const vault = readVault();
  delete vault.entries[id];
  writeVault(vault);
}

export function wipeVault(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function vaultExists(): boolean {
  const v = readVault();
  return Boolean(v.salt);
}
