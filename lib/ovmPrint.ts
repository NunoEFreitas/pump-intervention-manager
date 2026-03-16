import type { OVMData } from '@/app/[locale]/dashboard/interventions/[id]/OVMForm'

interface PrintCompany {
  name: string
  address: string
  phones: string[]
  faxes: string[]
  email: string
  logo: string
}

interface PrintIntervention {
  reference: string | null
  client: { name: string }
  location?: {
    equipment: { id: string; model: string; serialNumber: string | null; equipmentType: { name: string }; brand: { name: string } }[]
  } | null
}

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const ROWS = ['20dm3', '5dm3', '2dm3'] as const
const ENSAIO_LABELS = ['1º ensaio', '2º ensaio', '3º ensaio']

function ensaioTable(idx: number, ensaio: OVMData['ensaios'][number], fuelColumns: [string, string, string, string]): string {
  const dataRows = ROWS.map(
    row => `<tr>
      <td class="lbl" style="width:60px">${row}</td>
      ${ensaio[row].map((v, c) => `<td style="text-align:center">${fuelColumns[c] ? esc(v) || '0.0' : esc(v)}</td>`).join('')}
    </tr>`
  ).join('')

  return `<table>
    <tr>
      <td class="lbl sect" style="width:60px">${esc(ENSAIO_LABELS[idx])}</td>
      <td class="sect" colspan="4" style="text-align:center;font-weight:bold">medida</td>
    </tr>
    <tr>
      <td></td>
      ${fuelColumns.map(f => `<td style="text-align:center;font-weight:bold">${esc(f || 'combustível')}</td>`).join('')}
    </tr>
    ${dataRows}
  </table>`
}

export function printOVMPDF(
  data: OVMData,
  intervention: PrintIntervention,
  company: PrintCompany
): void {
  const fuelColumns: [string, string, string, string] = Array.isArray(data.fuelColumns) && data.fuelColumns.length === 4
    ? data.fuelColumns as [string, string, string, string]
    : ['', '', '', '']
  const div5  = typeof data.medidaPadraoDiv5  === 'string' ? data.medidaPadraoDiv5  : ''
  const div20 = typeof data.medidaPadraoDiv20 === 'string' ? data.medidaPadraoDiv20 : ''
  const PADRAO_DIV5  = [{ key: 'p1_5',  label: 'Padrão 1/5'  }, { key: 'p2_5',  label: 'Padrão 2/5'  }]
  const PADRAO_DIV20 = [{ key: 'p1_20', label: 'Padrão 1/20' }, { key: 'p2_20', label: 'Padrão 2/20' }, { key: 'p3_20', label: 'Padrão 3/20' }]
  const locationEquipment = intervention.location?.equipment.find(e => e.id === data.equipmentId)
  const equipmentLine = locationEquipment
    ? `${esc(locationEquipment.equipmentType.name)} — ${esc(locationEquipment.brand.name)} ${esc(locationEquipment.model)}${locationEquipment.serialNumber ? ` (${esc(locationEquipment.serialNumber)})` : ''}`
    : ''
  const footerLines = [
    company.address ? esc(company.address) : '',
    company.phones.length ? `Telefones: ${company.phones.map(esc).join(' / ')}` : '',
    company.faxes.length ? `Fax: ${company.faxes.map(esc).join(' / ')}` : '',
    company.email ? `E-mail: ${esc(company.email)}` : '',
  ].filter(Boolean)

  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<title>OVM — ${esc(intervention.reference || '')}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size:9pt; color:#000; background:#fff; }
  .page { padding:14mm 14mm 10mm; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6mm; }
  .logo img { max-height:18mm; max-width:60mm; object-fit:contain; }
  .doc-title { font-size:12pt; font-weight:bold; text-align:right; }
  .main-title { text-align:center; margin-bottom:5mm; line-height:1.6; }
  .main-title .t1 { font-size:10pt; font-weight:bold; }
  .grid { display:flex; gap:8mm; align-items:flex-start; }
  .left { flex:1; min-width:0; }
  .right { width:52mm; flex-shrink:0; display:flex; flex-direction:column; gap:4mm; }
  table { width:100%; border-collapse:collapse; margin-bottom:3mm; }
  td, th { border:1px solid #000; padding:2px 4px; vertical-align:middle; font-size:8.5pt; }
  .lbl { font-weight:bold; white-space:nowrap; }
  .sect { background:#f5f5f5; }
  .check { text-align:center; }
  .despacho-label { font-size:8.5pt; font-weight:bold; margin-bottom:2mm; }
  .despacho-box { border:1px solid #000; min-height:18mm; padding:3px 5px; font-size:8.5pt; white-space:pre-wrap; }
  .footer { text-align:center; font-size:7.5pt; border-top:1px solid #000; padding-top:3px; margin-top:6mm; }
  @media print { @page { size: A4 portrait; margin:0; } }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div class="logo">
      ${company.logo
        ? `<img src="${company.logo}" alt="Logo" />`
        : `<div style="font-size:11pt;font-weight:bold;">${esc(company.name)}</div>`}
    </div>
    <div class="doc-title">OVM — ${esc(intervention.reference || '—')}</div>
  </div>

  <div class="main-title">
    <div class="t1">boletin de intervenção CMAC</div>
    ${equipmentLine ? `<div style="font-size:9pt">${equipmentLine}</div>` : ''}
    <div>Registo de erros dos ensaios efetuados</div>
  </div>

  <div class="grid">
    <div class="left">
      ${data.ensaios.map((e, i) => ensaioTable(i, e, fuelColumns)).join('')}
    </div>
    <div class="right">
      <!-- Medida Padrão -->
      <table>
        <tr><td class="sect" colspan="2" style="text-align:center;font-weight:bold">Medida Padrão</td></tr>
        ${PADRAO_DIV5.map(opt => `<tr>
          <td class="lbl">${opt.label}</td>
          <td class="check" style="width:10mm">${div5 === opt.key ? '✓' : ''}</td>
        </tr>`).join('')}
        ${PADRAO_DIV20.map(opt => `<tr>
          <td class="lbl">${opt.label}</td>
          <td class="check" style="width:10mm">${div20 === opt.key ? '✓' : ''}</td>
        </tr>`).join('')}
      </table>

      <!-- Tipo Intervenção -->
      <table>
        <tr><td class="sect" colspan="2" style="text-align:center;font-weight:bold">Tipo Intervenção</td></tr>
        <tr>
          <td class="lbl">Reparação</td>
          <td class="check" style="width:10mm">${data.reparacao ? '✓' : ''}</td>
        </tr>
        <tr>
          <td class="lbl">Substituição</td>
          <td class="check" style="width:10mm">${data.substituicao ? '✓' : ''}</td>
        </tr>
      </table>

      <!-- Despacho -->
      <div>
        <div class="despacho-label">Despacho de Aprovação Modelo</div>
        <div class="despacho-box">${esc(data.despachoModelo)}</div>
      </div>
    </div>
  </div>

  <div class="footer">${footerLines.join(' &nbsp;—&nbsp; ')}</div>
</div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=820,height=900')
  if (!win) {
    alert('Por favor permita popups para gerar o PDF.')
    return
  }
  win.document.write(html)
  win.document.close()
  setTimeout(() => {
    win.focus()
    win.print()
  }, 400)
}
