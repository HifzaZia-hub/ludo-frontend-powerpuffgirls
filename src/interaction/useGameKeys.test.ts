import { fireEvent, renderHook } from "@testing-library/react";
import { useGameKeys } from "@/interaction/useGameKeys";

function setup() {
  const onRoll = vi.fn();
  const view = renderHook(() => useGameKeys(onRoll));
  return { onRoll, ...view };
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
});
