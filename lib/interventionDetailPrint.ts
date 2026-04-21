interface PrintCompany {
  name: string
  email: string
  address: string
  phones: string[]
  faxes: string[]
  logo: string
}

export interface PrintIntervention {
  id: string
  reference: string | null
  status: string
  breakdown: string
  comments: string | null
  bill: boolean
  contract: boolean
  warranty: boolean
  scheduledDate: string | null
  scheduledTime: string | null
  createdAt: string
  client: {
    name: string
    vatNumber: string | null
    country: string | null
    district: string | null
    address: string | null
    city: string | null
    postalCode: string | null
    phone: string | null
    contract: boolean
    contractDate: string | null
  }
  location: {
    name: string
    country: string | null
    district: string | null
    address: string | null
    city: string | null
    postalCode: string | null
    equipment: Array<{
      id: string
      model: string
      serialNumber: string | null
      equipmentType: { name: string }
      brand: { name: string }
    }>
  } | null
  assignedTo: { name: string } | null
  createdBy: { name: string } | null
}

export interface PrintWorkOrder {
  id: string
  reference: string | null
  internal: boolean
  description: string
  timeSpent: number | null
  km: number | null
  fromAddress: string | null
  interventionType: string | null
  transportGuide: string | null
  createdAt: string
  createdBy: { name: string }
  vehicles: { plateNumber: string; brand: string | null; model: string | null }[]
  helpers: { name: string }[]
  sessions: { startDate: string | null; startTime: string | null; endDate: string | null; endTime: string | null; duration: number | null }[]
  parts: { quantity: number; item: { itemName: string; partNumber: string }; serialNumbers?: { serialNumber: string }[] }[]
}

export interface PrintClientPart {
  id: string
  itemName: string
  partNumber: string
  serialNumber: string | null
  faultDescription: string | null
  clientPartStatus: string | null
  preSwapped: boolean
  repairReference: string | null
  repairStatus: string | null
  createdAt: string
  technicianName: string | null
  pickedUpByName: string | null
  receivedAtWarehouseAt: string | null
  receivedAtWarehouseByName: string | null
  sentOutAt: string | null
  sentOutTechnicianName: string | null
  returnedToClientAt: string | null
  returnedByName: string | null
}

export interface PrintOVMEntry {
  id: string
  createdAt: string
  data: {
    equipmentId: string
    regulatorId: string
    fuelColumns: [string, string, string, string]
    ensaios: [
      { '20dm3': [string, string, string, string]; '5dm3': [string, string, string, string]; '2dm3': [string, string, string, string] },
      { '20dm3': [string, string, string, string]; '5dm3': [string, string, string, string]; '2dm3': [string, string, string, string] },
      { '20dm3': [string, string, string, string]; '5dm3': [string, string, string, string]; '2dm3': [string, string, string, string] }
    ]
    medidaPadraoDiv5: string
    medidaPadraoDiv20: string
    reparacao: boolean
    substituicao: boolean
    despachoModelo: string
  }
}

function esc(s?: string | null): string {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Por Atribuir', ASSIGNED: 'Atribuída', IN_PROGRESS: 'Em Curso',
  PENDING_PARTS: 'Aguarda Peças', QUALITY_ASSESSMENT: 'Controlo de Qualidade',
  COMPLETED: 'Concluída', CANCELED: 'Cancelada',
}
const STATUS_COLOR: Record<string, string> = {
  OPEN: '#b45309', ASSIGNED: '#c2410c', IN_PROGRESS: '#1d4ed8',
  PENDING_PARTS: '#e11d48', QUALITY_ASSESSMENT: '#7c3aed',
  COMPLETED: '#15803d', CANCELED: '#9ca3af',
}
const IV_TYPE_LABEL: Record<string, string> = {
  ELECTRONIC: 'Eletrónica', HYDRAULIC: 'Hidráulica', COMPUTING: 'Informática', OTHERS: 'Outros',
}

