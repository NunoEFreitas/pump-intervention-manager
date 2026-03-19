import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { canEditIntervention, canChangeStatus } from '@/lib/permissions'

// GET single intervention
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    const payload = verifyToken(token || '')
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const intervention = await prisma.intervention.findUnique({
      where: { id },
      include: {
        client: true,
        location: {
          include: {
            equipment: {
              select: {
                id: true,
                model: true,
                serialNumber: true,
                equipmentType: { select: { name: true } },
                brand: { select: { name: true } },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!intervention) {
      return NextResponse.json(
        { error: 'Intervention not found' },
        { status: 404 }
      )
    }

    // Get current user role
    const currentUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true },
    })

    // TECHNICIAN can only view their own interventions
    if (currentUser?.role === 'TECHNICIAN' && intervention.assignedToId !== payload.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch bill/contract/warranty via raw SQL
    const flagRows = await prisma.$queryRaw<[{ bill: boolean; contract: boolean; warranty: boolean }]>`
      SELECT "bill", "contract", "warranty" FROM "Intervention" WHERE id = ${id}
    `

    // Fetch new Client fields via raw SQL (Prisma client may be stale)
    const clientExtras = await prisma.$queryRaw<[{ vatNumber: string | null; country: string | null; district: string | null }]>`
      SELECT "vatNumber", "country", "district" FROM "Client" WHERE id = ${intervention.clientId}
    `

    // Fetch new CompanyLocation fields via raw SQL if there's a location
    let locationExtras: { country: string | null; district: string | null; ovmRegulatorId: string | null } | null = null
    if (intervention.locationId) {
      const locRows = await prisma.$queryRaw<[{ country: string | null; district: string | null; ovmRegulatorId: string | null }]>`
        SELECT "country", "district", "ovmRegulatorId" FROM "CompanyLocation" WHERE id = ${intervention.locationId}
      `
      locationExtras = locRows[0] ?? null
    }

    return NextResponse.json({
      ...intervention,
      bill: flagRows[0]?.bill ?? false,
      contract: flagRows[0]?.contract ?? false,
      warranty: flagRows[0]?.warranty ?? false,
      client: { ...intervention.client, ...(clientExtras[0] ?? {}) },
      location: intervention.location ? { ...intervention.location, ...(locationExtras ?? {}) } : null,
    })
  } catch (error) {
    console.error('Error fetching intervention:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT update intervention
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    const payload = verifyToken(token || '')
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { id } = await params

    // Get current intervention and user
    const intervention = await prisma.intervention.findUnique({
      where: { id },
    })

    if (!intervention) {
      return NextResponse.json(
        { error: 'Intervention not found' },
        { status: 404 }
      )
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true },
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // TECHNICIAN can only edit their own interventions
    if (currentUser.role === 'TECHNICIAN' && intervention.assignedToId !== payload.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if user can edit this intervention
    if (!canEditIntervention(currentUser.role as any, intervention.status as any)) {
      return NextResponse.json(
        { error: 'Cannot edit completed or canceled interventions' },
        { status: 403 }
      )
    }

    // Auto-transition to ASSIGNED when technician is assigned to an OPEN intervention
    let newStatus = data.status
    if (data.assignedToId && !intervention.assignedToId && intervention.status === 'OPEN') {
      newStatus = 'ASSIGNED'
    }

    // Check if user can change status
    if (newStatus && newStatus !== intervention.status) {
      if (!canChangeStatus(currentUser.role as any, intervention.status as any, newStatus)) {
        return NextResponse.json(
          { error: 'You do not have permission to change to this status' },
          { status: 403 }
        )
      }
    }

    const updatedIntervention = await prisma.intervention.update({
      where: { id },
      data: {
        clientId: data.clientId,
        locationId: data.locationId !== undefined ? (data.locationId || null) : undefined,
        assignedToId: data.assignedToId !== undefined ? (data.assignedToId || null) : undefined,
        status: newStatus,
        scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : data.scheduledDate === null ? null : undefined,
        scheduledTime: data.scheduledTime !== undefined ? (data.scheduledTime || null) : undefined,
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

    if (data.bill !== undefined || data.contract !== undefined || data.warranty !== undefined) {
      await prisma.$executeRaw`
        UPDATE "Intervention"
        SET "bill"      = ${data.bill      ? true : false},
            "contract"  = ${data.contract  ? true : false},
            "warranty"  = ${data.warranty  ? true : false}
        WHERE id = ${id}
      `
    }

    return NextResponse.json({
      ...updatedIntervention,
      bill: data.bill ?? false,
      contract: data.contract ?? false,
      warranty: data.warranty ?? false,
    })
  } catch (error) {
    console.error('Error updating intervention:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE intervention
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    const payload = verifyToken(token || '')
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true },
    })

    // Only ADMIN and SUPERVISOR can delete interventions
    if (currentUser?.role === 'TECHNICIAN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    await prisma.intervention.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Intervention deleted successfully' })
  } catch (error) {
    console.error('Error deleting intervention:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
