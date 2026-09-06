import { loadJson, saveJson } from '../../lib/storage'
import { monthKey, todayISO } from '../../lib/format'
import {
  BUDGET_STORAGE_KEY,
  emptyBudget,
  ensureRecurrentTransactions,
  migrateBudget,
  type BudgetState,
} from './types'

export function loadBudget(): BudgetState {
  const raw = loadJson<unknown>(BUDGET_STORAGE_KEY, null)
  let state = raw ? migrateBudget(raw) : emptyBudget()
  const ym = monthKey(todayISO())
  state = ensureRecurrentTransactions(state, ym)
  state = ensureRecurrentTransactions(state, shiftNext(ym))
  return state
}

function shiftNext(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function saveBudget(state: BudgetState): void {
  saveJson(BUDGET_STORAGE_KEY, state)
}
