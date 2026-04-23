import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = verifyToken(token || '')
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const posts = await prisma.forumPost.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, title: true, content: true,
      authorId: true, authorName: true, solved: true,
      createdAt: true, updatedAt: true,
      _count: { select: { replies: true } },
    },
  })
  return NextResponse.json(posts)
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = verifyToken(token || '')
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { name: true } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { title, content } = await request.json()
  if (!title?.trim() || !content?.trim()) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const post = await prisma.forumPost.create({
    data: { title: title.trim(), content: content.trim(), authorId: payload.userId, authorName: user.name },
  })
  return NextResponse.json(post, { status: 201 })
}
