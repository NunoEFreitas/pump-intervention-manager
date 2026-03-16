/**
 * Demo seed: 5 techs, ~20 clients, 2-3 interventions/day/tech across the current week.
 * Uses raw SQL to avoid stale Prisma client issues.
 * Run with: npx tsx scripts/seed-demo.ts
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

const TECHS = [
  { name: 'João Silva',      email: 'joao.silva@demo.com' },
  { name: 'Ana Costa',       email: 'ana.costa@demo.com' },
  { name: 'Carlos Martins',  email: 'carlos.martins@demo.com' },
  { name: 'Pedro Ferreira',  email: 'pedro.ferreira@demo.com' },
  { name: 'Sofia Rodrigues', email: 'sofia.rodrigues@demo.com' },
]

const CLIENTS = [
  { name: 'Britafiel Agregados SA',     city: 'Penafiel',         address: 'Av. Pedro Guedes S/N' },
  { name: 'Combustíveis do Norte Lda',  city: 'Braga',            address: 'Rua das Indústrias 45' },
  { name: 'Petro Minho SA',             city: 'Guimarães',        address: 'Zona Industrial 12' },
  { name: 'GALP Distribuição Porto',    city: 'Porto',            address: 'Rua Faria Guimarães 88' },
  { name: 'Automóveis Silva & Filhos',  city: 'Famalicão',        address: 'EN 206 Km 14' },
  { name: 'Construções Barros SA',      city: 'Amarante',         address: 'Rua do Comércio 7' },
  { name: 'Transnorte Transportes',     city: 'Barcelos',         address: 'Rua da Logística 33' },
  { name: 'Agroquímica Douro Lda',      city: 'Peso da Régua',    address: 'Quinta do Carvalho' },
  { name: 'Hotel Termas do Gerês',      city: 'Terras do Bouro',  address: 'Rua das Caldas 1' },
  { name: 'Cerâmica Central Lda',       city: 'Viana do Castelo', address: 'Zona Ind. S. Lourenço' },
  { name: 'Frigoríficos Bom Gosto',     city: 'Santo Tirso',      address: 'Av. da República 210' },
  { name: 'EDP Distribuição Norte',     city: 'Braga',            address: 'Rua de Santa Margarida 4' },
  { name: 'Madeirense & Coutinho SA',   city: 'Chaves',           address: 'Rua do Pinheiro 88' },
  { name: 'Transportes Valimar Lda',    city: 'Valença',          address: 'Zona Franca 5' },
  { name: 'Agrária do Minho SA',        city: 'Ponte de Lima',    address: 'Rua da Quinta 12' },
  { name: 'Metalúrgica Ferrosil',       city: 'Trofa',            address: 'Av. da Ferradura 55' },
  { name: 'Supermercados NorteVivo',    city: 'Póvoa de Varzim',  address: 'Centro Comercial Norte' },
  { name: 'Têxteis Minho Lda',          city: 'Felgueiras',       address: 'Rua das Fábricas 99' },
  { name: 'Lacticínios Serra Verde',    city: 'Monção',           address: 'Rua do Leite 3' },
  { name: 'Bombas & Sistemas SA',       city: 'Maia',             address: 'Parque Empresarial 8' },
]

const BREAKDOWNS = [
  'Bomba avariada, não arranca. Cliente reporta paragem total.',
  'Manutenção preventiva anual. Verificação de caudal e pressão.',
  'Substituição de vedantes e filtros. Perda de pressão detectada.',
  'CPU do fuellog avariada, sistema sem comunicação.',
  'Calibração dos contadores de combustível necessária.',
  'Sensor de nível com leitura incorrecta, alarme activo.',
  'Substituição de mangueiras desgastadas por envelhecimento.',
  'Pistola de abastecimento com defeito, gotejamento após uso.',
  'Motor da bomba com ruído anormal, rolamentos a desgastar.',
  'Sistema de filtragem entupido, caudal reduzido em 60%.',
  'Fuga detectada na ligação da bomba ao reservatório.',
  'Actualização de firmware do sistema de gestão de combustível.',
  'Substituição do caudalímetro após falha de calibração.',
  'Revisão geral solicitada por contrato de manutenção.',
  'Painel de controlo sem resposta, possível falha eléctrica.',
]

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function pad(n: number) { return String(n).padStart(5, '0') }

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

const TIMES = ['08:00', '09:30', '10:00', '11:30', '13:00', '14:00', '14:30', '15:30', '16:30']

async function main() {
  console.log('🌱 Seeding demo data...')
  const hashedPw = await bcrypt.hash('Demo1234!', 10)
  const now = new Date().toISOString()

  // ── Technicians ──────────────────────────────────────────────────────────
  const techIds: string[] = []
  for (const t of TECHS) {
    // check if exists
    const existing = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "User" WHERE email = ${t.email} LIMIT 1
    `
    if (existing.length > 0) {
      techIds.push(existing[0].id)
      continue
    }
    const id = randomUUID()
    await prisma.$executeRaw`
      INSERT INTO "User" (id, email, password, name, role, blocked, "createdAt", "updatedAt")
      VALUES (${id}, ${t.email}, ${hashedPw}, ${t.name}, 'TECHNICIAN', false, ${now}::timestamptz, ${now}::timestamptz)
    `
    techIds.push(id)
  }
  console.log(`✓ ${techIds.length} technicians`)

  // ── Clients ───────────────────────────────────────────────────────────────
  const clientIds: string[] = []
  for (const c of CLIENTS) {
    const id = randomUUID()
    await prisma.$executeRaw`
      INSERT INTO "Client" (id, name, city, address, "createdAt", "updatedAt")
      VALUES (${id}, ${c.name}, ${c.city}, ${c.address}, ${now}::timestamptz, ${now}::timestamptz)
    `
    clientIds.push(id)
  }
  console.log(`✓ ${clientIds.length} clients`)

  // ── Interventions ─────────────────────────────────────────────────────────
  const monday = getMondayOfWeek(new Date())
  const today  = new Date(); today.setHours(0, 0, 0, 0)

  const weekDays = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  const PER_DAY = [2, 3, 2, 3, 2] // Mon–Fri variation
  let refNum = 1, total = 0

  for (const day of weekDays) {
    const isPast   = day < today
    const isToday  = day.toDateString() === today.toDateString()
    const perDay   = PER_DAY[weekDays.indexOf(day)]

    for (const techId of techIds) {
      for (let i = 0; i < perDay; i++) {
        const clientId = pick(clientIds)
        const breakdown = pick(BREAKDOWNS)
        const ref = `FM25/${pad(refNum++)}`

        let status: string
        if (isPast) {
          status = Math.random() < 0.85 ? 'COMPLETED' : 'IN_PROGRESS'
        } else if (isToday) {
          const r = Math.random()
          status = r < 0.35 ? 'IN_PROGRESS' : r < 0.65 ? 'ASSIGNED' : r < 0.82 ? 'COMPLETED' : 'QUALITY_ASSESSMENT'
        } else {
          status = Math.random() < 0.8 ? 'ASSIGNED' : 'OPEN'
        }

        const assignedToId = status === 'OPEN' ? null : techId

        const [h, m] = pick(TIMES).split(':').map(Number)
        const scheduledDate = new Date(day)
        scheduledDate.setHours(h, m, 0, 0)
        const sd = scheduledDate.toISOString()

        const id = randomUUID()

        if (assignedToId) {
          await prisma.$executeRaw`
            INSERT INTO "Intervention" (id, reference, "clientId", "assignedToId", "createdById", status, "scheduledDate", breakdown, bill, contract, warranty, "createdAt", "updatedAt")
            VALUES (${id}, ${ref}, ${clientId}, ${assignedToId}, ${assignedToId}, ${status}::"InterventionStatus", ${sd}::timestamptz, ${breakdown}, false, false, false, ${now}::timestamptz, ${now}::timestamptz)
          `
        } else {
          await prisma.$executeRaw`
            INSERT INTO "Intervention" (id, reference, "clientId", status, "scheduledDate", breakdown, bill, contract, warranty, "createdAt", "updatedAt")
            VALUES (${id}, ${ref}, ${clientId}, ${status}::"InterventionStatus", ${sd}::timestamptz, ${breakdown}, false, false, false, ${now}::timestamptz, ${now}::timestamptz)
          `
        }
        total++
      }
    }
  }

  // Unscheduled OPEN (needs planning)
  for (let i = 0; i < 6; i++) {
    const id = randomUUID()
    const ref = `FM25/${pad(refNum++)}`
    const clientId = pick(clientIds)
    await prisma.$executeRaw`
      INSERT INTO "Intervention" (id, reference, "clientId", status, breakdown, bill, contract, warranty, "createdAt", "updatedAt")
      VALUES (${id}, ${ref}, ${clientId}, 'OPEN'::"InterventionStatus", ${pick(BREAKDOWNS)}, false, false, false, ${now}::timestamptz, ${now}::timestamptz)
    `
  }

  console.log(`✓ ${total} scheduled + 6 unscheduled interventions`)
  console.log('🎉 Done! Technician login password: Demo1234!')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
