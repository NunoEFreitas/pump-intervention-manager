// Generates Brother P-touch Editor .lbx files (ZIP of prop.xml + label.xml).
// Coordinate system (landscape orientation, same as the sample file):
//   x-axis = label length direction  (0 → paper height in pt)
//   y-axis = tape width direction    (0 → paper width = 175.7pt for 62mm tape)
//   marginTop/marginBottom are the x-axis margins (label start/end)
//   marginLeft/marginRight are the y-axis margins (tape top/bottom)

import { strToU8, zipSync } from 'fflate'
import {
  LABEL_SIZES,
  type LabelSizeKey,
  type LabelTemplate,
  type RepairLabelData,
  type ReceptionLabelData,
  type ProductLabelData,
} from './labelPrint'

// ─── Constants ────────────────────────────────────────────────────────────────

const MM_TO_PT = 2.8346
const TAPE_W_PT = 175.7  // 62mm tape width in pt — fixed (paper width attribute)

// Margins matching the sample file exactly
const ML = 4.3, MT = 8.4, MR = 4.4, MB = 8.4

function mmToPt(mm: number): number {
  return Math.round(mm * MM_TO_PT * 10) / 10
}

function esc(s?: string | null): string {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ─── prop.xml ─────────────────────────────────────────────────────────────────

function makePropXml(): string {
  const now = new Date().toISOString().slice(0, 19)
  return `<?xml version="1.0" encoding="UTF-8"?><pt:properties xmlns:pt="http://schemas.brother.info/ptouch/2007/lbx/main"><pt:appName>P-touch Editor</pt:appName><pt:appVer>5.4</pt:appVer><pt:templateVer>1.7</pt:templateVer><pt:creator>pump-intervention-manager</pt:creator><pt:lastModified>pump-intervention-manager</pt:lastModified><pt:created>${now}</pt:created><pt:modified>${now}</pt:modified><pt:revisionNumber>1</pt:revisionNumber></pt:properties>`
}

// ─── Text object builder ───────────────────────────────────────────────────────

interface TxtBlock {
  x: number; y: number; w: number; h: number
  font: string
  size: number   // rendered pt size
  bold: boolean
  text: string   // may contain \r\n
  autoLF: boolean
  hAlign: 'LEFT' | 'CENTER' | 'JUSTIFY'
  vAlign: 'TOP' | 'CENTER'
  control: 'FIXEDFRAME' | 'LONGTEXTFIXED'
}

function textBlock(b: TxtBlock, name: string): string {
  const weight = b.bold ? '700' : '400'
  const charLen = b.text.length
  const orgPt = b.size  // use actual size as orgPoint (no pre-scaled shrink)
  return `<text:text><pt:objectStyle x="${b.x}pt" y="${b.y}pt" width="${b.w}pt" height="${b.h}pt" backColor="#FFFFFF" backPrintColorNumber="0" ropMode="COPYPEN" angle="0" anchor="TOPLEFT" flip="NONE"><pt:pen style="NULL" widthX="0.5pt" widthY="0.5pt" color="#000000" printColorNumber="1"/><pt:brush style="NULL" color="#000000" printColorNumber="1" id="0"/><pt:expanded objectName="${esc(name)}" ID="0" lock="0" templateMergeTarget="LABELLIST" templateMergeType="NONE" templateMergeID="0" linkStatus="NONE" linkID="0"/></pt:objectStyle><text:ptFontInfo><text:logFont name="${b.font}" width="0" italic="false" weight="${weight}" charSet="0" pitchAndFamily="34"/><text:fontExt effect="NOEFFECT" underline="0" strikeout="0" size="${b.size}pt" orgSize="28.8pt" textColor="#000000" textPrintColorNumber="1"/></text:ptFontInfo><text:textControl control="${b.control}" clipFrame="false" aspectNormal="true" shrink="true" autoLF="${b.autoLF ? 'true' : 'false'}" avoidImage="false"/><text:textAlign horizontalAlignment="${b.hAlign}" verticalAlignment="${b.vAlign}" inLineAlignment="BASELINE"/><text:textStyle vertical="false" nullBlock="false" charSpace="0" lineSpace="-25" orgPoint="${orgPt}pt" combinedChars="false"/><pt:data>${esc(b.text)}</pt:data><text:stringItem charLen="${charLen}"><text:ptFontInfo><text:logFont name="${b.font}" width="0" italic="false" weight="${weight}" charSet="0" pitchAndFamily="34"/><text:fontExt effect="NOEFFECT" underline="0" strikeout="0" size="${b.size}pt" orgSize="28.8pt" textColor="#000000" textPrintColorNumber="1"/></text:ptFontInfo></text:stringItem></text:text>`
}

// ─── Barcode object ────────────────────────────────────────────────────────────

function barcodeBlock(x: number, y: number, w: number, h: number, value: string, name: string): string {
  return `<barcode:barcode><pt:objectStyle x="${x}pt" y="${y}pt" width="${w}pt" height="${h}pt" backColor="#FFFFFF" backPrintColorNumber="0" ropMode="COPYPEN" angle="0" anchor="TOPLEFT" flip="NONE"><pt:pen style="NULL" widthX="0.5pt" widthY="0.5pt" color="#000000" printColorNumber="1"/><pt:brush style="NULL" color="#000000" printColorNumber="1" id="0"/><pt:expanded objectName="${esc(name)}" ID="0" lock="0" templateMergeTarget="LABELLIST" templateMergeType="NONE" templateMergeID="0" linkStatus="NONE" linkID="0"/></pt:objectStyle><barcode:barcodeStyle type="CODE128" protocol="CODE128" zeroSup="false" barWidth="THIN" barRatio="3:1" useCheckDigit="false" checkDigit="false" textPos="BOTTOM" quietZoneLeft="10" quietZoneRight="10" quietZoneTop="10" quietZoneBottom="10" rotation="0"/><pt:data>${esc(value)}</pt:data></barcode:barcode>`
}

// ─── Row type ──────────────────────────────────────────────────────────────────

export type LbxRow = {
  key: string
  value: string
  type: 'ref' | 'title' | 'dim' | 'sn' | 'small' | 'barcode'
}

// ─── Layout builder ───────────────────────────────────────────────────────────
// Portrait orientation: x-axis = tape width (0→175.7pt), y-axis = label length (0→labelH)
// marginLeft/Right are tape-width margins (x), marginTop/Bottom are label-length margins (y)

function buildObjects(sizeKey: LabelSizeKey, rows: LbxRow[], companyName: string): string {
  const { h: labelMm } = LABEL_SIZES[sizeKey] ?? LABEL_SIZES['62x100']
  const labelH = mmToPt(labelMm)  // y-axis max (label cut length in pt)

  // Usable content area (portrait)
  const cX = ML                      // content start in x (tape width direction)
  const cY = MT                      // content start in y (label length direction)
  const cW = TAPE_W_PT - ML - MR     // usable tape width ≈ 167pt (~59mm)
  const cH = labelH - MT - MB        // usable label length

  // For short labels (62×30): cH ≈ 68pt ≈ 24mm → fewer lines, use smaller font
  // For long labels (62×100): cH ≈ 267pt ≈ 94mm → many lines, use larger font
  const isShort = cH < 150
  const mainFont = 'Arial Narrow'
  const mainSize = isShort ? 7 : 9.7

  const elems: string[] = []

  // Separate barcode rows from text rows
  const barcodeRows = rows.filter(r => r.type === 'barcode' && r.value)
  const textRows    = rows.filter(r => r.type !== 'barcode' && r.value)

  // ── Text content block ──────────────────────────────────────────────────────
  const lines: string[] = []
  if (companyName) lines.push(companyName)
  for (const row of textRows) {
    switch (row.type) {
      case 'ref':   lines.push(row.value); break
      case 'title': lines.push(row.value); break
      default:      lines.push(row.value); break
    }
  }

  if (lines.length > 0) {
    // If there's also a barcode, give text the top portion; otherwise full height
    const hasBarcode = barcodeRows.length > 0
    const textH = hasBarcode ? Math.round(cH * 0.6) : cH
    const textData = lines.join('\r\n')

    elems.push(textBlock({
      x: cX, y: cY, w: cW, h: textH,
      font: mainFont, size: mainSize, bold: false,
      text: textData, autoLF: true,
      hAlign: 'LEFT', vAlign: 'TOP',
      control: 'LONGTEXTFIXED',
    }, 'Content'))
  }

  // ── Barcode block (at bottom if text present, else full height) ─────────────
  if (barcodeRows.length > 0) {
    const hasText = lines.length > 0
    const bcY = hasText ? cY + Math.round(cH * 0.65) : cY
    const bcH = hasText ? Math.round(cH * 0.35) - 2  : cH
    const bcH2 = Math.max(bcH - 10, 15)  // leave room for barcode text below

    elems.push(barcodeBlock(cX, bcY, cW, bcH2, barcodeRows[0].value, 'Barcode'))

    // value as text below
    elems.push(textBlock({
      x: cX, y: bcY + bcH2 + 1, w: cW, h: 10,
      font: 'Arial Narrow', size: 6, bold: false,
      text: barcodeRows[0].value, autoLF: false,
      hAlign: 'CENTER', vAlign: 'CENTER',
      control: 'FIXEDFRAME',
    }, 'BarcodeVal'))
  }

  return elems.join('')
}

// ─── label.xml ────────────────────────────────────────────────────────────────

function makeLabelXml(sizeKey: LabelSizeKey, rows: LbxRow[], companyName: string): string {
  const { h: labelMm } = LABEL_SIZES[sizeKey] ?? LABEL_SIZES['62x100']
  const labelH = mmToPt(labelMm)

  // Portrait background rect (confirmed against sample portrait files):
  // bgX = marginLeft (x = tape-width direction margin)
  // bgY = marginTop  (y = label-length direction margin)
  // bgW = TAPE_W - marginLeft - marginRight  (usable tape width)
  // bgH = labelH   - marginTop  - marginBottom (usable label length)
  const bgX = ML, bgY = MT
  const bgW = Math.round((TAPE_W_PT - ML - MR) * 10) / 10
  const bgH = Math.round((labelH    - MT - MB) * 10) / 10

  const objects = buildObjects(sizeKey, rows, companyName)

  // Namespace declaration on one line — matches sample exactly
  const NS = 'xmlns:pt="http://schemas.brother.info/ptouch/2007/lbx/main" xmlns:style="http://schemas.brother.info/ptouch/2007/lbx/style" xmlns:text="http://schemas.brother.info/ptouch/2007/lbx/text" xmlns:draw="http://schemas.brother.info/ptouch/2007/lbx/draw" xmlns:image="http://schemas.brother.info/ptouch/2007/lbx/image" xmlns:barcode="http://schemas.brother.info/ptouch/2007/lbx/barcode" xmlns:database="http://schemas.brother.info/ptouch/2007/lbx/database" xmlns:table="http://schemas.brother.info/ptouch/2007/lbx/table" xmlns:cable="http://schemas.brother.info/ptouch/2007/lbx/cable"'

  return `<?xml version="1.0" encoding="UTF-8"?><pt:document ${NS} version="1.7" generator="P-touch Editor 5.4.016 Windows"><pt:body currentSheet="Label" direction="LTR"><style:sheet name="Label"><style:paper media="0" width="${TAPE_W_PT}pt" height="${labelH}pt" marginLeft="${ML}pt" marginTop="${MT}pt" marginRight="${MR}pt" marginBottom="${MB}pt" orientation="portrait" autoLength="false" monochromeDisplay="true" printColorDisplay="false" printColorsID="0" paperColor="#FFFFFF" paperInk="#000000" split="1" format="259" backgroundTheme="0" printerID="14388" printerName="Brother QL-800"/><style:cutLine regularCut="0pt" freeCut=""/><style:backGround x="${bgX}pt" y="${bgY}pt" width="${bgW}pt" height="${bgH}pt" brushStyle="NULL" brushId="0" userPattern="NONE" userPatternId="0" color="#000000" printColorNumber="1" backColor="#FFFFFF" backPrintColorNumber="0"/><pt:objects>${objects}</pt:objects></style:sheet></pt:body></pt:document>`
}

// ─── ZIP builder ──────────────────────────────────────────────────────────────

function makeLbx(sizeKey: LabelSizeKey, rows: LbxRow[], companyName: string): Uint8Array {
  const zip = zipSync({
    'prop.xml':  [strToU8(makePropXml()),            { level: 0 }],
    'label.xml': [strToU8(makeLabelXml(sizeKey, rows, companyName)), { level: 0 }],
  })
  return zip
}

function downloadLbx(filename: string, data: Uint8Array): void {
  const blob = new Blob([data as BlobPart], { type: 'application/octet-stream' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

// ─── Row builders ─────────────────────────────────────────────────────────────

function row(key: string, value: string | null | undefined, type: LbxRow['type']): LbxRow[] {
  return value ? [{ key, value, type }] : []
}

function repairLbxRows(fields: string[], data: RepairLabelData): LbxRow[] {
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

function receptionLbxRows(fields: string[], data: ReceptionLabelData): LbxRow[] {
  return fields.flatMap(key => {
    switch (key) {
      case 'itemName':     return row(key, data.itemName,     'title')
      case 'partNumber':   return row(key, data.partNumber,   'dim')
      case 'serialNumber': return row(key, data.serialNumber ? `SN: ${data.serialNumber}` : null, 'sn')
      case 'date':         return row(key, `Receção: ${data.date}`, 'small')
      default:             return []
    }
  })
}

function productLbxRows(fields: string[], data: ProductLabelData): LbxRow[] {
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

export function downloadRepairLbx(data: RepairLabelData, template: LabelTemplate, companyName = ''): void {
  const zip = makeLbx(template.size, repairLbxRows(template.fields, data), companyName)
  downloadLbx(`${data.reference ?? 'etiqueta'}.lbx`, zip)
}

export function downloadReceptionLbx(items: ReceptionLabelData[], template: LabelTemplate, companyName = ''): void {
  items.forEach((item, i) => {
    const zip = makeLbx(template.size, receptionLbxRows(template.fields, item), companyName)
    setTimeout(() => downloadLbx(`rececao-${i + 1}.lbx`, zip), i * 200)
  })
}

export function downloadProductLbx(data: ProductLabelData, template: LabelTemplate, companyName = ''): void {
  const zip = makeLbx(template.size, productLbxRows(template.fields, data), companyName)
  downloadLbx(`${data.partNumber ?? 'produto'}.lbx`, zip)
}
