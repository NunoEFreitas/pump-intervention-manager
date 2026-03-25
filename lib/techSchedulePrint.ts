interface Place {
  name: string
  address: string | null
  city: string | null
  postalCode: string | null
  phone: string | null
  contactPerson: string | null
}

export interface ScheduleIntervention {
  id: string
  reference: string | null
  status: string
  scheduledDate: string | null
  scheduledTime: string | null
  breakdown: string | null
  comments: string | null
  client: Place
  location: Place | null
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Por Atribuir', ASSIGNED: 'Atribuída', IN_PROGRESS: 'Em Curso',
  PENDING_PARTS: 'Aguarda Peças',
  QUALITY_ASSESSMENT: 'Controlo de Qualidade', COMPLETED: 'Concluída', CANCELED: 'Cancelada',
}
const STATUS_COLOR: Record<string, string> = {
  OPEN: '#b45309', ASSIGNED: '#c2410c', IN_PROGRESS: '#1d4ed8',
  PENDING_PARTS: '#e11d48',
  QUALITY_ASSESSMENT: '#7c3aed', COMPLETED: '#15803d', CANCELED: '#b91c1c',
}

function esc(s?: string | null) {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function addressBlock(place: Place): string {
  const lines: string[] = []
  if (place.address) lines.push(esc(place.address))
  const cityLine = [place.postalCode, place.city].filter(Boolean).map(esc).join(' ')
  if (cityLine) lines.push(cityLine)
  if (place.phone) lines.push(`📞 ${esc(place.phone)}`)
  if (place.contactPerson) lines.push(`👤 ${esc(place.contactPerson)}`)
  return lines.join('<br>')
}

function buildRow(iv: ScheduleIntervention): string {
  const color = STATUS_COLOR[iv.status] ?? '#374151'
  const label = STATUS_LABEL[iv.status] ?? iv.status
  const place = iv.location ?? iv.client
  const placeName = iv.location ? `<strong>${esc(iv.location.name)}</strong><br>` : ''
  return `
    <tr>
      <td style="font-weight:700;font-size:15px;text-align:center;white-space:nowrap;color:#1e3a5f">${esc(iv.scheduledTime) || '—'}</td>
      <td style="word-break:break-word;white-space:normal">
        <div style="font-weight:700;font-size:13px">${esc(iv.client.name)}</div>
        ${iv.reference ? `<div style="font-family:monospace;font-size:10px;color:#9ca3af">${esc(iv.reference)}</div>` : ''}
      </td>
      <td style="font-size:12px;line-height:1.5;word-break:break-word;white-space:normal">
        ${placeName}${addressBlock(place)}
      </td>
      <td>
        <span style="display:inline-block;padding:2px 7px;border-radius:999px;font-size:10px;font-weight:600;background:${color}22;color:${color};border:1px solid ${color}88">${label}</span>
      </td>
      <td style="font-size:12px;color:#374151;white-space:pre-wrap;word-break:break-word">${esc(iv.breakdown)}</td>
      <td style="font-size:12px;color:#6b21a8;white-space:pre-wrap;word-break:break-word">${iv.comments ? esc(iv.comments) : '<span style="color:#d1d5db">—</span>'}</td>
    </tr>`
}

const COLGROUP = `
  <colgroup>
    <col style="width:6%">
    <col style="width:16%">
    <col style="width:22%">
    <col style="width:11%">
    <col style="width:23%">
    <col style="width:22%">
  </colgroup>`

const TH_STYLE = `background:#1e3a5f;color:#fff;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;padding:6px 8px;text-align:left`

const THEAD = `
  <thead>
    <tr>
      <th style="${TH_STYLE}">Hora</th>
      <th style="${TH_STYLE}">Cliente</th>
      <th style="${TH_STYLE}">Local / Morada</th>
      <th style="${TH_STYLE}">Estado</th>
      <th style="${TH_STYLE}">Descrição</th>
      <th style="${TH_STYLE}">Comentários</th>
    </tr>
  </thead>`

const SHARED_STYLE = `
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:Arial,sans-serif; font-size:13px; color:#111; padding:24px; }
  table { width:100%; border-collapse:collapse; table-layout:fixed; }
  td { padding:8px 8px; border-bottom:1px solid #e5e7eb; vertical-align:top; overflow-wrap:break-word; }
  tr:nth-child(even) td { background:#f9fafb; }
  tr:last-child td { border-bottom:none; }
  @media print { body { padding:0; } @page { margin:14mm 10mm; } }
`

export function printTechDaySchedule(techName: string, items: ScheduleIntervention[], dateLabel: string) {
  const sorted = [...items].sort((a, b) => {
    const ta = a.scheduledTime ?? '00:00'
    const tb = b.scheduledTime ?? '00:00'
    return ta.localeCompare(tb)
  })

  const rows = sorted.map(buildRow).join('')

  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>Agenda — ${esc(techName)}</title>
  <style>${SHARED_STYLE}</style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:16px;border-bottom:2px solid #1e3a5f;padding-bottom:10px">
    <div>
      <h1 style="font-size:22px;font-weight:700;color:#1e3a5f">${esc(techName)}</h1>
      <div style="font-size:14px;color:#6b7280;margin-top:2px">Agenda do dia — ${esc(dateLabel)}</div>
    </div>
    <div style="font-size:14px;color:#6b7280">${sorted.length} intervenç${sorted.length === 1 ? 'ão' : 'ões'}</div>
  </div>
  <table>${COLGROUP}${THEAD}<tbody>${rows}</tbody></table>
</body>
</html>`

  const win = window.open('', '_blank', 'width=1050,height=750')
  if (!win) { alert('Por favor permita popups para imprimir.'); return }
  win.document.write(html)
  win.document.close()
  setTimeout(() => { win.focus(); win.print() }, 400)
}

export function printAllTechsDaySchedule(
  techs: { id: string; name: string; items: ScheduleIntervention[] }[],
  dateLabel: string
) {
  const pages = techs.map(({ name, items }, i) => {
    const sorted = [...items].sort((a, b) => (a.scheduledTime ?? '').localeCompare(b.scheduledTime ?? ''))
    const rows = sorted.map(buildRow).join('')
    const pageBreak = i < techs.length - 1 ? 'page-break-after:always;' : ''

    return `
      <div style="${pageBreak}padding:24px 0">
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:16px;border-bottom:2px solid #1e3a5f;padding-bottom:10px">
          <div>
            <h1 style="font-size:22px;font-weight:700;color:#1e3a5f;margin:0">${esc(name)}</h1>
            <div style="font-size:14px;color:#6b7280;margin-top:2px">Agenda do dia — ${esc(dateLabel)}</div>
          </div>
          <div style="font-size:14px;color:#6b7280">${sorted.length} intervenç${sorted.length === 1 ? 'ão' : 'ões'}</div>
        </div>
        ${sorted.length === 0
          ? `<p style="color:#9ca3af;font-size:14px">Sem intervenções agendadas.</p>`
          : `<table style="width:100%;border-collapse:collapse;table-layout:fixed">${COLGROUP}${THEAD}<tbody>${rows}</tbody></table>`
        }
      </div>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>Agendas do dia — ${esc(dateLabel)}</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:Arial,sans-serif; font-size:13px; color:#111; }
    td { padding:8px 8px; border-bottom:1px solid #e5e7eb; vertical-align:top; overflow-wrap:break-word; }
    tr:nth-child(even) td { background:#f9fafb; }
    tr:last-child td { border-bottom:none; }
    @media print { @page { margin:14mm 10mm; } }
  </style>
</head>
<body>${pages}</body>
</html>`

  const win = window.open('', '_blank', 'width=1050,height=750')
  if (!win) { alert('Por favor permita popups para imprimir.'); return }
  win.document.write(html)
  win.document.close()
  setTimeout(() => { win.focus(); win.print() }, 400)
}
