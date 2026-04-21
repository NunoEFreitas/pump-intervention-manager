interface PrintCompany {
  name: string
  email: string
  address: string
  phones: string[]
  faxes: string[]
  logo: string
}

export interface RepairListItem {
  id: string
  reference: string | null
  type: 'STOCK' | 'CLIENT'
  status: string
  itemName: string
  partNumber: string
  snNumber: string | null
  problem: string | null
  sentAt: string
  clientName: string | null
  sentByName: string | null
}

export interface RepairDetailJob {
  id: string
  reference: string | null
  type: 'STOCK' | 'CLIENT'
  status: string
  itemName: string
  partNumber: string
  snNumber: string | null
  clientItemSn: string | null
  problem: string | null
  conditionDescription: string | null
  hasAccessories: boolean
  accessoriesDescription: string | null
  workNotes: string | null
  sentAt: string
  completedAt: string | null
  sentByName: string | null
  completedByName: string | null
  repairedByTechName: string | null
  totalHours: number | null
  quoteAmount: number | null
  quoteNotes: string | null
  quoteStatus: string | null
  quotedAt: string | null
  interventionReference: string | null
  locationName: string | null
  locationCity: string | null
  clientName: string | null
  clientPhone: string | null
  clientEmail: string | null
  clientVat: string | null
  sessions: Array<{
    id: string
    startDate: string | null
    startTime: string | null
    endDate: string | null
    endTime: string | null
    duration: number | null
  }>
  parts: Array<{
    id: string
    itemName: string
    partNumber: string
    quantity: number
    notes: string | null
    addedAt: string
    addedByName: string
  }>
}

