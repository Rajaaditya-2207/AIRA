/**
 * Maps raw internal error messages to user-friendly titles and hints.
 * Raw message is always preserved for the collapsible "details" section.
 */

type MappedError = {
  title: string;
  hint: string;
  raw: string;
};

const MAP: Array<{ test: RegExp; title: string; hint: string }> = [
  {
    test: /GEMINI_API_KEY/i,
    title: "AI parser isn't set up yet",
    hint: "Open Settings (gear icon) and add your Gemini API key to start parsing briefs.",
  },
  {
    test: /DATABASE_URL|P1001|ECONNREFUSED|SQLite/i,
    title: "Local database isn't ready",
    hint: "Restart AIRA. If it keeps happening, open Settings → Reveal data folder and check server.log.",
  },
  {
    test: /LIVEKIT|TWILIO|trunk|SIP/i,
    title: "Calling isn't configured yet",
    hint: "Add your LiveKit + Twilio keys in Settings to place real calls. Investigation tracking still works.",
  },
  {
    test: /Could not extract valid contact numbers|phone number/i,
    title: "No phone numbers found",
    hint: "Include at least one phone number in your brief, e.g. +91 98765 43210.",
  },
  {
    test: /Please provide more details/i,
    title: "Brief is too short",
    hint: "Describe what you need plus the contacts to call — a sentence or two is enough.",
  },
];

export function humanizeError(rawMessage: string): MappedError {
  const raw = rawMessage || "Unknown error";
  for (const entry of MAP) {
    if (entry.test.test(raw)) {
      return { title: entry.title, hint: entry.hint, raw };
    }
  }
  return { title: "Something went wrong", hint: "", raw };
}
