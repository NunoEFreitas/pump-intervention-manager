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
  fromAddress: string | null
  internal: boolean
  sessions: { startDate: string | null; startTime: string | null; endDate: string | null; endTime: string | null; duration: number | null }[]
  vehicles: { plateNumber: string; brand: string | null; model: string | null }[]
  helpers: { name: string }[]
  createdBy: { name: string }
  parts: {
    quantity: number
    item: { itemName: string; partNumber: string }
    serialNumbers?: { serialNumber: string }[]
  }[]
  repairParts?: {
    parts: { itemName: string; partNumber: string; quantity: number; notes?: string | null }[]
  }[]
  swapItems?: { itemName: string; partNumber: string; serialNumber: string | null }[]
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
    equipment: { id: string; model: string; serialNumber: string | null; equipmentType: { name: string }; brand: { name: string } }[]
  } | null
  assignedTo: { name: string } | null
}

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const STYLE = `
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:Arial,sans-serif; font-size:12px; color:#111; padding:24px; }
  table { width:100%; border-collapse:collapse; }
  th { background:#1e3a5f; color:#fff; font-size:10px; font-weight:600; text-transform:uppercase;
       letter-spacing:.04em; padding:6px 8px; text-align:left; }
  td { padding:6px 8px; border-bottom:1px solid #e5e7eb; vertical-align:top; }
  tr:last-child td { border-bottom:none; }
  tr:nth-child(even) td { background:#f9fafb; }
  .lbl { font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;
         color:#6b7280;white-space:nowrap;width:1%;padding-right:14px; }
  .info-table td { border-bottom:none; padding:3px 8px; }
  .info-table tr:nth-child(even) td { background:transparent; }
  .section { font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
             color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:3px;margin:18px 0 10px; }
  .badge { padding:2px 7px;border-radius:999px;font-size:9px;font-weight:600; }
  .sig-page { page-break-before:always; }
  .sig-row { display:flex;justify-content:space-around;margin-top:40px; }
  .sig-box { text-align:center; }
  .sig-label { font-size:11px;font-weight:600;color:#374151;margin-bottom:24px; }
  .sig-line { width:200px;border-top:1px solid #374151;margin:0 auto; }
  @media print { body { padding:0; } @page { margin:14mm 12mm; } }
`

const IV_TYPE_LABEL: Record<string, string> = {
  ELECTRONIC: 'Eletrónica', HYDRAULIC: 'Hidráulica', COMPUTING: 'Informática', OTHERS: 'Outros',
}

