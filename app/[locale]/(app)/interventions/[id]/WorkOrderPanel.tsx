'use client'

import { useState, useRef, useEffect } from 'react'
import AddPartModal from './AddPartModal'

interface WorkOrderSession {
  id: string
  startDate: string | null
  startTime: string | null
  endDate: string | null
  endTime: string | null
  duration: number | null
}

interface WorkOrderPart {
  id: string
  quantity: number
  serialNumberIds: string[]
  createdAt: string
  usedByName: string | null
  item: { id: string; itemName: string; partNumber: string; value: number; tracksSerialNumbers: boolean }
  serialNumbers?: Array<{ id: string; serialNumber: string }>
}

export interface WorkOrder {
  id: string
  reference: string | null
  description: string
  timeSpent: number | null
  km: number | null
  locationEquipmentId: string | null
  interventionType: string | null
  transportGuide: string | null
  fromAddress: string | null
  internal: boolean
  sessions: WorkOrderSession[]
  vehicles: { workOrderId: string; vehicleId: string; plateNumber: string; brand: string | null; model: string | null }[]
  helpers: { workOrderId: string; userId: string; name: string }[]
  createdAt: string
  createdBy: { id: string; name: string }
  parts: WorkOrderPart[]
}

interface CompanyVehicle { id: string; plateNumber: string; brand: string | null; model: string | null; description: string | null }
interface Technician { id: string; name: string; email: string }
interface Equipment { id: string; model: string; serialNumber: string | null; equipmentType: { name: string }; brand: { name: string } }
interface WarehouseItem { id: string; itemName: string; partNumber: string; tracksSerialNumbers: boolean; ean13?: string | null; mainWarehouse: number }
interface SavedPdf { id: string; createdAt: string; clientSignature: string | null; techSignature: string | null }

interface Props {
  wo: WorkOrder | null
  interventionId: string
  assignedTechnicianId: string | null
  canEdit: boolean
  equipment: Equipment[]
  technicians: Technician[]
  vehicles: CompanyVehicle[]
  warehouseItems: WarehouseItem[]
  savedPdfs: SavedPdf[]
  printCompany: { name: string; email: string; address: string; phones: string[]; faxes: string[]; logo: string } | null
  onClose: () => void
  onRefresh: () => void
  onDelete: () => void
  onPrint: (wo: WorkOrder) => void
}

type Tab = 'details' | 'hours' | 'parts' | 'collected'

interface CollectedPart {
  id: string
  serialNumber: string | null
  clientItemSn: string | null
  faultDescription: string | null
  clientPartStatus: string | null
  preSwapped: boolean
  itemName: string
  partNumber: string
  repairReference: string | null
  repairStatus: string | null
  pickedUpByName: string | null
  createdAt: string
}

function calcDuration(sd: string, st: string, ed: string, et: string): string {
  if (!sd || !st || !ed || !et) return ''
  const diff = new Date(`${ed}T${et}`).getTime() - new Date(`${sd}T${st}`).getTime()
  return diff > 0 ? (diff / 3600000).toFixed(2) : ''
}

const INTERVENTION_TYPE_LABELS: Record<string, string> = {
  ELECTRONIC: 'Eletrónica', HYDRAULIC: 'Hidráulica', COMPUTING: 'Informática', OTHERS: 'Outros',
}

