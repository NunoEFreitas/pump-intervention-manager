'use client'

import { useState, useEffect } from 'react'

export interface OVMData {
  equipmentId: string
  fuelColumns: [string, string, string, string]
  ensaios: [
    { '20dm3': [string, string, string, string]; '5dm3': [string, string, string, string]; '2dm3': [string, string, string, string] },
    { '20dm3': [string, string, string, string]; '5dm3': [string, string, string, string]; '2dm3': [string, string, string, string] },
    { '20dm3': [string, string, string, string]; '5dm3': [string, string, string, string]; '2dm3': [string, string, string, string] }
  ]
  medidaPadraoDiv5: string  // 'p1_5' | 'p2_5' | ''
  medidaPadraoDiv20: string // 'p1_20' | 'p2_20' | 'p3_20' | ''
  reparacao: boolean
  substituicao: boolean
  despachoModelo: string
}

export function emptyOVMData(): OVMData {
  const emptyRow = (): [string, string, string, string] => ['', '', '', '']
  const emptyEnsaio = () => ({ '20dm3': emptyRow(), '5dm3': emptyRow(), '2dm3': emptyRow() })
  return {
    equipmentId: '',
    fuelColumns: ['', '', '', ''],
    ensaios: [emptyEnsaio(), emptyEnsaio(), emptyEnsaio()],
    medidaPadraoDiv5: '',
    medidaPadraoDiv20: '',
    reparacao: false,
    substituicao: false,
    despachoModelo: '',
  }
}

// Migrate legacy OVMData loaded from DB that may have old shapes
export function migrateOVMData(raw: unknown): OVMData {
  const base = emptyOVMData()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Record<string, unknown>
  return {
    equipmentId: typeof r.equipmentId === 'string' ? r.equipmentId : '',
    fuelColumns: Array.isArray(r.fuelColumns) && r.fuelColumns.length === 4
      ? r.fuelColumns as [string, string, string, string]
      : ['', '', '', ''],
    ensaios: Array.isArray(r.ensaios) && r.ensaios.length === 3
      ? r.ensaios as OVMData['ensaios']
      : base.ensaios,
    medidaPadraoDiv5: typeof r.medidaPadraoDiv5 === 'string' ? r.medidaPadraoDiv5
      : typeof r.medidaPadrao === 'string' && ['p1_5', 'p2_5'].includes(r.medidaPadrao) ? r.medidaPadrao : '',
    medidaPadraoDiv20: typeof r.medidaPadraoDiv20 === 'string' ? r.medidaPadraoDiv20
      : typeof r.medidaPadrao === 'string' && ['p1_20', 'p2_20', 'p3_20'].includes(r.medidaPadrao) ? r.medidaPadrao : '',
    reparacao: typeof r.reparacao === 'boolean' ? r.reparacao : false,
    substituicao: typeof r.substituicao === 'boolean' ? r.substituicao : false,
    despachoModelo: typeof r.despachoModelo === 'string' ? r.despachoModelo : '',
  }
}

interface FuelType { id: string; translations: { en: string; pt: string; es: string } }

interface OVMFormProps {
  initial?: OVMData
  onSave: (data: OVMData) => Promise<void>
  onCancel: () => void
  onPrint?: (data: OVMData) => void
  saving?: boolean
  equipment?: { id: string; model: string; serialNumber: string | null; equipmentType: { name: string }; brand: { name: string } }[]
}

const ROWS = ['20dm3', '5dm3', '2dm3'] as const
const ENSAIO_LABELS = ['1º ensaio', '2º ensaio', '3º ensaio']
const PADRAO_DIV5:  { key: string; label: string }[] = [
  { key: 'p1_5', label: 'Padrão 1/5' },
  { key: 'p2_5', label: 'Padrão 2/5' },
]
const PADRAO_DIV20: { key: string; label: string }[] = [
  { key: 'p1_20', label: 'Padrão 1/20' },
  { key: 'p2_20', label: 'Padrão 2/20' },
  { key: 'p3_20', label: 'Padrão 3/20' },
]

function cell(className?: string) {
  return `border border-gray-400 px-1 py-0.5 ${className ?? ''}`
}

