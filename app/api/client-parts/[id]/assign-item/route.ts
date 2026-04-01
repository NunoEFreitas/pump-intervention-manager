import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { randomUUID } from 'crypto'

// PATCH — assign a real warehouse item to a generic client part
// Body: { existingItemId: string } | { newItem: { itemName, partNumber, value } }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const payload = verifyToken(token || '')
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: serialNumberId } = await params
    const body = await request.json()

    // Fetch the client part and verify it's generic
    const [part] = await prisma.$queryRaw<{ id: string; itemId: string; clientPartStatus: string }[]>`
      SELECT sn.id, sn."itemId", sn."clientPartStatus"
      FROM "SerialNumberStock" sn
      JOIN "WarehouseItem" wi ON wi.id = sn."itemId"
      WHERE sn.id = ${serialNumberId} AND sn."isClientPart" = true
    `
    if (!part) return NextResponse.json({ error: 'Client part not found' }, { status: 404 })

    const [currentItem] = await prisma.$queryRaw<{ partNumber: string }[]>`
      SELECT "partNumber" FROM "WarehouseItem" WHERE id = ${part.itemId}
    `
    if (currentItem?.partNumber !== '__GENERIC__') {
      return NextResponse.json({ error: 'Esta peça já tem um artigo associado' }, { status: 400 })
    }

    let targetItemId: string

    if (body.existingItemId) {
      // Use existing warehouse item
      const existing = await prisma.warehouseItem.findUnique({
        where: { id: body.existingItemId },
        select: { id: true },
      })
      if (!existing) return NextResponse.json({ error: 'Artigo não encontrado' }, { status: 404 })
      targetItemId = existing.id
    } else if (body.newItem) {
      // Create a new warehouse item with the same fields as the warehouse creation form
      const {
        itemName, partNumber, value,
        equipmentTypeId, brandId, ean13,
        tracksSerialNumbers, autoSn, snExample,
        mainWarehouse,
      } = body.newItem
      if (!itemName?.trim() || !partNumber?.trim()) {
        return NextResponse.json({ error: 'Nome e referência são obrigatórios' }, { status: 400 })
      }
      // Check partNumber not already taken
      const dup = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "WarehouseItem" WHERE "partNumber" = ${partNumber.trim()} LIMIT 1
      `
      if (dup.length > 0) {
        return NextResponse.json({ error: `Referência "${partNumber.trim()}" já existe` }, { status: 409 })
      }
      const tracksSN = tracksSerialNumbers === true || tracksSerialNumbers === 'true'
      const useAutoSn = tracksSN && (autoSn === true || autoSn === 'true')
      const initialStock = tracksSN ? 0 : (parseInt(mainWarehouse) || 0)
      targetItemId = randomUUID()
      await prisma.$executeRaw`
        INSERT INTO "WarehouseItem" (
          id, "itemName", "partNumber", value,
          "mainWarehouse", "repairStock", "destructionStock",
          "tracksSerialNumbers", "autoSn", "snExample",
          "equipmentTypeId", "brandId", "ean13",
          "createdAt", "updatedAt"
        )
        VALUES (
          ${targetItemId}, ${itemName.trim()}, ${partNumber.trim()}, ${Number(value) || 0},
          ${initialStock}, 0, 0,
          ${tracksSN}, ${useAutoSn}, ${useAutoSn ? (snExample?.trim() || null) : null},
          ${equipmentTypeId || null}, ${brandId || null}, ${ean13?.trim() || null},
          NOW(), NOW()
        )
      `
    } else {
      return NextResponse.json({ error: 'Forneça existingItemId ou newItem' }, { status: 400 })
    }

    const sn = body.serialNumber?.trim() || null

    await prisma.$executeRaw`
      UPDATE "SerialNumberStock"
      SET "itemId" = ${targetItemId},
          "serialNumber" = COALESCE(${sn}, "serialNumber"),
          "updatedAt" = NOW()
      WHERE id = ${serialNumberId}
    `

    const [updated] = await prisma.$queryRaw<{ itemName: string; partNumber: string }[]>`
      SELECT wi."itemName", wi."partNumber"
      FROM "SerialNumberStock" sn
      JOIN "WarehouseItem" wi ON wi.id = sn."itemId"
      WHERE sn.id = ${serialNumberId}
    `

    return NextResponse.json({ ok: true, itemName: updated.itemName, partNumber: updated.partNumber })
  } catch (error) {
    console.error('Error assigning item to client part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
