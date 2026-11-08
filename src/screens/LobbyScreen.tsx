import { useState } from "react";
import { useStore } from "zustand";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CopyButton } from "@/components/CopyButton";
import { FOCUS_RING } from "@/components/focusRing";
import { SeatRow } from "@/components/SeatRow";
import { Toggle } from "@/components/Toggle";
import { LOBBY_AI_DIFFICULTY } from "@/config/app";
import { CONFIRM_TEXT, LOBBY_TEXT } from "@/feedback/copy";
import { selectHostName, selectIsHost, type GameStore } from "@/store/gameStore";

export interface LobbyScreenProps {
  store: GameStore;
}

export function LobbyScreen({ store }: LobbyScreenProps) {
  const room = useStore(store, (state) => state.room);
  const myPlayerId = useStore(store, (state) => state.myPlayerId);
  const pending = useStore(store, (state) => state.pendingCommand);
  const isHost = useStore(store, selectIsHost);
  const hostName = useStore(store, selectHostName);
  const addAi = useStore(store, (state) => state.addAi);
  const startGame = useStore(store, (state) => state.startGame);
  const leaveRoom = useStore(store, (state) => state.leaveRoom);

  const [fillSeats, setFillSeats] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);

  // For the one moment after leaving, before useAppNavigation has moved to the main screen.
  if (room === null) return null;

  // One command at a time, so the other controls are off while any of them is waiting.
  const busy = pending !== null;
  const hasEmptySeat = room.seats.some((seat) => seat.player === null);

  async function handleLeave() {
    const left = await leaveRoom();
    // POST-08-3: on failure stay here, and close this so the error toast can be seen and dismissed.
    if (!left) setConfirmingLeave(false);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 p-4 pt-12">
      <h1 tabIndex={-1} className={`self-start text-xl font-semibold ${FOCUS_RING}`}>
        {LOBBY_TEXT.title}
      </h1>

      <Card className="flex flex-col items-center gap-1 text-center">
        <p className="text-xs font-semibold uppercase text-mid">{LOBBY_TEXT.code}</p>
        <p className="font-mono text-[32px] font-bold tracking-[0.25em] text-high">
          {room.roomCode}
        </p>
        <CopyButton
          text={room.roomCode}
          label={LOBBY_TEXT.copy}
          copiedLabel={LOBBY_TEXT.copied}
          failedMessage={LOBBY_TEXT.copyFailed}
          hint={hasEmptySeat ? LOBBY_TEXT.invite : undefined}
        />
      </Card>

      <Card>
        <h2 className="mb-2 text-xs font-semibold uppercase text-mid">{LOBBY_TEXT.players}</h2>
        {/* Drawn only from the server's list. It changes when room:updated arrives, never here. */}
        <ul className="flex flex-col gap-2">
          {room.seats.map((seat) => (
            <SeatRow
              key={seat.seat}
              colour={seat.colour}
              player={seat.player}
              isHost={seat.player?.id === room.hostId}
              isMe={seat.player !== null && seat.player.id === myPlayerId}
              canAddComputer={isHost}
              adding={pending?.kind === "addAi" && pending.seat === seat.seat}
              addDisabled={busy && !(pending?.kind === "addAi" && pending.seat === seat.seat)}
              onAddComputer={() => void addAi(seat.seat, LOBBY_AI_DIFFICULTY)}
            />
          ))}
        </ul>
      </Card>

      {isHost ? (
        <div className="flex flex-col items-start gap-3">
          {hasEmptySeat && (
            <Toggle
              label={LOBBY_TEXT.fillSeats}
              checked={fillSeats}
              onChange={setFillSeats}
              disabled={busy}
            />
          )}
          <Button
            size="lg"
            className="w-full"
            pending={pending?.kind === "start"}
            disabled={busy && pending?.kind !== "start"}
            onClick={() => void startGame({ fillEmptySeatsWithAi: hasEmptySeat && fillSeats })}
          >
            {LOBBY_TEXT.start}
          </Button>
        </div>
      ) : (
        hostName && (
          <p role="status" className="text-center text-[15px] text-mid">
            {LOBBY_TEXT.waitingForHost(hostName)}
          </p>
        )
      )}

      <Button
        variant="ghost"
        disabled={busy && !confirmingLeave}
        onClick={() => setConfirmingLeave(true)}
      >
        {LOBBY_TEXT.leave}
      </Button>

      {/* FR-SYS-08: Cancel and Esc send nothing at all (POST-08-1). */}
      <ConfirmDialog
        open={confirmingLeave}
        title={CONFIRM_TEXT.leave.title}
        body={CONFIRM_TEXT.body}
        confirmLabel={CONFIRM_TEXT.leave.action}
        pending={busy}
        onCancel={() => setConfirmingLeave(false)}
        onConfirm={() => void handleLeave()}
      />
    </main>
  );
}
