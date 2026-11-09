/**
 * True only when SHA-256 of the seed equals the hash the server published. False means "couldn't
 * confirm", not "unfair": the contract doesn't say how the hash is made, and browsers only offer
 * this outside https and localhost as undefined.
 */
export async function seedMatchesHash(seed: string, seedHash: string): Promise<boolean> {
  if (typeof crypto === "undefined" || crypto.subtle === undefined) return false;
  try {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
    const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0"));
    return hex.join("") === seedHash.toLowerCase();
  } catch {
    return false;
  }
}
