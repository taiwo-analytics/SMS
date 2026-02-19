(async () => {
  try {
    const fs = await import('fs')
    const { createClient } = await import('@supabase/supabase-js')
    try {
      const envText = fs.readFileSync('.env.local', 'utf8')
      envText.split(/\r?\n/).forEach(line => {
        const m = line.match(/^\s*([A-Za-z0-9_]+)=(.*)\s*$/)
        if (m) {
          const k = m[1]
          let v = m[2]
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
          process.env[k] = v
        }
      })
    } catch (e) {}

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      console.error('Missing env')
      process.exit(1)
    }
    const supabase = createClient(url, key)
    const id = process.argv[2]
    if (!id) {
      console.error('Usage: node scripts/query_teacher.js <id>')
      process.exit(1)
    }
    const { data, error } = await supabase.from('teachers').select('*').eq('id', id)
    console.log({ data, error })
  } catch (e) {
    console.error(e)
  }
})()
