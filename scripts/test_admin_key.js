(async () => {
  try {
    // load .env.local for standalone script runs
    const fs = await import('fs')
    try {
      const envText = fs.readFileSync('.env.local', 'utf8')
      envText.split(/\r?\n/).forEach(line => {
        const m = line.match(/^\s*([A-Za-z0-9_]+)=(.*)\s*$/)
        if (m) {
          const k = m[1]
          let v = m[2]
          // strip optional surrounding quotes
          if ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1)
          }
          process.env[k] = v
        }
      })
    } catch (e) {
      // ignore if no file
    }
    const { createClient } = await import('@supabase/supabase-js')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    console.log('ENV key present=', !!key, 'len=', key ? key.length : 0)
    if (!url || !key) {
      console.error('Missing env vars NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
      process.exit(1)
    }
    const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data, error } = await supabase.from('profiles').select('*').limit(1)
    console.log('profiles select ->', { data, error })
  } catch (e) {
    console.error('script error', e)
  }
})()
