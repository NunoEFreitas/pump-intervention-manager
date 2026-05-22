'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'

interface WorkOrderSignatureModalProps {
  workOrder: {
    reference: string | null
    description: string
    timeSpent: number | null
    km: number | null
    locationEquipmentId: string | null
    interventionType: string | null
    transportGuide: string | null
    sessions: { startDate: string | null; startTime: string | null; endDate: string | null; endTime: string | null; duration: number | null }[]
    fromAddress: string | null
    internal: boolean
    vehicles: { plateNumber: string; brand: string | null; model: string | null }[]
    helpers: { name: string }[]
    createdBy: { name: string }
    parts: {
      quantity: number
      item: { itemName: string; partNumber: string }
      serialNumbers?: { serialNumber: string }[]
    }[]
  }
  intervention: {
    reference: string | null
    breakdown: string
    status: string
    bill: boolean
    assignedTo: { name: string } | null
    client: { name: string; phone: string | null }
    location: {
      name: string
      address: string | null
      city: string | null
      equipment: { id: string; model: string; serialNumber: string | null; equipmentType: { name: string }; brand: { name: string } }[]
    } | null
  }
  repairParts?: {
    parts: { id: string; itemName: string; partNumber: string; quantity: number; notes: string | null }[]
  }[]
  swapItems?: { itemName: string; partNumber: string; serialNumber: string | null }[]
  onGenerate: (clientSig: string | null, techSig: string | null) => void
  onClose: () => void
}

function SignaturePad({ label, onChanged }: { label: string; onChanged: (data: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const start = (e: MouseEvent | TouchEvent) => {
      e.preventDefault()
      drawing.current = true
      const pos = getPos(e, canvas)
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
    }

    const move = (e: MouseEvent | TouchEvent) => {
      if (!drawing.current) return
      e.preventDefault()
      const pos = getPos(e, canvas)
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
    }

    const end = () => {
      if (!drawing.current) return
      drawing.current = false
      onChanged(canvas.toDataURL('image/png'))
    }

    canvas.addEventListener('mousedown', start)
    canvas.addEventListener('mousemove', move)
    canvas.addEventListener('mouseup', end)
    canvas.addEventListener('mouseleave', end)
    canvas.addEventListener('touchstart', start, { passive: false })
    canvas.addEventListener('touchmove', move, { passive: false })
    canvas.addEventListener('touchend', end)

    return () => {
      canvas.removeEventListener('mousedown', start)
      canvas.removeEventListener('mousemove', move)
      canvas.removeEventListener('mouseup', end)
      canvas.removeEventListener('mouseleave', end)
      canvas.removeEventListener('touchstart', start)
      canvas.removeEventListener('touchmove', move)
      canvas.removeEventListener('touchend', end)
    }
  }, [onChanged])

  const clear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    onChanged(null)
  }

  return (
    <div className="flex flex-col items-center gap-2 flex-1">
      <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</div>
      <canvas
        ref={canvasRef}
        width={320}
        height={140}
        className="border border-gray-300 rounded bg-white w-full touch-none cursor-crosshair"
        style={{ maxWidth: 320 }}
      />
      <button type="button" onClick={clear} className="text-xs text-gray-400 underline hover:text-red-500">
        Limpar
      </button>
    </div>
  )
}

function calcDuration(start: string | null, end: string | null): string {
  if (!start || !end) return ''
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const diff = eh * 60 + em - (sh * 60 + sm)
  if (diff <= 0) return ''
  return `${Math.floor(diff / 60)}h ${diff % 60}m`
}

// Navy colour shared with PDF style
const NAVY = '#1e3a5f'

