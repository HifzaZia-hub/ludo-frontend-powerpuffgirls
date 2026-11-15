import { useCallback, useEffect, useRef, useState } from "react";
import type { ServerEvent } from "@/contract/events";
import type { GameStateSnapshot } from "@/contract/types";
import { piecePlace } from "@/config/geometry";
import { BANNER_TEXT } from "@/feedback/copy";
import { eventToMessage, mergedRollLine, reconnectedPlayer } from "@/feedback/messages";
import type { EventTimings } from "@/feedback/motion";
import {
  advancedPieces,
  capturedPieces,
  piecesMoved,
  walkBetween,
} from "@/feedback/snapshotChanges";
import { listenForFirstGesture, playSound, type SoundName } from "@/feedback/sound";

const MESSAGE_LIMIT = 50;
const BANNER_MS = 1000;
const NOTHING_HELD: ReadonlyMap<string, number> = new Map();

export interface LogLine {
  id: number;
  text: string;
}

interface StepLine {
  text: string;
  replacesRoll: boolean;
}

/** One thing to show. A step with `ms: 0` happens at once and doesn't hold up the next one. */
interface Step {
  ms: number;
  line?: StepLine;
  /** Marks this line as a roll by this player, so the move that follows can join it. */
  rollBy?: string;
  sound?: SoundName;
  banner?: string;
  flashingId?: string;
  returningId?: string;
  finishingId?: string;
  bumpPlayerId?: string;
  sixesFlash?: boolean;
  endsQueue?: boolean;
  /** The server has said the match is over. */
  matchOver?: boolean;
  /** Shown as a short message that goes away by itself. */
  notice?: string;
  stillThere?: boolean;
}

interface State {
  seen: GameStateSnapshot | null;
  lastEvent: ServerEvent | null;
  queue: readonly Step[];
  current: Step | null;
  messages: readonly LogLine[];
  nextId: number;
  rollLine: { id: number; playerId: string } | null;
  /** Captured pieces, drawn on their old square until their turn in the queue. */
  held: ReadonlyMap<string, number>;
  banner: { id: number; text: string } | null;
  cue: { id: number; name: SoundName } | null;
  gameOver: boolean;
  notice: { id: number; text: string } | null;
  stillThere: boolean;
  reconnects: number;
}

const EMPTY: State = {
  seen: null,
  lastEvent: null,
  queue: [],
  current: null,
  messages: [],
  nextId: 1,
  rollLine: null,
  held: NOTHING_HELD,
  banner: null,
  cue: null,
  gameOver: false,
  notice: null,
  stillThere: false,
  reconnects: 0,
};

function withLine(state: State, line: StepLine | undefined, rollBy: string | undefined): State {
  if (!line) return state;
  if (line.replacesRoll && state.rollLine) {
    const rollId = state.rollLine.id;
    return {
      ...state,
      rollLine: null,
      messages: state.messages.map((old) => (old.id === rollId ? { ...old, text: line.text } : old)),
    };
  }
  const id = state.nextId;
  return {
    ...state,
    nextId: id + 1,
    messages: [...state.messages, { id, text: line.text }].slice(-MESSAGE_LIMIT),
    rollLine: rollBy ? { id, playerId: rollBy } : null,
  };
}

function enter(state: State, step: Step): State {
  let next = withLine(state, step.line, step.rollBy);
  if (step.matchOver) next = { ...next, gameOver: true };
  if (step.stillThere) next = { ...next, stillThere: true };
  if (step.notice) {
    next = { ...next, nextId: next.nextId + 1, notice: { id: next.nextId, text: step.notice } };
  }
  if (step.returningId) {
    const held = new Map(next.held);
    held.delete(step.returningId);
    next = { ...next, held };
  }
  if (step.banner) {
    next = { ...next, nextId: next.nextId + 1, banner: { id: next.nextId, text: step.banner } };
  }
  if (step.sound) {
    next = { ...next, nextId: next.nextId + 1, cue: { id: next.nextId, name: step.sound } };
  }
  return next;
}

// Runs every instant step up to the next one that takes time, so instant steps never need a
// timer. If several are instant only the last one's sound survives, or they'd all play at once.
function advance(state: State): State {
  let next: State = { ...state, current: null };
  for (let [step, ...rest] = next.queue; step; [step, ...rest] = next.queue) {
    next = enter({ ...next, queue: step.endsQueue ? [] : rest }, step);
    if (step.ms > 0) return { ...next, current: step };
  }
  return next;
}

// Ends all the pictures at once. The words still go in the log, because those events happened.
function drain(state: State): State {
  let next: State = {
    ...state,
    queue: [],
    current: null,
    held: NOTHING_HELD,
    banner: null,
  };
  for (const step of state.queue) {
    next = withLine(next, step.line, step.rollBy);
    if (step.matchOver) next = { ...next, gameOver: true };
    if (step.stillThere) next = { ...next, stillThere: true };
  }
  return next;
}

