export interface OpenIntervention {
  id: string
  reference: string | null
  status: string
  scheduledDate: string | null
  scheduledTime: string | null
  createdAt: string
  breakdown: string | null
  client: { name: string; city: string | null }
  location: { name: string; city: string | null } | null
  assignedTo: { name: string } | null
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Por Atribuir',
  ASSIGNED: 'Atribuída',
  IN_PROGRESS: 'Em Curso',
  QUALITY_ASSESSMENT: 'Controlo de Qualidade',
  COMPLETED: 'Concluída',
  CANCELED: 'Cancelada',
}

const STATUS_COLOR: Record<string, string> = {
  OPEN: '#b45309',          // amber
  ASSIGNED: '#c2410c',      // orange
  IN_PROGRESS: '#1d4ed8',   // blue
  QUALITY_ASSESSMENT: '#7c3aed', // purple
  COMPLETED: '#15803d',     // green
  CANCELED: '#b91c1c',      // red
}

function esc(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function printOpenInterventionsPDF(
  interventions: OpenIntervention[],
  filterLabel: string,
  companyName: string
) {
  const now = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const rows = interventions.map(iv => {
    const color = STATUS_COLOR[iv.status] ?? '#374151'
    const label = STATUS_LABEL[iv.status] ?? iv.status
    const location = iv.location
      ? `${esc(iv.location.name)}${iv.location.city ? ` — ${esc(iv.location.city)}` : ''}`
      : iv.client.city ? esc(iv.client.city) : '—'

    return `
      <tr>
        <td style="font-weight:600">${esc(iv.client.name)}</td>
        <td style="font-family:monospace;font-size:11px;color:#6b7280">${esc(iv.reference)}</td>
        <td>
          <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:${color}22;color:${color};border:1px solid ${color}88">
            ${label}
          </span>
        </td>
        <td>${location}</td>
        <td>${iv.scheduledDate ? `${fmtDate(iv.scheduledDate)}${iv.scheduledTime ? ' ' + iv.scheduledTime : ''}` : '<span style="color:#9ca3af">Não agendada</span>'}</td>
        <td>${iv.assignedTo ? esc(iv.assignedTo.name) : '<span style="color:#9ca3af">—</span>'}</td>
        <td style="max-width:240px;white-space:pre-wrap;word-break:break-word;font-size:12px;color:#374151">${esc(iv.breakdown)}</td>
      </tr>
    `
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>Intervenções — ${esc(filterLabel)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 24px; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 2px; }
    .meta { font-size: 12px; color: #6b7280; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th {
      background: #1e3a5f; color: #fff; font-size: 11px; font-weight: 600;
      text-transform: uppercase; letter-spacing: .04em;
      padding: 7px 10px; text-align: left;
    }
    td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    tr:nth-child(even) td { background: #f9fafb; }
    tr:last-child td { border-bottom: none; }
    .count { font-size: 12px; color: #6b7280; margin-bottom: 8px; }
    @media print {
      body { padding: 0; }
      @page { margin: 14mm 10mm; }
    }
  </style>
</head>
<body>
  <h1>${esc(companyName) || 'Intervenções'}</h1>
  <div class="meta">Filtro: <strong>${esc(filterLabel)}</strong> &nbsp;·&nbsp; Gerado em ${now}</div>
  <div class="count">${interventions.length} intervenç${interventions.length === 1 ? 'ão' : 'ões'}</div>
  <table>
    <thead>
      <tr>
        <th>Cliente</th>
        <th>Ref.</th>
        <th>Estado</th>
        <th>Local</th>
        <th>Agendado</th>
        <th>Técnico</th>
        <th>Descrição</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`

  const win = window.open('', '_blank', 'width=1100,height=800')
  if (!win) {
    alert('Por favor permita popups para gerar o PDF.')
    return
  }
  win.document.write(html)
  win.document.close()
  setTimeout(() => { win.focus(); win.print() }, 400)
}
