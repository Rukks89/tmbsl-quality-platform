// Grounded question answering over the workbook and the active defect records.
// Milestone 1 uses deterministic retrieval (no generative model), so every statement
// is traceable to a row. Milestone 5 adds an AI Gateway model on top of the same
// retrieval layer, keeping these references as citations.
import { activities, activityById, shops, stationById, shopById, type Activity } from '@/lib/master'
import { matchDefect, tokenize, type Candidate } from '@/lib/matching'
import { byShop, byStation, isOverdue, repeatDefects, type Basis } from '@/lib/analytics'
import type { DefectRecord } from '@/lib/defects'

export type Ref =
  | { type: 'shop'; id: string; label: string }
  | { type: 'station'; id: string; label: string }
  | { type: 'activity'; id: string; label: string }
  | { type: 'record'; id: string; label: string }

export interface Answer {
  text: string[]
  refs: Ref[]
  followUps: string[]
  grounding: 'workbook' | 'records' | 'recommendation' | 'not-found'
}

export interface AssistantContext {
  page: 'plant' | 'trace' | 'defects'
  records: DefectRecord[]
  recordsLabel: string
  basis: Basis
  defectQuery?: string
  busNumber?: string
  candidates?: Candidate[]
  selectedActivityId?: string | null
  selectedShopId?: string | null
}

const INTENT_WORDS = new Set(
  'which what where who how show list all give find tell me shops shop stations station perform performs performed handle handles handled contain contains containing involve involving activities activity operations operation process sequence explain do does done are there any can could please'.split(
    ' ',
  ),
)

function topicOf(q: string) {
  return tokenize(q).filter((t) => !INTENT_WORDS.has(t) && !/^\d+$/.test(t)).join(' ')
}

const actRef = (a: Activity): Ref => ({
  type: 'activity',
  id: a.id,
  label: `${a.opCode ? a.opCode + ' ' : ''}${a.text.length > 60 ? a.text.slice(0, 57) + '…' : a.text}`,
})
const stRef = (id: string): Ref => {
  const st = stationById.get(id)!
  return { type: 'station', id, label: `${shopById.get(st.shopId)!.name} · ${st.label}` }
}

function groupByStation(list: Activity[]) {
  const m = new Map<string, Activity[]>()
  for (const a of list) {
    if (!m.has(a.stationId)) m.set(a.stationId, [])
    m.get(a.stationId)!.push(a)
  }
  return m
}

function topicAnswer(topic: string, raw: string): Answer {
  const res = matchDefect(topic, { limit: 80 })
  const strong = res.candidates.filter((c) => c.confidence !== 'Low')
  const list = (strong.length ? strong : res.candidates).map((c) => c.activity)
  if (!list.length) {
    return {
      text: [
        `The workbook does not contain an activity matching “${topic || raw}”.`,
        res.suggestions.length ? `Related terms that do appear: ${res.suggestions.join(', ')}.` : '',
      ].filter(Boolean),
      refs: [],
      followUps: res.suggestions.slice(0, 3).map((s) => `Show all ${s} activities`),
      grounding: 'not-found',
    }
  }
  const groups = groupByStation(list)
  const shopIds = [...new Set(list.map((a) => a.shopId))]
  const text = [
    `${list.length} workbook activit${list.length === 1 ? 'y matches' : 'ies match'} “${topic}”, across ${groups.size} station${groups.size === 1 ? '' : 's'} in ${shopIds.length} shop${shopIds.length === 1 ? '' : 's'}: ${shopIds.map((s) => shopById.get(s)!.name).join(', ')}.`,
    ...[...groups.entries()].slice(0, 6).map(([sid, acts]) => {
      const st = stationById.get(sid)!
      return `• ${shopById.get(st.shopId)!.name} · ${st.label}: ${acts.slice(0, 3).map((a) => a.text).join('; ')}${acts.length > 3 ? ` (+${acts.length - 3} more)` : ''}`
    }),
    groups.size > 6 ? `…and ${groups.size - 6} more stations. Open the references to see each on the plant map.` : '',
  ].filter(Boolean)
  return {
    text,
    refs: [...shopIds.map((id) => ({ type: 'shop', id, label: shopById.get(id)!.name }) as Ref), ...[...groups.keys()].slice(0, 8).map(stRef), ...list.slice(0, 6).map(actRef)],
    followUps: [`Why do these stations match “${topic}”?`, `Which ${topic} activities happen in Trim Shop?`],
    grounding: 'workbook',
  }
}

