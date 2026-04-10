'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useLocale } from 'next-intl'

interface InventoryEntry {
  id: string
  itemId: string
  itemName: string
  partNumber: string
  ean13: string | null
  value: number
  tracksSerialNumbers: boolean
  expectedQty: number
  countedQty: number | null
  correctionApproved: boolean | null
  notes: string | null
  foundSerialNumbers: string[]
  expectedSerialNumbers: Array<{ id: string; serialNumber: string }>
}

interface Session {
  id: string
  type: 'WAREHOUSE' | 'TECHNICIAN'
  technicianName: string | null
  status: 'OPEN' | 'PENDING_APPROVAL' | 'CLOSED' | 'CANCELLED'
  createdByName: string
  createdAt: string
  closedAt: string | null
  entries: InventoryEntry[]
}

type FilterTab = 'all' | 'uncounted' | 'discrepancy' | 'ok'

export default function InventorySessionPage() {
  const router = useRouter()
  const params = useParams()
  const locale = useLocale()
  const sessionId = params.id as string

  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null) // itemId being saved
  const [filter, setFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')

  // Barcode scanner
  const [scanning, setScanning] = useState(false)
  const [scanMsg, setScanMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // SN picker modal (for serialized items during counting)
  const [snModal, setSnModal] = useState<InventoryEntry | null>(null)
  const [snSelected, setSnSelected] = useState<string[]>([])

  // Approval state
  const [approvals, setApprovals] = useState<Record<string, boolean>>({})
  const [applying, setApplying] = useState(false)

  // Finalize confirmation
  const [finalizing, setFinalizing] = useState(false)

  useEffect(() => { fetchSession() }, [sessionId])

  useEffect(() => { return () => stopScanner() }, [])

  const fetchSession = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/inventory/${sessionId}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) { router.push(`/${locale}/warehouse`); return }
      const data = await res.json()
      setSession(data)
      // Pre-fill approvals for pending items with discrepancies
      if (data.status === 'PENDING_APPROVAL') {
        const init: Record<string, boolean> = {}
        for (const e of data.entries) {
          if (e.countedQty !== null && e.countedQty !== e.expectedQty) {
            init[e.itemId] = e.correctionApproved ?? true
          }
        }
        setApprovals(init)
      }
    } finally {
      setLoading(false)
    }
  }

  const updateCount = async (itemId: string, countedQty: number, serialNumberIds?: string[]) => {
    setSaving(itemId)
    try {
      const token = localStorage.getItem('token')
      await fetch(`/api/inventory/${sessionId}/count`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemId, countedQty, serialNumberIds }),
      })
      setSession(prev => prev ? {
        ...prev,
        entries: prev.entries.map(e =>
          e.itemId === itemId
            ? { ...e, countedQty, foundSerialNumbers: serialNumberIds ? serialNumberIds.map(id => e.expectedSerialNumbers.find(s => s.id === id)?.serialNumber || id) : e.foundSerialNumbers }
            : e
        ),
      } : prev)
    } finally {
      setSaving(null)
    }
  }

  const handleFinalize = async () => {
    if (!confirm('Finalizar contagem e enviar para aprovação de correções?')) return
    setFinalizing(true)
    try {
      const token = localStorage.getItem('token')
      await fetch(`/api/inventory/${sessionId}/finalize`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      fetchSession()
    } finally {
      setFinalizing(false)
    }
  }

  const handleApply = async () => {
    if (!confirm('Aplicar as correções selecionadas e fechar a sessão?')) return
    setApplying(true)
    try {
      const token = localStorage.getItem('token')
      const payload = Object.entries(approvals).map(([itemId, approved]) => ({ itemId, approved }))
      await fetch(`/api/inventory/${sessionId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ approvals: payload }),
      })
      fetchSession()
    } finally {
      setApplying(false)
    }
  }

  // --- Barcode scanner ---
  const stopScanner = () => {
    if (readerRef.current) { try { readerRef.current.reset() } catch {} readerRef.current = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
  }

  const handleScannedCode = useCallback((code: string) => {
    if (!session) return
    const found = session.entries.find(e => e.ean13 === code)
    if (!found) {
      setScanMsg({ text: `Artigo não encontrado: ${code}`, ok: false })
      return
    }
    stopScanner()
    setScanning(false)
    if (found.tracksSerialNumbers) {
      setSnSelected(found.foundSerialNumbers.map(sn => found.expectedSerialNumbers.find(s => s.serialNumber === sn)?.id || '').filter(Boolean))
      setSnModal(found)
    } else {
      const counted = found.countedQty !== null ? found.countedQty + 1 : 1
      updateCount(found.itemId, counted)
      setScanMsg({ text: `✓ ${found.itemName} → ${counted} un.`, ok: true })
      setTimeout(() => setScanMsg(null), 3000)
    }
  }, [session])

  const startScanner = async () => {
    setScanMsg(null)
    setScanning(true)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    } catch {
      try { stream = await navigator.mediaDevices.getUserMedia({ video: true }) }
      catch { setScanMsg({ text: 'Câmara não disponível', ok: false }); setScanning(false); return }
    }
    streamRef.current = stream
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const reader = new BrowserMultiFormatReader()
      readerRef.current = reader
      await new Promise(r => setTimeout(r, 100))
      if (!videoRef.current) { stopScanner(); setScanning(false); return }
      await reader.decodeFromStream(stream, videoRef.current, (result) => {
        if (result) handleScannedCode(result.getText())
      })
    } catch {
      stopScanner()
      setScanMsg({ text: 'Erro ao iniciar scanner', ok: false })
      setScanning(false)
    }
  }

  if (loading) return <div className="card p-8 text-center text-gray-500">A carregar...</div>
  if (!session) return null

  const discrepancies = session.entries.filter(e => e.countedQty !== null && e.countedQty !== e.expectedQty)
  const uncounted = session.entries.filter(e => e.countedQty === null)
  const countedOk = session.entries.filter(e => e.countedQty !== null && e.countedQty === e.expectedQty)

  const filteredEntries = session.entries.filter(e => {
    const matchSearch = search === '' ||
      e.itemName.toLowerCase().includes(search.toLowerCase()) ||
      e.partNumber.toLowerCase().includes(search.toLowerCase())
    if (!matchSearch) return false
    if (filter === 'uncounted') return e.countedQty === null
    if (filter === 'discrepancy') return e.countedQty !== null && e.countedQty !== e.expectedQty
    if (filter === 'ok') return e.countedQty !== null && e.countedQty === e.expectedQty
    return true
  })

  const totalValue = discrepancies.reduce((s, e) => s + Math.abs((e.countedQty! - e.expectedQty) * e.value), 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-4">
        <div>
          <button onClick={() => router.push(`/${locale}/warehouse`)} className="text-blue-600 hover:text-blue-800 text-sm mb-2 block">
            ← Inventário
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {session.type === 'WAREHOUSE' ? 'Armazém Principal' : `Técnico: ${session.technicianName}`}
          </h1>
          <p className="text-sm text-gray-500">
            {new Date(session.createdAt).toLocaleString('pt-PT')} · {session.createdByName}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <StatusBadge status={session.status} />
          {session.status === 'OPEN' && (
            <button
              onClick={handleFinalize}
              disabled={finalizing || uncounted.length > 0}
              className="btn btn-primary text-sm"
              title={uncounted.length > 0 ? `${uncounted.length} artigos ainda não contados` : ''}
            >
              {finalizing ? 'A finalizar...' : 'Finalizar Contagem'}
            </button>
          )}
          {session.status === 'OPEN' && uncounted.length > 0 && (
            <p className="text-xs text-gray-500">{uncounted.length} artigos por contar</p>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <SummaryCard label="Total artigos" value={session.entries.length} color="gray" />
        <SummaryCard label="Contados" value={`${session.entries.length - uncounted.length}/${session.entries.length}`} color="blue" />
        <SummaryCard label="Divergências" value={discrepancies.length} color={discrepancies.length > 0 ? 'red' : 'green'} />
      </div>

      {/* PENDING APPROVAL VIEW */}
      {session.status === 'PENDING_APPROVAL' && (
        <div className="card mb-5">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Aprovação de Correções</h2>
          <p className="text-sm text-gray-500 mb-4">
            Seleciona as correções a aplicar. As restantes serão ignoradas.
          </p>
          {discrepancies.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <p>Sem divergências. Podes fechar a sessão sem aplicar correções.</p>
              <button onClick={handleApply} disabled={applying} className="btn btn-primary mt-3">
                {applying ? 'A fechar...' : 'Fechar Sessão'}
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-3">
                <button type="button" onClick={() => setApprovals(Object.fromEntries(discrepancies.map(e => [e.itemId, true])))} className="text-xs text-blue-600 hover:underline">
                  Aprovar todas
                </button>
                <span className="text-gray-300">|</span>
                <button type="button" onClick={() => setApprovals(Object.fromEntries(discrepancies.map(e => [e.itemId, false])))} className="text-xs text-gray-500 hover:underline">
                  Rejeitar todas
                </button>
              </div>
              <div className="space-y-2 mb-4">
                {discrepancies.map(e => {
                  const diff = e.countedQty! - e.expectedQty
                  const valueImpact = diff * e.value
                  const approved = approvals[e.itemId] ?? true
                  return (
                    <label key={e.itemId} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${approved ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                      <input
                        type="checkbox"
                        checked={approved}
                        onChange={ev => setApprovals(prev => ({ ...prev, [e.itemId]: ev.target.checked }))}
                        className="w-4 h-4 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{e.itemName}</p>
                        <p className="text-xs text-gray-500">{e.partNumber}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium">
                          {e.expectedQty} → {e.countedQty}
                          <span className={`ml-1 font-bold ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ({diff > 0 ? '+' : ''}{diff})
                          </span>
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
              <div className="flex gap-3">
                <button onClick={handleApply} disabled={applying} className="btn btn-primary">
                  {applying ? 'A aplicar...' : `Aplicar ${Object.values(approvals).filter(Boolean).length} correções`}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* CLOSED summary */}
      {session.status === 'CLOSED' && discrepancies.length > 0 && (
        <div className="card mb-5 bg-green-50 border border-green-200">
          <h2 className="text-sm font-semibold text-green-800 mb-2">Sessão fechada em {session.closedAt ? new Date(session.closedAt).toLocaleString('pt-PT') : ''}</h2>
          <div className="space-y-1">
            {discrepancies.map(e => (
              <div key={e.itemId} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 truncate">{e.itemName}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${e.correctionApproved === true ? 'bg-green-100 text-green-700' : e.correctionApproved === false ? 'bg-gray-100 text-gray-500' : 'bg-yellow-100 text-yellow-700'}`}>
                  {e.correctionApproved === true ? 'Corrigido' : e.correctionApproved === false ? 'Ignorado' : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Counting table — show for OPEN and as history for PENDING/CLOSED */}
      {session.status !== 'CANCELLED' && (
        <>
          {/* Filter + search + scan */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input
              type="text"
              placeholder="Pesquisar artigo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input text-gray-800 sm:w-64"
            />
            <div className="flex gap-1 flex-wrap">
              {([
                ['all', `Todos (${session.entries.length})`],
                ['uncounted', `Por contar (${uncounted.length})`],
                ['discrepancy', `Divergências (${discrepancies.length})`],
                ['ok', `OK (${countedOk.length})`],
              ] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setFilter(val)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === val ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {session.status === 'OPEN' && (
              <button
                onClick={() => scanning ? (stopScanner(), setScanning(false)) : startScanner()}
                className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${scanning ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5h2.25V2.25m0 2.25v2.25M3.75 19.5h2.25v2.25m0-2.25v-2.25M19.5 4.5h-2.25V2.25m0 2.25v2.25M19.5 19.5h-2.25v2.25m0-2.25v-2.25M7.5 9h9M7.5 12h9M7.5 15h9" />
                </svg>
                {scanning ? 'Parar Scan' : 'Scan EAN-13'}
              </button>
            )}
          </div>

          {/* Camera */}
          {scanning && (
            <div className="relative bg-black rounded-lg overflow-hidden mb-4" style={{ height: 200 }}>
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-2 border-white rounded opacity-70 w-2/3 h-14" />
              </div>
              <p className="absolute bottom-2 left-0 right-0 text-center text-white text-xs opacity-80">Aponte para o EAN-13</p>
            </div>
          )}

          {scanMsg && (
            <div className={`mb-3 px-4 py-2 rounded text-sm font-medium ${scanMsg.ok ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'}`}>
              {scanMsg.text}
            </div>
          )}

          {/* Items list */}
          <div className="space-y-2">
            {filteredEntries.length === 0 && (
              <div className="card p-8 text-center text-gray-500">Nenhum artigo neste filtro.</div>
            )}
            {filteredEntries.map(entry => (
              <EntryRow
                key={entry.itemId}
                entry={entry}
                isOpen={session.status === 'OPEN'}
                saving={saving === entry.itemId}
                onCount={(qty) => updateCount(entry.itemId, qty)}
                onOpenSnModal={() => {
                  setSnSelected(entry.foundSerialNumbers.map(sn => entry.expectedSerialNumbers.find(s => s.serialNumber === sn)?.id || '').filter(Boolean))
                  setSnModal(entry)
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* SN modal */}
      {snModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-sm max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b">
              <h3 className="font-bold text-gray-900">{snModal.itemName}</h3>
              <p className="text-xs text-gray-500">{snModal.partNumber} · Esperados: {snModal.expectedQty}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-sm text-gray-600 mb-3">Marca os números de série presentes fisicamente:</p>
              <div className="space-y-1">
                {snModal.expectedSerialNumbers.map(sn => (
                  <label key={sn.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer ${snSelected.includes(sn.id) ? 'bg-green-50 border border-green-200' : 'hover:bg-gray-50 border border-transparent'}`}>
                    <input
                      type="checkbox"
                      checked={snSelected.includes(sn.id)}
                      onChange={() => setSnSelected(prev => prev.includes(sn.id) ? prev.filter(x => x !== sn.id) : [...prev, sn.id])}
                      className="w-4 h-4"
                    />
                    <span className="font-mono text-sm text-gray-800">{sn.serialNumber}</span>
                  </label>
                ))}
                {snModal.expectedSerialNumbers.length === 0 && (
                  <p className="text-sm text-gray-400">Sem números de série registados.</p>
                )}
              </div>
            </div>
            <div className="p-4 border-t flex gap-2">
              <div className="flex-1 text-sm text-gray-600 self-center">{snSelected.length} / {snModal.expectedQty} encontrados</div>
              <button onClick={() => setSnModal(null)} className="btn btn-secondary text-sm">Cancelar</button>
              <button
                onClick={() => {
                  updateCount(snModal.itemId, snSelected.length, snSelected)
                  setSnModal(null)
                }}
                className="btn btn-primary text-sm"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EntryRow({ entry, isOpen, saving, onCount, onOpenSnModal }: {
  entry: InventoryEntry
  isOpen: boolean
  saving: boolean
  onCount: (qty: number) => void
  onOpenSnModal: () => void
}) {
  const [localQty, setLocalQty] = useState(entry.countedQty?.toString() ?? '')

  useEffect(() => {
    setLocalQty(entry.countedQty?.toString() ?? '')
  }, [entry.countedQty])

  const diff = entry.countedQty !== null ? entry.countedQty - entry.expectedQty : null

  let rowBg = ''
  if (entry.countedQty === null) rowBg = 'border-gray-200'
  else if (diff === 0) rowBg = 'border-green-200 bg-green-50'
  else rowBg = 'border-red-200 bg-red-50'

  return (
    <div className={`p-3 border rounded-lg ${rowBg}`}>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 text-sm truncate">{entry.itemName}</p>
          <p className="text-xs text-gray-500">{entry.partNumber}</p>
        </div>

        {/* Status indicator */}
        <div className="text-right text-xs text-gray-500 shrink-0">
          <div>Esperado: <span className="font-semibold text-gray-700">{entry.expectedQty}</span></div>
          {diff !== null && diff !== 0 && (
            <div className={`font-bold ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {diff > 0 ? '+' : ''}{diff}
            </div>
          )}
          {diff === 0 && <div className="text-green-600 font-medium">✓ OK</div>}
        </div>

        {/* Input */}
        {isOpen && (
          entry.tracksSerialNumbers ? (
            <button
              onClick={onOpenSnModal}
              className="shrink-0 px-3 py-1.5 rounded border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
            >
              {entry.countedQty !== null ? `${entry.countedQty} SN` : 'Contar SNs'}
            </button>
          ) : (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => { const v = Math.max(0, (parseInt(localQty) || 0) - 1); setLocalQty(String(v)); onCount(v) }}
                className="w-7 h-7 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm font-bold"
              >−</button>
              <input
                type="number"
                min="0"
                value={localQty}
                onChange={e => setLocalQty(e.target.value)}
                onBlur={() => { const v = parseInt(localQty); if (!isNaN(v) && v >= 0) onCount(v) }}
                className="w-14 text-center border border-gray-300 rounded px-1 py-1 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="—"
              />
              <button
                onClick={() => { const v = (parseInt(localQty) || 0) + 1; setLocalQty(String(v)); onCount(v) }}
                className="w-7 h-7 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm font-bold"
              >+</button>
            </div>
          )
        )}

        {/* Read-only counted qty */}
        {!isOpen && (
          <div className="shrink-0 text-sm font-medium text-gray-700">
            {entry.countedQty !== null ? `${entry.countedQty} contados` : <span className="text-gray-400">Não contado</span>}
          </div>
        )}

        {saving && <div className="shrink-0 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
      </div>

      {/* Found SNs summary */}
      {entry.tracksSerialNumbers && entry.foundSerialNumbers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {entry.foundSerialNumbers.map(sn => (
            <span key={sn} className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs font-mono text-gray-600">{sn}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  }
  return (
    <div className={`rounded-lg border p-3 ${colors[color] || colors.gray}`}>
      <div className="text-xs font-medium opacity-70">{label}</div>
      <div className="text-xl font-bold mt-0.5">{value}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    OPEN: { label: 'Em contagem', cls: 'bg-blue-100 text-blue-800' },
    PENDING_APPROVAL: { label: 'Aguarda aprovação', cls: 'bg-yellow-100 text-yellow-800' },
    CLOSED: { label: 'Fechada', cls: 'bg-green-100 text-green-800' },
    CANCELLED: { label: 'Cancelada', cls: 'bg-gray-100 text-gray-600' },
  }
  const s = map[status] || map.OPEN
  return <span className={`px-3 py-1 rounded-full text-sm font-medium ${s.cls}`}>{s.label}</span>
}
