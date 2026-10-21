// PREVIEW DATASET — illustrative PDI records used to demonstrate the analytics screens.
// These are NOT verified TMBSL defect records. Every screen labels them as preview data,
// and the "Verified records" data mode shows the platform with no records connected.
// Origins point at real activities from the workbook so trace paths are realistic.
// Milestone 2 replaces this module with records stored in Netlify Database.
import { activities } from '@/lib/master'
import type { Category, DefectRecord, Severity, SQPDCME } from '@/lib/defects'

function act(stationId: string, fragment: string) {
  const f = fragment.toLowerCase()
  const a = activities.find((x) => x.stationId === stationId && x.text.toLowerCase().includes(f))
  if (!a) throw new Error(`Preview fixture references missing activity: ${stationId} / ${fragment}`)
  return a.id
}

interface Template {
  description: string
  category: Category
  severity: Severity
  sqpdcme: SQPDCME[]
  origin: string
  alternates: string[]
  rootCause: string
  containment: string
  action: string
}

const T: Record<string, Template> = {
  doorGap: {
    description: 'Passenger door gap uneven at top edge',
    category: 'Door Related',
    severity: 'major',
    sqpdcme: ['Q'],
    origin: act('trim-st-40', 'Passenger door fitment'),
    alternates: [act('trim-st-40', 'Passenger door catcher'), act('paneling-st-60', 'Driver Door Assembly')],
    rootCause: 'Door rail fitment not checked against gap gauge before catcher fitment.',
    containment: '100% gap gauge check on buses in PDI lane.',
    action: 'Add gap-gauge check to Trim Station 40 check list.',
  },
  emDoorFoul: {
    description: 'Emergency door fouling with frame while closing',
    category: 'Door Related',
    severity: 'critical',
    sqpdcme: ['S', 'Q'],
    origin: act('paneling-st-60', 'Emergency door fitment'),
    alternates: [act('trim-st-30', 'Emergency door finishing'), act('paneling-st-30', 'emergency door aperture')],
    rootCause: 'Aperture extra material not fully ground before door fitment.',
    containment: 'Re-grind aperture and re-hang door on affected buses.',
    action: 'Aperture profile check added before emergency door fitment.',
  },
  doorLock: {
    description: 'Passenger door lock not engaging',
    category: 'Door Related',
    severity: 'major',
    sqpdcme: ['S', 'Q'],
    origin: act('trim-st-40', 'Passenger door lock hole fitment'),
    alternates: [act('trim-st-40', 'Passenger door catcher')],
    rootCause: 'Lock hole position offset from catcher.',
    containment: 'Adjust catcher position on affected buses.',
    action: 'Drilling template for lock hole.',
  },
  harnessFoul: {
    description: 'Harness fouling near fuse box area',
    category: 'Electrical',
    severity: 'critical',
    sqpdcme: ['S', 'Q'],
    origin: act('paneling-st-60', 'Cable tieng at fuse box'),
    alternates: [act('paneling-st-50', 'Lower electrical harness routing'), act('paneling-st-50', 'Power supply harness routing')],
    rootCause: 'Cable ties missing at fuse box bunching point.',
    containment: 'Re-route and tie harness on all buses in yard.',
    action: 'Cable-tie positions marked on routing drawing.',
  },
  lampFail: {
    description: 'Side marker lamp not working',
    category: 'Electrical',
    severity: 'major',
    sqpdcme: ['S', 'Q'],
    origin: act('trim-st-60', 'Side marker lamp harness routing'),
    alternates: [act('trim-st-00', 'Side marker lamps')],
    rootCause: 'Connector not fully locked.',
    containment: 'Connector push-pull check at PDI.',
    action: 'Connector lock confirmation added at Trim Station 80 lamp check.',
  },
  paintDust: {
    description: 'Paint dust particles on roof and side panel',
    category: 'Paint Related',
    severity: 'minor',
    sqpdcme: ['Q', 'P'],
    origin: act('paint-s20', 'Clean with air blow'),
    alternates: [act('paint-s30', 'Apply two coat of top coat'), act('paint-s10', 'Clean the surface by air blow')],
    rootCause: 'Tack-rag cleaning skipped on roof before booth entry.',
    containment: 'Local polishing of affected panels.',
    action: 'Tack-rag sign-off before booth entry.',
  },
  paintRun: {
    description: 'Paint run on rear face',
    category: 'Paint Related',
    severity: 'minor',
    sqpdcme: ['Q', 'C'],
    origin: act('paint-s30', 'Apply two coat of top coat'),
    alternates: [act('paint-s30', 'viscosity')],
    rootCause: 'Top coat viscosity outside range.',
    containment: 'Sand and re-spray locally.',
    action: 'Viscosity record each shift.',
  },
  sidePanel: {
    description: 'Side panel waviness LHS',
    category: 'Panel Related',
    severity: 'minor',
    sqpdcme: ['Q'],
    origin: act('paneling-st-10', 'Side external strech panel LHS'),
    alternates: [act('paneling-st-20', 'Spot welding on strech panel'), act('paint-s50', 'Sand the surface')],
    rootCause: 'Stretch panel tension not uniform.',
    containment: 'Putty correction in paint rework area.',
    action: 'Panel tension check sheet.',
  },
  windshield: {
    description: 'Windshield water leakage at bottom corner',
    category: 'Fitment',
    severity: 'major',
    sqpdcme: ['Q', 'D'],
    origin: act('trim-st-50', 'Sealant application to front windshield'),
    alternates: [act('trim-st-50', 'Front windshield fixing'), act('trim-st-50', 'Windshiled rope pulling')],
    rootCause: 'Sealant bead discontinuous at corner.',
    containment: 'Water test on all buses before dispatch.',
    action: 'Sealant bead continuity check.',
  },
  seatLoose: {
    description: 'Passenger seat loose fitment LH',
    category: 'Seat Related',
    severity: 'critical',
    sqpdcme: ['S', 'Q'],
    origin: act('trim-st-60', 'Passenger seat fitment LH'),
    alternates: [act('trim-st-40', 'Seat layout marking, drilling LH')],
    rootCause: 'Seat mounting bolts not torqued.',
    containment: 'Torque check on all seats in PDI.',
    action: 'Torque marking for seat bolts.',
  },
  mirrorLoose: {
    description: 'RVM mirror loose fastener',
    category: 'Fitment',
    severity: 'major',
    sqpdcme: ['S'],
    origin: act('trim-st-80', 'RVM mirror fixing'),
    alternates: [act('trim-st-80', 'Mirror torque marking'), act('trim-st-40', 'RVM fixing')],
    rootCause: '',
    containment: 'Re-torque mirrors.',
    action: '',
  },
  roofLeak: {
    description: 'Roof water leak at panel joint',
    category: 'Structure Related',
    severity: 'major',
    sqpdcme: ['Q', 'D'],
    origin: act('jigs-roof-paneling', 'Apply sealant on panel joineries'),
    alternates: [act('paneling-st-50', 'Fix Aluminium beading on the joining of Roof'), act('paint-s70', 'Roof External Butyl tape')],
    rootCause: 'Sealant missed at one roof joint.',
    containment: 'Re-seal roof joint.',
    action: 'Roof joint sealant check list.',
  },
}

