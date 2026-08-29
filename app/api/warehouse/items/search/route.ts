import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

/**
 * GET /api/warehouse/items/search?q=<texto>
 *
 * Pesquisa de artigos para os seletores de peças. Sem limite de resultados —
 * devolve todos os artigos que existem na base de dados e correspondem à pesquisa
 * (nome, part number ou EAN-13). Sem `q`, devolve o catálogo completo.
 *
 * `available` é a quantidade realmente disponível no armazém central:
 *  - artigos com números de série  → contagem de SN AVAILABLE em MAIN_WAREHOUSE
 *    (mesma condição usada pelo seletor de SN e pela validação ao adicionar a peça,
 *     por isso não depende do contador `mainWarehouse`, que pode estar dessincronizado)
 *  - artigos normais              → `mainWarehouse`
 *  - artigos `noStock`            → null (sem controlo de stock)
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const q = new URL(request.url).searchParams.get('q')?.trim().toLowerCase() || ''
    const like = `%${q}%`

    const rows = await prisma.$queryRaw<Array<{
      id: string
      itemName: string
      partNumber: string
      ean13: string | null
      tracksSerialNumbers: boolean
      noStock: boolean
      mainWarehouse: number
      availableSn: number
    }>>`
      SELECT w.id, w."itemName", w."partNumber", w."ean13",
             w."tracksSerialNumbers", w."noStock", w."mainWarehouse",
             COALESCE(sn.available, 0)::int AS "availableSn"
      FROM "WarehouseItem" w
      LEFT JOIN (
        SELECT "itemId", COUNT(*)::int AS available
        FROM "SerialNumberStock"
        WHERE location = 'MAIN_WAREHOUSE' AND status = 'AVAILABLE'
        GROUP BY "itemId"
      ) sn ON sn."itemId" = w.id
      -- com q vazio, o LIKE '%%' devolve o catálogo completo
      WHERE LOWER(w."itemName") LIKE ${like}
         OR LOWER(w."partNumber") LIKE ${like}
         OR LOWER(COALESCE(w."ean13", '')) LIKE ${like}
      ORDER BY w."itemName" ASC
    `

    return NextResponse.json(rows.map(r => ({
      id: r.id,
      itemName: r.itemName,
      partNumber: r.partNumber,
      ean13: r.ean13,
      tracksSerialNumbers: r.tracksSerialNumbers,
      noStock: r.noStock,
      mainWarehouse: Number(r.mainWarehouse),
      available: r.noStock
        ? null
        : r.tracksSerialNumbers ? Number(r.availableSn) : Number(r.mainWarehouse),
    })))
  } catch (error) {
    console.error('Error searching warehouse items:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
