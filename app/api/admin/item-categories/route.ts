import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/middleware'
import { verifyToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const categories = await prisma.itemCategory.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json(categories)
  } catch (error) {
    console.error('Error fetching item categories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authCheck = await requireAdmin(request)
  if (authCheck instanceof NextResponse) return authCheck

  try {
    const { name } = await request.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const category = await prisma.itemCategory.create({ data: { name: name.trim() } })
    return NextResponse.json(category, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'Category already exists' }, { status: 400 })
    console.error('Error creating item category:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
