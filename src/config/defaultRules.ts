import type { RuleConfig } from "@/contract/types";

// NFR-SYS-11: the LGS defaults (docs/01-contract.md §5), used only for the "Standard rules"
// summary before a game exists. During a game, always read snapshot.rules, because the host
// can change these values.
export const defaultRules: RuleConfig = {
  turnTimerSeconds: 30,
  threeSixesForfeit: true,
  bonusOnSix: true,
  bonusOnCapture: true,
  bonusOnFinish: true,
  safeSquares: [0, 8, 13, 21, 26, 34, 39, 47],
  autoMoveSingleOption: false,
  aiDelayMs: 700,
  standInDelayMs: 3000,
};
