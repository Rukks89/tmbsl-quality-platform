// Analytics over defect records. Every function returns `null`/empty when the data
// needed is absent, so screens can say "unavailable" instead of showing zero.
import { activityById, shops, stationById, shopById } from '@/lib/master'
import {
  SEVERITY_WEIGHT,
  type Category,
  type DefectRecord,
  type Severity,
  type SQPDCME,
} from '@/lib/defects'

export const TODAY = '2026-10-21'

/** How a defect is attributed to a shop/station. */
export type Basis = 'confirmed' | 'attributed'
export const BASIS_LABEL: Record<Basis, string> = {
  confirmed: 'Confirmed origins only',
  attributed: 'Confirmed + leading candidate (unverified)',
}

export interface Filters {
  from: string
  to: string
  model: string
  bus: string
  shop: string
  station: string
  category: string
  status: string
  severity: string
}

export const EMPTY_FILTERS: Filters = { from: '', to: '', model: '', bus: '', shop: '', station: '', category: '', status: '', severity: '' }

export function originActivityId(r: DefectRecord, basis: Basis) {
  if (r.confirmedActivityId) return r.confirmedActivityId
  if (basis === 'attributed' && r.originStatus !== 'rejected') return r.candidateActivityIds[0] ?? null
  return null
}

export function originOf(r: DefectRecord, basis: Basis) {
  const id = originActivityId(r, basis)
  const a = id ? activityById.get(id) : undefined
  if (!a) return null
  return { activity: a, station: stationById.get(a.stationId)!, shop: shopById.get(a.shopId)! }
}

export function applyFilters(records: DefectRecord[], f: Filters, basis: Basis) {
  return records.filter((r) => {
    if (f.from && (!r.detectedDate || r.detectedDate < f.from)) return false
    if (f.to && (!r.detectedDate || r.detectedDate > f.to)) return false
    if (f.model && r.busModel !== f.model) return false
    if (f.bus && !r.busNumber.toLowerCase().includes(f.bus.toLowerCase())) return false
    if (f.category && r.category !== f.category) return false
    if (f.status && r.status !== f.status) return false
    if (f.severity && r.severity !== f.severity) return false
    if (f.shop || f.station) {
      const o = originOf(r, basis)
      if (!o) return false
      if (f.shop && o.shop.id !== f.shop) return false
      if (f.station && o.station.id !== f.station) return false
    }
    return true
  })
}

export function isOverdue(r: DefectRecord) {
  return !!r.corrective.targetDate && !r.corrective.completedDate && r.status === 'open' && r.corrective.targetDate < TODAY
}

export interface Bucket {
  key: string
  label: string
  shopId?: string
  color?: string
  count: number
  open: number
  closed: number
  severity: Record<Severity, number>
  records: DefectRecord[]
}

function bucket(key: string, label: string, extra: Partial<Bucket> = {}): Bucket {
  return { key, label, count: 0, open: 0, closed: 0, severity: { critical: 0, major: 0, minor: 0 }, records: [], ...extra }
}

function add(b: Bucket, r: DefectRecord) {
  b.count++
  b.records.push(r)
  if (r.status === 'open') b.open++
  else b.closed++
  b.severity[r.severity]++
}

export function byShop(records: DefectRecord[], basis: Basis) {
  const map = new Map(shops.map((s) => [s.id, bucket(s.id, s.name, { shopId: s.id })]))
  let unattributed = 0
  for (const r of records) {
    const o = originOf(r, basis)
    if (!o) {
      unattributed++
      continue
    }
    add(map.get(o.shop.id)!, r)
  }
  return { buckets: [...map.values()], unattributed }
}

