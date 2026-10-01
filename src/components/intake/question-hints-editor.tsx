"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Input } from "@/components/ui/input";

type QuestionHintsEditorProps = {
  hints: string[];
  onChange: (hints: string[]) => void;
};

export function QuestionHintsEditor({ hints, onChange }: QuestionHintsEditorProps) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onChange([...hints, trimmed]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      {hints.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {hints.map((hint, index) => (
            <li
              key={`${index}-${hint}`}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/70 bg-secondary px-3 py-1 text-xs text-secondary-foreground"
            >
              <span className="truncate">{hint}</span>
              <button
                type="button"
                aria-label={`Remove question: ${hint}`}
                className="rounded-full p-0.5 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onChange(hints.filter((_, i) => i !== index))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No extra questions — the AI will ask sensible defaults.</p>
      )}
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder="Add a question to ask on calls…"
        />
        <button
          type="button"
          onClick={add}
          aria-label="Add question"
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md border border-border/70 bg-background px-3 text-sm transition-colors hover:bg-accent"
        >
          <Plus className="size-4" /> Add
        </button>
      </div>
    </div>
  );
}
