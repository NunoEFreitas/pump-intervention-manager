import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// POST — receive the client part: IN_TRANSIT → PENDING
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
      SELECT id, "itemId", "clientPartStatus", "technicianId", "interventionId"
      FROM "SerialNumberStock"
      WHERE id = ${serialNumberId} AND "isClientPart" = true
    `
    if (!clientPart) return NextResponse.json({ error: 'Client part not found' }, { status: 404 })
    if (clientPart.clientPartStatus !== 'IN_TRANSIT') {
      return NextResponse.json({ error: 'Peça não está em trânsito' }, { status: 400 })
    }

    await prisma.$executeRaw`
      UPDATE "SerialNumberStock"
      SET "clientPartStatus" = 'PENDING',
          "receivedAtWarehouseAt" = ${now}::timestamptz,
          "receivedAtWarehouseById" = ${payload.userId},
          "updatedAt" = ${now}::timestamptz
      WHERE id = ${serialNumberId}
    `

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error receiving client part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
