import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/middleware'
import { verifyToken } from '@/lib/auth'

// GET all equipment brands (any authenticated user)
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const brands = await prisma.equipmentBrand.findMany({
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(brands)
  } catch (error) {
    console.error('Error fetching equipment brands:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST create equipment brand (admin only)
export async function POST(request: NextRequest) {
  const authCheck = await requireAdmin(request)
  if (authCheck instanceof NextResponse) return authCheck

  try {
    const { name } = await request.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const brand = await prisma.equipmentBrand.create({
      data: { name: name.trim() },
    })
    return NextResponse.json(brand, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Equipment brand already exists' }, { status: 400 })
    }
    console.error('Error creating equipment brand:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