function companyHeader(company: PrintCompany, title: string, subtitle?: string): string {
  const logoHtml = company.logo
    ? `<img src="${esc(company.logo)}" alt="" style="height:44px;object-fit:contain;display:block;">`
    : ''
  const info = [
    company.address ? esc(company.address) : '',
    company.phones.length ? `Tel: ${company.phones.map(esc).join(' / ')}` : '',
    company.faxes.length ? `Fax: ${company.faxes.map(esc).join(' / ')}` : '',
    company.email ? esc(company.email) : '',
  ].filter(Boolean).join(' &nbsp;·&nbsp; ')

  return `
  <div style="display:flex;justify-content:space-between;align-items:flex-start;
              border-bottom:2px solid #1e3a5f;padding-bottom:12px;margin-bottom:18px;">
    <div>
      ${logoHtml}
      ${!company.logo && company.name ? `<div style="font-size:17px;font-weight:700;color:#1e3a5f">${esc(company.name)}</div>` : ''}
      ${info ? `<div style="font-size:10px;color:#6b7280;margin-top:3px">${info}</div>` : ''}
    </div>
    <div style="text-align:right">
      <div style="font-size:17px;font-weight:700;color:#1e3a5f">${esc(title)}</div>
      ${subtitle ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">${esc(subtitle)}</div>` : ''}
      <div style="font-size:10px;color:#9ca3af;margin-top:3px">
        ${new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}
      </div>
    </div>
  </div>`
}

export function printWorkOrderPDF(
  workOrder: PrintWorkOrder,
  intervention: PrintIntervention,
  company: PrintCompany,
  clientSignature?: string | null,
  techSignature?: string | null
): void {
  const ref = workOrder.reference || '—'
  const locationAddr = [intervention.location?.address, intervention.location?.city].filter(Boolean).join(', ')
  const clientAddr = [intervention.client.address, intervention.client.city, intervention.client.postalCode].filter(Boolean).join(', ')
  const destAddr = locationAddr || (intervention.location ? esc(intervention.location.name) : clientAddr)
  const locationEquipment = intervention.location?.equipment.find(e => e.id === workOrder.locationEquipmentId)
  const firstSession = workOrder.sessions?.[0] ?? null
  const techName = intervention.assignedTo?.name || workOrder.createdBy.name
  const typeColor = workOrder.internal ? '#1d4ed8' : '#c2410c'
  const typeBg    = workOrder.internal ? '#eff6ff' : '#fff7ed'
  const typeBorder = workOrder.internal ? '#bfdbfe' : '#fed7aa'
  const typeLabel = workOrder.internal ? 'Interno' : 'Externo'
  const ivTypeLabel = workOrder.interventionType ? IV_TYPE_LABEL[workOrder.interventionType] ?? workOrder.interventionType : ''

  // Info grid rows
  const infoRows = [
    `<tr><td class="lbl">Cliente</td><td style="font-weight:600">${esc(intervention.client.name)}</td></tr>`,
    destAddr ? `<tr><td class="lbl">Morada</td><td>${esc(destAddr)}</td></tr>` : '',
    intervention.client.phone ? `<tr><td class="lbl">Contacto</td><td>${esc(intervention.client.phone)}</td></tr>` : '',
    firstSession?.startDate ? `<tr><td class="lbl">Data</td><td>${esc(firstSession.startDate)}</td></tr>` : '',
    workOrder.transportGuide ? `<tr><td class="lbl">Guia transporte</td><td>${esc(workOrder.transportGuide)}</td></tr>` : '',
    `<tr><td class="lbl">Técnico</td><td style="font-weight:600">${esc(techName)}</td></tr>`,
    workOrder.helpers.length > 0 ? `<tr><td class="lbl">Ajudantes</td><td>${esc(workOrder.helpers.map(h => h.name).join(', '))}</td></tr>` : '',
  ].filter(Boolean).join('')

  const travelRows = [
    workOrder.vehicles.length > 0 ? `<tr><td class="lbl">Viatura</td><td>${esc(workOrder.vehicles.map(v => [v.plateNumber, v.brand, v.model].filter(Boolean).join(' ')).join(', '))}</td></tr>` : '',
    workOrder.km != null ? `<tr><td class="lbl">Km</td><td>${workOrder.km}</td></tr>` : '',
    workOrder.fromAddress ? `<tr><td class="lbl">Origem</td><td>${esc(workOrder.fromAddress)}</td></tr>` : '',
    destAddr ? `<tr><td class="lbl">Destino</td><td>${esc(destAddr)}</td></tr>` : '',
    ivTypeLabel ? `<tr><td class="lbl">Tipo intervenção</td><td>${ivTypeLabel}</td></tr>` : '',
    intervention.bill ? `<tr><td class="lbl">Faturar</td><td>${esc(intervention.client.name)}</td></tr>` : '',
  ].filter(Boolean).join('')

  // Sessions
  const sessionRows = workOrder.sessions.map((s, i) => {
    const dur = s.duration != null ? `${s.duration.toFixed(2)}h` : ''
    return `<tr>
      <td>${i === 0 ? esc(techName) : ''}</td>
      <td style="text-align:center">${esc(s.startDate || '')}</td>
      <td style="text-align:center">${esc(s.startTime || '')}</td>
      <td style="text-align:center">${esc(s.endTime || '')}</td>
      <td style="text-align:right;font-weight:600;color:#1d4ed8">${esc(dur)}</td>
    </tr>`
  }).join('') || `<tr>
    <td>${esc(techName)}</td><td></td><td></td><td></td><td></td>
  </tr>`
  const sessionTotal = workOrder.sessions.reduce((s, x) => s + (x.duration ?? 0), 0)
  const sessionTotalRow = workOrder.sessions.length > 0
    ? `<tfoot><tr>
        <td colspan="4" style="text-align:right;font-weight:700;border-top:1px solid #d1d5db">Total</td>
        <td style="text-align:right;font-weight:700;color:#1d4ed8;border-top:1px solid #d1d5db">${sessionTotal.toFixed(2)}h</td>
      </tr></tfoot>`
    : ''

  // Parts — direct
  const directPartRows = workOrder.parts.map(p => {
    const sns = p.serialNumbers?.length
      ? ` <span style="font-size:10px;color:#7c3aed;font-family:monospace">SN: ${p.serialNumbers.map(s => esc(s.serialNumber)).join(', ')}</span>`
      : ''
    return `<tr>
      <td>${esc(p.item.itemName)} <span style="font-size:10px;color:#6b7280">${esc(p.item.partNumber)}</span>${sns}</td>
      <td style="text-align:center;width:60px">${p.quantity}</td>
    </tr>`
  })

  const repairPartRows = (workOrder.repairParts ?? []).flatMap(job =>
    job.parts.map(p => `<tr>
      <td>${esc(p.itemName)} <span style="font-size:10px;color:#6b7280">${esc(p.partNumber)}</span></td>
      <td style="text-align:center;width:60px">${p.quantity}</td>
    </tr>`)
  )

  const swapPartRows = (workOrder.swapItems ?? []).map(s => {
    const sn = s.serialNumber ? ` <span style="font-size:10px;color:#7c3aed;font-family:monospace">SN: ${esc(s.serialNumber)}</span>` : ''
    return `<tr>
      <td>${esc(s.itemName)} <span style="font-size:10px;color:#6b7280">${esc(s.partNumber)}</span>${sn}</td>
      <td style="text-align:center;width:60px">1</td>
    </tr>`
  })

  const allPartRows = [...directPartRows, ...repairPartRows, ...swapPartRows]
  const partsSection = allPartRows.length > 0 ? `
    <div class="section">Materiais Aplicados</div>
    <table>
      <thead><tr><th>Denominação</th><th style="text-align:center;width:60px">Qtd</th></tr></thead>
      <tbody>${allPartRows.join('')}</tbody>
    </table>` : ''

  // Equipment
  const equipmentSection = locationEquipment ? `
    <div class="section">Equipamento</div>
    <table>
      <thead><tr><th>Tipo</th><th>Marca</th><th>Modelo</th><th>Nº Série</th></tr></thead>
      <tbody><tr>
        <td>${esc(locationEquipment.equipmentType.name)}</td>
        <td>${esc(locationEquipment.brand.name)}</td>
        <td>${esc(locationEquipment.model)}</td>
        <td style="font-family:monospace">${esc(locationEquipment.serialNumber)}</td>
      </tr></tbody>
    </table>` : ''

  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<title>Ficha Técnica ${esc(ref)}</title>
<style>${STYLE}</style>
</head>
<body>

  ${companyHeader(company, `Ficha Técnica ${esc(ref)}`, `${esc(intervention.client.name)}${firstSession?.startDate ? ' — ' + esc(firstSession.startDate) : ''}`)}

  <!-- Type badge -->
  <div style="margin-bottom:14px">
    <span class="badge" style="background:${typeBg};color:${typeColor};border:1px solid ${typeBorder};font-size:10px">${typeLabel}</span>
    ${intervention.bill ? '<span class="badge" style="background:#dbeafe;color:#1d4ed8;border:1px solid #bfdbfe;font-size:10px;margin-left:6px">Faturar</span>' : ''}
  </div>

  <!-- Info + Travel side by side -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:4px">
    <div>
      <div class="section" style="margin-top:0">Informação</div>
      <table class="info-table"><tbody>${infoRows}</tbody></table>
    </div>
    <div>
      <div class="section" style="margin-top:0">Deslocação</div>
      ${travelRows ? `<table class="info-table"><tbody>${travelRows}</tbody></table>` : '<p style="font-size:11px;color:#9ca3af">—</p>'}
    </div>
  </div>

  <!-- Sessions -->
  <div class="section">Mão-de-Obra</div>
  <table>
    <thead><tr><th>Colaborador</th><th style="text-align:center">Data Início</th><th style="text-align:center">Hora Início</th><th style="text-align:center">Hora Fim</th><th style="text-align:right">Duração</th></tr></thead>
    <tbody>${sessionRows}</tbody>
    ${sessionTotalRow}
  </table>

  ${partsSection}
  ${equipmentSection}

  <!-- Anomalias -->
  <div class="section">Anomalias Encontradas</div>
  <p style="white-space:pre-wrap;font-size:12px;line-height:1.6;color:#374151;padding:4px 0;min-height:32px">${esc(intervention.breakdown)}</p>

  <!-- Work done -->
  <div class="section">Trabalho Efetuado</div>
  <p style="white-space:pre-wrap;font-size:12px;line-height:1.6;color:#374151;padding:4px 0;min-height:48px">${esc(workOrder.description)}</p>

  <!-- Work completed reason -->
  <div class="section">Trabalho Finalizado — Porque?</div>
  <p style="min-height:32px">&nbsp;</p>

  <!-- Signature page -->
  <div class="sig-page">
    <div style="border-bottom:2px solid #1e3a5f;padding-bottom:8px;margin-bottom:32px">
      <span style="font-size:14px;font-weight:700;color:#1e3a5f">Ficha Técnica ${esc(ref)}</span>
      <span style="font-size:11px;color:#6b7280;margin-left:12px">${esc(intervention.client.name)}</span>
    </div>
    <div class="sig-row">
      <div class="sig-box">
        <div class="sig-label">Assinatura do Cliente</div>
        ${clientSignature
          ? `<img src="${clientSignature}" style="width:200px;height:80px;object-fit:contain;display:block;margin:0 auto 8px;" />`
          : `<div style="height:80px;"></div>`}
        <div class="sig-line"></div>
      </div>
      <div class="sig-box">
        <div class="sig-label">Assinatura do Técnico</div>
        ${techSignature
          ? `<img src="${techSignature}" style="width:200px;height:80px;object-fit:contain;display:block;margin:0 auto 8px;" />`
          : `<div style="height:80px;"></div>`}
        <div class="sig-line"></div>
      </div>
    </div>
  </div>

</body>
</html>`

  const win = window.open('', '_blank', 'width=1050,height=800')
  if (!win) { alert('Por favor permita popups para gerar o PDF.'); return }
  win.document.write(html)
  win.document.close()
  setTimeout(() => { win.focus(); win.print() }, 500)
}
