import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { generateProjectReference } from '@/lib/reference'

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
    if (!data.clientId || !data.breakdown) {
      return NextResponse.json(
        { error: 'Client and breakdown description are required' },
        { status: 400 }
      )
    }

    const reference = await generateProjectReference()

    const intervention = await prisma.intervention.create({
      data: {
        reference,
        clientId: data.clientId,
        locationId: data.locationId || null,
        assignedToId: data.assignedToId || null,
        createdById: payload.userId,
        status: data.assignedToId ? 'ASSIGNED' : 'OPEN',
        scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
        scheduledTime: data.scheduledTime || null,
        breakdown: data.breakdown,
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
