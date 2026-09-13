import { useEffect, useState } from 'react'
import { useStore } from './store/useStore'
import { Header, Toasts } from './components/Header'
import { Board, BatchDrawer } from './components/Board'
import { Resources } from './components/Resources'
import { BookingView } from './components/Booking'
import { MeasureView } from './components/Measure'
import { BlindView } from './components/Blind'
import { MergeView } from './components/Merge'
import { AuditView } from './components/Audit'

export default function App() {
  const [tab, setTab] = useState('board')
  const [drawerId, setDrawerId] = useState<string | null>(null)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  return (
    <div className="min-h-screen text-ink-100">
      <Header tab={tab} onTab={setTab} />
      <main className="mx-auto max-w-[1500px] px-5 py-5">
        {tab === 'board' && <Board openBatch={setDrawerId} />}
        {tab === 'resources' && <Resources />}
        {tab === 'booking' && <BookingView />}
        {tab === 'measure' && <MeasureView />}
        {tab === 'blind' && <BlindView />}
        {tab === 'merge' && <MergeView />}
        {tab === 'audit' && <AuditView />}
      </main>
      <BatchDrawer batchId={drawerId} onClose={() => setDrawerId(null)} />
      <Toasts />
    </div>
  )
}
