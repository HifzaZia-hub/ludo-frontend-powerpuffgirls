// Every word the player reads comes from here (NFR-SYS-08). Source: docs/03-ui-spec.md §4–§7.

import type { PiecePlace } from "@/config/geometry";
import type { ErrorCode } from "@/contract/errors";
import type { Colour, ServerError } from "@/contract/types";

const GENERIC_ERROR = "That didn't work. Try again."; // FR-SYS-04 ALT-04-1

// The forms' own checks use these too, so a mistake reads the same wherever it is caught.
export const INVALID_NAME_MESSAGE = "Use 1–20 letters or numbers for your name.";
export const INVALID_CODE_MESSAGE = "That code doesn't look right. It has 6 letters and numbers.";

// ILLEGAL_MOVE is left out on purpose: the server's own reason says exactly what was wrong.
const ERROR_COPY: Partial<Record<ErrorCode, string>> = {
  NOT_YOUR_TURN: "Wait for your turn.",
  ROLL_REQUIRED: "Roll the dice first.",
  ALREADY_ROLLED: "You already rolled. Pick a piece to move.",
  INVALID_NAME: INVALID_NAME_MESSAGE,
  NAME_TAKEN: "Someone in this game already has that name. Try another.",
  INVALID_CODE: INVALID_CODE_MESSAGE,
  ROOM_NOT_FOUND: "We couldn't find that game. Check the code.",
  ROOM_FULL: "That game is full.",
  GAME_ALREADY_STARTED: "That game has already started.",
  NOT_ENOUGH_PLAYERS: "You need at least 2 players. Add a computer player?",
  RATE_LIMITED: "Slow down a little and try again.",
  SERVER_BUSY: "The game server is busy. Try again in a minute.",
  UNAUTHORIZED: "Your game session ended. Please start again.",
  INTERNAL_ERROR: "Something went wrong. Your game is safe — try again.",
};

export const SESSION_REPLACED_MESSAGE = "This game is open in another tab.";

export function friendlyError(error: ServerError): string {
  return ERROR_COPY[error.code] ?? (error.message || GENERIC_ERROR);
}

export const LABELS = {
  cancel: "Cancel",
  close: "Close",
  dismiss: "Dismiss",
  on: "On",
  off: "Off",
  base: "Base",
  track: "Track",
  home: "Home",
  theme: "Theme",
  dark: "Dark",
  light: "Light",
  roll: "Roll",
  rolling: "Rolling…",
  messages: "Messages",
  noMessages: "Moves will show up here.",
  notice: "Notice",
  problem: "Problem",
} as const;

export const MAIN_TEXT = {
  wordmark: "LUDO",
  tagline: "Roll · Move · Capture · Win",
  newGame: "New Game",
  joinGame: "Join Game",
  howToPlay: "How to play",
} as const;

export const SETTINGS_TEXT = {
  title: "Settings",
  sound: "Sound effects",
  animations: "Animations",
  fast: "Fast",
} as const;

export const RULES_MODAL_TITLE = "Rules";

export const SETUP_TEXT = {
  title: "New game",
  players: "Players",
  gameType: "Game type",
  friends: "Play with friends",
  computer: "Play with computer",
  name: "Your name",
  difficulty: "Computer difficulty",
  easy: "Easy",
  normal: "Normal",
  youWillBe: "You will be",
  start: "Start",
  back: "Back",
} as const;

export const JOIN_TEXT = {
  title: "Join a game",
  code: "Game code",
  name: "Your name",
  checking: "Looking for that game…",
  found: "Game found! Now type your name.",
  join: "Join",
  badCharacter: "Codes don't use the letters I, L or O, or the numbers 0 or 1.",
} as const;

export const LOBBY_TEXT = {
  title: "Waiting room",
  code: "Game code",
  copy: "Copy",
  copied: "Copied!",
  copyFailed: "Couldn't copy. Tell your friends the code instead.",
  invite: "Share the code to invite friends.",
  players: "Players",
  host: "Host",
  addComputer: "Add computer player",
  addComputerAs: (colour: string) => `Add computer player as ${colour}`,
  waitingForPlayer: "Waiting for a player…",
  fillSeats: "Fill empty seats with computer players",
  start: "Start game",
  waitingForHost: (name: string) => `Waiting for ${name} to start.`,
  leave: "Leave",
} as const;

export const GAME_TEXT = {
  loading: "Getting the board ready…",
  menu: "Menu",
  rules: "Rules",
  sound: "Sound",
  yourTurn: "Your turn",
  timeUp: "Time's up — the computer will play for you.",
  sixes: "sixes",
  board: "Game board",
  players: "Players",
  safeSquare: "Safe square",
  yourMoves: "Your moves",
  move: "Move",
  skip: "Skip",
  wouldBeCaptured: "would be captured",
  // NFR-SYS-03. The button re-asks the server for the game, in words a 12-year-old can use.
  crashed: "Something went wrong — your game is safe",
  retry: "Try again",
} as const;

export const COLOUR_NAMES: Record<Colour, string> = {
  RED: "Red",
  GREEN: "Green",
  YELLOW: "Yellow",
  BLUE: "Blue",
};

