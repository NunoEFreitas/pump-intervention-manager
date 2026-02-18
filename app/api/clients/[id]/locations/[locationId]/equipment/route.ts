import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// POST create equipment for a location
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; locationId: string }> }
) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id: clientId, locationId } = await params
    const { equipmentTypeId, brandId, model } = await request.json()

    if (!equipmentTypeId || !brandId || !model?.trim()) {
      return NextResponse.json({ error: 'equipmentTypeId, brandId, and model are required' }, { status: 400 })
    }

    // Verify location belongs to client
    const location = await prisma.companyLocation.findFirst({
      where: { id: locationId, clientId },
    })
    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    const equipment = await prisma.locationEquipment.create({
      data: { locationId, equipmentTypeId, brandId, model: model.trim() },
      include: {
        equipmentType: { select: { name: true } },
        brand: { select: { name: true } },
      },
    })

    return NextResponse.json(equipment, { status: 201 })
  } catch (error) {
    console.error('Error creating equipment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
