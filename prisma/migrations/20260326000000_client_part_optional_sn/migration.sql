-- Make serialNumber nullable on SerialNumberStock (client parts may not have a SN)
ALTER TABLE "SerialNumberStock" ALTER COLUMN "serialNumber" DROP NOT NULL;

-- Drop existing unique constraint
ALTER TABLE "SerialNumberStock" DROP CONSTRAINT IF EXISTS "SerialNumberStock_itemId_serialNumber_key";

-- Drop old index if it exists under a different name
DROP INDEX IF EXISTS "SerialNumberStock_itemId_serialNumber_key";

-- Re-add as a partial unique index that only applies when serialNumber is not null
CREATE UNIQUE INDEX IF NOT EXISTS "SerialNumberStock_itemId_serialNumber_unique"
  ON "SerialNumberStock" ("itemId", "serialNumber")
  WHERE "serialNumber" IS NOT NULL;

-- Add faultDescription column for client parts
ALTER TABLE "SerialNumberStock" ADD COLUMN IF NOT EXISTS "faultDescription" TEXT;
