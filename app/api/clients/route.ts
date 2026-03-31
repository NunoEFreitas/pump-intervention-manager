import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { generateClientReference } from '@/lib/reference'
import { randomUUID } from 'crypto'
import { z } from 'zod'

const ClientSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Invalid email address').max(255).optional().nullable().or(z.literal('')),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  contactPerson: z.string().max(255).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  vatNumber: z.string().max(50).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  district: z.string().max(100).optional().nullable(),
})

// GET clients (paginated + search)
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')

    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim() || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const offset = (page - 1) * limit
    const searchLike = `%${search.toLowerCase()}%`

    const [countRows, clients] = await Promise.all([
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint AS count FROM "Client"
        WHERE LOWER(name) LIKE ${searchLike}
           OR LOWER(COALESCE(reference, '')) LIKE ${searchLike}
           OR LOWER(COALESCE(city, '')) LIKE ${searchLike}
           OR LOWER(COALESCE(email, '')) LIKE ${searchLike}
      `,
      prisma.$queryRaw<any[]>`
        SELECT c.id, c.reference, c.name, c.city, c.phone, c.email,
               c."createdAt",
               COUNT(i.id)::int AS "interventionCount"
        FROM "Client" c
        LEFT JOIN "Intervention" i ON i."clientId" = c.id
        WHERE LOWER(c.name) LIKE ${searchLike}
           OR LOWER(COALESCE(c.reference, '')) LIKE ${searchLike}
           OR LOWER(COALESCE(c.city, '')) LIKE ${searchLike}
           OR LOWER(COALESCE(c.email, '')) LIKE ${searchLike}
        GROUP BY c.id
        ORDER BY c."createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
    ])

    const total = Number(countRows[0].count)

    // Shape to match existing frontend expectations
    const items = clients.map((c: any) => ({
      ...c,
      _count: { interventions: c.interventionCount },
    }))

    return NextResponse.json({ clients: items, total, page, pages: Math.ceil(total / limit), limit })
  } catch (error) {
    console.error('Error fetching clients:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST create new client
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')

    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = ClientSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }
    const data = parsed.data

    // Reject duplicate VAT numbers
    if (data.vatNumber) {
      const existing = await prisma.$queryRaw<{ id: string; name: string; reference: string }[]>`
        SELECT id, name, reference FROM "Client" WHERE "vatNumber" = ${data.vatNumber} LIMIT 1
      `
      if (existing.length > 0) {
        return NextResponse.json(
          { error: 'duplicate_vat', existingId: existing[0].id, existingName: existing[0].name, existingReference: existing[0].reference },
          { status: 409 }
        )
      }
    }

    const reference = await generateClientReference()

    const client = await prisma.client.create({
      data: {
        reference,
        name: data.name,
        address: data.address || null,
        city: data.city || null,
        postalCode: data.postalCode || null,
        phone: data.phone || null,
        email: data.email || null,
        contactPerson: data.contactPerson || null,
        notes: data.notes || null,
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

    // Auto-create first location from client address
    const locId = randomUUID()
    const now = new Date().toISOString()
    await prisma.$executeRaw`
      INSERT INTO "CompanyLocation" (id, "clientId", name, country, district, address, city, "postalCode", phone, "contactPerson", notes, "createdAt", "updatedAt")
      VALUES (${locId}, ${client.id}, ${data.name}, ${data.country || null}, ${data.district || null}, ${data.address || null}, ${data.city || null}, ${data.postalCode || null}, ${data.phone || null}, ${data.contactPerson || null}, ${data.notes || null}, ${now}::timestamptz, ${now}::timestamptz)
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
