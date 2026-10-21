// Defect-description → manufacturing-activity matching.
// Produces *candidate* origins with an explanation and a confidence band.
// A match is evidence for investigation, never a confirmed root cause.
import { activities, shopById, stationById, type Activity } from '@/lib/master'

const STOPWORDS = new Set(
  'a an the of to and or in on at for with by from is are was be this that issue issues problem problems defect defects related observed found not no bus vehicle near'.split(
    ' ',
  ),
)

/**
 * Concept groups. `object` concepts name a part or area of the bus; `mode` concepts
 * describe how something went wrong. A candidate must match at least one object
 * concept, so "gap" alone never pins a defect to every fitment activity.
 */
interface Concept {
  key: string
  kind: 'object' | 'mode'
  terms: string[]
}

export const CONCEPTS: Concept[] = [
  { key: 'door', kind: 'object', terms: ['door', 'doors', 'hatch', 'canopy', 'cannopy', 'aperture', 'limiter', 'limitor'] },
  { key: 'emergency', kind: 'object', terms: ['emergency'] },
  { key: 'lock', kind: 'object', terms: ['lock', 'latch', 'catcher', 'key', 'handle'] },
  { key: 'panel', kind: 'object', terms: ['panel', 'panelling', 'paneling', 'sheet', 'skirt', 'strech', 'stretch', 'streatch', 'pannel', 'frp'] },
  { key: 'harness', kind: 'object', terms: ['harness', 'wiring', 'wire', 'cable', 'electrical', 'connector', 'connectors', 'connection'] },
  { key: 'paint', kind: 'object', terms: ['paint', 'painting', 'painted', 'primer', 'coat', 'basecoat', 'topcoat', 'putty', 'booth', 'oven'] },
  { key: 'windshield', kind: 'object', terms: ['windshield', 'windshiled', 'windscreen', 'glass'] },
  { key: 'window', kind: 'object', terms: ['window', 'windows', 'peep'] },
  { key: 'seat', kind: 'object', terms: ['seat', 'seats', 'seating'] },
  { key: 'belt', kind: 'object', terms: ['belt', 'seatbelt'] },
  { key: 'fastener', kind: 'object', terms: ['fastener', 'fasteners', 'screw', 'screws', 'bolt', 'bolts', 'rivet', 'rivits', 'riveting', 'revieting', 'nut', 'torque'] },
  { key: 'lamp', kind: 'object', terms: ['lamp', 'lamps', 'light', 'headlamp', 'indicator', 'indicators', 'beam'] },
  { key: 'roof', kind: 'object', terms: ['roof'] },
  { key: 'weld', kind: 'object', terms: ['weld', 'welding', 'welded', 'spatter', 'spatters', 'spater'] },
  { key: 'sealant', kind: 'object', terms: ['sealant', 'sealing', 'seal', 'caulking', 'butyl'] },
  { key: 'mirror', kind: 'object', terms: ['mirror', 'mirrors', 'rvm'] },
  { key: 'wiper', kind: 'object', terms: ['wiper'] },
  { key: 'dashboard', kind: 'object', terms: ['dashboard', 'dashbaord', 'dash'] },
  { key: 'pneumatic', kind: 'object', terms: ['pneumatic', 'pnuematic', 'air'] },
  { key: 'beading', kind: 'object', terms: ['beading', 'profile', 'aluminium', 'aluminum'] },
  { key: 'flap', kind: 'object', terms: ['flap', 'flaps', 'cover'] },
  { key: 'gap', kind: 'mode', terms: ['gap', 'gaps', 'alignment', 'align', 'misalignment', 'misaligned', 'flush', 'flushness', 'clearance'] },
  { key: 'fouling', kind: 'mode', terms: ['fouling', 'foul', 'rubbing', 'interference', 'routing', 'clamp', 'clamps'] },
  { key: 'loose', kind: 'mode', terms: ['loose', 'missing', 'rattle', 'rattling', 'torque'] },
  { key: 'fitment', kind: 'mode', terms: ['fitment', 'fixing', 'fitting', 'fit', 'assembly', 'mounting', 'fitted', 'fixed', 'incorrect', 'wrong'] },
  { key: 'dust', kind: 'mode', terms: ['dust', 'dirt', 'contamination', 'particle', 'particles', 'clean', 'cleaning', 'blow'] },
  { key: 'leak', kind: 'mode', terms: ['leak', 'leakage', 'leaking', 'water', 'ingress'] },
  { key: 'dent', kind: 'mode', terms: ['dent', 'dents', 'waviness', 'wavy', 'scratch', 'scratches', 'damage', 'damaged'] },
  { key: 'paintfinish', kind: 'mode', terms: ['run', 'runs', 'sag', 'peel', 'orange', 'shade', 'overspray', 'sanding', 'sand'] },
  { key: 'function', kind: 'mode', terms: ['functionality', 'function', 'working', 'checking', 'check'] },
]

