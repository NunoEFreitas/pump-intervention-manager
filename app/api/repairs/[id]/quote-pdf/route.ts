import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Accept token from Authorization header or ?token= query param (for window.open)
    const headerToken = request.headers.get('authorization')?.replace('Bearer ', '')
    const queryToken = new URL(request.url).searchParams.get('token') || ''
    const token = headerToken || queryToken

    if (!verifyToken(token)) return new NextResponse('Unauthorized', { status: 401 })

    const { id } = await params

    const [job] = await prisma.$queryRaw<any[]>`
      SELECT
        j.id, j.reference, j.type, j."itemId", j.status,
        j.problem, j."workNotes",
        j."quoteAmount", j."quoteNotes", j."quoteStatus", j."quotedAt",
        j."sentAt", j."deliveredToClientId",
        wi."itemName", wi."partNumber",
        sn."serialNumber" AS "snNumber",
        sb.name AS "sentByName",
        cl.name AS "clientName"
      FROM "PartRepairJob" j
      JOIN "WarehouseItem" wi ON wi.id = j."itemId"
      LEFT JOIN "SerialNumberStock" sn ON sn.id = j."serialNumberId"
      LEFT JOIN "User" sb ON sb.id = j."sentById"
      LEFT JOIN "Client" cl ON cl.id = j."deliveredToClientId"
      WHERE j.id = ${id}
    `

    if (!job) return new NextResponse('Not found', { status: 404 })
    if (!job.quoteAmount) return new NextResponse('No quote for this repair', { status: 400 })

    const date = job.quotedAt ? new Date(job.quotedAt).toLocaleDateString('pt-PT') : new Date().toLocaleDateString('pt-PT')
    const amount = parseFloat(job.quoteAmount).toFixed(2)
    const quoteStatusLabel = job.quoteStatus === 'ACCEPTED' ? 'Aceite pelo cliente' : job.quoteStatus === 'REJECTED' ? 'Rejeitado pelo cliente' : 'Pendente de aprovação'

    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Orçamento ${job.reference ?? job.id}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1a1a; background: #fff; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; border-bottom: 2px solid #2563eb; padding-bottom: 20px; }
    .company { font-size: 22px; font-weight: 700; color: #2563eb; }
    .doc-title { text-align: right; }
    .doc-title h1 { font-size: 20px; font-weight: 700; color: #1e293b; }
    .doc-title .ref { font-size: 13px; color: #64748b; margin-top: 4px; font-family: monospace; }
    .doc-title .date { font-size: 12px; color: #64748b; margin-top: 2px; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 32px; }
    .info-item label { font-size: 11px; color: #94a3b8; display: block; margin-bottom: 2px; }
    .info-item span { font-weight: 600; color: #1e293b; }
    .description { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; line-height: 1.6; white-space: pre-wrap; margin-top: 6px; }
    .amount-box { background: #eff6ff; border: 2px solid #2563eb; border-radius: 8px; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
    .amount-label { font-size: 13px; color: #1e40af; font-weight: 600; }
    .amount-value { font-size: 28px; font-weight: 800; color: #1e40af; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .status-pending { background: #fef9c3; color: #854d0e; }
    .status-accepted { background: #dcfce7; color: #166534; }
    .status-rejected { background: #fee2e2; color: #991b1b; }
    .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
    .signature-area { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
    .sig-box { border-top: 1px solid #cbd5e1; padding-top: 8px; font-size: 11px; color: #64748b; }
    @media print { body { padding: 20px; } @page { margin: 15mm; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="company">Gestão de Reparações</div>
    <div class="doc-title">
      <h1>Orçamento</h1>
      <div class="ref">${job.reference ?? job.id}</div>
      <div class="date">Data: ${date}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Informação da Reparação</div>
    <div class="info-grid">
      <div class="info-item"><label>Artigo</label><span>${job.itemName}</span></div>
      <div class="info-item"><label>Referência</label><span>${job.partNumber}</span></div>
      ${job.snNumber ? `<div class="info-item"><label>Nº Série</label><span>${job.snNumber}</span></div>` : ''}
      ${job.clientName ? `<div class="info-item"><label>Cliente</label><span>${job.clientName}</span></div>` : ''}
      ${job.sentByName ? `<div class="info-item"><label>Criado por</label><span>${job.sentByName}</span></div>` : ''}
      <div class="info-item"><label>Estado do Orçamento</label><span>
        <span class="status-badge ${job.quoteStatus === 'ACCEPTED' ? 'status-accepted' : job.quoteStatus === 'REJECTED' ? 'status-rejected' : 'status-pending'}">${quoteStatusLabel}</span>
      </span></div>
    </div>
  </div>

  ${job.problem ? `
  <div class="section">
    <div class="section-title">Descrição do Problema</div>
    <div class="description">${job.problem}</div>
  </div>` : ''}

  <div class="section">
    <div class="section-title">Trabalho e Materiais Incluídos</div>
    <div class="description">${job.quoteNotes}</div>
  </div>

  <div class="section">
    <div class="section-title">Valor Total</div>
    <div class="amount-box">
      <div class="amount-label">Total (IVA incluído)</div>
      <div class="amount-value">€${amount}</div>
    </div>
  </div>

  <div class="signature-area">
    <div class="sig-box">Assinatura do técnico<br/><br/><br/>___________________________</div>
    <div class="sig-box">Aprovação do cliente<br/><br/><br/>___________________________</div>
  </div>

  <div class="footer">Orçamento gerado em ${new Date().toLocaleString('pt-PT')} · Válido por 30 dias</div>

  <script>
    window.onload = function() { window.print(); }
  </script>
</body>
</html>`

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (error) {
    console.error('Error generating quote PDF:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
