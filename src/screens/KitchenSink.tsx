import { useState, type ReactNode } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CountdownRing } from "@/components/CountdownRing";
import { Dice } from "@/components/Dice";
import { MessageLog } from "@/components/MessageLog";
import { Modal } from "@/components/Modal";
import { Piece, type PieceState } from "@/components/Piece";
import { PlayerCard } from "@/components/PlayerCard";
import { PlayerMark } from "@/components/PlayerMark";
import { RulesSummary } from "@/components/RulesSummary";
import { SegmentedControl } from "@/components/SegmentedControl";
import { TextField } from "@/components/TextField";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Toast } from "@/components/Toast";
import { ToastRegion, type ToastItem } from "@/components/ToastRegion";
import { Toggle } from "@/components/Toggle";
import { defaultRules } from "@/config/defaultRules";
import type { Colour } from "@/contract/types";
import { CONFIRM_TEXT, MESSAGES } from "@/feedback/copy";
import { useSettingsStore, type AnimationMode } from "@/store/settingsStore";

const COLOURS: readonly Colour[] = ["RED", "GREEN", "YELLOW", "BLUE"];
const BUTTON_VARIANTS = ["primary", "outline", "ghost", "danger"] as const;
const BUTTON_SIZES = ["sm", "md", "lg"] as const;
const PIECE_STATES: readonly PieceState[] = ["idle", "movable", "selected", "dimmed"];
const DICE_FACES = [1, 2, 3, 4, 5, 6];

const ANIMATION_OPTIONS = [
  { value: "on", label: "On" },
  { value: "fast", label: "Fast" },
  { value: "off", label: "Off" },
] as const;

const SEAT_OPTIONS = [
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
] as const;

const NO_BONUS_RULES = {
  ...defaultRules,
  bonusOnSix: false,
  bonusOnCapture: false,
  bonusOnFinish: false,
  threeSixesForfeit: false,
  turnTimerSeconds: 0,
  safeSquares: [],
};

const LOG_MESSAGES = [
  MESSAGES.gameStarted("Rida"),
  MESSAGES.rolled("Rida", 6),
  MESSAGES.broughtOut("Rida"),
  MESSAGES.bonusTurn("Rida"),
  MESSAGES.moved("Rida", 3),
  MESSAGES.turnPassed("Hamza"),
  MESSAGES.rolled("Maryam", 4),
  MESSAGES.captured("Maryam", "Rida"),
  MESSAGES.pieceFinished("Maryam"),
  MESSAGES.turnForfeited("Hamza"),
  MESSAGES.gameOver("Maryam"),
].map((text, id) => ({ id, text }));

// Stable functions, as CountdownRing asks for.
const twentyFiveSeconds = () => 25;
const eightSeconds = () => 8;
const threeSeconds = () => 3;
const noLimit = () => null;

function showcase(title: string, content: ReactNode) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase text-mid">{title}</h2>
      {content}
    </section>
  );
}

