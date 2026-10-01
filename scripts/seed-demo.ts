/**
 * Demo seed: fills the SQLite DB with a realistic completed investigation
 * (2 successful calls with findings/transcripts/recommendations, 1 failed
 * call) plus local WAV recordings, so the whole UI is explorable without
 * telephony or AI credentials.
 *
 * Usage:
 *   DATABASE_URL="file:./prisma/dev.db" npm run db:seed
 *
 * Idempotent: wipes demo tables before inserting.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith("file:")) {
  console.error("Run with DATABASE_URL=\"file:./prisma/dev.db\" npm run db:seed");
  process.exit(1);
}

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

type SeedCall = {
  name: string;
  phone: string;
  language: string;
  status: "COMPLETED" | "FAILED";
  score?: number;
  failureReason?: string;
  finding?: {
    monthlyPrice: number | null;
    availability: string | null;
    locationFit: string | null;
    rules: string[];
    confidence: number;
    summary: string;
  };
  transcript: Array<{ speaker: "AGENT" | "CONTACT"; text: string }>;
};

const INVESTIGATION_REQUIREMENT = [
  "Need a PG in Koramangala under 15k with food.",
  "",
  "Priority questions user wants answered:",
  "1. What is the monthly rent and what does it include?",
  "2. Is there a security deposit and how much?",
  "3. What are the food timings and menu?",
].join("\n");

const CALLS: SeedCall[] = [
  {
    name: "Asha Homes",
    phone: "+919900011111",
    language: "tamil",
    status: "COMPLETED",
    score: 86,
    finding: {
      monthlyPrice: 13000,
      availability: "Immediate move-in, one room left",
      locationFit: "5th Block Koramangala, 10 min walk from metro",
      rules: ["Two-wheeler parking only", "No non-veg cooking in rooms", "Gate closes at 11 PM"],
      confidence: 0.91,
      summary:
        "Twin sharing at INR 13000/month including food (veg). Deposit INR 10000 refundable. Immediate move-in available.",
    },
    transcript: [
      { speaker: "AGENT", text: "Hello sir, this is Loki calling regarding the PG enquiry in Koramangala. Am I speaking with Asha Homes?" },
      { speaker: "CONTACT", text: "Yes, tell me. You need PG details?" },
      { speaker: "AGENT", text: "Yes. Could you share the monthly rent and what is included in it?" },
      { speaker: "CONTACT", text: "Twin sharing is thirteen thousand per month, food included. Veg meals only." },
      { speaker: "AGENT", text: "Understood. Is there a security deposit?" },
      { speaker: "CONTACT", text: "Ten thousand deposit, fully refundable when you leave." },
      { speaker: "AGENT", text: "Is any room available for immediate move-in? And what about food timings?" },
      { speaker: "CONTACT", text: "One room is free, you can move in tomorrow itself. Breakfast 8 to 9, dinner 8 to 9.30 at night." },
      { speaker: "AGENT", text: "Any house rules I should know about?" },
      { speaker: "CONTACT", text: "Gate closes eleven PM, two-wheeler parking only, and no non-veg cooking inside rooms." },
      { speaker: "AGENT", text: "Perfect, thank you so much. I will share these details and someone will visit soon." },
      { speaker: "CONTACT", text: "Okay, welcome. Come and see the room anytime." },
    ],
  },
  {
    name: "City Stay PG",
    phone: "+919900022222",
    language: "english",
    status: "COMPLETED",
    score: 74,
    finding: {
      monthlyPrice: 14500,
      availability: "Available from next Monday",
      locationFit: "Near Wipro Gate, Koramangala 6th Block",
      rules: ["Curfew 10 PM", "Deposit one month rent"],
      confidence: 0.84,
      summary:
        "Triple sharing at INR 14500 including breakfast only. Deposit equal to one month rent. Available from next Monday.",
    },
    transcript: [
      { speaker: "AGENT", text: "Hi, this is Loki calling about the PG in Koramangala. Is this City Stay?" },
      { speaker: "CONTACT", text: "Yes, speaking. What do you want to know?" },
      { speaker: "AGENT", text: "What is the monthly rent and what does it cover?" },
      { speaker: "CONTACT", text: "Triple sharing fourteen and a half thousand, only breakfast included." },
      { speaker: "AGENT", text: "And the deposit amount?" },
      { speaker: "CONTACT", text: "One month rent as deposit." },
      { speaker: "AGENT", text: "When can someone move in, and what are the curfew rules?" },
      { speaker: "CONTACT", text: "Room frees up next Monday. Curfew is ten PM, after that gate won't open." },
      { speaker: "AGENT", text: "Got it, thanks for the details." },
      { speaker: "CONTACT", text: "No problem, come visit if interested." },
    ],
  },
  {
    name: "Ravi Mess & Lodge",
    phone: "+919900033333",
    language: "tamil",
    status: "FAILED",
    failureReason: "No transcript captured from the live call. Ensure `npm run dev:agent` is running and the agent is dispatched.",
    transcript: [],
  },
];

/** Writes a valid silent PCM16 mono 8kHz WAV of ~2 seconds (deterministic, no binaries committed). */
function writeSilentWav(filePath: string, seconds = 2, sampleRate = 8000): void {
  const numSamples = seconds * sampleRate;
  const dataSize = numSamples * 2; // 16-bit mono
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  // samples stay zero => silence

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
}

