import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useStore } from "zustand";
import { snapshotArrives } from "@/interaction/snapshotArrives";
import {
  selectCanMove,
  selectMoveOptions,
  type GameStore,
  type MoveOption,
} from "@/store/gameStore";

export interface MoveSelection {
  options: readonly MoveOption[];
  selected: MoveOption | null;
  /** A move is on its way to the server. */
  sending: boolean;
  /** The options are on screen but pressing them does nothing right now. */
  locked: boolean;
  /** Mouse press or Enter: chooses a piece, or sends it if it's already chosen. */
  pick: (pieceId: string) => void;
  /** Keyboard focus: chooses a piece and never sends it. */
  preview: (pieceId: string) => void;
  pickNumber: (number: string) => void;
  confirm: () => void;
  cancel: () => void;
}

const NO_OPTIONS: readonly MoveOption[] = [];

/**
 * FR-SYS-03: choosing is local to this screen, and sending is the only thing the server sees.
 * `focusAfterMove` takes the keyboard's place when the piece it was on stops being a button.
 * `paused` holds the options back while the die is landing, because showing them sooner would
 * give away the roll (contract §4: land on the value, then highlight the moves).
 */
export function useMoveSelection(
  store: GameStore,
  focusAfterMove: RefObject<HTMLElement>,
  paused: boolean,
): MoveSelection {
  const listed = useStore(store, selectMoveOptions);
  const options = paused ? NO_OPTIONS : listed;
  const canMove = useStore(store, selectCanMove);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // A second press can arrive before React has redrawn the pieces.
  const inFlight = useRef(false);
  const lastInputWasPointer = useRef(false);
  const offered = options.length > 0;

  // During render, so a choice from an earlier turn is never drawn on this one.
  if (!offered && chosenId !== null) setChosenId(null);

  // A mouse press focuses a button just before its click, so choosing on focus would make one
  // click choose the piece and then send it.
  useEffect(() => {
    const onPointer = () => {
      lastInputWasPointer.current = true;
    };
    const onKey = () => {
      lastInputWasPointer.current = false;
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, []);

  // NFR-SYS-08: without this, the next Tab would start again from the top of the page.
  const wasOffered = useRef(false);
  useEffect(() => {
    if (wasOffered.current && !offered && document.activeElement === document.body) {
      focusAfterMove.current?.focus();
    }
    wasOffered.current = offered;
  }, [offered, focusAfterMove]);

  const pressable = useCallback(
    (pieceId: string) => {
      const state = store.getState();
      return (
        !paused &&
        !inFlight.current &&
        selectCanMove(state) &&
        selectMoveOptions(state).some((option) => option.pieceId === pieceId)
      );
    },
    [store, paused],
  );

  const send = useCallback(
    (pieceId: string) => {
      if (!pressable(pieceId)) return;
      inFlight.current = true;
      setSending(true); // NFR-SYS-01: the controls react before the server has answered

      async function sendMove() {
        // FR-SYS-03 EXC-03-2: the piece stays put until the new snapshot says otherwise.
        const version = await store.getState().move(pieceId);
        // The options are out of date from the ack onwards, so stay locked until the state comes.
        // FR-SYS-04: a refused move has no new state to wait for, and the choice is dropped.
        if (version !== null) await snapshotArrives(store, version);
        inFlight.current = false;
        setSending(false);
        setChosenId(null);
      }

      void sendMove();
    },
    [store, pressable],
  );

  const pick = useCallback(
    (pieceId: string) => {
      if (!pressable(pieceId)) return;
      if (chosenId === pieceId) send(pieceId);
      else setChosenId(pieceId);
    },
    [chosenId, pressable, send],
  );

  const preview = useCallback(
    (pieceId: string) => {
      if (!lastInputWasPointer.current && pressable(pieceId)) setChosenId(pieceId);
    },
    [pressable],
  );

  const pickNumber = useCallback(
    (number: string) => {
      const option = selectMoveOptions(store.getState()).find((item) => item.number === number);
      if (!option || !pressable(option.pieceId)) return;
      setChosenId(option.pieceId);
      // So Enter lands on the piece, and a screen reader says which move this is.
      document.querySelector<HTMLElement>(`[data-piece="${option.pieceId}"] button`)?.focus();
    },
    [store, pressable],
  );

  const confirm = useCallback(() => {
    if (chosenId !== null) send(chosenId);
  }, [chosenId, send]);

  const cancel = useCallback(() => {
    if (!inFlight.current) setChosenId(null);
  }, []);

  return {
    options,
    selected: options.find((option) => option.pieceId === chosenId) ?? null,
    sending,
    locked: sending || !canMove,
    pick,
    preview,
    pickNumber,
    confirm,
    cancel,
  };
}
