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

type Tab = 'details' | 'hours' | 'parts'

function calcDuration(sd: string, st: string, ed: string, et: string): string {
  if (!sd || !st || !ed || !et) return ''
  const diff = new Date(`${ed}T${et}`).getTime() - new Date(`${sd}T${st}`).getTime()
  return diff > 0 ? (diff / 3600000).toFixed(2) : ''
}

const INTERVENTION_TYPE_LABELS: Record<string, string> = {
  ELECTRONIC: 'Eletrónica', HYDRAULIC: 'Hidráulica', COMPUTING: 'Informática', OTHERS: 'Outros',
}

export default function WorkOrderModal({
  wo, interventionId, assignedTechnicianId, canEdit,
  equipment, technicians, vehicles, warehouseItems,
  savedPdfs, printCompany,
  onClose, onRefresh, onDelete, onPrint,
}: Props) {
  const isEdit = wo !== null
  const [tab, setTab] = useState<Tab>('details')

  // Details form
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

  // Hours
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [sessionForm, setSessionForm] = useState({ startDate: '', startTime: '', endDate: '', endTime: '', duration: '' })
  const [sessionSaving, setSessionSaving] = useState(false)

  // Parts
  const [showAddPart, setShowAddPart] = useState(false)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (vehicleRef.current && !vehicleRef.current.contains(e.target as Node)) setVehicleOpen(false)
      if (helperRef.current && !helperRef.current.contains(e.target as Node)) setHelperOpen(false)
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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {wo?.reference && <span className="font-mono font-bold text-gray-800 shrink-0">{wo.reference}</span>}
            <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold ${form.internal ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
              {form.internal ? 'Interno' : 'Externo'}
            </span>
            {wo && <span className="text-xs text-gray-400 truncate">{new Date(wo.createdAt).toLocaleDateString()} · {wo.createdBy.name}</span>}
            {!isEdit && <span className="text-sm font-semibold text-gray-700">Nova Ordem de Trabalho</span>}
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg ml-2 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tabs */}
        {isEdit && (
          <div className="flex border-b px-4 shrink-0">
            <button onClick={() => setTab('details')} className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'details' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Detalhes
            </button>
            <button onClick={() => setTab('hours')} className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'hours' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Horas{(wo!.sessions?.length ?? 0) > 0 ? ` (${wo!.sessions.length})` : ''}
            </button>
            <button onClick={() => setTab('parts')} className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'parts' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Peças{wo!.parts.length > 0 ? ` (${wo!.parts.length})` : ''}
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

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
                <textarea rows={8} className="input text-gray-800" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
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
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
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
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
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
        </div>

        {/* Footer */}
        {(!isEdit || tab === 'details') && (
          <div className="px-6 py-4 border-t flex items-center justify-between shrink-0 bg-gray-50 rounded-b-xl">
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