/** Failure modes that commonly arise during another kind of operation (weaker evidence). */
const RELATED: Record<string, string[]> = {
  gap: ['fitment', 'beading'],
  loose: ['fitment', 'fastener'],
  fouling: ['fitment'],
  leak: ['sealant'],
  dust: ['paint'],
  dent: ['panel'],
}

const termToConcept = new Map<string, Concept>()
for (const c of CONCEPTS) for (const t of c.terms) if (!termToConcept.has(t)) termToConcept.set(t, c)

export function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokenize(text: string) {
  return normalize(text)
    .split(/[\s.-]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
}

function stem(t: string) {
  if (t.length > 5 && t.endsWith('ing')) return t.slice(0, -3)
  if (t.length > 4 && t.endsWith('es')) return t.slice(0, -2)
  if (t.length > 3 && t.endsWith('s')) return t.slice(0, -1)
  return t
}

// ---- Index, built once ----------------------------------------------------
interface Indexed {
  activity: Activity
  tokens: Set<string>
  stems: Set<string>
  concepts: Set<string>
  context: Set<string>
  norm: string
}

const index: Indexed[] = activities.map((a) => {
  const text = [a.text, a.parentHeading ?? '', a.opCode ?? ''].join(' ')
  const toks = tokenize(text)
  const st = stationById.get(a.stationId)!
  const ctx = tokenize([shopById.get(a.shopId)!.name, st.label, st.subtitle ?? ''].join(' ')).map(stem)
  return {
    context: new Set(ctx.filter((t) => !['shop', 'station', 'area'].includes(t))),
    activity: a,
    tokens: new Set(toks),
    stems: new Set(toks.map(stem)),
    concepts: new Set(toks.map((t) => termToConcept.get(t)?.key).filter(Boolean) as string[]),
    norm: normalize(text),
  }
})

const docFreq = new Map<string, number>()
for (const d of index) for (const s of d.stems) docFreq.set(s, (docFreq.get(s) ?? 0) + 1)
const N = index.length
const idf = (s: string) => Math.log(1 + N / (1 + (docFreq.get(s) ?? 0)))

export const vocabulary = [...docFreq.keys()].filter((t) => t.length > 3)

// ---- Matching ---------------------------------------------------------------
export type MatchType = 'exact' | 'partial' | 'synonym' | 'code' | 'context' | 'related'

export interface MatchEvidence {
  query: string
  matched: string
  type: MatchType
  concept?: string
}

export type Confidence = 'High' | 'Medium' | 'Low'

export interface Candidate {
  activity: Activity
  score: number
  confidence: Confidence
  confidencePct: number
  evidence: MatchEvidence[]
  explanation: string
}

export interface MatchResult {
  query: string
  terms: string[]
  objectTerms: string[]
  candidates: Candidate[]
  broadQuery: boolean
  suggestions: string[]
}

const TYPE_WEIGHT: Record<MatchType, number> = { code: 1.2, exact: 1, partial: 0.75, synonym: 0.5, context: 0.45, related: 0.35 }

export function matchDefect(query: string, opts: { includeGeneric?: boolean; limit?: number } = {}): MatchResult {
  const terms = [...new Set(tokenize(query))]
  const queryConcepts = terms.map((t) => termToConcept.get(t) ?? termToConcept.get(stem(t)))
  const objectTerms = terms.filter((_, i) => queryConcepts[i]?.kind === 'object' || !queryConcepts[i])
  const broadQuery = terms.length > 0 && queryConcepts.every((c) => c?.kind === 'mode')
  const out: Candidate[] = []
  if (!terms.length) return { query, terms, objectTerms, candidates: [], broadQuery: false, suggestions: [] }

  for (const d of index) {
    if (!opts.includeGeneric && d.activity.kind !== 'operation') continue
    const evidence: MatchEvidence[] = []
    let score = 0
    let maxScore = 0
    let objectHit = false
    terms.forEach((t, i) => {
      const s = stem(t)
      const concept = queryConcepts[i]
      // Part/area words are weighted by rarity; failure-mode words carry a fixed weight
      // so a rare unmatched mode word cannot dominate the score.
      const w = concept?.kind === 'mode' ? 1.5 : Math.min(idf(s) || 3, 6)
      maxScore += w
      let type: MatchType | null = null
      let matched = t
      if (/^op\d+/.test(t) && d.norm.includes(t)) type = 'code'
      else if (d.tokens.has(t) || d.stems.has(s)) type = 'exact'
      else if (t.length >= 4) {
        const hit = [...d.tokens].find((x) => x.length >= 4 && (x.startsWith(s) || s.startsWith(x)))
        if (hit) {
          type = 'partial'
          matched = hit
        }
      }
      if (!type && concept && d.concepts.has(concept.key)) {
        type = 'synonym'
        matched = [...d.tokens].find((x) => termToConcept.get(x)?.key === concept.key) ?? concept.key
      }
      if (!type && d.context.has(s)) {
        type = 'context'
        matched = s
      }
      if (!type && concept && RELATED[concept.key]?.some((k) => d.concepts.has(k))) {
        type = 'related'
        matched = RELATED[concept.key].find((k) => d.concepts.has(k))!
      }
      if (!type) return
      if ((!concept || concept.kind === 'object') && type !== 'related') objectHit = true
      score += w * TYPE_WEIGHT[type]
      evidence.push({ query: t, matched, type, concept: concept?.key })
    })
    if (!evidence.length) continue
    // Never surface a candidate that only shares a failure-mode word with the query
    // (e.g. "gap" ↔ "fitment") unless the query itself names no part.
    if (!objectHit && !broadQuery) continue
    const coverage = evidence.length / terms.length
    let pct = Math.round(Math.min(1, (score / maxScore) * 0.75 + coverage * 0.25) * 100)
    if (broadQuery) pct = Math.min(pct, 40)
    const confidence: Confidence = pct >= 70 ? 'High' : pct >= 45 ? 'Medium' : 'Low'
    out.push({ activity: d.activity, score, confidence, confidencePct: pct, evidence, explanation: explain(evidence, terms.length) })
  }
  // Ties: more evidence first, then the more specific (shorter) activity description.
  out.sort(
    (a, b) =>
      b.confidencePct - a.confidencePct ||
      b.score - a.score ||
      a.activity.text.length - b.activity.text.length ||
      a.activity.id.localeCompare(b.activity.id),
  )
  const candidates = out.slice(0, opts.limit ?? 60)
  return { query, terms, objectTerms, candidates, broadQuery, suggestions: candidates.length ? [] : suggest(terms) }
}

function explain(ev: MatchEvidence[], total: number) {
  const parts = ev.map((e) =>
    e.type === 'exact'
      ? `“${e.query}” appears in the activity`
      : e.type === 'partial'
        ? `“${e.query}” partially matches “${e.matched}”`
        : e.type === 'code'
          ? `operation code ${e.query.toUpperCase()}`
          : e.type === 'context'
            ? `“${e.query}” matches the shop/station name`
            : e.type === 'related'
              ? `“${e.query}” can arise during ${e.matched} work (weak evidence)`
              : `“${e.query}” is related to “${e.matched}” (${e.concept} group)`,
  )
  return `${parts.join('; ')}. ${ev.length} of ${total} search term${total > 1 ? 's' : ''} matched.`
}

function lev(a: string, b: string) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[b.length]
}

