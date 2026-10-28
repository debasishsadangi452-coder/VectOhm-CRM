-- CreateEnum
CREATE TYPE "ReasonReviewStatus" AS ENUM ('EXCUSED', 'REJECTED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ATTENDANCE_REVIEWED';

-- AlterTable
ALTER TABLE "WorkSession" ADD COLUMN "lateReviewStatus" "ReasonReviewStatus",
ADD COLUMN "lateReviewNote" TEXT,
ADD COLUMN "lateReviewedById" TEXT,
ADD COLUMN "lateReviewedAt" TIMESTAMP(3),
ADD COLUMN "earlyReviewStatus" "ReasonReviewStatus",
ADD COLUMN "earlyReviewNote" TEXT,
ADD COLUMN "earlyReviewedById" TEXT,
ADD COLUMN "earlyReviewedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AttendanceSettings" (
    "id" TEXT NOT NULL DEFAULT 'attendance',
    "lateGraceMin" INTEGER NOT NULL DEFAULT 10,
    "earlyGraceMin" INTEGER NOT NULL DEFAULT 5,
    "idlePromptMin" INTEGER NOT NULL DEFAULT 30,
    "absentAfterMin" INTEGER NOT NULL DEFAULT 60,
    "maxOpenSessionHours" INTEGER NOT NULL DEFAULT 14,
    "repeatLateThreshold" INTEGER NOT NULL DEFAULT 3,
    "repeatLateWindowDays" INTEGER NOT NULL DEFAULT 7,
    "minWorkMinutes" INTEGER NOT NULL DEFAULT 510,
    "weeklyOffDays" INTEGER[] DEFAULT ARRAY[0, 6]::INTEGER[],
    "absenceTrackingStart" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "AttendanceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceDeptPolicy" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "lateGraceMin" INTEGER,
    "earlyGraceMin" INTEGER,
    "idlePromptMin" INTEGER,
    "absentAfterMin" INTEGER,
    "minWorkMinutes" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceDeptPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shiftStart" TEXT NOT NULL,
    "shiftEnd" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDeptPolicy_departmentId_key" ON "AttendanceDeptPolicy"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftTemplate_name_key" ON "ShiftTemplate"("name");

-- AddForeignKey
ALTER TABLE "AttendanceDeptPolicy" ADD CONSTRAINT "AttendanceDeptPolicy_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
