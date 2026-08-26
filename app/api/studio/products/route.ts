import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Product search for the live-shopping overlay.
//
// Amazon's Product Advertising API needs an Associates account with
// qualifying sales, so it can't be assumed present. When the credentials are
// configured this proxies PA-API; until then it searches the products already
// in the Hub and says plainly which mode it's in, rather than pretending to
// reach Amazon and quietly returning nothing.

export const dynamic = 'force-dynamic'

interface Product {
  id: string
  title: string
  price?: string | null
  imageUrl?: string | null
  url?: string | null
}

const PAAPI_CONFIGURED = () =>
  Boolean(process.env.AMAZON_ACCESS_KEY && process.env.AMAZON_SECRET_KEY && process.env.AMAZON_PARTNER_TAG)

export async function GET(req: NextRequest) {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: p } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'team') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const q = (new URL(req.url).searchParams.get('q') ?? '').trim()
  if (!q) return NextResponse.json({ products: [] })

  if (PAAPI_CONFIGURED()) {
    try {
      const products = await searchAmazon(q)
      return NextResponse.json({ products, source: 'amazon' })
    } catch (err) {
      return NextResponse.json({
        products: [],
        source: 'amazon',
        note: `Amazon search failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      })
    }
  }

  // Fall back to anything already catalogued in the Hub.
  const { data: ideas } = await sb
    .from('content_ideas')
    .select('id,title,source_url')
    .ilike('title', `%${q}%`)
    .limit(8)

  const products: Product[] = (ideas ?? []).map((i) => ({
    id: i.id,
    title: i.title,
    url: i.source_url,
  }))

  return NextResponse.json({
    products,
    source: 'local',
    note:
      'Searching the Hub only — Amazon search needs an Associates account. Add ' +
      'AMAZON_ACCESS_KEY, AMAZON_SECRET_KEY and AMAZON_PARTNER_TAG in Vercel to turn it on. ' +
      'You can also paste a product in by hand.',
  })
}

// PA-API 5.0 uses AWS SigV4. Implemented with Web Crypto so it runs on the
// edge runtime without pulling in the AWS SDK.
async function searchAmazon(keywords: string): Promise<Product[]> {
  const accessKey = process.env.AMAZON_ACCESS_KEY!
  const secretKey = process.env.AMAZON_SECRET_KEY!
  const partnerTag = process.env.AMAZON_PARTNER_TAG!
  const host = process.env.AMAZON_HOST || 'webservices.amazon.com'
  const region = process.env.AMAZON_REGION || 'us-east-1'
  const path = '/paapi5/searchitems'

  const payload = JSON.stringify({
    Keywords: keywords,
    SearchIndex: 'All',
    ItemCount: 8,
    PartnerTag: partnerTag,
    PartnerType: 'Associates',
    Marketplace: process.env.AMAZON_MARKETPLACE || 'www.amazon.com',
    Resources: ['Images.Primary.Medium', 'ItemInfo.Title', 'Offers.Listings.Price'],
  })

  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const target = 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems'

  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `host:${host}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:${target}\n`
  const signedHeaders = 'content-encoding;host;x-amz-date;x-amz-target'

  const canonicalRequest = [
    'POST', path, '', canonicalHeaders, signedHeaders, await sha256Hex(payload),
  ].join('\n')

  const scope = `${dateStamp}/${region}/ProductAdvertisingAPI/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(canonicalRequest),
  ].join('\n')

  const kDate = await hmac(`AWS4${secretKey}`, dateStamp)
  const kRegion = await hmac(kDate, region)
  const kService = await hmac(kRegion, 'ProductAdvertisingAPI')
  const kSigning = await hmac(kService, 'aws4_request')
  const signature = toHex(await hmac(kSigning, stringToSign))

  const res = await fetch(`https://${host}${path}`, {
    method: 'POST',
    headers: {
      'content-encoding': 'amz-1.0',
      'content-type': 'application/json; charset=utf-8',
      host,
      'x-amz-date': amzDate,
      'x-amz-target': target,
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body: payload,
  })

  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`)

  const data = await res.json()
  const items = data?.SearchResult?.Items ?? []
  return items.map((it: Record<string, any>) => ({
    id: it.ASIN,
    title: it.ItemInfo?.Title?.DisplayValue ?? 'Untitled',
    price: it.Offers?.Listings?.[0]?.Price?.DisplayAmount ?? null,
    imageUrl: it.Images?.Primary?.Medium?.URL ?? null,
    url: it.DetailPageURL ?? null,
  }))
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return toHex(new Uint8Array(buf))
}

async function hmac(key: string | Uint8Array, message: string): Promise<Uint8Array> {
  const raw = typeof key === 'string' ? new TextEncoder().encode(key) : key
  const cryptoKey = await crypto.subtle.importKey(
    'raw', raw as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message))
  return new Uint8Array(sig)
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}
