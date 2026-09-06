import { useState } from 'react'
import { BudgetTool } from './tools/budget/BudgetTool'
import { TOOLS, type ToolId } from './tools/registry'

function App() {
  const [active, setActive] = useState<ToolId | null>(null)

  if (active === 'budget') {
    return (
      <div className="app-shell">
        <BudgetTool onBack={() => setActive(null)} />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">
            <span className="logo" aria-hidden>
              M
            </span>
            <span className="privacy-chip">100% local</span>
          </div>
          <h1>Multi Outils</h1>
          <p>
            Une boîte à outils du quotidien. Chaque outil garde vos données sur
            cet appareil — rien n’est envoyé sur un serveur.
          </p>
        </div>
      </header>

      <p className="hub-intro">Choisissez un outil pour commencer.</p>

      <ul className="tool-grid">
        {TOOLS.map((tool) => {
          const ready = tool.status === 'ready'
          return (
            <li key={tool.id}>
              <button
                type="button"
                className="tool-card"
                style={{ ['--accent' as string]: tool.accent }}
                disabled={!ready}
                onClick={() => ready && setActive(tool.id)}
              >
                <span className="accent-bar" aria-hidden />
                <h2>{tool.name}</h2>
                <p>{tool.tagline}</p>
                <span className={ready ? 'status' : 'status soon'}>
                  {ready ? 'Disponible' : 'Bientôt'}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default App
