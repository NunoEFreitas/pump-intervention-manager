import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

// Maps full country names (as stored in the app) to VIES 2-letter codes
const COUNTRY_NAME_TO_VIES: Record<string, string> = {
  'Austria': 'AT', 'Belgium': 'BE', 'Bulgaria': 'BG', 'Cyprus': 'CY',
  'Czech Republic': 'CZ', 'Germany': 'DE', 'Denmark': 'DK', 'Estonia': 'EE',
  'Greece': 'EL', 'Spain': 'ES', 'Finland': 'FI', 'France': 'FR',
  'Croatia': 'HR', 'Hungary': 'HU', 'Ireland': 'IE', 'Italy': 'IT',
  'Lithuania': 'LT', 'Luxembourg': 'LU', 'Latvia': 'LV', 'Malta': 'MT',
  'Netherlands': 'NL', 'Poland': 'PL', 'Portugal': 'PT', 'Romania': 'RO',
  'Sweden': 'SE', 'Slovenia': 'SI', 'Slovakia': 'SK',
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!verifyToken(token || '')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const countryParam = (searchParams.get('country') ?? '').trim()
    const vat = (searchParams.get('vat') ?? '').replace(/\s/g, '').trim()

    if (!countryParam || !vat) {
      return NextResponse.json({ error: 'country and vat are required' }, { status: 400 })
    }

    // Accept both full names ("Portugal") and 2-letter codes ("PT")
    const country = countryParam.length === 2
      ? countryParam.toUpperCase()
      : (COUNTRY_NAME_TO_VIES[countryParam] ?? null)

    if (!country) {
      return NextResponse.json({ error: 'País não suportado pelo VIES' }, { status: 400 })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    let data: any
    try {
      const res = await fetch(
        `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${country}/vat/${vat}`,
        { signal: controller.signal, headers: { Accept: 'application/json' } }
      )
      data = await res.json()
    } catch (e: any) {
      if (e.name === 'AbortError') {
        return NextResponse.json({ error: 'Tempo limite excedido. Tente novamente.' }, { status: 504 })
      }
      return NextResponse.json({ error: 'Serviço VIES indisponível' }, { status: 502 })
    } finally {
      clearTimeout(timeout)
    }

    const isValid = data.isValid === true
    const name    = data.name !== '---' ? (data.name ?? null) : null
    const address = data.address !== '---' ? (data.address ?? null) : null
    const userError = data.userError ?? null

    return NextResponse.json({ isValid, name, address, userError, countryCode: country })
  } catch (error) {
    console.error('VIES lookup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
