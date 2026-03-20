import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = token ? verifyToken(token) : null
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

    // Monday of current week
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1 // 0=Mon
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0)
    const weekEnd   = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1)

    // +7 days for upcoming
    const upcomingEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 8, 0, 0, 0)

    const include = {
      client:     { select: { id: true, name: true, address: true, city: true, postalCode: true, phone: true, contactPerson: true } },
      location:   { select: { id: true, name: true, address: true, city: true, postalCode: true, phone: true, contactPerson: true } },
      assignedTo: { select: { id: true, name: true } },
    }

    // Unassigned open interventions for today's drag-and-drop panel
    const unassignedOpen = await prisma.intervention.findMany({
      where: { status: 'OPEN', assignedToId: null },
      include,
      orderBy: { createdAt: 'asc' },
    })

    const activeNow = await prisma.intervention.findMany({
      where: { status: { in: ['IN_PROGRESS', 'QUALITY_ASSESSMENT'] } },
      include,
      orderBy: { scheduledDate: 'asc' },
    })

    const scheduledToday = await prisma.intervention.findMany({
      where: {
        status: 'ASSIGNED',
        scheduledDate: { gte: todayStart, lte: todayEnd },
      },
      include,
      orderBy: { scheduledDate: 'asc' },
    })

    const completedToday = await prisma.intervention.count({
      where: {
        status: 'COMPLETED',
        updatedAt: { gte: todayStart, lte: todayEnd },
      },
    })

    const needsPlanning = await prisma.intervention.count({
      where: { status: { in: ['OPEN', 'ASSIGNED'] }, scheduledDate: null },
    })

    // This week interventions (for week bar + tech load)
    const weekInterventions = await prisma.intervention.findMany({
      where: {
        status: { notIn: ['CANCELED'] },
        scheduledDate: { gte: weekStart, lte: weekEnd },
      },
      include,
      orderBy: { scheduledDate: 'asc' },
    })

    // Week day counts (Mon=0 … Sun=6)
    const weekDayCounts = [0, 0, 0, 0, 0, 0, 0]
    for (const iv of weekInterventions) {
      if (!iv.scheduledDate) continue
      const d = new Date(iv.scheduledDate)
      const idx = d.getDay() === 0 ? 6 : d.getDay() - 1
      weekDayCounts[idx]++
    }

    // Technician load this week
    const techMap = new Map<string, { id: string; name: string; count: number }>()
    for (const iv of weekInterventions) {
      if (!iv.assignedTo) continue
      const t = techMap.get(iv.assignedTo.id)
      if (t) t.count++
      else techMap.set(iv.assignedTo.id, { id: iv.assignedTo.id, name: iv.assignedTo.name, count: 1 })
    }
    const techLoad = Array.from(techMap.values()).sort((a, b) => b.count - a.count)

    // Upcoming: tomorrow → +7 days
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0)
    const upcoming = await prisma.intervention.findMany({
      where: {
        status: { notIn: ['COMPLETED', 'CANCELED'] },
        scheduledDate: { gte: tomorrowStart, lte: upcomingEnd },
      },
      include,
      orderBy: { scheduledDate: 'asc' },
      take: 20,
    })

    // Calendar: today + next 6 days, all statuses except canceled
    const calendarEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59)
    const calendarInterventions = await prisma.intervention.findMany({
      where: {
        status: { notIn: ['CANCELED'] },
        scheduledDate: { gte: todayStart, lte: calendarEnd },
      },
      include,
      orderBy: { scheduledDate: 'asc' },
    })

    // Today's list = active + scheduled today
    const todayList = [
      ...activeNow,
      ...scheduledToday.filter(s => !activeNow.find(a => a.id === s.id)),
    ]

    return NextResponse.json({
      counters: {
        activeNow: activeNow.length,
        scheduledToday: scheduledToday.length,
        completedToday,
        needsPlanning,
      },
      todayList,
      calendarInterventions,
      unassignedOpen,
      weekStart: weekStart.toISOString(),
      weekDayCounts,
      techLoad,
      upcoming,
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
