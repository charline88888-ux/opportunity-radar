import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { AssessmentDetail, AssessmentNotFound } from '@/components/assessment/AssessmentDetail'
import { buildCandidateAssessment } from '@/lib/assessment'
import { candidateById } from '@/lib/candidates'

export default function CandidateDetail() {
  const { id } = useParams()
  const candidate = id ? candidateById.get(id) : undefined
  const assessment = useMemo(() => (candidate ? buildCandidateAssessment(candidate) : null), [candidate])
  if (!assessment) return <AssessmentNotFound kind="candidate" />
  return <AssessmentDetail assessment={assessment} />
}
