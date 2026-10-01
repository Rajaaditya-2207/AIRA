import {
  type Call,
  type Contact,
  type TranscriptEvent,
} from "@prisma/client";

import type {
  CallProgressItem,
  InvestigationStatus as InvestigationStatusLabel,
  PreferredLanguage as PreferredLanguageLabel,
  TranscriptLine,
  TranscriptSpeaker as TranscriptSpeakerLabel,
} from "@/lib/domain";

/**
 * SQLite stores statuses/speakers as plain TEXT. These unions replace the
 * Prisma-generated enums (removed in the SQLite migration) and keep the
 * exact same uppercase DB vocabulary the app has always used.
 */
type DbCallStatus =
  | "QUEUED"
  | "DIALING"
  | "RINGING"
  | "CONNECTED"
  | "ANALYZING"
  | "COMPLETED"
  | "FAILED";
type DbInvestigationStatus = "DRAFT" | "RUNNING" | "COMPLETED" | "FAILED";
type DbTranscriptSpeaker = "AGENT" | "CONTACT" | "SYSTEM";

export function toDbLanguage(value: PreferredLanguageLabel): string {
  return normalizeLanguage(value);
}

export function fromDbLanguage(value: string | null | undefined): PreferredLanguageLabel {
  return normalizeLanguage(value);
}

export function toDbCallStatus(value: CallProgressItem["status"]): DbCallStatus {
  return value.toUpperCase() as DbCallStatus;
}

export function fromDbCallStatus(value: DbCallStatus): CallProgressItem["status"] {
  return value.toLowerCase() as CallProgressItem["status"];
}

export function toDbInvestigationStatus(value: InvestigationStatusLabel): DbInvestigationStatus {
  return value.toUpperCase() as DbInvestigationStatus;
}

export function fromDbInvestigationStatus(value: string): InvestigationStatusLabel {
  return value.toLowerCase() as InvestigationStatusLabel;
}

export function fromDbTranscriptSpeaker(value: DbTranscriptSpeaker): TranscriptSpeakerLabel {
  return value.toLowerCase() as TranscriptSpeakerLabel;
}

export function toDbTranscriptSpeaker(value: TranscriptSpeakerLabel): DbTranscriptSpeaker {
  return value.toUpperCase() as DbTranscriptSpeaker;
}

type CallWithContact = Pick<Call, "id" | "status" | "score" | "startedAt" | "updatedAt" | "failureReason"> & {
  contact: Pick<Contact, "name" | "phone" | "language">;
};

type MapCallToProgressOptions = {
  recordingUrl?: string | null;
};

export function mapCallToProgressItem(
  call: CallWithContact,
  options?: MapCallToProgressOptions,
): CallProgressItem {
  const hasRecordingOption =
    options !== undefined &&
    options !== null &&
    typeof options === "object" &&
    "recordingUrl" in options;

  return {
    id: call.id,
    contactName: call.contact.name,
    phone: call.contact.phone,
    language: fromDbLanguage(call.contact.language),
    status: fromDbCallStatus(call.status as DbCallStatus),
    score: call.score,
    startedAt: call.startedAt ? call.startedAt.toISOString() : null,
    failureReason: call.failureReason,
    updatedAt: call.updatedAt.toISOString(),
    ...(hasRecordingOption ? { recordingUrl: options.recordingUrl ?? null } : {}),
  };
}

export function mapTranscriptToLine(
  transcript: Pick<TranscriptEvent, "id" | "callId" | "contactName" | "speaker" | "text" | "createdAt">,
): TranscriptLine {
  return {
    id: transcript.id,
    callId: transcript.callId,
    contactName: transcript.contactName,
    speaker: fromDbTranscriptSpeaker(transcript.speaker as DbTranscriptSpeaker),
    text: transcript.text,
    createdAt: transcript.createdAt.toISOString(),
  };
}

function normalizeLanguage(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : "english";
}
