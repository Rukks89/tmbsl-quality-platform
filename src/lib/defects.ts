// Shared types for PDI defect / investigation records.
// Milestone 1 reads these from the preview fixtures; Milestone 2 swaps in Netlify Database.

export type OriginStatus = 'unverified' | 'investigating' | 'confirmed' | 'rejected'
export type IssueStatus = 'open' | 'closed'
export type Severity = 'critical' | 'major' | 'minor'
export type SQPDCME = 'S' | 'Q' | 'P' | 'D' | 'C' | 'M' | 'E'

export const CATEGORIES = [
  'Door Related',
  'Paint Related',
  'Electrical',
  'Panel Related',
  'Fitment',
  'Seat Related',
  'Structure Related',
  'Others',
] as const
export type Category = (typeof CATEGORIES)[number]

export const SQPDCME_LABELS: Record<SQPDCME, string> = {
  S: 'Safety',
  Q: 'Quality',
  P: 'Productivity',
  D: 'Delivery',
  C: 'Cost',
  M: 'Morale',
  E: 'Environment',
}

export interface CorrectiveAction {
  containment: string | null
  action: string | null
  /** 'approved' = engineer-approved action; 'recommendation' = suggested, not yet approved. */
  kind: 'approved' | 'recommendation'
  targetDate: string | null
  completedDate: string | null
  verificationEvidence: string | null
}

export interface DefectRecord {
  id: string
  busNumber: string
  busModel: string
  description: string
  category: Category
  detectedAt: string
  detectedDate: string | null
  severity: Severity
  sqpdcme: SQPDCME[]
  /** Activity IDs proposed as potential origins (from matching or the investigator). */
  candidateActivityIds: string[]
  /** Only set once an approved investigation confirms the origin. */
  confirmedActivityId: string | null
  originStatus: OriginStatus
  rootCause: string | null
  /** Owner assignment comes from a controlled owner register (Milestone 3); null = unassigned. */
  owner: string | null
  status: IssueStatus
  priority: 'P1' | 'P2' | 'P3'
  corrective: CorrectiveAction
}

export const ORIGIN_STATUS_LABEL: Record<OriginStatus, string> = {
  unverified: 'Candidate · unverified',
  investigating: 'Under investigation',
  confirmed: 'Origin confirmed',
  rejected: 'Origin rejected',
}

export const SEVERITY_WEIGHT: Record<Severity, number> = { critical: 3, major: 2, minor: 1 }
