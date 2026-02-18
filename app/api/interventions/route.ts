import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// GET all interventions (filtered by role)
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    const payload = verifyToken(token || '')
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user to check role
    const currentUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true },
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const clientId = searchParams.get('clientId')

    const where: any = {}
    if (status) where.status = status
    if (clientId) where.clientId = clientId

    // TECHNICIAN can only see their own interventions
    if (currentUser.role === 'TECHNICIAN') {
      where.assignedToId = payload.userId
    }

    const interventions = await prisma.intervention.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { scheduledDate: 'desc' },
    })

    return NextResponse.json(interventions)
  } catch (error) {
    console.error('Error fetching interventions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST create new intervention
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    const payload = verifyToken(token || '')
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()

    // Validate required fields
    if (!data.clientId || !data.assignedToId || !data.scheduledDate || !data.scheduledTime || !data.breakdown) {
      return NextResponse.json(
        { error: 'Client, assigned technician, date, time and breakdown description are required' },
        { status: 400 }
      )
    }

    // If client is COMPANY, locationId is required
    const client = await prisma.client.findUnique({ where: { id: data.clientId }, select: { clientType: true } })
    if (client?.clientType === 'COMPANY' && !data.locationId) {
      return NextResponse.json(
        { error: 'Location is required for company clients' },
        { status: 400 }
      )
    }

    const intervention = await prisma.intervention.create({
      data: {
        clientId: data.clientId,
        locationId: data.locationId || null,
        assignedToId: data.assignedToId,
        createdById: payload.userId,
        status: 'OPEN',
        scheduledDate: new Date(data.scheduledDate),
        scheduledTime: data.scheduledTime,
        breakdown: data.breakdown,
        workDone: data.workDone || null,
        timeSpent: data.timeSpent || null,
        description: data.description || null,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(intervention, { status: 201 })
  } catch (error) {
    console.error('Error creating intervention:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