interface Occ {
  t: keyof typeof T
  bus: string
  model: string
  date: string
  origin: 'unverified' | 'investigating' | 'confirmed' | 'rejected'
  status: 'open' | 'closed'
  due?: string
  done?: string
}

const OCC: Occ[] = [
  { t: 'doorGap', bus: 'BUS-001', model: 'LP 4 SPCR', date: '2026-10-14', origin: 'investigating', status: 'open', due: '2026-10-28' },
  { t: 'harnessFoul', bus: 'BUS-001', model: 'LP 4 SPCR', date: '2026-10-14', origin: 'unverified', status: 'open' },
  { t: 'doorGap', bus: 'BUS-002', model: 'LP 4 SPCR', date: '2026-10-09', origin: 'confirmed', status: 'open', due: '2026-10-18' },
  { t: 'doorGap', bus: 'BUS-003', model: 'LPO', date: '2026-09-29', origin: 'confirmed', status: 'closed', due: '2026-10-10', done: '2026-10-08' },
  { t: 'doorGap', bus: 'BUS-005', model: 'LP 4 SPCR', date: '2026-10-17', origin: 'unverified', status: 'open' },
  { t: 'doorGap', bus: 'BUS-008', model: 'CNG AMTS', date: '2026-08-21', origin: 'confirmed', status: 'closed', due: '2026-09-01', done: '2026-08-30' },
  { t: 'emDoorFoul', bus: 'BUS-004', model: 'LPO', date: '2026-09-18', origin: 'confirmed', status: 'open', due: '2026-10-05' },
  { t: 'emDoorFoul', bus: 'BUS-009', model: 'LP 4 SPCR', date: '2026-10-06', origin: 'investigating', status: 'open', due: '2026-10-25' },
  { t: 'emDoorFoul', bus: 'BUS-012', model: 'LPO', date: '2026-07-24', origin: 'confirmed', status: 'closed', due: '2026-08-05', done: '2026-08-04' },
  { t: 'doorLock', bus: 'BUS-006', model: 'LPO', date: '2026-08-12', origin: 'confirmed', status: 'closed', due: '2026-08-25', done: '2026-08-22' },
  { t: 'doorLock', bus: 'BUS-015', model: 'CNG AMTS', date: '2026-10-02', origin: 'rejected', status: 'open' },
  { t: 'harnessFoul', bus: 'BUS-002', model: 'LP 4 SPCR', date: '2026-10-09', origin: 'confirmed', status: 'open', due: '2026-10-15' },
  { t: 'harnessFoul', bus: 'BUS-007', model: 'CNG AMTS', date: '2026-09-25', origin: 'confirmed', status: 'open', due: '2026-10-12' },
  { t: 'harnessFoul', bus: 'BUS-010', model: 'LPO', date: '2026-10-11', origin: 'investigating', status: 'open', due: '2026-10-30' },
  { t: 'harnessFoul', bus: 'BUS-013', model: 'LP 4 SPCR', date: '2026-10-19', origin: 'unverified', status: 'open' },
  { t: 'harnessFoul', bus: 'BUS-014', model: 'LPO', date: '2026-08-08', origin: 'confirmed', status: 'closed', due: '2026-08-20', done: '2026-08-19' },
  { t: 'lampFail', bus: 'BUS-003', model: 'LPO', date: '2026-09-29', origin: 'confirmed', status: 'closed', due: '2026-10-06', done: '2026-10-04' },
  { t: 'lampFail', bus: 'BUS-011', model: 'LP 4 SPCR', date: '2026-07-15', origin: 'confirmed', status: 'closed', due: '2026-07-25', done: '2026-07-24' },
  { t: 'lampFail', bus: 'BUS-016', model: 'CNG AMTS', date: '2026-10-15', origin: 'unverified', status: 'open' },
  { t: 'paintDust', bus: 'BUS-004', model: 'LPO', date: '2026-09-18', origin: 'confirmed', status: 'closed', due: '2026-09-30', done: '2026-09-27' },
  { t: 'paintDust', bus: 'BUS-006', model: 'LPO', date: '2026-08-12', origin: 'confirmed', status: 'closed', due: '2026-08-22', done: '2026-08-21' },
  { t: 'paintDust', bus: 'BUS-011', model: 'LP 4 SPCR', date: '2026-07-15', origin: 'confirmed', status: 'closed', due: '2026-07-28', done: '2026-07-26' },
  { t: 'paintDust', bus: 'BUS-017', model: 'LP 4 SPCR', date: '2026-07-30', origin: 'confirmed', status: 'closed', due: '2026-08-10', done: '2026-08-12' },
  { t: 'paintDust', bus: 'BUS-018', model: 'CNG AMTS', date: '2026-09-03', origin: 'investigating', status: 'open', due: '2026-10-01' },
  { t: 'paintRun', bus: 'BUS-008', model: 'CNG AMTS', date: '2026-08-21', origin: 'confirmed', status: 'closed', due: '2026-08-31', done: '2026-08-29' },
  { t: 'paintRun', bus: 'BUS-019', model: 'LPO', date: '2026-07-08', origin: 'confirmed', status: 'closed', due: '2026-07-18', done: '2026-07-16' },
  { t: 'sidePanel', bus: 'BUS-005', model: 'LP 4 SPCR', date: '2026-10-17', origin: 'unverified', status: 'open' },
  { t: 'sidePanel', bus: 'BUS-012', model: 'LPO', date: '2026-07-24', origin: 'confirmed', status: 'closed', due: '2026-08-04', done: '2026-08-02' },
  { t: 'sidePanel', bus: 'BUS-020', model: 'LP 4 SPCR', date: '2026-08-27', origin: 'investigating', status: 'open', due: '2026-09-20' },
  { t: 'windshield', bus: 'BUS-007', model: 'CNG AMTS', date: '2026-09-25', origin: 'confirmed', status: 'open', due: '2026-10-20' },
  { t: 'windshield', bus: 'BUS-021', model: 'LPO', date: '2026-09-10', origin: 'confirmed', status: 'closed', due: '2026-09-22', done: '2026-09-21' },
  { t: 'seatLoose', bus: 'BUS-009', model: 'LP 4 SPCR', date: '2026-10-06', origin: 'investigating', status: 'open', due: '2026-10-16' },
  { t: 'seatLoose', bus: 'BUS-022', model: 'LPO', date: '2026-08-19', origin: 'confirmed', status: 'closed', due: '2026-08-29', done: '2026-08-27' },
  { t: 'mirrorLoose', bus: 'BUS-010', model: 'LPO', date: '2026-10-11', origin: 'unverified', status: 'open' },
  { t: 'mirrorLoose', bus: 'BUS-023', model: 'CNG AMTS', date: '2026-09-14', origin: 'unverified', status: 'open' },
  { t: 'roofLeak', bus: 'BUS-013', model: 'LP 4 SPCR', date: '2026-10-19', origin: 'investigating', status: 'open', due: '2026-11-02' },
  { t: 'roofLeak', bus: 'BUS-024', model: 'LPO', date: '2026-07-02', origin: 'confirmed', status: 'closed', due: '2026-07-15', done: '2026-07-14' },
]