interface Context {
  myPlayerId: string | null;
  timings: EventTimings;
  reconnects: number;
}

function stepsFor(
  event: ServerEvent,
  captureIndex: number,
  line: StepLine | undefined,
  before: GameStateSnapshot | null,
  after: GameStateSnapshot,
  { myPlayerId, timings }: Context,
): Step[] {
  const actorId = before?.turn.activePlayerId;

  switch (event.type) {
    case "ROLLED":
      return [{ ms: 0, line, sound: "roll", rollBy: actorId }];
    case "MOVED": {
      const walk = walkBetween(before, after);
      return [{ ms: (walk?.steps.length ?? 0) * timings.stepMs, line, sound: "move" }];
    }
    case "CAPTURED": {
      const captured = before ? capturedPieces(before, after)[captureIndex] : undefined;
      if (!captured) return [{ ms: 0, line, sound: "capture" }];
      const pieceId = captured.piece.id;
      return [
        { ms: timings.flashMs, line, sound: "capture", flashingId: pieceId },
        { ms: timings.returnMs, returningId: pieceId },
      ];
    }
    case "PIECE_FINISHED": {
      const finished = before
        ? advancedPieces(before, after).find(({ piece }) => piecePlace(piece.step) === "home")
        : undefined;
      return [
        {
          ms: timings.finishMs,
          line,
          sound: "finish",
          finishingId: finished?.piece.id,
          bumpPlayerId: actorId,
        },
      ];
    }
    case "BONUS_TURN":
      // Nobody needs telling to roll again unless it's them. Everyone else gets the message.
      return [{ ms: 0, line, banner: actorId === myPlayerId ? BANNER_TEXT.rollAgain : undefined }];
    case "TURN_PASSED":
      return [{ ms: 0, line, banner: BANNER_TEXT.noMove }];
    case "TURN_FORFEITED":
      return [{ ms: timings.finishMs, line, sixesFlash: true }];
    case "GAME_OVER":
      // In the queue, not on arrival: the winning move's own events came in with this one.
      return [{ ms: 0, line, sound: "win", endsQueue: true, matchOver: true }];
    case "GAME_RESTARTED":
      return [{ ms: 0, endsQueue: true }];
    case "PLAYER_IDLE":
      // The event names nobody, so this is only about me if it was my turn when it came.
      return actorId === myPlayerId ? [{ ms: 0, stillThere: true }] : [];
    case "PLAYER_RECONNECTED": {
      const back = before ? reconnectedPlayer(before, after) : null;
      return [{ ms: 0, line, notice: back && back.id !== myPlayerId ? line?.text : undefined }];
    }
    default:
      return line ? [{ ms: 0, line }] : [];
  }
}

function buildSteps(
  events: readonly ServerEvent[],
  before: GameStateSnapshot | null,
  after: GameStateSnapshot,
  state: State,
  context: Context,
): Step[] {
  const lastLine = state.messages[state.messages.length - 1];
  const canMerge =
    before !== null &&
    state.rollLine !== null &&
    state.rollLine.id === lastLine?.id &&
    state.rollLine.playerId === before.turn.activePlayerId;
  const merged = canMerge ? mergedRollLine(events, before, after) : null;

  // The joined line waits for the last event it speaks for, so it can't give away a capture early.
  const has = (type: ServerEvent["type"]) => events.some((event) => event.type === type);
  let mergedOn: ServerEvent["type"] = "MOVED";
  if (has("PIECE_FINISHED")) mergedOn = "PIECE_FINISHED";
  if (has("CAPTURED")) mergedOn = "CAPTURED";

  let captures = 0;
  let mergedPlaced = false;
  return events.flatMap((event) => {
    const captureIndex = event.type === "CAPTURED" ? captures++ : 0;
    const joined =
      merged !== null &&
      (event.type === "MOVED" ||
        event.type === "PIECE_FINISHED" ||
        (event.type === "CAPTURED" && captureIndex === 0));

    let line: StepLine | undefined;
    if (joined) {
      if (event.type === mergedOn && !mergedPlaced) {
        mergedPlaced = true;
        line = { text: merged, replacesRoll: true };
      }
    } else {
      const text = eventToMessage(event, before, after, captureIndex);
      if (text !== null) line = { text, replacesRoll: false };
    }
    return stepsFor(event, captureIndex, line, before, after, context);
  });
}

