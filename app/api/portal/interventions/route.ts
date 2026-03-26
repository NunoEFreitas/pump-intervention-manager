import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { generateProjectReference } from '@/lib/reference'

async function getClientUser(userId: string) {
  const userRows = await prisma.$queryRaw<{ id: string; clientId: string | null; role: string }[]>`
    SELECT id, "clientId", role FROM "User" WHERE id = ${userId}
  `
  return userRows[0] || null
}

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

    const user = await getClientUser(payload.userId)

    if (!user || user.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!user.clientId) {
      return NextResponse.json({ error: 'No client linked to this user' }, { status: 404 })
    }

    const interventions = await prisma.intervention.findMany({
      where: { clientId: user.clientId },
      include: {
        assignedTo: { select: { name: true } },
        location: { select: { id: true, name: true, city: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(interventions)
  } catch (error) {
    console.error('Error fetching portal interventions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const user = await getClientUser(payload.userId)

    if (!user || user.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!user.clientId) {
      return NextResponse.json({ error: 'No client linked to this user' }, { status: 404 })
    }

    const { breakdown, locationId } = await request.json()

    if (!breakdown) {
      return NextResponse.json({ error: 'breakdown is required' }, { status: 400 })
    }

    // If a location is provided, verify it belongs to this client (prevents IDOR)
    if (locationId) {
      const locationRows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "CompanyLocation" WHERE id = ${locationId} AND "clientId" = ${user.clientId}
      `
      if (locationRows.length === 0) {
        return NextResponse.json({ error: 'Invalid location' }, { status: 400 })
      }
    }

    const reference = await generateProjectReference()

    const intervention = await prisma.intervention.create({
      data: {
        clientId: user.clientId,
        locationId: locationId || null,
        breakdown,
        status: 'OPEN',
        reference,
      },
    })

    return NextResponse.json(intervention, { status: 201 })
  } catch (error) {
    console.error('Error creating portal intervention:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
