import { lazy, Suspense } from 'react'
import './App.css'

const SpikeLab = lazy(() => import('./features/spike-lab/SpikeLab'))

function App() {
  return (
    <Suspense fallback={<main className="app-loading">Loading Runa spike...</main>}>
      <SpikeLab />
    </Suspense>
  )
}

export default App
