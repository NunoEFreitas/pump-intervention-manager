interface PrintCompany {
  name: string
  email: string
  address: string
  phones: string[]
  faxes: string[]
  logo: string
}

interface PrintWorkOrder {
  reference: string | null
  description: string
  timeSpent: number | null
  km: number | null
  locationEquipmentId: string | null
  interventionType: string | null
  transportGuide: string | null
  startDate: string | null
  startTime: string | null
  endDate: string | null
  endTime: string | null
  fromAddress: string | null
  internal: boolean
  vehicles: { plateNumber: string; brand: string | null; model: string | null }[]
  helpers: { name: string }[]
  createdBy: { name: string }
  parts: {
    quantity: number
    item: { itemName: string; partNumber: string }
    serialNumbers?: { serialNumber: string }[]
  }[]
}

interface PrintIntervention {
  reference: string | null
  breakdown: string
  status: string
  bill: boolean
  client: {
    name: string
    address: string | null
    city: string | null
    postalCode: string | null
    phone: string | null
  }
  location: {
    name: string
    address: string | null
    city: string | null
    equipment: { id: string; model: string; equipmentType: { name: string }; brand: { name: string } }[]
  } | null
  assignedTo: { name: string } | null
}

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function calcDuration(start: string | null, end: string | null): string {
  if (!start || !end) return ''
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const diff = eh * 60 + em - (sh * 60 + sm)
  if (diff <= 0) return ''
  return `${Math.floor(diff / 60)}h ${diff % 60}m`
}

function sectionHeader(label: string, colspan = 2): string {
  return `<tr><td colspan="${colspan}" style="border:none;border-top:2px solid #000;border-bottom:2px solid #000;text-align:center;font-weight:bold;font-size:9pt;padding:4px 0;">${label}</td></tr>`
}

