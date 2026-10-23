import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { AssessmentDetail, AssessmentNotFound } from '@/components/assessment/AssessmentDetail'
import { buildOpportunityAssessment } from '@/lib/assessment'
import { oppById } from '@/lib/data'

export default function OpportunityDetail() {
  const { id } = useParams()
  const opportunity = id ? oppById.get(id) : undefined
  const assessment = useMemo(() => (opportunity ? buildOpportunityAssessment(opportunity) : null), [opportunity])
  if (!assessment) return <AssessmentNotFound kind="curated" />
  return <AssessmentDetail assessment={assessment} />
}
