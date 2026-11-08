import type { Difficulty } from "@/contract/types";

// ALT-10-1 is TO CONFIRM (docs/00-requirements.md §5), so saving settings on the device sits
// behind this one flag and can be switched off without touching anything else.
export const PERSIST_SETTINGS = true;

// The add-computer command needs a difficulty, but the setup form only asks for one in computer
// games. This is the contract's own default (docs/01-contract.md §1).
export const LOBBY_AI_DIFFICULTY: Difficulty = "NORMAL";