function Section({ title }: { title: string }) {
  return (
    <div
      style={{ background: NAVY, color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', padding: '5px 10px', marginTop: 14, marginBottom: 6, borderRadius: 3 }}
    >
      {title}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', fontSize: 11, marginBottom: 3 }}>
      <span style={{ color: '#64748b', minWidth: 130, fontWeight: 600 }}>{label}</span>
      <span style={{ color: '#1e293b' }}>{value || '—'}</span>
    </div>
  )
}

export default function WorkOrderSignatureModal({ workOrder, repairParts, swapItems, intervention, onGenerate, onClose }: WorkOrderSignatureModalProps) {
  const [clientSig, setClientSig] = useState<string | null>(null)
  const [techSig, setTechSig] = useState<string | null>(null)

  const handleClientSig = useCallback((data: string | null) => setClientSig(data), [])
  const handleTechSig = useCallback((data: string | null) => setTechSig(data), [])

  const techName = intervention.assignedTo?.name || workOrder.createdBy.name
  const vehicleText = workOrder.vehicles.map(v => [v.plateNumber, v.brand, v.model].filter(Boolean).join(' ')).join(', ')
  const firstSession = workOrder.sessions?.[0] ?? null
  const locationEquipment = intervention.location?.equipment.find(e => e.id === workOrder.locationEquipmentId)
  const locationAddr = [intervention.location?.address, intervention.location?.city].filter(Boolean).join(', ')
  const hasTravel = vehicleText || workOrder.km || workOrder.fromAddress || locationAddr
  const hasMaterials = workOrder.parts.length > 0 || (repairParts && repairParts.some(j => j.parts.length > 0)) || (swapItems && swapItems.length > 0)

  const totalDuration = workOrder.sessions.reduce((acc, s) => {
    if (s.duration != null) return acc + s.duration
    if (s.startTime && s.endTime) {
      const [sh, sm] = s.startTime.split(':').map(Number)
      const [eh, em] = s.endTime.split(':').map(Number)
      const diff = (eh * 60 + em - (sh * 60 + sm)) / 60
      return acc + (diff > 0 ? diff : 0)
    }
    return acc
  }, 0)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[95vh]">

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-bold text-gray-800" style={{ color: NAVY }}>
            Ficha Técnica {workOrder.reference ? `— ${workOrder.reference}` : ''}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
        </div>

        {/* Scrollable preview */}
        <div className="flex-1 overflow-y-auto px-6 py-4" style={{ fontSize: 12 }}>

          {/* Client + reference row */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
            <div style={{ flex: 1 }}>
              <InfoRow label="Cliente" value={intervention.client.name} />
              <InfoRow label="Contacto" value={intervention.client.phone} />
              <InfoRow label="Local" value={intervention.location ? `${intervention.location.name}${locationAddr ? ` — ${locationAddr}` : ''}` : null} />
            </div>
            <div style={{ flex: 1 }}>
              <InfoRow label="Referência" value={workOrder.reference} />
              <InfoRow label="Intervenção" value={intervention.reference} />
              <InfoRow label="Data" value={firstSession?.startDate} />
              {workOrder.transportGuide && <InfoRow label="Guia de transporte" value={workOrder.transportGuide} />}
            </div>
          </div>

          {/* Badges row */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
            {workOrder.interventionType && (
              <span style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '2px 8px' }}>
                {workOrder.interventionType}
              </span>
            )}
            <span style={{ background: workOrder.internal ? '#f3f4f6' : '#dcfce7', color: workOrder.internal ? '#374151' : '#166534', fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '2px 8px' }}>
              {workOrder.internal ? 'Interna' : 'Externa'}
            </span>
            {intervention.status === 'COMPLETED' && (
              <span style={{ background: '#dcfce7', color: '#166534', fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '2px 8px' }}>
                Concluída
              </span>
            )}
          </div>

          {/* Sessions / Labor */}
          <Section title="MÃO-DE-OBRA" />
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '4px 8px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#475569' }}>Colaborador</th>
                <th style={{ padding: '4px 8px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#475569' }}>Data</th>
                <th style={{ padding: '4px 8px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#475569' }}>Início</th>
                <th style={{ padding: '4px 8px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#475569' }}>Fim</th>
                <th style={{ padding: '4px 8px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#475569' }}>Duração</th>
              </tr>
            </thead>
            <tbody>
              {workOrder.sessions && workOrder.sessions.length > 0
                ? workOrder.sessions.map((s, i) => {
                    const dur = s.duration != null
                      ? `${s.duration.toFixed(2)}h`
                      : calcDuration(s.startTime, s.endTime)
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                        <td style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9' }}>{i === 0 ? techName : ''}</td>
                        <td style={{ padding: '4px 8px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{s.startDate || ''}</td>
                        <td style={{ padding: '4px 8px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{s.startTime || ''}</td>
                        <td style={{ padding: '4px 8px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{s.endTime || ''}</td>
                        <td style={{ padding: '4px 8px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{dur}</td>
                      </tr>
                    )
                  })
                : (
                  <tr>
                    <td style={{ padding: '4px 8px' }}>{techName}</td>
                    <td /><td /><td /><td />
                  </tr>
                )
              }
              {totalDuration > 0 && (
                <tr style={{ background: '#eff6ff', fontWeight: 700 }}>
                  <td colSpan={4} style={{ padding: '4px 8px', textAlign: 'right', color: NAVY }}>Total</td>
                  <td style={{ padding: '4px 8px', textAlign: 'center', color: NAVY }}>{totalDuration.toFixed(2)}h</td>
                </tr>
              )}
              {workOrder.helpers.length > 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '3px 8px', fontSize: 10, color: '#64748b', fontStyle: 'italic' }}>
                    Ajudantes: {workOrder.helpers.map(h => h.name).join(', ')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Travel */}
          {hasTravel && (
            <>
              <Section title="DESLOCAÇÕES" />
              <div style={{ display: 'flex', gap: 24 }}>
                <div style={{ flex: 1 }}>
                  <InfoRow label="Viatura" value={vehicleText} />
                  <InfoRow label="Total KM" value={workOrder.km != null ? String(workOrder.km) : null} />
                </div>
                <div style={{ flex: 1 }}>
                  <InfoRow label="Origem" value={workOrder.fromAddress} />
                  <InfoRow label="Destino" value={locationAddr || intervention.location?.name} />
                </div>
              </div>
            </>
          )}

          {/* Materials */}
          {hasMaterials && (
            <>
              <Section title="MATERIAIS APLICADOS" />
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '4px 8px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#475569' }}>Denominação</th>
                    <th style={{ padding: '4px 8px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#475569', width: 50 }}>Qtd</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...workOrder.parts.map(p => ({
                      key: `d-${p.item.partNumber}`,
                      name: p.item.itemName,
                      pn: p.item.partNumber,
                      qty: p.quantity,
                      sn: p.serialNumbers?.length ? p.serialNumbers.map(s => s.serialNumber).join(', ') : null,
                    })),
                    ...(repairParts ?? []).flatMap(job =>
                      job.parts.map(p => ({ key: `r-${p.id}`, name: p.itemName, pn: p.partNumber, qty: p.quantity, sn: null }))
                    ),
                    ...(swapItems ?? []).map((s, i) => ({ key: `sw-${i}`, name: s.itemName, pn: s.partNumber, qty: 1, sn: s.serialNumber })),
                  ].map((row, i) => (
                    <tr key={row.key} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9' }}>
                        {row.name}
                        {row.pn && <span style={{ color: '#94a3b8', marginLeft: 4 }}>({row.pn})</span>}
                        {row.sn && <span style={{ color: '#94a3b8', marginLeft: 4, fontSize: 10 }}>SN: {row.sn}</span>}
                      </td>
                      <td style={{ padding: '4px 8px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{row.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Equipment */}
          {locationEquipment && (
            <>
              <Section title="BOMBAS / EQUIPAMENTOS" />
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Tipo', 'Marca', 'Modelo', 'Série'].map(h => (
                      <th key={h} style={{ padding: '4px 8px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#475569' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '4px 8px' }}>{locationEquipment.equipmentType.name}</td>
                    <td style={{ padding: '4px 8px' }}>{locationEquipment.brand.name}</td>
                    <td style={{ padding: '4px 8px' }}>{locationEquipment.model}</td>
                    <td style={{ padding: '4px 8px' }}>{locationEquipment.serialNumber ?? '—'}</td>
                  </tr>
                </tbody>
              </table>
            </>
          )}

          {/* Anomalias */}
          <Section title="ANOMALIAS ENCONTRADAS" />
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4, padding: '8px 10px', fontSize: 11, minHeight: 36, whiteSpace: 'pre-wrap', color: '#1e293b' }}>
            {intervention.breakdown || '—'}
          </div>

          {/* Work done */}
          <Section title="TRABALHO EFETUADO" />
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4, padding: '8px 10px', fontSize: 11, minHeight: 36, whiteSpace: 'pre-wrap', color: '#1e293b' }}>
            {workOrder.description || '—'}
          </div>

          {/* Signatures */}
          <Section title="ASSINATURAS" />
          <div className="flex gap-6 mt-2 mb-1">
            <SignaturePad label="Assinatura do Cliente" onChanged={handleClientSig} />
            <SignaturePad label="Assinatura do Técnico" onChanged={handleTechSig} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            onClick={() => onGenerate(clientSig, techSig)}
            className="px-5 py-2 text-sm rounded-lg text-white font-semibold hover:opacity-90"
            style={{ background: NAVY }}
          >
            Gerar PDF
          </button>
        </div>
      </div>
    </div>
  )
}
