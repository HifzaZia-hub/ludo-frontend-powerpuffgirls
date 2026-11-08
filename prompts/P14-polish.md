# P14 — Polish

**Do not start until `v1.0-mvp` is tagged.** Nothing here is in our D2/D3.
Commit each item separately so any can be reverted before the demo.

In this order — stop when time runs out:

1. **Extra board themes** (Dark Neon, Forest, Minimal). Each is only a block
   of CSS variables. Success test: a new theme touches one CSS file, zero
   components. Check contrast.
2. **Win polish** — staggered ranking reveal, a copyable result line.
3. **3D die** — install `@react-three/fiber` + `@react-three/drei` now. One
   rounded cube, lands on `turn.lastRoll`. Lazy-load it; keep the 2D die as
   fallback and as the default when Animations is Off. Must stay keyboard
   operable (the button around it, not the canvas).
4. **3D pieces** (highest risk) — `<PieceLayer3D>` with the **same props** as
   `<PieceLayer>`, swapped by a setting. Ship only if: 50+ fps on the slowest
   team laptop, piece selection still works by keyboard, 2D stays the default,
   and it can be turned off in one click.
5. **Music** with its own toggle, off by default.

After each item: `/verify` still passes and P12's keyboard-only run still
works. If any item breaks an NFR, revert it — the NFRs are graded, this is not.
