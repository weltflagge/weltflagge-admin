CREATE TYPE "ImportLogResult" AS ENUM ('IMPORTED', 'UPDATED', 'SKIPPED', 'ERROR');

CREATE TABLE "ImportSyncState" (
    "id" TEXT NOT NULL,
    "source" "OrderSource" NOT NULL,
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "importedToday" INTEGER NOT NULL DEFAULT 0,
    "updatedToday" INTEGER NOT NULL DEFAULT 0,
    "skippedToday" INTEGER NOT NULL DEFAULT 0,
    "counterDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportSyncState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportLog" (
    "id" TEXT NOT NULL,
    "source" "OrderSource" NOT NULL,
    "externalId" TEXT,
    "result" "ImportLogResult" NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImportSyncState_source_key" ON "ImportSyncState"("source");
CREATE INDEX "ImportLog_source_createdAt_idx" ON "ImportLog"("source", "createdAt");
CREATE INDEX "ImportLog_result_createdAt_idx" ON "ImportLog"("result", "createdAt");
CREATE INDEX "ImportLog_externalId_idx" ON "ImportLog"("externalId");