function esc(s?: string | null): string {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Criada', IN_REPAIR: 'Em Progresso', QUOTE: 'Orçamento', OVM: 'Sujeito a OVM',
  REPAIRED: 'Devolvido ao Stock', NOT_REPAIRED: 'Não Reparado',
  WRITTEN_OFF: 'Abate', RETURNED_TO_CLIENT: 'Reparado',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING: '#92400e', IN_REPAIR: '#1d4ed8', QUOTE: '#d97706', OVM: '#7c3aed',
  REPAIRED: '#15803d', NOT_REPAIRED: '#6b7280', WRITTEN_OFF: '#b91c1c', RETURNED_TO_CLIENT: '#15803d',
}
const QUOTE_STATUS_LABEL: Record<string, string> = {
  PENDING_CLIENT: 'Aguarda aprovação', ACCEPTED: 'Aceite', REJECTED: 'Rejeitado',
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

function statusBadge(status: string): string {
  const color = STATUS_COLOR[status] ?? '#6b7280'
  const label = STATUS_LABEL[status] ?? status
  return `<span style="padding:2px 8px;border-radius:999px;font-size:9px;font-weight:600;background:${color}22;color:${color};border:1px solid ${color}66">${label}</span>`
}

function openPrintWindow(html: string): void {
  const win = window.open('', '_blank', 'width=1050,height=750')
  if (!win) { alert('Por favor permita popups para imprimir.'); return }
  win.document.write(html)
  win.document.close()
  setTimeout(() => { win.focus(); win.print() }, 400)
}

export function printRepairList(jobs: RepairListItem[], company: PrintCompany, filterLabel?: string): void {
  const rows = jobs.map(j => {
    const color = STATUS_COLOR[j.status] ?? '#6b7280'
    const label = STATUS_LABEL[j.status] ?? j.status
    const typeHtml = j.type === 'CLIENT'
      ? `<span style="font-size:9px;font-weight:700;color:#c2410c;background:#fff7ed;border:1px solid #fed7aa;padding:1px 5px;border-radius:3px">CLIENTE</span>`
      : `<span style="font-size:9px;font-weight:700;color:#1d4ed8;background:#eff6ff;border:1px solid #bfdbfe;padding:1px 5px;border-radius:3px">STOCK</span>`
    return `<tr>
      <td style="font-family:monospace;font-size:10px;color:#6b7280">${esc(j.reference)}</td>
      <td>${typeHtml}</td>
      <td>
        <div style="font-weight:600">${esc(j.itemName)}</div>
        <div style="font-size:10px;color:#6b7280;font-family:monospace">${esc(j.partNumber)}${j.snNumber ? ` &nbsp;SN: ${esc(j.snNumber)}` : ''}</div>
      </td>
      <td style="font-size:11px;color:#374151">${esc(j.problem)}</td>
      <td style="font-size:11px">${esc(j.clientName)}</td>
      <td>${new Date(j.sentAt).toLocaleDateString('pt-PT')}</td>
      <td><span style="padding:2px 7px;border-radius:999px;font-size:9px;font-weight:600;background:${color}22;color:${color};border:1px solid ${color}66">${label}</span></td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>Listagem de Reparações</title>
  <style>${SHARED_STYLE}</style>
</head>
<body>
  ${companyHeader(company, 'Reparações', filterLabel ? `${filterLabel} — ${jobs.length} registo${jobs.length !== 1 ? 's' : ''}` : `${jobs.length} registo${jobs.length !== 1 ? 's' : ''}`)}
  <table>
    <thead>
      <tr>
        <th style="width:8%">Ref.</th>
        <th style="width:7%">Tipo</th>
        <th style="width:25%">Artigo</th>
        <th style="width:25%">Problema</th>
        <th style="width:15%">Cliente</th>
        <th style="width:8%">Data</th>
        <th style="width:12%">Estado</th>
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:24px">Sem registos</td></tr>`}</tbody>
  </table>
</body>
</html>`

  openPrintWindow(html)
}

export function printRepairDetail(job: RepairDetailJob, company: PrintCompany): void {
  const typeLabel = job.type === 'CLIENT' ? 'Cliente' : 'Stock'
  const typeColor = job.type === 'CLIENT' ? '#c2410c' : '#1d4ed8'
  const typeBg = job.type === 'CLIENT' ? '#fff7ed' : '#eff6ff'
  const typeBorder = job.type === 'CLIENT' ? '#fed7aa' : '#bfdbfe'

  // Info grid rows
  const infoRows = [
    `<tr><td class="lbl">Tipo</td><td><span style="font-size:10px;font-weight:700;color:${typeColor};background:${typeBg};border:1px solid ${typeBorder};padding:2px 7px;border-radius:3px">${typeLabel}</span></td></tr>`,
    `<tr><td class="lbl">Estado</td><td>${statusBadge(job.status)}</td></tr>`,
    `<tr><td class="lbl">Criada em</td><td>${new Date(job.sentAt).toLocaleDateString('pt-PT')}</td></tr>`,
    job.sentByName ? `<tr><td class="lbl">Criada por</td><td>${esc(job.sentByName)}</td></tr>` : '',
    job.completedAt ? `<tr><td class="lbl">Concluída em</td><td>${new Date(job.completedAt).toLocaleDateString('pt-PT')}</td></tr>` : '',
    job.completedByName ? `<tr><td class="lbl">Concluída por</td><td>${esc(job.completedByName)}</td></tr>` : '',
    job.repairedByTechName ? `<tr><td class="lbl">Técnico</td><td>${esc(job.repairedByTechName)}</td></tr>` : '',
    job.totalHours != null ? `<tr><td class="lbl">Horas</td><td><strong>${job.totalHours.toFixed(2)}h</strong></td></tr>` : '',
    job.interventionReference ? `<tr><td class="lbl">Intervenção</td><td><span style="font-family:monospace">${esc(job.interventionReference)}</span></td></tr>` : '',
  ].filter(Boolean).join('')

  // Client section
  const clientSection = (job.clientName || job.locationName) ? `
    <div class="section-title">Cliente / Localização</div>
    <table class="info-table" style="width:auto">
      <tbody>
        ${job.clientName ? `<tr><td class="lbl">Cliente</td><td style="font-weight:600">${esc(job.clientName)}</td></tr>` : ''}
        ${job.clientVat ? `<tr><td class="lbl">NIF</td><td>${esc(job.clientVat)}</td></tr>` : ''}
        ${job.clientPhone ? `<tr><td class="lbl">Telefone</td><td>${esc(job.clientPhone)}</td></tr>` : ''}
        ${job.clientEmail ? `<tr><td class="lbl">Email</td><td>${esc(job.clientEmail)}</td></tr>` : ''}
        ${job.locationName ? `<tr><td class="lbl">Localização</td><td>${esc(job.locationName)}${job.locationCity ? ` — ${esc(job.locationCity)}` : ''}</td></tr>` : ''}
      </tbody>
    </table>` : ''

  // Fault section
  const faultRows = [
    job.problem ? `<tr><td class="lbl">Problema</td><td style="white-space:pre-wrap">${esc(job.problem)}</td></tr>` : '',
    job.conditionDescription ? `<tr><td class="lbl">Estado do artigo</td><td style="white-space:pre-wrap">${esc(job.conditionDescription)}</td></tr>` : '',
    job.hasAccessories ? `<tr><td class="lbl">Acessórios</td><td>${job.accessoriesDescription ? esc(job.accessoriesDescription) : 'Sim'}</td></tr>` : '',
    job.snNumber ? `<tr><td class="lbl">Nº de série</td><td style="font-family:monospace">${esc(job.snNumber)}</td></tr>` : '',
    job.clientItemSn ? `<tr><td class="lbl">SN do cliente</td><td style="font-family:monospace">${esc(job.clientItemSn)}</td></tr>` : '',
  ].filter(Boolean).join('')

  // Work notes
  const workNotesSection = job.workNotes ? `
    <div class="section-title">Notas de Trabalho</div>
    <p style="font-size:12px;white-space:pre-wrap;color:#374151;line-height:1.6;padding:8px 0">${esc(job.workNotes)}</p>` : ''

  // Sessions
  const sessionRows = job.sessions.map(s => `<tr>
    <td>${s.startDate ?? '—'}${s.startTime ? ` ${s.startTime}` : ''}</td>
    <td>${s.endDate ?? '—'}${s.endTime ? ` ${s.endTime}` : ''}</td>
    <td style="font-weight:600;color:#1d4ed8;text-align:right">${s.duration != null ? `${s.duration}h` : '—'}</td>
  </tr>`).join('')
  const sessionsSection = job.sessions.length > 0 ? `
    <div class="section-title">Sessões de Trabalho</div>
    <table>
      <thead><tr><th>Início</th><th>Fim</th><th style="text-align:right">Duração</th></tr></thead>
      <tbody>${sessionRows}</tbody>
      <tfoot><tr>
        <td colspan="2" style="text-align:right;font-weight:700;border-top:2px solid #e5e7eb;padding-top:6px">Total</td>
        <td style="font-weight:700;color:#1d4ed8;text-align:right;border-top:2px solid #e5e7eb;padding-top:6px">${(job.totalHours ?? 0).toFixed(2)}h</td>
      </tr></tfoot>
    </table>` : ''

  // Parts
  const partRows = job.parts.map(p => `<tr>
    <td style="font-weight:600">${esc(p.itemName)}</td>
    <td style="font-family:monospace;font-size:10px;color:#6b7280">${esc(p.partNumber)}</td>
    <td style="text-align:center">${p.quantity}</td>
    <td style="font-size:11px;color:#6b7280">${esc(p.notes)}</td>
    <td style="font-size:11px;color:#9ca3af">${new Date(p.addedAt).toLocaleDateString('pt-PT')} — ${esc(p.addedByName)}</td>
  </tr>`).join('')
  const partsSection = job.parts.length > 0 ? `
    <div class="section-title">Peças Utilizadas</div>
    <table>
      <thead><tr><th>Artigo</th><th>Ref.</th><th style="text-align:center;width:6%">Qty</th><th>Notas</th><th>Adicionado</th></tr></thead>
      <tbody>${partRows}</tbody>
    </table>` : ''

  // Quote
  const quoteSection = job.quoteAmount !== null ? `
    <div class="section-title">Orçamento</div>
    <table class="info-table" style="width:auto">
      <tbody>
        <tr><td class="lbl">Valor</td><td style="font-size:18px;font-weight:700">€${parseFloat(String(job.quoteAmount)).toFixed(2)}</td></tr>
        ${job.quoteStatus ? `<tr><td class="lbl">Estado</td><td>${esc(QUOTE_STATUS_LABEL[job.quoteStatus] ?? job.quoteStatus)}</td></tr>` : ''}
        ${job.quotedAt ? `<tr><td class="lbl">Data</td><td>${new Date(job.quotedAt).toLocaleDateString('pt-PT')}</td></tr>` : ''}
        ${job.quoteNotes ? `<tr><td class="lbl">Notas</td><td style="white-space:pre-wrap">${esc(job.quoteNotes)}</td></tr>` : ''}
      </tbody>
    </table>` : ''

  const subtitle = [job.reference, esc(job.itemName), job.partNumber].filter(Boolean).join(' — ')

  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>${esc(job.reference ?? job.itemName)}</title>
  <style>
    ${SHARED_STYLE}
    .lbl { font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;white-space:nowrap;width:1%;padding-right:16px; }
    .info-table td { border-bottom:none; padding:4px 8px; }
    .info-table tr:nth-child(even) td { background:transparent; }
  </style>
</head>
<body>
  ${companyHeader(company, 'Reparação', subtitle)}

  <div class="section-title">Informação</div>
  <table class="info-table" style="width:auto">
    <tbody>${infoRows}</tbody>
  </table>

  ${clientSection}

  <div class="section-title">Detalhes da Avaria</div>
  <table class="info-table" style="width:auto">
    <tbody>${faultRows || `<tr><td colspan="2" style="color:#9ca3af;font-style:italic">Sem detalhes.</td></tr>`}</tbody>
  </table>

  ${workNotesSection}
  ${sessionsSection}
  ${partsSection}
  ${quoteSection}
</body>
</html>`

  openPrintWindow(html)
}
