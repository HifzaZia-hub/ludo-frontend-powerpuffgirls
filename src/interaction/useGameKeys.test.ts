import { fireEvent, renderHook } from "@testing-library/react";
import { useGameKeys } from "@/interaction/useGameKeys";

function setup() {
  const keys = {
    onRoll: vi.fn(),
    onPickNumber: vi.fn(),
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    onSkip: vi.fn(),
  };
  const view = renderHook(() => useGameKeys(keys));
  return { ...keys, ...view };
}

describe("useGameKeys", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it.each(["r", "R"])("rolls on %s", (key) => {
    const { onRoll } = setup();

    fireEvent.keyDown(window, { key });

    expect(onRoll).toHaveBeenCalledTimes(1);
  });

  it("ignores other keys", () => {
    const { onRoll } = setup();

    fireEvent.keyDown(window, { key: "x" });

    expect(onRoll).not.toHaveBeenCalled();
  });

  // Ctrl+R has to stay a page reload.
  it.each([{ ctrlKey: true }, { metaKey: true }, { altKey: true }])(
    "leaves R alone with %j",
    (modifier) => {
      const { onRoll } = setup();

      fireEvent.keyDown(window, { key: "r", ...modifier });

      expect(onRoll).not.toHaveBeenCalled();
    },
  );

  it("doesn't roll again while the key is held down", () => {
    const { onRoll } = setup();

    fireEvent.keyDown(window, { key: "r", repeat: true });

    expect(onRoll).not.toHaveBeenCalled();
  });

  // docs/03-ui-spec.md §5: never take a key while the player is typing.
  it("leaves R alone in a text field", () => {
    const { onRoll } = setup();
    const input = document.body.appendChild(document.createElement("input"));

    fireEvent.keyDown(input, { key: "r" });

    expect(onRoll).not.toHaveBeenCalled();
  });

  it("leaves R alone while a window is open", () => {
    const { onRoll } = setup();
    document.body.appendChild(document.createElement("dialog")).setAttribute("open", "");

    fireEvent.keyDown(window, { key: "r" });

    expect(onRoll).not.toHaveBeenCalled();
  });

  it("stops listening when the game screen goes away", () => {
    const { onRoll, unmount } = setup();

    unmount();
    fireEvent.keyDown(window, { key: "r" });

    expect(onRoll).not.toHaveBeenCalled();
  });

  // NFR-SYS-08: swapping listeners after each draw left a moment when a key was lost.
  it("keeps one listener and uses the newest handlers", () => {
    const added = vi.spyOn(window, "addEventListener");
    const first = { onRoll: vi.fn(), onPickNumber: vi.fn(), onConfirm: vi.fn(), onCancel: vi.fn(), onSkip: vi.fn() };
    const second = { ...first, onRoll: vi.fn() };
    const { rerender } = renderHook(({ keys }) => useGameKeys(keys), {
      initialProps: { keys: first },
    });
    const listenersAtFirst = added.mock.calls.filter(([type]) => type === "keydown").length;

    rerender({ keys: second });
    fireEvent.keyDown(window, { key: "r" });

    expect(added.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(listenersAtFirst);
    expect(second.onRoll).toHaveBeenCalledTimes(1);
    expect(first.onRoll).not.toHaveBeenCalled();
    added.mockRestore();
  });

  describe("choosing a move", () => {
    it.each(["1", "2", "3", "4"])("picks piece %s", (key) => {
      const { onPickNumber } = setup();

      fireEvent.keyDown(window, { key });

      expect(onPickNumber).toHaveBeenCalledWith(key);
    });

    it.each(["0", "5"])("has no piece %s to pick", (key) => {
      const { onPickNumber } = setup();

      fireEvent.keyDown(window, { key });

      expect(onPickNumber).not.toHaveBeenCalled();
    });

    it("confirms with Enter when nothing else has focus", () => {
      const { onConfirm } = setup();

      fireEvent.keyDown(document.body, { key: "Enter" });

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    // Enter on a button already presses it, so sending here as well would count twice.
    it("leaves Enter to the button that has focus", () => {
      const { onConfirm } = setup();
      const button = document.body.appendChild(document.createElement("button"));

      fireEvent.keyDown(button, { key: "Enter" });

      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("cancels with Escape", () => {
      const { onCancel } = setup();

      fireEvent.keyDown(window, { key: "Escape" });

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("leaves Escape to an open window", () => {
      const { onCancel } = setup();
      document.body.appendChild(document.createElement("dialog")).setAttribute("open", "");

      fireEvent.keyDown(window, { key: "Escape" });

      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  it.each(["s", "S"])("skips the animation on %s", (key) => {
    const { onSkip } = setup();

    fireEvent.keyDown(window, { key });

    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