// FR-SYS-02 POST-02-1: says whose turn it is in words.
export const TURN_TEXT = {
  myRoll: "Your turn — roll the dice",
  myMove: "Your turn — pick a piece",
  myAutoMove: "Your turn — moving your piece",
  computer: "Computer is thinking…",
  human: (name: string) => `${name}'s turn`,
} as const;

const PIECE_PLACES: Record<PiecePlace, string> = {
  base: "in base",
  track: "on the track",
  homeColumn: "in the home column",
  home: "home",
};

export function pieceLabel(
  colour: Colour,
  number: string,
  place: PiecePlace,
  onSafeSquare: boolean,
): string {
  const where = onSafeSquare ? `${PIECE_PLACES[place]}, on a safe square` : PIECE_PLACES[place];
  return `${COLOUR_NAMES[colour]} piece ${number}, ${where}`;
}

/** What one of the server's moves would do, worded to follow "can" or "Piece 2 →". */
export function moveChoiceText(
  from: PiecePlace,
  to: PiecePlace,
  squares: number,
  capturedNames: readonly string[],
): string {
  let action = squares === 1 ? "move 1 square" : `move ${squares} squares`;
  if (from === "base") action = "come out of base";
  else if (to === "home") action = "reach home";
  else if (to === "homeColumn" && from !== "homeColumn") action = "enter the home column";

  const [first] = capturedNames;
  if (first === undefined) return action;
  const victims = capturedNames.length === 1 ? `${first}'s piece` : `${capturedNames.length} pieces`;
  return `${action} and capture ${victims}`;
}

export function movablePieceLabel(pieceDescription: string, phrase: string): string {
  return `${pieceDescription}, can ${phrase}`;
}

export function moveCardText(number: string, phrase: string): string {
  return `Piece ${number} → ${phrase}`;
}

export const PLAYER_TAGS = {
  you: "you",
  computer: "Computer",
  offline: "Offline — computer playing",
} as const;

export const CONFIRM_TEXT = {
  body: "Your progress in this game will be lost.",
  leave: { title: "Leave this game?", action: "Leave" },
  restart: { title: "Restart the game?", action: "Restart" },
} as const;

export function diceLabel(face: number | null, rolling: boolean): string {
  if (rolling) return "Rolling the dice";
  return face === null ? "Roll the dice" : `The dice shows ${face}. Roll the dice`;
}

export function sixesLabel(sixesInRow: number): string {
  return `${sixesInRow} of 3 sixes in a row`;
}

export function secondsLeftLabel(seconds: number): string {
  return seconds === 1 ? "1 second left" : `${seconds} seconds left`;
}

// docs/03-ui-spec.md §6. Names, not colours, so the text works for colour-blind players.
export const MESSAGES = {
  gameStarted: (name: string) => `Game started. ${name} goes first.`,
  rolled: (name: string, roll: number) => `${name} rolled ${roll}.`,
  moved: (name: string, squares: number) => `${name} moved a piece ${squares} squares.`,
  broughtOut: (name: string) => `${name} brought a piece out.`,
  captured: (name: string, other: string) => `${name} captured ${other}'s piece!`,
  pieceFinished: (name: string) => `${name} got a piece home!`,
  bonusTurn: (name: string) => `${name} rolls again!`,
  turnPassed: (name: string) => `${name} can't move. Turn skipped.`,
  turnForfeited: (name: string) => `Three 6s in a row — ${name}'s turn is over.`,
  playerDisconnected: (name: string) => `${name} left. The computer will play for them.`,
  playerReconnected: (name: string) => `${name} is back.`,
  gameOver: (name: string) => `${name} wins!`,
} as const;

// D2 FR-07, NFR-SYS-11: RulesSummary picks from these using the match's RuleConfig.
export const RULES_TEXT = {
  standardTitle: "Standard rules",
  title: "How to play",
  goal: "Be the first to get all 4 of your pieces home.",
  leaveBase: "Roll a 6 to bring a piece out of base.",
  capture: "Land on another player's piece to send it back to base.",
  captureWithSafe: (count: number) =>
    `Land on another player's piece to send it back to base, except on the ${count} safe squares.`,
  exactRoll: "You need the exact number to reach home.",
  bonusOnSix: "Rolling a 6 gives you another turn.",
  bonusOnCapture: "Capturing a piece gives you another turn.",
  bonusOnFinish: "Getting a piece home gives you another turn.",
  threeSixes: "Three 6s in a row and your turn is over.",
  timer: (seconds: number) => `You have ${seconds} seconds for each turn.`,
  keyboardTitle: "Keyboard",
  keyColumn: "Key",
  actionColumn: "What it does",
} as const;

// docs/03-ui-spec.md §5.
export const KEYBOARD_HELP = [
  { key: "Tab / Shift+Tab", action: "Move between controls" },
  { key: "Enter / Space", action: "Press the control you are on" },
  { key: "R", action: "Roll, when you can" },
  { key: "1–4", action: "Pick your piece 1 to 4, if it can move" },
  { key: "Enter", action: "Confirm your move" },
  { key: "Esc", action: "Close a window, or cancel your choice" },
  { key: "?", action: "Open the rules" },
  { key: "S", action: "Skip the animation" },
] as const;
