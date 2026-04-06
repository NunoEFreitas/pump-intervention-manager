import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/middleware'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authCheck = await requireAdmin(request)
  if (authCheck instanceof NextResponse) return authCheck

  try {
    const { id } = await params
    const { name } = await request.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const category = await prisma.itemCategory.update({ where: { id }, data: { name: name.trim() } })
    return NextResponse.json(category)
  } catch (error: any) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'Category already exists' }, { status: 400 })
    console.error('Error updating item category:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authCheck = await requireAdmin(request)
  if (authCheck instanceof NextResponse) return authCheck

  try {
    const { id } = await params

    const inUse = await prisma.warehouseItem.count({ where: { categoryId: id } })
    if (inUse > 0) {
      return NextResponse.json({ error: `Não é possível eliminar: categoria em uso por ${inUse} artigo(s)` }, { status: 400 })
    }

    await prisma.itemCategory.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting item category:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
