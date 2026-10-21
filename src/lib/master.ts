// Typed access to the preloaded manufacturing master data.
// Source of truth: data/Shop-Station-Activity.xlsx → scripts/ingest_workbook.py → src/data/master-data.json
import raw from '@/data/master-data.json'

export type ActivityKind = 'operation' | 'checklist' | 'transfer'

export interface Activity {
  id: string
  stationId: string
  shopId: string
  opGroup: string | null
  opCode: string | null
  text: string
  parentHeading: string | null
  kind: ActivityKind
  source: string
  sourceRef: string
  sourceRow: number
  sourceLine: number
  repaired: boolean
}

export interface Station {
  id: string
  shopId: string
  label: string
  number: string | null
  code: string | null
  subtitle: string | null
  sourceLabel: string
  sourceRow: number
  order: number
  activities: Activity[]
}

export interface Shop {
  id: string
  name: string
  sourceName: string
  sourceRow: number
  order: number
  stations: Station[]
}

export interface ValidationNote {
  row: number
  level: 'info' | 'warning' | 'error'
  message: string
  text?: string
}

interface MasterData {
  source: { file: string; sheet: string; columns: string[]; rows: number }
  totals: {
    shops: number
    stations: number
    activities: number
    codedOperations: number
    repairedTexts: number
    sourceRows: number
    mergedRanges: number
  }
  shops: Shop[]
  warnings: ValidationNote[]
  duplicatesRemoved: { row: number; stationId: string; text: string; reason: string }[]
}

export const master = raw as MasterData
export const shops: Shop[] = master.shops
export const stations: Station[] = shops.flatMap((s) => s.stations)
export const activities: Activity[] = stations.flatMap((s) => s.activities)

export const shopById = new Map(shops.map((s) => [s.id, s]))
export const stationById = new Map(stations.map((s) => [s.id, s]))
export const activityById = new Map(activities.map((a) => [a.id, a]))

/** Fixed identity per shop: colour (validated categorical slot), short code and order. */
export const SHOP_STYLE: Record<string, { color: string; code: string }> = {
  chassis: { color: '#3987e5', code: 'CHS' },
  jigs: { color: '#d95926', code: 'JIG' },
  coupling: { color: '#199e70', code: 'CPL' },
  paneling: { color: '#c98500', code: 'PNL' },
  paint: { color: '#d55181', code: 'PNT' },
  trim: { color: '#9085e9', code: 'TRM' },
}

export function shopStyle(shopId: string) {
  return SHOP_STYLE[shopId] ?? { color: '#8b98ab', code: shopId.slice(0, 3).toUpperCase() }
}

/** Station where vehicles are inspected before delivery, taken from the workbook (Trim Shop → PDI). */
export const PDI_STATION_ID = 'trim-pdi'

export function stationTitle(st: Station) {
  return st.label
}

export function activityPath(a: Activity) {
  const st = stationById.get(a.stationId)!
  const sh = shopById.get(a.shopId)!
  return { shop: sh, station: st }
}

/** Shop names the business uses that are not present as separate shops in the workbook. */
export const UNMAPPED_SHOP_NAMES = ['LCV Jigs', 'LCV Coupling', 'MCV Jigs', 'MCV Coupling']