function isoAgo(secondsAgo: number): Date {
  return new Date(Date.now() - secondsAgo * 1000);
}

async function main() {
  const recordingsDir = path.join(process.cwd(), ".aira-recordings");
  fs.mkdirSync(recordingsDir, { recursive: true });
  const metadataDir = path.join(process.cwd(), ".callagent-recordings");
  fs.mkdirSync(metadataDir, { recursive: true });

  // Wipe in FK-safe order.
  await db.eventLog.deleteMany();
  await db.transcriptEvent.deleteMany();
  await db.recommendation.deleteMany();
  await db.actionItem.deleteMany();
  await db.extractedFinding.deleteMany();
  await db.call.deleteMany();
  await db.contact.deleteMany();
  await db.investigation.deleteMany();

  // Clean previous fixtures.
  for (const f of fs.readdirSync(recordingsDir)) fs.unlinkSync(path.join(recordingsDir, f));
  for (const f of fs.readdirSync(metadataDir)) fs.unlinkSync(path.join(metadataDir, f));

  const startedAt = isoAgo(3600);
  const completedAt = isoAgo(3000);

  const investigation = await db.investigation.create({
    data: {
      requirement: INVESTIGATION_REQUIREMENT,
      status: "COMPLETED",
      concurrency: 3,
      startedAt,
      completedAt,
      bestCallId: null,
      recommendationSummary:
        'For requirement "Need a PG in Koramangala under 15k with food.", Asha Homes is currently the strongest option with score 86.',
    },
  });

  let rankCursor = 0;
  const rankedCalls: Array<{ callId: string; score: number }> = [];

  for (let i = 0; i < CALLS.length; i += 1) {
    const seed = CALLS[i]!;
    const callStartedAt = new Date(startedAt.getTime() + i * 10 * 60 * 1000);

    const contact = await db.contact.create({
      data: {
        investigationId: investigation.id,
        name: seed.name,
        phone: seed.phone,
        language: seed.language,
        createdAt: callStartedAt,
        updatedAt: callStartedAt,
      },
    });

    const call = await db.call.create({
      data: {
        investigationId: investigation.id,
        contactId: contact.id,
        status: seed.status,
        score: seed.score ?? null,
        failureReason: seed.failureReason ?? null,
        livekitRoomName: `aira-demo-${investigation.id.slice(-6)}-c${i}`,
        livekitParticipant: `sip-call-demo-${i}`,
        livekitSipCallId: `demo-sip-${i}`,
        startedAt: callStartedAt,
        endedAt: new Date(callStartedAt.getTime() + 65_000),
        createdAt: callStartedAt,
        updatedAt: new Date(callStartedAt.getTime() + 70_000),
      },
    });

    // Transcripts staggered 6s apart during the call window.
    let lineOffset = 8;
    for (const line of seed.transcript) {
      await db.transcriptEvent.create({
        data: {
          callId: call.id,
          speaker: line.speaker,
          contactName: contact.name,
          text: line.text,
          createdAt: new Date(callStartedAt.getTime() + lineOffset * 1000),
        },
      });
      lineOffset += 6;
    }

    if (seed.finding && seed.status === "COMPLETED") {
      await db.extractedFinding.create({
        data: {
          callId: call.id,
          monthlyPrice: seed.finding.monthlyPrice,
          locationFit: seed.finding.locationFit,
          availability: seed.finding.availability,
          rules: JSON.stringify(seed.finding.rules),
          confidence: seed.finding.confidence,
          summary: seed.finding.summary,
          raw: JSON.stringify({
            transcript: seed.transcript.map((l) => `${l.speaker}: ${l.text}`).join("\n"),
            extraction: seed.finding,
          }),
          createdAt: callStartedAt,
        },
      });
      rankedCalls.push({ callId: call.id, score: seed.score ?? 50 });
    }

    if (seed.status === "COMPLETED") {
      // Local WAV fixture + provider metadata so /api/recordings works offline.
      writeSilentWav(path.join(recordingsDir, `${call.id}.wav`));
      fs.writeFileSync(
        path.join(metadataDir, `${call.id}.json`),
        JSON.stringify(
          { provider: "local", location: path.join(recordingsDir, `${call.id}.wav`), egressId: "demo", createdAt: new Date().toISOString() },
          null,
          2,
        ),
      );
    }
  }

  rankedCalls.sort((a, b) => b.score - a.score);

  for (const ranked of rankedCalls) {
    await db.recommendation.create({
      data: {
        investigationId: investigation.id,
        callId: ranked.callId,
        rank: ++rankCursor,
        score: ranked.score,
        summary:
          ranked.score === rankedCalls[0]?.score
            ? "Best fit: within budget, food included, immediate availability."
            : "Backup option: slightly over budget, breakfast only.",
        reasoning:
          ranked.score === rankedCalls[0]?.score
            ? "Cost signal: INR 13000 vs target INR 15000. Fit signal: central Koramangala."
            : "Cost signal: INR 14500 vs target INR 15000. Timeline signal: next week.",
        monthlyPrice: ranked.score === rankedCalls[0]?.score ? 13000 : 14500,
        availability: ranked.score === rankedCalls[0]?.score ? "Immediate move-in" : "From next Monday",
        locationFit: ranked.score === rankedCalls[0]?.score ? "5th Block, near metro" : "6th Block, near Wipro",
        isBest: rankCursor === 1,
      },
    });
  }

  if (rankedCalls[0]) {
    await db.investigation.update({
      where: { id: investigation.id },
      data: { bestCallId: rankedCalls[0].callId },
    });
  }

  const actionItems = [
    { priority: "HIGH", title: "Follow up with Asha Homes to confirm key details", detail: "Confirm final terms (current cost signal ~INR 13000), timeline expectations, and concrete next steps." },
    { priority: "MEDIUM", title: "Request written proof of commitments", detail: "Ask for supporting details in writing (scope, constraints, inclusions/exclusions, and any additional costs or dependencies)." },
    { priority: "LOW", title: "Keep City Stay PG as backup", detail: "If the top option changes terms or timing, follow up immediately with this backup option." },
  ];
  for (const item of actionItems) {
    await db.actionItem.create({ data: { investigationId: investigation.id, ...item } });
  }

  await db.eventLog.create({
    data: {
      investigationId: investigation.id,
      eventType: "investigation.completed",
      payload: JSON.stringify({ type: "investigation.completed", investigationId: investigation.id }),
      createdAt: completedAt,
    },
  });

  console.log("Seed complete:");
  console.table({
    investigationId: investigation.id,
    contacts: CALLS.length,
    transcripts: CALLS.reduce((n, c) => n + c.transcript.length, 0),
    recommendations: rankedCalls.length,
    recordings: fs.readdirSync(recordingsDir).length,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
