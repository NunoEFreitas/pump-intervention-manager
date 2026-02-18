import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/middleware'

// PUT update equipment type (admin only)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authCheck = await requireAdmin(request)
  if (authCheck instanceof NextResponse) return authCheck

  try {
    const { id } = await params
    const { name } = await request.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const type = await prisma.equipmentType.update({
      where: { id },
      data: { name: name.trim() },
    })
    return NextResponse.json(type)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Equipment type already exists' }, { status: 400 })
    }
    console.error('Error updating equipment type:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE equipment type (admin only)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authCheck = await requireAdmin(request)
  if (authCheck instanceof NextResponse) return authCheck

  try {
    const { id } = await params

    const inUse = await prisma.locationEquipment.count({ where: { equipmentTypeId: id } })
    if (inUse > 0) {
      return NextResponse.json({ error: 'Cannot delete: type is in use' }, { status: 400 })
    }

    await prisma.equipmentType.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting equipment type:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
