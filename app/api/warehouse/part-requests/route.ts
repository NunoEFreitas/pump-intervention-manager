import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

type PartRequestRow = {
  id: string
  interventionId: string
  interventionReference: string | null
  clientName: string
  warehouseItemId: string
  itemName: string
  partNumber: string
  tracksSerialNumbers: boolean
  mainWarehouse: number
  requestedById: string
  requesterName: string
  quantity: number
  notes: string | null
  status: string
  createdAt: Date
}

const COLS = `
  pr.id,
  pr."interventionId",
  i.reference AS "interventionReference",
  c.name AS "clientName",
  pr."warehouseItemId",
  wi."itemName",
  wi."partNumber",
  wi."tracksSerialNumbers",
  wi."mainWarehouse",
  pr."requestedById",
  u.name AS "requesterName",
  pr.quantity,
  pr.notes,
  pr.status,
  pr."createdAt"
`

const JOINS = `
  FROM "PartRequest" pr
  JOIN "Intervention" i ON i.id = pr."interventionId"
  JOIN "Client" c ON c.id = i."clientId"
  JOIN "WarehouseItem" wi ON wi.id = pr."warehouseItemId"
  JOIN "User" u ON u.id = pr."requestedById"
`

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let rows: PartRequestRow[]

    if (status && status !== 'ALL') {
      rows = await prisma.$queryRaw<PartRequestRow[]>`
        SELECT
          pr.id,
          pr."interventionId",
          i.reference AS "interventionReference",
          c.name AS "clientName",
          pr."warehouseItemId",
          wi."itemName",
          wi."partNumber",
          wi."tracksSerialNumbers",
          wi."mainWarehouse",
          pr."requestedById",
          u.name AS "requesterName",
          pr.quantity,
          pr.notes,
          pr.status,
          pr."createdAt"
        FROM "PartRequest" pr
        JOIN "Intervention" i ON i.id = pr."interventionId"
        JOIN "Client" c ON c.id = i."clientId"
        JOIN "WarehouseItem" wi ON wi.id = pr."warehouseItemId"
        JOIN "User" u ON u.id = pr."requestedById"
        WHERE pr.status = ${status}
        ORDER BY pr."createdAt" DESC
      `
    } else {
      rows = await prisma.$queryRaw<PartRequestRow[]>`
        SELECT
          pr.id,
          pr."interventionId",
          i.reference AS "interventionReference",
          c.name AS "clientName",
          pr."warehouseItemId",
          wi."itemName",
          wi."partNumber",
          wi."tracksSerialNumbers",
          wi."mainWarehouse",
          pr."requestedById",
          u.name AS "requesterName",
          pr.quantity,
          pr.notes,
          pr.status,
          pr."createdAt"
        FROM "PartRequest" pr
        JOIN "Intervention" i ON i.id = pr."interventionId"
        JOIN "Client" c ON c.id = i."clientId"
        JOIN "WarehouseItem" wi ON wi.id = pr."warehouseItemId"
        JOIN "User" u ON u.id = pr."requestedById"
        ORDER BY pr."createdAt" DESC
      `
    }

    return NextResponse.json(rows)
  } catch (error) {
    console.error('Error fetching all part requests:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
