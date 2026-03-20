import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, hashPassword } from '@/lib/auth'

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

    const { email, password, name } = await request.json()

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'email, password and name are required' }, { status: 400 })
    }

    // Check if email already exists
    const existing = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "User" WHERE email = ${email}
    `
    if (existing[0]) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 })
    }

    const hashedPassword = await hashPassword(password)
    const id = crypto.randomUUID()
    const now = new Date()

    await prisma.$executeRaw`
      INSERT INTO "User" (id, email, password, name, role, blocked, "clientId", "createdAt", "updatedAt")
      VALUES (${id}, ${email}, ${hashedPassword}, ${name}, 'CLIENT', false, ${clientId}, ${now}::timestamptz, ${now}::timestamptz)
    `

    return NextResponse.json({ id, email, name, role: 'CLIENT', clientId }, { status: 201 })
  } catch (error) {
    console.error('Error creating client user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
