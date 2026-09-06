import {
  clampDayInMonth,
  monthKey,
  todayISO,
  uid,
} from '../../lib/format'

export type CategoryKind = 'expense' | 'income'
export type TxStatus = 'planned' | 'confirmed'

export type Category = {
  id: string
  name: string
  kind: CategoryKind
  color: string
}

export type Account = {
  id: string
  name: string
  color: string
}

export type CategoryBudget = {
  categoryId: string
  monthlyLimit: number
}

export type Recurrence = {
  id: string
  type: CategoryKind
  categoryId: string
  accountId: string
  amount: number
  label: string
  note: string
  dayOfMonth: number
  active: boolean
}

export type Transaction = {
  id: string
  type: CategoryKind
  categoryId: string
  accountId: string
  amount: number
  label: string
  note: string
  date: string
  status: TxStatus
  recurrenceId?: string
  createdAt: string
}

export type BudgetState = {
  version: 2
  categories: Category[]
  accounts: Account[]
  categoryBudgets: CategoryBudget[]
  recurrents: Recurrence[]
  transactions: Transaction[]
}

export const BUDGET_STORAGE_KEY = 'multi-outils:budget:v1'

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Alimentation', kind: 'expense', color: '#e76f51' },
  { id: 'cat-transport', name: 'Transport', kind: 'expense', color: '#457b9d' },
  { id: 'cat-housing', name: 'Logement', kind: 'expense', color: '#264653' },
  { id: 'cat-leisure', name: 'Loisirs', kind: 'expense', color: '#9b5de5' },
  { id: 'cat-health', name: 'Santé', kind: 'expense', color: '#2a9d8f' },
  { id: 'cat-other-exp', name: 'Autre dépense', kind: 'expense', color: '#6c757d' },
  { id: 'cat-salary', name: 'Salaire', kind: 'income', color: '#2a9d8f' },
  { id: 'cat-freelance', name: 'Freelance / side', kind: 'income', color: '#e9a825' },
  { id: 'cat-other-inc', name: 'Autre rentrée', kind: 'income', color: '#457b9d' },
]

export const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'acc-courant', name: 'Courant', color: '#457b9d' },
  { id: 'acc-epargne', name: 'Épargne', color: '#2a9d8f' },
  { id: 'acc-cash', name: 'Cash', color: '#e9a825' },
]

export function emptyBudget(): BudgetState {
  return {
    version: 2,
    categories: DEFAULT_CATEGORIES,
    accounts: DEFAULT_ACCOUNTS,
    categoryBudgets: [],
    recurrents: [],
    transactions: [],
  }
}

export function migrateBudget(raw: unknown): BudgetState {
  const base = emptyBudget()
  if (!raw || typeof raw !== 'object') return base
  const data = raw as Partial<BudgetState> & {
    transactions?: Array<Partial<Transaction> & { id: string }>
  }

  const accounts =
    Array.isArray(data.accounts) && data.accounts.length > 0
      ? data.accounts
      : DEFAULT_ACCOUNTS
  const defaultAccountId = accounts[0]?.id ?? 'acc-courant'

  const categories =
    Array.isArray(data.categories) && data.categories.length > 0
      ? data.categories
      : DEFAULT_CATEGORIES

  const transactions: Transaction[] = Array.isArray(data.transactions)
    ? data.transactions.map((t) => ({
        id: t.id,
        type: t.type === 'income' ? 'income' : 'expense',
        categoryId: t.categoryId ?? categories[0]?.id ?? '',
        accountId: t.accountId ?? defaultAccountId,
        amount: Number(t.amount) || 0,
        label: t.label ?? '',
        note: t.note ?? '',
        date: t.date ?? todayISO(),
        status: t.status === 'planned' ? 'planned' : 'confirmed',
        recurrenceId: t.recurrenceId,
        createdAt: t.createdAt ?? new Date().toISOString(),
      }))
    : []

  return {
    version: 2,
    categories,
    accounts,
    categoryBudgets: Array.isArray(data.categoryBudgets)
      ? data.categoryBudgets
      : [],
    recurrents: Array.isArray(data.recurrents) ? data.recurrents : [],
    transactions,
  }
}

/** Ensure planned txs exist for active recurrents in the given month. */
export function ensureRecurrentTransactions(
  state: BudgetState,
  ym: string,
): BudgetState {
  const today = todayISO()
  let changed = false
  const nextTx = [...state.transactions]

  for (const r of state.recurrents) {
    if (!r.active) continue
    const already = nextTx.some(
      (t) => t.recurrenceId === r.id && monthKey(t.date) === ym,
    )
    if (already) continue

    const date = clampDayInMonth(ym, r.dayOfMonth)
    nextTx.push({
      id: uid('tx'),
      type: r.type,
      categoryId: r.categoryId,
      accountId: r.accountId,
      amount: r.amount,
      label: r.label,
      note: r.note,
      date,
      status: date > today ? 'planned' : 'planned',
      recurrenceId: r.id,
      createdAt: new Date().toISOString(),
    })
    changed = true
  }

  if (!changed) return state
  return { ...state, transactions: nextTx }
}
