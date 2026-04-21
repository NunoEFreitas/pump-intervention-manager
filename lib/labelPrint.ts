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
  const orientation = s.h >= s.w ? 'portrait' : 'landscape'
  // Usable height after 2mm margin each side
  const usableH = `${s.h - 4}mm`
  return {
    pageSize:  `${s.w}mm ${s.h}mm ${orientation}`,
    usableH,
    titlePt:   narrow ? 12 : 18,
    bodyPt:    narrow ? 9  : 13,
    refPt:     narrow ? 14 : 22,
    snPt:      narrow ? 12 : 16,
    barcodePt: narrow ? 30 : (s.h < 50 ? 38 : 52),
    companyPt: narrow ? 7  : 10,
    fieldGap:  narrow ? '3pt' : '5pt',
    margin:    '2mm',
  }
}

function labelCSS(sizeKey: LabelSizeKey): string {
  const sz = sizeStyle(sizeKey)
  const w = LABEL_SIZES[sizeKey].w
  return `
  @import url('https://fonts.googleapis.com/css2?family=Libre+Barcode+128+Text&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: ${sz.pageSize}; margin: ${sz.margin}; }
  html, body { width: ${w}mm; font-family: Arial, sans-serif; font-size: ${sz.bodyPt}pt; color: #000; }
  .label { page-break-after: always; display: flex; flex-direction: column; min-height: ${sz.usableH}; }
  .label:last-child { page-break-after: avoid; }
  .wrap  { display: flex; flex-direction: column; width: 100%; flex: 1; overflow: hidden; }
  .company { font-size: ${sz.companyPt}pt; color: #777; border-bottom: 0.5pt solid #ccc; padding-bottom: 2pt; margin-bottom: ${sz.fieldGap}; }
  .f-title { font-size: ${sz.titlePt}pt; font-weight: 700; line-height: 1.25; word-break: break-word; margin-bottom: ${sz.fieldGap}; }
  .f-ref   { font-size: ${sz.refPt}pt; font-weight: 700; font-family: monospace; letter-spacing: -0.5pt; margin-bottom: ${sz.fieldGap}; }
  .f-sn    { font-size: ${sz.snPt}pt; font-family: monospace; margin-bottom: ${sz.fieldGap}; }
  .f-small { font-size: ${sz.bodyPt}pt; color: #222; margin-bottom: ${sz.fieldGap}; }
  .f-dim   { font-size: ${Math.max(sz.bodyPt - 2, 7)}pt; color: #555; font-style: italic; margin-bottom: ${sz.fieldGap}; }
  .bc      { font-family: 'Libre Barcode 128 Text', monospace; font-size: ${sz.barcodePt}pt; line-height: 1; display: block; margin-bottom: 2pt; }
  .bc-val  { font-size: ${Math.max(sz.bodyPt - 2, 7)}pt; color: #444; margin-bottom: ${sz.fieldGap}; }
  .footer  { font-size: ${sz.companyPt}pt; color: #555; border-top: 0.5pt solid #ccc; padding-top: 2pt; margin-top: auto; }
  `
}

function buildLabelHTML(
  sizeKey: LabelSizeKey,
  labels: Array<{ key: string; value: string; type?: 'title' | 'ref' | 'small' | 'sn' | 'barcode' | 'dim' }>,
  customText: string,
  companyName: string
): string {
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
<style>${labelCSS(sizeKey)}</style>
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
<style>${labelCSS(sizeKey)}</style>
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
