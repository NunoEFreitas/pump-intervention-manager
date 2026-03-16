'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

interface WorkOrderSignatureModalProps {
  workOrder: {
    reference: string | null
    description: string
    timeSpent: number | null
    km: number | null
    locationEquipmentId: string | null
    interventionType: string | null
    transportGuide: string | null
    startDate: string | null
    startTime: string | null
    endDate: string | null
    endTime: string | null
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
      equipment: { id: string; model: string; equipmentType: { name: string }; brand: { name: string } }[]
    } | null
  }
  onGenerate: (clientSig: string | null, techSig: string | null) => void
  onClose: () => void
}

function SignaturePad({ label, onChanged }: { label: string; onChanged: (data: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const hasDrawn = useRef(false)

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
      if (!hasDrawn.current) {
        hasDrawn.current = true
      }
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
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasDrawn.current = false
    onChanged(null)
  }

  return (
    <div className="flex flex-col items-center gap-2 flex-1">
      <div className="text-sm font-semibold text-gray-700">{label}</div>
      <canvas
        ref={canvasRef}
        width={320}
        height={150}
        className="border border-gray-400 rounded bg-white w-full touch-none cursor-crosshair"
        style={{ maxWidth: 320 }}
      />
      <button
        type="button"
        onClick={clear}
        className="text-xs text-gray-500 underline hover:text-red-500"
      >
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

export default function WorkOrderSignatureModal({ workOrder, intervention, onGenerate, onClose }: WorkOrderSignatureModalProps) {
  const [clientSig, setClientSig] = useState<string | null>(null)
  const [techSig, setTechSig] = useState<string | null>(null)

  const handleClientSig = useCallback((data: string | null) => setClientSig(data), [])
  const handleTechSig = useCallback((data: string | null) => setTechSig(data), [])

  const techName = intervention.assignedTo?.name || workOrder.createdBy.name
  const vehicleText = workOrder.vehicles.map(v => [v.plateNumber, v.brand, v.model].filter(Boolean).join(' ')).join(', ')
  const duration = calcDuration(workOrder.startTime, workOrder.endTime)
  const locationEquipment = intervention.location?.equipment.find(e => e.id === workOrder.locationEquipmentId)
  const locationAddr = [intervention.location?.address, intervention.location?.city].filter(Boolean).join(', ')
  const clientAddr = [intervention.client.phone].filter(Boolean).join(', ')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-800">
            Ficha Técnica {workOrder.reference ? `— ${workOrder.reference}` : ''}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
        </div>

        {/* Preview + signatures */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-sm text-gray-800">

          {/* Client / date */}
          <table className="w-full border-collapse text-xs">
            <tbody>
              <tr>
                <td className="border border-gray-400 px-2 py-1 font-bold w-1/4">CLIENTE</td>
                <td className="border border-gray-400 px-2 py-1 w-1/4">{intervention.client.name}</td>
                <td className="border border-gray-400 px-2 py-1 font-bold w-1/4">CONTACTO</td>
                <td className="border border-gray-400 px-2 py-1 w-1/4">{intervention.client.phone || ''}</td>
              </tr>
              <tr>
                <td className="border border-gray-400 px-2 py-1 font-bold">DATA</td>
                <td className="border border-gray-400 px-2 py-1">{workOrder.startDate || ''}</td>
                <td className="border border-gray-400 px-2 py-1 font-bold">GUIA DE TRANSPORTE</td>
                <td className="border border-gray-400 px-2 py-1">{workOrder.transportGuide || ''}</td>
              </tr>
            </tbody>
          </table>

          {/* Task info */}
          <div>
            <div className="text-center font-bold text-xs border-t-2 border-b-2 border-gray-800 py-1 mb-1">INFORMAÇÕES DA TAREFA</div>
            <table className="w-full border-collapse text-xs">
              <tbody>
                <tr>
                  <td className="border border-gray-400 px-2 py-1 font-bold w-1/2">Tipo da Tarefa</td>
                  <td className="border border-gray-400 px-2 py-1">{workOrder.internal ? 'Interna' : 'Externa'}</td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-2 py-1 font-bold">Trabalho Finalizado</td>
                  <td className="border border-gray-400 px-2 py-1">{intervention.status === 'COMPLETED' ? 'Sim' : 'Não'}</td>
                </tr>
                {workOrder.helpers.length > 0 && (
                  <>
                    <tr>
                      <td className="border border-gray-400 px-2 py-1 font-bold">Houve Ajudante</td>
                      <td className="border border-gray-400 px-2 py-1">Sim</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-400 px-2 py-1 font-bold">Nome Ajudante</td>
                      <td className="border border-gray-400 px-2 py-1">{workOrder.helpers.map(h => h.name).join(', ')}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Labor */}
          <div>
            <div className="text-center font-bold text-xs border-t-2 border-b-2 border-gray-800 py-1 mb-1">MÃO-DE-OBRA</div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="border border-gray-400 px-2 py-1 font-bold text-left">Colaborador</th>
                  <th className="border border-gray-400 px-2 py-1 font-bold">Início</th>
                  <th className="border border-gray-400 px-2 py-1 font-bold">Fim</th>
                  <th className="border border-gray-400 px-2 py-1 font-bold">Duração</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-400 px-2 py-1">{techName}</td>
                  <td className="border border-gray-400 px-2 py-1 text-center">{workOrder.startTime || ''}</td>
                  <td className="border border-gray-400 px-2 py-1 text-center">{workOrder.endTime || ''}</td>
                  <td className="border border-gray-400 px-2 py-1 text-center">{duration}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Travel */}
          <div>
            <div className="text-center font-bold text-xs border-t-2 border-b-2 border-gray-800 py-1 mb-1">DESLOCAÇÕES</div>
            <table className="w-full border-collapse text-xs">
              <tbody>
                <tr>
                  <td className="border border-gray-400 px-2 py-1 font-bold w-1/4">Viatura</td>
                  <td className="border border-gray-400 px-2 py-1 w-1/4">{vehicleText}</td>
                  <td className="border border-gray-400 px-2 py-1 font-bold w-1/4">Total KM</td>
                  <td className="border border-gray-400 px-2 py-1 w-1/4">{workOrder.km ?? ''}</td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-2 py-1 font-bold">Origem</td>
                  <td className="border border-gray-400 px-2 py-1">{workOrder.fromAddress || ''}</td>
                  <td className="border border-gray-400 px-2 py-1 font-bold">Destino</td>
                  <td className="border border-gray-400 px-2 py-1">{locationAddr || (intervention.location?.name || '')}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Materials */}
          {workOrder.parts.length > 0 && (
            <div>
              <div className="text-center font-bold text-xs border-t-2 border-b-2 border-gray-800 py-1 mb-1">MATERIAIS APLICADOS</div>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="border border-gray-400 px-2 py-1 font-bold text-left">Denominação</th>
                    <th className="border border-gray-400 px-2 py-1 font-bold w-16 text-center">Qtd</th>
                  </tr>
                </thead>
                <tbody>
                  {workOrder.parts.map((p, i) => (
                    <tr key={i}>
                      <td className="border border-gray-400 px-2 py-1">
                        {p.item.itemName}
                        {p.item.partNumber && <span className="text-gray-500 ml-1">({p.item.partNumber})</span>}
                        {p.serialNumbers?.length ? <span className="text-gray-500 ml-1 text-[10px]">SN: {p.serialNumbers.map(s => s.serialNumber).join(', ')}</span> : null}
                      </td>
                      <td className="border border-gray-400 px-2 py-1 text-center">{p.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Equipment */}
          {locationEquipment && (
            <div>
              <div className="text-center font-bold text-xs border-t-2 border-b-2 border-gray-800 py-1 mb-1">BOMBAS / EQUIPAMENTOS</div>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="border border-gray-400 px-2 py-1 font-bold text-left">Tipo</th>
                    <th className="border border-gray-400 px-2 py-1 font-bold text-left">Marca</th>
                    <th className="border border-gray-400 px-2 py-1 font-bold text-left">Modelo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-400 px-2 py-1">{locationEquipment.equipmentType.name}</td>
                    <td className="border border-gray-400 px-2 py-1">{locationEquipment.brand.name}</td>
                    <td className="border border-gray-400 px-2 py-1">{locationEquipment.model}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Anomalias */}
          <div>
            <div className="text-center font-bold text-xs border-t-2 border-b-2 border-gray-800 py-1 mb-1">ANOMALIAS ENCONTRADAS</div>
            <div className="border border-gray-400 px-3 py-2 text-xs min-h-[40px] whitespace-pre-wrap">{intervention.breakdown}</div>
          </div>

          {/* Work done */}
          <div>
            <div className="text-center font-bold text-xs border-t-2 border-b-2 border-gray-800 py-1 mb-1">TRABALHO EFETUADO</div>
            <div className="border border-gray-400 px-3 py-2 text-xs min-h-[40px] whitespace-pre-wrap">{workOrder.description}</div>
          </div>

          {/* Signatures */}
          <div>
            <div className="text-center font-bold text-xs border-t-2 border-b-2 border-gray-800 py-1 mb-3">ASSINATURAS</div>
            <div className="flex gap-6">
              <SignaturePad label="Assinatura do Cliente" onChanged={handleClientSig} />
              <SignaturePad label="Assinatura do Técnico" onChanged={handleTechSig} />
            </div>
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
            className="px-5 py-2 text-sm rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
          >
            Gerar PDF
          </button>
        </div>
      </div>
    </div>
  )
}
