import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { formatEUR } from '../../lib/format'
import { syncSavingsMove } from '../../lib/bridge'
import {
  GOAL_COLORS,
  createGoal,
  loadSavings,
  saveSavings,
  todayISO,
  type SavingsState,
} from './types'
import '../debts/DebtsTool.css'

type Props = { onBack: () => void }

export function SavingsTool({ onBack }: Props) {
  const [state, setState] = useState<SavingsState>(() => loadSavings())
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [current, setCurrent] = useState('0')
  const [deadline, setDeadline] = useState('')
  const [note, setNote] = useState('')
  const [color, setColor] = useState(GOAL_COLORS[0])
  const [moves, setMoves] = useState<Record<string, string>>({})

  useEffect(() => {
    saveSavings(state)
  }, [state])

  const totals = useMemo(() => {
    const targetSum = state.goals.reduce((s, g) => s + g.target, 0)
    const currentSum = state.goals.reduce((s, g) => s + g.current, 0)
    return { targetSum, currentSum }
  }, [state.goals])

  function addGoal(e: FormEvent) {
    e.preventDefault()
    const t = Number(target.replace(',', '.'))
    const c = Number(current.replace(',', '.')) || 0
    const n = name.trim()
    if (!n || !t || t <= 0) return
    const goal = createGoal({
      name: n,
      target: t,
      current: Math.max(0, c),
      deadline,
      color,
      note: note.trim(),
    })
    setState((s) => ({ goals: [goal, ...s.goals] }))
    setName('')
    setTarget('')
    setCurrent('0')
    setDeadline('')
    setNote('')
  }

  function adjust(id: string, sign: 1 | -1) {
    const raw = moves[id] ?? ''
    const value = Number(raw.replace(',', '.'))
    if (!value || value <= 0) return
    const goal = state.goals.find((g) => g.id === id)
    if (!goal) return

    const nextCurrent = Math.max(
      0,
      Math.min(goal.target * 2, goal.current + sign * value),
    )
    const applied = Math.abs(nextCurrent - goal.current)
    if (applied <= 0) return

    setState((s) => ({
      goals: s.goals.map((g) =>
        g.id === id ? { ...g, current: nextCurrent } : g,
      ),
    }))
    setMoves((m) => ({ ...m, [id]: '' }))

    syncSavingsMove({
      goalId: goal.id,
      goalName: goal.name,
      amount: applied,
      sign,
    })
  }

  function removeGoal(id: string) {
    setState((s) => ({ goals: s.goals.filter((g) => g.id !== id) }))
  }

  return (
    <div className="savings">
      <header className="tool-top">
        <button type="button" className="ghost" onClick={onBack}>
          ← Outils
        </button>
        <div>
          <p className="eyebrow">Outil</p>
          <h1>Objectifs d’épargne</h1>
        </div>
      </header>
      <p className="hint link-hint">
        Si la liaison est active (réglages sur l’accueil), Ajouter / Retirer crée
        un virement Budget entre vos comptes.
      </p>

      <div className="stats-row">
        <article className="stat income">
          <span>Épargné</span>
          <strong>{formatEUR(totals.currentSum)}</strong>
        </article>
        <article className="stat soft-stat">
          <span>Objectifs</span>
          <strong>{formatEUR(totals.targetSum)}</strong>
        </article>
        <article className="stat balance">
          <span>Reste</span>
          <strong>
            {formatEUR(Math.max(0, totals.targetSum - totals.currentSum))}
          </strong>
        </article>
      </div>

      <section className="panel">
        <form className="composer" onSubmit={addGoal}>
          <h2>Nouvel objectif</h2>
          <label>
            Nom
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Voyage Japon"
              required
            />
          </label>
          <label>
            Objectif (€)
            <input
              inputMode="decimal"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              required
            />
          </label>
          <label>
            Déjà mis de côté (€)
            <input
              inputMode="decimal"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </label>
          <label>
            Échéance (optionnel)
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              min={todayISO()}
            />
          </label>
          <label>
            Note
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Pourquoi cet objectif"
            />
          </label>
          <div className="colors" role="listbox" aria-label="Couleur">
            {GOAL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={color === c ? 'swatch on' : 'swatch'}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <button type="submit" className="primary">
            Créer
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Vos objectifs</h2>
        {state.goals.length === 0 ? (
          <p className="muted">Aucun objectif pour l’instant.</p>
        ) : (
          <ul className="goal-list">
            {state.goals.map((g) => {
              const pct = Math.min(100, (g.current / g.target) * 100)
              const done = g.current >= g.target
              return (
                <li key={g.id}>
                  <div className="goal-head">
                    <i className="dot" style={{ background: g.color }} />
                    <strong>
                      {g.name}
                      {done && <em className="badge done">atteint</em>}
                    </strong>
                    <button
                      type="button"
                      className="ghost icon"
                      aria-label="Supprimer"
                      onClick={() => removeGoal(g.id)}
                    >
                      ×
                    </button>
                  </div>
                  <p className="muted">
                    {formatEUR(g.current)} / {formatEUR(g.target)} ·{' '}
                    {pct.toFixed(0)}%
                    {g.deadline ? ` · avant ${g.deadline}` : ''}
                    {g.note ? ` · ${g.note}` : ''}
                  </p>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${pct}%`, background: g.color }}
                    />
                  </div>
                  <div className="goal-actions">
                    <input
                      inputMode="decimal"
                      placeholder="Montant"
                      value={moves[g.id] ?? ''}
                      onChange={(e) =>
                        setMoves((m) => ({ ...m, [g.id]: e.target.value }))
                      }
                    />
                    <button
                      type="button"
                      className="primary sm"
                      onClick={() => adjust(g.id, 1)}
                    >
                      Ajouter
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => adjust(g.id, -1)}
                    >
                      Retirer
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <p className="local-note">Données locales uniquement (cet appareil).</p>
    </div>
  )
}
