import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

async function getCallerInfo(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role
  let teacherId: string | null = null
  if (role === 'teacher') {
    const { data: teacher } = await supabase.from('teachers').select('id').eq('user_id', user.id).single()
    teacherId = teacher?.id || null
  }
  return { userId: user.id, role, teacherId }
}

// POST: Upload signature and apply to all students in a class for a term
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const caller = await getCallerInfo(supabase)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (caller.role !== 'admin' && caller.role !== 'teacher') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const classId = formData.get('class_id') as string
  const termId = formData.get('term_id') as string
  const signatureType = formData.get('type') as string // 'class_teacher' or 'principal'

  if (!file || !classId || !termId || !signatureType) {
    return NextResponse.json({ error: 'Missing required fields (file, class_id, term_id, type)' }, { status: 400 })
  }

  // Validate type
  if (signatureType !== 'class_teacher' && signatureType !== 'principal') {
    return NextResponse.json({ error: 'type must be class_teacher or principal' }, { status: 400 })
  }

  // Access check
  const admin = getSupabaseAdmin()
  if (signatureType === 'class_teacher') {
    if (caller.role !== 'teacher' && caller.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (caller.role === 'teacher') {
      const { data: cls } = await admin.from('classes').select('class_teacher_id').eq('id', classId).single()
      if (cls?.class_teacher_id !== caller.teacherId) {
        return NextResponse.json({ error: 'Forbidden – not the class teacher' }, { status: 403 })
      }
    }
  } else if (signatureType === 'principal') {
    if (caller.role !== 'admin') {
      return NextResponse.json({ error: 'Only admin can upload principal signature' }, { status: 403 })
    }
  }

  // Upload file to storage
  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split('.').pop() || 'png'
  const path = `signatures/${signatureType}_${classId}_${termId}.${ext}`

  const { error: uploadError } = await admin.storage
    .from('student-photos')
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: urlData } = admin.storage.from('student-photos').getPublicUrl(path)
  const signatureUrl = urlData.publicUrl

  // Get all enrolled students in this class
  const { data: enrollments } = await admin
    .from('class_enrollments')
    .select('student_id')
    .eq('class_id', classId)

  if (!enrollments || enrollments.length === 0) {
    return NextResponse.json({ error: 'No students enrolled in this class' }, { status: 400 })
  }

  const field = signatureType === 'class_teacher' ? 'class_teacher_signature_url' : 'principal_signature_url'

  // Upsert report_remarks for each student with the signature
  let successCount = 0
  for (const enrollment of enrollments) {
    const { error } = await admin
      .from('report_remarks')
      .upsert(
        { student_id: enrollment.student_id, class_id: classId, term_id: termId, [field]: signatureUrl },
        { onConflict: 'student_id,class_id,term_id' }
      )
    if (!error) successCount++
  }

  return NextResponse.json({
    success: true,
    signature_url: signatureUrl,
    applied_to: successCount,
    total_students: enrollments.length,
  })
}
