import { seedMatchesHash } from "@/feedback/diceCheck";

// The published SHA-256 test vector for "abc".
const ABC_HASH = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

describe("seedMatchesHash", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("confirms a seed that makes the published hash", async () => {
    await expect(seedMatchesHash("abc", ABC_HASH)).resolves.toBe(true);
  });

  it("isn't fooled by upper case letters in the hash", async () => {
    await expect(seedMatchesHash("abc", ABC_HASH.toUpperCase())).resolves.toBe(true);
  });

  it("can't confirm a seed that makes a different hash", async () => {
    await expect(seedMatchesHash("abd", ABC_HASH)).resolves.toBe(false);
  });

  // Browsers leave this out on plain http, which isn't the server's fault.
  it("can't confirm anything when the browser has no hashing", async () => {
    vi.stubGlobal("crypto", {});

    await expect(seedMatchesHash("abc", ABC_HASH)).resolves.toBe(false);
  });

  it("can't confirm anything if hashing fails", async () => {
    vi.stubGlobal("crypto", { subtle: { digest: () => Promise.reject(new Error("no")) } });

    await expect(seedMatchesHash("abc", ABC_HASH)).resolves.toBe(false);
  });
});
