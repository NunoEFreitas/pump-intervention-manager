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

    return NextResponse.json(intervention)
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

    // Check if user can change status
    if (data.status && data.status !== intervention.status) {
      if (!canChangeStatus(currentUser.role as any, intervention.status as any, data.status)) {
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
        assignedToId: data.assignedToId,
        status: data.status,
        scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : undefined,
        scheduledTime: data.scheduledTime,
        breakdown: data.breakdown,
        workDone: data.workDone,
        timeSpent: data.timeSpent,
        description: data.description,
      },
      include: {
        client: {
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

    return NextResponse.json(updatedIntervention)
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
