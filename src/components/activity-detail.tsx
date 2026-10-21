import { Link } from '@tanstack/react-router'
import { FileSpreadsheet, Link2, X } from 'lucide-react'

import { activityById, master, shopById, shopStyle, stationById, type Activity } from '@/lib/master'
import type { DefectRecord } from '@/lib/defects'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export function ShopChip({ shopId, label }: { shopId: string; label?: string }) {
  const s = shopById.get(shopId)
  const st = shopStyle(shopId)
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <svg width="12" height="10" aria-hidden="true">
        <path d="M2.5 .5h7l2 4.5-2 4.5h-7L.5 5z" fill={st.color} fillOpacity=".25" stroke={st.color} />
      </svg>
      {label ?? s?.name}
    </span>
  )
}

export function ActivityDetail({
  activity,
  onClose,
  onSelect,
  linkedRecords,
  extra,
}: {
  activity: Activity
  onClose?: () => void
  onSelect?: (a: Activity) => void
  linkedRecords?: DefectRecord[] | null
  extra?: React.ReactNode
}) {
  const st = stationById.get(activity.stationId)!
  const shop = shopById.get(activity.shopId)!
  const siblings = st.activities.filter((a) => a.id !== activity.id && a.kind === 'operation')
  const group = activity.opGroup ? siblings.filter((a) => a.opGroup === activity.opGroup) : []
  const related = group.length ? group : siblings.slice(0, 6)
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0">
          <div className="eyebrow mb-1.5 flex flex-wrap items-center gap-2">
            <ShopChip shopId={shop.id} /> <span>›</span> <span>{st.label}</span>
          </div>
          <h3 className="text-[15px] font-semibold leading-snug">{activity.text}</h3>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close activity details">
            <X />
          </Button>
        )}
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
        {extra}
        <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-2 text-[13px]">
          <dt className="text-muted-foreground">Shop</dt>
          <dd>{shop.name} <span className="text-muted-foreground">(source: “{shop.sourceName}”)</span></dd>
          <dt className="text-muted-foreground">Station</dt>
          <dd>{st.label} <span className="text-muted-foreground">(source: “{st.sourceLabel}”)</span></dd>
          <dt className="text-muted-foreground">Operation code</dt>
          <dd className="font-mono">{activity.opCode ?? <span className="font-sans text-muted-foreground">Not given in workbook</span>}</dd>
          {activity.parentHeading && (
            <>
              <dt className="text-muted-foreground">Parent item</dt>
              <dd>{activity.parentHeading}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Type</dt>
          <dd className="capitalize">{activity.kind === 'operation' ? 'Manufacturing operation' : activity.kind === 'checklist' ? 'Check-list confirmation' : 'Vehicle transfer'}</dd>
          <dt className="text-muted-foreground">Process</dt>
          <dd className="text-muted-foreground">No verified process mapping yet</dd>
          <dt className="text-muted-foreground">Source</dt>
          <dd className="flex items-center gap-1.5">
            <FileSpreadsheet className="size-3.5 text-muted-foreground" />
            <span className="font-mono text-xs">{master.source.file} · {activity.sourceRef} · line {activity.sourceLine}</span>
          </dd>
        </dl>
        <div>
          <div className="eyebrow mb-1.5">Original workbook text</div>
          <p className="rounded-md border border-border bg-muted/40 p-2.5 font-mono text-xs leading-relaxed text-muted-foreground">{activity.source}</p>
          {activity.repaired && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Display text repairs a spreadsheet find-and-replace artefact (“ST” → “STATION” inside words). The original is kept unchanged above.
            </p>
          )}
        </div>
        <div>
          <div className="eyebrow mb-1.5">Linked defect records</div>
          {linkedRecords == null ? (
            <p className="text-xs text-muted-foreground">No verified PDI records connected.</p>
          ) : linkedRecords.length === 0 ? (
            <p className="text-xs text-muted-foreground">No records in the active dataset reference this activity.</p>
          ) : (
            <ul className="space-y-1.5">
              {linkedRecords.slice(0, 6).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs">
                  <span className="min-w-0 truncate">
                    <span className="font-mono text-muted-foreground">{r.busNumber}</span> · {r.description}
                  </span>
                  <Badge variant={r.confirmedActivityId === activity.id ? 'default' : 'secondary'} className="shrink-0 text-[10px]">
                    {r.confirmedActivityId === activity.id ? 'Confirmed' : 'Candidate'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
        {related.length > 0 && (
          <div>
            <div className="eyebrow mb-1.5">{group.length ? `Same operation group (${activity.opGroup})` : 'Other operations at this station'}</div>
            <ul className="space-y-1">
              {related.map((a) => (
                <li key={a.id}>
                  <button className="flex w-full items-start gap-2 rounded px-1.5 py-1 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => onSelect?.(a)}>
                    <Link2 className="mt-0.5 size-3 shrink-0" />
                    <span>{a.opCode ? <span className="font-mono">{a.opCode} </span> : null}{a.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Link
          to="/trace"
          search={{ q: activity.text.split(/[,(]/)[0].slice(0, 60) }}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          Trace defects against this activity →
        </Link>
      </div>
    </div>
  )
}

export function activityLabel(id: string) {
  const a = activityById.get(id)
  return a ? a.text : id
}
