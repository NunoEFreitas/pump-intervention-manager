import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

const TERMINAL = ['REPAIRED', 'RETURNED_TO_CLIENT', 'NOT_REPAIRED', 'WRITTEN_OFF']

// POST — send part out to client: SWAP or REPAIR(terminal) → RETURNING
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const payload = verifyToken(token || '')
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: serialNumberId } = await params
    const body = await request.json().catch(() => ({}))
    const technicianId: string | null = body.technicianId || null
    const now = new Date()

    const [clientPart] = await prisma.$queryRaw<any[]>`
      SELECT sn.id, sn."itemId", sn."clientPartStatus", sn."clientRepairJobId",
             wi."tracksSerialNumbers",
             rj.status AS "repairStatus"
      FROM "SerialNumberStock" sn
      JOIN "WarehouseItem" wi ON wi.id = sn."itemId"
      LEFT JOIN "PartRepairJob" rj ON rj.id = sn."clientRepairJobId"
      WHERE sn.id = ${serialNumberId} AND sn."isClientPart" = true
    `
    if (!clientPart) return NextResponse.json({ error: 'Client part not found' }, { status: 404 })

    const { clientPartStatus, repairStatus } = clientPart
    const readyForReturn =
      clientPartStatus === 'SWAP' ||
      (clientPartStatus === 'REPAIR' && repairStatus && TERMINAL.includes(repairStatus))

    if (!readyForReturn) {
      return NextResponse.json({ error: 'Peça não está pronta para envio ao cliente' }, { status: 400 })
    }

    await prisma.$executeRaw`
      UPDATE "SerialNumberStock"
      SET "clientPartStatus" = 'RETURNING',
          "sentOutAt" = ${now}::timestamptz,
          "sentOutById" = ${payload.userId},
          "sentOutTechnicianId" = ${technicianId},
          "updatedAt" = ${now}::timestamptz
      WHERE id = ${serialNumberId}
    `

    if (technicianId) {
      // For non-SN items, reflect in TechnicianStock so the tech's stock count is correct
      if (!clientPart.tracksSerialNumbers) {
        await prisma.$executeRaw`
          INSERT INTO "TechnicianStock" (id, "itemId", "technicianId", quantity, "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), ${clientPart.itemId}, ${technicianId}, 1, NOW(), NOW())
          ON CONFLICT ("itemId", "technicianId") DO UPDATE
          SET quantity = "TechnicianStock".quantity + 1, "updatedAt" = NOW()
        `
      }
      await prisma.itemMovement.create({
        data: {
          itemId: clientPart.itemId,
          movementType: 'TRANSFER_TO_TECH',
          quantity: 1,
          toUserId: technicianId,
          notes: `Peça reparada/trocada enviada ao técnico para entrega ao cliente`,
          createdById: payload.userId,
        },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error sending out client part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
