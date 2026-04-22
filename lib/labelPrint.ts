// ─── Types ────────────────────────────────────────────────────────────────────

export const LABEL_SIZES = {
  '62x29':  { label: '62 × 29 mm  (DK-11209)', w: 62, h: 29  },
  '62x62':  { label: '62 × 62 mm  (DK-11207)', w: 62, h: 62  },
  '62x100': { label: '62 × 100 mm (DK-11202)', w: 62, h: 100 },
} as const

export type LabelSizeKey = keyof typeof LABEL_SIZES

export interface LabelTemplate {
  size: LabelSizeKey
  fields: string[]
  customText: string
}

export interface LabelTemplates {
  repair: LabelTemplate
  reception: LabelTemplate
  product: LabelTemplate
}

export const DEFAULT_TEMPLATES: LabelTemplates = {
  repair: {
    size: '62x100',
    fields: ['reference', 'itemName', 'partNumber', 'serialNumber', 'clientName', 'date', 'status'],
    customText: '',
  },
  reception: {
    size: '62x62',
    fields: ['itemName', 'partNumber', 'serialNumber', 'date'],
    customText: '',
  },
  product: {
    size: '62x62',
    fields: ['itemName', 'partNumber', 'serialNumber', 'barcode'],
    customText: '',
  },
}

// Field descriptors per label type
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

function labelCSS(sizeKey: LabelSizeKey): string {
  const { w, h } = LABEL_SIZES[sizeKey]
  const titlePt   = h < 50 ? 10 : 13
  const bodyPt    = h < 50 ?  8 : 10
  const refPt     = h < 50 ? 12 : 16
  const snPt      = h < 50 ?  9 : 12
  const barcodePt = h < 50 ? 28 : 40
  const companyPt = 7
  const gap       = h < 50 ? '2pt' : '3pt'
  const usableH   = `${h - 4}mm`
  return `
  @import url('https://fonts.googleapis.com/css2?family=Libre+Barcode+128+Text&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: ${w}mm ${h}mm; margin: 0; }
  html, body { width: ${w}mm; height: ${h}mm; overflow: hidden; }
  body {
    padding: 2mm;
    font-family: Arial, sans-serif; font-size: ${bodyPt}pt; color: #000;
    print-color-adjust: exact; -webkit-print-color-adjust: exact;
  }
  .label { display: flex; flex-direction: column; min-height: ${usableH}; page-break-after: always; }
  .label:last-child { page-break-after: avoid; }
  .wrap  { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
  .company { font-size: ${companyPt}pt; color: #777; border-bottom: 0.5pt solid #ccc; padding-bottom: 2pt; margin-bottom: ${gap}; }
  .f-title { font-size: ${titlePt}pt; font-weight: 700; line-height: 1.2; word-break: break-word; margin-bottom: ${gap}; }
  .f-ref   { font-size: ${refPt}pt; font-weight: 700; font-family: monospace; letter-spacing: -0.5pt; margin-bottom: ${gap}; }
  .f-sn    { font-size: ${snPt}pt; font-family: monospace; margin-bottom: ${gap}; }
  .f-small { font-size: ${bodyPt}pt; color: #222; margin-bottom: ${gap}; }
  .f-dim   { font-size: ${Math.max(bodyPt - 2, 8)}pt; color: #555; font-style: italic; margin-bottom: ${gap}; }
  .bc      { font-family: 'Libre Barcode 128 Text', monospace; font-size: ${barcodePt}pt; line-height: 1; display: block; margin-bottom: 2pt; }
  .bc-val  { font-size: ${Math.max(bodyPt - 2, 8)}pt; color: #444; margin-bottom: ${gap}; }
  .footer  { font-size: ${companyPt}pt; color: #555; border-top: 0.5pt solid #ccc; padding-top: 2pt; margin-top: auto; }`
}

function rowsHTML(labels: Row[]): string {
  return labels.map(({ value, type }) => {
    if (!value) return ''
    if (type === 'barcode') return `<div class="bc">${esc(value)}</div><div class="bc-val">${esc(value)}</div>`
    const cls = type === 'title' ? 'f-title' : type === 'ref' ? 'f-ref' : type === 'sn' ? 'f-sn' : type === 'dim' ? 'f-dim' : 'f-small'
    return `<div class="${cls}">${esc(value)}</div>`
  }).join('')
}

function buildLabelHTML(sizeKey: LabelSizeKey, labels: Row[], customText: string, companyName: string): string {
  const company = companyName ? `<div class="company">${esc(companyName)}</div>` : ''
  const footer  = customText  ? `<div class="footer">${esc(customText)}</div>`   : ''
  return `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8">
<style>${labelCSS(sizeKey)}</style></head>
<body><div class="label"><div class="wrap">${company}${rowsHTML(labels)}${footer}</div></div></body>
</html>`
}

function buildMultiLabelHTML(sizeKey: LabelSizeKey, allLabels: Row[][], customText: string, companyName: string): string {
  const company = companyName ? `<div class="company">${esc(companyName)}</div>` : ''
  const footer  = customText  ? `<div class="footer">${esc(customText)}</div>`   : ''
  const blocks  = allLabels.map(labels =>
    `<div class="label"><div class="wrap">${company}${rowsHTML(labels)}${footer}</div></div>`
  ).join('\n')
  return `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8">
<style>${labelCSS(sizeKey)}</style></head>
<body>${blocks}</body>
</html>`
}

const MM_TO_PX = 3.7795275591

function openPrint(html: string, sizeKey: LabelSizeKey) {
  const { w, h } = LABEL_SIZES[sizeKey]
  const pw = Math.ceil(w * MM_TO_PX)
  const ph = Math.ceil(h * MM_TO_PX) + 80
  const win = window.open('', '_blank', `width=${pw},height=${ph},left=80,top=80,menubar=no,toolbar=no,scrollbars=no`)
  if (!win) { alert('Por favor permita popups para imprimir etiquetas.'); return }
  win.document.write(html)
  win.document.close()
  setTimeout(() => { win.focus(); win.print() }, 600)
}

// ─── Field-value builders ──────────────────────────────────────────────────────

type Row = { key: string; value: string; type?: 'title' | 'ref' | 'small' | 'sn' | 'barcode' | 'dim' }

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
  openPrint(buildLabelHTML(template.size, repairRows(template.fields, data), template.customText, companyName), template.size)
}

export function printReceptionLabels(items: ReceptionLabelData[], template: LabelTemplate, companyName = ''): void {
  openPrint(buildMultiLabelHTML(template.size, items.map(d => receptionRows(template.fields, d)), template.customText, companyName), template.size)
}

export function printProductLabel(data: ProductLabelData, template: LabelTemplate, companyName = ''): void {
  openPrint(buildLabelHTML(template.size, productRows(template.fields, data), template.customText, companyName), template.size)
}
