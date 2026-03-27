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
             rj.status AS "repairStatus"
      FROM "SerialNumberStock" sn
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

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error sending out client part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
