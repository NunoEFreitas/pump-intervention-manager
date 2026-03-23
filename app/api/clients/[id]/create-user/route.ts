import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, hashPassword } from '@/lib/auth'
import { generateUserReference } from '@/lib/reference'
import { z } from 'zod'

const CreateClientUserSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  name: z.string().min(1, 'Name is required').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(255),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Check role via raw SQL (prisma client may be stale)
    const userRows = await prisma.$queryRaw<{ role: string }[]>`
      SELECT role FROM "User" WHERE id = ${payload.userId}
    `
    if (!userRows[0] || userRows[0].role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id: clientId } = await params

    // Check client exists
    const clientRows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Client" WHERE id = ${clientId}
    `
    if (!clientRows[0]) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = CreateClientUserSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }
    const { email, password, name } = parsed.data

    // Check if email already exists
    const existing = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "User" WHERE email = ${email}
    `
    if (existing[0]) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 })
    }

    const hashedPassword = await hashPassword(password)
    const reference = await generateUserReference()
    const id = crypto.randomUUID()
    const now = new Date()

    await prisma.$executeRaw`
      INSERT INTO "User" (id, reference, email, password, name, role, blocked, "clientId", "createdAt", "updatedAt")
      VALUES (${id}, ${reference}, ${email}, ${hashedPassword}, ${name}, 'CLIENT', false, ${clientId}, ${now}::timestamptz, ${now}::timestamptz)
    `

    return NextResponse.json({ id, reference, email, name, role: 'CLIENT', clientId }, { status: 201 })
  } catch (error) {
    console.error('Error creating client user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
