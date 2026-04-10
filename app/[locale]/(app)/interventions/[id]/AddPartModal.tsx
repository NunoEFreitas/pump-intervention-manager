'use client'

import { useState, useEffect, useRef } from 'react'

interface TechStockItem {
  itemId: string
  itemName: string
  partNumber: string
  value: number
  quantity: number
  tracksSerialNumbers: boolean
  ean13?: string | null
  serialNumbers?: Array<{ id: string; serialNumber: string }>
}

interface WarehouseItem {
  id: string
  itemName: string
  partNumber: string
  tracksSerialNumbers: boolean
  ean13?: string | null
  mainWarehouse: number
}

type UnifiedItem =
  | { source: 'tech'; item: TechStockItem }
  | { source: 'warehouse'; item: WarehouseItem }

interface AddPartModalProps {
  interventionId: string
  workOrderId: string
  technicianId: string | null
  warehouseItems: WarehouseItem[]
  onPartAdded: () => void
  onClose: () => void
}

export default function AddPartModal({
  interventionId,
  workOrderId,
  technicianId,
  warehouseItems,
  onPartAdded,
  onClose,
}: AddPartModalProps) {
  const [techStock, setTechStock] = useState<TechStockItem[]>([])
  const [loadingStock, setLoadingStock] = useState(!!technicianId)
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const [selected, setSelected] = useState<UnifiedItem | null>(null)
  const [qty, setQty] = useState(1)

  const [snLoading, setSnLoading] = useState(false)
  const [sns, setSns] = useState<Array<{ id: string; serialNumber: string }>>([])
  const [snSelected, setSnSelected] = useState<string[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (technicianId) fetchTechStock()
    setTimeout(() => searchRef.current?.focus(), 50)
  }, [])

  useEffect(() => {
    return () => stopScanner()
  }, [])

  const fetchTechStock = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/warehouse/technicians/${technicianId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setTechStock(data.stocks || [])
    } catch {}
    finally { setLoadingStock(false) }
  }

  const stopScanner = () => {
    if (readerRef.current) { try { readerRef.current.reset() } catch {} readerRef.current = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
  }

  const startScanner = async () => {
    setScanError(null)
    setScanning(true)
    let stream: MediaStream
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }) }
    catch { try { stream = await navigator.mediaDevices.getUserMedia({ video: true }) } catch { setScanError('Câmara não disponível'); setScanning(false); return } }
    streamRef.current = stream
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const reader = new BrowserMultiFormatReader()
      readerRef.current = reader
      await new Promise(r => setTimeout(r, 100))
      if (!videoRef.current) { stopScanner(); setScanning(false); return }
      await reader.decodeFromStream(stream, videoRef.current, (result) => { if (result) handleScan(result.getText()) })
    } catch { stopScanner(); setScanError('Erro ao iniciar scanner'); setScanning(false) }
  }

  const handleScan = (code: string) => {
    const tech = techStock.find(s => s.ean13 === code)
    if (tech) { stopScanner(); setScanning(false); selectItem({ source: 'tech', item: tech }); return }
    const wh = warehouseItems.find(i => i.ean13 === code)
    if (wh) { stopScanner(); setScanning(false); selectItem({ source: 'warehouse', item: wh }); return }
    setScanError(`Artigo não encontrado: ${code}`)
  }

  const selectItem = async (unified: UnifiedItem) => {
    setSelected(unified)
    setQty(1)
    setSnSelected([])
    setSns([])
    setSearch('')

    if (unified.source === 'warehouse' && unified.item.tracksSerialNumbers) {
      setSnLoading(true)
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(
          `/api/warehouse/items/${unified.item.id}/serial-numbers?location=MAIN_WAREHOUSE&status=AVAILABLE`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const data = await res.json()
        setSns(Array.isArray(data) ? data.map((s: any) => ({ id: s.id, serialNumber: s.serialNumber })) : [])
      } catch {}
      finally { setSnLoading(false) }
    } else if (unified.source === 'tech' && unified.item.tracksSerialNumbers) {
      setSns(unified.item.serialNumbers || [])
    }
  }

  const toggleSn = (id: string) => {
    setSnSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length < qty) return [...prev, id]
      return prev
    })
  }

  const needsSns = selected && (
    (selected.source === 'tech' && selected.item.tracksSerialNumbers) ||
    (selected.source === 'warehouse' && selected.item.tracksSerialNumbers)
  )

  const maxQty = selected
    ? selected.source === 'tech'
      ? selected.item.tracksSerialNumbers
        ? selected.item.serialNumbers?.length || 0
        : selected.item.quantity
      : undefined
    : 1

  const canConfirm = selected
    ? needsSns
      ? snSelected.length === qty && qty >= 1
      : qty >= 1
    : false

  const confirm = async () => {
    if (!selected || !canConfirm) return
    setSubmitting(true)
    setFeedback(null)
    try {
      const token = localStorage.getItem('token')
      const itemName = selected.item.itemName
      let res: Response
      if (selected.source === 'tech') {
        res = await fetch(`/api/interventions/${interventionId}/work-orders/${workOrderId}/parts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            itemId: selected.item.itemId,
            quantity: qty,
            serialNumberIds: selected.item.tracksSerialNumbers ? snSelected : undefined,
          }),
        })
      } else {
        res = await fetch(`/api/interventions/${interventionId}/work-orders/${workOrderId}/warehouse-parts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            itemId: selected.item.id,
            quantity: qty,
            serialNumberIds: selected.item.tracksSerialNumbers ? snSelected : undefined,
          }),
        })
      }
      if (res.ok) {
        setFeedback({ ok: true, msg: `✓ ${itemName}` })
        onPartAdded()
        setSelected(null)
        setQty(1)
        setSnSelected([])
        setSns([])
        setTimeout(() => { setFeedback(null); searchRef.current?.focus() }, 2000)
      } else {
        const d = await res.json()
        setFeedback({ ok: false, msg: d.error || 'Erro ao adicionar peça' })
      }
    } catch {
      setFeedback({ ok: false, msg: 'Erro de rede' })
    } finally {
      setSubmitting(false)
    }
  }

  const q = search.toLowerCase().trim()

  const techResults: UnifiedItem[] = techStock
    .filter(s => {
      const available = s.tracksSerialNumbers ? (s.serialNumbers?.length || 0) : s.quantity
      return available > 0 && (!q || s.itemName.toLowerCase().includes(q) || s.partNumber.toLowerCase().includes(q))
    })
    .map(s => ({ source: 'tech' as const, item: s }))

  const whResults: UnifiedItem[] = warehouseItems
    .filter(i => i.mainWarehouse > 0 && (!q || i.itemName.toLowerCase().includes(q) || i.partNumber.toLowerCase().includes(q)))
    .map(i => ({ source: 'warehouse' as const, item: i }))

  const results: UnifiedItem[] = [...techResults, ...whResults]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-lg max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
          <h2 className="text-lg font-bold text-gray-900 flex-1">Adicionar Peça</h2>
          <button
            type="button"
            onClick={() => { if (scanning) { stopScanner(); setScanning(false) } else startScanner() }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${scanning ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            title="Scan EAN-13"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5h2.25m0 0V2.25m0 2.25v2.25M3.75 19.5h2.25m0 0v2.25m0-2.25v-2.25M19.5 4.5h-2.25m0 0V2.25m0 2.25v2.25M19.5 19.5h-2.25m0 0v2.25m0-2.25v-2.25M7.5 9h9M7.5 12h9M7.5 15h9" />
            </svg>
            {scanning ? 'Parar' : 'Scan'}
          </button>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Scanner */}
        {scanning && (
          <div className="relative bg-black shrink-0" style={{ height: 180 }}>
            <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-2 border-white rounded opacity-70 w-2/3 h-12" />
            </div>
            <p className="absolute bottom-1 left-0 right-0 text-center text-white text-xs opacity-80">EAN-13</p>
            {scanError && (
              <div className="absolute top-2 left-2 right-2 bg-red-600 text-white text-xs rounded px-2 py-1 text-center">{scanError}</div>
            )}
          </div>
        )}

        {/* Feedback banner */}
        {feedback && (
          <div className={`px-4 py-2 text-sm font-medium text-center shrink-0 ${feedback.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {feedback.msg}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {selected ? (
            /* ── Qty / SN step ── */
            <div className="p-4 space-y-4">
              <button
                type="button"
                onClick={() => { setSelected(null); setTimeout(() => searchRef.current?.focus(), 50) }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                ← Voltar
              </button>

              <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center gap-3">
                <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${selected.source === 'tech' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                  {selected.source === 'tech' ? 'Técnico' : 'Armazém'}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{selected.item.itemName}</p>
                  <p className="text-xs text-gray-500">{selected.item.partNumber}</p>
                </div>
              </div>

              {!needsSns ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                  <input
                    type="number"
                    min="1"
                    max={maxQty}
                    value={qty}
                    onChange={e => setQty(parseInt(e.target.value) || 1)}
                    className="input text-gray-800 w-32"
                    autoFocus
                  />
                  {selected.source === 'tech' && (
                    <p className="text-xs text-gray-400 mt-1">
                      Disponível: {selected.item.tracksSerialNumbers ? selected.item.serialNumbers?.length || 0 : selected.item.quantity}
                    </p>
                  )}
                </div>
              ) : snLoading ? (
                <p className="text-sm text-gray-500">A carregar números de série...</p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                    <input
                      type="number"
                      min="1"
                      max={sns.length}
                      value={qty}
                      onChange={e => { setQty(parseInt(e.target.value) || 1); setSnSelected([]) }}
                      className="input text-gray-800 w-32"
                      autoFocus
                    />
                    <p className="text-xs text-gray-400 mt-1">{sns.length} disponíveis</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Números de série ({snSelected.length}/{qty})
                    </label>
                    <div className="border rounded-lg p-2 max-h-44 overflow-y-auto space-y-1">
                      {sns.length === 0 ? (
                        <p className="text-xs text-gray-400 p-1">Sem números de série disponíveis</p>
                      ) : sns.map(sn => (
                        <label
                          key={sn.id}
                          className={`flex items-center gap-2 p-1.5 rounded cursor-pointer ${snSelected.includes(sn.id) ? 'bg-blue-100' : 'hover:bg-gray-50'}`}
                        >
                          <input
                            type="checkbox"
                            checked={snSelected.includes(sn.id)}
                            onChange={() => toggleSn(sn.id)}
                            disabled={!snSelected.includes(sn.id) && snSelected.length >= qty}
                            className="w-3.5 h-3.5"
                          />
                          <span className="font-mono text-xs">{sn.serialNumber}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={confirm}
                disabled={!canConfirm || submitting}
                className="btn btn-primary w-full disabled:opacity-50"
              >
                {submitting ? 'A adicionar...' : 'Adicionar'}
              </button>
            </div>
          ) : (
            /* ── Search step ── */
            <div className="p-4 space-y-3">
              <input
                ref={searchRef}
                type="text"
                placeholder="Pesquisar artigo..."
                className="input text-gray-800"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />

              {loadingStock ? (
                <p className="text-sm text-gray-500 text-center py-4">A carregar stock...</p>
              ) : results.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  {q ? 'Nenhum artigo encontrado.' : 'Escreva para pesquisar.'}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {results.map((r, i) => {
                    const available = r.source === 'tech'
                      ? r.item.tracksSerialNumbers ? r.item.serialNumbers?.length || 0 : r.item.quantity
                      : null
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => selectItem(r)}
                        className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                      >
                        <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${r.source === 'tech' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                          {r.source === 'tech' ? 'Técnico' : 'Armazém'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{r.item.itemName}</p>
                          {r.item.partNumber && <p className="text-xs text-gray-400">{r.item.partNumber}</p>}
                        </div>
                        {available !== null && (
                          <span className="shrink-0 text-xs font-semibold text-gray-500">{available} un.</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
