'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'

interface StockItem {
  itemId: string
  itemName: string
  partNumber: string
  value: number
  quantity: number
  tracksSerialNumbers: boolean
  ean13?: string | null
  serialNumbers?: Array<{
    id: string
    serialNumber: string
  }>
}

interface CartEntry {
  item: StockItem
  quantity: number
  serialNumberIds: string[]
}

interface PartsSelectorProps {
  technicianId: string
  interventionId: string
  workOrderId: string
  onClose: () => void
  onPartAdded: () => void
}

export default function PartsSelector({ technicianId, onClose, onPartAdded, interventionId, workOrderId }: PartsSelectorProps) {
  const t = useTranslations('interventions')
  const tCommon = useTranslations('common')
  const tWarehouse = useTranslations('warehouse')

  const [loading, setLoading] = useState(true)
  const [stock, setStock] = useState<StockItem[]>([])
  const [cart, setCart] = useState<CartEntry[]>([])
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  // SN picker state
  const [snPickerItemId, setSnPickerItemId] = useState<string | null>(null)
  const [pendingSnQty, setPendingSnQty] = useState(1)
  const [pendingSnSelected, setPendingSnSelected] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  // Barcode scanner state
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanFeedback, setScanFeedback] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<any>(null)

  useEffect(() => {
    fetchTechnicianStock()
  }, [technicianId])

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      stopScanner()
    }
  }, [])

  const fetchTechnicianStock = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/warehouse/technicians/${technicianId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setStock(data.stocks || [])
    } catch (error) {
      console.error('Error fetching stock:', error)
    } finally {
      setLoading(false)
    }
  }

  const stopScanner = () => {
    if (readerRef.current) {
      try { readerRef.current.reset() } catch {}
      readerRef.current = null
    }
  }

  const startScanner = async () => {
    setScanError(null)
    setScanFeedback(null)
    setScanning(true)

    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const reader = new BrowserMultiFormatReader()
      readerRef.current = reader

      // Small delay to ensure video element is mounted
      await new Promise(r => setTimeout(r, 100))

      if (!videoRef.current) {
        setScanError('Camera element not ready')
        setScanning(false)
        return
      }

      await reader.decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current,
        (result, err) => {
          if (result) {
            const code = result.getText()
            handleScannedCode(code)
          }
        }
      )
    } catch (err: any) {
      console.error('Scanner error:', err)
      setScanError('Câmara não disponível ou permissão negada')
      setScanning(false)
    }
  }

  const handleScannedCode = (code: string) => {
    const found = stock.find(item => item.ean13 === code)
    if (!found) {
      setScanFeedback(`Artigo não encontrado: ${code}`)
      return
    }

    // Stop scanner and close overlay
    stopScanner()
    setScanning(false)

    // If serialized, open SN picker; otherwise add to cart
    if (found.tracksSerialNumbers) {
      setSnPickerItemId(found.itemId)
      setPendingSnQty(1)
      setPendingSnSelected([])
    } else {
      const qty = getQty(found.itemId)
      const max = found.quantity
      setCart(prev => {
        const existing = prev.find(e => e.item.itemId === found.itemId)
        if (existing) {
          return prev.map(e =>
            e.item.itemId === found.itemId
              ? { ...e, quantity: Math.min(e.quantity + qty, max) }
              : e
          )
        }
        return [...prev, { item: found, quantity: Math.min(qty, max), serialNumberIds: [] }]
      })
    }
    setScanFeedback(`✓ ${found.itemName}`)
    setTimeout(() => setScanFeedback(null), 3000)
  }

  const getQty = (itemId: string) => quantities[itemId] ?? 1

  const setQty = (itemId: string, val: number) => {
    setQuantities(prev => ({ ...prev, [itemId]: val }))
  }

  const cartIds = new Set(cart.map(e => e.item.itemId))

  const addToCart = (item: StockItem) => {
    const qty = getQty(item.itemId)
    if (item.tracksSerialNumbers) {
      setSnPickerItemId(item.itemId)
      setPendingSnQty(qty)
      setPendingSnSelected([])
    } else {
      const max = item.quantity
      setCart(prev => {
        const existing = prev.find(e => e.item.itemId === item.itemId)
        if (existing) {
          return prev.map(e =>
            e.item.itemId === item.itemId
              ? { ...e, quantity: Math.min(e.quantity + qty, max) }
              : e
          )
        }
        return [...prev, { item, quantity: Math.min(qty, max), serialNumberIds: [] }]
      })
    }
  }

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(e => e.item.itemId !== itemId))
  }

  const updateCartQty = (itemId: string, val: number) => {
    setCart(prev =>
      prev.map(e => e.item.itemId === itemId ? { ...e, quantity: val } : e)
    )
  }

  const toggleSnPending = (snId: string) => {
    setPendingSnSelected(prev => {
      if (prev.includes(snId)) return prev.filter(id => id !== snId)
      if (prev.length < pendingSnQty) return [...prev, snId]
      return prev
    })
  }

  const confirmSnSelection = () => {
    const item = stock.find(s => s.itemId === snPickerItemId)
    if (!item || pendingSnSelected.length !== pendingSnQty) return
    setCart(prev => {
      const existing = prev.find(e => e.item.itemId === item.itemId)
      if (existing) {
        return prev.map(e =>
          e.item.itemId === item.itemId
            ? { ...e, quantity: e.quantity + pendingSnQty, serialNumberIds: [...e.serialNumberIds, ...pendingSnSelected] }
            : e
        )
      }
      return [...prev, { item, quantity: pendingSnQty, serialNumberIds: pendingSnSelected }]
    })
    setSnPickerItemId(null)
  }

  const handleSubmit = async () => {
    if (cart.length === 0) return
    setSubmitting(true)
    setErrors([])
    const newErrors: string[] = []
    const token = localStorage.getItem('token')

    for (const entry of cart) {
      try {
        const response = await fetch(
          `/api/interventions/${interventionId}/work-orders/${workOrderId}/parts`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              itemId: entry.item.itemId,
              quantity: entry.quantity,
              serialNumberIds: entry.item.tracksSerialNumbers ? entry.serialNumberIds : undefined,
            }),
          }
        )
        if (!response.ok) {
          const data = await response.json()
          newErrors.push(`${entry.item.itemName}: ${data.error || t('failedToAddPart')}`)
        }
      } catch {
        newErrors.push(`${entry.item.itemName}: Network error`)
      }
    }

    setSubmitting(false)
    if (newErrors.length === 0) {
      onPartAdded()
      onClose()
    } else {
      setErrors(newErrors)
    }
  }

  const snPickerItem = stock.find(s => s.itemId === snPickerItemId) || null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-lg w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 sm:p-6 border-b flex items-start justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{t('addPartsUsed')}</h2>
            <p className="text-sm text-gray-600 mt-1">{t('selectPartsFromStock')}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (scanning) { stopScanner(); setScanning(false) } else { startScanner() }
            }}
            className={`ml-3 shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              scanning
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title="Scan EAN-13 barcode"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5h2.25m0 0V2.25m0 2.25v2.25M3.75 19.5h2.25m0 0v2.25m0-2.25v-2.25M19.5 4.5h-2.25m0 0V2.25m0 2.25v2.25M19.5 19.5h-2.25m0 0v2.25m0-2.25v-2.25M7.5 9h9M7.5 12h9M7.5 15h9" />
            </svg>
            {scanning ? 'Parar' : 'Scan'}
          </button>
        </div>

        {/* Camera overlay */}
        {scanning && (
          <div className="relative bg-black flex-shrink-0" style={{ height: 220 }}>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              muted
              playsInline
            />
            {/* Aim guide */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-2 border-white rounded opacity-70 w-2/3 h-16" />
            </div>
            <p className="absolute bottom-2 left-0 right-0 text-center text-white text-xs opacity-80">
              Aponte para o código de barras EAN-13
            </p>
            {scanError && (
              <div className="absolute top-2 left-2 right-2 bg-red-600 text-white text-xs rounded px-2 py-1 text-center">
                {scanError}
              </div>
            )}
          </div>
        )}

        {/* Scan feedback */}
        {scanFeedback && (
          <div className={`px-4 py-2 text-sm font-medium text-center ${
            scanFeedback.startsWith('✓') ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'
          }`}>
            {scanFeedback}
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center text-gray-600">{t('loadingStock')}</div>
        ) : stock.length === 0 ? (
          <div className="p-8 text-center text-gray-600">{t('noStockAvailable')}</div>
        ) : (
          <>
            {/* SN picker overlay */}
            {snPickerItem && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSnPickerItemId(null)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    ← {tCommon('back')}
                  </button>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-gray-900">{snPickerItem.itemName}</h4>
                  <p className="text-sm text-gray-600">{tWarehouse('partNumber')}: {snPickerItem.partNumber}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {tWarehouse('quantity')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={snPickerItem.serialNumbers?.length || 0}
                    className="input text-gray-800"
                    value={pendingSnQty}
                    onChange={(e) => {
                      setPendingSnQty(parseInt(e.target.value) || 1)
                      setPendingSnSelected([])
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">{t('howManyUnits')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {tWarehouse('selectSerialNumbers')} ({pendingSnSelected.length}/{pendingSnQty})
                  </label>
                  <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                    {snPickerItem.serialNumbers && snPickerItem.serialNumbers.length > 0 ? (
                      <div className="space-y-2">
                        {snPickerItem.serialNumbers.map((sn) => (
                          <label
                            key={sn.id}
                            className={`flex items-center gap-2 p-2 rounded cursor-pointer ${
                              pendingSnSelected.includes(sn.id) ? 'bg-blue-100' : 'hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={pendingSnSelected.includes(sn.id)}
                              onChange={() => toggleSnPending(sn.id)}
                              disabled={!pendingSnSelected.includes(sn.id) && pendingSnSelected.length >= pendingSnQty}
                              className="w-4 h-4"
                            />
                            <span className="font-mono text-sm">{sn.serialNumber}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">{tWarehouse('noSerialNumbersAvailable')}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={confirmSnSelection}
                  disabled={pendingSnSelected.length !== pendingSnQty}
                  className="btn btn-primary w-full"
                >
                  {t('addToList')}
                </button>
              </div>
            )}

            {/* Main list + cart */}
            {!snPickerItem && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {/* Cart */}
                {cart.length > 0 && (
                  <div className="border border-blue-200 rounded-lg overflow-hidden">
                    <div className="bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 uppercase tracking-wide">
                      {t('selectedParts')} ({cart.length})
                    </div>
                    <div className="divide-y divide-gray-100">
                      {cart.map((entry) => (
                        <div key={entry.item.itemId} className="flex items-center gap-2 px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{entry.item.itemName}</p>
                            <p className="text-xs text-gray-500">{entry.item.partNumber}</p>
                            {entry.item.tracksSerialNumbers && (
                              <p className="text-xs text-blue-600">{t('serialized')}: {entry.serialNumberIds.length} {tWarehouse('units')}</p>
                            )}
                          </div>
                          {!entry.item.tracksSerialNumbers && (
                            <input
                              type="number"
                              min="1"
                              max={entry.item.quantity}
                              value={entry.quantity}
                              onChange={(e) => updateCartQty(entry.item.itemId, parseInt(e.target.value) || 1)}
                              className="w-16 text-center border border-gray-300 rounded px-1 py-1 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => removeFromCart(entry.item.itemId)}
                            className="text-red-500 hover:text-red-700 text-xs px-2 py-1 shrink-0"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Errors */}
                {errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                    {errors.map((err, i) => (
                      <p key={i} className="text-sm text-red-700">{err}</p>
                    ))}
                  </div>
                )}

                {/* Stock list */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-700 text-sm">{t('selectItem')}:</h3>
                  {stock.map((item) => {
                    const inCart = cartIds.has(item.itemId)
                    const availableInCart = item.tracksSerialNumbers
                      ? (item.serialNumbers?.length || 0) - (cart.find(e => e.item.itemId === item.itemId)?.serialNumberIds.length || 0)
                      : item.quantity - (cart.find(e => e.item.itemId === item.itemId)?.quantity || 0)
                    const maxQty = item.tracksSerialNumbers ? item.serialNumbers?.length || 0 : item.quantity
                    return (
                      <div
                        key={item.itemId}
                        className={`p-3 border rounded-lg transition-colors ${inCart ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 text-sm">{item.itemName}</h4>
                            <p className="text-xs text-gray-500">{tWarehouse('partNumber')}: {item.partNumber}</p>
                            <p className="text-xs text-gray-500">
                              {tWarehouse('available')}: {item.tracksSerialNumbers ? `${item.serialNumbers?.length || 0}` : item.quantity} {tWarehouse('units')}
                              {inCart && availableInCart < (item.tracksSerialNumbers ? item.serialNumbers?.length || 0 : item.quantity) && (
                                <span className="text-blue-600"> · {availableInCart} {tWarehouse('units')} left</span>
                              )}
                            </p>
                          </div>
                          <span className="text-sm font-bold text-blue-600 shrink-0">€{item.value.toFixed(2)}</span>
                          {!item.tracksSerialNumbers && (
                            <input
                              type="number"
                              min="1"
                              max={availableInCart > 0 ? availableInCart : maxQty}
                              value={getQty(item.itemId)}
                              onChange={(e) => setQty(item.itemId, parseInt(e.target.value) || 1)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-14 text-center border border-gray-300 rounded px-1 py-1 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => addToCart(item)}
                            disabled={availableInCart <= 0}
                            className={`shrink-0 text-sm px-3 py-1 rounded font-medium transition-colors ${
                              availableInCart <= 0
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                            }`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Footer */}
            {!snPickerItem && (
              <div className="p-4 sm:p-6 border-t flex gap-3">
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="btn btn-primary flex-1"
                  disabled={cart.length === 0 || submitting}
                >
                  {submitting
                    ? tCommon('adding')
                    : cart.length > 0
                      ? `${t('addPart')} (${cart.length})`
                      : t('addPart')}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  {tCommon('cancel')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
