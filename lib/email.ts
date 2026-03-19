/**
 * Microsoft Graph API email service.
 *
 * Required environment variables:
 *   MICROSOFT_TENANT_ID
 *   MICROSOFT_CLIENT_ID
 *   MICROSOFT_CLIENT_SECRET
 *   MICROSOFT_SENDER_EMAIL
 *
 * Azure setup:
 *   1. Azure Portal → Azure AD → App registrations → New registration
 *   2. API permissions → Microsoft Graph → Application permissions → Mail.Send
 *   3. Grant admin consent for the permission
 *   4. Certificates & secrets → New client secret → copy value
 *   5. Overview page → copy Application (client) ID and Directory (tenant) ID
 */

export interface EmailAttachment {
  name: string
  contentType: string
  /** Base-64 encoded content */
  content: string
}

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  /** HTML body — plain text falls back to a <pre> wrapped version */
  body: string
  isHtml?: boolean
  attachments?: EmailAttachment[]
  cc?: string | string[]
}

// Simple in-process token cache (server-side, lives until process restarts or token expires)
let cachedToken: { value: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.value
  }

  const tenantId = process.env.MICROSOFT_TENANT_ID
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Microsoft Graph email credentials not configured (MICROSOFT_TENANT_ID / MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET)')
  }

  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to obtain Microsoft access token: ${res.status} ${text}`)
  }

  const json = await res.json() as { access_token: string; expires_in: number }
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  }
  return cachedToken.value
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const sender = process.env.MICROSOFT_SENDER_EMAIL
  if (!sender) {
    throw new Error('MICROSOFT_SENDER_EMAIL is not configured')
  }

  const toAddresses = Array.isArray(opts.to) ? opts.to : [opts.to]
  const ccAddresses = opts.cc ? (Array.isArray(opts.cc) ? opts.cc : [opts.cc]) : []

  const toRecipients = toAddresses.map(addr => ({
    emailAddress: { address: addr },
  }))
  const ccRecipients = ccAddresses.map(addr => ({
    emailAddress: { address: addr },
  }))

  const message: Record<string, unknown> = {
    subject: opts.subject,
    body: {
      contentType: opts.isHtml !== false ? 'HTML' : 'Text',
      content: opts.body,
    },
    toRecipients,
    ...(ccRecipients.length > 0 ? { ccRecipients } : {}),
  }

  if (opts.attachments?.length) {
    message.attachments = opts.attachments.map(a => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: a.name,
      contentType: a.contentType,
      contentBytes: a.content,
    }))
  }

  const token = await getAccessToken()
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, saveToSentItems: true }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Graph API sendMail failed: ${res.status} ${text}`)
  }
}
