import * as React from 'react'
import { previewRecords } from '@/data/preview-records'
import type { DefectRecord } from '@/lib/defects'

/**
 * Which defect-record source the workspace reads.
 *  - preview:  illustrative records (clearly labelled) for evaluating the screens.
 *  - verified: the verified PDI record store. Not connected until Milestone 2, so it is empty.
 */
export type DataMode = 'preview' | 'verified'

interface Ctx {
  mode: DataMode
  setMode: (m: DataMode) => void
  records: DefectRecord[]
  verifiedConnected: boolean
}

const DataModeContext = React.createContext<Ctx | null>(null)
const KEY = 'tmbsl.dataMode'

export function DataModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = React.useState<DataMode>('preview')
  React.useEffect(() => {
    const v = localStorage.getItem(KEY)
    if (v === 'preview' || v === 'verified') setModeState(v)
  }, [])
  const setMode = React.useCallback((m: DataMode) => {
    setModeState(m)
    localStorage.setItem(KEY, m)
  }, [])
  const value = React.useMemo<Ctx>(
    () => ({ mode, setMode, records: mode === 'preview' ? previewRecords : [], verifiedConnected: false }),
    [mode, setMode],
  )
  return <DataModeContext.Provider value={value}>{children}</DataModeContext.Provider>
}

export function useDataMode() {
  const ctx = React.useContext(DataModeContext)
  if (!ctx) throw new Error('useDataMode must be used inside DataModeProvider')
  return ctx
}
