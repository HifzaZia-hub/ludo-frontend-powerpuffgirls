# Changelog

- P0: project scaffold with Vite, React, TypeScript, Tailwind, tooling and dark and light theme tokens (NFR-SYS-13).
- P1: contract types, board and player config, default rules and tested geometry functions (NFR-SYS-11).
- P2: standalone mock LGS with REST, sockets, game rules, computer players and debug scenarios (enables NFR-SYS-12).
- P3: `GameAdapter` with `LgsAdapter` and `FakeAdapter`, game and settings stores, friendly error copy and a temporary debug line (NFR-SYS-12, NFR-SYS-04, NFR-SYS-14, FR-SYS-04).
- P4: 17 shared components with a dev-only kitchen sink, message and rules copy, and colour tokens that meet the contrast target (NFR-SYS-07, NFR-SYS-08, NFR-SYS-01).
- P5: main screen, setup, join, lobby, settings and rules, with a stand-in game screen until P6 (FR-SYS-01, FR-SYS-10, D2 FR-07, FR-SYS-07).
- P6: read-only game screen with board, pieces, status panel, message area, crash screen and dev-only fixtures (FR-SYS-09, FR-SYS-06, NFR-SYS-10, NFR-SYS-11, NFR-SYS-03, D2 FR-07).
- P7: rolling the die, turn text, sixes counter and countdown, with the `R` key and a lint rule against `Math.random` (FR-SYS-02, NFR-SYS-05, FR-SYS-07).
