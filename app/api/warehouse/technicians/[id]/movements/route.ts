import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: techId } = await params
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')))
    const offset = (page - 1) * limit

    const [countRows, movementRows] = await Promise.all([
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint AS count
        FROM "ItemMovement"
        WHERE "fromUserId" = ${techId} OR "toUserId" = ${techId}
      `,
      prisma.$queryRaw<any[]>`
        SELECT
          m.id,
          m."movementType",
          m.quantity,
          m.notes,
          m."createdAt",
          m."itemId",
          wi."itemName",
          wi."partNumber",
          m."fromUserId",
          fu.name AS "fromUserName",
          m."toUserId",
          tu.name AS "toUserName",
          m."createdById",
          cu.name AS "createdByName"
        FROM "ItemMovement" m
        JOIN "WarehouseItem" wi ON wi.id = m."itemId"
        LEFT JOIN "User" fu ON fu.id = m."fromUserId"
        LEFT JOIN "User" tu ON tu.id = m."toUserId"
        LEFT JOIN "User" cu ON cu.id = m."createdById"
        WHERE m."fromUserId" = ${techId} OR m."toUserId" = ${techId}
        ORDER BY m."createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
    ])

    const total = Number(countRows[0].count)

    const snRows = movementRows.length > 0
      ? await prisma.$queryRaw<any[]>`
          SELECT msn."movementId", sn."serialNumber"
          FROM "MovementSerialNumber" msn
          JOIN "SerialNumberStock" sn ON sn.id = msn."serialNumberId"
          WHERE msn."movementId" IN (
            SELECT m2.id
            FROM "ItemMovement" m2
            WHERE m2."fromUserId" = ${techId} OR m2."toUserId" = ${techId}
            ORDER BY m2."createdAt" DESC
            LIMIT ${limit} OFFSET ${offset}
          )
        `
      : []

    const snByMovement = new Map<string, string[]>()
    for (const row of snRows) {
      if (!snByMovement.has(row.movementId)) snByMovement.set(row.movementId, [])
      if (row.serialNumber != null) {
        snByMovement.get(row.movementId)!.push(row.serialNumber)
      }
    }

    const movements = movementRows.map(m => ({
      id: m.id,
      movementType: m.movementType,
      quantity: m.quantity,
      notes: m.notes,
      createdAt: m.createdAt,
      itemId: m.itemId,
      itemName: m.itemName,
      partNumber: m.partNumber,
      fromUserName: m.fromUserId ? (m.fromUserName ?? null) : null,
      toUserName: m.toUserId ? (m.toUserName ?? null) : null,
      createdByName: m.createdByName as string,
      serialNumbers: snByMovement.get(m.id) ?? [],
    }))

    return NextResponse.json({
      movements,
      total,
      page,
      pages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Error fetching technician movements:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
