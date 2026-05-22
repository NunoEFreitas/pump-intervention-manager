// Run: node scripts/reset-data.mjs
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('A limpar dados transaccionais...\n')

  const steps = [
    ['MovementSerialNumber',    () => prisma.$executeRaw`DELETE FROM "MovementSerialNumber"`],
    ['ItemMovement',            () => prisma.$executeRaw`DELETE FROM "ItemMovement"`],
    ['InventoryEntrySerial',    () => prisma.$executeRaw`DELETE FROM "InventoryEntrySerial"`],
    ['InventoryEntry',          () => prisma.$executeRaw`DELETE FROM "InventoryEntry"`],
    ['InventorySession',        () => prisma.$executeRaw`DELETE FROM "InventorySession"`],
    ['RepairJobPhoto',          () => prisma.$executeRaw`DELETE FROM "RepairJobPhoto"`],
    ['RepairHistory',           () => prisma.$executeRaw`DELETE FROM "RepairHistory"`],
    ['RepairSession',           () => prisma.$executeRaw`DELETE FROM "RepairSession"`],
    ['RepairJobPart',           () => prisma.$executeRaw`DELETE FROM "RepairJobPart"`],
    ['PartRepairJob',           () => prisma.$executeRaw`DELETE FROM "PartRepairJob"`],
    ['SerialNumberStock',       () => prisma.$executeRaw`DELETE FROM "SerialNumberStock"`],
    ['WorkOrderPDF',            () => prisma.$executeRaw`DELETE FROM "WorkOrderPDF"`],
    ['WorkOrderPart',           () => prisma.$executeRaw`DELETE FROM "WorkOrderPart"`],
    ['WorkOrderSession',        () => prisma.$executeRaw`DELETE FROM "WorkOrderSession"`],
    ['WorkOrderHelper',         () => prisma.$executeRaw`DELETE FROM "WorkOrderHelper"`],
    ['WorkOrderVehicle',        () => prisma.$executeRaw`DELETE FROM "WorkOrderVehicle"`],
    ['OVM',                     () => prisma.$executeRaw`DELETE FROM "OVM"`],
    ['InterventionHistory',     () => prisma.$executeRaw`DELETE FROM "InterventionHistory"`],
    ['InterventionPhoto',       () => prisma.$executeRaw`DELETE FROM "InterventionPhoto"`],
    ['InterventionPart',        () => prisma.$executeRaw`DELETE FROM "InterventionPart"`],
    ['PartRequest',             () => prisma.$executeRaw`DELETE FROM "PartRequest"`],
    ['WorkOrder',               () => prisma.$executeRaw`DELETE FROM "WorkOrder"`],
    ['Intervention',            () => prisma.$executeRaw`DELETE FROM "Intervention"`],
    ['TechnicianStock',         () => prisma.$executeRaw`DELETE FROM "TechnicianStock"`],
    ['WarehouseItem (reset counters)', () => prisma.$executeRaw`UPDATE "WarehouseItem" SET "mainWarehouse" = 0, "repairStock" = 0, "destructionStock" = 0`],
  ]

  for (const [label, fn] of steps) {
    const count = await fn()
    console.log(`✓ ${label}  (${count} linhas)`)
  }

  console.log('\nLimpeza concluída.')
}

main()
  .catch(e => { console.error('Erro:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