const CLIENT_PART_STATUS_LABEL: Record<string, string> = {
  IN_TRANSIT: 'Em Trânsito', PENDING: 'No Armazém', REPAIR: 'Em Reparação',
  SWAP: 'Troca', RETURNING: 'A Devolver', RESOLVED: 'Concluída',
}
const CLIENT_PART_STATUS_COLOR: Record<string, string> = {
  IN_TRANSIT: '#d97706', PENDING: '#c2410c', REPAIR: '#1d4ed8',
  SWAP: '#7c3aed', RETURNING: '#7c3aed', RESOLVED: '#15803d',
}

const OVM_ROWS = ['20dm3', '5dm3', '2dm3'] as const
const OVM_ENSAIO_LABELS = ['1º Ensaio', '2º Ensaio', '3º Ensaio']
const PADRAO_DIV5_LABELS: Record<string, string>  = { p1_5: 'Padrão 1/5', p2_5: 'Padrão 2/5' }
const PADRAO_DIV20_LABELS: Record<string, string> = { p1_20: 'Padrão 1/20', p2_20: 'Padrão 2/20', p3_20: 'Padrão 3/20' }

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
  .wo-box { border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:14px; }
  .wo-head { background:#f1f5f9;padding:7px 12px;display:flex;align-items:center;gap:8px;font-size:12px; }
  .badge { padding:2px 7px;border-radius:999px;font-size:9px;font-weight:600; }
  .ovm-box { border:1px solid #ddd6fe;border-radius:6px;overflow:hidden;margin-bottom:14px; }
  .ovm-head { background:#f5f3ff;padding:7px 12px;display:flex;align-items:center;gap:10px; }
  .ovm-tbl { border-collapse:collapse;font-size:10px; }
  .ovm-tbl td, .ovm-tbl th { border:1px solid #d1d5db;padding:3px 6px;text-align:center; }
  .ovm-tbl th { background:#1e3a5f;color:#fff;font-size:9px; }
  .ovm-tbl .row-lbl { text-align:left;font-weight:600;color:#374151;background:#f9fafb; }
  @media print { body { padding:0; } @page { margin:14mm 10mm; } }
`

function companyHeader(company: PrintCompany, title: string, subtitle?: string): string {
  const logoHtml = company.logo
    ? `<img src="${esc(company.logo)}" alt="" style="height:44px;object-fit:contain;display:block;">`
    : ''
  const info = [
    company.address ? esc(company.address) : '',
    company.phones.length ? `Tel: ${company.phones.map(esc).join(' / ')}` : '',
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
        ${new Date().toLocaleDateString('pt-PT', { day:'2-digit', month:'long', year:'numeric' })}
      </div>
    </div>
  </div>`
}

function openPrint(html: string): void {
  const win = window.open('', '_blank', 'width=1050,height=750')
  if (!win) { alert('Por favor permita popups para imprimir.'); return }
  win.document.write(html)
  win.document.close()
  setTimeout(() => { win.focus(); win.print() }, 400)
}

function renderOVMBlock(ovm: PrintOVMEntry, idx: number, equipment: NonNullable<PrintIntervention['location']>['equipment'] | undefined): string {
  const d = ovm.data
  const fuelCols: [string, string, string, string] = Array.isArray(d.fuelColumns) && d.fuelColumns.length === 4
    ? d.fuelColumns as [string, string, string, string]
    : ['', '', '', '']

  const activeCols = fuelCols.map((f, i) => ({ label: f, idx: i })).filter(c => c.label)
  const colHeaders = activeCols.map(c => `<th>${esc(c.label)}</th>`).join('')

  const ensaioTables = d.ensaios.map((ensaio, ei) => {
    const dataRows = OVM_ROWS.map(row => {
      const cells = activeCols.map(c => `<td>${esc(ensaio[row][c.idx]) || '—'}</td>`).join('')
      return `<tr><td class="row-lbl">${row}</td>${cells}</tr>`
    }).join('')
    return `
    <div style="margin-bottom:8px">
      <div style="font-size:10px;font-weight:700;color:#6b7280;margin-bottom:4px">${OVM_ENSAIO_LABELS[ei]}</div>
      <table class="ovm-tbl" style="width:auto">
        <thead><tr><th style="text-align:left">Medida</th>${colHeaders}</tr></thead>
        <tbody>${dataRows}</tbody>
      </table>
    </div>`
  }).join('')

  const locationEquipment = equipment?.find(e => e.id === d.equipmentId)
  const equipLine = locationEquipment
    ? `${esc(locationEquipment.equipmentType.name)} — ${esc(locationEquipment.brand.name)} ${esc(locationEquipment.model)}${locationEquipment.serialNumber ? ` (${esc(locationEquipment.serialNumber)})` : ''}`
    : ''

  const flags = [
    d.reparacao ? '<span style="background:#dbeafe;color:#1d4ed8;padding:1px 5px;border-radius:3px;font-size:10px;font-weight:600">Reparação</span>' : '',
    d.substituicao ? '<span style="background:#dcfce7;color:#15803d;padding:1px 5px;border-radius:3px;font-size:10px;font-weight:600">Substituição</span>' : '',
  ].filter(Boolean).join(' ')

  const padrao5  = d.medidaPadraoDiv5  ? PADRAO_DIV5_LABELS[d.medidaPadraoDiv5]  ?? d.medidaPadraoDiv5  : ''
  const padrao20 = d.medidaPadraoDiv20 ? PADRAO_DIV20_LABELS[d.medidaPadraoDiv20] ?? d.medidaPadraoDiv20 : ''

  return `
  <div class="ovm-box">
    <div class="ovm-head">
      <span style="font-size:11px;font-weight:700;color:#4c1d95">OVM #${idx}</span>
      <span style="font-size:10px;color:#6b7280">${new Date(ovm.createdAt).toLocaleDateString('pt-PT')}</span>
      ${equipLine ? `<span style="font-size:11px;color:#374151">${equipLine}</span>` : ''}
      ${flags ? `<span style="margin-left:auto">${flags}</span>` : ''}
    </div>
    <div style="padding:10px 12px">
      ${(padrao5 || padrao20 || d.despachoModelo) ? `
      <div style="font-size:10px;color:#6b7280;margin-bottom:8px">
        ${padrao5 ? `Div/5: <strong>${esc(padrao5)}</strong>` : ''}
        ${padrao5 && padrao20 ? ' &nbsp;·&nbsp; ' : ''}
        ${padrao20 ? `Div/20: <strong>${esc(padrao20)}</strong>` : ''}
        ${(padrao5 || padrao20) && d.despachoModelo ? ' &nbsp;·&nbsp; ' : ''}
        ${d.despachoModelo ? `Despacho/Modelo: <strong>${esc(d.despachoModelo)}</strong>` : ''}
      </div>` : ''}
      <div style="display:grid;grid-template-columns:repeat(3,auto);gap:12px">
        ${ensaioTables}
      </div>
    </div>
  </div>`
}

export function printInterventionDetail(
  iv: PrintIntervention,
  workOrders: PrintWorkOrder[],
  company: PrintCompany,
  clientParts: PrintClientPart[] = [],
  ovms: PrintOVMEntry[] = []
): void {
  const statusColor = STATUS_COLOR[iv.status] ?? '#6b7280'
  const statusLabel = STATUS_LABEL[iv.status] ?? iv.status
  const statusBadge = `<span style="padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;background:${statusColor}22;color:${statusColor};border:1px solid ${statusColor}66">${statusLabel}</span>`

  const clientAddr = [iv.client.address, iv.client.postalCode, iv.client.city, iv.client.district, iv.client.country].filter(Boolean).map(esc).join(', ')
  const locAddr = iv.location ? [iv.location.address, iv.location.postalCode, iv.location.city, iv.location.district, iv.location.country].filter(Boolean).map(esc).join(', ') : ''

  const flags = [
    iv.bill ? '<span style="background:#dbeafe;color:#1d4ed8;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">Faturar</span>' : '',
    iv.contract ? '<span style="background:#dcfce7;color:#15803d;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">Contrato</span>' : '',
    iv.warranty ? '<span style="background:#fef9c3;color:#92400e;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">Garantia</span>' : '',
  ].filter(Boolean).join(' ')

  const infoRows = [
    `<tr><td class="lbl">Estado</td><td>${statusBadge}</td></tr>`,
    `<tr><td class="lbl">Referência</td><td style="font-family:monospace">${esc(iv.reference) || '—'}</td></tr>`,
    `<tr><td class="lbl">Criada em</td><td>${new Date(iv.createdAt).toLocaleDateString('pt-PT')}</td></tr>`,
    iv.createdBy ? `<tr><td class="lbl">Criada por</td><td>${esc(iv.createdBy.name)}</td></tr>` : '',
    iv.scheduledDate ? `<tr><td class="lbl">Agendada</td><td>${new Date(iv.scheduledDate).toLocaleDateString('pt-PT')}${iv.scheduledTime ? ` ${iv.scheduledTime}` : ''}</td></tr>` : '',
    iv.assignedTo ? `<tr><td class="lbl">Técnico</td><td style="font-weight:600">${esc(iv.assignedTo.name)}</td></tr>` : '',
    flags ? `<tr><td class="lbl">Flags</td><td>${flags}</td></tr>` : '',
  ].filter(Boolean).join('')

  const clientRows = [
    `<tr><td class="lbl">Cliente</td><td style="font-weight:600">${esc(iv.client.name)}</td></tr>`,
    iv.client.vatNumber ? `<tr><td class="lbl">NIF</td><td>${esc(iv.client.vatNumber)}</td></tr>` : '',
    clientAddr ? `<tr><td class="lbl">Morada</td><td>${clientAddr}</td></tr>` : '',
    iv.client.phone ? `<tr><td class="lbl">Telefone</td><td>${esc(iv.client.phone)}</td></tr>` : '',
    iv.client.contract ? `<tr><td class="lbl">Contrato</td><td>Sim${iv.client.contractDate ? ` — desde ${new Date(iv.client.contractDate).toLocaleDateString('pt-PT')}` : ''}</td></tr>` : '',
  ].filter(Boolean).join('')

  const locationRows = iv.location ? [
    `<tr><td class="lbl">Instalação</td><td style="font-weight:600">${esc(iv.location.name)}</td></tr>`,
    locAddr ? `<tr><td class="lbl">Morada</td><td>${locAddr}</td></tr>` : '',
    iv.location.equipment.length > 0 ? `<tr><td class="lbl">Equipamentos</td><td>${iv.location.equipment.map(eq =>
      `${esc(eq.equipmentType.name)} — ${esc(eq.brand.name)} ${esc(eq.model)}${eq.serialNumber ? ` <span style="font-family:monospace;font-size:10px;color:#6b7280">(${esc(eq.serialNumber)})</span>` : ''}`
    ).join('<br>')}</td></tr>` : '',
  ].filter(Boolean).join('') : ''

  const breakdownSection = iv.breakdown ? `
    <div class="section">Descrição / Avaria</div>
    <p style="white-space:pre-wrap;font-size:12px;line-height:1.6;color:#374151;padding:4px 0">${esc(iv.breakdown)}</p>` : ''

  const commentsSection = iv.comments ? `
    <div class="section">Comentários</div>
    <p style="white-space:pre-wrap;font-size:12px;line-height:1.6;color:#374151;padding:4px 0">${esc(iv.comments)}</p>` : ''

  const totalHours = workOrders.reduce((s, wo) => s + (wo.timeSpent ?? 0), 0)

  const woBlocks = workOrders.map(wo => {
    const typeColor = wo.internal ? '#1d4ed8' : '#c2410c'
    const typeBg = wo.internal ? '#eff6ff' : '#fff7ed'
    const typeBorder = wo.internal ? '#bfdbfe' : '#fed7aa'
    const typeLabel = wo.internal ? 'Interno' : 'Externo'
    const ivTypeLabel = wo.interventionType ? IV_TYPE_LABEL[wo.interventionType] ?? wo.interventionType : ''

    const metaItems = [
      wo.km ? `Km: ${wo.km}` : '',
      wo.fromAddress ? `Origem: ${esc(wo.fromAddress)}` : '',
      ivTypeLabel ? `Tipo: ${ivTypeLabel}` : '',
      wo.transportGuide ? `Guia: ${esc(wo.transportGuide)}` : '',
      wo.vehicles.length ? `Viatura: ${wo.vehicles.map(v => [v.plateNumber, v.brand, v.model].filter(Boolean).join(' ')).join(', ')}` : '',
      wo.helpers.length ? `Ajudantes: ${wo.helpers.map(h => esc(h.name)).join(', ')}` : '',
    ].filter(Boolean)

    const sessionRows = wo.sessions.map(s => `<tr>
      <td>${s.startDate ?? '—'}${s.startTime ? ` ${s.startTime}` : ''}</td>
      <td>${s.endDate ?? '—'}${s.endTime ? ` ${s.endTime}` : ''}</td>
      <td style="text-align:right;font-weight:600;color:#1d4ed8">${s.duration != null ? `${s.duration}h` : '—'}</td>
    </tr>`).join('')
    const sessionTotal = wo.sessions.reduce((s, x) => s + (x.duration ?? 0), 0)

    const partRows = wo.parts.map(p => {
      const sns = p.serialNumbers?.length ? ` <span style="font-size:10px;color:#7c3aed;font-family:monospace">SN: ${p.serialNumbers.map(s => esc(s.serialNumber)).join(', ')}</span>` : ''
      return `<tr><td>${esc(p.item.itemName)} <span style="font-size:10px;color:#6b7280">${esc(p.item.partNumber)}</span>${sns}</td><td style="text-align:center;width:50px">${p.quantity}</td></tr>`
    }).join('')

    return `
    <div class="wo-box">
      <div class="wo-head">
        ${wo.reference ? `<span style="font-family:monospace;font-weight:700;font-size:11px;color:#1e3a5f">${esc(wo.reference)}</span>` : ''}
        <span class="badge" style="background:${typeBg};color:${typeColor};border:1px solid ${typeBorder}">${typeLabel}</span>
        <span style="font-size:11px;color:#374151;flex:1;min-width:0">${esc(wo.description)}</span>
        ${wo.timeSpent ? `<span style="font-size:11px;font-weight:700;color:#1d4ed8;margin-left:auto;white-space:nowrap">${wo.timeSpent}h</span>` : ''}
        <span style="font-size:10px;color:#9ca3af;white-space:nowrap;margin-left:8px">${new Date(wo.createdAt).toLocaleDateString('pt-PT')} · ${esc(wo.createdBy.name)}</span>
      </div>
      ${metaItems.length ? `<div style="padding:5px 12px;font-size:11px;color:#6b7280;background:#fafafa;border-bottom:1px solid #e5e7eb">${metaItems.join(' &nbsp;·&nbsp; ')}</div>` : ''}
      ${wo.sessions.length > 0 ? `
      <div style="padding:8px 12px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:5px">Sessões</div>
        <table>
          <thead><tr><th>Início</th><th>Fim</th><th style="text-align:right">Horas</th></tr></thead>
          <tbody>${sessionRows}</tbody>
          <tfoot><tr>
            <td colspan="2" style="text-align:right;font-weight:700;border-top:1px solid #d1d5db">Total</td>
            <td style="text-align:right;font-weight:700;color:#1d4ed8;border-top:1px solid #d1d5db">${sessionTotal.toFixed(2)}h</td>
          </tr></tfoot>
        </table>
      </div>` : ''}
      ${wo.parts.length > 0 ? `
      <div style="padding:0 12px 8px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;margin:8px 0 4px">Peças Utilizadas</div>
        <table><thead><tr><th>Artigo</th><th style="text-align:center;width:50px">Qty</th></tr></thead>
        <tbody>${partRows}</tbody></table>
      </div>` : ''}
    </div>`
  }).join('')

  // Client parts (recolhas)
  const clientPartsSection = clientParts.length > 0 ? (() => {
    const rows = clientParts.map(p => {
      const isResolved = p.preSwapped || p.clientPartStatus === 'RESOLVED'
      const statusKey = p.preSwapped ? 'RESOLVED' : (p.clientPartStatus ?? '')
      const color = CLIENT_PART_STATUS_COLOR[statusKey] ?? '#6b7280'
      const statusText = p.preSwapped ? 'Resolvida' : (CLIENT_PART_STATUS_LABEL[statusKey] ?? statusKey)
      const badge = `<span style="padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;background:${color}22;color:${color};border:1px solid ${color}55">${statusText}</span>`

      const timeline = [
        p.createdAt ? `Recolha: ${new Date(p.createdAt).toLocaleDateString('pt-PT')}${p.technicianName ? ` — ${esc(p.technicianName)}` : ''}` : '',
        p.receivedAtWarehouseAt ? `Armazém: ${new Date(p.receivedAtWarehouseAt).toLocaleDateString('pt-PT')}${p.receivedAtWarehouseByName ? ` — ${esc(p.receivedAtWarehouseByName)}` : ''}` : '',
        p.sentOutAt ? `Saída: ${new Date(p.sentOutAt).toLocaleDateString('pt-PT')}${p.sentOutTechnicianName ? ` — ${esc(p.sentOutTechnicianName)}` : ''}` : '',
        p.returnedToClientAt ? `Devolução: ${new Date(p.returnedToClientAt).toLocaleDateString('pt-PT')}${p.returnedByName ? ` — ${esc(p.returnedByName)}` : ''}` : '',
      ].filter(Boolean).join(' &nbsp;›&nbsp; ')

      return `<tr>
        <td>
          <div style="font-weight:600">${esc(p.itemName)}</div>
          ${p.partNumber !== '__GENERIC__' ? `<div style="font-size:10px;color:#6b7280;font-family:monospace">${esc(p.partNumber)}</div>` : '<div style="font-size:10px;color:#d97706;font-weight:600">Genérico</div>'}
        </td>
        <td style="font-family:monospace;font-size:10px">${esc(p.serialNumber)}</td>
        <td style="font-size:11px;color:#374151">${esc(p.faultDescription)}</td>
        <td>${badge}${p.repairReference ? `<br><span style="font-family:monospace;font-size:10px;color:#1d4ed8">${esc(p.repairReference)}</span>` : ''}
        ${p.preSwapped ? '<br><span style="font-size:9px;font-weight:600;color:#15803d">Sub. Imediata</span>' : ''}</td>
        <td style="font-size:10px;color:#6b7280">${timeline}</td>
      </tr>`
    }).join('')

    return `
    <div class="section">Peças de Cliente (${clientParts.length})</div>
    <table>
      <thead><tr>
        <th style="width:22%">Artigo</th>
        <th style="width:12%">Nº Série</th>
        <th style="width:22%">Descrição avaria</th>
        <th style="width:14%">Estado</th>
        <th>Histórico</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`
  })() : ''

  // OVM sections
  const ovmSection = ovms.length > 0 ? `
    <div class="section">OVM (${ovms.length})</div>
    ${ovms.map((ovm, i) => renderOVMBlock(ovm, ovms.length - i, iv.location?.equipment)).join('')}
  ` : ''

  const subtitle = [iv.reference, iv.client.name, iv.scheduledDate ? new Date(iv.scheduledDate).toLocaleDateString('pt-PT') : ''].filter(Boolean).join(' — ')

  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>Intervenção ${esc(iv.reference ?? iv.id)}</title>
  <style>${STYLE}</style>
</head>
<body>
  ${companyHeader(company, 'Intervenção', subtitle)}

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:4px">
    <div>
      <div class="section" style="margin-top:0">Informação</div>
      <table class="info-table" style="width:auto"><tbody>${infoRows}</tbody></table>
    </div>
    <div>
      <div class="section" style="margin-top:0">Cliente</div>
      <table class="info-table" style="width:auto"><tbody>${clientRows}</tbody></table>
      ${locationRows ? `
      <div class="section">Instalação</div>
      <table class="info-table" style="width:auto"><tbody>${locationRows}</tbody></table>` : ''}
    </div>
  </div>

  ${breakdownSection}
  ${commentsSection}

  ${workOrders.length > 0 ? `
  <div class="section">Ordens de Trabalho (${workOrders.length}) &nbsp;·&nbsp; Total: ${totalHours.toFixed(2)}h</div>
  ${woBlocks}` : ''}

  ${clientPartsSection}
  ${ovmSection}
</body>
</html>`

  openPrint(html)
}
