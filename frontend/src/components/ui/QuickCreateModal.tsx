"use client";

import { useState } from "react";
import { FocusTrap } from "./FocusTrap";
import { Button } from "./Button";

export function QuickCreateModal({
  title,
  placeholder,
  onSave,
  onClose,
  isPending,
  error,
}: {
  title: string;
  placeholder: string;
  onSave: (name: string) => void;
  onClose: () => void;
  isPending: boolean;
  error?: string | null;
}) {
  const [name, setName] = useState("");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <FocusTrap active>
        <div className="w-full max-w-sm rounded-xl2 bg-white p-5 shadow-xl dark:bg-navy-dark" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-sm font-semibold text-navy dark:text-white">{title}</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) onSave(name.trim());
            }}
            className="mt-3"
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isPending || !name.trim()}>
                {isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </div>
      </FocusTrap>
    </div>
  );
}
