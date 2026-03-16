'use client'

import { useState } from 'react'

export interface OVMData {
  ensaios: [
    { '20dm3': [string, string, string, string]; '5dm3': [string, string, string, string]; '2dm3': [string, string, string, string] },
    { '20dm3': [string, string, string, string]; '5dm3': [string, string, string, string]; '2dm3': [string, string, string, string] },
    { '20dm3': [string, string, string, string]; '5dm3': [string, string, string, string]; '2dm3': [string, string, string, string] }
  ]
  medidaPadrao: { p1_5: string; p2_5: string; p1_20: string; p2_20: string; p3_20: string }
  reparacao: boolean
  substituicao: boolean
  despachoModelo: string
}

export function emptyOVMData(): OVMData {
  const emptyRow = (): [string, string, string, string] => ['', '', '', '']
  const emptyEnsaio = () => ({ '20dm3': emptyRow(), '5dm3': emptyRow(), '2dm3': emptyRow() })
  return {
    ensaios: [emptyEnsaio(), emptyEnsaio(), emptyEnsaio()],
    medidaPadrao: { p1_5: '', p2_5: '', p1_20: '', p2_20: '', p3_20: '' },
    reparacao: false,
    substituicao: false,
    despachoModelo: '',
  }
}

interface OVMFormProps {
  initial?: OVMData
  onSave: (data: OVMData) => Promise<void>
  onCancel: () => void
  onPrint?: (data: OVMData) => void
  saving?: boolean
}

const ROWS = ['20dm3', '5dm3', '2dm3'] as const
const ENSAIO_LABELS = ['1º ensaio', '2º ensaio', '3º ensaio']

function cell(className?: string) {
  return `border border-gray-400 px-1 py-0.5 ${className ?? ''}`
}

export default function OVMForm({ initial, onSave, onCancel, onPrint, saving }: OVMFormProps) {
  const [data, setData] = useState<OVMData>(initial ?? emptyOVMData())

  const setCell = (ensaioIdx: number, row: typeof ROWS[number], colIdx: number, value: string) => {
    setData(prev => {
      const next = structuredClone(prev)
      next.ensaios[ensaioIdx][row][colIdx] = value
      return next
    })
  }

  const setPadrao = (key: keyof OVMData['medidaPadrao'], value: string) => {
    setData(prev => ({ ...prev, medidaPadrao: { ...prev.medidaPadrao, [key]: value } }))
  }

  const inputCls = 'w-full text-xs text-center border-0 bg-transparent outline-none focus:bg-blue-50 p-0'

  return (
    <div className="space-y-4">
      {/* Document header */}
      <div className="text-center text-sm space-y-0.5 text-gray-700">
        <div className="font-semibold">boletin de intervenção CMAC</div>
        <div>equipamento do cliente</div>
        <div>Registo de erros dos ensaios efetuados</div>
      </div>

      {/* Main grid: left tables + right panels */}
      <div className="flex gap-6 items-start">
        {/* Left: 3 ensaio tables — inlined to avoid sub-component remount on each keystroke */}
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
                  {[0, 1, 2, 3].map(c => (
                    <td key={c} className={`${cell('text-center')} w-16`}>combustível</td>
                  ))}
                </tr>
                {ROWS.map(row => (
                  <tr key={row}>
                    <td className={`${cell('font-medium')} w-16`}>{row}</td>
                    {([0, 1, 2, 3] as const).map(c => (
                      <td key={c} className={cell('w-16')}>
                        <input
                          className={inputCls}
                          value={data.ensaios[idx][row][c]}
                          onChange={e => setCell(idx, row, c, e.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>

        {/* Right: side panels */}
        <div className="flex flex-col gap-4 w-52 shrink-0">
          {/* Medida Padrão */}
          <table className="border-collapse text-xs w-full">
            <tbody>
              <tr>
                <td className={`${cell('text-center font-semibold')} bg-gray-50`} colSpan={4}>Medida Padrão</td>
              </tr>
              <tr>
                <td className={cell('font-medium text-xs')}>Padão 1/5</td>
                <td className={cell('w-14')}>
                  <input className={inputCls} value={data.medidaPadrao.p1_5} onChange={e => setPadrao('p1_5', e.target.value)} />
                </td>
                <td className={cell('font-medium text-xs')}>Padão 1/20</td>
                <td className={cell('w-14')}>
                  <input className={inputCls} value={data.medidaPadrao.p1_20} onChange={e => setPadrao('p1_20', e.target.value)} />
                </td>
              </tr>
              <tr>
                <td className={cell('font-medium text-xs')}>Padão 2/5</td>
                <td className={cell('w-14')}>
                  <input className={inputCls} value={data.medidaPadrao.p2_5} onChange={e => setPadrao('p2_5', e.target.value)} />
                </td>
                <td className={cell('font-medium text-xs')}>Padão 2/20</td>
                <td className={cell('w-14')}>
                  <input className={inputCls} value={data.medidaPadrao.p2_20} onChange={e => setPadrao('p2_20', e.target.value)} />
                </td>
              </tr>
              <tr>
                <td className={cell()}></td>
                <td className={cell()}></td>
                <td className={cell('font-medium text-xs')}>Padão 3/20</td>
                <td className={cell('w-14')}>
                  <input className={inputCls} value={data.medidaPadrao.p3_20} onChange={e => setPadrao('p3_20', e.target.value)} />
                </td>
              </tr>
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
                    onChange={e => setData(prev => ({ ...prev, reparacao: e.target.checked }))}
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
                    onChange={e => setData(prev => ({ ...prev, substituicao: e.target.checked }))}
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