function receive(
  state: State,
  snapshot: GameStateSnapshot | null,
  eventLog: readonly ServerEvent[],
  context: Context,
): State {
  const before = state.seen;
  // Contract §4: a change's events come first, then its state, so they're all in the log by now.
  const unread = state.lastEvent ? eventLog.slice(eventLog.lastIndexOf(state.lastEvent) + 1) : eventLog;
  const ready = snapshot ? unread.filter((event) => event.version <= snapshot.version) : [];

  let next: State = { ...state, seen: snapshot, lastEvent: ready[ready.length - 1] ?? state.lastEvent };
  if (!snapshot) return drain(next);

  const sameMatch = before?.matchId === snapshot.matchId;
  if (before && !sameMatch) next = { ...drain(next), messages: [], rollLine: null, gameOver: false };
  // The snapshot always wins: a piece has moved again, so whatever was still showing is out of date.
  else if (before && piecesMoved(before, snapshot)) next = drain(next);

  // EXC-05-1: across a version gap the two snapshots can't say what these events did, and after
  // being away the same goes for anything the server sent while we couldn't hear it.
  const cameBack = context.reconnects !== state.reconnects;
  next = { ...next, reconnects: context.reconnects };
  const neighbour =
    before && sameMatch && !cameBack && snapshot.version === before.version + 1 ? before : null;
  const events = ready.filter((event) => event.version === snapshot.version);

  // POST-06-2: if GAME_OVER was missed, the result still came from the server.
  if (
    neighbour === null &&
    snapshot.status === "FINISHED" &&
    snapshot.winnerId !== undefined &&
    !events.some((event) => event.type === "GAME_OVER")
  ) {
    next = { ...next, gameOver: true };
  }

  if (neighbour && context.timings.flashMs > 0) {
    const count = events.filter((event) => event.type === "CAPTURED").length;
    const captured = capturedPieces(neighbour, snapshot).slice(0, count);
    if (captured.length > 0) {
      next = {
        ...next,
        held: new Map([
          ...next.held,
          ...captured.map(({ piece, fromStep }): [string, number] => [piece.id, fromStep]),
        ]),
      };
    }
  }

  const queued = { ...next, queue: [...next.queue, ...buildSteps(events, neighbour, snapshot, next, context)] };
  return queued.current ? queued : advance(queued);
}

export interface EventFeedbackOptions extends Context {
  snapshot: GameStateSnapshot | null;
  eventLog: readonly ServerEvent[];
  soundOn: boolean;
  /** Changes when the server refuses something, to play the error sound. */
  errorId: number | null;
  onNotice: (message: string) => void;
}

export interface EventFeedback {
  messages: readonly LogLine[];
  banner: string | null;
  held: ReadonlyMap<string, number>;
  flashingId: string | null;
  returningId: string | null;
  finishingId: string | null;
  bumpPlayerId: string | null;
  sixesFlash: boolean;
  /** True while something is still playing out, which is when Skip is offered. */
  busy: boolean;
  /** POST-06-2: the server's GAME_OVER has had its turn in the queue. */
  gameOver: boolean;
  stillThere: boolean;
  dismissStillThere: () => void;
  skip: () => void;
}

/** FR-SYS-05: the one place server events turn into words, effects and sound. */
export function useEventFeedback({
  snapshot,
  eventLog,
  myPlayerId,
  timings,
  reconnects,
  soundOn,
  errorId,
  onNotice,
}: EventFeedbackOptions): EventFeedback {
  const context = { myPlayerId, timings, reconnects };
  const [state, setState] = useState(() => receive(EMPTY, snapshot, eventLog, context));

  // During render, or a captured piece would be painted in its base before its capture played.
  if (snapshot !== state.seen) setState(receive(state, snapshot, eventLog, context));

  const { current, banner, cue, notice } = state;

  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => setState(advance), current.ms);
    return () => clearTimeout(timer);
  }, [current]);

  const bannerId = banner?.id;
  useEffect(() => {
    if (bannerId === undefined) return;
    const timer = setTimeout(() => {
      setState((old) => (old.banner?.id === bannerId ? { ...old, banner: null } : old));
    }, BANNER_MS);
    return () => clearTimeout(timer);
  }, [bannerId]);

  useEffect(() => listenForFirstGesture(), []);

  const lastCue = useRef<number | null>(null);
  useEffect(() => {
    if (!cue || cue.id === lastCue.current) return;
    lastCue.current = cue.id;
    playSound(cue.name, soundOn);
  }, [cue, soundOn]);

  const lastNotice = useRef<number | null>(null);
  useEffect(() => {
    if (!notice || notice.id === lastNotice.current) return;
    lastNotice.current = notice.id;
    onNotice(notice.text);
  }, [notice, onNotice]);

  const lastError = useRef(errorId);
  useEffect(() => {
    if (errorId === lastError.current) return;
    lastError.current = errorId;
    if (errorId !== null) playSound("error", soundOn);
  }, [errorId, soundOn]);

  const skip = useCallback(() => setState(drain), []);
  const dismissStillThere = useCallback(
    () => setState((old) => ({ ...old, stillThere: false })),
    [],
  );

  return {
    messages: state.messages,
    banner: banner?.text ?? null,
    held: state.held,
    flashingId: current?.flashingId ?? null,
    returningId: current?.returningId ?? null,
    finishingId: current?.finishingId ?? null,
    bumpPlayerId: current?.bumpPlayerId ?? null,
    sixesFlash: current?.sixesFlash ?? false,
    busy: current !== null,
    gameOver: state.gameOver,
    stillThere: state.stillThere,
    dismissStillThere,
    skip,
  };
}
