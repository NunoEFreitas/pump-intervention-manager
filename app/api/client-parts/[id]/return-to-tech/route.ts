import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

const TERMINAL_REPAIR_STATUSES = ['RETURNED_TO_CLIENT', 'NOT_REPAIRED', 'REPAIRED', 'WRITTEN_OFF']

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const payload = verifyToken(token || '')
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: serialNumberId } = await params
    const now = new Date()

    const [clientPart] = await prisma.$queryRaw<any[]>`
      SELECT sn.*, wi."itemName",
             rj.status AS "repairStatus"
      FROM "SerialNumberStock" sn
      JOIN "WarehouseItem" wi ON wi.id = sn."itemId"
      LEFT JOIN "PartRepairJob" rj ON rj.id = sn."clientRepairJobId"
      WHERE sn.id = ${serialNumberId} AND sn."isClientPart" = true
    `
    if (!clientPart) return NextResponse.json({ error: 'Client part not found' }, { status: 404 })
    if (clientPart.clientPartStatus !== 'REPAIR') {
      return NextResponse.json({ error: 'Peça não está em reparação' }, { status: 400 })
    }
    if (!clientPart.repairStatus || !TERMINAL_REPAIR_STATUSES.includes(clientPart.repairStatus)) {
      return NextResponse.json({ error: 'Reparação ainda não foi finalizada' }, { status: 400 })
    }
    if (!clientPart.technicianId) {
      return NextResponse.json({ error: 'Técnico não encontrado' }, { status: 400 })
    }

    // Move SN back to technician as a regular (non-client) part
    await prisma.$executeRaw`
      UPDATE "SerialNumberStock"
      SET location = 'TECHNICIAN',
          status = 'AVAILABLE',
          "isClientPart" = false,
          "clientPartStatus" = 'RESOLVED',
          "updatedAt" = ${now}::timestamptz
      WHERE id = ${serialNumberId}
    `

    // Increment technician stock
    await prisma.$executeRaw`
      INSERT INTO "TechnicianStock" (id, "itemId", "technicianId", quantity, "createdAt", "updatedAt")
      VALUES (${crypto.randomUUID()}, ${clientPart.itemId}, ${clientPart.technicianId}, 1, ${now}::timestamptz, ${now}::timestamptz)
      ON CONFLICT ("itemId", "technicianId")
      DO UPDATE SET quantity = "TechnicianStock".quantity + 1, "updatedAt" = ${now}::timestamptz
    `

    // Record movement
    await prisma.$executeRaw`
      INSERT INTO "ItemMovement" (id, "itemId", "movementType", quantity, "toUserId", notes, "createdById", "createdAt")
      VALUES (
        ${crypto.randomUUID()}, ${clientPart.itemId}, 'TRANSFER_TO_TECH', 1,
        ${clientPart.technicianId},
        ${'Devolução de peça de cliente ao técnico após reparação'},
        ${payload.userId}, ${now}::timestamptz
      )
    `

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error returning client part to tech:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
