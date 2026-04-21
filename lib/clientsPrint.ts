interface PrintCompany {
  name: string
  email: string
  address: string
  phones: string[]
  faxes: string[]
  logo: string
}

interface ClientListItem {
  id: string
  reference: string | null
  name: string
  city: string | null
  phone: string | null
  email: string | null
  vatNumber?: string | null
  country?: string | null
  district?: string | null
  _count?: { interventions: number }
}

interface ClientDetailEquipment {
  id: string
  model: string
  serialNumber: string | null
  observations?: string | null
  equipmentType: { name: string }
  brand: { name: string }
}

interface ClientDetailLocation {
  id: string
  name: string
  country: string | null
  district: string | null
  address: string | null
  city: string | null
  postalCode: string | null
  phone: string | null
  contactPerson: string | null
  notes: string | null
  equipment: ClientDetailEquipment[]
}

interface ClientDetailIntervention {
  id: string
  reference?: string | null
  status: string
  scheduledDate: string | null
  scheduledTime?: string | null
  createdAt: string
  assignedTo: { name: string } | null
  location: { name: string; city: string | null } | null
}

interface ClientDetail {
  id: string
  reference: string | null
  name: string
  vatNumber: string | null
  country: string | null
  district: string | null
  address: string | null
  city: string | null
  postalCode: string | null
  phone: string | null
  email: string | null
  contactPerson: string | null
  notes: string | null
  contract: boolean
  contractDate: string | null
  locations: ClientDetailLocation[]
  interventions: ClientDetailIntervention[]
}

function esc(s?: string | null): string {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Por Atribuir', ASSIGNED: 'Atribuída', IN_PROGRESS: 'Em Curso',
  PENDING_PARTS: 'Aguarda Peças', QUALITY_ASSESSMENT: 'Controlo Qualidade',
  COMPLETED: 'Concluída', CANCELED: 'Cancelada',
}
const STATUS_COLOR: Record<string, string> = {
  OPEN: '#b45309', ASSIGNED: '#c2410c', IN_PROGRESS: '#1d4ed8',
  PENDING_PARTS: '#e11d48', QUALITY_ASSESSMENT: '#7c3aed',
  COMPLETED: '#15803d', CANCELED: '#9ca3af',
}

const SHARED_STYLE = `
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:Arial,sans-serif; font-size:12px; color:#111; padding:24px; }
  table { width:100%; border-collapse:collapse; }
  th { background:#1e3a5f; color:#fff; font-size:10px; font-weight:600; text-transform:uppercase;
       letter-spacing:.04em; padding:6px 8px; text-align:left; }
  td { padding:7px 8px; border-bottom:1px solid #e5e7eb; vertical-align:top; }
  tr:last-child td { border-bottom:none; }
  tr:nth-child(even) td { background:#f9fafb; }
  .section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em;
                   color:#1e3a5f; border-bottom:2px solid #1e3a5f; padding-bottom:4px; margin:20px 0 10px; }
  @media print { body { padding:0; } @page { margin:14mm 10mm; } }
`

