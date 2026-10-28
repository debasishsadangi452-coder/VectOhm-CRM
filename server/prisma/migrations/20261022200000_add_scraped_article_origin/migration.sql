-- Tells apart articles found by the browser extension from ones found by the server-side crawler.
ALTER TABLE "ScrapedIntentArticle" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'EXTENSION';

CREATE INDEX "ScrapedIntentArticle_origin_publishedAt_idx" ON "ScrapedIntentArticle"("origin", "publishedAt");
