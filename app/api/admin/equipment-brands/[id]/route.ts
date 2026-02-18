import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/middleware'

// PUT update equipment brand (admin only)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authCheck = await requireAdmin(request)
  if (authCheck instanceof NextResponse) return authCheck

  try {
    const { id } = await params
    const { name } = await request.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const brand = await prisma.equipmentBrand.update({
      where: { id },
      data: { name: name.trim() },
    })
    return NextResponse.json(brand)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Equipment brand already exists' }, { status: 400 })
    }
    console.error('Error updating equipment brand:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE equipment brand (admin only)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authCheck = await requireAdmin(request)
  if (authCheck instanceof NextResponse) return authCheck

  try {
    const { id } = await params

    const inUse = await prisma.locationEquipment.count({ where: { brandId: id } })
    if (inUse > 0) {
      return NextResponse.json({ error: 'Cannot delete: brand is in use' }, { status: 400 })
    }

    await prisma.equipmentBrand.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting equipment brand:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
