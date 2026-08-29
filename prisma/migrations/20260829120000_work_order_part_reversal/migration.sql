-- Estorno: novo tipo de movimento para devolução de stock ao cancelar o uso de uma peça
ALTER TYPE "MovementType" ADD VALUE IF NOT EXISTS 'REVERSAL';

-- Origem do stock de cada peça de ordem de trabalho, para o estorno devolver ao sítio certo
ALTER TABLE "WorkOrderPart" ADD COLUMN IF NOT EXISTS "stockSource" TEXT;
ALTER TABLE "WorkOrderPart" ADD COLUMN IF NOT EXISTS "sourceTechnicianId" TEXT;

-- Backfill de registos existentes ------------------------------------------------

-- 1) Itens sem controlo de stock: nada a devolver
UPDATE "WorkOrderPart" wp
SET "stockSource" = 'NO_STOCK'
FROM "WarehouseItem" wi
WHERE wi.id = wp."itemId"
  AND wp."stockSource" IS NULL
  AND wi."noStock" = true;

-- 2) Saídas do armazém central — identificadas pela nota do movimento USE
UPDATE "WorkOrderPart" wp
SET "stockSource" = 'MAIN_WAREHOUSE'
FROM "WorkOrder" wo
WHERE wo.id = wp."workOrderId"
  AND wp."stockSource" IS NULL
  AND EXISTS (
    SELECT 1 FROM "ItemMovement" m
    WHERE m."itemId" = wp."itemId"
      AND m."movementType" = 'USE'
      AND m.notes = 'Used in work order ' || COALESCE(wo.reference, wo.id::text) || ' (from warehouse)'
  );

-- 3) Restantes vieram do stock do técnico atribuído à intervenção
UPDATE "WorkOrderPart" wp
SET "stockSource" = 'TECHNICIAN',
    "sourceTechnicianId" = i."assignedToId"
FROM "WorkOrder" wo
JOIN "Intervention" i ON i.id = wo."interventionId"
WHERE wo.id = wp."workOrderId"
  AND wp."stockSource" IS NULL
  AND i."assignedToId" IS NOT NULL;

-- 4) Sem técnico atribuído: assume armazém central
UPDATE "WorkOrderPart"
SET "stockSource" = 'MAIN_WAREHOUSE'
WHERE "stockSource" IS NULL;
