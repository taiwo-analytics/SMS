import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  return NextResponse.json({
    ok: true,
    url: url.toString(),
    origin: url.origin,
    pathname: url.pathname,
    search: url.search,
    host: url.host,
    userAgent: req.headers.get('user-agent') || '',
    referer: req.headers.get('referer') || '',
  })
}

