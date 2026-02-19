(async () => {
  try {
    const fetch = globalThis.fetch || (await import('node-fetch')).default
    const base = 'http://localhost:3000'
    const ts = Date.now()
    const payload = {
      email: `test+teacher${ts}@example.com`,
      password: 'Test1234!',
      full_name: `Test Teacher ${ts}`,
      phone: '000',
      gender: 'Male'
    }

    console.log('Creating teacher:', payload.email)
    const createRes = await fetch(base + '/api/admin/users/teacher', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const createJson = await createRes.json()
    console.log('/api/admin/users/teacher', createRes.status, createJson)

    const listRes = await fetch(base + '/api/admin/users/list/teachers')
    const listJson = await listRes.json()
    console.log('/api/admin/users/list/teachers', listRes.status, 'count=', (listJson.teachers || []).length)
    const found = (listJson.teachers || []).find((t) => t.full_name === payload.full_name || t.user_id === createJson.userId)
    console.log('Found created?', !!found)
    if (found) console.log('Found record id:', found.id)
  } catch (e) {
    console.error(e)
  }
})()
