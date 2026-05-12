-- AlterTable
ALTER TABLE "AulaAoVivo" ADD COLUMN     "ivsRecordingConfigurationArn" TEXT,
ADD COLUMN     "ivsRecordingId" TEXT,
ADD COLUMN     "ivsRecordingS3Prefix" TEXT,
ADD COLUMN     "ivsRecordingStatus" TEXT;

-- CreateIndex
CREATE INDEX "AulaAoVivo_ivsRecordingId_idx" ON "AulaAoVivo"("ivsRecordingId");
