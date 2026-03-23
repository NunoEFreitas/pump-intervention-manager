import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { requireAdmin } from '@/lib/middleware'
import { generateUserReference } from '@/lib/reference'

// GET all users (admin only)
export async function GET(request: NextRequest) {
  const authCheck = await requireAdmin(request)
  if (authCheck instanceof NextResponse) {
    return authCheck
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        _count: {
          select: { assignedInterventions: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    })

    const ids = users.map((u) => u.id)
    const extraRows = ids.length > 0
      ? await prisma.$queryRaw<{ id: string; blocked: boolean; reference: string | null }[]>`
          SELECT id, blocked, reference FROM "User" WHERE id::text = ANY(${ids}::text[])
        `
      : []
    const extraMap = Object.fromEntries(extraRows.map((r) => [r.id, r]))

    return NextResponse.json(users.map((u) => ({ ...u, blocked: extraMap[u.id]?.blocked ?? false, reference: extraMap[u.id]?.reference ?? null })))
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST create new user (admin only)
export async function POST(request: NextRequest) {
  const authCheck = await requireAdmin(request)
  if (authCheck instanceof NextResponse) {
    return authCheck
  }

  try {
    const data = await request.json()

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Validate role
    if (!['ADMIN', 'SUPERVISOR', 'TECHNICIAN'].includes(data.role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      )
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(data.password)
    const reference = await generateUserReference()

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role: data.role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    })

    // Set reference via raw SQL (Prisma client may be stale)
    await prisma.$executeRaw`UPDATE "User" SET reference = ${reference} WHERE id = ${user.id}`

    return NextResponse.json({ ...user, reference }, { status: 201 })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
