const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ADMIN_EMAIL = 'admin@school.com'
const ADMIN_PASSWORD = 'Admin@123'

async function createAdmin() {
  console.log('Supabase URL:', supabaseUrl)
  console.log('Creating admin user...')

  // First, try to list users to check if connection works
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) {
    console.error('Failed to connect to Supabase Auth:', listError.message)
    console.error('This likely means your API keys are incorrect.')
    process.exit(1)
  }
  console.log(`Connected successfully. ${listData.users.length} existing user(s) found.`)

  // Check if admin already exists
  const existing = listData.users.find(u => u.email === ADMIN_EMAIL)
  if (existing) {
    console.log(`User ${ADMIN_EMAIL} already exists (id: ${existing.id})`)
    console.log('Updating password and ensuring admin role...')

    // Update password
    const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
      password: ADMIN_PASSWORD,
    })
    if (updateError) {
      console.error('Failed to update password:', updateError.message)
    } else {
      console.log('Password updated.')
    }

    // Ensure profile has admin role
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: existing.id, role: 'admin', full_name: 'Admin' }, { onConflict: 'id' })

    if (profileError) {
      console.error('Failed to update profile:', profileError.message)
    } else {
      console.log('Profile set to admin role.')
    }
  } else {
    // Create new user
    const { data, error } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Admin' },
    })

    if (error) {
      console.error('Failed to create user:', error.message)
      process.exit(1)
    }

    console.log(`User created: ${data.user.id}`)

    // Set profile to admin
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: data.user.id, role: 'admin', full_name: 'Admin' }, { onConflict: 'id' })

    if (profileError) {
      console.error('Failed to set admin role:', profileError.message)
    } else {
      console.log('Profile set to admin role.')
    }
  }

  console.log('\n--- Admin Login Details ---')
  console.log(`Email:    ${ADMIN_EMAIL}`)
  console.log(`Password: ${ADMIN_PASSWORD}`)
  console.log('---------------------------')
}

createAdmin().catch(console.error)
