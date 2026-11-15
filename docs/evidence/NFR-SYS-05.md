# The die shows the server's value (NFR-SYS-05)

## `Dice.test.tsx`

Run on 2026-11-15:

```
npx vitest run src/components/Dice.test.tsx --reporter=verbose

 ✓ Dice > shows exactly the server's value once rolling ends
 ✓ Dice > lands on a 6 when the server rolled a 6
 ✓ Dice > keeps keyboard focus while it can't be pressed
 ✓ Dice > says it can be pressed when it can
 ✓ Dice > draws 1 pips for a %i … draws 6 pips for a %i   (one test for each face)
 ✓ Dice > shows no number while rolling, even with an older value
 ✓ Dice > ignores presses while rolling or disabled
 ✓ Dice > rolls from the keyboard
 Test Files  1 passed (1)
      Tests  13 passed (13)
```

`src/screens/GameScreen.test.tsx` also proves the die lands on the server's 6, 1 and 3 on the real
game screen.

## No `Math.random` in `src/`

```
grep -rn "Math.random" src --include=*.ts --include=*.tsx
(no results)
```

`eslint.config.js` also refuses `Math.random` anywhere in `src/` outside tests, with the message "The
server owns all randomness (NFR-SYS-05)", so a new one can't get past `npm run lint`.

## In a real match

`FR-SYS-02-dice-checks.md` and `NFR-SYS-05-die-shows-six.png` (P7) show rolls of 1, 3 and 6 forced
on the server, landing exactly on the die.