function stationNumberAnswer(num: string): Answer {
  const matches = shops.flatMap((s) => s.stations.filter((st) => st.number === num.padStart(2, '0')))
  if (!matches.length) return { text: [`No station numbered ${num} exists in the workbook.`], refs: [], followUps: ['What activities are performed at Station 40?'], grounding: 'not-found' }
  const text = [
    matches.length > 1
      ? `Station ${num} exists in ${matches.length} shops. The workbook lists:`
      : `Station ${num} is in ${shopById.get(matches[0].shopId)!.name}. The workbook lists:`,
    ...matches.map((st) => {
      const ops = st.activities.filter((a) => a.kind === 'operation')
      return `• ${shopById.get(st.shopId)!.name} · ${st.label} — ${ops.length} operations: ${ops.slice(0, 5).map((a) => a.text).join('; ')}${ops.length > 5 ? '; …' : ''}`
    }),
  ]
  return { text, refs: matches.map((m) => stRef(m.id)), followUps: matches.map((m) => `Explain the process sequence for ${shopById.get(m.shopId)!.name}`).slice(0, 2), grounding: 'workbook' }
}

function shopSequence(shopId: string): Answer {
  const s = shopById.get(shopId)!
  return {
    text: [
      `${s.name} has ${s.stations.length} stations in workbook order (row ${s.sourceRow} onward):`,
      ...s.stations.map((st, i) => `${i + 1}. ${st.label} — ${st.activities.length} activities, starting with “${st.activities[0]?.text ?? '—'}”`),
      'This sequence reflects the workbook row order; a verified takt/flow sequence can be added in the process mapping layer.',
    ],
    refs: [{ type: 'shop', id: s.id, label: s.name }, ...s.stations.map((st) => stRef(st.id))],
    followUps: [`Which stations in ${s.name} involve harness work?`],
    grounding: 'workbook',
  }
}

function needRecords(ctx: AssistantContext): Answer | null {
  if (ctx.records.length) return null
  return {
    text: [
      'No verified PDI defect records are connected yet, so I cannot rank shops, stations or defects without inventing numbers.',
      'Process tracing over the workbook still works — ask about activities, stations or shops. Switch the data source to “Preview dataset” to explore the analytics screens with illustrative records.',
    ],
    refs: [],
    followUps: ['Show all door-related activities'],
    grounding: 'not-found',
  }
}