function suggest(terms: string[]) {
  const pool = [...new Set([...vocabulary, ...CONCEPTS.map((c) => c.key)])]
  const scored: [string, number][] = []
  for (const t of terms) for (const v of pool) {
    const d = lev(stem(t), v)
    if (d <= Math.max(1, Math.floor(t.length / 3))) scored.push([v, d])
  }
  scored.sort((a, b) => a[1] - b[1])
  const picked = [...new Set(scored.map((s) => s[0]))].slice(0, 5)
  return picked.length ? picked : ['door', 'harness', 'panel', 'windshield', 'seat']
}

/** Plain keyword/hierarchy search used by the plant map search bar (includes checklist rows). */
export function searchActivities(query: string) {
  const q = normalize(query)
  if (!q) return []
  const res = matchDefect(query, { includeGeneric: true, limit: 500 })
  const ids = new Set(res.candidates.map((c) => c.activity.id))
  // Direct substring hits on op codes / multi-word phrases the tokenizer would split.
  for (const d of index) if (!ids.has(d.activity.id) && d.norm.includes(q)) {
    res.candidates.push({ activity: d.activity, score: 1, confidence: 'Medium', confidencePct: 60, evidence: [{ query: q, matched: q, type: 'exact' }], explanation: 'Phrase appears in the activity.' })
  }
  return res.candidates
}

export const DEFECT_SUGGESTIONS = [
  'Door related defect',
  'Door gap',
  'Emergency door fouling',
  'Door lock issue',
  'Side panel issue',
  'Harness fouling',
  'Paint dust',
  'Windshield fitment',
  'Seat fitment',
  'Loose fastener',
  'Incorrect component fitment',
]
