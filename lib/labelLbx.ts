// Generates Brother P-touch Editor .lbx files (ZIP of prop.xml + label.xml).
// Fixed size: 62mm × 29mm (portrait — width=tape, height=cut-length).

import { strToU8, zipSync } from 'fflate'
import {
  type LabelTemplate,
  type RepairLabelData,
  type ReceptionLabelData,
  type ProductLabelData,
} from './labelPrint'

// ─── Constants ────────────────────────────────────────────────────────────────

const MM_TO_PT   = 2.8346
const TAPE_W_PT  = Math.round(62 * MM_TO_PT * 10) / 10   // 175.7pt
const LABEL_H_PT = Math.round(29 * MM_TO_PT * 10) / 10   // 82.2pt
const ML = 4.3, MT = 8.4, MR = 4.4, MB = 8.4

const CX = ML
const CY = MT
const CW = Math.round((TAPE_W_PT - ML - MR) * 10) / 10  // ≈ 167pt usable width
const CH = Math.round((LABEL_H_PT - MT - MB) * 10) / 10  // ≈ 65.4pt usable height

function esc(s?: string | null): string {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ─── prop.xml ─────────────────────────────────────────────────────────────────

function makePropXml(): string {
  const now = new Date().toISOString().slice(0, 19)
  return `<?xml version="1.0" encoding="UTF-8"?><pt:properties xmlns:pt="http://schemas.brother.info/ptouch/2007/lbx/main"><pt:appName>P-touch Editor</pt:appName><pt:appVer>5.4</pt:appVer><pt:templateVer>1.7</pt:templateVer><pt:creator>pump-intervention-manager</pt:creator><pt:lastModified>pump-intervention-manager</pt:lastModified><pt:created>${now}</pt:created><pt:modified>${now}</pt:modified><pt:revisionNumber>1</pt:revisionNumber></pt:properties>`
}

// ─── Object builders ──────────────────────────────────────────────────────────

function textObject(x: number, y: number, w: number, h: number, text: string, name: string, size = 7, bold = false): string {
  const weight   = bold ? '700' : '400'
  const charLen  = text.length
  const fontName = 'Arial Narrow'
  return `<text:text><pt:objectStyle x="${x}pt" y="${y}pt" width="${w}pt" height="${h}pt" backColor="#FFFFFF" backPrintColorNumber="0" ropMode="COPYPEN" angle="0" anchor="TOPLEFT" flip="NONE"><pt:pen style="NULL" widthX="0.5pt" widthY="0.5pt" color="#000000" printColorNumber="1"/><pt:brush style="NULL" color="#000000" printColorNumber="1" id="0"/><pt:expanded objectName="${esc(name)}" ID="0" lock="0" templateMergeTarget="LABELLIST" templateMergeType="NONE" templateMergeID="0" linkStatus="NONE" linkID="0"/></pt:objectStyle><text:ptFontInfo><text:logFont name="${fontName}" width="0" italic="false" weight="${weight}" charSet="0" pitchAndFamily="34"/><text:fontExt effect="NOEFFECT" underline="0" strikeout="0" size="${size}pt" orgSize="28.8pt" textColor="#000000" textPrintColorNumber="1"/></text:ptFontInfo><text:textControl control="LONGTEXTFIXED" clipFrame="false" aspectNormal="true" shrink="true" autoLF="true" avoidImage="false"/><text:textAlign horizontalAlignment="LEFT" verticalAlignment="TOP" inLineAlignment="BASELINE"/><text:textStyle vertical="false" nullBlock="false" charSpace="0" lineSpace="-25" orgPoint="${size}pt" combinedChars="false"/><pt:data>${esc(text)}</pt:data><text:stringItem charLen="${charLen}"><text:ptFontInfo><text:logFont name="${fontName}" width="0" italic="false" weight="${weight}" charSet="0" pitchAndFamily="34"/><text:fontExt effect="NOEFFECT" underline="0" strikeout="0" size="${size}pt" orgSize="28.8pt" textColor="#000000" textPrintColorNumber="1"/></text:ptFontInfo></text:stringItem></text:text>`
}

function barcodeObject(x: number, y: number, w: number, h: number, value: string, name: string): string {
  return `<barcode:barcode><pt:objectStyle x="${x}pt" y="${y}pt" width="${w}pt" height="${h}pt" backColor="#FFFFFF" backPrintColorNumber="0" ropMode="COPYPEN" angle="0" anchor="TOPLEFT" flip="NONE"><pt:pen style="NULL" widthX="0.5pt" widthY="0.5pt" color="#000000" printColorNumber="1"/><pt:brush style="NULL" color="#000000" printColorNumber="1" id="0"/><pt:expanded objectName="${esc(name)}" ID="0" lock="0" templateMergeTarget="LABELLIST" templateMergeType="NONE" templateMergeID="0" linkStatus="NONE" linkID="0"/></pt:objectStyle><barcode:barcodeStyle type="CODE128" protocol="CODE128" zeroSup="false" barWidth="THIN" barRatio="3:1" useCheckDigit="false" checkDigit="false" textPos="BOTTOM" quietZoneLeft="10" quietZoneRight="10" quietZoneTop="10" quietZoneBottom="10" rotation="0"/><pt:data>${esc(value)}</pt:data></barcode:barcode>`
}

// ─── label.xml ────────────────────────────────────────────────────────────────

export type LbxRow = {
  key: string
  value: string
  type: 'ref' | 'title' | 'dim' | 'sn' | 'small' | 'barcode'
}

function buildObjects(rows: LbxRow[], companyName: string): string {
  const barcodeRow = rows.find(r => r.type === 'barcode' && r.value)
  const textRows   = rows.filter(r => r.type !== 'barcode' && r.value)

  const lines: string[] = []
  if (companyName) lines.push(companyName)
  for (const r of textRows) lines.push(r.value)

  const parts: string[] = []

  if (barcodeRow) {
    const textH = lines.length > 0 ? Math.round(CH * 0.55) : 0
    const bcH   = Math.round(CH * 0.35)
    const valH  = 10
    const bcY   = CY + textH + (lines.length > 0 ? 2 : 0)

    if (lines.length > 0) {
      parts.push(textObject(CX, CY, CW, textH, lines.join('\r\n'), 'Content'))
    }
    parts.push(barcodeObject(CX, bcY, CW, bcH, barcodeRow.value, 'Barcode'))
    parts.push(textObject(CX, bcY + bcH + 1, CW, valH, barcodeRow.value, 'BarcodeVal', 6))
  } else if (lines.length > 0) {
    parts.push(textObject(CX, CY, CW, CH, lines.join('\r\n'), 'Content'))
  }

  return parts.join('')
}

function makeLabelXml(rows: LbxRow[], companyName: string): string {
  const bgW = Math.round((TAPE_W_PT - ML - MR) * 10) / 10
  const bgH = Math.round((LABEL_H_PT - MT - MB) * 10) / 10
  const NS  = 'xmlns:pt="http://schemas.brother.info/ptouch/2007/lbx/main" xmlns:style="http://schemas.brother.info/ptouch/2007/lbx/style" xmlns:text="http://schemas.brother.info/ptouch/2007/lbx/text" xmlns:draw="http://schemas.brother.info/ptouch/2007/lbx/draw" xmlns:image="http://schemas.brother.info/ptouch/2007/lbx/image" xmlns:barcode="http://schemas.brother.info/ptouch/2007/lbx/barcode" xmlns:database="http://schemas.brother.info/ptouch/2007/lbx/database" xmlns:table="http://schemas.brother.info/ptouch/2007/lbx/table" xmlns:cable="http://schemas.brother.info/ptouch/2007/lbx/cable"'
  const objects = buildObjects(rows, companyName)
  return `<?xml version="1.0" encoding="UTF-8"?><pt:document ${NS} version="1.7" generator="P-touch Editor 5.4.016 Windows"><pt:body currentSheet="Label" direction="LTR"><style:sheet name="Label"><style:paper media="0" width="${TAPE_W_PT}pt" height="${LABEL_H_PT}pt" marginLeft="${ML}pt" marginTop="${MT}pt" marginRight="${MR}pt" marginBottom="${MB}pt" orientation="portrait" autoLength="false" monochromeDisplay="true" printColorDisplay="false" printColorsID="0" paperColor="#FFFFFF" paperInk="#000000" split="1" format="259" backgroundTheme="0" printerID="14388" printerName="Brother QL-800"/><style:cutLine regularCut="0pt" freeCut=""/><style:backGround x="${ML}pt" y="${MT}pt" width="${bgW}pt" height="${bgH}pt" brushStyle="NULL" brushId="0" userPattern="NONE" userPatternId="0" color="#000000" printColorNumber="1" backColor="#FFFFFF" backPrintColorNumber="0"/><pt:objects>${objects}</pt:objects></style:sheet></pt:body></pt:document>`
}

// ─── ZIP builder ──────────────────────────────────────────────────────────────

function makeLbx(rows: LbxRow[], companyName: string): Uint8Array {
  return zipSync({
    'prop.xml':  [strToU8(makePropXml()),                     { level: 0 }],
    'label.xml': [strToU8(makeLabelXml(rows, companyName)),   { level: 0 }],
  })
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
  downloadLbx(`${data.reference ?? 'etiqueta'}.lbx`, makeLbx(repairLbxRows(template.fields, data), companyName))
}

export function downloadReceptionLbx(items: ReceptionLabelData[], template: LabelTemplate, companyName = ''): void {
  items.forEach((item, i) => {
    setTimeout(() => downloadLbx(`rececao-${i + 1}.lbx`, makeLbx(receptionLbxRows(template.fields, item), companyName)), i * 200)
  })
}

export function downloadProductLbx(data: ProductLabelData, template: LabelTemplate, companyName = ''): void {
  downloadLbx(`${data.partNumber ?? 'produto'}.lbx`, makeLbx(productLbxRows(template.fields, data), companyName))
}
