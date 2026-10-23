import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PasswordInput } from "@/components/auth/PasswordInput";

describe("PasswordInput", () => {
  it("toggles visibility with an accessible button", async () => {
    const user = userEvent.setup();
    render(
      <PasswordInput
        id="new-password"
        name="password"
        label="New Password"
        autoComplete="new-password"
      />,
    );

    const input = screen.getByLabelText("New Password");
    const toggle = screen.getByRole("button", { name: "Show new password" });

    expect(input).toHaveProperty("type", "password");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");

    await user.click(toggle);

    expect(input).toHaveProperty("type", "text");
    expect(screen.getByRole("button", { name: "Hide new password" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("associates an error with the input", () => {
    render(
      <PasswordInput
        id="password"
        name="password"
        label="Password"
        autoComplete="new-password"
        error="Password is invalid"
      />,
    );

    expect(screen.getByLabelText("Password").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("Password is invalid");
  });
});
