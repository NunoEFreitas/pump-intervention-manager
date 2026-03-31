import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!verifyToken(token || '')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: interventionId } = await params

    const history = await prisma.$queryRaw<{
      id: string
      eventType: string
      description: string
      performedById: string
      performedByName: string | null
      performedAt: Date
    }[]>`
      SELECT
        h.id, h."eventType", h.description,
        h."performedById", h."performedAt",
        u.name AS "performedByName"
      FROM "InterventionHistory" h
      LEFT JOIN "User" u ON u.id = h."performedById"
      WHERE h."interventionId" = ${interventionId}
      ORDER BY h."performedAt" ASC
    `

    return NextResponse.json(history)
  } catch (error) {
    console.error('Error fetching intervention history:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
