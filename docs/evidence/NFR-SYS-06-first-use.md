# First-time player test (NFR-SYS-06)

**Status: not run yet.** This needs a real person who has never seen the app, so a script can't do
it. Fill in the "Result" section after the test, then commit this file.

## What we are checking

From `docs/00-requirements.md`: "First-time player completes a first turn without help." The design
supports it with the rules summary, highlighted pieces and friendly words.

## How to run it (about 5 minutes)

1. Start `npm run mock` and `npm run dev`, and open the app in Chrome, Firefox or Edge.
2. Pick someone who hasn't seen the app. Ideally someone like our D2 personas: a child, or an adult
   who doesn't play computer games much.
3. Say only: "This is a Ludo game. Please start a game against the computer and play your first turn.
   I can't help, but please say out loud what you are thinking."
4. Don't point, explain or answer questions. Note the time when they start.
5. Stop when they have finished their first turn (rolled, and moved a piece if they could), or after
   5 minutes.
6. Afterwards, ask: "What was confusing?" and "What did you expect to happen that didn't?"

## What to write down

- Did they finish a first turn alone? How long did it take?
- Where did they hesitate or click the wrong thing?
- Did they open "How to play"? Did it help?
- Did they understand the highlighted pieces, the list of moves, and the Move button?
- Anything they said that shows a word or message wasn't clear.

## Result

| | |
|---|---|
| Date | |
| Who (no full name, e.g. "cousin, 11") | |
| Finished a first turn alone? | |
| Time taken | |
| Opened How to play? | |

**What confused them:**

-

**What we changed because of it:**

-
