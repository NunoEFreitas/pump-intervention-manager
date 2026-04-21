// ─── Types ────────────────────────────────────────────────────────────────────

export const LABEL_SIZES = {
  '62x29':  { label: '62 × 29 mm  (DK-11209)',  w: 62, h: 29  },
  '62x62':  { label: '62 × 62 mm  (DK-11207)',  w: 62, h: 62  },
  '62x100': { label: '62 × 100 mm (DK-11202)',  w: 62, h: 100 },
  '29x90':  { label: '29 × 90 mm  (DK-11201)',  w: 29, h: 90  },
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
  barcode: string | null  // ean13
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function esc(s?: string | null): string {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function sizeStyle(key: LabelSizeKey) {
  const s = LABEL_SIZES[key]
  const narrow = s.w < 40
  return {
    pageSize: `${s.w}mm ${s.h}mm`,
    titlePt:  narrow ? 8  : 11,
    bodyPt:   narrow ? 6  : 8,
    refPt:    narrow ? 9  : 13,
    snPt:     narrow ? 8  : 10,
    barcodePt: narrow ? 22 : (s.h < 50 ? 26 : 36),
    companyPt: narrow ? 5  : 6,
    margin:   '1.5mm',
  }
}

function buildLabelHTML(
  sizeKey: LabelSizeKey,
  labels: Array<{ key: string; value: string; type?: 'title' | 'ref' | 'small' | 'sn' | 'barcode' | 'dim' }>,
  customText: string,
  companyName: string
): string {
  const sz = sizeStyle(sizeKey)
  const rows = labels.map(({ key, value, type }) => {
    if (!value) return ''
    const t = type ?? 'small'
    if (t === 'barcode') {
      return `
        <div class="bc">${esc(value)}</div>
        <div class="bc-val">${esc(value)}</div>`
    }
    const cls = t === 'title' ? 'f-title'
              : t === 'ref'   ? 'f-ref'
              : t === 'sn'    ? 'f-sn'
              : t === 'dim'   ? 'f-dim'
              : 'f-small'
    return `<div class="${cls}">${esc(value)}</div>`
  }).join('')

  const footer = customText
    ? `<div class="footer">${esc(customText)}</div>`
    : ''
  const company = companyName
    ? `<div class="company">${esc(companyName)}</div>`
    : ''

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Libre+Barcode+128+Text&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: ${sz.pageSize}; margin: ${sz.margin}; }
  html, body { width: 100%; font-family: Arial, sans-serif; font-size: ${sz.bodyPt}pt; color: #000; }
  .wrap { display: flex; flex-direction: column; width: 100%; overflow: hidden; }
  .company { font-size: ${sz.companyPt}pt; color: #777; border-bottom: 0.3pt solid #ccc; padding-bottom: 1pt; margin-bottom: 2pt; }
  .f-title { font-size: ${sz.titlePt}pt; font-weight: 700; line-height: 1.2; word-break: break-word; margin-bottom: 1pt; }
  .f-ref   { font-size: ${sz.refPt}pt; font-weight: 700; font-family: monospace; letter-spacing: -0.3pt; margin-bottom: 1pt; }
  .f-sn    { font-size: ${sz.snPt}pt; font-family: monospace; margin-bottom: 1pt; }
  .f-small { font-size: ${sz.bodyPt}pt; color: #333; margin-bottom: 0.5pt; }
  .f-dim   { font-size: ${sz.bodyPt - 1}pt; color: #555; font-style: italic; margin-bottom: 0.5pt; }
  .bc      { font-family: 'Libre Barcode 128 Text', monospace; font-size: ${sz.barcodePt}pt; line-height: 1; display: block; }
  .bc-val  { font-size: ${sz.bodyPt - 1}pt; color: #444; margin-top: -1pt; margin-bottom: 1pt; }
  .footer  { font-size: ${sz.companyPt}pt; color: #555; border-top: 0.3pt solid #ccc; padding-top: 1pt; margin-top: auto; }
  .label   { page-break-after: always; display: flex; flex-direction: column; }
  .label:last-child { page-break-after: avoid; }
</style>
</head>
<body>
<div class="label">
  <div class="wrap">
    ${company}
    ${rows}
    ${footer}
  </div>
</div>
</body>
</html>`
}

function buildMultiLabelHTML(
  sizeKey: LabelSizeKey,
  allLabels: Array<Array<{ key: string; value: string; type?: 'title' | 'ref' | 'small' | 'sn' | 'barcode' | 'dim' }>>,
  customText: string,
  companyName: string
): string {
  const sz = sizeStyle(sizeKey)

  const labelBlocks = allLabels.map(labels => {
    const rows = labels.map(({ value, type }) => {
      if (!value) return ''
      const t = type ?? 'small'
      if (t === 'barcode') {
        return `<div class="bc">${esc(value)}</div><div class="bc-val">${esc(value)}</div>`
      }
      const cls = t === 'title' ? 'f-title' : t === 'ref' ? 'f-ref' : t === 'sn' ? 'f-sn' : t === 'dim' ? 'f-dim' : 'f-small'
      return `<div class="${cls}">${esc(value)}</div>`
    }).join('')

    const company = companyName ? `<div class="company">${esc(companyName)}</div>` : ''
    const footer  = customText  ? `<div class="footer">${esc(customText)}</div>`  : ''
    return `<div class="label"><div class="wrap">${company}${rows}${footer}</div></div>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Libre+Barcode+128+Text&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: ${sz.pageSize}; margin: ${sz.margin}; }
  html, body { width: 100%; font-family: Arial, sans-serif; font-size: ${sz.bodyPt}pt; color: #000; }
  .wrap { display: flex; flex-direction: column; width: 100%; overflow: hidden; }
  .company { font-size: ${sz.companyPt}pt; color: #777; border-bottom: 0.3pt solid #ccc; padding-bottom: 1pt; margin-bottom: 2pt; }
  .f-title { font-size: ${sz.titlePt}pt; font-weight: 700; line-height: 1.2; word-break: break-word; margin-bottom: 1pt; }
  .f-ref   { font-size: ${sz.refPt}pt; font-weight: 700; font-family: monospace; letter-spacing: -0.3pt; margin-bottom: 1pt; }
  .f-sn    { font-size: ${sz.snPt}pt; font-family: monospace; margin-bottom: 1pt; }
  .f-small { font-size: ${sz.bodyPt}pt; color: #333; margin-bottom: 0.5pt; }
  .f-dim   { font-size: ${sz.bodyPt - 1}pt; color: #555; font-style: italic; margin-bottom: 0.5pt; }
  .bc      { font-family: 'Libre Barcode 128 Text', monospace; font-size: ${sz.barcodePt}pt; line-height: 1; display: block; }
  .bc-val  { font-size: ${sz.bodyPt - 1}pt; color: #444; margin-top: -1pt; margin-bottom: 1pt; }
  .footer  { font-size: ${sz.companyPt}pt; color: #555; border-top: 0.3pt solid #ccc; padding-top: 1pt; margin-top: auto; }
  .label   { page-break-after: always; display: flex; flex-direction: column; }
  .label:last-child { page-break-after: avoid; }
</style>
</head>
<body>${labelBlocks}</body>
</html>`
}

function openPrint(html: string) {
  const win = window.open('', '_blank', 'width=600,height=500')
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
      case 'itemName':     return row(key, data.itemName,                                          'title')
      case 'partNumber':   return row(key, data.partNumber,                                        'dim')
      case 'serialNumber': return row(key, data.serialNumber ? `SN: ${data.serialNumber}` : null,  'sn')
      case 'date':         return row(key, `Receção: ${data.date}`,                                'small')
      default:             return []
    }
  })
}

function productRows(fields: string[], data: ProductLabelData): Row[] {
  return fields.flatMap(key => {
    switch (key) {
      case 'itemName':     return row(key, data.itemName,     'title')
      case 'partNumber':   return row(key, data.partNumber,   'dim')
      case 'serialNumber': return row(key, data.serialNumber ? `SN: ${data.serialNumber}` : null, 'sn')
      case 'barcode':      return row(key, data.barcode,      'barcode')
      default:             return []
    }
  })
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function printRepairLabel(
  data: RepairLabelData,
  template: LabelTemplate,
  companyName = ''
): void {
  const rows = repairRows(template.fields, data)
  openPrint(buildLabelHTML(template.size, rows, template.customText, companyName))
}

export function printReceptionLabels(
  items: ReceptionLabelData[],
  template: LabelTemplate,
  companyName = ''
): void {
  const allRows = items.map(d => receptionRows(template.fields, d))
  openPrint(buildMultiLabelHTML(template.size, allRows, template.customText, companyName))
}

export function printProductLabel(
  data: ProductLabelData,
  template: LabelTemplate,
  companyName = ''
): void {
  const rows = productRows(template.fields, data)
  openPrint(buildLabelHTML(template.size, rows, template.customText, companyName))
}
