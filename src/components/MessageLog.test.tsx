import { render, screen, within } from "@testing-library/react";
import { MessageLog } from "@/components/MessageLog";

const line = (id: number) => ({ id, text: `Line ${id}` });

describe("MessageLog", () => {
  it("has an empty message before anything has happened", () => {
    render(<MessageLog messages={[]} />);

    expect(screen.getByText("Moves will show up here.")).toBeTruthy();
  });

  it("shows the newest line largest, and announces it", () => {
    const { container } = render(<MessageLog messages={[line(1), line(2)]} />);

    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe("Line 2");
  });

  it("lists the earlier lines newest first", () => {
    render(<MessageLog messages={[line(1), line(2), line(3)]} />);

    const earlier = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(earlier.map((item) => item.textContent)).toEqual(["Line 2", "Line 1"]);
  });

  // docs/03-ui-spec.md S4: the last action plus the previous 5 to 8.
  it("keeps no more than 8 earlier lines", () => {
    render(<MessageLog messages={Array.from({ length: 12 }, (_, index) => line(index))} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(8);
  });
});
