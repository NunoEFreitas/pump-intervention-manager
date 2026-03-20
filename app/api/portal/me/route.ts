import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { userId } = payload

    // Fetch user via raw SQL (prisma client is stale regarding clientId)
    const userRows = await prisma.$queryRaw<{ id: string; clientId: string | null; role: string }[]>`
      SELECT id, "clientId", role FROM "User" WHERE id = ${userId}
    `
    const user = userRows[0]

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!user.clientId) {
      return NextResponse.json({ error: 'No client linked to this user' }, { status: 404 })
    }

    const clientId = user.clientId

    // Fetch client with locations and equipment
    const clientData = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        locations: {
          orderBy: { createdAt: 'asc' },
          include: {
            equipment: {
              include: {
                equipmentType: true,
                brand: true,
              },
            },
          },
        },
      },
    })

    if (!clientData) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Fetch extra fields via raw SQL
    const extraRows = await prisma.$queryRaw<{
      vatNumber: string | null
      country: string | null
      district: string | null
      contract: boolean
      contractDate: Date | null
    }[]>`
      SELECT "vatNumber", "country", "district", "contract", "contractDate"
      FROM "Client"
      WHERE id = ${clientId}
    `
    const extra = extraRows[0] || {}

    return NextResponse.json({ ...clientData, ...extra })
  } catch (error) {
    console.error('Error fetching portal me:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
