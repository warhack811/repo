import { lazy, Suspense, useState } from 'react'
import './App.css'

const SpikeLab = lazy(() => import('./features/spike-lab/SpikeLab'))

function App() {
  const [showLab, setShowLab] = useState(false)

  if (!showLab) {
    return (
      <main className="app-shell">
        <section className="hero-lockup">
          <div>
            <p className="eyebrow">Runa production stack spike</p>
            <h1>AI UI stack integration lab</h1>
            <p>
              Production shell hafif açılır; ağır markdown, Mermaid, Shiki ve fixture lab yüzeyi
              kullanıcı aksiyonuyla yüklenir.
            </p>
          </div>
          <button className="load-lab" onClick={() => setShowLab(true)} type="button">
            Lab yüzeyini aç
          </button>
        </section>
      </main>
    )
  }

  return (
    <Suspense fallback={<main className="app-loading">Loading Runa spike...</main>}>
      <SpikeLab />
    </Suspense>
  )
}

export default App
