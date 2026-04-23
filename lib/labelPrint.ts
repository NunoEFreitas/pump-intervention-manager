// Fixed label size: 62mm × 29mm (set printer to this size)

export interface LabelTemplate {
  fields: string[]
}

export interface LabelTemplates {
  repair: LabelTemplate
  reception: LabelTemplate
  product: LabelTemplate
}

export const DEFAULT_TEMPLATES: LabelTemplates = {
  repair:    { fields: ['reference', 'itemName', 'partNumber', 'serialNumber', 'clientName', 'date', 'status'] },
  reception: { fields: ['itemName', 'partNumber', 'serialNumber', 'date'] },
  product:   { fields: ['itemName', 'partNumber', 'serialNumber', 'barcode'] },
}

export const REPAIR_FIELD_DEFS = [
  { key: 'reference',    label: 'Referência' },
  { key: 'itemName',     label: 'Artigo' },
  { key: 'partNumber',   label: 'Nº Peça' },
  { key: 'serialNumber', label: 'Nº Série' },
  { key: 'clientName',   label: 'Cliente' },
  { key: 'date',         label: 'Data' },
  { key: 'status',       label: 'Estado' },
]

export const RECEPTION_FIELD_DEFS = [
  { key: 'itemName',     label: 'Artigo' },
  { key: 'partNumber',   label: 'Nº Peça' },
  { key: 'serialNumber', label: 'Nº Série' },
  { key: 'date',         label: 'Data Receção' },
]

export const PRODUCT_FIELD_DEFS = [
  { key: 'itemName',     label: 'Artigo' },
  { key: 'partNumber',   label: 'Nº Peça' },
  { key: 'serialNumber', label: 'Nº Série' },
  { key: 'barcode',      label: 'Código de Barras (EAN13)' },
]

// ─── Data interfaces ───────────────────────────────────────────────────────────

export interface RepairLabelData {
  reference: string | null
  itemName: string
  partNumber: string
  serialNumber: string | null
  clientName: string | null
  date: string
  status: string
}

export interface ReceptionLabelData {
  itemName: string
  partNumber: string
  serialNumber: string | null
  date: string
}

export interface ProductLabelData {
  itemName: string
  partNumber: string
  serialNumber: string | null
  barcode: string | null
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function esc(s?: string | null): string {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function labelCSS(): string {
  return `
  @import url('https://fonts.googleapis.com/css2?family=Libre+Barcode+128+Text&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: 62mm 29mm; margin: 0; }
  html, body { width: 62mm; height: 29mm; overflow: hidden; }
  body { padding: 2mm 3mm; font-family: Arial, sans-serif; font-size: 7pt; color: #000;
         print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .label { display: flex; flex-direction: column; min-height: 25mm; page-break-after: always; }
  .label:last-child { page-break-after: avoid; }
  .company { font-size: 6pt; color: #777; border-bottom: 0.3pt solid #ccc; padding-bottom: 1pt; margin-bottom: 2pt; }
  .f-title { font-size: 9pt; font-weight: 700; line-height: 1.2; word-break: break-word; margin-bottom: 1pt; }
  .f-ref   { font-size: 11pt; font-weight: 700; font-family: monospace; letter-spacing: -0.5pt; margin-bottom: 1pt; }
  .f-sn    { font-size: 8pt; font-family: monospace; margin-bottom: 1pt; }
  .f-small { font-size: 7pt; color: #222; margin-bottom: 1pt; }
  .f-dim   { font-size: 6pt; color: #555; font-style: italic; margin-bottom: 1pt; }
  .bc      { font-family: 'Libre Barcode 128 Text', monospace; font-size: 26pt; line-height: 1; display: block; margin-bottom: 1pt; }
  .bc-val  { font-size: 6pt; color: #444; }`
}

type Row = { key: string; value: string; type?: 'title' | 'ref' | 'small' | 'sn' | 'barcode' | 'dim' }

function rowsHTML(labels: Row[]): string {
  return labels.map(({ value, type }) => {
    if (!value) return ''
    if (type === 'barcode') return `<div class="bc">${esc(value)}</div><div class="bc-val">${esc(value)}</div>`
    const cls = type === 'title' ? 'f-title' : type === 'ref' ? 'f-ref' : type === 'sn' ? 'f-sn' : type === 'dim' ? 'f-dim' : 'f-small'
    return `<div class="${cls}">${esc(value)}</div>`
  }).join('')
}

function buildHTML(allLabels: Row[][], companyName: string): string {
  const blocks = allLabels.map(labels => {
    const company = companyName ? `<div class="company">${esc(companyName)}</div>` : ''
    return `<div class="label">${company}${rowsHTML(labels)}</div>`
  }).join('\n')
  return `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8">
<style>${labelCSS()}</style></head>
<body>${blocks}</body></html>`
}

function openPrint(html: string) {
  const win = window.open('', '_blank', 'width=240,height=115,left=80,top=80,menubar=no,toolbar=no,scrollbars=no')
  if (!win) { alert('Por favor permita popups para imprimir etiquetas.'); return }
  win.document.write(html)
  win.document.close()
  setTimeout(() => { win.focus(); win.print() }, 600)
}

// ─── Field-value builders ──────────────────────────────────────────────────────

function row(key: string, value: string | null | undefined, type: Row['type']): Row[] {
  return value ? [{ key, value, type }] : []
}

function repairRows(fields: string[], data: RepairLabelData): Row[] {
  return fields.flatMap(key => {
    switch (key) {
      case 'reference':    return row(key, data.reference,    'ref')
      case 'itemName':     return row(key, data.itemName,     'title')
      case 'partNumber':   return row(key, data.partNumber,   'dim')
      case 'serialNumber': return row(key, data.serialNumber ? `SN: ${data.serialNumber}` : null, 'sn')
      case 'clientName':   return row(key, data.clientName,   'small')
      case 'date':         return row(key, data.date,         'small')
      case 'status':       return row(key, data.status,       'small')
      default:             return []
    }
  })
}

function receptionRows(fields: string[], data: ReceptionLabelData): Row[] {
  return fields.flatMap(key => {
    switch (key) {
      case 'itemName':     return row(key, data.itemName,                                         'title')
      case 'partNumber':   return row(key, data.partNumber,                                       'dim')
      case 'serialNumber': return row(key, data.serialNumber ? `SN: ${data.serialNumber}` : null, 'sn')
      case 'date':         return row(key, `Receção: ${data.date}`,                               'small')
      default:             return []
    }
  })
}

function productRows(fields: string[], data: ProductLabelData): Row[] {
  return fields.flatMap(key => {
    switch (key) {
      case 'itemName':     return row(key, data.itemName,                                         'title')
      case 'partNumber':   return row(key, data.partNumber,                                       'dim')
      case 'serialNumber': return row(key, data.serialNumber ? `SN: ${data.serialNumber}` : null, 'sn')
      case 'barcode':      return row(key, data.barcode,                                          'barcode')
      default:             return []
    }
  })
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function printRepairLabel(data: RepairLabelData, template: LabelTemplate, companyName = ''): void {
  openPrint(buildHTML([repairRows(template.fields, data)], companyName))
}

export function printReceptionLabels(items: ReceptionLabelData[], template: LabelTemplate, companyName = ''): void {
  openPrint(buildHTML(items.map(d => receptionRows(template.fields, d)), companyName))
}

export function printProductLabel(data: ProductLabelData, template: LabelTemplate, companyName = ''): void {
  openPrint(buildHTML([productRows(template.fields, data)], companyName))
}
