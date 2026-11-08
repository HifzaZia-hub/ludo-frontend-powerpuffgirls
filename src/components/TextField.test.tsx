import { render, screen } from "@testing-library/react";
import { TextField } from "@/components/TextField";

describe("TextField", () => {
  // FR-SYS-01 ALT-01-1
  it("keeps the typed value when an error appears", () => {
    const noop = () => undefined;
    const { rerender } = render(<TextField label="Your name" value="Rida?" onChange={noop} />);

    rerender(<TextField label="Your name" value="Rida?" onChange={noop} error="Bad name." />);

    const input = screen.getByLabelText<HTMLInputElement>("Your name");
    expect(input.value).toBe("Rida?");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(input.getAttribute("aria-describedby") ?? "")?.textContent).toBe(
      "Bad name.",
    );
  });
});