const PRIORITY = { critical: 'P1', major: 'P2', minor: 'P3' } as const

export const previewRecords: DefectRecord[] = OCC.map((o, i) => {
  const t = T[o.t]
  const confirmed = o.origin === 'confirmed'
  return {
    id: `PDI-${String(i + 1).padStart(4, '0')}`,
    busNumber: o.bus,
    busModel: o.model,
    description: t.description,
    category: t.category,
    detectedAt: 'PDI',
    detectedDate: o.date,
    severity: t.severity,
    sqpdcme: t.sqpdcme,
    candidateActivityIds: [t.origin, ...t.alternates],
    confirmedActivityId: confirmed ? t.origin : null,
    originStatus: o.origin,
    rootCause: confirmed && t.rootCause ? t.rootCause : null,
    owner: null,
    status: o.status,
    priority: PRIORITY[t.severity],
    corrective: {
      containment: t.containment || null,
      action: confirmed && t.action ? t.action : null,
      kind: confirmed && t.action ? 'approved' : 'recommendation',
      targetDate: o.due ?? null,
      completedDate: o.done ?? null,
      verificationEvidence: o.done ? 'Re-inspection passed at PDI (preview)' : null,
    },
  }
})

export const PREVIEW_PERIOD = { from: '2026-07-01', to: '2026-10-21' }
export const PREVIEW_BUSES_AUDITED: number | null = null
