-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "departmentId" TEXT;

-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "managerTitle" TEXT NOT NULL DEFAULT 'Manager';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "departmentId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "departmentId" TEXT;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
