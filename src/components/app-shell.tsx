import * as React from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Boxes, Database, FlaskConical, Menu, Route as RouteIcon, Search, ShieldCheck, Table2, UserRound } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useDataMode } from '@/lib/data-mode'
import { master } from '@/lib/master'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="bm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7fdcf4" />
          <stop offset="1" stopColor="#2a8fb8" />
        </linearGradient>
      </defs>
      <path d="M20 2 36 11v18L20 38 4 29V11Z" fill="none" stroke="url(#bm)" strokeWidth="2" />
      <path d="M20 2v18m0 0 16-9M20 20 4 11" stroke="#4cc3e6" strokeOpacity=".35" strokeWidth="1.2" />
      <path d="M11 24h18M11 28h12" stroke="url(#bm)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

export const NAV = [
  { to: '/plant', label: 'Plant Overview', icon: Boxes, hint: 'Process digital twin' },
  { to: '/trace', label: 'PDI Traceability', icon: RouteIcon, hint: 'Defect-to-origin' },
  { to: '/defects', label: 'Defects Record', icon: Table2, hint: 'Quality analytics' },
] as const

export function DataSourceSwitch({ compact = false }: { compact?: boolean }) {
  const { mode, setMode } = useDataMode()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
            mode === 'preview'
              ? 'border-status-warning/40 bg-status-warning/10 text-status-warning hover:bg-status-warning/15'
              : 'border-border bg-secondary text-secondary-foreground hover:bg-accent',
          )}
        >
          {mode === 'preview' ? <FlaskConical className="size-3.5" /> : <Database className="size-3.5" />}
          {compact ? (mode === 'preview' ? 'Preview data' : 'Verified') : mode === 'preview' ? 'Preview dataset · illustrative' : 'Verified records · 0 connected'}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Defect-record source</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => setMode('preview')} className="flex-col items-start gap-0.5">
          <span className="font-medium">Preview dataset</span>
          <span className="text-xs text-muted-foreground">37 illustrative PDI records linked to real workbook activities. Not verified TMBSL data.</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setMode('verified')} className="flex-col items-start gap-0.5">
          <span className="font-medium">Verified PDI records</span>
          <span className="text-xs text-muted-foreground">Record store connects in the next milestone. Analytics show “awaiting data” until then.</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          Master data: {master.source.file} · {master.totals.activities} activities (always live)
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function GlobalSearch({ className }: { className?: string }) {
  const navigate = useNavigate()
  const [q, setQ] = React.useState('')
  return (
    <form
      role="search"
      className={cn('relative', className)}
      onSubmit={(e) => {
        e.preventDefault()
        if (q.trim()) navigate({ to: '/plant', search: { q: q.trim() } })
      }}
    >
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search shops, stations, OP codes, activities…"
        aria-label="Search the manufacturing master data"
        className="h-9 bg-background/60 pl-8 text-sm"
      />
    </form>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname })
  const { mode } = useDataMode()
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[110rem] items-center gap-3 px-3 sm:px-5">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open navigation">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <SheetHeader>
                <SheetTitle>TMBSL Quality Intelligence</SheetTitle>
                <SheetDescription>Workspaces</SheetDescription>
              </SheetHeader>
              <nav className="grid gap-1 px-4">
                {NAV.map((n) => (
                  <Link key={n.to} to={n.to} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-accent" activeProps={{ className: 'bg-accent text-primary' }}>
                    <n.icon className="size-4" /> {n.label}
                  </Link>
                ))}
              </nav>
              <div className="px-4 pt-4"><DataSourceSwitch /></div>
            </SheetContent>
          </Sheet>
          <Link to="/workspace" className="flex items-center gap-2.5">
            <BrandMark className="size-7" />
            <span className="leading-none">
              <span className="block font-display text-[15px] font-bold tracking-[0.2em]">TMBSL</span>
              <span className="hidden font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground sm:block">Quality Intelligence</span>
            </span>
          </Link>
          <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Workspaces">
            {NAV.map((n) => {
              const active = path.startsWith(n.to)
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    'relative flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground',
                    active && 'text-foreground',
                  )}
                >
                  <n.icon className={cn('size-4', active && 'text-primary')} />
                  {n.label}
                  {active && <span className="absolute inset-x-3 -bottom-[11px] h-0.5 rounded-full bg-primary" />}
                </Link>
              )
            })}
          </nav>
          <GlobalSearch className="ml-auto hidden w-72 md:block xl:w-96" />
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <span className="hidden sm:block"><DataSourceSwitch compact /></span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label="Account">
                  <UserRound />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" /> Preview workspace access
                </DropdownMenuLabel>
                <div className="px-2 pb-2 text-xs text-muted-foreground">
                  Named accounts, roles and sessions arrive with secure sign-in in the next milestone.
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/">Leave workspace</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {mode === 'preview' && (
          <div className="border-t border-status-warning/20 bg-status-warning/[0.06] px-4 py-1 text-center font-mono text-[10.5px] tracking-wide text-status-warning/90">
            PREVIEW DATASET — defect counts, dates and statuses are illustrative, not verified PDI records. Shops, stations and activities are live from the workbook.
          </div>
        )}
      </header>
      <main>{children}</main>
    </div>
  )
}
