import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { status } = await request.json()

    const validStatuses = ['PENDING', 'ORDERED', 'RECEIVED', 'CANCELLED', 'COMPLETED']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const now = new Date().toISOString()
    await prisma.$executeRaw`
      UPDATE "PartRequest"
      SET status = ${status}, "updatedAt" = ${now}::timestamptz
      WHERE id = ${id}
    `

    // If resolved (COMPLETED or CANCELLED), check if intervention can leave PENDING_PARTS
    if (status === 'COMPLETED' || status === 'CANCELLED') {
      const [req] = await prisma.$queryRaw<[{ interventionId: string }]>`
        SELECT "interventionId" FROM "PartRequest" WHERE id = ${id}
      `
      if (req) {
        const [{ open_count }] = await prisma.$queryRaw<[{ open_count: bigint }]>`
          SELECT COUNT(*) AS open_count FROM "PartRequest"
          WHERE "interventionId" = ${req.interventionId}
            AND status NOT IN ('COMPLETED', 'CANCELLED')
        `
        if (Number(open_count) === 0) {
          await prisma.$executeRaw`
            UPDATE "Intervention"
            SET status = 'IN_PROGRESS', "updatedAt" = ${now}::timestamptz
            WHERE id = ${req.interventionId} AND status = 'PENDING_PARTS'
          `
        }
      }
    }

    return NextResponse.json({ id, status })
  } catch (error) {
    console.error('Error updating part request:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get interventionId before deleting
    const rows = await prisma.$queryRaw<[{ interventionId: string }]>`
      SELECT "interventionId" FROM "PartRequest" WHERE id = ${id}
    `
    const interventionId = rows[0]?.interventionId

    await prisma.$executeRaw`DELETE FROM "PartRequest" WHERE id = ${id}`

    // If no more open requests, revert intervention from PENDING_PARTS
    if (interventionId) {
      const [{ open_count }] = await prisma.$queryRaw<[{ open_count: bigint }]>`
        SELECT COUNT(*) AS open_count FROM "PartRequest"
        WHERE "interventionId" = ${interventionId}
          AND status NOT IN ('COMPLETED', 'CANCELLED')
      `
      if (Number(open_count) === 0) {
        const now = new Date().toISOString()
        await prisma.$executeRaw`
          UPDATE "Intervention"
          SET status = 'IN_PROGRESS', "updatedAt" = ${now}::timestamptz
          WHERE id = ${interventionId} AND status = 'PENDING_PARTS'
        `
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting part request:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
