-- Track which token replaced a rotated refresh token (lost-rotation recovery).
ALTER TABLE "RefreshToken" ADD COLUMN "replacedById" TEXT;