export function answer(question: string, ctx: AssistantContext): Answer {
  const q = question.toLowerCase().trim()
  if (!q) return { text: ['Ask about shops, stations, activities or defect records.'], refs: [], followUps: [], grounding: 'not-found' }
  const src = `Source: ${ctx.recordsLabel}.`

  // --- Investigation-context questions -------------------------------------
  const cands = ctx.candidates ?? []
  if (/(originat|trace|could .* (come|start)|candidate|alternative)/.test(q) && ctx.page === 'trace') {
    if (!ctx.defectQuery) return { text: ['Enter a defect description (and bus number if known) and run Trace Origin first.'], refs: [], followUps: [], grounding: 'not-found' }
    if (!cands.length) return topicAnswer(topicOf(ctx.defectQuery), ctx.defectQuery)
    const top = cands.slice(0, 5)
    return {
      text: [
        `For “${ctx.defectQuery}”${ctx.busNumber ? ` on ${ctx.busNumber}` : ''}, ${cands.length} workbook activities are potential origins. These are candidates for investigation, not confirmed root causes.`,
        ...top.map((c, i) => {
          const st = stationById.get(c.activity.stationId)!
          return `${i + 1}. ${shopById.get(st.shopId)!.name} · ${st.label} — “${c.activity.text}” (match ${c.confidencePct}%, ${c.confidence.toLowerCase()})`
        }),
      ],
      refs: top.map((c) => actRef(c.activity)),
      followUps: ['Why is this station a possible match?', 'What verification should the quality engineer perform?'],
      grounding: 'workbook',
    }
  }
  if (/why .*(match|station|possible)/.test(q)) {
    const sel = cands.find((c) => c.activity.id === ctx.selectedActivityId) ?? cands[0]
    if (!sel) return { text: ['Select a candidate activity first, then ask why it matches.'], refs: [], followUps: [], grounding: 'not-found' }
    const st = stationById.get(sel.activity.stationId)!
    return {
      text: [
        `${shopById.get(st.shopId)!.name} · ${st.label} is proposed because: ${sel.explanation}`,
        `Workbook text (${sel.activity.sourceRef}): “${sel.activity.source}”.`,
        'A text match shows this operation handles the affected part. It does not show the defect was introduced here — that needs physical verification.',
      ],
      refs: [actRef(sel.activity), stRef(st.id)],
      followUps: ['What evidence is needed to confirm the origin?', 'What other activities should be checked?'],
      grounding: 'workbook',
    }
  }
  if (/(evidence|verif|confirm the origin|missing)/.test(q)) {
    const sel = cands.find((c) => c.activity.id === ctx.selectedActivityId) ?? cands[0]
    const where = sel ? `${shopById.get(sel.activity.shopId)!.name} · ${stationById.get(sel.activity.stationId)!.label}` : 'the candidate station'
    return {
      text: [
        'Recommendation (not an established fact): to confirm or reject this origin, gather —',
        `• Physical re-inspection of the defect on the bus and comparison with the operation output at ${where}.`,
        '• The station check sheet / PA book entry for the bus’s build date and shift.',
        '• Whether the WIS for the operation covers the failing characteristic (gap, torque, routing, sealant bead…).',
        '• Results on the next 3–5 buses through the same station.',
        `Missing in this platform today: process names, owners, and work-instruction links are not in the workbook${ctx.records.length ? '' : ', and no verified PDI records are connected'}.`,
      ],
      refs: sel ? [actRef(sel.activity)] : [],
      followUps: ['What corrective actions may be appropriate?'],
      grounding: 'recommendation',
    }
  }
  if (/corrective|containment|what action/.test(q)) {
    const related = ctx.defectQuery ? ctx.records.filter((r) => topicOf(r.description).split(' ').some((t) => topicOf(ctx.defectQuery!).includes(t))) : []
    const approved = related.filter((r) => r.corrective.kind === 'approved' && r.corrective.action)
    return {
      text: [
        approved.length
          ? `${approved.length} related record(s) carry an approved corrective action: ${[...new Set(approved.map((r) => r.corrective.action))].join(' | ')}. ${src}`
          : 'No approved corrective action exists for this defect in the active records.',
        'Recommendation: contain first (100% check of buses in yard/PDI for the same characteristic), then add the failing characteristic to the candidate station’s check list, and verify on subsequent buses before closure.',
      ],
      refs: approved.slice(0, 5).map((r) => ({ type: 'record', id: r.id, label: `${r.id} · ${r.busNumber}` }) as Ref),
      followUps: [],
      grounding: approved.length ? 'records' : 'recommendation',
    }
  }

  // --- Record analytics -------------------------------------------------------
  if (/(most|highest|top|lowest|least|compare|repeat|open issue|overdue|attention|summar|increas|trend|how many)/.test(q) && /(defect|issue|shop|station|record|ceo|action|bus)/.test(q)) {
    const none = needRecords(ctx)
    if (none) return none
    const recs = ctx.records
    if (/repeat/.test(q)) {
      const rep = repeatDefects(recs, ctx.basis).slice(0, 10)
      if (!rep.length) return { text: [`No defect description repeats in the active records. ${src}`], refs: [], followUps: [], grounding: 'records' }
      return {
        text: [`Top repeating defects (${src}):`, ...rep.map((r, i) => `${i + 1}. ${r.description} — ${r.occurrences} occurrences on ${r.buses} buses, ${r.open} open${r.origin ? `; origin ${r.origin.shop.name} · ${r.origin.station.label}` : ''}`)],
        refs: rep.slice(0, 6).map((r) => ({ type: 'record', id: r.records[0].id, label: r.description }) as Ref),
        followUps: ['Which open issues require immediate attention?'],
        grounding: 'records',
      }
    }
    if (/overdue|attention|immediate/.test(q)) {
      const od = recs.filter(isOverdue)
      const crit = recs.filter((r) => r.status === 'open' && r.severity === 'critical')
      const ids = [...new Set([...od, ...crit])]
      return {
        text: [
          `${od.length} open issue(s) have an overdue corrective-action target date and ${crit.length} open issue(s) are critical severity (${src}, today ${'2026-10-21'}).`,
          ...ids.slice(0, 8).map((r) => `• ${r.id} ${r.busNumber}: ${r.description} — ${r.severity}${isOverdue(r) ? `, overdue since ${r.corrective.targetDate}` : ''}`),
        ],
        refs: ids.slice(0, 8).map((r) => ({ type: 'record', id: r.id, label: `${r.id} · ${r.busNumber}` }) as Ref),
        followUps: ['Show the top 10 repeating defects'],
        grounding: 'records',
      }
    }
    const named = shops.filter((s) => q.includes(s.name.toLowerCase().split(' ')[0]))
    const { buckets, unattributed } = byShop(recs, ctx.basis)
    if (/compare/.test(q) && named.length >= 2) {
      const total = buckets.reduce((s, b) => s + b.count, 0)
      return {
        text: named.map((s) => {
          const b = buckets.find((x) => x.key === s.id)!
          return `• ${s.name}: ${b.count} defects (${total ? Math.round((b.count / total) * 100) : 0}% of attributed), ${b.open} open, ${b.severity.critical} critical.`
        }).concat([`Attribution basis: ${ctx.basis === 'confirmed' ? 'confirmed origins only' : 'confirmed + leading candidate'}. ${src}`]),
        refs: named.map((s) => ({ type: 'shop', id: s.id, label: s.name }) as Ref),
        followUps: [],
        grounding: 'records',
      }
    }
    if (/station/.test(q)) {
      const st = byStation(recs, ctx.basis).slice(0, 5)
      if (!st.length) return { text: [`No records are attributed to a station on this basis. ${src}`], refs: [], followUps: [], grounding: 'records' }
      return {
        text: [`Stations with the most attributed defects (${src}):`, ...st.map((b, i) => `${i + 1}. ${b.label} — ${b.count} (${b.open} open)`)],
        refs: st.map((b) => stRef(b.key)),
        followUps: ['Show the top 10 repeating defects'],
        grounding: 'records',
      }
    }
    const sorted = [...buckets].sort((a, b) => b.count - a.count)
    const pick = /lowest|least/.test(q) ? sorted[sorted.length - 1] : sorted[0]
    return {
      text: [
        `${pick.label} has the ${/lowest|least/.test(q) ? 'lowest' : 'highest'} attributed defect count: ${pick.count} of ${recs.length - unattributed} attributed records (${pick.open} open).`,
        `Ranking: ${sorted.map((b) => `${b.label} ${b.count}`).join(' · ')}.`,
        `${unattributed} record(s) have no origin on this basis and are excluded. ${src}`,
      ],
      refs: [{ type: 'shop', id: pick.key, label: pick.label }],
      followUps: ['Which stations show the most defects?', 'Compare defect contribution between Paneling and Trim'],
      grounding: 'records',
    }
  }

  // --- Workbook navigation ----------------------------------------------------
  const stNum = q.match(/(?:station|stn|st)[\s-]*(\d{1,2})\b/)
  if (stNum && !topicOf(q.replace(stNum[0], ''))) return stationNumberAnswer(stNum[1])
  if (/sequence|flow|order/.test(q)) {
    const sid = ctx.selectedShopId ?? shops.find((s) => q.includes(s.name.toLowerCase().split(' ')[0]))?.id
    if (sid) return shopSequence(sid)
    return {
      text: ['Plant flow in workbook order:', ...shops.map((s, i) => `${i + 1}. ${s.name} — ${s.stations.length} stations, ${s.stations.reduce((n, st) => n + st.activities.length, 0)} activities`)],
      refs: shops.map((s) => ({ type: 'shop', id: s.id, label: s.name }) as Ref),
      followUps: ['Explain the process sequence for Paneling Shop'],
      grounding: 'workbook',
    }
  }
  if (stNum) return stationNumberAnswer(stNum[1])
  const code = q.match(/op\s?(\d{1,2})/)
  if (code) {
    const g = `OP${code[1].padStart(2, '0')}`
    const list = activities.filter((a) => a.opGroup === g)
    if (list.length) return { text: [`${g} covers ${list.length} operations:`, ...list.map((a) => `• ${a.opCode} ${a.text}`)], refs: [stRef(list[0].stationId), ...list.slice(0, 5).map(actRef)], followUps: [], grounding: 'workbook' }
  }
  const topic = topicOf(q)
  return topicAnswer(topic, question)
}

export function refActivity(ref: Ref) {
  return ref.type === 'activity' ? activityById.get(ref.id) : undefined
}