export default function WorkOrderPanel({
  wo, interventionId, assignedTechnicianId, canEdit,
  equipment, technicians, vehicles, warehouseItems,
  savedPdfs, printCompany,
  onClose, onRefresh, onDelete, onPrint,
}: Props) {
  const isEdit = wo !== null
  const [tab, setTab] = useState<Tab>('details')

  const [form, setForm] = useState({
    description: wo?.description ?? '',
    timeSpent: wo?.timeSpent != null ? String(wo.timeSpent) : '',
    km: wo?.km != null ? String(wo.km) : '',
    fromAddress: wo?.fromAddress ?? '',
    equipmentId: wo?.locationEquipmentId ?? '',
    interventionType: wo?.interventionType ?? '',
    transportGuide: wo?.transportGuide ?? '',
    internal: wo?.internal ?? false,
    vehicleIds: wo?.vehicles?.map(v => v.vehicleId) ?? [],
    helperIds: wo?.helpers?.map(h => h.userId) ?? [],
  })
  const [saving, setSaving] = useState(false)
  const [vehicleOpen, setVehicleOpen] = useState(false)
  const [helperOpen, setHelperOpen] = useState(false)
  const vehicleRef = useRef<HTMLDivElement>(null)
  const helperRef = useRef<HTMLDivElement>(null)

  const [showSessionForm, setShowSessionForm] = useState(false)
  const [sessionForm, setSessionForm] = useState({ startDate: '', startTime: '', endDate: '', endTime: '', duration: '' })
  const [sessionSaving, setSessionSaving] = useState(false)

  const [showAddPart, setShowAddPart] = useState(false)

  const [collectedParts, setCollectedParts] = useState<CollectedPart[]>([])
  const [collectedLoading, setCollectedLoading] = useState(false)
  const [showCollectForm, setShowCollectForm] = useState(false)
  const [collectForm, setCollectForm] = useState({
    warehouseItemId: '', serialNumber: '', clientItemSn: '', faultDescription: '', preSwapped: false,
  })
  const [collectItemSearch, setCollectItemSearch] = useState('')
  const [collectItemOpen, setCollectItemOpen] = useState(false)
  const [collectSaving, setCollectSaving] = useState(false)
  const collectItemRef = useRef<HTMLDivElement>(null)
  const [technicianStock, setTechnicianStock] = useState<Array<{
    itemId: string; itemName: string; partNumber: string; quantity: number;
    tracksSerialNumbers: boolean; serialNumbers?: Array<{ id: string; serialNumber: string }>
  }>>([])
  const [technicianStockLoading, setTechnicianStockLoading] = useState(false)

  const fetchCollectedParts = async () => {
    if (!wo) return
    setCollectedLoading(true)
    try {
      const token = localStorage.getItem('token')
      const data = await fetch(
        `/api/interventions/${interventionId}/work-orders/${wo.id}/client-parts`,
        { headers: { Authorization: `Bearer ${token}` } }
      ).then(r => r.json())
      setCollectedParts(Array.isArray(data) ? data : [])
    } catch { /* ignore */ } finally { setCollectedLoading(false) }
  }

  useEffect(() => {
    if (tab === 'collected' && wo) fetchCollectedParts()
  }, [tab])

  const handleCollect = async () => {
    if (!wo || !collectForm.warehouseItemId) return
    if (collectForm.preSwapped) {
      const techItem = technicianStock.find(i => i.itemId === collectForm.warehouseItemId)
      if (techItem?.tracksSerialNumbers && (techItem.serialNumbers?.length ?? 0) > 0 && !collectForm.serialNumber) return
    }
    setCollectSaving(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(
        `/api/interventions/${interventionId}/work-orders/${wo.id}/client-parts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            warehouseItemId: collectForm.warehouseItemId,
            serialNumber: collectForm.serialNumber || null,
            clientItemSn: collectForm.clientItemSn || null,
            faultDescription: collectForm.faultDescription || null,
            preSwapped: collectForm.preSwapped,
          }),
        }
      )
      if (res.ok) {
        setShowCollectForm(false)
        setCollectForm({ warehouseItemId: '', serialNumber: '', clientItemSn: '', faultDescription: '', preSwapped: false })
        setCollectItemSearch('')
        fetchCollectedParts()
      }
    } finally { setCollectSaving(false) }
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (vehicleRef.current && !vehicleRef.current.contains(e.target as Node)) setVehicleOpen(false)
      if (helperRef.current && !helperRef.current.contains(e.target as Node)) setHelperOpen(false)
      if (collectItemRef.current && !collectItemRef.current.contains(e.target as Node)) setCollectItemOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => { document.removeEventListener('mousedown', handler) }
  }, [])

  const handleSave = async () => {
    if (!form.description.trim()) return
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      const url = isEdit
        ? `/api/interventions/${interventionId}/work-orders/${wo!.id}`
        : `/api/interventions/${interventionId}/work-orders`
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          description: form.description,
          timeSpent: form.timeSpent ? parseFloat(form.timeSpent) : null,
          km: form.km ? parseFloat(form.km) : null,
          fromAddress: form.fromAddress || null,
          equipmentId: form.equipmentId || null,
          interventionType: form.interventionType || null,
          transportGuide: form.transportGuide || null,
          internal: form.internal,
          vehicleIds: form.vehicleIds,
          helperIds: form.helperIds,
        }),
      })
      if (res.ok) { onRefresh(); if (!isEdit) onClose() }
    } finally { setSaving(false) }
  }

  const handleAddSession = async () => {
    if (!wo || !sessionForm.duration) return
    setSessionSaving(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/interventions/${interventionId}/work-orders/${wo.id}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          startDate: sessionForm.startDate || null,
          startTime: sessionForm.startTime || null,
          endDate: sessionForm.endDate || null,
          endTime: sessionForm.endTime || null,
          duration: parseFloat(sessionForm.duration),
        }),
      })
      if (res.ok) {
        setShowSessionForm(false)
        setSessionForm({ startDate: '', startTime: '', endDate: '', endTime: '', duration: '' })
        onRefresh()
      }
    } finally { setSessionSaving(false) }
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!wo) return
    const token = localStorage.getItem('token')
    await fetch(`/api/interventions/${interventionId}/work-orders/${wo.id}/sessions/${sessionId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    })
    onRefresh()
  }

  const updateSessionForm = (patch: Partial<typeof sessionForm>) => {
    const next = { ...sessionForm, ...patch }
    const dur = calcDuration(next.startDate, next.startTime, next.endDate, next.endTime)
    setSessionForm({ ...next, duration: dur || next.duration })
  }

  const otherTechs = technicians.filter(t => t.id !== assignedTechnicianId)
  const totalSessionHours = (wo?.sessions ?? []).reduce((s, x) => s + (x.duration ?? 0), 0)

  return (
    <>
      <div className="mt-2 border border-blue-200 rounded-xl bg-white overflow-hidden">

        {/* Panel header */}
        <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b">
          <div className="flex items-center gap-3 min-w-0">
            {wo?.reference && <span className="font-mono font-bold text-gray-800 shrink-0">{wo.reference}</span>}
            <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold ${form.internal ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
              {form.internal ? 'Interno' : 'Externo'}
            </span>
            {wo && <span className="text-xs text-gray-400 truncate">{new Date(wo.createdAt).toLocaleDateString()} · {wo.createdBy.name}</span>}
            {!isEdit && <span className="text-sm font-semibold text-gray-700">Nova Ordem de Trabalho</span>}
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
          </button>
        </div>

        {/* Tabs */}
        {isEdit && (
          <div className="flex border-b px-4">
            <button onClick={() => setTab('details')} className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'details' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Detalhes
            </button>
            <button onClick={() => setTab('hours')} className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'hours' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Horas{(wo!.sessions?.length ?? 0) > 0 ? ` (${wo!.sessions.length})` : ''}
            </button>
            <button onClick={() => setTab('parts')} className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'parts' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Peças{wo!.parts.length > 0 ? ` (${wo!.parts.length})` : ''}
            </button>
            <button onClick={() => setTab('collected')} className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'collected' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Recolhas{collectedParts.length > 0 ? ` (${collectedParts.length})` : ''}
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-5 space-y-4">

          {/* ── Details tab ── */}
          {(!isEdit || tab === 'details') && (
            <>
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm(f => ({ ...f, internal: false }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${!form.internal ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                  Externo
                </button>
                <button type="button" onClick={() => setForm(f => ({ ...f, internal: true }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${form.internal ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                  Interno
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição <span className="text-red-500">*</span></label>
                <textarea rows={6} className="input text-gray-800" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              {!form.internal && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Km</label>
                      <input type="number" step="0.1" min="0" className="input text-gray-800" placeholder="0" value={form.km} onChange={e => setForm(f => ({ ...f, km: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Morada de origem</label>
                      <input type="text" className="input text-gray-800" value={form.fromAddress} onChange={e => setForm(f => ({ ...f, fromAddress: e.target.value }))} />
                    </div>
                  </div>

                  {vehicles.length > 0 && (
                    <div ref={vehicleRef} className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Viatura</label>
                      <button type="button" onClick={() => setVehicleOpen(o => !o)} className="input text-gray-800 text-sm w-full text-left flex items-center justify-between">
                        <span className={form.vehicleIds.length ? 'text-gray-800' : 'text-gray-400'}>
                          {form.vehicleIds.length ? vehicles.filter(v => form.vehicleIds.includes(v.id)).map(v => v.plateNumber).join(', ') : 'Selecionar viatura...'}
                        </span>
                        <svg className="w-4 h-4 text-gray-500 ml-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      {vehicleOpen && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                          {vehicles.map(v => (
                            <div key={v.id} onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setForm(f => ({ ...f, vehicleIds: f.vehicleIds.includes(v.id) ? f.vehicleIds.filter(id => id !== v.id) : [...f.vehicleIds, v.id] })) }} className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-blue-50 select-none ${form.vehicleIds.includes(v.id) ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-800'}`}>
                              <span className="w-4 h-4 border rounded flex items-center justify-center shrink-0 text-xs">{form.vehicleIds.includes(v.id) ? '✓' : ''}</span>
                              <span className="text-sm">{v.plateNumber}{(v.brand || v.model) ? ` — ${[v.brand, v.model].filter(Boolean).join(' ')}` : ''}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Guia de transporte</label>
                    <input type="text" className="input text-gray-800" value={form.transportGuide} onChange={e => setForm(f => ({ ...f, transportGuide: e.target.value }))} />
                  </div>
                </>
              )}

              {equipment.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Equipamento</label>
                  <select className="input text-gray-800" value={form.equipmentId} onChange={e => setForm(f => ({ ...f, equipmentId: e.target.value }))}>
                    <option value="">Nenhum equipamento</option>
                    {equipment.map(eq => <option key={eq.id} value={eq.id}>{eq.equipmentType.name} — {eq.brand.name} {eq.model}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de intervenção</label>
                <div className="flex flex-wrap gap-4">
                  {(['ELECTRONIC', 'HYDRAULIC', 'COMPUTING', 'OTHERS'] as const).map(type => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.interventionType === type} onChange={() => setForm(f => ({ ...f, interventionType: f.interventionType === type ? '' : type }))} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                      <span className="text-sm font-medium text-gray-700">{INTERVENTION_TYPE_LABELS[type]}</span>
                    </label>
                  ))}
                </div>
              </div>

              {otherTechs.length > 0 && (
                <div ref={helperRef} className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ajudantes</label>
                  <button type="button" onClick={() => setHelperOpen(o => !o)} className="input text-gray-800 text-sm w-full text-left flex items-center justify-between">
                    <span className={form.helperIds.length ? 'text-gray-800' : 'text-gray-400'}>
                      {form.helperIds.length ? technicians.filter(t => form.helperIds.includes(t.id)).map(t => t.name).join(', ') : '—'}
                    </span>
                    <svg className="w-4 h-4 text-gray-500 ml-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {helperOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                      {otherTechs.map(tech => (
                        <div key={tech.id} onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setForm(f => ({ ...f, helperIds: f.helperIds.includes(tech.id) ? f.helperIds.filter(id => id !== tech.id) : [...f.helperIds, tech.id] })) }} className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-blue-50 select-none ${form.helperIds.includes(tech.id) ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-800'}`}>
                          <span className="w-4 h-4 border rounded flex items-center justify-center shrink-0 text-xs">{form.helperIds.includes(tech.id) ? '✓' : ''}</span>
                          <span className="text-sm">{tech.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {isEdit && savedPdfs.length > 0 && (
                <div className="border-t pt-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">PDFs Guardados</p>
                  <div className="space-y-1">
                    {savedPdfs.map((pdf, idx) => (
                      <div key={pdf.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-3 py-1.5">
                        <span className="text-xs text-gray-600">#{savedPdfs.length - idx} — {new Date(pdf.createdAt).toLocaleString()}</span>
                        <button onClick={() => wo && onPrint(wo)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Re-imprimir</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Hours tab ── */}
          {isEdit && tab === 'hours' && (
            <>
              {(wo!.sessions ?? []).length === 0 && !showSessionForm && (
                <p className="text-sm text-gray-400 text-center py-4">Nenhuma sessão registada.</p>
              )}
              <div className="space-y-2">
                {(wo!.sessions ?? []).map(s => (
                  <div key={s.id} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                    <div className="flex-1 text-sm text-gray-700 flex items-center gap-2 flex-wrap">
                      <span>▶ {s.startDate ?? '—'}{s.startTime ? ` ${s.startTime}` : ''}</span>
                      <span className="text-gray-400">→</span>
                      <span>■ {s.endDate ?? '—'}{s.endTime ? ` ${s.endTime}` : ''}</span>
                    </div>
                    {s.duration != null && <span className="font-semibold text-blue-700 shrink-0">{s.duration}h</span>}
                    {canEdit && <button onClick={() => handleDeleteSession(s.id)} className="text-red-400 hover:text-red-600 text-xs shrink-0">Eliminar</button>}
                  </div>
                ))}
              </div>

              {showSessionForm ? (
                <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 space-y-3">
                  <h4 className="font-medium text-gray-800">Nova Sessão</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Data início</label>
                      <input type="date" className="input text-gray-800" value={sessionForm.startDate} onChange={e => updateSessionForm({ startDate: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Hora início</label>
                      <input type="time" className="input text-gray-800" value={sessionForm.startTime} onChange={e => updateSessionForm({ startTime: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Data fim</label>
                      <input type="date" className="input text-gray-800" value={sessionForm.endDate} onChange={e => updateSessionForm({ endDate: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Hora fim</label>
                      <input type="time" className="input text-gray-800" value={sessionForm.endTime} onChange={e => updateSessionForm({ endTime: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Duração (horas) <span className="text-red-500">*</span></label>
                    <input type="number" step="0.01" min="0" className="input text-gray-800 w-32" placeholder="Auto-calculado ou manual" value={sessionForm.duration} onChange={e => setSessionForm(f => ({ ...f, duration: e.target.value }))} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddSession} disabled={sessionSaving || !sessionForm.duration} className="btn btn-primary text-sm disabled:opacity-50">
                      {sessionSaving ? 'A guardar...' : 'Adicionar'}
                    </button>
                    <button onClick={() => { setShowSessionForm(false); setSessionForm({ startDate: '', startTime: '', endDate: '', endTime: '', duration: '' }) }} className="btn btn-secondary text-sm">Cancelar</button>
                  </div>
                </div>
              ) : canEdit && (
                <button onClick={() => setShowSessionForm(true)} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
                  + Adicionar Sessão
                </button>
              )}

              {(wo!.sessions ?? []).length > 0 && (
                <div className="border-t pt-3 text-right">
                  <span className="font-semibold text-gray-700">Total: {totalSessionHours.toFixed(2)}h</span>
                </div>
              )}
            </>
          )}

          {/* ── Parts tab ── */}
          {isEdit && tab === 'parts' && (
            <>
              {wo!.parts.length > 0 && (
                <div className="space-y-2">
                  {wo!.parts.map(part => (
                    <div key={part.id} className="bg-gray-50 rounded-lg px-4 py-3 flex justify-between items-start gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-sm">{part.item.itemName}</p>
                        <p className="text-xs text-gray-500 font-mono">{part.item.partNumber}</p>
                        {part.item.tracksSerialNumbers && part.serialNumbers && part.serialNumbers.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {part.serialNumbers.map(sn => <span key={sn.id} className="px-2 py-0.5 bg-purple-100 text-purple-900 rounded text-xs font-mono">{sn.serialNumber}</span>)}
                          </div>
                        )}
                        {(part.createdAt || part.usedByName) && (
                          <p className="text-xs text-gray-400 mt-0.5">{new Date(part.createdAt).toLocaleString()}{part.usedByName && ` — ${part.usedByName}`}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-gray-500">{part.quantity} un.</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {wo!.parts.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-2">Nenhuma peça utilizada.</p>
              )}

              {canEdit && (
                <button
                  onClick={() => setShowAddPart(true)}
                  className="w-full py-3 border-2 border-dashed border-blue-300 rounded-lg text-sm text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  + Adicionar Peça
                </button>
              )}
            </>
          )}

          {/* ── Recolhas tab ── */}
          {isEdit && tab === 'collected' && (
            <>
              {collectedLoading ? (
                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500" /></div>
              ) : (
                <>
                  {collectedParts.length === 0 && !showCollectForm && (
                    <p className="text-sm text-gray-400 text-center py-4">Nenhuma peça recolhida nesta ordem de trabalho.</p>
                  )}
                  <div className="space-y-2">
                    {collectedParts.map(part => (
                      <div key={part.id} className={`rounded-lg border px-4 py-3 text-sm ${part.preSwapped ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-800">{part.itemName}</span>
                          {part.partNumber !== '__GENERIC__' && <span className="text-xs text-gray-400 font-mono">{part.partNumber}</span>}
                          {part.partNumber === '__GENERIC__' && <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Genérico</span>}
                          {part.preSwapped && <span className="text-xs font-semibold bg-green-100 text-green-800 px-1.5 py-0.5 rounded">Sub. Imediata</span>}
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ml-auto ${
                            part.preSwapped ? 'bg-green-100 text-green-800' :
                            part.clientPartStatus === 'IN_TRANSIT' ? 'bg-yellow-100 text-yellow-800' :
                            part.clientPartStatus === 'PENDING' ? 'bg-orange-100 text-orange-800' :
                            part.clientPartStatus === 'REPAIR' ? 'bg-blue-100 text-blue-800' :
                            part.clientPartStatus === 'RESOLVED' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {part.preSwapped ? 'Resolvida' :
                             part.clientPartStatus === 'IN_TRANSIT' ? 'Em Trânsito' :
                             part.clientPartStatus === 'PENDING' ? 'No Armazém' :
                             part.clientPartStatus === 'REPAIR' ? 'Em Reparação' :
                             part.clientPartStatus === 'RESOLVED' ? 'Concluída' :
                             part.clientPartStatus ?? '—'}
                          </span>
                        </div>
                        {part.serialNumber && <p className="text-xs font-mono text-gray-600 mt-1">{part.preSwapped ? 'SN entregue:' : 'SN:'} {part.serialNumber}</p>}
                        {part.preSwapped && part.clientItemSn && <p className="text-xs font-mono text-gray-600 mt-0.5">SN recolhido: {part.clientItemSn}</p>}
                        {part.faultDescription && <p className="text-xs text-gray-500 italic mt-0.5">{part.faultDescription}</p>}
                        {part.repairReference && <p className="text-xs font-mono text-orange-700 mt-0.5">{part.repairReference}</p>}
                        <p className="text-xs text-gray-400 mt-1">{new Date(part.createdAt).toLocaleString()}{part.pickedUpByName ? ` — ${part.pickedUpByName}` : ''}</p>
                      </div>
                    ))}
                  </div>

                  {showCollectForm ? (
                    <div className="border border-amber-200 rounded-lg p-4 bg-amber-50 space-y-3 mt-2">
                      <h4 className="font-semibold text-gray-800 text-sm">Registar Recolha</h4>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Artigo</label>
                        <div ref={collectItemRef} className="relative">
                          <button
                            type="button"
                            onClick={() => setCollectItemOpen(o => !o)}
                            className="input text-sm w-full text-left flex items-center justify-between"
                          >
                            <span className={collectForm.warehouseItemId ? 'text-gray-800' : 'text-gray-400'}>
                              {collectForm.warehouseItemId
                                ? (() => {
                                    if (collectForm.preSwapped) {
                                      const f = technicianStock.find(i => i.itemId === collectForm.warehouseItemId)
                                      return f ? `${f.itemName} (${f.partNumber})` : 'Selecionar...'
                                    }
                                    if (collectForm.warehouseItemId === '__GENERIC__') return <span className="text-amber-700 font-medium">Artigo não catalogado</span>
                                    const f = warehouseItems.find(i => i.id === collectForm.warehouseItemId)
                                    return f ? `${f.itemName} (${f.partNumber})` : 'Selecionar...'
                                  })()
                                : collectForm.preSwapped ? 'Selecionar do stock do técnico...' : 'Selecionar artigo...'}
                            </span>
                            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </button>
                          {collectItemOpen && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                              <div className="p-2 border-b">
                                <input
                                  type="text" autoFocus placeholder="Pesquisar..."
                                  value={collectItemSearch}
                                  onChange={e => setCollectItemSearch(e.target.value)}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                              <ul className="overflow-y-auto" style={{ maxHeight: '11rem' }}>
                                {collectForm.preSwapped ? (
                                  technicianStockLoading
                                    ? <li className="px-3 py-2 text-sm text-gray-400">A carregar stock...</li>
                                    : technicianStock.length === 0
                                      ? <li className="px-3 py-2 text-sm text-gray-400">Sem stock disponível</li>
                                      : technicianStock
                                          .filter(i => `${i.itemName} ${i.partNumber}`.toLowerCase().includes(collectItemSearch.toLowerCase()))
                                          .map(item => (
                                            <li
                                              key={item.itemId}
                                              onMouseDown={() => { setCollectForm(f => ({ ...f, warehouseItemId: item.itemId, serialNumber: '', clientItemSn: '' })); setCollectItemOpen(false); setCollectItemSearch('') }}
                                              className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${collectForm.warehouseItemId === item.itemId ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-800'}`}
                                            >
                                              {item.itemName} <span className="text-gray-400">({item.partNumber})</span>
                                              <span className="ml-2 text-xs text-gray-400">× {item.tracksSerialNumbers ? (item.serialNumbers?.length ?? 0) : item.quantity}</span>
                                            </li>
                                          ))
                                ) : (
                                  <>
                                    <li
                                      onMouseDown={() => { setCollectForm(f => ({ ...f, warehouseItemId: '__GENERIC__' })); setCollectItemOpen(false); setCollectItemSearch('') }}
                                      className={`px-3 py-2 text-sm cursor-pointer hover:bg-amber-50 border-b border-gray-100 text-amber-700 font-medium ${collectForm.warehouseItemId === '__GENERIC__' ? 'bg-amber-100' : ''}`}
                                    >
                                      Artigo não catalogado
                                    </li>
                                    {warehouseItems
                                      .filter(i => `${i.itemName} ${i.partNumber}`.toLowerCase().includes(collectItemSearch.toLowerCase()))
                                      .map(item => (
                                        <li
                                          key={item.id}
                                          onMouseDown={() => { setCollectForm(f => ({ ...f, warehouseItemId: item.id })); setCollectItemOpen(false); setCollectItemSearch('') }}
                                          className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${collectForm.warehouseItemId === item.id ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-800'}`}
                                        >
                                          {item.itemName} <span className="text-gray-400">({item.partNumber})</span>
                                        </li>
                                      ))}
                                  </>
                                )}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>

                      {(() => {
                        const techItem = collectForm.preSwapped && collectForm.warehouseItemId
                          ? technicianStock.find(i => i.itemId === collectForm.warehouseItemId)
                          : null
                        const availableSns = techItem?.tracksSerialNumbers && techItem.serialNumbers?.length
                          ? techItem.serialNumbers
                          : null
                        return (
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              {collectForm.preSwapped
                                ? <>Nº de série entregue ao cliente{availableSns ? <span className="text-red-500"> *</span> : <span className="text-gray-400 font-normal"> (opcional)</span>}</>
                                : <>Nº de série da peça recolhida <span className="text-gray-400 font-normal">(opcional)</span></>}
                            </label>
                            {availableSns ? (
                              <select
                                className="input text-gray-800 w-full text-sm"
                                value={collectForm.serialNumber}
                                onChange={e => setCollectForm(f => ({ ...f, serialNumber: e.target.value }))}
                                required
                              >
                                <option value="">Selecionar SN entregue...</option>
                                {availableSns.map(sn => (
                                  <option key={sn.id} value={sn.serialNumber}>{sn.serialNumber}</option>
                                ))}
                              </select>
                            ) : (
                              <input type="text" placeholder="Ex: SN-12345" className="input text-gray-800 w-full text-sm"
                                value={collectForm.serialNumber} onChange={e => setCollectForm(f => ({ ...f, serialNumber: e.target.value }))} />
                            )}
                          </div>
                        )
                      })()}

                      {collectForm.preSwapped && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Nº de série da peça avariada recolhida <span className="text-gray-400 font-normal">(opcional — confirmável no armazém)</span>
                          </label>
                          <input
                            type="text"
                            placeholder="SN da peça com defeito que o técnico vai trazer..."
                            className="input text-gray-800 w-full text-sm"
                            value={collectForm.clientItemSn}
                            onChange={e => setCollectForm(f => ({ ...f, clientItemSn: e.target.value }))}
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Descrição da avaria <span className="text-gray-400 font-normal">(opcional)</span></label>
                        <textarea rows={2} placeholder="Ex: Não liga, sensor danificado..." className="input text-gray-800 w-full text-sm"
                          value={collectForm.faultDescription} onChange={e => setCollectForm(f => ({ ...f, faultDescription: e.target.value }))} />
                      </div>

                      <label className="flex items-start gap-3 cursor-pointer bg-green-50 border border-green-200 rounded-lg p-3">
                        <input
                          type="checkbox"
                          checked={collectForm.preSwapped}
                          onChange={async e => {
                            const checked = e.target.checked
                            setCollectForm(f => ({ ...f, preSwapped: checked, warehouseItemId: '', serialNumber: '', clientItemSn: '' }))
                            setCollectItemSearch('')
                            if (checked && assignedTechnicianId) {
                              setTechnicianStockLoading(true)
                              try {
                                const token = localStorage.getItem('token')
                                const data = await fetch(`/api/warehouse/technicians/${assignedTechnicianId}`, {
                                  headers: { Authorization: `Bearer ${token}` },
                                }).then(r => r.json())
                                setTechnicianStock(Array.isArray(data.stocks) ? data.stocks.filter((s: any) =>
                                  s.tracksSerialNumbers
                                    ? (s.serialNumbers?.length ?? 0) > 0
                                    : s.quantity > 0
                                ) : [])
                              } catch { setTechnicianStock([]) } finally { setTechnicianStockLoading(false) }
                            } else {
                              setTechnicianStock([])
                            }
                          }}
                          className="mt-0.5 w-4 h-4 text-green-600"
                        />
                        <div>
                          <p className="text-sm font-semibold text-green-900">Substituição imediata</p>
                          <p className="text-xs text-green-700 mt-0.5">O técnico já levou uma peça de substituição para o cliente. A peça recolhida será reparada e entrará para o stock da empresa.</p>
                        </div>
                      </label>

                      <div className="flex gap-2">
                        {(() => {
                          const selectedTechItem = collectForm.preSwapped && collectForm.warehouseItemId
                            ? technicianStock.find(i => i.itemId === collectForm.warehouseItemId)
                            : null
                          const snRequired = !!(selectedTechItem?.tracksSerialNumbers && (selectedTechItem.serialNumbers?.length ?? 0) > 0)
                          const snMissing = snRequired && !collectForm.serialNumber
                          return (
                            <button
                              onClick={handleCollect}
                              disabled={collectSaving || !collectForm.warehouseItemId || snMissing}
                              className="btn btn-primary text-sm disabled:opacity-50"
                            >
                              {collectSaving ? 'A guardar...' : 'Registar'}
                            </button>
                          )
                        })()}
                        <button
                          onClick={() => { setShowCollectForm(false); setCollectForm({ warehouseItemId: '', serialNumber: '', clientItemSn: '', faultDescription: '', preSwapped: false }); setCollectItemSearch('') }}
                          className="btn btn-secondary text-sm"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : canEdit && (
                    <button
                      onClick={() => setShowCollectForm(true)}
                      className="w-full py-3 border-2 border-dashed border-amber-300 rounded-lg text-sm text-amber-600 hover:border-amber-400 hover:bg-amber-50 transition-colors mt-2"
                    >
                      + Registar Recolha
                    </button>
                  )}
                </>
              )}
            </>
          )}

        </div>

        {/* Footer actions */}
        {(!isEdit || tab === 'details') && (
          <div className="px-5 py-3 border-t flex items-center justify-between bg-gray-50">
            <div>
              {isEdit && canEdit && (
                <button onClick={onDelete} className="text-red-600 hover:text-red-800 text-sm font-medium">Eliminar</button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isEdit && <button onClick={() => onPrint(wo!)} className="btn btn-secondary text-sm">PDF</button>}
              <button onClick={onClose} className="btn btn-secondary text-sm">Fechar</button>
              {canEdit && (
                <button onClick={handleSave} disabled={saving || !form.description.trim()} className="btn btn-primary text-sm disabled:opacity-50">
                  {saving ? 'A guardar...' : isEdit ? 'Guardar' : 'Criar'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {showAddPart && wo && (
        <AddPartModal
          interventionId={interventionId}
          workOrderId={wo.id}
          technicianId={assignedTechnicianId}
          warehouseItems={warehouseItems}
          onPartAdded={onRefresh}
          onClose={() => setShowAddPart(false)}
        />
      )}
    </>
  )
}
