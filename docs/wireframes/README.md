# Game Screen Wireframe

A rough sketch of the main game screen layout.

    ┌─────────────────────────────────────────────┐
    │              LUDO GAME BOARD                │
    │                                             │
    │   ┌─────────────────────────────────────┐   │
    │   │                                     │   │
    │   │           [ GAME BOARD ]            │   │
    │   │      (track + 4 home corners)       │   │
    │   │                                     │   │
    │   └─────────────────────────────────────┘   │
    │                                             │
    │   [ 🎲 ROLL DICE ]    Active: Player 1 (Red)│
    │                                             │
    │   Player Progress:                          │
    │   🔴 Red:   Base 2 | Track 1 | Home 1       │
    │   🔵 Blue:  Base 4 | Track 0 | Home 0       │
    │   🟢 Green: Base 3 | Track 1 | Home 0       │
    │                                             │
    │   Message: "Player 1 rolled 6!"             │
    └─────────────────────────────────────────────┘

## Layout Elements
- **Game board** — centre of screen
- **Roll Dice button** — bottom left
- **Active player indicator** — bottom right
- **Player progress panel** — below board
- **Message area** — very bottom

## Related Requirements
- FR-SYS-09 — board, player and action info in one view
- FR-SYS-02 — active turn and dice result
- FR-SYS-03 — legal piece choices
