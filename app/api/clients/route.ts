import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { generateClientReference } from '@/lib/reference'

// GET all clients
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clients = await prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { interventions: true }
        }
      }
    })

    return NextResponse.json(clients)
  } catch (error) {
    console.error('Error fetching clients:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST create new client
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()

    const reference = await generateClientReference()

    const client = await prisma.client.create({
      data: {
        reference,
        name: data.name,
        address: data.address,
        city: data.city,
        postalCode: data.postalCode,
        phone: data.phone,
        email: data.email,
        contactPerson: data.contactPerson,
        notes: data.notes,
      },
    })

    // Set new fields via raw SQL (Prisma client may be stale)
    await prisma.$executeRaw`
      UPDATE "Client"
      SET "vatNumber" = ${data.vatNumber || null},
          "country"   = ${data.country || null},
          "district"  = ${data.district || null}
      WHERE id = ${client.id}
    `

    return NextResponse.json({ ...client, vatNumber: data.vatNumber || null, country: data.country || null, district: data.district || null }, { status: 201 })
  } catch (error) {
    console.error('Error creating client:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
