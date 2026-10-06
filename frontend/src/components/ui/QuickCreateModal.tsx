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
  const [localErr, setLocalErr] = useState("");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 animate-popup-backdrop" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <FocusTrap active>
        <div className="w-full max-w-sm rounded-xl2 bg-white p-5 shadow-xl dark:bg-pp-surface animate-popup-panel" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-sm font-semibold text-pp-text">{title}</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = name.trim();
              if (!v) { setLocalErr("Enter a name."); return; }
              if (v.length > 50) { setLocalErr("Keep the name under 50 characters."); return; }
              setLocalErr("");
              onSave(v);
            }}
            className="mt-3"
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => { setName(e.target.value); setLocalErr(""); }}
              placeholder={placeholder}
              maxLength={50}
              aria-label={title}
              aria-invalid={localErr || error ? true : undefined}
              aria-describedby={localErr || error ? "qc-err" : undefined}
              className="w-full rounded-lg border border-pp-border bg-transparent px-3 py-2 text-sm text-pp-text aria-[invalid=true]:border-pp-critical"
            />
            {(localErr || error) && <p id="qc-err" role="alert" className="mt-1 text-xs font-medium text-pp-critical">{localErr || error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </div>
      </FocusTrap>
    </div>
  );
}
