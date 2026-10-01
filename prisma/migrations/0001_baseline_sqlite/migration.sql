-- CreateTable
CREATE TABLE "Investigation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requirement" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "concurrency" INTEGER NOT NULL DEFAULT 3,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "recommendationSummary" TEXT,
    "bestCallId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Investigation_bestCallId_fkey" FOREIGN KEY ("bestCallId") REFERENCES "Call" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "investigationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'english',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contact_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "investigationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "livekitRoomName" TEXT,
    "livekitParticipant" TEXT,
    "livekitSipCallId" TEXT,
    "score" REAL,
    "failureReason" TEXT,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Call_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Call_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TranscriptEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "callId" TEXT NOT NULL,
    "speaker" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TranscriptEvent_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExtractedFinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "callId" TEXT NOT NULL,
    "monthlyPrice" INTEGER,
    "locationFit" TEXT,
    "availability" TEXT,
    "rules" TEXT,
    "confidence" REAL,
    "summary" TEXT,
    "raw" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExtractedFinding_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "investigationId" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" REAL NOT NULL,
    "summary" TEXT NOT NULL,
    "reasoning" TEXT,
    "monthlyPrice" INTEGER,
    "availability" TEXT,
    "locationFit" TEXT,
    "isBest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Recommendation_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Recommendation_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "investigationId" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActionItem_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "investigationId" TEXT NOT NULL,
    "callId" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventLog_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventLog_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Investigation_status_createdAt_idx" ON "Investigation"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Contact_investigationId_idx" ON "Contact"("investigationId");

-- CreateIndex
CREATE INDEX "Call_investigationId_status_idx" ON "Call"("investigationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Call_investigationId_contactId_key" ON "Call"("investigationId", "contactId");

-- CreateIndex
CREATE INDEX "TranscriptEvent_callId_createdAt_idx" ON "TranscriptEvent"("callId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractedFinding_callId_key" ON "ExtractedFinding"("callId");

-- CreateIndex
CREATE UNIQUE INDEX "Recommendation_callId_key" ON "Recommendation"("callId");

-- CreateIndex
CREATE INDEX "Recommendation_investigationId_score_idx" ON "Recommendation"("investigationId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "Recommendation_investigationId_rank_key" ON "Recommendation"("investigationId", "rank");

-- CreateIndex
CREATE INDEX "ActionItem_investigationId_priority_idx" ON "ActionItem"("investigationId", "priority");

-- CreateIndex
CREATE INDEX "EventLog_investigationId_id_idx" ON "EventLog"("investigationId", "id");

-- CreateIndex
CREATE INDEX "EventLog_callId_id_idx" ON "EventLog"("callId", "id");

