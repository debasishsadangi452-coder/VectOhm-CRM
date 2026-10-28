-- JustCall-style click-to-call module for Sales (see server/src/modules/telephony).
-- Call/CallEvent are independent of Activity (whose dealId is required) so a
-- call can be logged before any deal exists; CallsService additionally writes
-- an Activity row when a Call has a dealId, so deal timelines are unaffected.

-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('INITIATED', 'RINGING', 'CONNECTED', 'COMPLETED', 'FAILED', 'BUSY', 'NO_ANSWER');

-- CreateTable
CREATE TABLE "JustCallConnection" (
    "id" TEXT NOT NULL DEFAULT 'justcall-connection',
    "encryptedApiKey" TEXT NOT NULL,
    "apiKeyIv" TEXT NOT NULL,
    "apiKeyAuthTag" TEXT NOT NULL,
    "encryptedApiSecret" TEXT NOT NULL,
    "apiSecretIv" TEXT NOT NULL,
    "apiSecretAuthTag" TEXT NOT NULL,
    "webhookSecret" TEXT,
    "connectedById" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JustCallConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneNumber" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'justcall',
    "providerId" TEXT NOT NULL,
    "e164" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "label" TEXT,
    "departmentId" TEXT,
    "smsCapable" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'justcall',
    "providerCallId" TEXT,
    "direction" "CallDirection" NOT NULL DEFAULT 'OUTBOUND',
    "agentId" TEXT NOT NULL,
    "contactId" TEXT,
    "companyId" TEXT,
    "dealId" TEXT,
    "fromNumber" TEXT,
    "toNumber" TEXT NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'INITIATED',
    "durationSec" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "recordingUrl" TEXT,
    "recordingStatus" TEXT,
    "disposition" TEXT,
    "notes" TEXT,
    "nextFollowUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallEvent" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "providerEventId" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhoneNumber_providerId_key" ON "PhoneNumber"("providerId");
CREATE UNIQUE INDEX "PhoneNumber_e164_key" ON "PhoneNumber"("e164");
CREATE INDEX "PhoneNumber_departmentId_idx" ON "PhoneNumber"("departmentId");

CREATE UNIQUE INDEX "Call_providerCallId_key" ON "Call"("providerCallId");
CREATE INDEX "Call_contactId_idx" ON "Call"("contactId");
CREATE INDEX "Call_dealId_idx" ON "Call"("dealId");
CREATE INDEX "Call_agentId_startedAt_idx" ON "Call"("agentId", "startedAt");
CREATE INDEX "Call_status_idx" ON "Call"("status");

CREATE UNIQUE INDEX "CallEvent_providerEventId_key" ON "CallEvent"("providerEventId");
CREATE INDEX "CallEvent_callId_idx" ON "CallEvent"("callId");

-- AddForeignKey
ALTER TABLE "JustCallConnection" ADD CONSTRAINT "JustCallConnection_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PhoneNumber" ADD CONSTRAINT "PhoneNumber_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Call" ADD CONSTRAINT "Call_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Call" ADD CONSTRAINT "Call_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Call" ADD CONSTRAINT "Call_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Call" ADD CONSTRAINT "Call_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CallEvent" ADD CONSTRAINT "CallEvent_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE ON UPDATE CASCADE;
