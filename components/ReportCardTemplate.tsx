'use client'

import React, { useState } from 'react'

const DEFAULT_SCHOOL_NAME = 'School Management System'
const DEFAULT_SCHOOL_ADDRESS = ''
const DEFAULT_SCHOOL_MOTTO = ''
const DEFAULT_SCHOOL_TEL = ''

type SkillItem = { name: string; score?: number }

type Props = {
  report: any
  // Class teacher editing
  isClassTeacher?: boolean
  remark?: string
  onRemarkChange?: (v: string) => void
  onSaveRemark?: () => void
  savingRemark?: boolean
  affective?: SkillItem[]
  onAffectiveChange?: (skills: SkillItem[]) => void
  psychomotor?: SkillItem[]
  onPsychomotorChange?: (skills: SkillItem[]) => void
  onSaveSkills?: () => void
  savingSkills?: boolean
  // Admin editing
  isAdmin?: boolean
  principalRemark?: string
  onPrincipalRemarkChange?: (v: string) => void
  onSavePrincipalRemark?: () => void
  savingPrincipalRemark?: boolean
  // Signature upload callback — parent provides classId & termId context
  onUploadSignature?: (file: File, type: 'class_teacher' | 'principal') => Promise<void>
}

const AFFECTIVE_DEFAULTS: SkillItem[] = [
  { name: 'Punctuality' }, { name: 'Politeness' }, { name: 'Neatness' }, { name: 'Honesty' },
  { name: 'Leadership Skill' }, { name: 'Cooperation' }, { name: 'Attentiveness' }, { name: 'Perseverance' }, { name: 'Attitude to Work' },
]
const PSYCHOMOTOR_DEFAULTS: SkillItem[] = [
  { name: 'Handwriting' }, { name: 'Verbal Fluency' }, { name: 'Sports' }, { name: 'Handling Tools' }, { name: 'Drawing & Painting' },
]

