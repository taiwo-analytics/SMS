'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

const SCHOOL_NAME = 'ACME INTERNATIONAL COLLEGE'
const SCHOOL_ADDRESS = 'P.M.B. 001, Acme Avenue, Nigeria'
const SCHOOL_MOTTO = 'Excellence in Education'
const SCHOOL_TEL = 'Tel: +234 000 000 0000'

export default function AdminReportCardPage() {
  const params = useParams()
  const router = useRouter()
  const search = useSearchParams()
  const studentId = String(params.id || '')
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<any | null>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [sessionId, setSessionId] = useState<string>('')
  const [allTerms, setAllTerms] = useState<any[]>([])
  const [terms, setTerms] = useState<any[]>([])
  const [termId, setTermId] = useState<string>(search.get('term_id') || '')
  const [principalRemark, setPrincipalRemark] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const [{ data: sessionsData }, { data: termsData }] = await Promise.all([
          supabase.from('academic_sessions').select('*').order('created_at', { ascending: false }),
          supabase.from('academic_terms').select('*').order('created_at', { ascending: false }),
        ])
        setSessions(sessionsData || [])
        setAllTerms(termsData || [])

        // If a term_id was passed via URL, derive the session from it
        const preselectedTermId = search.get('term_id') || ''
        if (preselectedTermId) {
          const matched = (termsData || []).find((t: any) => t.id === preselectedTermId)
          if (matched?.session_id) {
            setSessionId(matched.session_id)
            setTerms((termsData || []).filter((t: any) => t.session_id === matched.session_id))
            setTermId(preselectedTermId)
            return
          }
        }

        // Otherwise default to active session + active term
        const activeSession = (sessionsData || []).find((s: any) => s.is_active)
        if (activeSession) {
          setSessionId(activeSession.id)
          const filtered = (termsData || []).filter((t: any) => t.session_id === activeSession.id)
          setTerms(filtered)
          const activeTerm = filtered.find((t: any) => t.is_active)
          if (activeTerm) setTermId(activeTerm.id)
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // When session changes, re-filter terms and reset term selection
  useEffect(() => {
    if (!sessionId) { setTerms([]); setTermId(''); return }
    const filtered = allTerms.filter((t: any) => t.session_id === sessionId)
    setTerms(filtered)
    setTermId('')
  }, [sessionId])

  useEffect(() => {
    if (!studentId || !termId) return
    ;(async () => {
      try {
        const res = await fetch(`/api/results/report-card?student_id=${studentId}&term_id=${termId}`)
        const js = await res.json()
        if (res.ok) {
          setReport(js.report)
          setPrincipalRemark(js.report?.principal_remark || '')
        }
      } catch {}
    })()
  }, [studentId, termId])

  const onPrint = () => window.print()

  const savePrincipalRemark = async () => {
    if (!report?.class?.id) return
    setSaving(true)
    try {
      await fetch('/api/results/report-card', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          class_id: report.class.id,
          term_id: termId,
          principal_remark: principalRemark,
        }),
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-100">
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
          @page { size: A4 portrait; margin: 10mm; }
          .report-card { box-shadow: none !important; margin: 0 !important; }
        }
        .report-card {
          font-family: 'Times New Roman', Times, serif;
        }
        .rc-table th, .rc-table td {
          border: 1px solid #333;
          padding: 3px 6px;
          font-size: 11px;
        }
        .rc-table th {
          background-color: #1a1a2e;
          color: white;
          text-align: center;
        }
        .bio-table td {
          border: 1px solid #555;
          padding: 3px 6px;
          font-size: 11px;
        }
        .section-title {
          background-color: #1a1a2e;
          color: white;
          font-weight: bold;
          font-size: 11px;
          padding: 4px 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .grade-a { color: #15803d; font-weight: bold; }
        .grade-f { color: #dc2626; font-weight: bold; }
        .stamp-box {
          border: 2px dashed #999;
          width: 100px;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          color: #aaa;
          font-style: italic;
        }
      `}</style>

      {/* Controls bar */}
      <div className="no-print sticky top-0 bg-white border-b z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <button onClick={() => router.back()} className="px-3 py-2 border rounded text-sm hover:bg-gray-50">
            ← Back
          </button>
          <div className="ml-auto flex items-center gap-3 flex-wrap">
            <select
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="px-3 py-2 border rounded text-sm"
            >
              <option value="">Select session</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select
              value={termId}
              onChange={(e) => setTermId(e.target.value)}
              className="px-3 py-2 border rounded text-sm"
              disabled={!sessionId}
            >
              <option value="">Select term</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button
              onClick={onPrint}
              className="px-4 py-2 bg-blue-700 text-white rounded text-sm font-semibold hover:bg-blue-800"
            >
              🖨 Print / PDF
            </button>
          </div>
        </div>
      </div>

      {/* Report Card Body */}
      <div className="max-w-4xl mx-auto my-6 print:my-0">
        <div className="report-card bg-white shadow-lg print:shadow-none p-8 print:p-4" style={{ border: '2px solid #1a1a2e' }}>

          {/* ===== HEADER ===== */}
          <header className="flex items-center gap-4 mb-3 pb-3" style={{ borderBottom: '3px double #1a1a2e' }}>
            {/* Logo placeholder */}
            <div className="flex-shrink-0" style={{
              width: 80, height: 80, borderRadius: '50%',
              border: '3px solid #1a1a2e',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 'bold', fontSize: 10, textAlign: 'center', color: '#1a1a2e'
            }}>
              SCHOOL<br/>LOGO
            </div>
            <div className="flex-1 text-center">
              <div style={{ fontSize: 22, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 2, color: '#1a1a2e' }}>
                {SCHOOL_NAME}
              </div>
              <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>{SCHOOL_ADDRESS}</div>
              <div style={{ fontSize: 11, color: '#444' }}>{SCHOOL_TEL} &nbsp;|&nbsp; Motto: <em>{SCHOOL_MOTTO}</em></div>
              <div style={{ fontSize: 13, fontWeight: 'bold', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1, color: '#1a1a2e', textDecoration: 'underline' }}>
                Student Terminal Report Card
              </div>
              {report?.term && (
                <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                  {report.term.session} &mdash; {report.term.name}
                </div>
              )}
            </div>
            {/* Right logo placeholder */}
            <div className="flex-shrink-0" style={{
              width: 80, height: 80, borderRadius: '50%',
              border: '3px solid #1a1a2e',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 'bold', fontSize: 10, textAlign: 'center', color: '#1a1a2e'
            }}>
              SCHOOL<br/>CREST
            </div>
          </header>

          {report ? (
            <>
              {/* ===== BIO DATA ===== */}
              <div className="section-title mb-1">Student Bio Data</div>
              <div className="flex gap-3 mb-4">
                <table className="bio-table flex-1" style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '33%', fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Student Name:</td>
                      <td style={{ width: '67%', fontWeight: 'bold', fontSize: 12 }} colSpan={3}>{report.student.full_name}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Admission No:</td>
                      <td>{report.student.admission || '—'}</td>
                      <td style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Gender:</td>
                      <td>{report.student.gender || '—'}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Class:</td>
                      <td>{report.class?.name || '—'}</td>
                      <td style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Date of Birth:</td>
                      <td>{report.student.dob ? new Date(report.student.dob).toLocaleDateString('en-GB') : '—'}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Term:</td>
                      <td>{report.term?.name}</td>
                      <td style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Session:</td>
                      <td>{report.term?.session}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Guardian:</td>
                      <td colSpan={3}>{report.student.guardian_name || '—'}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Position in Class:</td>
                      <td style={{ fontWeight: 'bold', color: '#1a1a2e', fontSize: 13 }}>
                        {report.summary?.position ? `${report.summary.position}` : '—'}
                      </td>
                      <td style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>No. of Students:</td>
                      <td>{report.summary?.class_size || '—'}</td>
                    </tr>
                  </tbody>
                </table>
                {/* Photo */}
                <div style={{ width: 90, flexShrink: 0 }}>
                  {report.student.photo_url ? (
                    <img
                      src={report.student.photo_url}
                      alt="Student"
                      style={{ width: 90, height: 110, objectFit: 'cover', border: '2px solid #1a1a2e' }}
                    />
                  ) : (
                    <div style={{
                      width: 90, height: 110, border: '2px solid #555',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: '#aaa', textAlign: 'center'
                    }}>
                      Passport<br/>Photo
                    </div>
                  )}
                </div>
              </div>

              {/* ===== RESULTS TABLE ===== */}
              <div className="section-title mb-1">Academic Performance</div>
              <table className="rc-table w-full mb-4" style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'center', width: '5%' }}>S/N</th>
                    <th style={{ textAlign: 'left', width: '32%' }}>Subject</th>
                    <th>CA (40)</th>
                    <th>Exam (60)</th>
                    <th>Total (100)</th>
                    <th>Grade</th>
                    <th>Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {report.subjects.map((sub: any, i: number) => {
                    const isF = sub.grade === 'F9'
                    const isA = String(sub.grade).startsWith('A')
                    return (
                      <tr key={sub.subject_id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                        <td style={{ textAlign: 'center', color: '#555' }}>{i + 1}</td>
                        <td style={{ fontWeight: '600' }}>{sub.subject_name}</td>
                        <td style={{ textAlign: 'center' }}>{sub.ca_score ?? '—'}</td>
                        <td style={{ textAlign: 'center' }}>{sub.exam_score ?? '—'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{sub.total ?? '—'}</td>
                        <td style={{ textAlign: 'center' }} className={isF ? 'grade-f' : isA ? 'grade-a' : ''}>
                          {sub.grade}
                        </td>
                        <td style={{ textAlign: 'center' }}>{sub.remark}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#e8e8e8', fontWeight: 'bold' }}>
                    <td colSpan={4} style={{ textAlign: 'right', paddingRight: 8 }}>Total Score:</td>
                    <td style={{ textAlign: 'center' }}>{report.summary?.total_marks}</td>
                    <td colSpan={2} style={{ textAlign: 'center', fontSize: 10 }}>
                      Average: {report.summary?.average}%
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* ===== GRADE SCALE ===== */}
              <div className="mb-4" style={{ fontSize: 10, border: '1px solid #ccc', padding: '4px 8px', backgroundColor: '#f9f9f9' }}>
                <strong>Grade Scale:</strong>&nbsp;
                <span className="grade-a">A1</span> (75–100) Excellent &nbsp;|&nbsp;
                B2 (70–74) Very Good &nbsp;|&nbsp;
                B3 (65–69) Good &nbsp;|&nbsp;
                C4 (60–64) Credit &nbsp;|&nbsp;
                C5 (55–59) Credit &nbsp;|&nbsp;
                C6 (50–54) Credit &nbsp;|&nbsp;
                D7 (45–49) Pass &nbsp;|&nbsp;
                E8 (40–44) Pass &nbsp;|&nbsp;
                <span className="grade-f">F9</span> (0–39) Fail
              </div>

              {/* ===== AFFECTIVE / PSYCHOMOTOR ===== */}
              <div className="flex gap-3 mb-4">
                {/* Affective Domain */}
                <div className="flex-1">
                  <div className="section-title mb-1">Affective Domain</div>
                  <table className="bio-table w-full" style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ backgroundColor: '#333', color: 'white', textAlign: 'left', padding: '3px 6px', fontSize: 10 }}>Trait</th>
                        <th style={{ backgroundColor: '#333', color: 'white', textAlign: 'center', padding: '3px 6px', fontSize: 10 }}>Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        'Punctuality', 'Neatness', 'Honesty', 'Politeness',
                        'Cooperation', 'Self-Control', 'Perseverance'
                      ].map((trait) => (
                        <tr key={trait}>
                          <td>{trait}</td>
                          <td style={{ textAlign: 'center' }}>&nbsp;</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Psychomotor */}
                <div className="flex-1">
                  <div className="section-title mb-1">Psychomotor Domain</div>
                  <table className="bio-table w-full" style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ backgroundColor: '#333', color: 'white', textAlign: 'left', padding: '3px 6px', fontSize: 10 }}>Skill</th>
                        <th style={{ backgroundColor: '#333', color: 'white', textAlign: 'center', padding: '3px 6px', fontSize: 10 }}>Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        'Handwriting', 'Drawing/Art', 'Sports/Games',
                        'Music/Cultural', 'Verbal Fluency', 'Computer Skills', 'Craft/Tech'
                      ].map((skill) => (
                        <tr key={skill}>
                          <td>{skill}</td>
                          <td style={{ textAlign: 'center' }}>&nbsp;</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Rating key + Attendance */}
                <div style={{ width: 130, flexShrink: 0 }}>
                  <div className="section-title mb-1">Rating Key</div>
                  <table className="bio-table w-full mb-3" style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <tbody>
                      {[['5', 'Excellent'], ['4', 'Very Good'], ['3', 'Good'], ['2', 'Fair'], ['1', 'Poor']].map(([k, v]) => (
                        <tr key={k}>
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{k}</td>
                          <td>{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="section-title mb-1">Attendance</div>
                  <table className="bio-table w-full" style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0', fontSize: 9 }}>Times Present:</td>
                        <td style={{ textAlign: 'center' }}>{report.attendance?.present ?? '—'}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0', fontSize: 9 }}>School Opened:</td>
                        <td style={{ textAlign: 'center' }}>{report.attendance?.total ?? '—'}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0', fontSize: 9 }}>Times Absent:</td>
                        <td style={{ textAlign: 'center' }}>{report.attendance?.absent ?? '—'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ===== REMARKS ===== */}
              <div className="flex gap-3 mb-4">
                <div className="flex-1">
                  <div className="section-title mb-1">Class Teacher's Comment</div>
                  <div style={{
                    border: '1px solid #555', minHeight: 50, padding: '4px 8px',
                    fontSize: 11, backgroundColor: '#fafafa'
                  }}>
                    {report.class_teacher_remark || <span style={{ color: '#aaa', fontStyle: 'italic' }}>—</span>}
                  </div>
                  <div style={{ borderTop: '1px solid #333', marginTop: 24, fontSize: 10, paddingTop: 2, textAlign: 'center' }}>
                    {report.class_teacher_name || 'Class Teacher'} &nbsp;&nbsp; Signature
                  </div>
                </div>
                <div className="flex-1">
                  <div className="section-title mb-1">Principal's Comment</div>
                  <textarea
                    value={principalRemark}
                    onChange={(e) => setPrincipalRemark(e.target.value)}
                    className="no-print w-full border rounded p-2 text-sm"
                    style={{ minHeight: 50, fontSize: 11, borderColor: '#555' }}
                    placeholder="Enter principal's remark..."
                  />
                  <div className="hidden print:block" style={{
                    border: '1px solid #555', minHeight: 50, padding: '4px 8px',
                    fontSize: 11, backgroundColor: '#fafafa'
                  }}>
                    {principalRemark || <span style={{ color: '#aaa', fontStyle: 'italic' }}>—</span>}
                  </div>
                  <div className="no-print mt-1">
                    <button
                      onClick={savePrincipalRemark}
                      disabled={saving}
                      className="px-3 py-1 bg-blue-700 text-white rounded text-xs font-medium hover:bg-blue-800"
                    >
                      {saving ? 'Saving...' : 'Save Remark'}
                    </button>
                  </div>
                  <div style={{ borderTop: '1px solid #333', marginTop: 24, fontSize: 10, paddingTop: 2, textAlign: 'center' }}>
                    Principal &nbsp;&nbsp; Signature
                  </div>
                </div>
              </div>

              {/* ===== NEXT TERM / STAMP ===== */}
              <div style={{ borderTop: '2px solid #1a1a2e', paddingTop: 8 }}>
                <div className="flex justify-between items-end">
                  <div style={{ fontSize: 11 }}>
                    <div><strong>Next Term Begins:</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div>
                    <div style={{ marginTop: 8 }}><strong>School Fees for Next Term:</strong> ₦ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div>
                  </div>
                  <div className="stamp-box">School<br/>Stamp</div>
                </div>
                <div style={{ marginTop: 8, fontSize: 10, textAlign: 'center', color: '#555', fontStyle: 'italic' }}>
                  This report card is only valid with the school stamp and signature of the Principal.
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-16 text-gray-400" style={{ fontSize: 13 }}>
              {termId ? 'No report data found for this student and term.' : 'Please select a term above.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
