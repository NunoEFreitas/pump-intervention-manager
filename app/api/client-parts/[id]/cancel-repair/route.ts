import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

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
      SELECT sn.id, sn."itemId", sn."technicianId", sn."clientPartStatus", sn."clientRepairJobId",
             rj.status AS "repairStatus", rj.id AS "repairJobId"
      FROM "SerialNumberStock" sn
      LEFT JOIN "PartRepairJob" rj ON rj.id = sn."clientRepairJobId"
      WHERE sn.id = ${serialNumberId} AND sn."isClientPart" = true
    `
    if (!clientPart) return NextResponse.json({ error: 'Client part not found' }, { status: 404 })
    if (clientPart.clientPartStatus !== 'REPAIR') {
      return NextResponse.json({ error: 'Peça não está em reparação' }, { status: 400 })
    }
    if (clientPart.repairStatus !== 'PENDING') {
      return NextResponse.json({ error: 'Apenas reparações no estado "Criada" podem ser canceladas' }, { status: 400 })
    }

    const repairJobId = clientPart.repairJobId
    const technicianId = clientPart.technicianId
    const itemId = clientPart.itemId

    await prisma.$transaction(async (tx) => {
      // Revert the SN back to PENDING (no repair job)
      await tx.$executeRaw`
        UPDATE "SerialNumberStock"
        SET "clientPartStatus" = NULL,
            "clientRepairJobId" = NULL,
            "updatedAt" = ${now}::timestamptz
        WHERE id = ${serialNumberId}
      `

      // Delete the repair job
      if (repairJobId) {
        await tx.$executeRaw`
          DELETE FROM "PartRepairJob" WHERE id = ${repairJobId}
        `
      }

    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error cancelling repair:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