export default function ReportCardTemplate({
  report,
  isClassTeacher = false,
  remark = '',
  onRemarkChange,
  onSaveRemark,
  savingRemark = false,
  affective,
  onAffectiveChange,
  psychomotor,
  onPsychomotorChange,
  onSaveSkills,
  savingSkills = false,
  isAdmin = false,
  principalRemark = '',
  onPrincipalRemarkChange,
  onSavePrincipalRemark,
  savingPrincipalRemark = false,
  onUploadSignature,
}: Props) {
  const [uploadingSignature, setUploadingSignature] = useState<'class_teacher' | 'principal' | null>(null)
  const subjects: any[] = Array.isArray(report?.subjects) ? report.subjects : []
  const school = report?.school || {}
  const schoolName = school.name || DEFAULT_SCHOOL_NAME
  const schoolAddress = school.address || DEFAULT_SCHOOL_ADDRESS
  const schoolMotto = school.motto || DEFAULT_SCHOOL_MOTTO
  const schoolPhone = school.phone || DEFAULT_SCHOOL_TEL
  const schoolLogoUrl = school.logo_url || ''
  const nextTermBegins = report?.next_term_begins || ''
  const schoolFees = report?.school_fees || ''
  const session = report?.term?.session || ''
  const termName = report?.term?.name || ''
  const student = report?.student || {}
  const cls = report?.class || {}
  const attendance = report?.attendance || { total: 0, present: 0, absent: 0, late: 0 }
  const summary = report?.summary || { subject_count: 0, total_marks: 0, average: 0, position: 0 }
  const isSenior = String(cls?.class_level || '').toUpperCase().startsWith('SS')

  const affectiveSkills = affective && affective.length > 0 ? affective
    : (report?.skills?.affective && report.skills.affective.length > 0 ? report.skills.affective : AFFECTIVE_DEFAULTS)
  const psychomotorSkills = psychomotor && psychomotor.length > 0 ? psychomotor
    : (report?.skills?.psychomotor && report.skills.psychomotor.length > 0 ? report.skills.psychomotor : PSYCHOMOTOR_DEFAULTS)

  const classTeacherRemark = isClassTeacher ? remark : (report?.class_teacher_remark || '')
  const principalComment = isAdmin ? principalRemark : (report?.principal_remark || '')

  return (
    <div className="max-w-4xl mx-auto my-6 print:my-0">
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
          @page { size: A4 portrait; margin: 10mm; }
          .report-card { box-shadow: none !important; margin: 0 !important; width: 190mm !important; }
          nav, aside { display: none !important; }
          main { padding: 0 !important; }
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
        .rc-table thead { display: table-header-group; }
        .rc-table tfoot { display: table-footer-group; }
        .rc-table tr { page-break-inside: avoid; }
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
        .section-title, header { break-inside: avoid; page-break-inside: avoid; }
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
        /* Mobile responsive */
        .rc-table-wrapper {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        @media (max-width: 768px) {
          .report-card { padding: 12px !important; }
          .rc-header { flex-direction: column !important; text-align: center; }
          .rc-header .rc-logo { margin: 0 auto 8px; }
          .rc-bio-row { flex-direction: column !important; }
          .rc-bio-row .rc-photo { order: -1; margin: 0 auto 8px; }
          .rc-skills-row { flex-direction: column !important; }
          .rc-skills-row > div { width: 100% !important; flex-shrink: unset !important; }
          .rc-remarks-row { flex-direction: column !important; }
          .rc-footer-row { flex-direction: column !important; gap: 12px; }
          .rc-table th, .rc-table td { padding: 2px 3px; font-size: 9px; white-space: nowrap; }
          .bio-table td { font-size: 10px; }
          .section-title { font-size: 10px; }
        }
      `}</style>

      <div className="report-card bg-white shadow-lg print:shadow-none p-8 print:p-4" style={{ border: '2px solid #1a1a2e' }}>

        {/* ===== HEADER ===== */}
        <header className="rc-header flex items-center gap-4 mb-3 pb-3" style={{ borderBottom: '3px double #1a1a2e' }}>
          <div className="rc-logo flex-shrink-0" style={{
            width: 80, height: 80, borderRadius: '50%',
            border: '3px solid #1a1a2e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 'bold', fontSize: 10, textAlign: 'center', color: '#1a1a2e',
            overflow: 'hidden',
          }}>
            {schoolLogoUrl ? (
              <img src={schoolLogoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <>SCHOOL<br/>LOGO</>
            )}
          </div>
          <div className="flex-1 text-center">
            <div style={{ fontSize: 22, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 2, color: '#1a1a2e' }}>
              {schoolName}
            </div>
            {schoolAddress && <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>{schoolAddress}</div>}
            <div style={{ fontSize: 11, color: '#444' }}>
              {schoolPhone && <>{schoolPhone}</>}
              {schoolPhone && schoolMotto && <> &nbsp;|&nbsp; </>}
              {schoolMotto && <>Motto: <em>{schoolMotto}</em></>}
            </div>
            <div style={{ fontSize: 13, fontWeight: 'bold', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1, color: '#1a1a2e', textDecoration: 'underline' }}>
              Student Terminal Report Card
            </div>
            {report?.term && (
              <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                {session} &mdash; {termName}
              </div>
            )}
          </div>
        </header>

        {/* ===== BIO DATA ===== */}
        <div className="section-title mb-1">Student Bio Data</div>
        <div className="rc-bio-row flex gap-3 mb-4">
          <table className="bio-table flex-1" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ width: '33%', fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Student Name:</td>
                <td style={{ width: '67%', fontWeight: 'bold', fontSize: 12 }} colSpan={3}>{student.full_name || '—'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Admission No:</td>
                <td>{student.admission || '—'}</td>
                <td style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Gender:</td>
                <td>{student.gender || '—'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Class:</td>
                <td>{cls?.name || '—'}</td>
                <td style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Date of Birth:</td>
                <td>{student.dob ? new Date(student.dob).toLocaleDateString('en-GB') : '—'}</td>
              </tr>
              {isSenior && (
                <tr>
                  <td style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Department:</td>
                  <td colSpan={3} style={{ fontWeight: 'bold' }}>{cls?.department || '—'}</td>
                </tr>
              )}
              <tr>
                <td style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Term:</td>
                <td>{termName}</td>
                <td style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Session:</td>
                <td>{session}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Guardian:</td>
                <td colSpan={3}>{student.guardian_name || '—'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Position in Class:</td>
                <td style={{ fontWeight: 'bold', color: '#1a1a2e', fontSize: 13 }}>
                  {summary?.position ? `${summary.position}` : '—'}
                </td>
                <td style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>No. of Students:</td>
                <td>{(summary as any)?.class_size ?? '—'}</td>
              </tr>
            </tbody>
          </table>
          <div className="rc-photo" style={{ width: 90, flexShrink: 0 }}>
            {student.photo_url ? (
              <img src={student.photo_url} alt="Student" style={{ width: 90, height: 110, objectFit: 'cover', border: '2px solid #1a1a2e' }} />
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
        <div className="rc-table-wrapper">
        <table className="rc-table w-full mb-4" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'center', width: '5%' }}>S/N</th>
              <th style={{ textAlign: 'left', width: '28%' }}>Subject</th>
              <th>CA1 (20)</th>
              <th>CA2 (20)</th>
              <th>Exam (60)</th>
              <th>Total (100)</th>
              <th>Grade</th>
              <th>Position</th>
              <th>Highest</th>
              <th>Lowest</th>
              <th>Average</th>
              <th>Remark</th>
            </tr>
          </thead>
          <tbody>
            {subjects.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ textAlign: 'center', color: '#777', padding: '12px' }}>No scores recorded</td>
              </tr>
            ) : (
              subjects.map((sub: any, i: number) => {
                const isF = sub.grade === 'F'
                const isA = sub.grade === 'A'
                return (
                  <tr key={sub.subject_id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                    <td style={{ textAlign: 'center', color: '#555' }}>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{sub.subject_name}</td>
                    <td style={{ textAlign: 'center' }}>{sub.ca1_score ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}>{sub.ca2_score ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}>{sub.exam_score ?? '—'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{sub.total ?? '—'}</td>
                    <td style={{ textAlign: 'center' }} className={isF ? 'grade-f' : isA ? 'grade-a' : ''}>{sub.grade}</td>
                    <td style={{ textAlign: 'center' }}>{sub.subject_position ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}>{sub.subject_highest ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}>{sub.subject_lowest ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}>{sub.subject_average ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}>{sub.remark}</td>
                  </tr>
                )
              })
            )}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#e8e8e8', fontWeight: 'bold' }}>
              <td colSpan={5} style={{ textAlign: 'right', paddingRight: 8 }}>Total Score:</td>
              <td style={{ textAlign: 'center' }}>{summary.total_marks}</td>
              <td colSpan={2} style={{ textAlign: 'center', fontSize: 10 }}>
                Average: {summary.average}%
              </td>
            </tr>
          </tfoot>
        </table>
        </div>

        {/* ===== GRADE SCALE ===== */}
        <div className="mb-4" style={{ fontSize: 10, border: '1px solid #ccc', padding: '4px 8px', backgroundColor: '#f9f9f9' }}>
          <strong>Grade Scale:</strong>&nbsp;
          <span className="grade-a">A</span> (70–100) Excellent &nbsp;|&nbsp;
          B (60–69) Very Good &nbsp;|&nbsp;
          C (50–59) Good &nbsp;|&nbsp;
          D (45–49) Pass &nbsp;|&nbsp;
          E (40–44) Fair &nbsp;|&nbsp;
          <span className="grade-f">F</span> (0–39) Fail
        </div>

        {/* ===== AFFECTIVE / PSYCHOMOTOR ===== */}
        <div className="rc-skills-row flex gap-3 mb-4">
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
                {affectiveSkills.map((a: SkillItem, i: number) => (
                  <tr key={i}>
                    <td>{a.name}</td>
                    <td style={{ textAlign: 'center' }}>
                      {isClassTeacher ? (
                        <>
                          <select
                            value={a.score ?? ''}
                            onChange={(e) => {
                              if (!onAffectiveChange) return
                              const v = e.target.value ? Number(e.target.value) : undefined
                              const updated = affectiveSkills.map((x: SkillItem, idx: number) => idx === i ? { ...x, score: v } : x)
                              onAffectiveChange(updated)
                            }}
                            className="no-print border rounded px-1 py-0.5 text-xs w-14 text-center"
                          >
                            <option value="">—</option>
                            {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                          <span className="hidden print:inline">{a.score ?? '—'}</span>
                        </>
                      ) : (
                        <>{a.score ?? '—'}</>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Psychomotor Domain */}
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
                {psychomotorSkills.map((p: SkillItem, i: number) => (
                  <tr key={i}>
                    <td>{p.name}</td>
                    <td style={{ textAlign: 'center' }}>
                      {isClassTeacher ? (
                        <>
                          <select
                            value={p.score ?? ''}
                            onChange={(e) => {
                              if (!onPsychomotorChange) return
                              const v = e.target.value ? Number(e.target.value) : undefined
                              const updated = psychomotorSkills.map((x: SkillItem, idx: number) => idx === i ? { ...x, score: v } : x)
                              onPsychomotorChange(updated)
                            }}
                            className="no-print border rounded px-1 py-0.5 text-xs w-14 text-center"
                          >
                            <option value="">—</option>
                            {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                          <span className="hidden print:inline">{p.score ?? '—'}</span>
                        </>
                      ) : (
                        <>{p.score ?? '—'}</>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Attendance under psychomotor */}
            <div className="mt-3">
              <table className="bio-table w-full" style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th colSpan={2} style={{ backgroundColor: '#333', color: 'white', textAlign: 'center', padding: '3px 6px', fontSize: 10 }}>
                      Attendance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0', fontSize: 9 }}>Total Days in Term:</td>
                    <td style={{ textAlign: 'center' }}>{attendance.total}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0', fontSize: 9 }}>Total Days Present:</td>
                    <td style={{ textAlign: 'center' }}>{attendance.present}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0', fontSize: 9 }}>Total Days Absent:</td>
                    <td style={{ textAlign: 'center' }}>{attendance.absent}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Rating Key */}
          <div style={{ width: 130, flexShrink: 0 }}>
            <div className="section-title mb-1">Rating Key</div>
            <table className="bio-table w-full" style={{ borderCollapse: 'collapse', width: '100%' }}>
              <tbody>
                {[['5', 'Excellent'], ['4', 'Very Good'], ['3', 'Good'], ['2', 'Fair'], ['1', 'Poor']].map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{k}</td>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Save Ratings button (class teacher only) */}
        {isClassTeacher && onSaveSkills && (
          <div className="no-print mb-4">
            <button
              onClick={onSaveSkills}
              disabled={savingSkills}
              className="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {savingSkills ? 'Saving...' : 'Save Ratings'}
            </button>
          </div>
        )}

        {/* ===== REMARKS ===== */}
        <div className="rc-remarks-row flex gap-3 mb-4">
          {/* Class Teacher Comment */}
          <div className="flex-1">
            <div className="section-title mb-1">Class Teacher&apos;s Comment</div>
            {isClassTeacher ? (
              <>
                <textarea
                  value={remark}
                  onChange={(e) => onRemarkChange?.(e.target.value)}
                  className="no-print w-full border rounded p-2 text-sm"
                  style={{ minHeight: 50, fontSize: 11, borderColor: '#555' }}
                  placeholder="Enter class teacher's remark..."
                />
                <div className="hidden print:block" style={{
                  border: '1px solid #555', minHeight: 50, padding: '4px 8px',
                  fontSize: 11, backgroundColor: '#fafafa'
                }}>
                  {remark || <span style={{ color: '#aaa', fontStyle: 'italic' }}>—</span>}
                </div>
                {onSaveRemark && (
                  <div className="no-print mt-1">
                    <button
                      onClick={onSaveRemark}
                      disabled={savingRemark}
                      className="px-3 py-1 bg-blue-700 text-white rounded text-xs font-medium hover:bg-blue-800 disabled:opacity-50"
                    >
                      {savingRemark ? 'Saving...' : 'Save Comment'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div style={{
                border: '1px solid #555', minHeight: 50, padding: '4px 8px',
                fontSize: 11, backgroundColor: '#fafafa'
              }}>
                {classTeacherRemark || <span style={{ color: '#aaa', fontStyle: 'italic' }}>—</span>}
              </div>
            )}
            {/* Class Teacher Signature */}
            <div style={{ marginTop: 16 }}>
              {report?.class_teacher_signature_url ? (
                <div style={{ textAlign: 'center' }}>
                  <img src={report.class_teacher_signature_url} alt="Class Teacher Signature" style={{ maxHeight: 50, maxWidth: 150, margin: '0 auto' }} />
                </div>
              ) : (
                <div style={{ height: 30 }} />
              )}
              <div style={{ borderTop: '1px solid #333', fontSize: 10, paddingTop: 2, textAlign: 'center' }}>
                Class Teacher&apos;s Signature
              </div>
              {isClassTeacher && onUploadSignature && (
                <div className="no-print mt-1">
                  <label className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 border rounded text-xs cursor-pointer hover:bg-gray-200">
                    {uploadingSignature === 'class_teacher' ? 'Uploading...' : 'Upload & Apply to All Students'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingSignature !== null}
                      onChange={async (e) => {
                        const f = e.target.files?.[0]
                        if (!f) return
                        setUploadingSignature('class_teacher')
                        try { await onUploadSignature(f, 'class_teacher') } finally { setUploadingSignature(null) }
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Principal Comment */}
          <div className="flex-1">
            <div className="section-title mb-1">Principal&apos;s Comment</div>
            {isAdmin ? (
              <>
                <textarea
                  value={principalRemark}
                  onChange={(e) => onPrincipalRemarkChange?.(e.target.value)}
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
                {onSavePrincipalRemark && (
                  <div className="no-print mt-1">
                    <button
                      onClick={onSavePrincipalRemark}
                      disabled={savingPrincipalRemark}
                      className="px-3 py-1 bg-blue-700 text-white rounded text-xs font-medium hover:bg-blue-800 disabled:opacity-50"
                    >
                      {savingPrincipalRemark ? 'Saving...' : 'Save Comment'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div style={{
                border: '1px solid #555', minHeight: 50, padding: '4px 8px',
                fontSize: 11, backgroundColor: '#fafafa'
              }}>
                {principalComment || <span style={{ color: '#aaa', fontStyle: 'italic' }}>—</span>}
              </div>
            )}
            {/* Principal Signature */}
            <div style={{ marginTop: 16 }}>
              {report?.principal_signature_url ? (
                <div style={{ textAlign: 'center' }}>
                  <img src={report.principal_signature_url} alt="Principal Signature" style={{ maxHeight: 50, maxWidth: 150, margin: '0 auto' }} />
                </div>
              ) : (
                <div style={{ height: 30 }} />
              )}
              <div style={{ borderTop: '1px solid #333', fontSize: 10, paddingTop: 2, textAlign: 'center' }}>
                Principal&apos;s Signature
              </div>
              {isAdmin && onUploadSignature && (
                <div className="no-print mt-1">
                  <label className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 border rounded text-xs cursor-pointer hover:bg-gray-200">
                    {uploadingSignature === 'principal' ? 'Uploading...' : 'Upload & Apply to All Students'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingSignature !== null}
                      onChange={async (e) => {
                        const f = e.target.files?.[0]
                        if (!f) return
                        setUploadingSignature('principal')
                        try { await onUploadSignature(f, 'principal') } finally { setUploadingSignature(null) }
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ===== NEXT TERM / STAMP ===== */}
        <div style={{ borderTop: '2px solid #1a1a2e', paddingTop: 8 }}>
          <div className="rc-footer-row flex justify-between items-end">
            <div style={{ fontSize: 11 }}>
              <div><strong>Next Term Begins:</strong> {nextTermBegins ? new Date(nextTermBegins + 'T12:00:00').toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }) : <span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>}</div>
              <div style={{ marginTop: 8 }}><strong>School Fees for Next Term:</strong> {schoolFees ? `₦${schoolFees}` : <span>₦ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>}</div>
            </div>
            <div className="stamp-box">School<br/>Stamp</div>
          </div>
          <div style={{ marginTop: 8, fontSize: 10, textAlign: 'center', color: '#555', fontStyle: 'italic' }}>
            This report card is only valid with the school stamp and signature of the Principal.
          </div>
        </div>
      </div>
    </div>
  )
}
