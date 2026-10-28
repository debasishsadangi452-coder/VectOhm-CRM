-- WhatsApp-style group chats: a private group has an explicit member list, and
-- "X added Y" style system lines are flagged on the message.

-- AlterTable
ALTER TABLE "ChatChannel" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "isGroup" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ChatChannelMember" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatChannelMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatChannelMember_userId_idx" ON "ChatChannelMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatChannelMember_channelId_userId_key" ON "ChatChannelMember"("channelId", "userId");

-- AddForeignKey
ALTER TABLE "ChatChannelMember" ADD CONSTRAINT "ChatChannelMember_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ChatChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatChannelMember" ADD CONSTRAINT "ChatChannelMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