// Dev only, at ?kitchen=1: every shared component in every state, in the current theme.
export function KitchenSink() {
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const animation = useSettingsStore((state) => state.animation);
  const setAnimation = useSettingsStore((state) => state.setAnimation);

  const [seats, setSeats] = useState<"2" | "3" | "4">("4");
  const [sound, setSound] = useState(true);
  const [name, setName] = useState("Rida?");
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmResult, setConfirmResult] = useState("Nothing chosen yet");
  const [rolling, setRolling] = useState(false);
  const [diceValue, setDiceValue] = useState<number | null>(null);
  const [nextToastId, setNextToastId] = useState(2);
  const [toasts, setToasts] = useState<ToastItem[]>([
    { id: 1, kind: "error", message: "Something went wrong. Your game is safe — try again." },
  ]);

  // The demo steps through the faces in order, because the client never makes up a dice value.
  function rollDemo() {
    setRolling(true);
    setTimeout(() => {
      setDiceValue((current) => ((current ?? 0) % 6) + 1);
      setRolling(false);
    }, 1200);
  }

  function addToast(kind: ToastItem["kind"], message: string) {
    setToasts((current) => [...current, { id: nextToastId, kind, message }]);
    setNextToastId((id) => id + 1);
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 p-6 text-high">
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="text-[32px] font-bold">Kitchen sink</h1>
        <ThemeToggle value={theme} onChange={setTheme} />
        <SegmentedControl<AnimationMode>
          label="Animations"
          options={ANIMATION_OPTIONS}
          value={animation}
          onChange={setAnimation}
        />
      </header>

      {showcase(
        "Button",
        <div className="flex flex-col gap-3">
          {BUTTON_VARIANTS.map((variant) => (
            <div key={variant} className="flex flex-wrap items-center gap-3">
              {BUTTON_SIZES.map((size) => (
                <Button key={size} variant={variant} size={size}>
                  {variant} {size}
                </Button>
              ))}
              <Button variant={variant} pending>
                Pending
              </Button>
              <Button variant={variant} disabled>
                Disabled
              </Button>
            </div>
          ))}
        </div>,
      )}

      {showcase(
        "Card",
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>A plain card</Card>
          <Card active>An active card</Card>
        </div>,
      )}

      {showcase(
        "PlayerMark",
        <div data-player-marks="" className="flex w-fit flex-col gap-3 rounded-2xl bg-deep p-3">
          {(["sm", "md", "lg"] as const).map((size) => (
            <div key={size} className="flex items-center gap-6">
              {COLOURS.map((colour) => (
                <PlayerMark key={colour} colour={colour} size={size} />
              ))}
            </div>
          ))}
        </div>,
      )}

      {showcase(
        "PlayerCard",
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <PlayerCard
            colour="RED"
            name="Rida"
            tag="you"
            counts={{ base: 2, track: 1, home: 1 }}
            active
          />
          <PlayerCard
            colour="GREEN"
            name="Computer 1"
            tag="computer"
            counts={{ base: 4, track: 0, home: 0 }}
          />
          <PlayerCard
            colour="YELLOW"
            name="Hamza"
            tag="offline"
            counts={{ base: 1, track: 2, home: 1 }}
          />
          <PlayerCard
            colour="BLUE"
            name="A very long player name"
            counts={{ base: 0, track: 3, home: 1 }}
          />
        </div>,
      )}

      {showcase(
        "Piece (on a board cell)",
        <div className="flex w-fit flex-col gap-4 rounded-2xl bg-board-cell p-4">
          {COLOURS.map((colour) => (
            <div key={colour} className="flex items-center gap-6">
              {PIECE_STATES.map((state) => (
                <Piece
                  key={state}
                  colour={colour}
                  state={state}
                  label={`${colour} piece, ${state}`}
                  className="h-10 w-10"
                />
              ))}
            </div>
          ))}
        </div>,
      )}

      {showcase(
        "Dice",
        <div className="flex flex-wrap items-end gap-4">
          <Dice value={diceValue} rolling={rolling} disabled={false} onRoll={rollDemo} />
          <Dice value={null} rolling={false} disabled onRoll={() => undefined} />
          <Dice value={3} rolling disabled={false} onRoll={() => undefined} />
          {DICE_FACES.map((face) => (
            <Dice key={face} value={face} rolling={false} disabled onRoll={() => undefined} />
          ))}
        </div>,
      )}

      {showcase(
        "CountdownRing",
        <div className="flex items-center gap-6">
          <CountdownRing getSecondsLeft={twentyFiveSeconds} totalSeconds={30} />
          <CountdownRing getSecondsLeft={eightSeconds} totalSeconds={30} />
          <CountdownRing getSecondsLeft={threeSeconds} totalSeconds={30} />
          <CountdownRing getSecondsLeft={noLimit} totalSeconds={0} />
        </div>,
      )}

      {showcase(
        "SegmentedControl and Toggle",
        <div className="flex flex-wrap items-center gap-6">
          <SegmentedControl
            label="Players"
            options={SEAT_OPTIONS}
            value={seats}
            onChange={setSeats}
          />
          <SegmentedControl
            label="Players, disabled"
            options={SEAT_OPTIONS}
            value="2"
            onChange={() => undefined}
            disabled
          />
          <Toggle label="Sound" checked={sound} onChange={setSound} />
          <Toggle label="Disabled" checked={false} onChange={() => undefined} disabled />
        </div>,
      )}

      {showcase(
        "TextField",
        <div className="grid max-w-xl gap-3 sm:grid-cols-2">
          <TextField
            label="Your name"
            value={name}
            onChange={setName}
            error="Use 1–20 letters or numbers for your name."
          />
          <TextField label="No error" value="Hamza" onChange={() => undefined} />
          <TextField label="Disabled" value="Maryam" onChange={() => undefined} disabled />
        </div>,
      )}

      {showcase(
        "Modal and ConfirmDialog",
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => setModalOpen(true)}>
            Open modal
          </Button>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Leave game
          </Button>
          <p data-confirm-result="" className="text-xs text-mid">
            {confirmResult}
          </p>
          <Modal open={modalOpen} title="A modal" onClose={() => setModalOpen(false)}>
            <RulesSummary rules={defaultRules} standard />
          </Modal>
          <ConfirmDialog
            open={confirmOpen}
            title={CONFIRM_TEXT.leave.title}
            body={CONFIRM_TEXT.body}
            confirmLabel={CONFIRM_TEXT.leave.action}
            onCancel={() => {
              setConfirmOpen(false);
              setConfirmResult("Cancelled");
            }}
            onConfirm={() => {
              setConfirmOpen(false);
              setConfirmResult("Confirmed");
            }}
          />
        </div>,
      )}

      {showcase(
        "Toast",
        <div className="flex flex-col gap-3">
          <ol className="flex max-w-md flex-col gap-2">
            <Toast
              kind="error"
              message="An error stays until dismissed."
              onDismiss={() => undefined}
            />
          </ol>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => addToast("info", "Your turn.")}>
              Add info toast
            </Button>
            <Button
              variant="outline"
              onClick={() => addToast("error", "That didn't work. Try again.")}
            >
              Add error toast
            </Button>
          </div>
          <ToastRegion
            toasts={toasts}
            onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))}
          />
        </div>,
      )}

      {showcase(
        "MessageLog",
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <MessageLog messages={LOG_MESSAGES} />
          </Card>
          <Card>
            <MessageLog messages={[]} />
          </Card>
        </div>,
      )}

      {showcase(
        "RulesSummary",
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <RulesSummary rules={defaultRules} standard />
          </Card>
          <Card>
            <RulesSummary rules={NO_BONUS_RULES} />
          </Card>
        </div>,
      )}
    </main>
  );
}
