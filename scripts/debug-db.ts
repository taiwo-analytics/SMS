
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/)
        if (match) {
            const key = match[1].trim()
            const value = match[2].trim().replace(/^["'](.*)["']$/, '$1')
            process.env[key] = value
        }
    })
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('Checking configuration...')
console.log('URL:', supabaseUrl)
console.log('Service Key exists:', !!serviceRoleKey)

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing env vars')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
})

async function checkSchema() {
    console.log('\n--- Checking Tables ---')

    // Try to select from teachers
    const { data: teachers, error: teacherError } = await supabase
        .from('teachers')
        .select('*')
        .limit(1)

    if (teacherError) {
        console.error('Error querying teachers:', teacherError)
    } else {
        console.log('Successfully queried teachers table. Count:', teachers?.length)
    }

    const dummyEmail = `debug-${Date.now()}@example.com`
    console.log(`\n--- Attempting to create dummy user: ${dummyEmail} ---`)

    // Step 1: Create Auth User
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: dummyEmail,
        password: 'password123',
        email_confirm: true,
        user_metadata: { full_name: 'Debug User' }
    })

    if (authError) {
        console.error('Create User Error:', authError)
        return
    }

    const userId = authData.user.id
    console.log('User created:', userId)

    // Step 2: Check Profile (Trigger)
    console.log('Checking if profile was created by trigger...')
    // Wait a bit for trigger? usually instant but good to know.
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

    if (profileError) {
        console.error('Profile fetch error (Trigger might have failed):', profileError)
    } else {
        console.log('Profile found:', profile)
    }

    // Step 3: Insert Teacher
    console.log('\n--- Attempting to insert into teachers table with extra columns ---')
    const { error: insertError } = await supabase
        .from('teachers')
        .insert({
            user_id: userId,
            full_name: 'Debug Teacher',
            phone: '1234567890',
            gender: 'Other',
            address: 'Debug Address',
            status: 'Active',
            admission: '2024'
        })

    if (insertError) {
        console.error('Teachers Insert Error:', insertError)
    } else {
        console.log('Teachers Insert Success!')
    }

    // Cleanup
    console.log('\n--- Cleaning up ---')
    if (userId) {
        await supabase.auth.admin.deleteUser(userId)
        console.log('User deleted')
    }
}

checkSchema().catch(console.error)
