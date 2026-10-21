import * as React from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, Eye, EyeOff, Info, KeyRound, Loader2, Lock, UserRound } from 'lucide-react'

import { BrandMark } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { master } from '@/lib/master'

export const Route = createFileRoute('/')({
  component: SignIn,
})

function SignIn() {
  const [show, setShow] = React.useState(false)
  const [user, setUser] = React.useState('')
  const [pass, setPass] = React.useState('')
  const [errors, setErrors] = React.useState<{ user?: string; pass?: string }>({})
  const [state, setState] = React.useState<'idle' | 'loading' | 'pending'>('idle')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!user.trim()) errs.user = 'Enter your username or work email.'
    if (!pass) errs.pass = 'Enter your password.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setState('loading')
    window.setTimeout(() => setState('pending'), 600)
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <img
        src="/.netlify/images?url=/img/plant-hero.png&w=1600&fm=webp&q=70"
        srcSet="/.netlify/images?url=/img/plant-hero.png&w=900&fm=webp&q=65 900w, /.netlify/images?url=/img/plant-hero.png&w=1600&fm=webp&q=70 1600w"
        sizes="100vw"
        alt=""
        className="drift absolute inset-0 h-full w-full scale-105 object-cover object-[70%_center] opacity-60 [animation:drift_30s_ease-in-out_infinite]"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/20" />
      <div className="grid-backdrop absolute inset-0 opacity-40" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[88rem] flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center gap-3">
          <BrandMark className="size-9" />
          <div className="leading-none">
            <div className="font-display text-lg font-bold tracking-[0.24em]">TMBSL</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Bus Manufacturing</div>
          </div>
        </div>

        <div className="grid flex-1 items-center gap-12 py-10 lg:grid-cols-[1fr_26rem]">
          <div className="max-w-xl">
            <p className="eyebrow mb-4 text-primary">PDI defect-to-origin traceability</p>
            <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
              TMBSL Manufacturing
              <br />
              Quality Intelligence
            </h1>
            <p className="mt-5 max-w-md text-base text-muted-foreground">
              Connect every defect found at Pre-Delivery Inspection to the shop, station and operation where it may have originated — then verify it with evidence.
            </p>
            <dl className="mt-8 grid max-w-md grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border">
              {[
                ['Shops', master.totals.shops],
                ['Stations', master.totals.stations],
                ['Activities', master.totals.activities],
              ].map(([k, v]) => (
                <div key={k} className="bg-card/80 px-4 py-3 backdrop-blur">
                  <dt className="eyebrow">{k}</dt>
                  <dd className="mt-1 font-display text-2xl font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 font-mono text-[10.5px] text-muted-foreground">Loaded from {master.source.file}</p>
          </div>

          <div className="panel p-6 sm:p-7">
            <h2 className="font-display text-xl font-semibold">Sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">Use your TMBSL quality account.</p>
            <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="user">Username</Label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="user" autoComplete="username" value={user} onChange={(e) => setUser(e.target.value)} className="pl-8" aria-invalid={!!errors.user} aria-describedby={errors.user ? 'user-err' : undefined} />
                </div>
                {errors.user && <p id="user-err" className="text-xs text-[#ff8a8a]">{errors.user}</p>}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pass">Password</Label>
                  <ForgotPassword />
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="pass" type={show ? 'text' : 'password'} autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} className="px-8" aria-invalid={!!errors.pass} aria-describedby={errors.pass ? 'pass-err' : undefined} />
                  <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={show ? 'Hide password' : 'Show password'}>
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {errors.pass && <p id="pass-err" className="text-xs text-[#ff8a8a]">{errors.pass}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={state === 'loading'}>
                {state === 'loading' ? <Loader2 className="animate-spin" /> : null}
                Sign In
              </Button>
              {state === 'pending' && (
                <Alert>
                  <Info />
                  <AlertDescription>
                    Account sign-in is being connected to the secure identity service and is not active yet. No credentials were sent or stored. Use the preview workspace below in the meantime.
                  </AlertDescription>
                </Alert>
              )}
            </form>
            <div className="my-5 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link to="/workspace">
                Enter preview workspace <ArrowRight />
              </Link>
            </Button>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">Preview access is read-only and shows illustrative defect records.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ForgotPassword() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="text-xs text-primary hover:underline">Forgot password?</button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="size-4 text-primary" /> Account recovery</DialogTitle>
          <DialogDescription>How password recovery works for TMBSL quality accounts.</DialogDescription>
        </DialogHeader>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Enter your work email on the recovery form. A single-use reset link is emailed to you.</li>
          <li>The link opens a page where you choose a new password. Old sessions are signed out.</li>
          <li>If you no longer have access to your work email, your plant quality administrator can re-issue an invitation.</li>
        </ol>
        <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          Email recovery activates together with account sign-in. Until then, contact your plant quality administrator.
        </p>
      </DialogContent>
    </Dialog>
  )
}
