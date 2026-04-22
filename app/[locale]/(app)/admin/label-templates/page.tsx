'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  LABEL_SIZES,
  REPAIR_FIELD_DEFS,
  RECEPTION_FIELD_DEFS,
  PRODUCT_FIELD_DEFS,
  DEFAULT_TEMPLATES,
  printRepairLabel,
  printReceptionLabels,
  printProductLabel,
  type LabelTemplates,
  type LabelTemplate,
  type LabelSizeKey,
} from '@/lib/labelPrint'

type TabKey = 'repair' | 'reception' | 'product'

const TAB_LABELS: Record<TabKey, string> = {
  repair:    'Reparação',
  reception: 'Receção',
  product:   'Produto',
}

const FIELD_DEFS: Record<TabKey, { key: string; label: string }[]> = {
  repair:    REPAIR_FIELD_DEFS,
  reception: RECEPTION_FIELD_DEFS,
  product:   PRODUCT_FIELD_DEFS,
}

function LabelPreview({ template, tab }: { template: LabelTemplate; tab: TabKey }) {
  const sz = LABEL_SIZES[template.size]
  const rotate = template.rotate ?? false

  const allDefs = FIELD_DEFS[tab]
  const enabledDefs = template.fields
    .map(k => allDefs.find(d => d.key === k))
    .filter(Boolean) as { key: string; label: string }[]

  // Portrait content dimensions; when rotated the outer box is landscape (h×w)
  const maxDim = Math.max(sz.w, sz.h)
  const scale = 180 / maxDim
  const portW = sz.w * scale
  const portH = sz.h * scale
  // Outer box: landscape when rotated
  const boxW = rotate ? portH : portW
  const boxH = rotate ? portW : portH

  const fieldNodes = (
    <>
      {enabledDefs.map(d => (
        <div
          key={d.key}
          style={{
            fontSize: d.key === 'barcode'   ? 7 * scale / 2
                    : d.key === 'itemName'  ? 3.5 * scale / 2
                    : d.key === 'reference' ? 4   * scale / 2
                    : 2.5 * scale / 2,
            fontWeight: ['itemName', 'reference'].includes(d.key) ? 700 : 400,
            fontFamily: d.key === 'barcode' ? "'Libre Barcode 128 Text', monospace"
                      : ['partNumber', 'serialNumber'].includes(d.key) ? 'monospace'
                      : 'Arial, sans-serif',
            lineHeight: d.key === 'barcode' ? 1 : 1.3,
            color: d.key === 'barcode' ? '#000' : ['partNumber', 'date'].includes(d.key) ? '#555' : '#000',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {d.key === 'barcode'      ? '|||||||||||||||||||||||||||||'
          : d.key === 'itemName'    ? 'Nome do Artigo'
          : d.key === 'partNumber'  ? 'REF-0000'
          : d.key === 'serialNumber'? 'SN: 000000'
          : d.key === 'reference'   ? 'REP-0001'
          : d.key === 'clientName'  ? 'Cliente Exemplo'
          : d.key === 'date'        ? '01/01/2025'
          : d.key === 'status'      ? 'Em Progresso'
          : d.label}
        </div>
      ))}
      {template.customText && (
        <div style={{
          marginTop: 'auto',
          fontSize: 2 * scale / 2,
          color: '#888',
          borderTop: '0.5px solid #ccc',
          paddingTop: 1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}>
          {template.customText}
        </div>
      )}
    </>
  )

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs text-gray-500 font-medium">Pré-visualização</p>
      <div
        style={{
          width: boxW,
          height: boxH,
          border: '1.5px solid #94a3b8',
          borderRadius: 3,
          background: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
          // clipPath clips painted output after transforms; overflow:hidden clips layout bounds (pre-transform)
          clipPath: 'inset(0 round 3px)',
          position: 'relative',
        }}
      >
        {rotate ? (
          // Rotated 90° CW: portrait div at (left=0, top=portW), rotate around top-left → fills landscape box
          <div style={{
            position: 'absolute',
            top: portW,
            left: 0,
            width: portW,
            height: portH,
            transform: 'rotate(90deg)',
            transformOrigin: 'top left',
            padding: 4 * scale / 3,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}>
            {fieldNodes}
          </div>
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            padding: 4 * scale / 3,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}>
            {fieldNodes}
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400">
        {rotate ? `${sz.h} × ${sz.w} mm (rotado)` : `${sz.w} × ${sz.h} mm`}
      </p>
    </div>
  )
}

function TemplateEditor({
  tab,
  template,
  onChange,
}: {
  tab: TabKey
  template: LabelTemplate
  onChange: (t: LabelTemplate) => void
}) {
  const defs = FIELD_DEFS[tab]
  const enabledSet = new Set(template.fields)

  const toggleField = (key: string) => {
    if (enabledSet.has(key)) {
      onChange({ ...template, fields: template.fields.filter(k => k !== key) })
    } else {
      onChange({ ...template, fields: [...template.fields, key] })
    }
  }

  const moveField = (key: string, dir: -1 | 1) => {
    const idx = template.fields.indexOf(key)
    if (idx < 0) return
    const next = [...template.fields]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    onChange({ ...template, fields: next })
  }

  return (
    <div className="space-y-6">
      {/* Size */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Tamanho da etiqueta</label>
        <select
          className="input text-gray-800 w-full sm:w-auto"
          value={template.size}
          onChange={e => onChange({ ...template, size: e.target.value as LabelSizeKey })}
        >
          {(Object.entries(LABEL_SIZES) as [LabelSizeKey, typeof LABEL_SIZES[LabelSizeKey]][]).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Fields */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Campos visíveis (ordem de impressão)</label>
        <div className="space-y-1">
          {/* Enabled fields — in order */}
          {template.fields.map((key, idx) => {
            const def = defs.find(d => d.key === key)
            if (!def) return null
            return (
              <div key={key} className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <input
                  type="checkbox"
                  checked
                  onChange={() => toggleField(key)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="flex-1 text-sm font-medium text-blue-900">{def.label}</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => moveField(key, -1)}
                    disabled={idx === 0}
                    className="px-1.5 py-0.5 text-xs rounded bg-white border border-blue-200 disabled:opacity-30 hover:bg-blue-100"
                    title="Mover para cima"
                  >▲</button>
                  <button
                    type="button"
                    onClick={() => moveField(key, 1)}
                    disabled={idx === template.fields.length - 1}
                    className="px-1.5 py-0.5 text-xs rounded bg-white border border-blue-200 disabled:opacity-30 hover:bg-blue-100"
                    title="Mover para baixo"
                  >▼</button>
                </div>
              </div>
            )
          })}
          {/* Disabled fields */}
          {defs.filter(d => !enabledSet.has(d.key)).map(def => (
            <div key={def.key} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <input
                type="checkbox"
                checked={false}
                onChange={() => toggleField(def.key)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="flex-1 text-sm text-gray-400">{def.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Custom text */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Texto personalizado <span className="text-gray-400 font-normal">(rodapé opcional)</span>
        </label>
        <input
          type="text"
          className="input text-gray-800 w-full"
          placeholder="Ex: www.empresa.pt · Tel: 21 000 0000"
          value={template.customText}
          onChange={e => onChange({ ...template, customText: e.target.value })}
          maxLength={80}
        />
      </div>

      {/* Rotate */}
      <div>
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={template.rotate ?? false}
            onChange={e => onChange({ ...template, rotate: e.target.checked })}
            className="w-4 h-4 mt-0.5 text-blue-600 rounded"
          />
          <span>
            <span className="block text-sm font-medium text-gray-700 group-hover:text-blue-700">
              Rodar conteúdo 90°
            </span>
            <span className="block text-xs text-gray-400 mt-0.5">
              Ativar se a impressora forçar impressão horizontal (e.g. Brother QL-800 sem opção de orientação)
            </span>
          </span>
        </label>
      </div>
    </div>
  )
}

export default function LabelTemplatesPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string

  const [authorized, setAuthorized] = useState(false)
  const [templates, setTemplates] = useState<LabelTemplates>(DEFAULT_TEMPLATES)
  const [activeTab, setActiveTab] = useState<TabKey>('repair')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const user = JSON.parse(userStr)
      if (user.role !== 'ADMIN') { router.push(`/${locale}/dashboard`); return }
      setAuthorized(true)
    }
  }, [])

  useEffect(() => {
    if (!authorized) return
    const token = localStorage.getItem('token')
    fetch('/api/admin/label-templates', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setTemplates({ ...DEFAULT_TEMPLATES, ...d }))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [authorized])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const token = localStorage.getItem('token')
      await fetch('/api/admin/label-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(templates),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  const handleTestPrint = () => {
    const companyName = ''
    if (activeTab === 'repair') {
      printRepairLabel({
        reference: 'REP-0001',
        itemName: 'Bomba Hidráulica XL',
        partNumber: 'BH-12345',
        serialNumber: 'SN20240001',
        clientName: 'Cliente Exemplo Lda',
        date: new Date().toLocaleDateString('pt-PT'),
        status: 'Em Progresso',
      }, templates.repair, companyName)
    } else if (activeTab === 'reception') {
      printReceptionLabels([{
        itemName: 'Bomba Hidráulica XL',
        partNumber: 'BH-12345',
        serialNumber: 'SN20240001',
        date: new Date().toLocaleDateString('pt-PT'),
      }], templates.reception, companyName)
    } else {
      printProductLabel({
        itemName: 'Bomba Hidráulica XL',
        partNumber: 'BH-12345',
        serialNumber: 'SN20240001',
        barcode: '4006381333931',
      }, templates.product, companyName)
    }
  }

  if (!authorized) return null

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-500">A carregar...</div>
  )

  return (
    <div>
      <div className="px-4 sm:px-0 mb-6">
        <button onClick={() => router.push(`/${locale}/admin`)} className="text-blue-600 hover:text-blue-800 text-sm mb-3 block">
          ← Voltar ao Admin
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Etiquetas</h1>
        <p className="text-gray-600 text-sm">Configura o conteúdo e tamanho de cada tipo de etiqueta (Impressora Brother QL-800)</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(Object.keys(TAB_LABELS) as TabKey[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-600 text-blue-700 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Editor + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-8">
        <div className="card">
          <TemplateEditor
            tab={activeTab}
            template={templates[activeTab]}
            onChange={t => setTemplates(prev => ({ ...prev, [activeTab]: t }))}
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="card flex flex-col items-center py-6">
            <LabelPreview template={templates[activeTab]} tab={activeTab} />
          </div>

          <button
            type="button"
            onClick={handleTestPrint}
            className="btn btn-secondary w-full text-sm"
          >
            Imprimir teste
          </button>
        </div>
      </div>

      {/* Save */}
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary disabled:opacity-60"
        >
          {saving ? 'A guardar...' : 'Guardar configuração'}
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">Guardado!</span>}
      </div>
    </div>
  )
}
