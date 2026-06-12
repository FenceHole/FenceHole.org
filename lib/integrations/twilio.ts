// Thin client for Twilio's WhatsApp API. Requires TWILIO_ACCOUNT_SID,
// TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_NUMBER (e.g. "whatsapp:+14155238886").

function authHeader(): string {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) throw new Error('TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN are not configured')
  return 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64')
}

export async function fetchTwilioMedia(url: string): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  const res = await fetch(url, { headers: { Authorization: authHeader() } })
  if (!res.ok) throw new Error(`Failed to fetch WhatsApp media: ${res.status}`)
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream'
  const buffer = await res.arrayBuffer()
  return { buffer, contentType }
}

export async function sendWhatsApp(to: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const from = process.env.TWILIO_WHATSAPP_NUMBER
  if (!sid || !from) throw new Error('TWILIO_ACCOUNT_SID / TWILIO_WHATSAPP_NUMBER are not configured')

  const params = new URLSearchParams({ From: from, To: to, Body: body })
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Twilio send error ${res.status}: ${text}`)
  }
}
