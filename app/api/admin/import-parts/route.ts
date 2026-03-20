import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

const CHUNK_SIZE = 500

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const payload = verifyToken(token || '')
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { role: true } })
    if (user?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { rows } = await request.json() as {
      rows: { itemName: string; mainWarehouse: number }[]
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
    }

    // Find "Importado" type and brand
    const importedTypes = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "EquipmentType" WHERE name = 'Importado' LIMIT 1
    `
    const importedBrands = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "EquipmentBrand" WHERE name = 'Importado' LIMIT 1
    `
    const typeId: string | null = importedTypes[0]?.id ?? null
    const brandId: string | null = importedBrands[0]?.id ?? null

    const validRows = rows.filter(r => r.itemName?.trim())
    const skipped = rows.length - validRows.length
    let created = 0

    // Process in chunks to avoid parameter limits
    for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
      const chunk = validRows.slice(i, i + CHUNK_SIZE)
      const now = new Date()

      // Build bulk insert values
      const itemIds: string[] = []
      const stockItems: { id: string; qty: number }[] = []

      // Insert items one-by-one within a transaction for this chunk
      // (Prisma raw interpolation doesn't support dynamic multi-row VALUES easily)
      // Use createMany which is a single query
      const data = chunk.map(row => {
        const id = crypto.randomUUID()
        const stock = Math.max(0, Math.round(row.mainWarehouse || 0))
        itemIds.push(id)
        if (stock > 0) stockItems.push({ id, qty: stock })
        return {
          id,
          itemName: row.itemName.trim(),
          partNumber: `IMP-${id.slice(0, 8).toUpperCase()}`,
          value: 0,
          mainWarehouse: stock,
          tracksSerialNumbers: false,
          createdAt: now,
          updatedAt: now,
        }
      })

      // Bulk create items
      await prisma.warehouseItem.createMany({ data, skipDuplicates: true })

      // Bulk update equipmentTypeId + brandId using raw SQL with ANY
      if (itemIds.length > 0) {
        await prisma.$executeRaw`
          UPDATE "WarehouseItem"
          SET "equipmentTypeId" = ${typeId},
              "brandId"         = ${brandId},
              "autoSn"          = false,
              "snExample"       = null
          WHERE id::text = ANY(${itemIds})
        `
      }

      // Bulk create stock movements
      if (stockItems.length > 0) {
        await prisma.itemMovement.createMany({
          data: stockItems.map(s => ({
            itemId: s.id,
            movementType: 'ADD_STOCK',
            quantity: s.qty,
            createdById: payload.userId,
            notes: 'Importado de sistema anterior',
          })),
        })
      }

      created += chunk.length
    }

    return NextResponse.json({ created, skipped })
  } catch (error) {
    console.error('Import parts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
