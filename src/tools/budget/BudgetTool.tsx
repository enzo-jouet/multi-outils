import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { downloadJson } from '../../lib/storage'
import { loadBudget, saveBudget } from './storage'
import {
  formatEUR,
  formatMonthLabel,
  monthKey,
  shiftMonth,
  todayISO,
  uid,
  type BudgetState,
  type Category,
  type CategoryKind,
  type Transaction,
} from './types'
import './BudgetTool.css'

const CATEGORY_COLORS = [
  '#2a9d8f',
  '#e76f51',
  '#e9a825',
  '#457b9d',
  '#9b5de5',
  '#264653',
  '#f4a261',
  '#6c757d',
]

type Props = {
  onBack: () => void
}

export function BudgetTool({ onBack }: Props) {
  const [state, setState] = useState<BudgetState>(() => loadBudget())
  const [month, setMonth] = useState(() => monthKey(todayISO()))
  const [tab, setTab] = useState<'overview' | 'list' | 'categories'>('overview')

  const [txType, setTxType] = useState<CategoryKind>('expense')
  const [txAmount, setTxAmount] = useState('')
  const [txLabel, setTxLabel] = useState('')
  const [txCategoryId, setTxCategoryId] = useState(
    () => loadBudget().categories.find((c) => c.kind === 'expense')?.id ?? '',
  )
  const [txDate, setTxDate] = useState(todayISO())

  const [catName, setCatName] = useState('')
  const [catKind, setCatKind] = useState<CategoryKind>('expense')
  const [catColor, setCatColor] = useState(CATEGORY_COLORS[0])

  useEffect(() => {
    saveBudget(state)
  }, [state])

  const categoriesForType = useMemo(
    () => state.categories.filter((c) => c.kind === txType),
    [state.categories, txType],
  )

  const resolvedCategoryId = categoriesForType.some((c) => c.id === txCategoryId)
    ? txCategoryId
    : (categoriesForType[0]?.id ?? '')

  const monthTx = useMemo(
    () =>
      state.transactions
        .filter((t) => monthKey(t.date) === month)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [state.transactions, month],
  )

  const income = monthTx
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0)
  const expense = monthTx
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0)
  const balance = income - expense

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of monthTx) {
      if (t.type !== 'expense') continue
      map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount)
    }
    return [...map.entries()]
      .map(([categoryId, total]) => ({
        category: state.categories.find((c) => c.id === categoryId),
        total,
      }))
      .filter((x) => x.category)
      .sort((a, b) => b.total - a.total)
  }, [monthTx, state.categories])

  function addTransaction(e: FormEvent) {
    e.preventDefault()
    const amount = Number(txAmount.replace(',', '.'))
    if (!amount || amount <= 0 || !resolvedCategoryId) return

    const next: Transaction = {
      id: uid('tx'),
      type: txType,
      categoryId: resolvedCategoryId,
      amount,
      label: txLabel.trim() || (txType === 'expense' ? 'Dépense' : 'Rentrée'),
      date: txDate,
      createdAt: new Date().toISOString(),
    }

    setState((s) => ({ ...s, transactions: [next, ...s.transactions] }))
    setTxAmount('')
    setTxLabel('')
    setTxDate(todayISO())
  }

  function removeTransaction(id: string) {
    setState((s) => ({
      ...s,
      transactions: s.transactions.filter((t) => t.id !== id),
    }))
  }

  function addCategory(e: FormEvent) {
    e.preventDefault()
    const name = catName.trim()
    if (!name) return
    const next: Category = {
      id: uid('cat'),
      name,
      kind: catKind,
      color: catColor,
    }
    setState((s) => ({ ...s, categories: [...s.categories, next] }))
    setCatName('')
  }

  function removeCategory(id: string) {
    const used = state.transactions.some((t) => t.categoryId === id)
    if (used) {
      window.alert(
        'Cette catégorie est utilisée par des opérations. Réassignez-les ou supprimez-les d’abord.',
      )
      return
    }
    setState((s) => ({
      ...s,
      categories: s.categories.filter((c) => c.id !== id),
    }))
  }

  function categoryName(id: string) {
    return state.categories.find((c) => c.id === id)?.name ?? '—'
  }

  function categoryColor(id: string) {
    return state.categories.find((c) => c.id === id)?.color ?? '#6c757d'
  }

  function exportData() {
    downloadJson(`budget-${month}.json`, state)
  }

  function importData(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as BudgetState
        if (!Array.isArray(parsed.categories) || !Array.isArray(parsed.transactions)) {
          throw new Error('invalid')
        }
        if (
          !window.confirm(
            'Remplacer toutes les données budget locales par ce fichier ?',
          )
        ) {
          return
        }
        setState(parsed)
      } catch {
        window.alert('Fichier invalide.')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="budget">
      <header className="budget-top">
        <button type="button" className="ghost" onClick={onBack}>
          ← Outils
        </button>
        <div className="budget-title-block">
          <p className="eyebrow">Outil</p>
          <h1>Budget</h1>
        </div>
        <div className="month-nav">
          <button
            type="button"
            className="ghost icon"
            aria-label="Mois précédent"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
          >
            ‹
          </button>
          <span>{formatMonthLabel(month)}</span>
          <button
            type="button"
            className="ghost icon"
            aria-label="Mois suivant"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
          >
            ›
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="Sections budget">
        {(
          [
            ['overview', 'Vue globale'],
            ['list', 'Opérations'],
            ['categories', 'Catégories'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'tab active' : 'tab'}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <section className="panel overview">
          <div className="stats">
            <article className="stat income">
              <span>Rentrées</span>
              <strong>{formatEUR(income)}</strong>
            </article>
            <article className="stat expense">
              <span>Dépenses</span>
              <strong>{formatEUR(expense)}</strong>
            </article>
            <article className={`stat balance ${balance >= 0 ? 'pos' : 'neg'}`}>
              <span>Solde du mois</span>
              <strong>{formatEUR(balance)}</strong>
            </article>
          </div>

          <div className="split">
            <div>
              <h2>Dépenses par catégorie</h2>
              {byCategory.length === 0 ? (
                <p className="muted">Aucune dépense ce mois-ci.</p>
              ) : (
                <ul className="bars">
                  {byCategory.map(({ category, total }) => {
                    const pct = expense > 0 ? (total / expense) * 100 : 0
                    return (
                      <li key={category!.id}>
                        <div className="bar-meta">
                          <span>
                            <i
                              className="dot"
                              style={{ background: category!.color }}
                            />
                            {category!.name}
                          </span>
                          <span>
                            {formatEUR(total)} · {pct.toFixed(0)}%
                          </span>
                        </div>
                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{
                              width: `${pct}%`,
                              background: category!.color,
                            }}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <form className="composer" onSubmit={addTransaction}>
              <h2>Ajouter une opération</h2>
              <div className="seg">
                <button
                  type="button"
                  className={txType === 'expense' ? 'on' : ''}
                  onClick={() => {
                    setTxType('expense')
                    const first = state.categories.find((c) => c.kind === 'expense')
                    if (first) setTxCategoryId(first.id)
                  }}
                >
                  Dépense
                </button>
                <button
                  type="button"
                  className={txType === 'income' ? 'on' : ''}
                  onClick={() => {
                    setTxType('income')
                    const first = state.categories.find((c) => c.kind === 'income')
                    if (first) setTxCategoryId(first.id)
                  }}
                >
                  Rentrée
                </button>
              </div>
              <label>
                Montant (€)
                <input
                  inputMode="decimal"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  placeholder="0,00"
                  required
                />
              </label>
              <label>
                Libellé
                <input
                  value={txLabel}
                  onChange={(e) => setTxLabel(e.target.value)}
                  placeholder="Ex. courses Carrefour"
                />
              </label>
              <label>
                Catégorie
                <select
                  value={resolvedCategoryId}
                  onChange={(e) => setTxCategoryId(e.target.value)}
                  required
                >
                  {categoriesForType.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  required
                />
              </label>
              <button type="submit" className="primary">
                Enregistrer
              </button>
            </form>
          </div>
        </section>
      )}

      {tab === 'list' && (
        <section className="panel">
          <div className="list-actions">
            <h2>Opérations — {formatMonthLabel(month)}</h2>
            <div className="row">
              <button type="button" className="ghost" onClick={exportData}>
                Exporter JSON
              </button>
              <label className="ghost file">
                Importer
                <input
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) importData(f)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
          </div>
          {monthTx.length === 0 ? (
            <p className="muted">Aucune opération ce mois-ci.</p>
          ) : (
            <ul className="tx-list">
              {monthTx.map((t) => (
                <li key={t.id}>
                  <i
                    className="dot"
                    style={{ background: categoryColor(t.categoryId) }}
                  />
                  <div className="tx-main">
                    <strong>{t.label}</strong>
                    <span>
                      {t.date} · {categoryName(t.categoryId)}
                    </span>
                  </div>
                  <strong className={t.type === 'income' ? 'pos' : 'neg'}>
                    {t.type === 'income' ? '+' : '−'}
                    {formatEUR(t.amount)}
                  </strong>
                  <button
                    type="button"
                    className="ghost icon"
                    aria-label="Supprimer"
                    onClick={() => removeTransaction(t.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'categories' && (
        <section className="panel">
          <form className="composer inline" onSubmit={addCategory}>
            <h2>Nouvelle catégorie</h2>
            <div className="seg">
              <button
                type="button"
                className={catKind === 'expense' ? 'on' : ''}
                onClick={() => setCatKind('expense')}
              >
                Dépense
              </button>
              <button
                type="button"
                className={catKind === 'income' ? 'on' : ''}
                onClick={() => setCatKind('income')}
              >
                Rentrée
              </button>
            </div>
            <label>
              Nom
              <input
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="Ex. Restaurants"
                required
              />
            </label>
            <div className="colors" role="listbox" aria-label="Couleur">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={catColor === c ? 'swatch on' : 'swatch'}
                  style={{ background: c }}
                  aria-label={c}
                  onClick={() => setCatColor(c)}
                />
              ))}
            </div>
            <button type="submit" className="primary">
              Créer
            </button>
          </form>

          <div className="cat-columns">
            {(['expense', 'income'] as const).map((kind) => (
              <div key={kind}>
                <h3>{kind === 'expense' ? 'Dépenses' : 'Rentrées'}</h3>
                <ul className="cat-list">
                  {state.categories
                    .filter((c) => c.kind === kind)
                    .map((c) => (
                      <li key={c.id}>
                        <i className="dot" style={{ background: c.color }} />
                        <span>{c.name}</span>
                        <button
                          type="button"
                          className="ghost icon"
                          aria-label={`Supprimer ${c.name}`}
                          onClick={() => removeCategory(c.id)}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="local-note">
        Données stockées uniquement dans ce navigateur (localStorage). Aucun
        compte, aucun serveur.
      </p>
    </div>
  )
}
