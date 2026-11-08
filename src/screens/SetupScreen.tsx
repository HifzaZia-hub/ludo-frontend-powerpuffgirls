import { useRef, useState, type FormEvent } from "react";
import { useStore } from "zustand";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { FOCUS_RING } from "@/components/focusRing";
import { FormRow } from "@/components/FormRow";
import { PlayerMark } from "@/components/PlayerMark";
import { SegmentedControl, type SegmentedOption } from "@/components/SegmentedControl";
import { TextField } from "@/components/TextField";
import { HOST_COLOUR } from "@/config/players";
import type { Difficulty, GameMode } from "@/contract/types";
import { COLOUR_NAMES, INVALID_NAME_MESSAGE, SETUP_TEXT } from "@/feedback/copy";
import { isValidName } from "@/interaction/formChecks";
import type { GameStore } from "@/store/gameStore";
import { useUiStore } from "@/store/uiStore";

const SEAT_COUNTS = { "2": 2, "3": 3, "4": 4 } as const;
type SeatChoice = keyof typeof SEAT_COUNTS;

const SEAT_OPTIONS: readonly SegmentedOption<SeatChoice>[] = [
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
];

const MODE_OPTIONS: readonly SegmentedOption<GameMode>[] = [
  { value: "HUMAN_VS_HUMAN", label: SETUP_TEXT.friends },
  { value: "HUMAN_VS_AI", label: SETUP_TEXT.computer },
];

const DIFFICULTY_OPTIONS: readonly SegmentedOption<Difficulty>[] = [
  { value: "EASY", label: SETUP_TEXT.easy },
  { value: "NORMAL", label: SETUP_TEXT.normal },
];

export interface SetupScreenProps {
  store: GameStore;
}

export function SetupScreen({ store }: SetupScreenProps) {
  const createRoom = useStore(store, (state) => state.createRoom);
  const goTo = useUiStore((state) => state.goTo);
  const goToLobby = useUiStore((state) => state.goToLobby);

  // FR-SYS-01 ALT-01-1: this screen owns these and no failure resets them, so a retry is one press.
  const [seats, setSeats] = useState<SeatChoice>("4");
  const [mode, setMode] = useState<GameMode>("HUMAN_VS_AI"); // Rida (D2): a game in a few clicks
  const [difficulty, setDifficulty] = useState<Difficulty>("NORMAL");
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const nameFieldRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    if (!isValidName(name)) {
      setNameError(INVALID_NAME_MESSAGE);
      nameFieldRef.current?.focus();
      return;
    }

    setNameError(null);
    setSubmitting(true);
    const result = await createRoom({
      displayName: name.trim(),
      mode,
      seats: SEAT_COUNTS[seats],
      ...(mode === "HUMAN_VS_AI" ? { aiDifficulty: difficulty } : {}),
    });
    if (result.ok) {
      goToLobby();
      return;
    }

    // Anything that isn't about the name has already gone to a toast.
    setSubmitting(false);
    if (result.field === "name") {
      setNameError(result.message);
      nameFieldRef.current?.focus();
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 p-4 pt-12">
      <h1 tabIndex={-1} className={`self-start text-xl font-semibold ${FOCUS_RING}`}>
        {SETUP_TEXT.title}
      </h1>

      <Card>
        <form
          noValidate
          onSubmit={(event) => void handleSubmit(event)}
          className="flex flex-col gap-4"
        >
          <FormRow label={SETUP_TEXT.players}>
            <SegmentedControl
              label={SETUP_TEXT.players}
              options={SEAT_OPTIONS}
              value={seats}
              onChange={setSeats}
            />
          </FormRow>

          <FormRow label={SETUP_TEXT.gameType}>
            <SegmentedControl
              label={SETUP_TEXT.gameType}
              options={MODE_OPTIONS}
              value={mode}
              onChange={setMode}
            />
          </FormRow>

          {mode === "HUMAN_VS_AI" && (
            <FormRow label={SETUP_TEXT.difficulty}>
              <SegmentedControl
                label={SETUP_TEXT.difficulty}
                options={DIFFICULTY_OPTIONS}
                value={difficulty}
                onChange={setDifficulty}
              />
            </FormRow>
          )}

          <TextField
            ref={nameFieldRef}
            label={SETUP_TEXT.name}
            value={name}
            onChange={(typed) => {
              setName(typed);
              setNameError(null);
            }}
            error={nameError}
            autoComplete="off"
          />

          {/* TODO(FR-06): read-only until the backend answers the colour question in
              docs/01-contract.md §8. The colour picker goes here. */}
          <p className="flex items-center gap-2 text-[15px] text-high">
            <span>{SETUP_TEXT.youWillBe}</span>
            <PlayerMark colour={HOST_COLOUR} size="sm" />
            <span>{COLOUR_NAMES[HOST_COLOUR]}</span>
          </p>

          <div className="flex items-center justify-between gap-2">
            {/* Off while a request is out, so a room can't be created behind the player's back. */}
            <Button variant="ghost" disabled={submitting} onClick={() => goTo("main")}>
              {SETUP_TEXT.back}
            </Button>
            <Button type="submit" size="lg" pending={submitting}>
              {SETUP_TEXT.start}
            </Button>
          </div>
        </form>
      </Card>
    </main>
  );
}
