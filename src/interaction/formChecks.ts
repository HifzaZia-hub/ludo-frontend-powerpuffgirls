// Quick checks so a common typing mistake never has to go to the server and back (FR-SYS-01).
// The server still has the last word: INVALID_NAME and INVALID_CODE are handled as well.

// Contract §1: 1-20 letters, digits, space, _ - or . The letters can be from any language,
// which is what the mock accepts. A stricter check here would block names the server allows.
const NAME_PATTERN = /^[\p{L}\p{N} _.-]{1,20}$/u;

// Contract §2: no I, L, O, 0 or 1, because they are easy to misread.
const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;

export function isValidName(typed: string): boolean {
  return NAME_PATTERN.test(typed.trim());
}

export interface CleanedRoomCode {
  code: string;
  /** True if something typed isn't in the alphabet, so the field can say why it didn't appear. */
  rejected: boolean;
}

// Contract §1 and §2: upper-case it, drop spaces, and refuse anything outside the alphabet
// instead of sending it.
export function cleanRoomCode(typed: string): CleanedRoomCode {
  const characters = [...typed.replace(/\s/g, "").toUpperCase()];
  const allowed = characters.filter((character) => ROOM_CODE_ALPHABET.includes(character));
  return {
    code: allowed.slice(0, ROOM_CODE_LENGTH).join(""),
    rejected: allowed.length !== characters.length,
  };
}
