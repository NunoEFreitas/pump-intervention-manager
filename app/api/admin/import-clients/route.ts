import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

const CHUNK_SIZE = 200

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const payload = verifyToken(token || '')
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { role: true } })
    if (user?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { rows } = await request.json() as {
      rows: { name: string; address1: string; address2: string; postalCode: string; city: string; vatNumber: string }[]
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
    }

    const validRows = rows.filter(r => r.name?.trim())
    const skipped = rows.length - validRows.length
    let created = 0

    for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
      const chunk = validRows.slice(i, i + CHUNK_SIZE)
      const now = new Date()

      await Promise.all(chunk.map(row => {
        const id = crypto.randomUUID()
        const address = [row.address1?.trim(), row.address2?.trim()].filter(Boolean).join(', ') || null
        const postalCode = row.postalCode?.trim() || null
        const city = row.city?.trim() || null
        const vatNumber = row.vatNumber?.trim() || null
        return prisma.$executeRaw`
          INSERT INTO "Client" (id, name, address, "postalCode", city, "vatNumber", contract, "createdAt", "updatedAt")
          VALUES (${id}, ${row.name.trim()}, ${address}, ${postalCode}, ${city}, ${vatNumber}, false, ${now}::timestamptz, ${now}::timestamptz)
        `
      }))

      created += chunk.length
    }

    return NextResponse.json({ created, skipped })
  } catch (error) {
    console.error('Import clients error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