export function printWorkOrderPDF(
  workOrder: PrintWorkOrder,
  intervention: PrintIntervention,
  company: PrintCompany
): void {
  const ref = workOrder.reference || '—'
  const locationAddr = [intervention.location?.address, intervention.location?.city].filter(Boolean).join(', ')
  const clientAddr = [intervention.client.address, intervention.client.city, intervention.client.postalCode].filter(Boolean).join(', ')
  const destAddr = locationAddr || (intervention.location ? esc(intervention.location.name) : clientAddr)
  const locationEquipment = intervention.location?.equipment.find((e) => e.id === workOrder.locationEquipmentId)
  const duration = calcDuration(workOrder.startTime, workOrder.endTime)
  const techName = intervention.assignedTo?.name || workOrder.createdBy.name

  const footerLines = [
    company.address ? esc(company.address) : '',
    company.phones.length ? `Telefones: ${company.phones.map(esc).join(' / ')}` : '',
    company.faxes.length ? `Fax: ${company.faxes.map(esc).join(' / ')}` : '',
    company.email ? `E-mail: ${esc(company.email)}` : '',
  ].filter(Boolean)

  const footerHtml = footerLines.join(' &nbsp;—&nbsp; ')

  const partsRows =
    workOrder.parts.length > 0
      ? workOrder.parts
          .map((p) => {
            const snText = p.serialNumbers?.length
              ? ` <span style="color:#555;font-size:8pt;">SN: ${p.serialNumbers.map((s) => esc(s.serialNumber)).join(', ')}</span>`
              : ''
            const pn = p.item.partNumber ? ` <span style="color:#666;">(${esc(p.item.partNumber)})</span>` : ''
            return `<tr><td>${esc(p.item.itemName)}${pn}${snText}</td><td style="text-align:center;width:60px">${p.quantity}</td></tr>`
          })
          .join('')
      : `<tr><td colspan="2" style="text-align:center;color:#aaa;">—</td></tr>`

  const equipmentSection = locationEquipment
    ? `<table>
        ${sectionHeader('BOMBAS / EQUIPAMENTOS', 3)}
        <tr>
          <th style="width:33%">Tipo</th>
          <th style="width:33%">Marca</th>
          <th style="width:34%">Modelo</th>
        </tr>
        <tr>
          <td>${esc(locationEquipment.equipmentType.name)}</td>
          <td>${esc(locationEquipment.brand.name)}</td>
          <td>${esc(locationEquipment.model)}</td>
        </tr>
      </table>`
    : ''

  const helperRow =
    workOrder.helpers.length > 0
      ? `<tr><td class="lbl">Nome Ajudante</td><td>${esc(workOrder.helpers.map((h) => h.name).join(', '))}</td></tr>`
      : ''

  const vehicleText = workOrder.vehicles
    .map((v) => [v.plateNumber, v.brand, v.model].filter(Boolean).join(' '))
    .join(', ')

  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<title>FICHA TÉCNICA ${esc(ref)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #000; background: #fff; }
  .page { padding: 14mm 14mm 10mm; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 7mm; }
  .logo img { max-height: 20mm; max-width: 65mm; object-fit: contain; }
  .doc-title { font-size: 14pt; font-weight: bold; text-align: right; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4mm; }
  td, th { border: 1px solid #000; padding: 3px 5px; vertical-align: middle; font-size: 9pt; }
  th { font-weight: bold; background: #fff; }
  .lbl { font-weight: bold; white-space: nowrap; }
  .text-td { padding: 5px; vertical-align: top; min-height: 18mm; white-space: pre-wrap; line-height: 1.5; }
  .footer { text-align: center; font-size: 7.5pt; border-top: 1px solid #000; padding-top: 3px; margin-top: 6mm; }
  .sig-page { page-break-before: always; padding: 14mm; display: flex; flex-direction: column; min-height: 267mm; }
  .sig-content { flex: 1; }
  .sig-row { display: flex; justify-content: space-around; margin-top: 25mm; }
  .sig-box { text-align: center; }
  .sig-label { font-size: 9pt; margin-bottom: 18mm; }
  .sig-line { width: 70mm; border-top: 1px solid #000; }
  @media print {
    @page { size: A4 portrait; margin: 0; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="logo">
      ${company.logo
        ? `<img src="${company.logo}" alt="Logo" />`
        : `<div style="font-size:12pt;font-weight:bold;">${esc(company.name)}</div>`}
    </div>
    <div class="doc-title">FICHA TÉCNICA ${esc(ref)}</div>
  </div>

  <!-- Client / date info -->
  <table>
    <tr>
      <td class="lbl" style="width:17%">CLIENTE</td>
      <td style="width:33%">${esc(intervention.client.name)}</td>
      <td class="lbl" style="width:17%">Cliente a Faturar</td>
      <td style="width:33%">${intervention.bill ? esc(intervention.client.name) : ''}</td>
    </tr>
    <tr>
      <td class="lbl">MORADA</td>
      <td>${esc(destAddr)}</td>
      <td class="lbl">CONTACTO</td>
      <td>${esc(intervention.client.phone || '')}</td>
    </tr>
    <tr>
      <td class="lbl">DATA</td>
      <td>${esc(workOrder.startDate || '')}</td>
      <td class="lbl">GUIA DE TRANSPORTE</td>
      <td>${esc(workOrder.transportGuide || '')}</td>
    </tr>
  </table>

  <!-- Task info -->
  <table>
    ${sectionHeader('INFORMAÇÕES DA TAREFA', 2)}
    <tr>
      <td class="lbl" style="width:42%">Tipo da Tarefa</td>
      <td>${workOrder.internal ? 'Interna' : 'Externa'}</td>
    </tr>
    <tr>
      <td class="lbl">Trabalho Finalizado</td>
      <td>${intervention.status === 'COMPLETED' ? 'Sim' : 'Não'}</td>
    </tr>
    <tr>
      <td class="lbl">Houve Ajudante</td>
      <td>${workOrder.helpers.length > 0 ? 'Sim' : 'Não'}</td>
    </tr>
    ${helperRow}
  </table>

  <!-- Labor -->
  <table>
    ${sectionHeader('MÃO-DE-OBRA', 4)}
    <tr>
      <th>Colaborador</th>
      <th style="width:17%">Trabalho Início</th>
      <th style="width:17%">Trabalho Fim</th>
      <th style="width:17%">Diferença</th>
    </tr>
    <tr>
      <td>${esc(techName)}</td>
      <td style="text-align:center">${esc(workOrder.startTime || '')}</td>
      <td style="text-align:center">${esc(workOrder.endTime || '')}</td>
      <td style="text-align:center">${esc(duration)}</td>
    </tr>
  </table>

  <!-- Travel -->
  <table>
    ${sectionHeader('DESLOCAÇÕES', 4)}
    <tr>
      <td class="lbl" style="width:25%">Viatura</td>
      <td style="width:25%">${esc(vehicleText)}</td>
      <td class="lbl" style="width:25%">Total KM</td>
      <td style="width:25%">${workOrder.km !== null && workOrder.km !== undefined ? workOrder.km : ''}</td>
    </tr>
    <tr>
      <td class="lbl">Origem</td>
      <td>${esc(workOrder.fromAddress || '')}</td>
      <td class="lbl">Destino</td>
      <td>${esc(destAddr)}</td>
    </tr>
  </table>

  <!-- Materials -->
  <table>
    ${sectionHeader('MATERIAIS APLICADOS', 2)}
    <tr>
      <th>Denominação</th>
      <th style="width:60px">Qtd</th>
    </tr>
    ${partsRows}
  </table>

  ${equipmentSection}

  <!-- Anomalias -->
  <table>
    ${sectionHeader('ANOMALIAS ENCONTRADAS', 1)}
    <tr><td class="text-td">${esc(intervention.breakdown)}</td></tr>
  </table>

  <!-- Work done -->
  <table>
    ${sectionHeader('TRABALHO EFETUADO', 1)}
    <tr><td class="text-td">${esc(workOrder.description)}</td></tr>
  </table>

  <!-- Work completed reason (empty) -->
  <table>
    ${sectionHeader('TRABALHO FINALIZADO - PORQUE?', 1)}
    <tr><td class="text-td" style="min-height:12mm;">&nbsp;</td></tr>
  </table>

  <div class="footer">${footerHtml}</div>
</div>

<!-- Signature page -->
<div class="sig-page">
  <div class="sig-content">
    <div class="sig-row">
      <div class="sig-box">
        <div class="sig-label">Assinatura do Cliente</div>
        <div class="sig-line"></div>
      </div>
      <div class="sig-box">
        <div class="sig-label">Assinatura do Técnico</div>
        <div class="sig-line"></div>
      </div>
    </div>
  </div>
  <div class="footer">${footerHtml}</div>
</div>

</body>
</html>`

  const win = window.open('', '_blank', 'width=850,height=950')
  if (!win) {
    alert('Por favor permita popups para gerar o PDF.')
    return
  }
  win.document.write(html)
  win.document.close()
  setTimeout(() => {
    win.focus()
    win.print()
  }, 600)
}
