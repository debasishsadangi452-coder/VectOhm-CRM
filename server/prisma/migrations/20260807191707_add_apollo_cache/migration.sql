-- CreateTable
CREATE TABLE "ApolloCache" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "queryKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApolloCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApolloCache_kind_idx" ON "ApolloCache"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "ApolloCache_kind_queryKey_key" ON "ApolloCache"("kind", "queryKey");
