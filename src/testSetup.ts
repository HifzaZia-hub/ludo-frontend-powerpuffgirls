// Node 25 and later define their own localStorage, which is empty unless Node is started with
// --localstorage-file, and it hides the working one jsdom provides. Tests only: real browsers
// don't have this problem.
const { jsdom } = globalThis as { jsdom?: { window: Window } };

if (jsdom) vi.stubGlobal("localStorage", jsdom.window.localStorage);

// jsdom can't play audio. A test that cares about sound replaces this with its own stand-in.
vi.mock("howler", () => ({
  Howl: class {
    play(): void {}
  },
}));

// jsdom has no canvas to draw on.
vi.mock("canvas-confetti", () => ({ default: vi.fn(() => Promise.resolve()) }));

// jsdom has no showModal() or close(). These stand-ins only flip the open state: the real Esc,
// focus trap and focus return are the browser's job.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}
