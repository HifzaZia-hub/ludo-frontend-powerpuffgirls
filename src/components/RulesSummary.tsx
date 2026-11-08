import type { RuleConfig } from "@/contract/types";
import { KEYBOARD_HELP, RULES_TEXT } from "@/feedback/copy";

// NFR-SYS-11: every optional line comes from the match's own rules, so this text can never
// disagree with what the server does.
function ruleLines(rules: RuleConfig): string[] {
  const safeCount = rules.safeSquares.length;

  return [
    RULES_TEXT.leaveBase,
    safeCount > 0 ? RULES_TEXT.captureWithSafe(safeCount) : RULES_TEXT.capture,
    RULES_TEXT.exactRoll,
    ...(rules.bonusOnSix ? [RULES_TEXT.bonusOnSix] : []),
    ...(rules.bonusOnCapture ? [RULES_TEXT.bonusOnCapture] : []),
    ...(rules.bonusOnFinish ? [RULES_TEXT.bonusOnFinish] : []),
    ...(rules.threeSixesForfeit ? [RULES_TEXT.threeSixes] : []),
    ...(rules.turnTimerSeconds > 0 ? [RULES_TEXT.timer(rules.turnTimerSeconds)] : []),
  ];
}

export interface RulesSummaryProps {
  rules: RuleConfig;
  /** True before a game exists, when these are the default rules rather than this match's. */
  standard?: boolean;
}

export function RulesSummary({ rules, standard = false }: RulesSummaryProps) {
  return (
    <div className="flex flex-col gap-4 text-[15px] text-high">
      <div>
        <h3 className="text-xl font-semibold">
          {standard ? RULES_TEXT.standardTitle : RULES_TEXT.title}
        </h3>
        <p className="mt-1 text-mid">{RULES_TEXT.goal}</p>
      </div>
      <ul className="flex list-disc flex-col gap-1 pl-5">
        {ruleLines(rules).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div>
        <h3 className="text-xs font-semibold uppercase text-mid">{RULES_TEXT.keyboardTitle}</h3>
        <table className="mt-1 w-full text-left">
          <thead className="sr-only">
            <tr>
              <th scope="col">{RULES_TEXT.keyColumn}</th>
              <th scope="col">{RULES_TEXT.actionColumn}</th>
            </tr>
          </thead>
          <tbody>
            {KEYBOARD_HELP.map(({ key, action }) => (
              <tr key={key + action}>
                <td className="whitespace-nowrap py-0.5 pr-4 align-top">
                  <kbd className="rounded-lg border border-soft bg-raised px-1.5 text-xs font-semibold">
                    {key}
                  </kbd>
                </td>
                <td className="py-0.5 text-mid">{action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
