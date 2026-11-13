import { describe, expect, it } from "vitest";
import { buildNostrConnectUri, parseBunkerUri } from "./nip46";

const signerPubkey = "a".repeat(64);

describe("NIP-46 connection URI handling", () => {
  it("parses a bunker URI with multiple relays and a pairing secret", () => {
    const uri =
      `bunker://${signerPubkey}?relay=wss%3A%2F%2Frelay.example.com&relay=wss%3A%2F%2Frelay2.example.com&secret=one-time-secret`;

    expect(parseBunkerUri(uri)).toEqual({
      signerPubkey,
      relays: ["wss://relay.example.com/", "wss://relay2.example.com/"],
      secret: "one-time-secret",
    });
  });

  it("deduplicates relays and accepts an omitted optional secret", () => {
    const uri =
      `bunker://${signerPubkey}?relay=wss%3A%2F%2Frelay.example.com&relay=wss%3A%2F%2Frelay.example.com`;

    expect(parseBunkerUri(uri)).toEqual({
      signerPubkey,
      relays: ["wss://relay.example.com/"],
      secret: "",
    });
  });

  it("rejects malformed signer keys", () => {
    expect(() => parseBunkerUri("bunker://not-a-pubkey?relay=wss%3A%2F%2Frelay.example.com")).toThrow(
      "Not a valid bunker:// URI",
    );
  });

  it("rejects insecure or malformed relay URLs", () => {
    expect(() =>
      parseBunkerUri(`bunker://${signerPubkey}?relay=ws%3A%2F%2Frelay.example.com`),
    ).toThrow("secure wss://");
    expect(() =>
      parseBunkerUri(`bunker://${signerPubkey}?relay=javascript%3Aalert(1)`),
    ).toThrow("secure wss://");
  });

  it("rejects bunker URIs without relays or with excessive relays", () => {
    expect(() => parseBunkerUri(`bunker://${signerPubkey}`)).toThrow("no relays");
    const relays = Array.from({ length: 21 }, (_, i) =>
      `relay=wss%3A%2F%2Fr${i}.example.com`,
    ).join("&");
    expect(() => parseBunkerUri(`bunker://${signerPubkey}?${relays}`)).toThrow("too many relays");
  });

  it("builds a client-initiated nostrconnect URI with required pairing fields", () => {
    const uri = buildNostrConnectUri(
      "b".repeat(64),
      ["wss://relay.example.com"],
      "random-pairing-secret",
      "T-Bone Web",
      "https://tbone.example",
    );
    const parsed = new URL(uri);

    expect(parsed.protocol).toBe("nostrconnect:");
    expect(parsed.hostname).toBe("b".repeat(64));
    expect(parsed.searchParams.getAll("relay")).toEqual(["wss://relay.example.com"]);
    expect(parsed.searchParams.get("secret")).toBe("random-pairing-secret");
    expect(parsed.searchParams.get("name")).toBe("T-Bone Web");
    expect(parsed.searchParams.get("url")).toBe("https://tbone.example");
  });
});
