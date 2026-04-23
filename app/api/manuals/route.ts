import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = verifyToken(token || '')
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const manuals = await prisma.manual.findMany({
    select: { id: true, title: true, filename: true, uploadedById: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(manuals)
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = verifyToken(token || '')
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { role: true } })
  if (user?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { title, filename, data } = body
  if (!title?.trim() || !filename || !data) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const manual = await prisma.manual.create({
    data: { title: title.trim(), filename, data, uploadedById: payload.userId },
    select: { id: true, title: true, filename: true, uploadedById: true, createdAt: true },
  })
  return NextResponse.json(manual, { status: 201 })
}
