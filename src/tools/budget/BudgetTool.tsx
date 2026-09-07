import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { downloadJson } from '../../lib/storage'
import {
  addDaysISO,
  endOfWeekISO,
  formatEUR,
  formatMonthLabel,
  monthKey,
  shiftMonth,
  todayISO,
  uid,
} from '../../lib/format'
import { loadBudget, saveBudget } from './storage'
import {
  ensureRecurrentTransactions,
  migrateBudget,
  type Account,
  type BudgetState,
  type Category,
  type CategoryKind,
  type Recurrence,
  type Transaction,
  type TxStatus,
} from './types'
import { createAccountTransfer, ensureLinkedCategories } from '../../lib/bridge'
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

type Tab = 'overview' | 'list' | 'categories' | 'accounts' | 'recurrents'

type Props = { onBack: () => void }

export function BudgetTool({ onBack }: Props) {
  const [state, setState] = useState<BudgetState>(() =>
    ensureLinkedCategories(loadBudget()),
  )
  const [month, setMonth] = useState(() => monthKey(todayISO()))
  const [tab, setTab] = useState<Tab>('overview')
  const [listFilter, setListFilter] = useState<'all' | 'planned' | 'confirmed'>(
    'all',
  )

  const [txType, setTxType] = useState<CategoryKind>('expense')
  const [txAmount, setTxAmount] = useState('')
  const [txLabel, setTxLabel] = useState('')
  const [txNote, setTxNote] = useState('')
  const [txCategoryId, setTxCategoryId] = useState(
    () => loadBudget().categories.find((c) => c.kind === 'expense')?.id ?? '',
  )
  const [txAccountId, setTxAccountId] = useState(
    () => loadBudget().accounts[0]?.id ?? '',
  )
  const [txDate, setTxDate] = useState(todayISO())
  const [txStatus, setTxStatus] = useState<TxStatus>('confirmed')

  const [catName, setCatName] = useState('')
  const [catKind, setCatKind] = useState<CategoryKind>('expense')
  const [catColor, setCatColor] = useState(CATEGORY_COLORS[0])
  const [catBudget, setCatBudget] = useState('')

  const [accName, setAccName] = useState('')
  const [accColor, setAccColor] = useState(CATEGORY_COLORS[3])

  const [recType, setRecType] = useState<CategoryKind>('expense')
  const [recAmount, setRecAmount] = useState('')
  const [recLabel, setRecLabel] = useState('')
  const [recNote, setRecNote] = useState('')
  const [recDay, setRecDay] = useState('1')
  const [recCategoryId, setRecCategoryId] = useState('')
  const [recAccountId, setRecAccountId] = useState('')

  const [xferFrom, setXferFrom] = useState('')
  const [xferTo, setXferTo] = useState('')
  const [xferAmount, setXferAmount] = useState('')
  const [xferLabel, setXferLabel] = useState('Virement')

  useEffect(() => {
    saveBudget(state)
  }, [state])

  const categoriesForType = useMemo(
    () => state.categories.filter((c) => c.kind === txType),
    [state.categories, txType],
  )
  const recCategories = useMemo(
    () => state.categories.filter((c) => c.kind === recType),
    [state.categories, recType],
  )

  const resolvedCategoryId = categoriesForType.some((c) => c.id === txCategoryId)
    ? txCategoryId
    : (categoriesForType[0]?.id ?? '')
  const resolvedAccountId = state.accounts.some((a) => a.id === txAccountId)
    ? txAccountId
    : (state.accounts[0]?.id ?? '')
  const resolvedRecCategory =
    recCategories.find((c) => c.id === recCategoryId)?.id ??
    recCategories[0]?.id ??
    ''
  const resolvedRecAccount =
    state.accounts.find((a) => a.id === recAccountId)?.id ??
    state.accounts[0]?.id ??
    ''

  const monthTx = useMemo(
    () =>
      state.transactions
        .filter((t) => monthKey(t.date) === month)
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            b.createdAt.localeCompare(a.createdAt),
        ),
    [state.transactions, month],
  )

  const confirmed = monthTx.filter((t) => t.status === 'confirmed')
  const planned = monthTx.filter((t) => t.status === 'planned')
  const operating = (list: Transaction[]) =>
    list.filter((t) => !t.transferGroupId)

  const sum = (list: Transaction[], type: CategoryKind) =>
    list.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0)

  const realIncome = sum(operating(confirmed), 'income')
  const realExpense = sum(operating(confirmed), 'expense')
  const realBalance = realIncome - realExpense

  const projIncome = sum(operating(monthTx), 'income')
  const projExpense = sum(operating(monthTx), 'expense')
  const projBalance = projIncome - projExpense

  const today = todayISO()
  const weekEnd = endOfWeekISO(today)
  const upcomingReminders = state.transactions.filter(
    (t) => t.status === 'planned' && t.date <= addDaysISO(today, 7),
  )
  const reminders = {
    upcoming: upcomingReminders,
    overdue: upcomingReminders.filter((t) => t.date < today),
    thisWeek: upcomingReminders.filter(
      (t) => t.date >= today && t.date <= weekEnd,
    ),
  }

  function goMonth(delta: number) {
    setMonth((m) => {
      const next = shiftMonth(m, delta)
      setState((s) => ensureRecurrentTransactions(s, next))
      return next
    })
  }

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of operating(confirmed)) {
      if (t.type !== 'expense') continue
      map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount)
    }
    return [...map.entries()]
      .map(([categoryId, total]) => ({
        category: state.categories.find((c) => c.id === categoryId),
        total,
        limit: state.categoryBudgets.find((b) => b.categoryId === categoryId)
          ?.monthlyLimit,
      }))
      .filter((x) => x.category)
      .sort((a, b) => b.total - a.total)
  }, [confirmed, state.categories, state.categoryBudgets])

  const accountBalances = useMemo(() => {
    return state.accounts.map((acc) => {
      let real = 0
      let projected = 0
      for (const t of state.transactions) {
        if (t.accountId !== acc.id) continue
        const signed = t.type === 'income' ? t.amount : -t.amount
        if (t.status === 'confirmed') real += signed
        projected += signed
      }
      return { account: acc, real, projected }
    })
  }, [state.accounts, state.transactions])

  const filteredList = monthTx.filter((t) =>
    listFilter === 'all' ? true : t.status === listFilter,
  )

  function patchState(updater: (s: BudgetState) => BudgetState) {
    setState(updater)
  }

  function addTransaction(e: FormEvent) {
    e.preventDefault()
    const amount = Number(txAmount.replace(',', '.'))
    if (!amount || amount <= 0 || !resolvedCategoryId || !resolvedAccountId) return

    const next: Transaction = {
      id: uid('tx'),
      type: txType,
      categoryId: resolvedCategoryId,
      accountId: resolvedAccountId,
      amount,
      label: txLabel.trim() || (txType === 'expense' ? 'Dépense' : 'Rentrée'),
      note: txNote.trim(),
      date: txDate,
      status: txDate > todayISO() ? 'planned' : txStatus,
      createdAt: new Date().toISOString(),
    }

    patchState((s) => ({ ...s, transactions: [next, ...s.transactions] }))
    setTxAmount('')
    setTxLabel('')
    setTxNote('')
    setTxDate(todayISO())
    setTxStatus('confirmed')
  }

  function confirmTransaction(id: string) {
    patchState((s) => ({
      ...s,
      transactions: s.transactions.map((t) =>
        t.id === id ? { ...t, status: 'confirmed' as const } : t,
      ),
    }))
  }

  function removeTransaction(id: string) {
    patchState((s) => ({
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
    const limit = Number(catBudget.replace(',', '.'))
    patchState((s) => ({
      ...s,
      categories: [...s.categories, next],
      categoryBudgets:
        limit > 0
          ? [...s.categoryBudgets, { categoryId: next.id, monthlyLimit: limit }]
          : s.categoryBudgets,
    }))
    setCatName('')
    setCatBudget('')
  }

  function setBudgetLimit(categoryId: string, value: string) {
    const limit = Number(value.replace(',', '.'))
    patchState((s) => {
      const others = s.categoryBudgets.filter((b) => b.categoryId !== categoryId)
      if (!limit || limit <= 0) return { ...s, categoryBudgets: others }
      return {
        ...s,
        categoryBudgets: [...others, { categoryId, monthlyLimit: limit }],
      }
    })
  }

  function removeCategory(id: string) {
    const used = state.transactions.some((t) => t.categoryId === id)
    if (used) {
      window.alert(
        'Cette catégorie est utilisée par des opérations. Réassignez-les ou supprimez-les d’abord.',
      )
      return
    }
    patchState((s) => ({
      ...s,
      categories: s.categories.filter((c) => c.id !== id),
      categoryBudgets: s.categoryBudgets.filter((b) => b.categoryId !== id),
      recurrents: s.recurrents.filter((r) => r.categoryId !== id),
    }))
  }

  function submitTransfer(e: FormEvent) {
    e.preventDefault()
    const amount = Number(xferAmount.replace(',', '.'))
    const from = xferFrom || state.accounts[0]?.id
    const to = xferTo || state.accounts[1]?.id || state.accounts[0]?.id
    if (!amount || amount <= 0 || !from || !to || from === to) return
    createAccountTransfer({
      fromAccountId: from,
      toAccountId: to,
      amount,
      label: xferLabel.trim() || 'Virement',
    })
    setState(ensureLinkedCategories(loadBudget()))
    setXferAmount('')
  }

  function addAccount(e: FormEvent) {
    e.preventDefault()
    const name = accName.trim()
    if (!name) return
    const next: Account = { id: uid('acc'), name, color: accColor }
    patchState((s) => ({ ...s, accounts: [...s.accounts, next] }))
    setAccName('')
  }

  function removeAccount(id: string) {
    if (state.accounts.length <= 1) {
      window.alert('Il faut au moins un compte.')
      return
    }
    const used = state.transactions.some((t) => t.accountId === id)
    if (used) {
      window.alert('Ce compte a des opérations. Réassignez-les d’abord.')
      return
    }
    patchState((s) => ({
      ...s,
      accounts: s.accounts.filter((a) => a.id !== id),
      recurrents: s.recurrents.filter((r) => r.accountId !== id),
    }))
  }

  function addRecurrence(e: FormEvent) {
    e.preventDefault()
    const amount = Number(recAmount.replace(',', '.'))
    const day = Number(recDay)
    if (!amount || amount <= 0 || !resolvedRecCategory || !resolvedRecAccount) return
    if (!day || day < 1 || day > 31) return

    const next: Recurrence = {
      id: uid('rec'),
      type: recType,
      categoryId: resolvedRecCategory,
      accountId: resolvedRecAccount,
      amount,
      label: recLabel.trim() || (recType === 'expense' ? 'Récurrent' : 'Salaire'),
      note: recNote.trim(),
      dayOfMonth: day,
      active: true,
    }

    patchState((s) => {
      const withRec = { ...s, recurrents: [...s.recurrents, next] }
      return ensureRecurrentTransactions(
        ensureRecurrentTransactions(withRec, month),
        shiftMonth(month, 1),
      )
    })
    setRecAmount('')
    setRecLabel('')
    setRecNote('')
  }

  function toggleRecurrence(id: string) {
    patchState((s) => ({
      ...s,
      recurrents: s.recurrents.map((r) =>
        r.id === id ? { ...r, active: !r.active } : r,
      ),
    }))
  }

  function removeRecurrence(id: string) {
    patchState((s) => ({
      ...s,
      recurrents: s.recurrents.filter((r) => r.id !== id),
    }))
  }

  function nameOf(list: { id: string; name: string }[], id: string) {
    return list.find((x) => x.id === id)?.name ?? '—'
  }

  function colorOf(list: { id: string; color: string }[], id: string) {
    return list.find((x) => x.id === id)?.color ?? '#6c757d'
  }

  function exportData() {
    downloadJson(`budget-export.json`, state)
  }

  function importData(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        if (
          !window.confirm(
            'Remplacer toutes les données budget locales par ce fichier ?',
          )
        ) {
          return
        }
        setState(migrateBudget(parsed))
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
            onClick={() => goMonth(-1)}
          >
            ‹
          </button>
          <span>{formatMonthLabel(month)}</span>
          <button
            type="button"
            className="ghost icon"
            aria-label="Mois suivant"
            onClick={() => goMonth(1)}
          >
            ›
          </button>
        </div>
      </header>

      {reminders.upcoming.length > 0 && (
        <aside className="reminder" role="status">
          <strong>
            {reminders.upcoming.length} opération
            {reminders.upcoming.length > 1 ? 's' : ''} à confirmer
          </strong>
          <span>
            {reminders.overdue.length > 0 &&
              `${reminders.overdue.length} en retard · `}
            {reminders.thisWeek.length} cette semaine
          </span>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setTab('list')
              setListFilter('planned')
            }}
          >
            Voir
          </button>
        </aside>
      )}

      <nav className="tabs" aria-label="Sections budget">
        {(
          [
            ['overview', 'Vue globale'],
            ['list', 'Opérations'],
            ['recurrents', 'Récurrents'],
            ['categories', 'Catégories'],
            ['accounts', 'Comptes'],
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
          <div className="stats dual">
            <article className="stat income">
              <span>Rentrées réelles</span>
              <strong>{formatEUR(realIncome)}</strong>
            </article>
            <article className="stat expense">
              <span>Dépenses réelles</span>
              <strong>{formatEUR(realExpense)}</strong>
            </article>
            <article className={`stat balance ${realBalance >= 0 ? 'pos' : 'neg'}`}>
              <span>Solde réel</span>
              <strong>{formatEUR(realBalance)}</strong>
            </article>
            <article className="stat soft">
              <span>Rentrées prévues</span>
              <strong>{formatEUR(projIncome)}</strong>
            </article>
            <article className="stat soft">
              <span>Dépenses prévues</span>
              <strong>{formatEUR(projExpense)}</strong>
            </article>
            <article className={`stat soft ${projBalance >= 0 ? 'pos' : 'neg'}`}>
              <span>Solde projeté</span>
              <strong>{formatEUR(projBalance)}</strong>
            </article>
          </div>

          <div className="split">
            <div>
              <h2>Dépenses & budgets</h2>
              {byCategory.length === 0 && state.categoryBudgets.length === 0 ? (
                <p className="muted">Aucune dépense confirmée ce mois-ci.</p>
              ) : (
                <ul className="bars">
                  {state.categories
                    .filter((c) => c.kind === 'expense')
                    .map((category) => {
                      const total =
                        byCategory.find((b) => b.category?.id === category.id)
                          ?.total ?? 0
                      const limit = state.categoryBudgets.find(
                        (b) => b.categoryId === category.id,
                      )?.monthlyLimit
                      if (total === 0 && !limit) return null
                      const pctOfExpense =
                        realExpense > 0 ? (total / realExpense) * 100 : 0
                      const pctOfLimit = limit ? Math.min(100, (total / limit) * 100) : pctOfExpense
                      const over = limit != null && total > limit
                      return (
                        <li key={category.id}>
                          <div className="bar-meta">
                            <span>
                              <i
                                className="dot"
                                style={{ background: category.color }}
                              />
                              {category.name}
                              {over && <em className="warn"> dépassé</em>}
                            </span>
                            <span>
                              {formatEUR(total)}
                              {limit != null && ` / ${formatEUR(limit)}`}
                              {!limit && ` · ${pctOfExpense.toFixed(0)}%`}
                            </span>
                          </div>
                          <div className="bar-track">
                            <div
                              className={`bar-fill${over ? ' over' : ''}`}
                              style={{
                                width: `${pctOfLimit}%`,
                                background: over ? '#e76f51' : category.color,
                              }}
                            />
                          </div>
                        </li>
                      )
                    })}
                </ul>
              )}

              {planned.length > 0 && (
                <>
                  <h2 className="spaced">À confirmer ({planned.length})</h2>
                  <ul className="tx-list compact">
                    {planned.slice(0, 5).map((t) => (
                      <li key={t.id}>
                        <i
                          className="dot"
                          style={{
                            background: colorOf(state.categories, t.categoryId),
                          }}
                        />
                        <div className="tx-main">
                          <strong>{t.label}</strong>
                          <span>
                            {t.date}
                            {t.date < today ? ' · en retard' : ''}
                          </span>
                        </div>
                        <strong className={t.type === 'income' ? 'pos' : 'neg'}>
                          {formatEUR(t.amount)}
                        </strong>
                        <button
                          type="button"
                          className="primary sm"
                          onClick={() => confirmTransaction(t.id)}
                        >
                          Confirmer
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
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
                Note
                <input
                  value={txNote}
                  onChange={(e) => setTxNote(e.target.value)}
                  placeholder="Détail optionnel"
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
                Compte
                <select
                  value={resolvedAccountId}
                  onChange={(e) => setTxAccountId(e.target.value)}
                  required
                >
                  {state.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={txDate}
                  onChange={(e) => {
                    const next = e.target.value
                    setTxDate(next)
                    if (next > todayISO()) setTxStatus('planned')
                  }}
                  required
                />
              </label>
              {txDate <= todayISO() && (
                <div className="seg">
                  <button
                    type="button"
                    className={txStatus === 'confirmed' ? 'on' : ''}
                    onClick={() => setTxStatus('confirmed')}
                  >
                    Confirmée
                  </button>
                  <button
                    type="button"
                    className={txStatus === 'planned' ? 'on' : ''}
                    onClick={() => setTxStatus('planned')}
                  >
                    Planifiée
                  </button>
                </div>
              )}
              {txDate > todayISO() && (
                <p className="hint">Date future → enregistrée comme planifiée.</p>
              )}
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
            <div className="row wrap">
              <div className="seg mini">
                {(
                  [
                    ['all', 'Toutes'],
                    ['planned', 'Planifiées'],
                    ['confirmed', 'Confirmées'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={listFilter === id ? 'on' : ''}
                    onClick={() => setListFilter(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button type="button" className="ghost" onClick={exportData}>
                Exporter
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
          {filteredList.length === 0 ? (
            <p className="muted">Aucune opération.</p>
          ) : (
            <ul className="tx-list">
              {filteredList.map((t) => (
                <li key={t.id} className={t.status === 'planned' ? 'planned' : ''}>
                  <i
                    className="dot"
                    style={{
                      background: colorOf(state.categories, t.categoryId),
                    }}
                  />
                  <div className="tx-main">
                    <strong>
                      {t.label}
                      {t.status === 'planned' && (
                        <em className="badge">planifiée</em>
                      )}
                      {t.transferGroupId && (
                        <em className="badge">virement</em>
                      )}
                      {t.source?.tool === 'savings' && (
                        <em className="badge">épargne</em>
                      )}
                      {t.source?.tool === 'debts' && (
                        <em className="badge">dette</em>
                      )}
                    </strong>
                    <span>
                      {t.date} · {nameOf(state.categories, t.categoryId)} ·{' '}
                      {nameOf(state.accounts, t.accountId)}
                      {t.note ? ` · ${t.note}` : ''}
                    </span>
                  </div>
                  <strong className={t.type === 'income' ? 'pos' : 'neg'}>
                    {t.type === 'income' ? '+' : '−'}
                    {formatEUR(t.amount)}
                  </strong>
                  {t.status === 'planned' ? (
                    <button
                      type="button"
                      className="primary sm"
                      onClick={() => confirmTransaction(t.id)}
                    >
                      Confirmer
                    </button>
                  ) : (
                    <span className="spacer" />
                  )}
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

      {tab === 'recurrents' && (
        <section className="panel">
          <form className="composer inline" onSubmit={addRecurrence}>
            <h2>Nouvelle récurrence mensuelle</h2>
            <p className="hint">
              Génère chaque mois une opération planifiée (loyer, salaire…).
            </p>
            <div className="seg">
              <button
                type="button"
                className={recType === 'expense' ? 'on' : ''}
                onClick={() => setRecType('expense')}
              >
                Dépense
              </button>
              <button
                type="button"
                className={recType === 'income' ? 'on' : ''}
                onClick={() => setRecType('income')}
              >
                Rentrée
              </button>
            </div>
            <label>
              Libellé
              <input
                value={recLabel}
                onChange={(e) => setRecLabel(e.target.value)}
                placeholder="Ex. Loyer"
                required
              />
            </label>
            <label>
              Montant (€)
              <input
                inputMode="decimal"
                value={recAmount}
                onChange={(e) => setRecAmount(e.target.value)}
                required
              />
            </label>
            <label>
              Jour du mois
              <input
                type="number"
                min={1}
                max={31}
                value={recDay}
                onChange={(e) => setRecDay(e.target.value)}
                required
              />
            </label>
            <label>
              Catégorie
              <select
                value={resolvedRecCategory}
                onChange={(e) => setRecCategoryId(e.target.value)}
              >
                {recCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Compte
              <select
                value={resolvedRecAccount}
                onChange={(e) => setRecAccountId(e.target.value)}
              >
                {state.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Note
              <input
                value={recNote}
                onChange={(e) => setRecNote(e.target.value)}
                placeholder="Optionnel"
              />
            </label>
            <button type="submit" className="primary">
              Créer
            </button>
          </form>

          {state.recurrents.length === 0 ? (
            <p className="muted">Aucune récurrence pour l’instant.</p>
          ) : (
            <ul className="tx-list">
              {state.recurrents.map((r) => (
                <li key={r.id}>
                  <i
                    className="dot"
                    style={{ background: colorOf(state.categories, r.categoryId) }}
                  />
                  <div className="tx-main">
                    <strong>
                      {r.label}
                      {!r.active && <em className="badge">pause</em>}
                    </strong>
                    <span>
                      Le {r.dayOfMonth} · {nameOf(state.categories, r.categoryId)} ·{' '}
                      {nameOf(state.accounts, r.accountId)}
                      {r.note ? ` · ${r.note}` : ''}
                    </span>
                  </div>
                  <strong className={r.type === 'income' ? 'pos' : 'neg'}>
                    {formatEUR(r.amount)}
                  </strong>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => toggleRecurrence(r.id)}
                  >
                    {r.active ? 'Pause' : 'Activer'}
                  </button>
                  <button
                    type="button"
                    className="ghost icon"
                    aria-label="Supprimer"
                    onClick={() => removeRecurrence(r.id)}
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
            {catKind === 'expense' && (
              <label>
                Budget mensuel (€, optionnel)
                <input
                  inputMode="decimal"
                  value={catBudget}
                  onChange={(e) => setCatBudget(e.target.value)}
                  placeholder="Ex. 300"
                />
              </label>
            )}
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
                    .map((c) => {
                      const limit = state.categoryBudgets.find(
                        (b) => b.categoryId === c.id,
                      )?.monthlyLimit
                      return (
                        <li key={c.id} className="cat-row">
                          <i className="dot" style={{ background: c.color }} />
                          <div className="tx-main">
                            <span>{c.name}</span>
                            {kind === 'expense' && (
                              <label className="inline-limit">
                                Plafond
                                <input
                                  inputMode="decimal"
                                  defaultValue={limit ?? ''}
                                  placeholder="—"
                                  onBlur={(e) =>
                                    setBudgetLimit(c.id, e.target.value)
                                  }
                                />
                              </label>
                            )}
                          </div>
                          <button
                            type="button"
                            className="ghost icon"
                            aria-label={`Supprimer ${c.name}`}
                            onClick={() => removeCategory(c.id)}
                          >
                            ×
                          </button>
                        </li>
                      )
                    })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'accounts' && (
        <section className="panel">
          <form className="composer inline" onSubmit={submitTransfer}>
            <h2>Virement entre comptes</h2>
            <label>
              Depuis
              <select
                value={xferFrom || state.accounts[0]?.id || ''}
                onChange={(e) => setXferFrom(e.target.value)}
              >
                {state.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Vers
              <select
                value={
                  xferTo ||
                  state.accounts[1]?.id ||
                  state.accounts[0]?.id ||
                  ''
                }
                onChange={(e) => setXferTo(e.target.value)}
              >
                {state.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Montant (€)
              <input
                inputMode="decimal"
                value={xferAmount}
                onChange={(e) => setXferAmount(e.target.value)}
                required
              />
            </label>
            <label>
              Libellé
              <input
                value={xferLabel}
                onChange={(e) => setXferLabel(e.target.value)}
              />
            </label>
            <button type="submit" className="primary">
              Virer
            </button>
          </form>

          <form className="composer inline" onSubmit={addAccount}>
            <h2>Nouveau compte</h2>
            <label>
              Nom
              <input
                value={accName}
                onChange={(e) => setAccName(e.target.value)}
                placeholder="Ex. Livret A"
                required
              />
            </label>
            <div className="colors">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={accColor === c ? 'swatch on' : 'swatch'}
                  style={{ background: c }}
                  onClick={() => setAccColor(c)}
                />
              ))}
            </div>
            <button type="submit" className="primary">
              Créer
            </button>
          </form>

          <ul className="account-grid">
            {accountBalances.map(({ account, real, projected }) => (
              <li key={account.id}>
                <header>
                  <i className="dot" style={{ background: account.color }} />
                  <strong>{account.name}</strong>
                  <button
                    type="button"
                    className="ghost icon"
                    aria-label={`Supprimer ${account.name}`}
                    onClick={() => removeAccount(account.id)}
                  >
                    ×
                  </button>
                </header>
                <p>
                  <span>Réel</span>
                  <strong className={real >= 0 ? 'pos' : 'neg'}>
                    {formatEUR(real)}
                  </strong>
                </p>
                <p>
                  <span>Projeté</span>
                  <strong className={projected >= 0 ? 'pos' : 'neg'}>
                    {formatEUR(projected)}
                  </strong>
                </p>
              </li>
            ))}
          </ul>
          <p className="hint">
            Les soldes partent de 0 et suivent les opérations de chaque compte.
            Pour un solde de départ, ajoutez une rentrée confirmée « Solde
            initial ».
          </p>
        </section>
      )}

      <p className="local-note">
        Données stockées uniquement dans ce navigateur (localStorage). Aucun
        compte, aucun serveur.
      </p>
    </div>
  )
}
