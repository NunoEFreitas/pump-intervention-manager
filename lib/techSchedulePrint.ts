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
  client: Place
  location: Place | null
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Por Atribuir', ASSIGNED: 'Atribuída', IN_PROGRESS: 'Em Curso',
  QUALITY_ASSESSMENT: 'Controlo de Qualidade', COMPLETED: 'Concluída', CANCELED: 'Cancelada',
}
const STATUS_COLOR: Record<string, string> = {
  OPEN: '#b45309', ASSIGNED: '#c2410c', IN_PROGRESS: '#1d4ed8',
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

export function printTechDaySchedule(techName: string, items: ScheduleIntervention[], dateLabel: string) {
  const sorted = [...items].sort((a, b) => {
    const ta = a.scheduledTime ?? '00:00'
    const tb = b.scheduledTime ?? '00:00'
    return ta.localeCompare(tb)
  })

  const rows = sorted.map(iv => {
    const color = STATUS_COLOR[iv.status] ?? '#374151'
    const label = STATUS_LABEL[iv.status] ?? iv.status
    const place = iv.location ?? iv.client
    const placeName = iv.location ? `<strong>${esc(iv.location.name)}</strong><br>` : ''
    return `
      <tr>
        <td style="font-weight:700;font-size:16px;text-align:center;white-space:nowrap;color:#1e3a5f;width:52px">${esc(iv.scheduledTime) || '—'}</td>
        <td>
          <div style="font-weight:700;font-size:13px">${esc(iv.client.name)}</div>
          ${iv.reference ? `<div style="font-family:monospace;font-size:11px;color:#9ca3af">${esc(iv.reference)}</div>` : ''}
        </td>
        <td style="font-size:12px;line-height:1.5">
          ${placeName}${addressBlock(place)}
        </td>
        <td style="white-space:nowrap">
          <span style="display:inline-block;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:600;background:${color}22;color:${color};border:1px solid ${color}88">${label}</span>
        </td>
        <td style="font-size:12px;color:#374151;max-width:200px;white-space:pre-wrap;word-break:break-word">${esc(iv.breakdown)}</td>
      </tr>`
  }).join('')

  const SHARED_STYLE = `
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:Arial,sans-serif; font-size:13px; color:#111; padding:24px; }
    table { width:100%; border-collapse:collapse; }
    th { background:#1e3a5f; color:#fff; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.04em; padding:7px 10px; text-align:left; }
    td { padding:9px 10px; border-bottom:1px solid #e5e7eb; vertical-align:top; }
    tr:nth-child(even) td { background:#f9fafb; }
    tr:last-child td { border-bottom:none; }
    @media print { body { padding:0; } @page { margin:14mm 10mm; } }
  `

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
  <table>
    <thead>
      <tr>
        <th>Hora</th><th>Cliente</th><th>Local / Morada</th><th>Estado</th><th>Descrição</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`

  const win = window.open('', '_blank', 'width=950,height=750')
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
    const rows = sorted.map(iv => {
      const color = STATUS_COLOR[iv.status] ?? '#374151'
      const label = STATUS_LABEL[iv.status] ?? iv.status
      const place = iv.location ?? iv.client
      const placeName = iv.location ? `<strong>${esc(iv.location.name)}</strong><br>` : ''
      return `
        <tr>
          <td style="font-weight:700;font-size:16px;text-align:center;white-space:nowrap;color:#1e3a5f;width:52px">${esc(iv.scheduledTime) || '—'}</td>
          <td>
            <div style="font-weight:700;font-size:13px">${esc(iv.client.name)}</div>
            ${iv.reference ? `<div style="font-family:monospace;font-size:11px;color:#9ca3af">${esc(iv.reference)}</div>` : ''}
          </td>
          <td style="font-size:12px;line-height:1.5">
            ${placeName}${addressBlock(place)}
          </td>
          <td style="white-space:nowrap">
            <span style="display:inline-block;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:600;background:${color}22;color:${color};border:1px solid ${color}88">${label}</span>
          </td>
          <td style="font-size:12px;color:#374151;max-width:200px;white-space:pre-wrap;word-break:break-word">${esc(iv.breakdown)}</td>
        </tr>`
    }).join('')

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
          : `<table style="width:100%;border-collapse:collapse">
              <thead>
                <tr>
                  <th style="background:#1e3a5f;color:#fff;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;padding:7px 10px;text-align:left">Hora</th>
                  <th style="background:#1e3a5f;color:#fff;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;padding:7px 10px;text-align:left">Cliente</th>
                  <th style="background:#1e3a5f;color:#fff;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;padding:7px 10px;text-align:left">Local / Morada</th>
                  <th style="background:#1e3a5f;color:#fff;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;padding:7px 10px;text-align:left">Estado</th>
                  <th style="background:#1e3a5f;color:#fff;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;padding:7px 10px;text-align:left">Descrição</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>`
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
    td { padding:9px 10px; border-bottom:1px solid #e5e7eb; vertical-align:top; }
    tr:nth-child(even) td { background:#f9fafb; }
    tr:last-child td { border-bottom:none; }
    @media print { @page { margin:14mm 10mm; } }
  </style>
</head>
<body>${pages}</body>
</html>`

  const win = window.open('', '_blank', 'width=950,height=750')
  if (!win) { alert('Por favor permita popups para imprimir.'); return }
  win.document.write(html)
  win.document.close()
  setTimeout(() => { win.focus(); win.print() }, 400)
}