export default function OVMForm({ initial, onSave, onCancel, onPrint, saving, equipment = [] }: OVMFormProps) {
  const [data, setData] = useState<OVMData>(initial ?? emptyOVMData())
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([])

  useEffect(() => {
    const token = localStorage.getItem('token')
    fetch('/api/admin/fuel-types', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(setFuelTypes)
      .catch(() => {})
  }, [])

  const stepCell = (ensaioIdx: number, row: typeof ROWS[number], colIdx: number, delta: number) => {
    setData(prev => {
      const next = structuredClone(prev)
      const cur = next.ensaios[ensaioIdx][row][colIdx]
      const num = cur === '' ? 0 : parseFloat(cur) || 0
      const stepped = Math.round((num + delta) * 10) / 10
      if (stepped < -0.5 || stepped > 0.5) return prev
      next.ensaios[ensaioIdx][row][colIdx] = stepped.toFixed(1)
      return next
    })
  }

  const setFuelColumn = (colIdx: number, label: string) => {
    setData(prev => {
      const cols = [...prev.fuelColumns] as [string, string, string, string]
      cols[colIdx] = label
      return { ...prev, fuelColumns: cols }
    })
  }

  const fuelSelectCls = 'w-full text-xs border-0 bg-transparent outline-none focus:bg-blue-50 p-0 cursor-pointer'

  return (
    <div className="space-y-4">
      {/* Document header */}
      <div className="text-center text-sm space-y-0.5 text-gray-700">
        <div className="font-semibold">boletin de intervenção CMAC</div>
        <div className="flex items-center justify-center gap-2">
          <span>equipamento do cliente:</span>
          <select
            className="border border-gray-300 rounded px-2 py-0.5 text-xs text-gray-800 bg-white"
            value={data.equipmentId}
            onChange={e => setData(prev => ({ ...prev, equipmentId: e.target.value }))}
          >
            <option value="">— selecionar —</option>
            {equipment.map(eq => (
              <option key={eq.id} value={eq.id}>
                {eq.equipmentType.name} — {eq.brand.name} {eq.model}{eq.serialNumber ? ` (${eq.serialNumber})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>Registo de erros dos ensaios efetuados</div>
      </div>

      {/* Main grid */}
      <div className="flex gap-6 items-start">
        {/* Left: 3 ensaio tables */}
        <div className="flex-1 min-w-0">
          {([0, 1, 2] as const).map(idx => (
            <table key={idx} className="border-collapse text-xs w-full mb-3">
              <tbody>
                <tr>
                  <td className={`${cell('font-semibold text-center')} w-16`}>{ENSAIO_LABELS[idx]}</td>
                  <td className={`${cell('text-center')} font-medium`} colSpan={4}>medida</td>
                </tr>
                <tr>
                  <td className={cell()}></td>
                  {([0, 1, 2, 3] as const).map(c => (
                    <td key={c} className={`${cell()} w-20`}>
                      {/* Only render selects in first ensaio; others show the same label read-only */}
                      {idx === 0 ? (
                        <select
                          className={fuelSelectCls}
                          value={fuelTypes.find(ft => (ft.translations.pt || ft.translations.en) === data.fuelColumns[c])?.id ?? ''}
                          onChange={e => {
                            const ft = fuelTypes.find(f => f.id === e.target.value)
                            setFuelColumn(c, ft ? (ft.translations.pt || ft.translations.en || '') : '')
                          }}
                        >
                          <option value="">—</option>
                          {fuelTypes.map(ft => (
                            <option key={ft.id} value={ft.id}>
                              {ft.translations.pt || ft.translations.en || ft.id}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-center block">{data.fuelColumns[c] || '—'}</span>
                      )}
                    </td>
                  ))}
                </tr>
                {ROWS.map(row => (
                  <tr key={row}>
                    <td className={`${cell('font-medium')} w-16`}>{row}</td>
                    {([0, 1, 2, 3] as const).map(c => {
                      const val = data.ensaios[idx][row][c]
                      const num = val === '' ? 0 : parseFloat(val) || 0
                      return (
                        <td key={c} className={cell('w-20')}>
                          <div className="flex items-center justify-center gap-0.5">
                            <button
                              type="button"
                              className="text-gray-500 hover:text-gray-800 px-0.5 leading-none disabled:opacity-30"
                              disabled={num <= -0.5}
                              onMouseDown={e => { e.preventDefault(); stepCell(idx, row, c, -0.1) }}
                            >−</button>
                            <span className="text-xs w-8 text-center tabular-nums">{val === '' ? '0.0' : val}</span>
                            <button
                              type="button"
                              className="text-gray-500 hover:text-gray-800 px-0.5 leading-none disabled:opacity-30"
                              disabled={num >= 0.5}
                              onMouseDown={e => { e.preventDefault(); stepCell(idx, row, c, 0.1) }}
                            >+</button>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>

        {/* Right: side panels */}
        <div className="flex flex-col gap-4 w-52 shrink-0">
          {/* Medida Padrão — one from /5 group, one from /20 group */}
          <table className="border-collapse text-xs w-full">
            <tbody>
              <tr>
                <td className={`${cell('text-center font-semibold')} bg-gray-50`} colSpan={2}>Medida Padrão</td>
              </tr>
              {PADRAO_DIV5.map(opt => (
                <tr key={opt.key}>
                  <td className={cell('font-medium text-xs')}>{opt.label}</td>
                  <td className={cell('w-8 text-center')}>
                    <input
                      type="checkbox"
                      checked={data.medidaPadraoDiv5 === opt.key}
                      onChange={() => setData(prev => ({
                        ...prev,
                        medidaPadraoDiv5: prev.medidaPadraoDiv5 === opt.key ? '' : opt.key,
                      }))}
                      className="cursor-pointer"
                    />
                  </td>
                </tr>
              ))}
              {PADRAO_DIV20.map(opt => (
                <tr key={opt.key}>
                  <td className={cell('font-medium text-xs')}>{opt.label}</td>
                  <td className={cell('w-8 text-center')}>
                    <input
                      type="checkbox"
                      checked={data.medidaPadraoDiv20 === opt.key}
                      onChange={() => setData(prev => ({
                        ...prev,
                        medidaPadraoDiv20: prev.medidaPadraoDiv20 === opt.key ? '' : opt.key,
                      }))}
                      className="cursor-pointer"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Tipo Intervenção */}
          <table className="border-collapse text-xs w-full">
            <tbody>
              <tr>
                <td className={`${cell('text-center font-semibold')} bg-gray-50`} colSpan={2}>Tipo Intervenção</td>
              </tr>
              <tr>
                <td className={cell('font-medium')}>Reparação</td>
                <td className={cell('w-8 text-center')}>
                  <input
                    type="checkbox"
                    checked={data.reparacao}
                    onChange={e => setData(prev => ({ ...prev, reparacao: e.target.checked, substituicao: e.target.checked ? false : prev.substituicao }))}
                    className="cursor-pointer"
                  />
                </td>
              </tr>
              <tr>
                <td className={cell('font-medium')}>Substituição</td>
                <td className={cell('w-8 text-center')}>
                  <input
                    type="checkbox"
                    checked={data.substituicao}
                    onChange={e => setData(prev => ({ ...prev, substituicao: e.target.checked, reparacao: e.target.checked ? false : prev.reparacao }))}
                    className="cursor-pointer"
                  />
                </td>
              </tr>
            </tbody>
          </table>

          {/* Despacho */}
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-1">Despacho de Aprovação Modelo</div>
            <textarea
              className="w-full border border-gray-400 rounded text-xs p-1 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
              rows={3}
              value={data.despachoModelo}
              onChange={e => setData(prev => ({ ...prev, despachoModelo: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t">
        <button
          onClick={() => onSave(data)}
          disabled={saving}
          className="btn btn-primary text-sm px-4 py-1.5"
        >
          {saving ? 'A guardar…' : 'Guardar OVM'}
        </button>
        {onPrint && (
          <button
            onClick={() => onPrint(data)}
            className="btn btn-secondary text-sm px-4 py-1.5"
          >
            Imprimir
          </button>
        )}
        <button
          onClick={onCancel}
          className="btn btn-secondary text-sm px-4 py-1.5"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
