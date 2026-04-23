import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; replyId: string }> }) {
  const { id, replyId } = await params
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = verifyToken(token || '')
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { role: true } })
  const post = await prisma.forumPost.findUnique({ where: { id } })
  const reply = await prisma.forumReply.findUnique({ where: { id: replyId } })
  if (!post || !reply) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = user?.role === 'ADMIN'
  const isPostAuthor = post.authorId === payload.userId
  if (!isAdmin && !isPostAuthor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { isSolution } = await request.json()

  if (isSolution) {
    await prisma.forumReply.updateMany({ where: { postId: id }, data: { isSolution: false } })
    await prisma.forumPost.update({ where: { id }, data: { solved: true } })
  }

  const updated = await prisma.forumReply.update({ where: { id: replyId }, data: { isSolution } })
  return NextResponse.json(updated)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; replyId: string }> }) {
  const { replyId } = await params
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = verifyToken(token || '')
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { role: true } })
  const reply = await prisma.forumReply.findUnique({ where: { id: replyId } })
  if (!reply) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = user?.role === 'ADMIN'
  const isAuthor = reply.authorId === payload.userId
  if (!isAdmin && !isAuthor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.forumReply.delete({ where: { id: replyId } })
  return NextResponse.json({ ok: true })
}
