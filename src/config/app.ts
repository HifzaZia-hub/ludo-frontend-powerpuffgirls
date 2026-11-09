import type { Difficulty } from "@/contract/types";

// ALT-10-1 is TO CONFIRM (docs/00-requirements.md §5), so saving settings on the device sits
// behind this one flag and can be switched off without touching anything else.
export const PERSIST_SETTINGS = true;

// D2 FR-29 is TO CONFIRM, so the session score can be switched off here without touching anything
// else. It only ever counts winners the server reported (POST-06-3).
export const SHOW_SESSION_SCORE = true;

// The add-computer command needs a difficulty, but the setup form only asks for one in computer
// games. This is the contract's own default (docs/01-contract.md §1).
export const LOBBY_AI_DIFFICULTY: Difficulty = "NORMAL";