function companyHeader(company: PrintCompany, title: string, subtitle?: string): string {
  const logoHtml = company.logo
    ? `<img src="${esc(company.logo)}" alt="" style="height:48px;object-fit:contain;display:block;">`
    : ''
  const infoLines = [
    company.address ? esc(company.address) : '',
    company.phones.length ? `Tel: ${company.phones.map(esc).join(' / ')}` : '',
    company.email ? esc(company.email) : '',
  ].filter(Boolean).join(' &nbsp;·&nbsp; ')

  return `
  <div style="display:flex;justify-content:space-between;align-items:flex-start;
              border-bottom:2px solid #1e3a5f;padding-bottom:12px;margin-bottom:20px;">
    <div>
      ${logoHtml}
      ${!company.logo && company.name ? `<div style="font-size:18px;font-weight:700;color:#1e3a5f">${esc(company.name)}</div>` : ''}
      ${infoLines ? `<div style="font-size:10px;color:#6b7280;margin-top:4px">${infoLines}</div>` : ''}
    </div>
    <div style="text-align:right">
      <div style="font-size:18px;font-weight:700;color:#1e3a5f">${esc(title)}</div>
      ${subtitle ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">${esc(subtitle)}</div>` : ''}
      <div style="font-size:10px;color:#9ca3af;margin-top:4px">
        ${new Date().toLocaleDateString('pt-PT', { day:'2-digit', month:'long', year:'numeric' })}
      </div>
    </div>
  </div>`
}

function openPrintWindow(html: string, title: string): void {
  const win = window.open('', '_blank', 'width=1050,height=750')
  if (!win) { alert('Por favor permita popups para imprimir.'); return }
  win.document.write(html)
  win.document.close()
  setTimeout(() => { win.focus(); win.print() }, 400)
}

export function printClientList(clients: ClientListItem[], company: PrintCompany): void {
  const rows = clients.map(c => {
    const addr = [c.city, c.country].filter(Boolean).map(esc).join(', ')
    const count = c._count?.interventions ?? 0
    return `<tr>
      <td style="font-family:monospace;font-size:10px;color:#6b7280">${esc(c.reference)}</td>
      <td style="font-weight:600">${esc(c.name)}</td>
      <td>${addr}</td>
      <td>${esc(c.phone)}</td>
      <td>${esc(c.email)}</td>
      <td style="text-align:center">${count}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>Listagem de Clientes</title>
  <style>${SHARED_STYLE}</style>
