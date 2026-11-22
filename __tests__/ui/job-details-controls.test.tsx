import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Chip } from "@/components/ui/Chip";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { FormField } from "@/components/ui/FormField";
import { TagInput, type TagAddResult } from "@/components/ui/TagInput";

afterEach(cleanup);

const options = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
] as const;

function addTag(tags: string[], raw: string): TagAddResult {
  const tag = raw.trim();
  if (!tag) return { status: "rejected", reason: "empty" };
  if (tags.some((item) => item.toLowerCase() === tag.toLowerCase())) return { status: "rejected", reason: "duplicate" };
  return { status: "added", tags: [...tags, tag] };
}

describe("Chip", () => {
  it("renders a labelled remove button when requested", async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    render(<Chip onRemove={onRemove} removeLabel="Remove React">React</Chip>);
    await user.click(screen.getByRole("button", { name: "Remove React" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});

describe("ChoiceGroup", () => {
  function renderChoices(defaultValue = "") {
    return render(
      <form aria-label="job details">
        <FormField as="group" name="work_format" label="Work arrangement">
          <ChoiceGroup legend="Work arrangement" options={options} defaultValue={defaultValue} clearLabel="Clear work arrangement" />
        </FormField>
      </form>,
    );
  }

  it("selects with native radios and posts the selected value", async () => {
    const user = userEvent.setup();
    const { container } = renderChoices();
    await user.click(screen.getByLabelText("Remote"));
    expect((screen.getByLabelText("Remote") as HTMLInputElement).checked).toBe(true);
    expect(new FormData(container.querySelector("form")!).get("work_format")).toBe("remote");
  });

  it("honours a default, supports arrow keys, and clears", async () => {
    const user = userEvent.setup();
    renderChoices("remote");
    const remote = screen.getByLabelText("Remote");
    expect((remote as HTMLInputElement).checked).toBe(true);
    remote.focus();
    await user.keyboard("{ArrowDown}");
    expect((screen.getByLabelText("Hybrid") as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole("button", { name: "Clear work arrangement" }));
    expect((screen.getByLabelText("Hybrid") as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByRole("button", { name: "Clear work arrangement" })).toBeNull();
  });

  it("uses the dark selected style and clears when the selected option is clicked again", async () => {
    const user = userEvent.setup();
    renderChoices();
    const remote = screen.getByLabelText("Remote");

    await user.click(remote);
    expect(remote.closest("label")?.className).toContain("is-selected");
    await user.click(remote);
    expect((remote as HTMLInputElement).checked).toBe(false);
  });
});

describe("TagInput", () => {
  function renderTags(defaultValue: string[] = []) {
    return render(
      <form aria-label="job details">
        <FormField name="tech_stack" label="Required technologies">
          <TagInput
            defaultValue={defaultValue}
            addTag={addTag}
            placeholder="Add a technology"
            removeLabel={(tag) => `Remove ${tag}`}
            announce={{ added: (tag) => `${tag} added`, removed: (tag) => `${tag} removed` }}
            rejectionMessages={{ duplicate: "Already added" }}
          />
        </FormField>
        <button type="submit">Save</button>
      </form>,
    );
  }

  it("adds with Enter, submits repeated hidden inputs, and removes chips", async () => {
    const user = userEvent.setup();
    const { container } = renderTags();
    const input = screen.getByRole("textbox", { name: "Required technologies" });
    await user.type(input, "React{Enter}TypeScript{Enter}");
    expect(within(screen.getByRole("list", { name: /label/i })).getAllByRole("listitem")).toHaveLength(2);
    expect([...new FormData(container.querySelector("form")!).getAll("tech_stack")]).toEqual(["React", "TypeScript"]);
    await user.click(screen.getByRole("button", { name: "Remove React" }));
    expect(screen.queryByText("React")).toBeNull();
  });

  it("adds on comma and blur, removes on Backspace, and rejects duplicates", async () => {
    const user = userEvent.setup();
    renderTags(["React"]);
    const input = screen.getByRole("textbox", { name: "Required technologies" });
    await user.type(input, "TypeScript,");
    expect(screen.getByText("TypeScript")).toBeTruthy();
    await user.type(input, "React{Enter}");
    expect(screen.getByRole("status").textContent).toContain("Already added");
    await user.clear(input);
    await user.keyboard("{Backspace}");
    expect(screen.queryByText("TypeScript")).toBeNull();
  });
});
