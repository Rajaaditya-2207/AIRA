"use client";

import { Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { PREFERRED_LANGUAGES } from "@/lib/domain";

export type EditableContact = {
  name: string;
  phone: string;
  language: string;
};

type ContactRowProps = {
  contact: EditableContact;
  index: number;
  invalid?: { name?: boolean; phone?: boolean };
  onChange: (index: number, next: EditableContact) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
};

export function ContactRow({ contact, index, invalid, onChange, onRemove, canRemove }: ContactRowProps) {
  const update = (patch: Partial<EditableContact>) => {
    onChange(index, { ...contact, ...patch });
  };

  return (
    <div className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2">
      <div className="space-y-1">
        <Input
          aria-label={`Contact ${index + 1} name`}
          value={contact.name}
          onChange={(event) => update({ name: event.target.value })}
          placeholder="Name"
          className={invalid?.name ? "border-destructive" : undefined}
        />
      </div>
      <div className="space-y-1">
        <Input
          aria-label={`Contact ${index + 1} phone`}
          value={contact.phone}
          onChange={(event) => update({ phone: event.target.value })}
          placeholder="+91 98765 43210"
          inputMode="tel"
          className={invalid?.phone ? "border-destructive" : undefined}
        />
      </div>
      <select
        aria-label={`Contact ${index + 1} language`}
        value={contact.language}
        onChange={(event) => update({ language: event.target.value })}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm capitalize shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {PREFERRED_LANGUAGES.map((language) => (
          <option key={language.value} value={language.value}>
            {language.label}
          </option>
        ))}
        {!PREFERRED_LANGUAGES.some((language) => language.value === contact.language) ? (
          <option value={contact.language}>{contact.language}</option>
        ) : null}
      </select>
      <button
        type="button"
        aria-label={`Remove ${contact.name || `contact ${index + 1}`}`}
        disabled={!canRemove}
        onClick={() => onRemove(index)}
        className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
