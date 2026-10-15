// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DestructiveActionButton } from "./DestructiveActionButton";
import { PpConfirmProvider, usePpConfirm } from "./PpConfirm";

// jsdom has no matchMedia; framer-motion's useReducedMotion reads it
function stubMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: reduce && q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
}
beforeEach(() => stubMotion(false));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("DestructiveActionButton", () => {
  it("is a real, labelled, keyboard-operable button", async () => {
    const onClick = vi.fn();
    render(<DestructiveActionButton label="Delete" onClick={onClick} />);
    const btn = screen.getByRole("button", { name: /delete/i });
    btn.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("cannot be clicked while pending or after success (no duplicate submits)", async () => {
    const onClick = vi.fn();
    const { rerender } = render(<DestructiveActionButton status="pending" pendingLabel="Deleting…" onClick={onClick} />);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
    await userEvent.click(btn);
    rerender(<DestructiveActionButton status="success" successLabel="Deleted" onClick={onClick} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("failure leaves it enabled with a retry label, and announces the failure", async () => {
    const onClick = vi.fn();
    render(<DestructiveActionButton status="error" errorLabel="Try again" onClick={onClick} />);
    const btn = screen.getByRole("button", { name: /try again/i });
    expect(btn).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent(/failed/i);
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("keeps a fixed footprint class for every state (no layout shift)", () => {
    const { rerender } = render(<DestructiveActionButton onClick={() => {}} />);
    const cls = (s: "idle" | "pending" | "success" | "error") => {
      rerender(<DestructiveActionButton status={s} onClick={() => {}} />);
      return screen.getByRole("button").className;
    };
    for (const s of ["idle", "pending", "success", "error"] as const) expect(cls(s)).toMatch(/h-11 min-w-\[7\.5rem\]/);
  });

  it("the spinner and lid animations are removed under reduced motion (CSS motion-reduce)", () => {
    render(<DestructiveActionButton status="pending" onClick={() => {}} />);
    expect(document.querySelector("svg")?.getAttribute("class")).toMatch(/motion-reduce:animate-none/);
    cleanup();
    render(<DestructiveActionButton onClick={() => {}} />);
    expect(document.querySelector("g")?.getAttribute("class")).toMatch(/motion-reduce:/);
  });
});

function Harness({ action, onResult }: { action: () => Promise<unknown>; onResult: (v: boolean) => void }) {
  const confirm = usePpConfirm();
  return <button onClick={async () => onResult(await confirm({ message: "Delete this bill?", action }))}>open</button>;
}
const mount = (action: () => Promise<unknown>) => {
  const onResult = vi.fn();
  render(
    <PpConfirmProvider>
      <Harness action={action} onResult={onResult} />
    </PpConfirmProvider>,
  );
  return onResult;
};

describe("PpConfirm with a destructive action", () => {
  it("success is shown only after the action resolves, and the result is true only then", async () => {
    let finish!: () => void;
    const action = vi.fn(() => new Promise<void>((r) => (finish = r)));
    const onResult = mount(action);
    await userEvent.click(screen.getByText("open"));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("button", { name: /deleting/i })).toBeDisabled();
    expect(screen.queryAllByText("Deleted")).toHaveLength(0); // not confirmed yet
    expect(onResult).not.toHaveBeenCalled();
    await act(async () => finish());
    expect((await screen.findAllByText("Deleted")).length).toBeGreaterThan(0); // button label + screen-reader live region
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true), { timeout: 2000 });
  });

  it("a double click runs the action once", async () => {
    const action = vi.fn(() => new Promise<void>(() => {}));
    mount(action);
    await userEvent.click(screen.getByText("open"));
    const del = screen.getByRole("button", { name: "Delete" });
    await userEvent.dblClick(del);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("a failed action keeps the dialog open with the reason and a retry that can succeed", async () => {
    const action = vi.fn().mockRejectedValueOnce(new Error("Cannot delete wallet with 2 linked transaction(s).")).mockResolvedValueOnce(undefined);
    const onResult = mount(action);
    await userEvent.click(screen.getByText("open"));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/linked transaction/);
    expect(onResult).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true), { timeout: 2000 });
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("cancel resolves false and never runs the action", async () => {
    const action = vi.fn();
    const onResult = mount(action);
    await userEvent.click(screen.getByText("open"));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
    expect(action).not.toHaveBeenCalled();
  });

  it("has dialog semantics with the message as its description", async () => {
    mount(async () => {});
    await userEvent.click(screen.getByText("open"));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("Delete this bill?");
  });
});
