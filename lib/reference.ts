import { prisma } from './prisma'

async function nextCounter(tx: any, counterKey: string): Promise<number> {
  const current = await tx.systemSetting.findUnique({ where: { key: counterKey } })
  const next = current ? parseInt(current.value) + 1 : 1
  await tx.systemSetting.upsert({
    where: { key: counterKey },
    create: { key: counterKey, value: String(next) },
    update: { value: String(next) },
  })
  return next
}

export async function generateClientReference(): Promise<string> {
  return prisma.$transaction(async (tx: any) => {
    const prefixRow = await tx.systemSetting.findUnique({ where: { key: 'clientPrefix' } })
    const prefix = prefixRow?.value?.trim() || 'CLI'
    const counter = await nextCounter(tx, 'clientCounter')
    return `${prefix}-${String(counter).padStart(3, '0')}`
  })
}

export async function generateProjectReference(): Promise<string> {
  return prisma.$transaction(async (tx: any) => {
    const prefixRow = await tx.systemSetting.findUnique({ where: { key: 'projectPrefix' } })
    const prefix = prefixRow?.value?.trim() || 'INT'
    const counter = await nextCounter(tx, 'projectCounter')
    const year = new Date().getFullYear()
    return `${prefix}-${String(counter).padStart(3, '0')}/${year}`
  })
}

export async function generateWorkOrderReference(): Promise<string> {
  return prisma.$transaction(async (tx: any) => {
    const prefixRow = await tx.systemSetting.findUnique({ where: { key: 'workOrderPrefix' } })
    const prefix = prefixRow?.value?.trim() || 'WO'
    const counter = await nextCounter(tx, 'workOrderCounter')
    return `${prefix}-${String(counter).padStart(4, '0')}`
  })
}

export async function generateRepairReference(): Promise<string> {
  return prisma.$transaction(async (tx: any) => {
    const prefixRow = await tx.systemSetting.findUnique({ where: { key: 'repairPrefix' } })
    const prefix = prefixRow?.value?.trim() || 'REP'
    const counter = await nextCounter(tx, 'repairCounter')
    const year = new Date().getFullYear()
    return `${prefix}-${String(counter).padStart(3, '0')}/${year}`
  })
}

export async function generateClientRepairReference(): Promise<string> {
  return prisma.$transaction(async (tx: any) => {
    const prefixRow = await tx.systemSetting.findUnique({ where: { key: 'clientRepairPrefix' } })
    const prefix = prefixRow?.value?.trim() || 'REC'
    const counter = await nextCounter(tx, 'clientRepairCounter')
    const year = new Date().getFullYear()
    return `${prefix}-${String(counter).padStart(3, '0')}/${year}`
  })
}

export async function generateUserReference(): Promise<string> {
  return prisma.$transaction(async (tx: any) => {
    const prefixRow = await tx.systemSetting.findUnique({ where: { key: 'userPrefix' } })
    const prefix = prefixRow?.value?.trim() || 'USR'
    const counter = await nextCounter(tx, 'userCounter')
    return `${prefix}-${String(counter).padStart(3, '0')}`
  })
}
