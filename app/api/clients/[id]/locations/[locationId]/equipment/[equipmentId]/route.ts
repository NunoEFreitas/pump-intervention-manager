import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// PUT update equipment
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; locationId: string; equipmentId: string }> }
) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { equipmentId } = await params
    const { equipmentTypeId, brandId, model } = await request.json()

    if (!equipmentTypeId || !brandId || !model?.trim()) {
      return NextResponse.json({ error: 'equipmentTypeId, brandId, and model are required' }, { status: 400 })
    }

    const equipment = await prisma.locationEquipment.update({
      where: { id: equipmentId },
      data: { equipmentTypeId, brandId, model: model.trim() },
      include: {
        equipmentType: { select: { name: true } },
        brand: { select: { name: true } },
      },
    })

    return NextResponse.json(equipment)
  } catch (error) {
    console.error('Error updating equipment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE equipment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; locationId: string; equipmentId: string }> }
) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { equipmentId } = await params
    await prisma.locationEquipment.delete({ where: { id: equipmentId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting equipment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
