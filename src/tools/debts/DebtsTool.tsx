import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { formatEUR, todayISO } from '../../lib/format'
import {
  createDebt,
  loadDebts,
  saveDebts,
  type DebtDirection,
  type DebtsState,
} from './types'
import './DebtsTool.css'

type Props = { onBack: () => void }

export function DebtsTool({ onBack }: Props) {
  const [state, setState] = useState<DebtsState>(() => loadDebts())
  const [person, setPerson] = useState('')
  const [direction, setDirection] = useState<DebtDirection>('owed_to_me')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [dueDate, setDueDate] = useState(todayISO())
  const [payAmounts, setPayAmounts] = useState<Record<string, string>>({})

  useEffect(() => {
    saveDebts(state)
  }, [state])

  const open = useMemo(
    () => state.debts.filter((d) => !d.settled),
    [state.debts],
  )
  const closed = useMemo(
    () => state.debts.filter((d) => d.settled),
    [state.debts],
  )

  const toReceive = open
    .filter((d) => d.direction === 'owed_to_me')
    .reduce((s, d) => s + (d.amount - d.paid), 0)
  const toPay = open
    .filter((d) => d.direction === 'i_owe')
    .reduce((s, d) => s + (d.amount - d.paid), 0)

  function addDebt(e: FormEvent) {
    e.preventDefault()
    const value = Number(amount.replace(',', '.'))
    const name = person.trim()
    if (!name || !value || value <= 0) return
    const next = createDebt({
      person: name,
      direction,
      amount: value,
      note: note.trim(),
      dueDate,
    })
    setState((s) => ({ debts: [next, ...s.debts] }))
    setPerson('')
    setAmount('')
    setNote('')
    setDueDate(todayISO())
  }

  function addPayment(id: string) {
    const raw = payAmounts[id] ?? ''
    const value = Number(raw.replace(',', '.'))
    if (!value || value <= 0) return
    setState((s) => ({
      debts: s.debts.map((d) => {
        if (d.id !== id) return d
        const paid = Math.min(d.amount, d.paid + value)
        return { ...d, paid, settled: paid >= d.amount }
      }),
    }))
    setPayAmounts((m) => ({ ...m, [id]: '' }))
  }

  function settle(id: string) {
    setState((s) => ({
      debts: s.debts.map((d) =>
        d.id === id ? { ...d, paid: d.amount, settled: true } : d,
      ),
    }))
  }

  function removeDebt(id: string) {
    setState((s) => ({ debts: s.debts.filter((d) => d.id !== id) }))
  }

  return (
    <div className="debts">
      <header className="tool-top">
        <button type="button" className="ghost" onClick={onBack}>
          ← Outils
        </button>
        <div>
          <p className="eyebrow">Outil</p>
          <h1>Dettes</h1>
        </div>
      </header>

      <div className="stats-row">
        <article className="stat income">
          <span>On vous doit</span>
          <strong>{formatEUR(toReceive)}</strong>
        </article>
        <article className="stat expense">
          <span>Vous devez</span>
          <strong>{formatEUR(toPay)}</strong>
        </article>
        <article className={`stat balance ${toReceive - toPay >= 0 ? 'pos' : 'neg'}`}>
          <span>Net</span>
          <strong>{formatEUR(toReceive - toPay)}</strong>
        </article>
      </div>

      <section className="panel">
        <form className="composer" onSubmit={addDebt}>
          <h2>Nouvelle dette</h2>
          <div className="seg">
            <button
              type="button"
              className={direction === 'owed_to_me' ? 'on' : ''}
              onClick={() => setDirection('owed_to_me')}
            >
              On me doit
            </button>
            <button
              type="button"
              className={direction === 'i_owe' ? 'on' : ''}
              onClick={() => setDirection('i_owe')}
            >
              Je dois
            </button>
          </div>
          <label>
            Personne
            <input
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              placeholder="Prénom"
              required
            />
          </label>
          <label>
            Montant (€)
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>
          <label>
            Échéance
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
          <label>
            Note
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contexte"
            />
          </label>
          <button type="submit" className="primary">
            Ajouter
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>En cours</h2>
        {open.length === 0 ? (
          <p className="muted">Aucune dette ouverte.</p>
        ) : (
          <ul className="debt-list">
            {open.map((d) => {
              const remaining = d.amount - d.paid
              const pct = Math.min(100, (d.paid / d.amount) * 100)
              return (
                <li key={d.id}>
                  <div className="debt-head">
                    <strong>{d.person}</strong>
                    <span className="tag">
                      {d.direction === 'owed_to_me' ? 'À recevoir' : 'À payer'}
                    </span>
                  </div>
                  <p className="muted">
                    Reste {formatEUR(remaining)} / {formatEUR(d.amount)}
                    {d.dueDate ? ` · échéance ${d.dueDate}` : ''}
                    {d.note ? ` · ${d.note}` : ''}
                  </p>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${pct}%`,
                        background:
                          d.direction === 'owed_to_me' ? 'var(--teal)' : 'var(--coral)',
                      }}
                    />
                  </div>
                  <div className="debt-actions">
                    <input
                      inputMode="decimal"
                      placeholder="Remboursement"
                      value={payAmounts[d.id] ?? ''}
                      onChange={(e) =>
                        setPayAmounts((m) => ({ ...m, [d.id]: e.target.value }))
                      }
                    />
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => addPayment(d.id)}
                    >
                      Noter
                    </button>
                    <button
                      type="button"
                      className="primary sm"
                      onClick={() => settle(d.id)}
                    >
                      Soldé
                    </button>
                    <button
                      type="button"
                      className="ghost icon"
                      aria-label="Supprimer"
                      onClick={() => removeDebt(d.id)}
                    >
                      ×
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {closed.length > 0 && (
        <section className="panel">
          <h2>Soldées</h2>
          <ul className="debt-list muted-list">
            {closed.map((d) => (
              <li key={d.id}>
                <div className="debt-head">
                  <strong>{d.person}</strong>
                  <span>{formatEUR(d.amount)}</span>
                  <button
                    type="button"
                    className="ghost icon"
                    onClick={() => removeDebt(d.id)}
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="local-note">Données locales uniquement (cet appareil).</p>
    </div>
  )
}
