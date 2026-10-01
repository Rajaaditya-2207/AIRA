"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheckBig, ListChecks, PhoneCall, Sparkles } from "lucide-react";

import { ContactRow, type EditableContact } from "@/components/contacts/contact-row";
import { QuestionHintsEditor } from "@/components/intake/question-hints-editor";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GridPattern } from "@/components/ui/grid-pattern";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShineBorder } from "@/components/ui/shine-border";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { Textarea } from "@/components/ui/textarea";
import type { ParsedIntakePreview } from "@/lib/domain";
import { createInvestigationStructuredSchema } from "@/lib/validation/investigation";

const EXAMPLE_BRIEF = `Need a PG in Koramangala under 15k with food.
Contacts:
Asha PG, +919900011111, Tamil
Rahul (City Stay), +919900022222
Questions: deposit, curfew, move-in date`;

type FieldErrors = Record<number, { name?: boolean; phone?: boolean }>;

export default function Home() {
  const router = useRouter();
  const [inputText, setInputText] = useState("");
  const [voiceAgentName, setVoiceAgentName] = useState("");
  const [preview, setPreview] = useState<ParsedIntakePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [agentNameError, setAgentNameError] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = inputText.trim().length > 12;
  const effectiveVoiceAgentName = voiceAgentName.trim() || "assistant";

  const extractPreview = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!canSubmit) {
      return;
    }
    setParsing(true);
    setError(null);
    setPreview(null);

    try {
      const parseResponse = await fetch("/api/intake/parse", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          inputText,
        }),
      });

      const payload = (await parseResponse.json().catch(() => null)) as
        | (ParsedIntakePreview & { error?: string })
        | null;
      if (!parseResponse.ok) {
        throw new Error(payload?.error ?? "Could not extract details from input.");
      }
      if (!payload) {
        throw new Error("Parser did not return extracted details.");
      }

      setPreview({
        requirement: payload.requirement,
        contacts: payload.contacts,
        questionHints: payload.questionHints ?? [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not extract details.");
    } finally {
      setParsing(false);
    }
  };

  const updateContact = (index: number, next: EditableContact) => {
    setPreview((current) => {
      if (!current) return current;
      const contacts = current.contacts.map((contact, i) =>
        i === index ? { ...contact, ...next } : contact,
      );
      return { ...current, contacts };
    });
  };

  const removeContact = (index: number) => {
    setPreview((current) => {
      if (!current) return current;
      return { ...current, contacts: current.contacts.filter((_, i) => i !== index) };
    });
  };

  const addContact = () => {
    setPreview((current) => {
      if (!current) return current;
      return {
        ...current,
        contacts: [...current.contacts, { name: "", phone: "", language: "english" }],
      };
    });
  };

  /** Client-side validation mirroring the API schema; returns true when valid. */
  const validatePreview = (): boolean => {
    if (!preview) return false;
    const result = createInvestigationStructuredSchema.safeParse({
      requirement: preview.requirement,
      contacts: preview.contacts,
      questionHints: preview.questionHints,
    });

    if (result.success) {
      setFieldErrors({});
      return true;
    }

    const errors: FieldErrors = {};
    for (const issue of result.error.issues) {
      const contactIndex = issue.path[0];
      const field = issue.path[1];
      if (typeof contactIndex === "number" && field === "name") {
        errors[contactIndex] = { ...errors[contactIndex], name: true };
      }
      if (typeof contactIndex === "number" && field === "phone") {
        errors[contactIndex] = { ...errors[contactIndex], phone: true };
      }
    }
    setFieldErrors(errors);
    setError("Fix the highlighted contact rows before launching.");
    return false;
  };

  const startInvestigation = async () => {
    const nameMissing = !voiceAgentName.trim() && !advancedOpen;
    setAgentNameError(false);
    if (!preview) {
      setError("Extract and review the brief first.");
      return;
    }
    if (!validatePreview()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const createResponse = await fetch("/api/investigations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          requirement: preview.requirement,
          contacts: preview.contacts,
          questionHints: preview.questionHints,
        }),
      });

      if (!createResponse.ok) {
        const payload = (await createResponse.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Could not create investigation.");
      }

      const createPayload = (await createResponse.json()) as { investigationId: string };
      const investigationId = createPayload.investigationId;

      const startResponse = await fetch(`/api/investigations/${investigationId}/start`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          agentName: effectiveVoiceAgentName,
        }),
      });

      if (!startResponse.ok) {
        throw new Error("Investigation was created but could not start.");
      }

      router.push(`/investigations/${investigationId}/live`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start investigation.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="aira-page aira-glow relative flex flex-col gap-8 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <GridPattern
          width={36}
          height={36}
          x={-1}
          y={-1}
          className="text-primary/10 mask-[radial-gradient(circle_at_center,white,transparent_80%)]"
        />
      </div>

      <header className="space-y-3">
        <p className="text-eyebrow">New investigation</p>
        <h1 className="max-w-3xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          <AnimatedGradientText speed={1.1}>AIRA</AnimatedGradientText>
          <span className="text-foreground"> — what should it </span>
          <span className="text-foreground">find out</span>
          <span className="text-foreground"> for you?</span>
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
          Paste your brief and contacts. AIRA calls everyone, verifies answers, and brings back
          evidence. Fix anything before a call goes out.
        </p>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface/70 px-3 py-1">
            <PhoneCall className="size-3.5" /> multilingual calls
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface/70 px-3 py-1">
            <ListChecks className="size-3.5" /> structured extraction
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface/70 px-3 py-1">
            <CircleCheckBig className="size-3.5" /> edit before launch
          </span>
        </div>
      </header>

      <section className="grid min-w-0 gap-6 lg:grid-cols-[7fr_5fr]">
        <Card className="relative min-w-0 overflow-hidden border-border/70 bg-card/75 shadow-xl backdrop-blur-sm">
          <ShineBorder borderWidth={1} duration={12} shineColor={["#4f46e5", "#06b6d4"]} />
          <CardHeader className="space-y-1">
            <p className="text-eyebrow">Brief</p>
            <CardTitle className="font-display text-xl">Create Investigation</CardTitle>
            <CardDescription>One paste. AIRA structures the rest.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={extractPreview}>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="inputText" className="sr-only">
                    Briefing
                  </Label>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                    onClick={() => setInputText(EXAMPLE_BRIEF)}
                  >
                    Load example brief
                  </button>
                </div>
                <Textarea
                  id="inputText"
                  className="min-h-56 resize-y border-border/70 bg-background/70 shadow-sm"
                  placeholder={
                    "Example:\nNeed a PG in Koramangala under 15k with food.\nContacts:\nAsha PG, +9198…, Tamil\nRahul (City Stay), +9198…\nQuestions: deposit, curfew"
                  }
                  value={inputText}
                  onChange={(event) => {
                    setInputText(event.target.value);
                    setPreview(null);
                    setError(null);
                  }}
                  rows={11}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Include at least one phone number. Language is optional.</span>
                  <span className="font-mono tabular-nums">{inputText.length}/10000</span>
                </div>
              </div>

              {!preview && error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <ShimmerButton
                  type="submit"
                  disabled={!canSubmit || parsing || submitting}
                  className="h-10 px-5 text-sm"
                >
                  <Sparkles className="size-4" />
                  {parsing ? "Parsing..." : "Preview Extraction"}
                </ShimmerButton>
                {preview ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setPreview(null);
                      setError(null);
                      setFieldErrors({});
                    }}
                  >
                    Reset Preview
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        {preview ? (
          <Card className="relative min-w-0 overflow-hidden border-primary/30 bg-card/80 shadow-xl backdrop-blur-sm">
            <ShineBorder borderWidth={1} duration={10} shineColor={["#06b6d4", "#4f46e5"]} />
            <CardHeader className="space-y-1">
              <p className="text-eyebrow">Review &amp; launch</p>
              <CardTitle className="font-display text-xl">Ready when you are</CardTitle>
              <CardDescription>
                Fix anything the AI misheard — calls go out exactly as listed here.
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0 space-y-5">
              <div className="min-w-0 space-y-4 rounded-2xl border border-border/70 bg-background/70 p-4">
                <div>
                  <p className="text-eyebrow mb-1">Requirement</p>
                  <textarea
                    value={preview.requirement}
                    onChange={(event) =>
                      setPreview((current) =>
                        current ? { ...current, requirement: event.target.value } : current,
                      )
                    }
                    rows={3}
                    className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  />
                </div>

                <div className="min-w-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-eyebrow">Contacts ({preview.contacts.length})</p>
                    <Button type="button" size="sm" variant="outline" onClick={addContact}>
                      Add contact
                    </Button>
                  </div>
                  <div className="min-w-0 space-y-2">
                    {preview.contacts.map((contact, index) => (
                      <ContactRow
                        key={`${index}-${contact.phone}-${contact.name}`}
                        contact={contact}
                        index={index}
                        invalid={fieldErrors[index]}
                        onChange={updateContact}
                        onRemove={removeContact}
                        canRemove={preview.contacts.length > 1}
                      />
                    ))}
                  </div>
                </div>

                <div className="min-w-0 space-y-2">
                  <p className="text-eyebrow">Question hints</p>
                  <QuestionHintsEditor
                    hints={preview.questionHints}
                    onChange={(hints) =>
                      setPreview((current) => (current ? { ...current, questionHints: hints } : current))
                    }
                  />
                </div>

                <div className="rounded-xl border border-border/60">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-xs text-muted-foreground"
                    onClick={() => setAdvancedOpen((current) => !current)}
                  >
                    Advanced — voice agent name
                    <span className="font-mono">{advancedOpen ? "−" : "+"}</span>
                  </button>
                  {advancedOpen ? (
                    <div className="space-y-1.5 border-t border-border/60 px-3 py-3">
                      <Label htmlFor="voiceAgentName" className="text-xs">
                        Name the AI introduces itself with{" "}
                        <span className="font-mono text-muted-foreground">(default: assistant)</span>
                      </Label>
                      <Input
                        id="voiceAgentName"
                        value={voiceAgentName}
                        onChange={(event) => setVoiceAgentName(event.target.value)}
                        placeholder="e.g., Loki"
                        aria-invalid={agentNameError}
                        className={agentNameError ? "border-destructive" : undefined}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Used only for this launch, never saved.
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <ShimmerButton
                type="button"
                disabled={parsing || submitting}
                className="h-11 w-full px-5 text-sm"
                onClick={() => {
                  void startInvestigation();
                }}
              >
                {submitting ? "Launching calls..." : "Launch Investigation"}
              </ShimmerButton>
            </CardContent>
          </Card>
        ) : (
          <Card className="relative min-w-0 overflow-hidden border-border/70 bg-card/60 shadow-lg">
            <ShineBorder borderWidth={1} duration={14} shineColor={["#3730a3", "#4f46e5"]} />
            <CardHeader className="space-y-1">
              <p className="text-eyebrow">What happens next</p>
              <CardTitle className="font-display text-xl">Guardrails before airtime</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                AIRA parses your freeform brief into a structured requirement and contact list.
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                You review, fix names, numbers, languages, and questions before anything dials.
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                Launch, then watch every conversation live — transcripts and recordings included.
              </div>
              <Badge variant="outline" className="mt-1 border-border/60 font-mono text-[10px]">
                nothing dials until you approve
              </Badge>
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  );
}
