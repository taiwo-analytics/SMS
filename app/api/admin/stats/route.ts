import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireApiRole } from '@/lib/api-auth'

export const runtime = 'nodejs'

export async function GET() {
    const auth = await requireApiRole(['admin'])
    if (!auth.authorized) return auth.response

    try {
        const supabaseAdmin = getSupabaseAdmin()

        const [teachersRes, studentsRes, classesRes] = await Promise.all([
            supabaseAdmin.from('teachers').select('id', { count: 'exact', head: true }),
            supabaseAdmin.from('students').select('id', { count: 'exact', head: true }),
            supabaseAdmin.from('classes').select('id', { count: 'exact', head: true }),
        ])

        let parentsCount = 0
        try {
            const parentsRes = await supabaseAdmin.from('parents').select('id', { count: 'exact', head: true })
            parentsCount = parentsRes.count ?? 0
        } catch {
            parentsCount = 0
        }

        return NextResponse.json({
            teachers: teachersRes.count ?? 0,
            students: studentsRes.count ?? 0,
            classes: classesRes.count ?? 0,
            parents: parentsCount,
        })
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
    }
}
