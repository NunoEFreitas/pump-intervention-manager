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
    const body = await request.json().catch(() => ({}))
    const clientItemSnConfirmed = (body.clientItemSn ?? '').trim() || null
    const now = new Date()

    const [clientPart] = await prisma.$queryRaw<any[]>`
      SELECT id, "itemId", "clientPartStatus", "technicianId", "interventionId", "preSwapped", "serialNumber"
      FROM "SerialNumberStock"
      WHERE id = ${serialNumberId} AND "isClientPart" = true
    `
    if (!clientPart) return NextResponse.json({ error: 'Client part not found' }, { status: 404 })
    if (clientPart.clientPartStatus !== 'IN_TRANSIT') {
      return NextResponse.json({ error: 'Peça não está em trânsito' }, { status: 400 })
    }

    if (clientPart.preSwapped) {
      // preSwapped: serialNumber = replacement given to client (keep), clientItemSn = broken part received
      await prisma.$executeRaw`
        UPDATE "SerialNumberStock"
        SET "clientPartStatus" = 'PENDING',
            "receivedAtWarehouseAt" = ${now}::timestamptz,
            "receivedAtWarehouseById" = ${payload.userId},
            "clientItemSn" = ${clientItemSnConfirmed},
            "updatedAt" = ${now}::timestamptz
        WHERE id = ${serialNumberId}
      `
    } else {
      // non-preSwapped: serialNumber IS the collected part SN — update it directly
      await prisma.$executeRaw`
        UPDATE "SerialNumberStock"
        SET "clientPartStatus" = 'PENDING',
            "receivedAtWarehouseAt" = ${now}::timestamptz,
            "receivedAtWarehouseById" = ${payload.userId},
            "serialNumber" = ${clientItemSnConfirmed},
            "updatedAt" = ${now}::timestamptz
        WHERE id = ${serialNumberId}
      `
    }

    if (clientPart.technicianId) {
      const sn = clientPart.serialNumber as string | null
      const notes = clientPart.preSwapped
        ? `Sub. imediata — peça avariada recebida no armazém${sn ? ` (SN: ${sn})` : ''}`
        : `Peça de cliente recebida no armazém${sn ? ` (SN: ${sn})` : ''}`
      await prisma.itemMovement.create({
        data: {
          itemId: clientPart.itemId,
          movementType: 'ADD_STOCK',
          quantity: 1,
          toUserId: null,
          fromUserId: clientPart.technicianId,
          notes,
          createdById: payload.userId,
        },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error receiving client part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
