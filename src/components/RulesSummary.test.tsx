import { render, screen } from "@testing-library/react";
import { RulesSummary } from "@/components/RulesSummary";
import { defaultRules } from "@/config/defaultRules";
import { RULES_TEXT } from "@/feedback/copy";

describe("RulesSummary (D2 FR-07, NFR-SYS-11)", () => {
  it("includes the capture bonus when the rules give one", () => {
    render(<RulesSummary rules={{ ...defaultRules, bonusOnCapture: true }} />);

    expect(screen.queryByText(RULES_TEXT.bonusOnCapture)).not.toBeNull();
  });

  it("leaves the capture bonus out when the rules don't give one", () => {
    render(<RulesSummary rules={{ ...defaultRules, bonusOnCapture: false }} />);

    expect(screen.queryByText(RULES_TEXT.bonusOnCapture)).toBeNull();
  });

  it("follows the other optional rules", () => {
    render(
      <RulesSummary
        rules={{
          ...defaultRules,
          bonusOnSix: false,
          bonusOnFinish: false,
          threeSixesForfeit: false,
          turnTimerSeconds: 0,
          safeSquares: [],
        }}
      />,
    );

    expect(screen.queryByText(RULES_TEXT.bonusOnSix)).toBeNull();
    expect(screen.queryByText(RULES_TEXT.bonusOnFinish)).toBeNull();
    expect(screen.queryByText(RULES_TEXT.threeSixes)).toBeNull();
    expect(screen.queryByText(/seconds for each turn/)).toBeNull();
    expect(screen.queryByText(RULES_TEXT.capture)).not.toBeNull();
  });

  it("states the server's own numbers", () => {
    render(
      <RulesSummary rules={{ ...defaultRules, turnTimerSeconds: 45, safeSquares: [0, 13, 26] }} />,
    );

    expect(screen.queryByText(RULES_TEXT.timer(45))).not.toBeNull();
    expect(screen.queryByText(RULES_TEXT.captureWithSafe(3))).not.toBeNull();
  });

  it("stays within 8 lines with every option on", () => {
    render(<RulesSummary rules={defaultRules} />);

    expect(screen.getAllByRole("listitem").length).toBeLessThanOrEqual(8);
  });

  it("labels the default rules, and shows the keyboard table", () => {
    render(<RulesSummary rules={defaultRules} standard />);

    expect(screen.queryByText(RULES_TEXT.standardTitle)).not.toBeNull();
    expect(screen.queryByText(RULES_TEXT.keyboardTitle)).not.toBeNull();
    expect(screen.queryByText("Roll, when you can")).not.toBeNull();
  });
});
