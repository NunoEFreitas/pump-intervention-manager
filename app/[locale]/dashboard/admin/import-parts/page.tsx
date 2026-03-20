'use client'

import { useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import * as XLSX from 'xlsx'

interface ParsedRow {
  itemName: string
  value: number
  mainWarehouse: number
}

export default function AdminImportPartsPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const tCommon = useTranslations('common')

  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState('')
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null)

  const CHUNK_SIZE = 500

  const handleFile = (file: File) => {
    setParseError('')
    setRows([])
    setResult(null)
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' })

        if (raw.length === 0) { setParseError('Ficheiro sem dados.'); return }

        // Detect columns case-insensitively
        const firstRow = raw[0]
        const keys = Object.keys(firstRow)
        const find = (candidates: string[]) =>
          keys.find(k => candidates.some(c => k.toLowerCase().includes(c.toLowerCase()))) ?? null

        const descCol = find(['descrição', 'descricao', 'descrição', 'desc', 'name', 'nome'])
        const priceCol = find(['preço 1', 'preco 1', 'preço1', 'preco1', 'price', 'preco', 'preço', 'valor', 'value'])
        const stockCol = find(['stock', 'qty', 'quantidade', 'quant'])

        if (!descCol) { setParseError('Coluna "Descrição" não encontrada no ficheiro.'); return }

        const parsed: ParsedRow[] = raw
          .map(r => ({
            itemName: String(r[descCol] ?? '').trim(),
            value: parseFloat(String(r[priceCol ?? ''] ?? '0').replace(',', '.')) || 0,
            mainWarehouse: Math.max(0, Math.round(parseFloat(String(r[stockCol ?? ''] ?? '0').replace(',', '.')) || 0)),
          }))
          .filter(r => r.itemName !== '')

        setRows(parsed)
      } catch (err) {
        setParseError('Erro ao processar ficheiro. Certifique-se que é um ficheiro XLS ou XLSX válido.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleImport = async () => {
    if (rows.length === 0) return
    setImporting(true)
    setProgress(0)
    setResult(null)
    setParseError('')
    try {
      const token = localStorage.getItem('token')
      let totalCreated = 0
      let totalSkipped = 0

      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE)
        const res = await fetch('/api/admin/import-parts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ rows: chunk }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        totalCreated += data.created
        totalSkipped += data.skipped
        setProgress(Math.round(((i + chunk.length) / rows.length) * 100))
      }

      setResult({ created: totalCreated, skipped: totalSkipped })
      setRows([])
      setFileName('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (err: any) {
      setParseError(err.message || 'Erro ao importar.')
    } finally {
      setImporting(false)
      setProgress(0)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push(`/${locale}/dashboard/admin`)} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Importar Artigos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Importar artigos de armazém a partir de ficheiro XLS/XLSX</p>
        </div>
      </div>

      <div className="card max-w-3xl space-y-6">

        {/* Upload area */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Ficheiro XLS / XLSX</label>
          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          >
            <svg className="w-10 h-10 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            {fileName ? (
              <p className="text-sm font-medium text-blue-700">{fileName}</p>
            ) : (
              <>
                <p className="text-sm text-gray-600">Arrastar ficheiro aqui ou <span className="text-blue-600 underline">clicar para selecionar</span></p>
                <p className="text-xs text-gray-400 mt-1">.xls, .xlsx</p>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".xls,.xlsx" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </div>

        {/* Column mapping info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800 space-y-1">
          <p className="font-semibold">Mapeamento de colunas:</p>
          <ul className="list-disc list-inside space-y-0.5 text-blue-700">
            <li><span className="font-medium">Descrição</span> → Nome do artigo</li>
            <li><span className="font-medium">Preço 1</span> → ignorado (preço definido a 0)</li>
            <li><span className="font-medium">Stock</span> → Stock inicial (negativos ficam a 0)</li>
            <li>Tipo e marca serão definidos como <span className="font-medium">Importado</span></li>
            <li>Artigos sem rastreio de número de série</li>
          </ul>
        </div>

        {/* Parse error */}
        {parseError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">{parseError}</div>
        )}

        {/* Success result */}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
            <p className="font-semibold">Importação concluída</p>
            <p>{result.created} artigos criados{result.skipped > 0 ? `, ${result.skipped} ignorados (sem nome)` : ''}.</p>
          </div>
        )}

        {/* Preview table */}
        {rows.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">{rows.length} artigos encontrados — pré-visualização</p>
              <button onClick={() => { setRows([]); setFileName(''); if (fileRef.current) fileRef.current.value = '' }}
                className="text-xs text-gray-400 hover:text-gray-600">Limpar</button>
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-auto max-h-80">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Nome</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((r, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-2 text-gray-900">{r.itemName}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{r.mainWarehouse}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {importing ? (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>A importar… {Math.round(progress * rows.length / 100)} de {rows.length} artigos</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div className="bg-blue-600 h-3 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
            ) : (
              <div className="flex gap-3 mt-4">
                <button onClick={handleImport} className="btn btn-primary">
                  Importar {rows.length.toLocaleString('pt-PT')} artigos
                </button>
                <button onClick={() => { setRows([]); setFileName(''); if (fileRef.current) fileRef.current.value = '' }}
                  className="btn btn-secondary">{tCommon('cancel')}</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
