// Node 25 and later define their own localStorage, which is empty unless Node is started with
// --localstorage-file, and it hides the working one jsdom provides. Tests only: real browsers
// don't have this problem.
const { jsdom } = globalThis as { jsdom?: { window: Window } };

if (jsdom) vi.stubGlobal("localStorage", jsdom.window.localStorage);
