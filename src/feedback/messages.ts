// FR-SYS-05, D2 FR-36: the message log's words. docs/03-ui-spec.md §6.
// EXC-05-1: each line answers an event the server really sent, and anything that can't be named
// from the two snapshots gets no line at all rather than a guess.

import type { ServerEvent } from "@/contract/events";
import type { GameStateSnapshot, Piece, Player } from "@/contract/types";
import { MESSAGES } from "@/feedback/copy";
import { advancedPieces, capturedPieces } from "@/feedback/snapshotChanges";

function playerNamed(snapshot: GameStateSnapshot, playerId: string | undefined): Player | null {
  return snapshot.players.find(({ id }) => id === playerId) ?? null;
}

function ownerOf(snapshot: GameStateSnapshot, piece: Piece): Player | null {
  return snapshot.players.find(({ colour }) => colour === piece.colour) ?? null;
}

function connectionChanged(
  before: GameStateSnapshot,
  after: GameStateSnapshot,
  nowConnected: boolean,
): Player | null {
  return (
    after.players.find(
      (player) =>
        player.connected === nowConnected &&
        before.players.find(({ id }) => id === player.id)?.connected === !nowConnected,
    ) ?? null
  );
}

/**
 * `before` is the snapshot just before this event's change, or null if we don't have it, as after
 * a version gap. The turn's owner is read from it because `after` may already be the next player's.
 */
export function eventToMessage(
  event: ServerEvent,
  before: GameStateSnapshot | null,
  after: GameStateSnapshot,
  captureIndex = 0,
): string | null {
  if (event.type === "GAME_STARTED") {
    const first = playerNamed(after, after.turn.activePlayerId);
    return first ? MESSAGES.gameStarted(first.name) : null;
  }
  if (event.type === "GAME_OVER") {
    const winner = playerNamed(after, after.winnerId);
    return winner ? MESSAGES.gameOver(winner.name) : null;
  }
  if (!before) return null;

  const player = playerNamed(after, before.turn.activePlayerId);

  switch (event.type) {
    case "ROLLED":
      return player && after.turn.lastRoll !== null
        ? MESSAGES.rolled(player.name, after.turn.lastRoll)
        : null;
    case "MOVED": {
      const [moved] = advancedPieces(before, after);
      if (!player || !moved) return null;
      return moved.fromStep === 0
        ? MESSAGES.broughtOut(player.name)
        : MESSAGES.moved(player.name, moved.piece.step - moved.fromStep);
    }
    case "CAPTURED": {
      const captured = capturedPieces(before, after)[captureIndex];
      const owner = captured ? ownerOf(after, captured.piece) : null;
      return player && owner ? MESSAGES.captured(player.name, owner.name) : null;
    }
    case "PIECE_FINISHED":
      return player ? MESSAGES.pieceFinished(player.name) : null;
    case "BONUS_TURN":
      return player ? MESSAGES.bonusTurn(player.name) : null;
    case "TURN_PASSED":
      return player ? MESSAGES.turnPassed(player.name) : null;
    case "TURN_FORFEITED":
      return player ? MESSAGES.turnForfeited(player.name) : null;
    case "PLAYER_DISCONNECTED": {
      const gone = connectionChanged(before, after, false);
      return gone ? MESSAGES.playerDisconnected(gone.name) : null;
    }
    case "PLAYER_RECONNECTED": {
      const back = connectionChanged(before, after, true);
      return back ? MESSAGES.playerReconnected(back.name) : null;
    }
    default:
      return null; // TURN_CHANGED and the rest have no template (§6)
  }
}

/** One line for a roll and the move it led to, or null if this change has no move to add. */
export function mergedRollLine(
  events: readonly ServerEvent[],
  before: GameStateSnapshot,
  after: GameStateSnapshot,
): string | null {
  const has = (type: ServerEvent["type"]) => events.some((event) => event.type === type);
  const player = playerNamed(after, before.turn.activePlayerId);
  const roll = before.turn.lastRoll;
  const [moved] = advancedPieces(before, after);
  if (!has("MOVED") || !player || roll === null || !moved) return null;

  const [captured] = capturedPieces(before, after);
  const owner = captured ? ownerOf(after, captured.piece) : null;
  if (has("CAPTURED") && owner) return MESSAGES.rolledAndCaptured(player.name, roll, owner.name);
  if (has("PIECE_FINISHED")) return MESSAGES.rolledAndFinished(player.name, roll);
  return moved.fromStep === 0
    ? MESSAGES.rolledAndBroughtOut(player.name, roll)
    : MESSAGES.rolledAndMoved(player.name, roll);
}
