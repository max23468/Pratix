// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUnsavedChangesGuard } from "./unsaved-changes-guard";

type NavigationBlocker = {
  blockerFn: () => boolean | Promise<boolean>;
  enableBeforeUnload?: boolean;
};

let activeBlocker: NavigationBlocker | null = null;

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({
    history: {
      block: (blocker: NavigationBlocker) => {
        activeBlocker = blocker;
        return () => {
          activeBlocker = null;
        };
      },
    },
  }),
}));

function UnsavedGuardHarness({ onSaved }: { onSaved: () => void }) {
  const { finishSave, formRef, guardDialog, markDirty } = useUnsavedChangesGuard();

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        finishSave();
        onSaved();
      }}
    >
      <label htmlFor="field">Nome</label>
      <input id="field" onChange={markDirty} />
      <button type="submit">Salva</button>
      {guardDialog}
    </form>
  );
}

describe("useUnsavedChangesGuard", () => {
  beforeEach(() => {
    activeBlocker = null;
  });

  afterEach(() => {
    cleanup();
  });

  it("non blocca la navigazione se il form non è stato modificato", async () => {
    render(<UnsavedGuardHarness onSaved={vi.fn()} />);

    expect(activeBlocker).not.toBeNull();

    const result = await Promise.resolve(activeBlocker!.blockerFn());

    expect(result).toBe(false);
    expect(screen.queryByText("Modifiche non salvate")).toBeNull();
  });

  it("non blocca la navigazione avviata subito dopo il salvataggio", async () => {
    const onSaved = vi.fn();
    render(<UnsavedGuardHarness onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Ada" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));

    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(activeBlocker).not.toBeNull();

    const result = await act(async () => {
      const blockerResult = activeBlocker!.blockerFn();
      return Promise.race([
        Promise.resolve(blockerResult),
        new Promise((resolve) => window.setTimeout(() => resolve("blocked"), 0)),
      ]);
    });

    expect(result).toBe(false);
    expect(screen.queryByText("Modifiche non salvate")).toBeNull();
  });
});
