(async () => {
  try {
    const fetch = globalThis.fetch || (await import('node-fetch')).default
    const base = 'http://localhost:3000'
    for (const path of ['/api/admin/users/list/teachers', '/api/admin/users/list/students']) {
      try {
        const res = await fetch(base + path)
        const json = await res.json()
        console.log(path, res.status, JSON.stringify(json).slice(0, 1000))
      } catch (e) {
        console.error('error calling', path, e)
      }
    }
  } catch (e) {
    console.error(e)
  }
})()
