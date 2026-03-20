import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { userId } = payload

    // Fetch user via raw SQL
    const userRows = await prisma.$queryRaw<{ id: string; clientId: string | null; role: string }[]>`
      SELECT id, "clientId", role FROM "User" WHERE id = ${userId}
    `
    const user = userRows[0]

    if (!user || user.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!user.clientId) {
      return NextResponse.json({ error: 'No client linked to this user' }, { status: 404 })
    }

    const { name, country, district, address, city, postalCode, phone, contactPerson, notes } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const location = await prisma.companyLocation.create({
      data: {
        clientId: user.clientId,
        name,
        country: country || null,
        district: district || null,
        address: address || null,
        city: city || null,
        postalCode: postalCode || null,
        phone: phone || null,
        contactPerson: contactPerson || null,
        notes: notes || null,
      },
    })

    return NextResponse.json(location, { status: 201 })
  } catch (error) {
    console.error('Error creating portal location:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