</head>
<body>
  ${companyHeader(company, 'Clientes', `${clients.length} registo${clients.length !== 1 ? 's' : ''}`)}
  <table>
    <thead>
      <tr>
        <th style="width:8%">Ref.</th>
        <th style="width:28%">Nome</th>
        <th style="width:22%">Localidade / País</th>
        <th style="width:14%">Telefone</th>
        <th style="width:20%">Email</th>
        <th style="width:8%;text-align:center">Interv.</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`

  openPrintWindow(html, 'Listagem de Clientes')
}

export function printClientDetail(client: ClientDetail, company: PrintCompany): void {
  const addr = [client.address, client.postalCode, client.city, client.district, client.country].filter(Boolean).map(esc).join(', ')

  const infoRows = [
    client.vatNumber ? `<tr><td class="lbl">NIF</td><td>${esc(client.vatNumber)}</td></tr>` : '',
    addr ? `<tr><td class="lbl">Morada</td><td>${addr}</td></tr>` : '',
    client.phone ? `<tr><td class="lbl">Telefone</td><td>${esc(client.phone)}</td></tr>` : '',
    client.email ? `<tr><td class="lbl">Email</td><td>${esc(client.email)}</td></tr>` : '',
    client.contactPerson ? `<tr><td class="lbl">Contacto</td><td>${esc(client.contactPerson)}</td></tr>` : '',
    client.contract
      ? `<tr><td class="lbl">Contrato</td><td>Sim${client.contractDate ? ` — desde ${new Date(client.contractDate).toLocaleDateString('pt-PT')}` : ''}</td></tr>`
      : '',
    client.notes ? `<tr><td class="lbl">Notas</td><td style="white-space:pre-wrap">${esc(client.notes)}</td></tr>` : '',
  ].filter(Boolean).join('')

  const locationsHtml = client.locations.map(loc => {
    const locAddr = [loc.address, loc.postalCode, loc.city, loc.district, loc.country].filter(Boolean).map(esc).join(', ')
    const equipRows = loc.equipment.length > 0
      ? loc.equipment.map(eq => `<tr>
          <td>${esc(eq.equipmentType.name)}</td>
          <td>${esc(eq.brand.name)}</td>
          <td>${esc(eq.model)}</td>
          <td style="font-family:monospace;font-size:10px">${esc(eq.serialNumber)}</td>
          <td style="font-size:10px;color:#6b7280">${esc(eq.observations)}</td>
        </tr>`).join('')
      : `<tr><td colspan="5" style="color:#9ca3af;text-align:center;font-style:italic">Sem equipamentos</td></tr>`

    return `
    <div style="margin-bottom:16px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
      <div style="background:#f1f5f9;padding:8px 12px;display:flex;justify-content:space-between;align-items:baseline;">
        <span style="font-weight:700;font-size:13px">${esc(loc.name)}</span>
        ${locAddr ? `<span style="font-size:10px;color:#6b7280">${locAddr}</span>` : ''}
      </div>
      ${(loc.phone || loc.contactPerson) ? `
      <div style="padding:6px 12px;font-size:11px;color:#374151;border-bottom:1px solid #e5e7eb;">
        ${loc.phone ? `📞 ${esc(loc.phone)}` : ''}
        ${loc.contactPerson ? `&nbsp;&nbsp;👤 ${esc(loc.contactPerson)}` : ''}
      </div>` : ''}
      <table style="margin:0">
        <thead><tr>
          <th>Tipo</th><th>Marca</th><th>Modelo</th><th>Nº Série</th><th>Observações</th>
        </tr></thead>
        <tbody>${equipRows}</tbody>
      </table>
    </div>`
  }).join('')

  const interventionRows = client.interventions.slice(0, 50).map(iv => {
    const color = STATUS_COLOR[iv.status] ?? '#6b7280'
    const label = STATUS_LABEL[iv.status] ?? iv.status
    const date = iv.scheduledDate
      ? new Date(iv.scheduledDate).toLocaleDateString('pt-PT')
      : new Date(iv.createdAt).toLocaleDateString('pt-PT')
    return `<tr>
      <td style="font-family:monospace;font-size:10px;color:#6b7280">${esc((iv as any).reference)}</td>
      <td>${date}</td>
      <td>${esc(iv.location?.name)}</td>
      <td>${esc(iv.assignedTo?.name)}</td>
      <td>
        <span style="padding:2px 7px;border-radius:999px;font-size:9px;font-weight:600;
                     background:${color}22;color:${color};border:1px solid ${color}66">${label}</span>
      </td>
    </tr>`
  }).join('')

  const moreNote = client.interventions.length > 50
    ? `<p style="font-size:10px;color:#9ca3af;text-align:right;margin-top:6px">Mostrando 50 de ${client.interventions.length} intervenções</p>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>${esc(client.name)}</title>
  <style>
    ${SHARED_STYLE}
    .lbl { font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;white-space:nowrap;width:1%;padding-right:16px; }
    .info-table td { border-bottom:none; padding:4px 8px; }
    .info-table tr:nth-child(even) td { background:transparent; }
  </style>
</head>
<body>
  ${companyHeader(company, esc(client.name), client.reference ?? undefined)}

  <div class="section-title">Dados do Cliente</div>
  <table class="info-table" style="width:auto">
    <tbody>${infoRows}</tbody>
  </table>

  <div class="section-title">Instalações (${client.locations.length})</div>
  ${client.locations.length > 0 ? locationsHtml : '<p style="color:#9ca3af;font-style:italic">Sem instalações registadas.</p>'}

  <div class="section-title">Intervenções (${client.interventions.length})</div>
  ${client.interventions.length > 0 ? `
  <table>
    <thead><tr>
      <th style="width:9%">Ref.</th>
      <th style="width:10%">Data</th>
      <th style="width:28%">Instalação</th>
      <th style="width:22%">Técnico</th>
      <th style="width:15%">Estado</th>
    </tr></thead>
    <tbody>${interventionRows}</tbody>
  </table>
  ${moreNote}
  ` : '<p style="color:#9ca3af;font-style:italic">Sem intervenções.</p>'}
</body>
</html>`

  openPrintWindow(html, `Cliente — ${client.name}`)
}
