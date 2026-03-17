export interface GradeResult {
  grade: string
  remark: string
}

export function getGrade(total: number): GradeResult {
  if (total >= 70) return { grade: 'A', remark: 'Excellent' }
  if (total >= 60) return { grade: 'B', remark: 'Very Good' }
  if (total >= 50) return { grade: 'C', remark: 'Good' }
  if (total >= 45) return { grade: 'D', remark: 'Pass' }
  if (total >= 40) return { grade: 'E', remark: 'Fair' }
  return { grade: 'F', remark: 'Fail' }
}
