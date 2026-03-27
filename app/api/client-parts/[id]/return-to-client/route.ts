import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// POST — mark client part as returned to client
// Valid when:
//   - clientPartStatus = 'SWAP' (swap was done, replacement already given)
//   - clientPartStatus = 'REPAIR' and repair job is in terminal status (REPAIRED / RETURNED_TO_CLIENT / NOT_REPAIRED / WRITTEN_OFF)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const payload = verifyToken(token || '')
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: serialNumberId } = await params
    const registeredById: string = payload.userId
    const now = new Date()

    const [clientPart] = await prisma.$queryRaw<any[]>`
      SELECT sn.id, sn."itemId", sn."clientPartStatus", sn."clientRepairJobId", sn."sentOutTechnicianId",
             rj.status AS "repairStatus"
      FROM "SerialNumberStock" sn
      LEFT JOIN "PartRepairJob" rj ON rj.id = sn."clientRepairJobId"
      WHERE sn.id = ${serialNumberId} AND sn."isClientPart" = true
    `
    if (!clientPart) return NextResponse.json({ error: 'Client part not found' }, { status: 404 })
    if (clientPart.clientPartStatus === 'RESOLVED') {
      return NextResponse.json({ error: 'Já foi devolvida ao cliente' }, { status: 400 })
    }

    if (clientPart.clientPartStatus !== 'RETURNING') {
      return NextResponse.json({ error: 'Peça não está em trânsito para o cliente — use "Dar Saída" primeiro' }, { status: 400 })
    }

    await prisma.$executeRaw`
      UPDATE "SerialNumberStock"
      SET "clientPartStatus" = 'RESOLVED',
          "returnedToClientAt" = ${now}::timestamptz,
          "returnedToClientById" = ${clientPart.sentOutTechnicianId ?? registeredById},
          "returnedToClientRegisteredById" = ${registeredById},
          location = 'USED',
          "updatedAt" = ${now}::timestamptz
      WHERE id = ${serialNumberId}
    `

    return NextResponse.json({ ok: true, returnedToClientAt: now })
  } catch (error) {
    console.error('Error returning part to client:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
