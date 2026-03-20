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
    await prisma.$executeRaw`DELETE FROM "PartRequest" WHERE id = ${id}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting part request:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
