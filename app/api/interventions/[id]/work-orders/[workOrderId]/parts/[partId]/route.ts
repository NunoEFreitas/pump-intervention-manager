import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { randomUUID } from 'crypto'

type Params = { params: Promise<{ id: string; workOrderId: string; partId: string }> }

/**
 * DELETE — cancela o uso de uma peça numa ordem de trabalho.
 *
 * A peça é removida da OT e o stock devolvido à origem de onde saiu
 * (stock do técnico ou armazém central), com um movimento de tipo REVERSAL (estorno).
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const payload = verifyToken(token || '')
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: interventionId, workOrderId, partId } = await params

    const [part] = await prisma.$queryRaw<Array<{
      id: string
      itemId: string
      quantity: number
      serialNumberIds: string[]
      stockSource: string | null
      sourceTechnicianId: string | null
      tracksSerialNumbers: boolean
      noStock: boolean
      woReference: string | null
      assignedToId: string | null
    }>>`
      SELECT wp.id, wp."itemId", wp.quantity, wp."serialNumberIds",
             wp."stockSource", wp."sourceTechnicianId",
             wi."tracksSerialNumbers", wi."noStock",
             wo.reference AS "woReference",
             i."assignedToId"
      FROM "WorkOrderPart" wp
      JOIN "WarehouseItem" wi ON wi.id::text = wp."itemId"::text
      JOIN "WorkOrder" wo     ON wo.id::text = wp."workOrderId"::text
      JOIN "Intervention" i   ON i.id::text  = wo."interventionId"::text
      WHERE wp.id::text = ${partId}
        AND wp."workOrderId"::text = ${workOrderId}
        AND wo."interventionId"::text = ${interventionId}
    `
    if (!part) return NextResponse.json({ error: 'Peça não encontrada nesta ordem de trabalho' }, { status: 404 })

    // Origem do stock. Registos antigos podem não ter `stockSource` — inferimos.
    const source = part.stockSource
      ?? (part.noStock ? 'NO_STOCK' : part.assignedToId ? 'TECHNICIAN' : 'MAIN_WAREHOUSE')
    const technicianId = part.sourceTechnicianId ?? part.assignedToId

    if (source === 'TECHNICIAN' && !technicianId) {
      return NextResponse.json(
        { error: 'Não foi possível determinar o técnico de origem para devolver o stock' },
        { status: 400 }
      )
    }

    const quantity = Number(part.quantity)
    const snIds = Array.isArray(part.serialNumberIds) ? part.serialNumberIds : []
    const woLabel = part.woReference || workOrderId
    const now = new Date()

    await prisma.$transaction(async (tx) => {
      // ── Itens sem controlo de stock: só remover da OT ──
      if (source === 'NO_STOCK') {
        await tx.$executeRaw`DELETE FROM "WorkOrderPart" WHERE id::text = ${partId}`
        return
      }

      const returnedToTech = source === 'TECHNICIAN'

      if (part.tracksSerialNumbers && snIds.length > 0) {
        // Devolver os números de série ao stock de origem
        if (returnedToTech) {
          await tx.$executeRaw`
            UPDATE "SerialNumberStock"
            SET location = 'TECHNICIAN', status = 'AVAILABLE', "technicianId" = ${technicianId}
            WHERE id::text = ANY(${snIds}::text[]) AND location = 'USED'
          `
          const [{ count }] = await tx.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*)::bigint AS count FROM "SerialNumberStock"
            WHERE "itemId"::text = ${part.itemId}
              AND "technicianId"::text = ${technicianId}
              AND location = 'TECHNICIAN'
          `
          await tx.$executeRaw`
            INSERT INTO "TechnicianStock" (id, "itemId", "technicianId", quantity, "createdAt", "updatedAt")
            VALUES (${randomUUID()}, ${part.itemId}, ${technicianId}, ${Number(count)}, ${now}::timestamptz, ${now}::timestamptz)
            ON CONFLICT ("itemId", "technicianId")
            DO UPDATE SET quantity = ${Number(count)}, "updatedAt" = ${now}::timestamptz
          `
        } else {
          await tx.$executeRaw`
            UPDATE "SerialNumberStock"
            SET location = 'MAIN_WAREHOUSE', status = 'AVAILABLE', "technicianId" = NULL
            WHERE id::text = ANY(${snIds}::text[]) AND location = 'USED'
          `
          const [{ count }] = await tx.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*)::bigint AS count FROM "SerialNumberStock"
            WHERE "itemId"::text = ${part.itemId}
              AND location = 'MAIN_WAREHOUSE' AND status = 'AVAILABLE'
          `
          await tx.$executeRaw`
            UPDATE "WarehouseItem"
            SET "mainWarehouse" = ${Number(count)}, "updatedAt" = ${now}::timestamptz
            WHERE id::text = ${part.itemId}
          `
        }
      } else if (returnedToTech) {
        await tx.$executeRaw`
          INSERT INTO "TechnicianStock" (id, "itemId", "technicianId", quantity, "createdAt", "updatedAt")
          VALUES (${randomUUID()}, ${part.itemId}, ${technicianId}, ${quantity}, ${now}::timestamptz, ${now}::timestamptz)
          ON CONFLICT ("itemId", "technicianId")
          DO UPDATE SET quantity = "TechnicianStock".quantity + ${quantity}, "updatedAt" = ${now}::timestamptz
        `
      } else {
        await tx.$executeRaw`
          UPDATE "WarehouseItem"
          SET "mainWarehouse" = "mainWarehouse" + ${quantity}, "updatedAt" = ${now}::timestamptz
          WHERE id::text = ${part.itemId}
        `
      }

      // ── Movimento de estorno ──
      const movementId = randomUUID()
      const notes = returnedToTech
        ? `Estorno — uso cancelado na OT ${woLabel} (devolvido ao técnico)`
        : `Estorno — uso cancelado na OT ${woLabel} (devolvido ao armazém)`

      await tx.$executeRaw`
        INSERT INTO "ItemMovement" (id, "itemId", "movementType", quantity, "toUserId", notes, "createdById", "createdAt")
        VALUES (
          ${movementId}, ${part.itemId}, 'REVERSAL', ${quantity},
          ${returnedToTech ? technicianId : null}, ${notes}, ${payload.userId}, ${now}::timestamptz
        )
      `

      for (const snId of snIds) {
        await tx.$executeRaw`
          INSERT INTO "MovementSerialNumber" (id, "movementId", "serialNumberId")
          VALUES (${randomUUID()}, ${movementId}, ${snId})
          ON CONFLICT ("movementId", "serialNumberId") DO NOTHING
        `
      }

      await tx.$executeRaw`DELETE FROM "WorkOrderPart" WHERE id::text = ${partId}`
    })

    return NextResponse.json({ ok: true, returnedTo: source })
  } catch (error) {
    console.error('Error cancelling work order part usage:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
