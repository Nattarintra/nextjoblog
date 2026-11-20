import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_ICON_SIZE, Icon, ICON_NAMES } from "@/components/ui/icons";

afterEach(cleanup);

describe("Icon", () => {
  it.each(ICON_NAMES)("renders %s as a decorative svg", (name) => {
    const { container } = render(<Icon name={name} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("width")).toBe(String(DEFAULT_ICON_SIZE));
    expect(svg?.childElementCount).toBeGreaterThan(0);
  });

  it("honours a custom size", () => {
    const { container } = render(<Icon name="plus" size={30} />);
    expect(container.querySelector("svg")?.getAttribute("height")).toBe("30");
  });
});