export function byStation(records: DefectRecord[], basis: Basis) {
  const map = new Map<string, Bucket>()
  for (const r of records) {
    const o = originOf(r, basis)
    if (!o) continue
    if (!map.has(o.station.id)) map.set(o.station.id, bucket(o.station.id, `${o.shop.name} · ${o.station.label}`, { shopId: o.shop.id }))
    add(map.get(o.station.id)!, r)
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
}

export function byCategory(records: DefectRecord[]) {
  const map = new Map<Category, Bucket>()
  for (const r of records) {
    if (!map.has(r.category)) map.set(r.category, bucket(r.category, r.category))
    add(map.get(r.category)!, r)
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
}

export function bySqpdcme(records: DefectRecord[]) {
  const map = new Map<SQPDCME, Bucket>()
  for (const r of records) for (const c of r.sqpdcme) {
    if (!map.has(c)) map.set(c, bucket(c, c))
    add(map.get(c)!, r)
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
}

export interface ParetoRow {
  key: string
  label: string
  count: number
  share: number
  cumulative: number
  color?: string
}

export function pareto(items: { key: string; label: string; count: number; color?: string }[]): ParetoRow[] {
  const sorted = items.filter((i) => i.count > 0).sort((a, b) => b.count - a.count)
  const total = sorted.reduce((s, i) => s + i.count, 0)
  let cum = 0
  return sorted.map((i) => {
    cum += i.count
    return { ...i, share: total ? i.count / total : 0, cumulative: total ? cum / total : 0 }
  })
}

export function monthKey(d: string) {
  return d.slice(0, 7)
}

export function monthsBetween(from: string, to: string) {
  const out: string[] = []
  const [y0, m0] = from.split('-').map(Number)
  const [y1, m1] = to.split('-').map(Number)
  let y = y0
  let m = m0
  while (y < y1 || (y === y1 && m <= m1)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return out
}

/** Monthly counts per series key. Records without a date are excluded and reported. */
export function monthlyTrend(records: DefectRecord[], keyOf: (r: DefectRecord) => string | null) {
  const dated = records.filter((r) => r.detectedDate)
  if (!dated.length) return null
  const dates = dated.map((r) => r.detectedDate!).sort()
  const months = monthsBetween(dates[0], dates[dates.length - 1])
  const series = new Map<string, number[]>()
  for (const r of dated) {
    const k = keyOf(r)
    if (!k) continue
    if (!series.has(k)) series.set(k, months.map(() => 0))
    series.get(k)![months.indexOf(monthKey(r.detectedDate!))]++
  }
  return { months, series, undated: records.length - dated.length }
}

export function repeatDefects(records: DefectRecord[], basis: Basis) {
  const map = new Map<string, DefectRecord[]>()
  for (const r of records) {
    const k = r.description.toLowerCase()
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(r)
  }
  return [...map.values()]
    .map((rs) => ({
      description: rs[0].description,
      occurrences: rs.length,
      buses: new Set(rs.map((r) => r.busNumber)).size,
      open: rs.filter((r) => r.status === 'open').length,
      origin: originOf(rs[0], basis),
      records: rs,
    }))
    .filter((x) => x.occurrences > 1)
    .sort((a, b) => b.occurrences - a.occurrences || b.buses - a.buses)
}

// ---- Risk model (disclosed in the UI) -------------------------------------
// Risk score for a dimension = Σ severity weight (critical 3, major 2, minor 1)
// of records tagged with that SQPDCME dimension. RAG: 0 = green, 1–5 = amber, ≥6 = red.
// Defect-count RAG uses share of filtered total: ≥25% red, ≥10% amber, else green.
export type Rag = 'green' | 'amber' | 'red'

export function riskScore(records: DefectRecord[], dims: SQPDCME[]) {
  return records.filter((r) => r.sqpdcme.some((d) => dims.includes(d))).reduce((s, r) => s + SEVERITY_WEIGHT[r.severity], 0)
}
export function ragForScore(score: number): Rag {
  return score >= 6 ? 'red' : score >= 1 ? 'amber' : 'green'
}
export function ragForShare(share: number): Rag {
  return share >= 0.25 ? 'red' : share >= 0.1 ? 'amber' : 'green'
}
export const RISK_RULES = [
  'Risk score = sum of severity weights (critical 3, major 2, minor 1) of records tagged with the dimension.',
  'Quality risk uses Q-tagged records; Safety risk uses S-tagged; Productivity risk uses P- and D-tagged.',
  'RAG for risk scores: 0 green · 1–5 amber · 6 or more red.',
  'RAG for defect count: share of filtered total ≥25% red · ≥10% amber · otherwise green.',
]
