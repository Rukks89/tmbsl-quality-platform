import * as React from 'react'
import { ChevronsDownUp, ChevronsUpDown, Minus, Plus, RotateCcw, Rotate3d } from 'lucide-react'

import { cn } from '@/lib/utils'
import { PDI_STATION_ID, shops, shopStyle, type Activity, type Station } from '@/lib/master'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// ---- Layout ------------------------------------------------------------------
const COL_W = 236
const GAP_X = 92
const X0 = 48
const Y0 = 34
const HEADER_H = 78
const TILE_W = 212
const PIP = 11
const PIP_GAP = 4
const PIP_COLS = 11
const ROW_H = 17
const TILE_HEAD = 34
const TILE_GAP = 14
const DEPTH = 6

interface TileLayout {
  station: Station
  x: number
  y: number
  h: number
  expanded: boolean
  pips: Map<string, { x: number; y: number }>
}
interface ColumnLayout {
  shopId: string
  x: number
  collapsed: boolean
  tiles: TileLayout[]
  bottom: number
}

function computeLayout(collapsedShops: Set<string>, expandedStations: Set<string>) {
  const cols: ColumnLayout[] = []
  shops.forEach((shop, i) => {
    const x = X0 + i * (COL_W + GAP_X)
    let y = Y0 + HEADER_H + 22
    const collapsed = collapsedShops.has(shop.id)
    const tiles: TileLayout[] = []
    if (!collapsed) {
      for (const st of shop.stations) {
        const expanded = expandedStations.has(st.id)
        const pips = new Map<string, { x: number; y: number }>()
        let h: number
        if (expanded) {
          st.activities.forEach((a, k) => pips.set(a.id, { x: x + 14, y: y + TILE_HEAD + k * ROW_H + 6 }))
          h = TILE_HEAD + st.activities.length * ROW_H + 10
        } else {
          st.activities.forEach((a, k) =>
            pips.set(a.id, { x: x + 12 + (k % PIP_COLS) * (PIP + PIP_GAP) + PIP / 2, y: y + TILE_HEAD + Math.floor(k / PIP_COLS) * (PIP + PIP_GAP) + PIP / 2 }),
          )
          h = TILE_HEAD + Math.ceil(st.activities.length / PIP_COLS) * (PIP + PIP_GAP) + 8
        }
        tiles.push({ station: st, x, y, h, expanded, pips })
        y += h + TILE_GAP
      }
    }
    cols.push({ shopId: shop.id, x, collapsed, tiles, bottom: y })
  })
  const width = X0 * 2 + shops.length * COL_W + (shops.length - 1) * GAP_X
  const height = Math.max(...cols.map((c) => c.bottom)) + 40
  return { cols, width, height }
}

// ---- Component -----------------------------------------------------------------
export interface PlantMapProps {
  highlightIds?: Set<string>
  candidateIds?: string[]
  selectedActivityId?: string | null
  selectedStationId?: string | null
  isolatedShopId?: string | null
  stationBadges?: Map<string, number>
  showTrace?: boolean
  onSelectActivity?: (a: Activity) => void
  onSelectStation?: (s: Station) => void
  onSelectShop?: (shopId: string) => void
  focusKey?: string | null
  className?: string
}

const ACCENT = '#4cc3e6'

