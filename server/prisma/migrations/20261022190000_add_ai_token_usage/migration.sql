-- CreateTable
CREATE TABLE "AiTokenUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiTokenUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiTokenUsage_createdAt_idx" ON "AiTokenUsage"("createdAt");

-- CreateIndex
CREATE INDEX "AiTokenUsage_userId_idx" ON "AiTokenUsage"("userId");

-- CreateIndex
CREATE INDEX "AiTokenUsage_provider_idx" ON "AiTokenUsage"("provider");

-- CreateIndex
CREATE INDEX "AiTokenUsage_feature_idx" ON "AiTokenUsage"("feature");

-- AddForeignKey
ALTER TABLE "AiTokenUsage" ADD CONSTRAINT "AiTokenUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
