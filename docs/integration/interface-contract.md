# Integration Interface Contract

The front end communicates with two external components only through defined interfaces. Derived from D3 Section 3.3.

## 1. Front End ↔ Game Logic

Game Logic is the **authoritative source of truth** for rules, legal moves, dice results, turn changes, and win detection.

### Requests sent by the Front End
| Request | Payload | When sent |
|---|---|---|
| Setup request | mode (HvH/HvC), player count, seat names, colours, controller type | On Start Game |
| Roll request | current player / turn ID | Player clicks Roll Dice |
| Move request | selected piece ID, current roll / turn ID | Player selects a piece |

### Responses returned by Game Logic
| Response | Contains |
|---|---|
| Game state | players, turn, piece positions, progress, status |
| Legal move options | pieces that may legally move, destinations |
| Accepted / rejected status | plus explanation text when rejected |
| Game events | roll, move, capture, skipped turn, win |
| Completion status | winner, final state |

**Rule:** The Front End never computes or overrides rules. It only renders the latest accepted state.

## 2. Front End ↔ Game AI

The AI proposes a move for a computer-controlled seat. **Game Logic still validates the move.**

### Front End → AI
| Input | Contains |
|---|---|
| Current game state | board, players, piece positions |
| Legal move options | from Game Logic for this turn |
| (Optional) Difficulty | if difficulty levels are confirmed |

### AI → Front End
| Output | Contains |
|---|---|
| Chosen move | the move the AI wants to make |

The Front End then **submits this move to Game Logic** for validation before displaying it.

## 3. Error Handling
- If an external component returns an error or malformed response, the Front End keeps the **last known valid state**, shows a short message, and lets the player retry (supports NFR-SYS-04).
- Rejected moves never update displayed state.

## 4. Adapter Pattern
All communication goes through a single **integration adapter** module, so either external component can be replaced without redesigning the presentation layer (NFR-SYS-12).
