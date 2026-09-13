import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { useStore } from './store/useStore'
import { seedState } from './store/seed'
import { mergeStates } from './lib/merge'
import { parseImport, exportJson } from './lib/importExport'
import { dispatch, newId } from './lib/engine'

// 演示 / 端到端自检钩子
;(globalThis as Record<string, unknown>).__kacl = {
  useStore,
  seedState,
  mergeStates,
  parseImport,
  exportJson,
  dispatch,
  newId,
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
