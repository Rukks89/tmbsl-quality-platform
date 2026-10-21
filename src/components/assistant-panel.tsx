import * as React from 'react'
import { Bot, CornerDownLeft, Database, FileSpreadsheet, Lightbulb, SearchX, Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'
import { answer, type Answer, type AssistantContext, type Ref } from '@/lib/assistant'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Msg {
  role: 'user' | 'assistant'
  text: string
  answer?: Answer
}

const GROUNDING = {
  workbook: { icon: FileSpreadsheet, label: 'Grounded in workbook' },
  records: { icon: Database, label: 'Grounded in defect records' },
  recommendation: { icon: Lightbulb, label: 'Recommendation — verify before acting' },
  'not-found': { icon: SearchX, label: 'Not in the data' },
} as const

export function AssistantPanel({
  context,
  suggestions,
  onRef,
  title = 'Quality assistant',
  className,
}: {
  context: AssistantContext
  suggestions: string[]
  onRef: (ref: Ref) => void
  title?: string
  className?: string
}) {
  const [msgs, setMsgs] = React.useState<Msg[]>([])
  const [q, setQ] = React.useState('')
  const [thinking, setThinking] = React.useState(false)
  const endRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [msgs, thinking])

  const ask = (question: string) => {
    const text = question.trim()
    if (!text) return
    setMsgs((m) => [...m, { role: 'user', text }])
    setQ('')
    setThinking(true)
    // Retrieval is synchronous; the short delay keeps the exchange readable.
    window.setTimeout(() => {
      const a = answer(text, context)
      setMsgs((m) => [...m, { role: 'assistant', text: a.text.join('\n'), answer: a }])
      setThinking(false)
    }, 260)
  }

  const contextChips = [
    context.page === 'plant' ? 'Plant Overview' : context.page === 'trace' ? 'PDI Traceability' : 'Defects Record',
    context.defectQuery ? `Defect: ${context.defectQuery}` : null,
    context.busNumber ? `Bus: ${context.busNumber}` : null,
    context.recordsLabel,
  ].filter(Boolean) as string[]

  return (
    <section className={cn('panel flex min-h-0 flex-col', className)} aria-label={title}>
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="grid size-7 place-items-center rounded-md bg-primary/15 text-primary">
          <Bot className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="truncate text-[11px] text-muted-foreground">Answers cite workbook rows and records · never invents data</p>
        </div>
      </header>
      <div className="flex flex-wrap gap-1 border-b border-border px-4 py-2">
        {contextChips.map((c) => (
          <span key={c} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{c}</span>
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
        {msgs.length === 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Sparkles className="size-3.5 text-primary" /> Try asking</p>
            {suggestions.map((s) => (
              <button key={s} onClick={() => ask(s)} className="block w-full rounded-md border border-border bg-background/40 px-3 py-2 text-left text-xs transition-colors hover:border-primary/50 hover:bg-accent">
                {s}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="ml-8 rounded-lg rounded-br-sm bg-primary/15 px-3 py-2 text-[13px]">{m.text}</div>
          ) : (
            <div key={i} className="mr-2 space-y-2">
              {m.answer && <GroundingTag g={m.answer.grounding} />}
              <div className="space-y-1 text-[13px] leading-relaxed">
                {m.answer?.text.map((t, k) => <p key={k} className={t.startsWith('•') || /^\d+\./.test(t) ? 'pl-2 text-muted-foreground' : ''}>{t}</p>)}
              </div>
              {m.answer && m.answer.refs.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {m.answer.refs.map((r) => (
                    <button key={r.type + r.id} onClick={() => onRef(r)} className="max-w-full truncate rounded border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-left text-[11px] text-primary hover:bg-primary/15">
                      <span className="mr-1 font-mono text-[9px] uppercase opacity-70">{r.type}</span>{r.label}
                    </button>
                  ))}
                </div>
              )}
              {m.answer && m.answer.followUps.length > 0 && i === msgs.length - 1 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {m.answer.followUps.map((f) => (
                    <button key={f} onClick={() => ask(f)} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground">{f}</button>
                  ))}
                </div>
              )}
            </div>
          ),
        )}
        {thinking && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />Searching the master data…
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form
        className="flex gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault()
          ask(q)
        }}
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about shops, stations, activities…" aria-label="Ask the quality assistant" className="h-9 text-sm" />
        <Button type="submit" size="icon" aria-label="Send question" disabled={!q.trim()}>
          <CornerDownLeft />
        </Button>
      </form>
    </section>
  )
}

function GroundingTag({ g }: { g: Answer['grounding'] }) {
  const { icon: Icon, label } = GROUNDING[g]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px]', g === 'recommendation' ? 'bg-status-warning/10 text-status-warning' : g === 'not-found' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary')}>
      <Icon className="size-3" /> {label}
    </span>
  )
}