export function PlantMap({
  highlightIds,
  candidateIds = [],
  selectedActivityId,
  selectedStationId,
  isolatedShopId,
  stationBadges,
  showTrace,
  onSelectActivity,
  onSelectStation,
  onSelectShop,
  focusKey,
  className,
}: PlantMapProps) {
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set())
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())
  const [view, setView] = React.useState({ k: 0.62, tx: 12, ty: 8 })
  const [tilt, setTilt] = React.useState(16)
  const [spin, setSpin] = React.useState(0)
  const [hover, setHover] = React.useState<Activity | null>(null)
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const drag = React.useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null)

  const [dragging, setDragging] = React.useState(false)
  const toggleShop = (id: string) => {
    onSelectShop?.(id)
    setCollapsed((c) => toggle(c, id))
  }
  const toggleStation = (id: string) => setExpanded((e) => toggle(e, id))

  const layout = React.useMemo(() => computeLayout(collapsed, expanded), [collapsed, expanded])
  const tileById = React.useMemo(() => new Map(layout.cols.flatMap((c) => c.tiles.map((t) => [t.station.id, t]))), [layout])

  // Ensure the selected station is expanded so its activities can be read.
  React.useEffect(() => {
    if (!selectedStationId) return
    const st = shops.flatMap((s) => s.stations).find((s) => s.id === selectedStationId)
    if (!st) return
    setCollapsed((c) => (c.has(st.shopId) ? new Set([...c].filter((x) => x !== st.shopId)) : c))
    setExpanded((e) => (e.has(st.id) ? e : new Set([...e, st.id])))
  }, [selectedStationId])

  const fitAll = React.useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const k = Math.min(el.clientWidth / layout.width, 1)
    setView({ k: Math.max(k, 0.32), tx: Math.max(0, (el.clientWidth - layout.width * k) / 2), ty: 8 })
  }, [layout.width])

  React.useEffect(() => {
    fitAll()
    // only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const focusPoint = React.useCallback((x: number, y: number, k = 1.05) => {
    const el = wrapRef.current
    if (!el) return
    setView({ k, tx: el.clientWidth / 2 - x * k, ty: el.clientHeight / 2.4 - y * k })
  }, [])

  // Focus on the selected activity / station when asked to.
  React.useEffect(() => {
    if (!focusKey) return
    const id = requestAnimationFrame(() => {
      if (selectedActivityId) {
        for (const t of tileById.values()) {
          const p = t.pips.get(selectedActivityId)
          if (p) return focusPoint(p.x + 80, p.y)
        }
      }
      if (selectedStationId) {
        const t = tileById.get(selectedStationId)
        if (t) return focusPoint(t.x + TILE_W / 2, t.y + 60)
      }
      if (isolatedShopId) {
        const c = layout.cols.find((c) => c.shopId === isolatedShopId)
        if (c) focusPoint(c.x + COL_W / 2, Y0 + 260, 0.85)
      }
    })
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, tileById])

  const zoom = (f: number) => {
    const el = wrapRef.current
    if (!el) return
    setView((v) => {
      const k = Math.min(2.4, Math.max(0.25, v.k * f))
      const cx = el.clientWidth / 2
      const cy = el.clientHeight / 2
      return { k, tx: cx - ((cx - v.tx) * k) / v.k, ty: cy - ((cy - v.ty) * k) / v.k }
    })
  }

  const reset = () => {
    setTilt(16)
    setSpin(0)
    setExpanded(new Set())
    setCollapsed(new Set())
    requestAnimationFrame(fitAll)
  }

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) < 40 && e.deltaX !== 0) {
      setView((v) => ({ ...v, tx: v.tx - e.deltaX, ty: v.ty - e.deltaY }))
      return
    }
    zoom(e.deltaY > 0 ? 0.9 : 1.1)
  }

  const hasHighlight = (highlightIds?.size ?? 0) > 0 || candidateIds.length > 0
  const candidateSet = new Set(candidateIds)
  const highlightStation = new Set<string>()
  const highlightShop = new Set<string>()
  for (const c of layout.cols) for (const t of c.tiles) for (const id of t.pips.keys()) if (highlightIds?.has(id) || candidateSet.has(id)) {
    highlightStation.add(t.station.id)
    highlightShop.add(c.shopId)
  }
  // Collapsed shops still count matches in the header.
  const matchCountByShop = new Map<string, number>()
  for (const s of shops) {
    let n = 0
    for (const st of s.stations) for (const a of st.activities) if (highlightIds?.has(a.id) || candidateSet.has(a.id)) n++
    matchCountByShop.set(s.id, n)
    if (n) highlightShop.add(s.id)
  }

  // Trace geometry
  const pdiTile = tileById.get(PDI_STATION_ID)
  const findPip = (id: string) => {
    for (const t of tileById.values()) {
      const p = t.pips.get(id)
      if (p) return p
    }
    return null
  }
  const target = selectedActivityId ? findPip(selectedActivityId) : null
  const tracePath = (p: { x: number; y: number }) => {
    if (!pdiTile) return ''
    const sx = pdiTile.x + TILE_W / 2
    const sy = pdiTile.y + pdiTile.h + DEPTH
    const midY = layout.height - 10
    return `M${sx},${sy} C${sx},${midY} ${p.x},${midY} ${p.x},${p.y + 6}`
  }

  return (
    <div className={cn('relative overflow-hidden rounded-lg border border-border bg-[#080d14]', className)}>
      {/* Floor grid + vignette */}
      <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(76,195,230,0.10),transparent_60%)]" />

      <div
        ref={wrapRef}
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
        style={{ perspective: '1800px' }}
        onWheel={onWheel}
        onPointerDown={(e) => {
          if ((e.target as Element).closest('[data-node]')) return
          drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false }
          setDragging(true)
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d) return
          d.moved = true
          setView((v) => ({ ...v, tx: d.tx + e.clientX - d.x, ty: d.ty + e.clientY - d.y }))
        }}
        onPointerUp={() => {
          drag.current = null
          setDragging(false)
        }}
      >
        <div
          className="h-full w-full transition-transform duration-500 motion-reduce:transition-none"
          style={{ transform: `rotateX(${tilt}deg) rotateZ(${spin}deg)`, transformOrigin: '50% 40%', transformStyle: 'preserve-3d' }}
        >
          <svg className="h-full w-full select-none" role="img" aria-label="Manufacturing plant process map: shops, stations and activities from the workbook">
            <defs>
              <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#000" floodOpacity="0.55" />
              </filter>
              <linearGradient id="tileTop" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#172233" />
                <stop offset="1" stopColor="#111a27" />
              </linearGradient>
            </defs>
            <g transform={`translate(${view.tx},${view.ty}) scale(${view.k})`} style={{ transition: dragging ? 'none' : 'transform 450ms cubic-bezier(.2,.8,.2,1)' }}>
              {/* Shop-to-shop flow */}
              {layout.cols.slice(0, -1).map((c, i) => {
                const n = layout.cols[i + 1]
                const y = Y0 + HEADER_H / 2
                const x1 = c.x + COL_W - 6
                const x2 = n.x + 6
                return (
                  <g key={`flow-${c.shopId}`}>
                    <path d={`M${x1},${y} C${x1 + 40},${y - 26} ${x2 - 40},${y + 26} ${x2},${y}`} fill="none" stroke="#2b3b52" strokeWidth="6" strokeLinecap="round" />
                    <path className="flow-line" d={`M${x1},${y} C${x1 + 40},${y - 26} ${x2 - 40},${y + 26} ${x2},${y}`} fill="none" stroke={ACCENT} strokeOpacity="0.7" strokeWidth="2" />
                    <path d={`M${x2 - 9},${y - 5} L${x2 - 1},${y} L${x2 - 9},${y + 5}`} fill="none" stroke={ACCENT} strokeWidth="2" />
                  </g>
                )
              })}

              {layout.cols.map((col) => {
                const shop = shops.find((s) => s.id === col.shopId)!
                const style = shopStyle(shop.id)
                const dimShop = (isolatedShopId && isolatedShopId !== shop.id) || (hasHighlight && !highlightShop.has(shop.id))
                const nActs = shop.stations.reduce((n, s) => n + s.activities.length, 0)
                return (
                  <g key={shop.id} opacity={dimShop ? 0.28 : 1} style={{ transition: 'opacity 300ms' }}>
                    {/* Spine */}
                    {!col.collapsed && col.tiles.length > 0 && (
                      <path
                        d={`M${col.x + COL_W / 2 - 92},${Y0 + HEADER_H} L${col.x + COL_W / 2 - 92},${col.tiles[col.tiles.length - 1].y + 16}`}
                        stroke={style.color}
                        strokeOpacity="0.45"
                        strokeWidth="2"
                      />
                    )}
                    {/* Shop header: hexagonal prism (fixed shop shape) */}
                    <g
                      data-node
                      role="button"
                      tabIndex={0}
                      aria-label={`${shop.name}: ${shop.stations.length} stations. ${col.collapsed ? 'Expand' : 'Collapse'}`}
                      className="cursor-pointer outline-none"
                      onClick={() => toggleShop(shop.id)}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter' && e.key !== ' ') return
                        e.preventDefault()
                        toggleShop(shop.id)
                      }}
                    >
                      <HexPrism x={col.x} y={Y0} w={COL_W - 12} h={HEADER_H - 12} color={style.color} active={isolatedShopId === shop.id} />
                      <text x={col.x + 22} y={Y0 + 26} className="fill-[#e6ebf2] font-display" fontSize="16" fontWeight="700" letterSpacing="0.5">
                        {shop.name}
                      </text>
                      <text x={col.x + 22} y={Y0 + 46} className="fill-[#8b98ab] font-mono" fontSize="10.5" letterSpacing="1">
                        {style.code} · {shop.stations.length} STN · {nActs} ACT
                      </text>
                      <text x={col.x + COL_W - 34} y={Y0 + 27} textAnchor="middle" className="fill-[#8b98ab]" fontSize="14">
                        {col.collapsed ? '+' : '−'}
                      </text>
                      {(matchCountByShop.get(shop.id) ?? 0) > 0 && (
                        <g>
                          <rect x={col.x + COL_W - 72} y={Y0 + 37} width={46} height={17} rx={8.5} fill={ACCENT} />
                          <text x={col.x + COL_W - 49} y={Y0 + 49.5} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#04121a">
                            {matchCountByShop.get(shop.id)}
                          </text>
                        </g>
                      )}
                    </g>

                    {col.tiles.map((t) => {
                      const st = t.station
                      const isSel = selectedStationId === st.id
                      const dimTile = hasHighlight && !highlightStation.has(st.id) && !isSel
                      const badge = stationBadges?.get(st.id)
                      const isPdi = st.id === PDI_STATION_ID
                      return (
                        <g key={st.id} opacity={dimTile ? 0.5 : 1} style={{ transition: 'opacity 300ms' }}>
                          <path d={`M${col.x + COL_W / 2 - 92},${t.y + 16} q0,0 10,0`} stroke={style.color} strokeOpacity="0.45" strokeWidth="2" fill="none" />
                          {/* Station slab: raised tile with side face (fixed station shape) */}
                          <g
                            data-node
                            role="button"
                            tabIndex={0}
                            aria-label={`${shop.name} ${st.label}, ${st.activities.length} activities`}
                            className="cursor-pointer outline-none"
                            onClick={() => {
                              onSelectStation?.(st)
                              toggleStation(st.id)
                            }}
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter' && e.key !== ' ') return
                              e.preventDefault()
                              onSelectStation?.(st)
                              toggleStation(st.id)
                            }}
                          >
                            <path
                              d={`M${t.x + 10},${t.y + t.h} l${DEPTH},${DEPTH} h${TILE_W} v${-t.h + DEPTH} l${-DEPTH},${-DEPTH} v${t.h - DEPTH}z`}
                              fill="#070b11"
                              stroke="#1a2534"
                            />
                            <rect
                              x={t.x + 10}
                              y={t.y}
                              width={TILE_W}
                              height={t.h}
                              rx={5}
                              fill="url(#tileTop)"
                              stroke={isSel ? ACCENT : isPdi ? '#e6ebf2' : '#25344a'}
                              strokeWidth={isSel ? 2 : 1}
                              filter="url(#soft)"
                            />
                            <rect x={t.x + 10} y={t.y} width={4} height={t.h} rx={2} fill={style.color} />
                            <text x={t.x + 22} y={t.y + 21} fontSize="12.5" fontWeight="600" className="fill-[#e6ebf2]">
                              {truncate(st.label, 22)}
                            </text>
                            <text x={t.x + TILE_W + 2} y={t.y + 21} textAnchor="end" fontSize="10" className="fill-[#8b98ab] font-mono">
                              {st.activities.length}
                            </text>
                            {badge ? (
                              <g>
                                <rect x={t.x + TILE_W - 50} y={t.y + 9} width={30} height={16} rx={3} fill="#d03b3b" fillOpacity="0.18" stroke="#d03b3b" strokeOpacity="0.6" />
                                <text x={t.x + TILE_W - 35} y={t.y + 20.5} textAnchor="middle" fontSize="10" fontWeight="600" fill="#ff8a8a">
                                  {badge}
                                </text>
                              </g>
                            ) : null}
                          </g>
                          {/* Activities */}
                          {st.activities.map((a) => {
                            const p = t.pips.get(a.id)!
                            const isHit = highlightIds?.has(a.id) || candidateSet.has(a.id)
                            const isActSel = selectedActivityId === a.id
                            const generic = a.kind !== 'operation'
                            const fill = isActSel ? '#ffffff' : isHit ? ACCENT : generic ? 'transparent' : style.color
                            const op = isActSel || isHit ? 1 : hasHighlight ? 0.22 : 0.55
                            return (
                              <g
                                key={a.id}
                                data-node
                                role="button"
                                tabIndex={-1}
                                aria-label={a.text}
                                className="cursor-pointer"
                                onMouseEnter={() => setHover(a)}
                                onMouseLeave={() => setHover((h) => (h?.id === a.id ? null : h))}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onSelectActivity?.(a)
                                }}
                              >
                                {isActSel && <circle className="pulse-ring" cx={p.x} cy={p.y} r={8} fill="none" stroke={ACCENT} strokeWidth="2" />}
                                {t.expanded ? (
                                  <>
                                    <rect x={p.x - 5} y={p.y - 5} width={TILE_W - 22} height={ROW_H - 2} rx={3} fill={isActSel ? 'rgba(76,195,230,0.16)' : isHit ? 'rgba(76,195,230,0.07)' : 'transparent'} />
                                    <rect x={p.x - 1} y={p.y - 1} width={7} height={7} rx={1.5} fill={fill} fillOpacity={op} stroke={generic ? style.color : 'none'} strokeOpacity={op} transform={`rotate(45 ${p.x + 2.5} ${p.y + 2.5})`} />
                                    <text x={p.x + 12} y={p.y + 6.5} fontSize="10.5" fill={isActSel ? '#fff' : isHit ? '#bfefff' : '#a9b5c6'} opacity={hasHighlight && !isHit && !isActSel ? 0.5 : 1}>
                                      {truncate((a.opCode ? a.opCode.replace(/^OP\d+-/, '') + ' ' : '') + a.text, 33)}
                                    </text>
                                  </>
                                ) : (
                                  <rect
                                    x={p.x - PIP / 2}
                                    y={p.y - PIP / 2}
                                    width={PIP}
                                    height={PIP}
                                    rx={2}
                                    fill={fill}
                                    fillOpacity={op}
                                    stroke={generic || isActSel ? (isActSel ? ACCENT : style.color) : 'none'}
                                    strokeOpacity={generic ? op : 1}
                                  />
                                )}
                              </g>
                            )
                          })}
                        </g>
                      )
                    })}
                  </g>
                )
              })}

              {/* Trace paths: PDI (detected at) → candidate activities (potential origins) */}
              {showTrace && pdiTile && (
                <g pointerEvents="none">
                  {candidateIds
                    .filter((id) => id !== selectedActivityId)
                    .slice(0, 12)
                    .map((id) => {
                      const p = findPip(id)
                      return p ? <path key={id} d={tracePath(p)} fill="none" stroke={ACCENT} strokeOpacity="0.16" strokeWidth="1.2" strokeDasharray="3 5" /> : null
                    })}
                  {target && (
                    <>
                      <path d={tracePath(target)} fill="none" stroke={ACCENT} strokeOpacity="0.18" strokeWidth="9" strokeLinecap="round" />
                      <path key={selectedActivityId} className="trace-line" style={{ ['--trace-len' as string]: 3000 }} d={tracePath(target)} fill="none" stroke={ACCENT} strokeWidth="2.4" strokeLinecap="round" />
                    </>
                  )}
                  <g transform={`translate(${pdiTile.x + 10},${pdiTile.y + pdiTile.h + DEPTH + 8})`}>
                    <rect width={TILE_W} height={20} rx={3} fill="#e6ebf2" />
                    <text x={TILE_W / 2} y={14} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#0a0f17" letterSpacing="1">
                      DETECTED AT · PDI
                    </text>
                  </g>
                </g>
              )}
            </g>
          </svg>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">
        <MapBtn label="Zoom in" onClick={() => zoom(1.2)}><Plus /></MapBtn>
        <MapBtn label="Zoom out" onClick={() => zoom(1 / 1.2)}><Minus /></MapBtn>
        <MapBtn label="Rotate scene" onClick={() => setSpin((s) => (s >= 8 ? -8 : s + 4))}><Rotate3d /></MapBtn>
        <MapBtn label={tilt ? 'Flatten view (2D)' : 'Tilt view (3D)'} onClick={() => setTilt((t) => (t ? 0 : 16))}>
          <span className="font-mono text-[10px] font-semibold">{tilt ? '2D' : '3D'}</span>
        </MapBtn>
        <MapBtn label="Collapse all stations" onClick={() => setExpanded(new Set())}><ChevronsDownUp /></MapBtn>
        <MapBtn label="Expand stations with matches" onClick={() => setExpanded(new Set(highlightStation))}><ChevronsUpDown /></MapBtn>
        <MapBtn label="Reset view" onClick={reset}><RotateCcw /></MapBtn>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-10 hidden max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-border bg-background/80 px-3 py-2 text-[11px] text-muted-foreground backdrop-blur sm:flex">
        <span className="flex items-center gap-1.5"><svg width="16" height="12"><path d="M3 1h10l3 5-3 5H3L0 6z" fill="none" stroke="#8b98ab" /></svg>Shop</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-4 rounded-[2px] border border-[#25344a] bg-[#172233] shadow-[2px_2px_0_#070b11]" />Station</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[2px] bg-[#8b98ab]/70" />Operation</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[2px] border border-[#8b98ab]" />Check / transfer</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[2px] bg-primary" />Match</span>
        {shops.map((s) => (
          <span key={s.id} className="flex items-center gap-1"><span className="h-2.5 w-1 rounded-full" style={{ background: shopStyle(s.id).color }} />{shopStyle(s.id).code}</span>
        ))}
      </div>

      {hover && (
        <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-sm rounded-md border border-border bg-popover/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
          <div className="eyebrow mb-1">{hover.opCode ?? hover.sourceRef} · {hover.kind}</div>
          <div className="text-foreground">{hover.text}</div>
        </div>
      )}
    </div>
  )
}

function MapBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="icon-sm" aria-label={label} onClick={onClick} className="bg-background/80 backdrop-blur">
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  )
}

function HexPrism({ x, y, w, h, color, active }: { x: number; y: number; w: number; h: number; color: string; active?: boolean }) {
  const c = 14
  const top = `M${x + c},${y} H${x + w - c} L${x + w},${y + h / 2} L${x + w - c},${y + h} H${x + c} L${x},${y + h / 2}Z`
  const side = `M${x},${y + h / 2} L${x + c},${y + h} H${x + w - c} L${x + w},${y + h / 2} v8 L${x + w - c},${y + h + 8} H${x + c} L${x},${y + h / 2 + 8}Z`
  return (
    <g filter="url(#soft)">
      <path d={side} fill={color} fillOpacity="0.22" />
      <path d={top} fill="#121c2a" stroke={color} strokeOpacity={active ? 1 : 0.7} strokeWidth={active ? 2.2 : 1.4} />
      <path d={`M${x + c},${y + 1.5} H${x + w - c}`} stroke="#fff" strokeOpacity="0.06" />
    </g>
  )
}

function toggle(set: Set<string>, id: string) {
  const n = new Set(set)
  if (n.has(id)) n.delete(id)
  else n.add(id)
  return n
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
