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

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')))
    const offset = (page - 1) * limit
    const snFilter = searchParams.get('sn')?.trim() || null

    if (snFilter) {
      // Filter movements that include this serial number
      const [countRows, movementRows] = await Promise.all([
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(DISTINCT m.id)::bigint AS count
          FROM "ItemMovement" m
          JOIN "MovementSerialNumber" msn ON msn."movementId" = m.id
          JOIN "SerialNumberStock" sn ON sn.id = msn."serialNumberId"
          WHERE m."itemId" = ${id} AND sn."serialNumber" = ${snFilter}
        `,
        prisma.$queryRaw<any[]>`
          SELECT DISTINCT m.id, m."movementType", m.quantity, m.notes, m."createdAt",
                 m."fromUserId", fu.name AS "fromUserName",
                 m."toUserId", tu.name AS "toUserName",
                 m."createdById", cu.name AS "createdByName"
          FROM "ItemMovement" m
          JOIN "MovementSerialNumber" msn ON msn."movementId" = m.id
          JOIN "SerialNumberStock" sn ON sn.id = msn."serialNumberId"
          LEFT JOIN "User" fu ON fu.id = m."fromUserId"
          LEFT JOIN "User" tu ON tu.id = m."toUserId"
          LEFT JOIN "User" cu ON cu.id = m."createdById"
          WHERE m."itemId" = ${id} AND sn."serialNumber" = ${snFilter}
          ORDER BY m."createdAt" DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
      ])

      const total = Number(countRows[0].count)
      const snRows = movementRows.length > 0
        ? await prisma.$queryRaw<any[]>`
            SELECT msn."movementId", sn.id AS "snId", sn."serialNumber"
            FROM "MovementSerialNumber" msn
            JOIN "SerialNumberStock" sn ON sn.id = msn."serialNumberId"
            WHERE msn."movementId" IN (
              SELECT m2.id FROM "ItemMovement" m2
              JOIN "MovementSerialNumber" msn2 ON msn2."movementId" = m2.id
              JOIN "SerialNumberStock" sn2 ON sn2.id = msn2."serialNumberId"
              WHERE m2."itemId" = ${id} AND sn2."serialNumber" = ${snFilter}
              ORDER BY m2."createdAt" DESC
              LIMIT ${limit} OFFSET ${offset}
            )
          `
        : []

      return NextResponse.json(buildResponse(movementRows, snRows, total, page, limit))
    }

    // No SN filter — paginate all movements for this item
    const [countRows, movementRows] = await Promise.all([
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint AS count FROM "ItemMovement" WHERE "itemId" = ${id}
      `,
      prisma.$queryRaw<any[]>`
        SELECT m.id, m."movementType", m.quantity, m.notes, m."createdAt",
               m."fromUserId", fu.name AS "fromUserName",
               m."toUserId", tu.name AS "toUserName",
               m."createdById", cu.name AS "createdByName"
        FROM "ItemMovement" m
        LEFT JOIN "User" fu ON fu.id = m."fromUserId"
        LEFT JOIN "User" tu ON tu.id = m."toUserId"
        LEFT JOIN "User" cu ON cu.id = m."createdById"
        WHERE m."itemId" = ${id}
        ORDER BY m."createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
    ])

    const total = Number(countRows[0].count)
    const snRows = movementRows.length > 0
      ? await prisma.$queryRaw<any[]>`
          SELECT msn."movementId", sn.id AS "snId", sn."serialNumber"
          FROM "MovementSerialNumber" msn
          JOIN "SerialNumberStock" sn ON sn.id = msn."serialNumberId"
          WHERE msn."movementId" IN (
            SELECT m2.id FROM "ItemMovement" m2
            WHERE m2."itemId" = ${id}
            ORDER BY m2."createdAt" DESC
            LIMIT ${limit} OFFSET ${offset}
          )
        `
      : []

    return NextResponse.json(buildResponse(movementRows, snRows, total, page, limit))
  } catch (error) {
    console.error('Error fetching movements:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function buildResponse(movementRows: any[], snRows: any[], total: number, page: number, limit: number) {
  const snByMovement = new Map<string, any[]>()
  for (const row of snRows) {
    if (!snByMovement.has(row.movementId)) snByMovement.set(row.movementId, [])
    snByMovement.get(row.movementId)!.push({ serialNumber: { id: row.snId, serialNumber: row.serialNumber } })
  }

  const movements = movementRows.map(m => ({
    id: m.id,
    movementType: m.movementType,
    quantity: m.quantity,
    notes: m.notes,
    createdAt: m.createdAt,
    fromUser: m.fromUserId ? { name: m.fromUserName } : null,
    toUser: m.toUserId ? { name: m.toUserName } : null,
    createdBy: { name: m.createdByName },
    serialNumbers: snByMovement.get(m.id) ?? [],
  }))

  return { movements, total, page, pages: Math.ceil(total / limit), limit }
}
