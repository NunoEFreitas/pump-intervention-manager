-- CreateEnum
CREATE TYPE "StockLocation" AS ENUM ('MAIN_WAREHOUSE', 'TECHNICIAN', 'USED');

-- CreateEnum
CREATE TYPE "SerialStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'DAMAGED', 'LOST');

-- AlterTable
ALTER TABLE "WarehouseItem" ADD COLUMN     "tracksSerialNumbers" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SerialNumberStock" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "location" "StockLocation" NOT NULL DEFAULT 'MAIN_WAREHOUSE',
    "technicianId" TEXT,
    "status" "SerialStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SerialNumberStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovementSerialNumber" (
    "id" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "serialNumberId" TEXT NOT NULL,

    CONSTRAINT "MovementSerialNumber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SerialNumberStock_itemId_serialNumber_key" ON "SerialNumberStock"("itemId", "serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MovementSerialNumber_movementId_serialNumberId_key" ON "MovementSerialNumber"("movementId", "serialNumberId");

-- AddForeignKey
ALTER TABLE "SerialNumberStock" ADD CONSTRAINT "SerialNumberStock_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "WarehouseItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialNumberStock" ADD CONSTRAINT "SerialNumberStock_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementSerialNumber" ADD CONSTRAINT "MovementSerialNumber_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "ItemMovement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementSerialNumber" ADD CONSTRAINT "MovementSerialNumber_serialNumberId_fkey" FOREIGN KEY ("serialNumberId") REFERENCES "SerialNumberStock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
